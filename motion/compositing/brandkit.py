"""Shared helpers for the Python recipes: brand config, colour, text, ffmpeg writer."""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
ARABIC = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")


class Brand(dict):
    def __init__(self, path=None):
        self.path = Path(path or HERE / "brand.json").resolve()
        super().__init__(json.loads(self.path.read_text(encoding="utf-8")))

    def file(self, key):
        p = Path(self[key])
        return p if p.is_absolute() else (self.path.parent / p).resolve()

    def rgb(self, key):
        return hex_rgb(self[key])


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def to_linear(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb8(lin):
    c = np.clip(lin, 0, 1)
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
    return (c * 255 + 0.5).astype(np.uint8)


def filmic(x):
    """ACES-style tone curve (Narkowicz): soft highlight roll-off, deep blacks."""
    x = np.maximum(x, 0)
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)


def text_image(text, font_path, size, color=(1, 1, 1), tracking_em=0.0):
    """Render one line to an RGBA image. Arabic is shaped + RTL via raqm and never tracked
    (letter-spacing breaks the joins); Latin gets per-glyph tracking."""
    font = ImageFont.truetype(str(font_path), size, layout_engine=ImageFont.Layout.RAQM)
    rgb = tuple(int(c * 255) for c in color)
    pad = size // 2
    if ARABIC.search(text):
        l, t, r, b = font.getbbox(text, direction="rtl")
        img = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad))
        ImageDraw.Draw(img).text((pad - l, pad - t), text, font=font, fill=rgb, direction="rtl")
        return img
    track = tracking_em * size
    widths = [font.getlength(ch) for ch in text]
    width = sum(widths) + track * (len(text) - 1)
    asc, desc = font.getmetrics()
    img = Image.new("RGBA", (int(width) + 2 * pad, asc + desc + 2 * pad))
    draw, x = ImageDraw.Draw(img), float(pad)
    for ch, w in zip(text, widths):
        draw.text((x, pad), ch, font=font, fill=rgb)
        x += w + track
    return img


def blur(img, sigma):
    """Gaussian blur; wide radii run on a downscaled copy (same look, ~50x faster)."""
    import cv2
    f = int(sigma // 6)
    if f < 2:
        return cv2.GaussianBlur(img, (0, 0), sigma)
    h, w = img.shape[:2]
    small = cv2.resize(img, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
    return cv2.resize(cv2.GaussianBlur(small, (0, 0), sigma / f), (w, h), interpolation=cv2.INTER_LINEAR)


class VideoWriter:
    """Pipe float/uint8 RGB frames into ffmpeg (H.264, yuv420p)."""

    def __init__(self, path, size, fps=30, crf=17):
        w, h = size
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium",
             "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path)],
            stdin=subprocess.PIPE)

    def write(self, frame):
        self.proc.stdin.write(np.ascontiguousarray(frame, np.uint8).tobytes())

    def close(self):
        self.proc.stdin.close()
        if self.proc.wait():
            raise RuntimeError("ffmpeg failed")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
