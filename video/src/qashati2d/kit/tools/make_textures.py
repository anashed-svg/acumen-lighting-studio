#!/usr/bin/env python3
"""Paper textures for the «Qashati 2D» look (deterministic; re-run to regenerate).

    nice -n 10 python3 video/src/qashati2d/kit/tools/make_textures.py
      -> video/public/qashati2d/textures/paper-multiply.jpg   near-white grain: multiply over everything
      -> video/public/qashati2d/textures/paper-screen.jpg     near-black light fibres: screen (shows on dark ink areas)

Both are 1188x2112 (10 % larger than the frame) so <PaperGrain/> can shift them on twos (the sheet "re-photographed"
every drawing, like stop-motion) without ever showing an edge.
Layers: fine tooth (fibre-oriented grain), medium tooth, very soft blotches (uneven sizing/ink absorption), long thin
fibres (darker and lighter), a few specks. Kept subtle: the mean darkening is ~4 %, so brand turquoise survives.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

OUT = Path(__file__).resolve().parents[4] / "public/qashati2d/textures"
W, H = 1188, 2112
rng = np.random.default_rng(2026)


def norm(x):
    x = x - x.mean()
    return x / (np.abs(x).max() + 1e-9)


def fibres(n, dark=True, seed=0):
    r = np.random.default_rng(seed)
    im = Image.new("L", (W * 2, H * 2), 0)  # 2x supersampled, then downsampled (anti-aliased hairlines)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = r.uniform(0, W * 2), r.uniform(0, H * 2)
        L = r.uniform(10, 70) * 2
        a = r.uniform(0, np.pi) if r.random() < .5 else r.normal(.35, .5)  # a slight preferred direction (paper grain)
        bend = r.normal(0, .9)
        pts = []
        for k in range(12):
            t = k / 11
            ang = a + bend * (t - .5)
            pts.append((x + np.cos(ang) * L * (t - .5), y + np.sin(ang) * L * (t - .5) + bend * 8 * np.sin(np.pi * t)))
        w = int(max(1, round(r.uniform(.6, 1.6) * 2)))
        d.line(pts, fill=int(r.uniform(90, 255)), width=w, joint="curve")
    im = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(.35))
    return np.asarray(im, np.float32) / 255


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tooth_f = gaussian_filter(rng.standard_normal((H, W)), (0.7, 0.5))           # fine tooth, a little directional
    tooth_m = gaussian_filter(rng.standard_normal((H, W)), 2.2)
    blot = gaussian_filter(rng.standard_normal((H // 8, W // 8)), 6)
    blot = np.asarray(Image.fromarray(norm(blot).astype(np.float32)).resize((W, H), Image.BICUBIC))
    dark_f = fibres(900, True, 11)
    light_f = fibres(700, False, 23)
    specks = np.zeros((H, W), np.float32)
    for _ in range(420):
        x, y = rng.integers(0, W), rng.integers(0, H)
        r = rng.uniform(.5, 1.8)
        yy, xx = np.ogrid[-3:4, -3:4]
        m = np.clip(r + .5 - np.sqrt(xx ** 2 + yy ** 2), 0, 1) * rng.uniform(.4, 1)
        y0, y1, x0, x1 = max(0, y - 3), min(H, y + 4), max(0, x - 3), min(W, x + 4)
        specks[y0:y1, x0:x1] = np.maximum(specks[y0:y1, x0:x1], m[(y0 - y + 3):(y1 - y + 3), (x0 - x + 3):(x1 - x + 3)])

    # multiply layer (1 = no change)
    mul = 1.0 - (0.075 * np.abs(norm(tooth_f)) + 0.04 * (norm(tooth_m) * .5 + .5) + 0.018 * (blot * .5 + .5)
                 + 0.06 * dark_f + 0.22 * specks)
    mul = mul + 0.012 * norm(tooth_f)  # a touch of bright tooth too (paper isn't only darker)
    mul = np.clip(mul / np.percentile(mul, 99.7), 0, 1)
    Image.fromarray((mul * 255).astype(np.uint8)).save(OUT / "paper-multiply.jpg", quality=92)

    # screen layer (0 = no change): light fibres + a little light tooth, for dark ink areas
    scr = np.clip(0.16 * light_f + 0.035 * np.clip(norm(tooth_f), 0, 1) + 0.015 * (blot * .5 + .5), 0, 1)
    Image.fromarray((scr * 255).astype(np.uint8)).save(OUT / "paper-screen.jpg", quality=92)
    print("mean darkening", 1 - mul.mean(), "screen mean", scr.mean())
    for f in ("paper-multiply.jpg", "paper-screen.jpg"):
        print(OUT / f, (OUT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
