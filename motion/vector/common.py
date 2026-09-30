"""Shared helpers for the vector tools: brand config, fonts, HarfBuzz text outlines, logo paths, ffmpeg."""
import json
import os
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
GOOGLE_FONTS = Path("/usr/local/share/fonts/google")
FC_WEIGHT = {100: 0, 200: 40, 300: 50, 400: 80, 500: 100, 600: 180, 700: 200, 800: 205, 900: 210}


def load_brand(path=None):
    """Read brand.json (or $BRAND_JSON); resolve file paths relative to the JSON file."""
    path = Path(path or os.environ.get("BRAND_JSON") or HERE / "brand.json").resolve()
    brand = json.loads(path.read_text())
    for key in ("logo_svg", "logo_png"):
        if brand.get(key):
            brand[key] = str((path.parent / brand[key]).resolve())
            if not Path(brand[key]).is_file():
                raise SystemExit(f"{path.name}: {key} not found: {brand[key]}")
    for key in ("font_latin", "font_arabic"):
        brand[key + "_file"] = font_file(brand[key], brand.get(key + "_weight", 400), path.parent)
    brand["slug"] = path.stem if path.stem != "brand" else brand.get("name", "brand").lower()
    return brand


def font_file(name, weight=400, base=HERE):
    """Font spec → .ttf path. Accepts a file path, or a family name + CSS weight."""
    if name.lower().endswith((".ttf", ".otf")):
        file = (Path(base) / name).resolve()
        if not file.is_file():
            raise SystemExit(f"font file not found: {file}")
        return str(file)
    nospace = name.replace(" ", "")
    local = GOOGLE_FONTS / nospace / f"{nospace}-{weight}.ttf"
    if local.exists():
        return str(local)
    out = subprocess.run(["fc-match", "-f", "%{family}\t%{file}", f"{name}:weight={FC_WEIGHT.get(weight, 80)}"],
                         capture_output=True, text=True).stdout
    family, _, file = out.partition("\t")
    if name.lower() not in family.lower():
        raise SystemExit(f"font '{name}' not installed (fc-match gave '{family}')")
    return file


def rgb(hex_color):
    """'#FFC478' → (1.0, 0.768, 0.47)"""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def is_arabic(text):
    return any("؀" <= c <= "ۿ" or "ﭐ" <= c <= "﻿" for c in text)


@lru_cache(maxsize=None)
def _font(path):
    import uharfbuzz as hb
    from fontTools.ttLib import TTFont
    return hb.Font(hb.Face(hb.Blob.from_file_path(path))), TTFont(path)


@dataclass
class TextOutline:
    glyphs: list      # SVG path "d" per glyph, px units, baseline at y=0, x starting at 0
    width: float
    cap_height: float


def text_outline(text, font_path, size, tracking_em=0.0):
    """Shape text with HarfBuzz (proper Arabic joining + RTL order) and return vector outlines."""
    import uharfbuzz as hb
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen

    hbfont, tt = _font(font_path)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {})
    glyphset, order = tt.getGlyphSet(), tt.getGlyphOrder()
    s = size / hbfont.face.upem
    track = 0 if buf.direction == "rtl" else tracking_em * size  # tracking would break Arabic joins
    x, glyphs = 0.0, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyphset)
        glyphset[order[info.codepoint]].draw(TransformPen(pen, (s, 0, 0, -s, x + pos.x_offset * s, -pos.y_offset * s)))
        if d := pen.getCommands():
            glyphs.append(d)
        x += pos.x_advance * s + track
    os2 = tt["OS/2"]
    cap = getattr(os2, "sCapHeight", 0) or tt["hhea"].ascent * 0.7
    return TextOutline(glyphs, max(0.0, x - track), cap * s)


@dataclass
class LogoShape:
    d: str            # the whole <path> (all sub-paths, so holes stay holes) in viewBox units, for filling
    strokes: list     # [(sub-path d, arc length)] for the stroke-draw
    container: bool   # encloses every other shape (a frame / badge)


def logo_paths(svg_file, order="ltr"):
    """Split a (potrace-style) logo SVG into shapes with arc lengths, sorted for a stroke-draw.

    A path that encloses everything else (a frame / badge) comes first, then left→right (or rtl/file order).
    Group transforms are applied. Returns (shapes, (x, y, w, h) viewBox).
    """
    from svgpathtools import Document

    doc = Document(svg_file)
    vb = doc.root.get("viewBox")
    if vb:
        viewbox = tuple(float(v) for v in vb.replace(",", " ").split())
    else:
        viewbox = (0, 0, float(doc.root.get("width", "0").rstrip("ptx")), float(doc.root.get("height", "0").rstrip("ptx")))
    paths = [p for p in doc.paths() if len(p)]
    boxes = [p.bbox() for p in paths]  # xmin, xmax, ymin, ymax

    def encloses(a, b):
        return a[0] <= b[0] and a[1] >= b[1] and a[2] <= b[2] and a[3] >= b[3]

    container = [all(encloses(a, b) for b in boxes) for a in boxes]

    def key(i):
        return (not container[i], {"ltr": boxes[i][0], "rtl": -boxes[i][1], "file": i}[order])

    shapes = [LogoShape(paths[i].d(), [(sub.d(), sub.length(error=1e-3)) for sub in paths[i].continuous_subpaths()],
                        container[i]) for i in sorted(range(len(paths)), key=key)]
    return shapes, viewbox


class FFmpegWriter:
    """Pipe RGB frames (PIL images or HxWx3 uint8 arrays) into an H.264 mp4."""

    def __init__(self, path, size, fps, crf=18):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        w, h = size
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps),
             "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", str(path)], stdin=subprocess.PIPE)

    def write(self, frame):
        import numpy as np
        if hasattr(frame, "convert"):
            frame = frame.convert("RGB")
        self.proc.stdin.write(np.asarray(frame, dtype=np.uint8).tobytes())

    def close(self):
        self.proc.stdin.close()
        if self.proc.wait():
            raise SystemExit("ffmpeg failed")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def ease_out(t, p=3):
    return 1 - (1 - t) ** p


def ramp(t, t0, t1, ease=ease_out):
    """0→1 between seconds t0 and t1 (clamped, then eased)."""
    return ease(min(1.0, max(0.0, (t - t0) / (t1 - t0))))
