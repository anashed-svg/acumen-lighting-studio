"""Free Gemini vision: auto-describe where each numbered mark sits on the building.

Uses gemini-2.5-flash (text/vision output) which is available on the free tier,
unlike image generation. Reads GEMINI_API_KEY from the environment.
"""

import json
import os
import time

from google import genai
from google.genai import types

VISION_MODEL = os.environ.get("GEMINI_VISION_MODEL", "gemini-2.5-flash")

_client = None
_TRANSIENT = ("503", "UNAVAILABLE", "overloaded", "high demand", "429", "RESOURCE_EXHAUSTED")


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is missing — add it to your .env file.")
        _client = genai.Client(api_key=key)
    return _client


def _is_transient(err) -> bool:
    s = str(err)
    return any(t in s for t in _TRANSIENT)


_PROMPT = """This image of a building has numbered circular markers (1, 2, 3, ...) drawn on it. \
Each marker is a spot for an architectural lighting fixture.

For EACH numbered marker, describe in 3 to 6 words the architectural element it sits on or right \
next to — for example: "base of left tower", "central entrance archway", "right facade wall", \
"left planter edge", "dome", "front steps", "left arcade columns".

Return ONLY a JSON object mapping each number (as a string) to its short description, e.g.:
{"1": "base of left minaret", "2": "central archway", "3": "right facade wall"}"""


def describe_marks(image_bytes: bytes, mime_type: str) -> dict:
    """Return {"1": "base of left tower", ...} describing each numbered mark."""
    last_err = None
    for attempt in range(4):
        try:
            resp = _get_client().models.generate_content(
                model=VISION_MODEL,
                contents=[
                    _PROMPT,
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type or "image/png"),
                ],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            text = (resp.text or "").strip()
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                start, end = text.find("{"), text.rfind("}")
                data = json.loads(text[start:end + 1]) if start != -1 and end != -1 else {}
            return {str(k): str(v) for k, v in data.items()}
        except Exception as err:  # retry transient overload/rate errors
            last_err = err
            if _is_transient(err) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            break

    if _is_transient(last_err):
        raise RuntimeError("Gemini is busy right now — try Auto-fill again in a moment.")
    raise last_err
