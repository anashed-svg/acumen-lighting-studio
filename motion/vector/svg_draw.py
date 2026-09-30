#!/usr/bin/env python3
"""Pure-Python SVG route: drawsvg builds every frame, cairosvg rasterises it, PIL adds bloom, ffmpeg encodes.

The logo is drawn stroke by stroke from its real arc lengths (svgpathtools → stroke-dashoffset), fills in,
then a grazing light sweeps across it. EN tagline opens its letter-spacing; the Arabic line is revealed
right-to-left. Every frame is plain SVG, so any frame can be exported as vector key art (--still).

  python3 svg_draw.py                        # → out/svg/<brand>.mp4
  python3 svg_draw.py --still 3.5            # → out/svg/<brand>_3.5s.svg (vector frame, no bloom) + .png
  BRAND_JSON=brands/example.json python3 svg_draw.py
"""
import argparse
import io

import cairosvg
import drawsvg as dw
import numpy as np
from PIL import Image, ImageFilter

from common import OUT, FFmpegWriter, load_brand, logo_paths, ramp, text_outline

W, H, FPS, SECONDS = 1280, 720, 30, 4.0
LOGO_BOX, LOGO_BOTTOM = (520, 290), 437  # logo fits the box, bottom edge on LOGO_BOTTOM


class Scene:
    def __init__(self, brand):
        self.b = brand
        self.shapes, self.vb = logo_paths(brand["logo_svg"], brand.get("logo_draw_order", "ltr"))
        self.k = min(LOGO_BOX[0] / self.vb[2], LOGO_BOX[1] / self.vb[3])
        self.center = (W / 2, LOGO_BOTTOM - self.vb[3] * self.k / 2)
        self.ar = text_outline(brand["tagline_ar"], brand["font_arabic_file"], 30)

    @staticmethod
    def timing(i, shape):
        """(start, end) of the stroke-draw for the i-th logo shape; a frame/badge draws first and slower."""
        if shape.container:
            return 0.1, 1.3
        start = 0.45 + 0.07 * i
        return start, start + 0.8

    def logo(self, t):
        b, (vx, vy, vw, vh) = self.b, self.vb
        cx, cy = self.center
        g = dw.Group(transform=f"translate({cx - vw * self.k / 2},{cy - vh * self.k / 2}) scale({self.k}) "
                               f"translate({-vx},{-vy})")
        stroke_w = 1.7 / self.k
        for i, shape in enumerate(self.shapes):
            t0, t1 = self.timing(i, shape)
            fill = ramp(t, t1 - 0.15, t1 + 0.45)
            if fill > 0:
                g.append(dw.Path(d=shape.d, fill=b["ink"], fill_opacity=fill))
            draw, glow = ramp(t, t0, t1), 1 - ramp(t, t1, t1 + 0.7)
            if draw > 0 and glow > 0:
                for d, length in shape.strokes:
                    g.append(dw.Path(d=d, fill="none", stroke=b["glow"], stroke_width=stroke_w, stroke_opacity=glow,
                                     stroke_dasharray=f"{length} {length}", stroke_dashoffset=length * (1 - draw)))
        # grazing light: a warm band crossing the filled logo
        s = ramp(t, 2.0, 3.3, ease=lambda x: x)
        if 0 < s < 1:
            x = vx - 0.3 * vw + s * 1.6 * vw
            sweep = dw.LinearGradient(x - 0.18 * vw, 0, x + 0.18 * vw, 0)
            sweep.add_stop(0, b["glow"], 0)
            sweep.add_stop(0.5, b["glow"], 0.95)
            sweep.add_stop(1, b["glow"], 0)
            for shape in self.shapes:
                g.append(dw.Path(d=shape.d, fill=sweep))
        return g

    def led_line(self, t):
        grow = ramp(t, 1.7, 2.5)
        if grow <= 0:
            return None
        cx, y, half = W / 2, LOGO_BOTTOM + 38, 115 * grow
        grad = dw.LinearGradient(cx - half, 0, cx + half, 0)
        for off, a in ((0, 0), (0.5, 1), (1, 0)):
            grad.add_stop(off, self.b["glow"], a)
        return dw.Line(cx - half, y, cx + half, y, stroke=grad, stroke_width=1.6)

    def tagline_en(self, t):
        a = ramp(t, 2.2, 3.0)
        if a <= 0:
            return None
        tracking = self.b.get("tracking_em", 0.38) * (0.55 + 0.45 * ramp(t, 2.2, 3.6))
        txt = text_outline(self.b["tagline_en"], self.b["font_latin_file"], 18, tracking)
        g = dw.Group(transform=f"translate({(W - txt.width) / 2},{548})", fill=self.b["ink"], fill_opacity=a)
        for d in txt.glyphs:
            g.append(dw.Path(d=d))
        return g

    def tagline_ar(self, t):
        r = ramp(t, 2.6, 3.5)
        if r <= 0:
            return None
        x0, w = (W - self.ar.width) / 2, self.ar.width
        clip = dw.ClipPath()
        clip.append(dw.Rectangle(x0 + w * (1 - r) - 4, 560, w * r + 8, 80))  # reveal right → left
        g = dw.Group(transform=f"translate({x0},{612})", fill=self.b["ink"], fill_opacity=0.75 * r)
        for d in self.ar.glyphs:
            g.append(dw.Path(d=d))
        return dw.Group(clip_path=clip, children=[g])

    def svg(self, t):
        b = self.b
        d = dw.Drawing(W, H)
        ambient = dw.RadialGradient(*self.center, 760)
        ambient.add_stop(0, b["glow"], 0.10 * ramp(t, 0.2, 2.0))
        ambient.add_stop(1, b["glow"], 0)
        d.append(dw.Rectangle(0, 0, W, H, fill=b["background"]))
        d.append(dw.Rectangle(0, 0, W, H, fill=ambient))
        push = 1 + 0.025 * t / SECONDS
        scene = dw.Group(transform=f"translate({W / 2},{H / 2}) scale({push}) translate({-W / 2},{-H / 2})")
        for el in (self.logo(t), self.led_line(t), self.tagline_en(t), self.tagline_ar(t)):
            if el is not None:
                scene.append(el)
        d.append(scene)
        return d.as_svg()


def bloom(img, strength=0.9):
    """Screen-blend a blurred copy of the bright parts back on top (glow for strokes and the light sweep)."""
    arr = np.asarray(img, dtype=np.float32) / 255
    bright = arr * np.clip((arr.max(axis=2, keepdims=True) - 0.45) / 0.55, 0, 1)
    small = Image.fromarray((bright * 255).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR)
    glow = np.zeros_like(arr)
    for radius, weight in ((2, 0.7), (6, 0.5), (14, 0.35)):
        blurred = small.filter(ImageFilter.GaussianBlur(radius)).resize((W, H), Image.BILINEAR)
        glow += np.asarray(blurred, dtype=np.float32) / 255 * weight
    out = 1 - (1 - arr) * (1 - np.clip(glow * strength, 0, 1))
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))


def rasterize(svg):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert("RGB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--still", type=float, metavar="SEC", help="write the frame at this time (SVG + PNG), no video")
    args = ap.parse_args()

    brand = load_brand()
    scene = Scene(brand)
    out = OUT / "svg"
    out.mkdir(parents=True, exist_ok=True)
    if args.still is not None:
        svg = scene.svg(args.still)
        path = out / f"{brand['slug']}_{args.still:g}s.svg"
        path.write_text(svg)
        bloom(rasterize(svg)).save(path.with_suffix(".png"))
        print(f"wrote {path} (+ .png with bloom)")
        return

    mp4 = out / f"{brand['slug']}.mp4"
    with FFmpegWriter(mp4, (W, H), FPS) as video:
        for f in range(round(SECONDS * FPS)):
            video.write(bloom(rasterize(scene.svg(f / FPS))))
    print(f"wrote {mp4}")


if __name__ == "__main__":
    main()
