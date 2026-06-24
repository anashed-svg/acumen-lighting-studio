"""Calls Gemini (Nano Banana) to edit an image into an Acumen render."""

import os

from google import genai
from google.genai import types

from prompt import build_prompt

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

_client = genai.Client(api_key=GEMINI_API_KEY)


def generate_image(prompt: str, image_bytes: bytes, mime_type: str) -> bytes:
    """Send a prompt + source image to Gemini and return the edited image bytes."""
    response = _client.models.generate_content(
        model=MODEL,
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
    )

    candidate = response.candidates[0]
    for part in candidate.content.parts:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            return inline.data

    # No image came back — surface any text the model returned to help debugging.
    spoken = " ".join(
        part.text for part in candidate.content.parts if getattr(part, "text", None)
    )
    raise RuntimeError(f"Model returned no image. It said: {spoken!r}")


def render_night_image(image_bytes: bytes, mime_type: str, instructions: str) -> bytes:
    """Free-form night render (used by the Telegram bot)."""
    return generate_image(build_prompt(instructions), image_bytes, mime_type)
