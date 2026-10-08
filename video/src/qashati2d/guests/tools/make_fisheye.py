"""Displacement map for the peephole's fisheye (feDisplacementMap), written to public/qashati2d/guests/fisheye.png.
Output pixel at lens-normalised (u, v), r = |(u, v)| ≤ 1 samples the source at r_s = r·(A + (1−A)·r²): the centre is
magnified 1/A×, the rim is squeezed — a door viewer's barrel bulge. R channel = x, G = y; 0.5 = no displacement;
displacement (lens radii) = (channel − 0.5) · SCALE_R, so in the SVG use scale = SCALE_R · R (R = lens radius, px).
Usage: python3 src/qashati2d/guests/tools/make_fisheye.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

N = 768
A = 0.68
SCALE_R = 0.42  # max |d| = (1−A)·u·(1−r²) ≈ 0.162 < SCALE_R/2
out = Path(__file__).resolve().parents[4] / "public/qashati2d/guests/fisheye.png"
c = (np.arange(N) + 0.5) / N * 2 - 1
u, v = np.meshgrid(c, c)
r2 = u * u + v * v
k = A + (1 - A) * r2 - 1  # r_s/r − 1
dx = np.where(r2 <= 1, u * k, 0.0)
dy = np.where(r2 <= 1, v * k, 0.0)
# feather the last 2 % so the rim has no seam
img = np.stack([0.5 + dx / SCALE_R, 0.5 + dy / SCALE_R, np.full_like(dx, 0.5)], -1)
img = np.clip(np.round(img * 255), 0, 255).astype(np.uint8)
out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(img).save(out, optimize=True)
print(out, out.stat().st_size, "bytes; max |d| =", float(np.abs(dx).max()))
