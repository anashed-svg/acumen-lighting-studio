"""Acumen Lighting Studio - web app.

Sales upload the villa image, draw lighting effects on it (choosing each
effect type from Acumen's catalog), and get back a clean photorealistic
night render with those effects applied.

Image engine is pluggable via IMAGE_PROVIDER (default: openai gpt-image-1).

Run:  python app.py   ->   open http://localhost:8000
"""

import base64
import json
import os
import secrets

from dotenv import load_dotenv

load_dotenv()  # load .env before importing the engine (it reads the API key)

from fastapi import FastAPI, File, Form, UploadFile  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from prompt import EFFECTS, build_studio_prompt  # noqa: E402

# Pick the image engine. Default: OpenAI gpt-image-1. Set IMAGE_PROVIDER=gemini to switch.
PROVIDER = os.environ.get("IMAGE_PROVIDER", "openai").lower()
if PROVIDER == "gemini":
    from gemini_render import generate_image  # noqa: E402
else:
    from openai_render import generate_image  # noqa: E402

from vision import describe_marks  # noqa: E402  (free Gemini vision, independent of engine)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

app = FastAPI(title="Acumen Lighting Studio")

STUDIO_USER = os.environ.get("STUDIO_USER", "acumen")
STUDIO_PASSWORD = os.environ.get("STUDIO_PASSWORD")  # set this (e.g. on Render) to require a login


@app.middleware("http")
async def password_gate(request, call_next):
    """If STUDIO_PASSWORD is set, require HTTP Basic auth for every request."""
    if STUDIO_PASSWORD:
        ok = False
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Basic "):
            try:
                user, _, pw = base64.b64decode(auth[6:]).decode().partition(":")
                ok = (secrets.compare_digest(user, STUDIO_USER)
                      and secrets.compare_digest(pw, STUDIO_PASSWORD))
            except Exception:
                ok = False
        if not ok:
            from starlette.responses import Response
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Acumen Studio"'})
    return await call_next(request)


@app.post("/api/describe")
async def describe(image: UploadFile = File(...)):
    """Auto-describe where each numbered mark sits (free Gemini vision)."""
    image_bytes = await image.read()
    if not image_bytes:
        return JSONResponse(status_code=400, content={"error": "No image received."})
    try:
        notes = await run_in_threadpool(
            describe_marks, image_bytes, image.content_type or "image/png"
        )
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    return {"notes": notes}


@app.get("/api/effects")
async def effects():
    """The effect palette (single source of truth, shared with the UI)."""
    return [
        {"id": e["id"], "en": e["en"], "ar": e["ar"], "kind": e["kind"], "color": e["color"]}
        for e in EFFECTS
    ]


@app.post("/api/prompt")
async def prompt_text(annotations: str = Form("[]"), note: str = Form("")):
    """Return the ready-to-paste prompt (free mode: paste into AI Studio/ChatGPT)."""
    try:
        anns = json.loads(annotations)
    except json.JSONDecodeError:
        anns = []
    return {"prompt": build_studio_prompt(anns, note)}


@app.post("/api/render")
async def render(
    image: UploadFile = File(...),
    annotations: str = Form("[]"),
    note: str = Form(""),
):
    image_bytes = await image.read()
    if not image_bytes:
        return JSONResponse(status_code=400, content={"error": "No image received."})
    try:
        anns = json.loads(annotations)
    except json.JSONDecodeError:
        anns = []
    if not anns:
        return JSONResponse(status_code=400, content={"error": "Add at least one effect on the image."})

    prompt = build_studio_prompt(anns, note)
    try:
        result = await run_in_threadpool(
            generate_image, prompt, image_bytes, image.content_type or "image/png"
        )
    except Exception as exc:  # surface a friendly message to the page
        return JSONResponse(status_code=500, content={"error": str(exc)})

    encoded = base64.b64encode(result).decode()
    return {"image": f"data:image/png;base64,{encoded}"}


# Serve the front-end (index.html) + assets from ./static at the site root.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


def main() -> None:
    import uvicorn

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
