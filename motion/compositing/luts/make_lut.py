#!/usr/bin/env python3
"""Write a 3D .cube LUT for a warm night look: gentle S-curve, soft highlight roll-off,
slightly muted saturation, cool shadows (brand shadow_tint) and warm highlights (brand glow).
Apply with: ffmpeg -vf lut3d=file=luts/acumen-warm-night.cube:interp=tetrahedral"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from brandkit import Brand  # noqa: E402

LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def s_curve(x, gain, pivot=0.42):
    sig = lambda v: 1 / (1 + np.exp(-v))
    lo, hi = sig(-pivot * gain), sig((1 - pivot) * gain)
    return (sig((x - pivot) * gain) - lo) / (hi - lo)


def grade(rgb, shadow, glow, warmth=1.0, contrast=0.6, saturation=0.86, knee=0.82):
    rgb = (1 - contrast) * rgb + contrast * s_curve(rgb, 6.0)
    luma = rgb @ LUMA
    rgb = luma[..., None] + (rgb - luma[..., None]) * saturation
    w_shadow = ((1 - luma) ** 3)[..., None]
    w_high = np.clip((luma - 0.3) / 0.7, 0, 1)[..., None] ** 1.5
    rgb = rgb + warmth * 0.04 * w_shadow * (shadow / shadow.mean() - 1)
    rgb = rgb * (1 + warmth * 0.3 * w_high * (glow / glow.mean() - 1))
    over = np.maximum(rgb - knee, 0)
    rgb = np.minimum(rgb, knee) + (1 - knee) * np.tanh(over / (1 - knee))
    return np.clip(rgb, 0, 1)


def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", default=str(here / "acumen-warm-night.cube"))
    ap.add_argument("--brand", help="brand JSON: uses its shadow_tint + glow colours")
    ap.add_argument("--size", type=int, default=17, help="grid size (17 is plenty for a smooth grade, 33 = finer)")
    ap.add_argument("--warmth", type=float, default=1.0, help="split-tone amount (0 = neutral)")
    ap.add_argument("--contrast", type=float, default=0.6, help="S-curve mix 0..1")
    ap.add_argument("--saturation", type=float, default=0.86)
    a = ap.parse_args()

    brand = Brand(a.brand)
    n = a.size
    axis = np.linspace(0, 1, n, dtype=np.float32)
    b, g, r = np.meshgrid(axis, axis, axis, indexing="ij")  # .cube order: red changes fastest
    rgb = np.stack([r, g, b], -1).reshape(-1, 3)
    out = grade(rgb, brand.rgb("shadow_tint"), brand.rgb("glow"), a.warmth, a.contrast, a.saturation)

    lines = [f'TITLE "{brand["name"]} warm night"',
             f"# make_lut.py warmth={a.warmth} contrast={a.contrast} saturation={a.saturation}",
             f"LUT_3D_SIZE {n}", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"]
    lines += [f"{x:.6f} {y:.6f} {z:.6f}" for x, y, z in out]
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(lines) + "\n")
    print(a.out)


if __name__ == "__main__":
    main()
