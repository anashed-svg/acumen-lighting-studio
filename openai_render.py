"""Calls OpenAI gpt-image-1 to edit an image into an Acumen render."""

import base64
import io
import os

from openai import OpenAI

MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
QUALITY = os.environ.get("OPENAI_IMAGE_QUALITY", "high")
SIZE = os.environ.get("OPENAI_IMAGE_SIZE", "auto")
# "high" keeps the building structure faithful to the input.
INPUT_FIDELITY = os.environ.get("OPENAI_INPUT_FIDELITY", "high")

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY is missing — add it to your .env file.")
        _client = OpenAI(api_key=key)
    return _client


def generate_image(prompt: str, image_bytes: bytes, mime_type: str) -> bytes:
    """Edit the source image with gpt-image-1 and return the result image bytes."""
    ext = "png" if "png" in (mime_type or "image/png") else "jpg"
    image_file = (f"scene.{ext}", io.BytesIO(image_bytes), mime_type or "image/png")

    result = _get_client().images.edit(
        model=MODEL,
        image=image_file,
        prompt=prompt,
        size=SIZE,
        quality=QUALITY,
        input_fidelity=INPUT_FIDELITY,
    )
    item = result.data[0]
    if not getattr(item, "b64_json", None):
        raise RuntimeError("OpenAI returned no image.")
    return base64.b64decode(item.b64_json)
