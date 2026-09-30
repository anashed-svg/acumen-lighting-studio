#!/usr/bin/env python3
"""Procedural night-villa plate (linear light, filmic tone map). Placeholder still for the
recipes: uplight scallops, an LED line under the cantilever, grazers, warm glazing, pool."""
import argparse

import cv2
import numpy as np

from brandkit import OUT, Brand, filmic, to_linear, to_srgb8


def fbm(h, w, rng, octaves=((6, 1.0), (24, 0.5), (96, 0.25), (384, 0.15))):
    acc = np.zeros((h, w), np.float32)
    for cells, amp in octaves:
        small = rng.random((max(2, cells * h // w), cells)).astype(np.float32)
        acc += amp * cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    acc -= acc.min()
    return acc / acc.max()


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def render(brand, w, h, seed=7):
    rng = np.random.default_rng(seed)
    X, Y = np.meshgrid(np.linspace(0, 1, w, dtype=np.float32), np.linspace(0, 1, h, dtype=np.float32))
    aspect = w / h
    warm = to_linear(brand.rgb("glow"))
    cool = np.array([0.55, 0.7, 1.0], np.float32)
    box = lambda x0, x1, y0, y1: ((X >= x0) & (X < x1) & (Y >= y0) & (Y < y1)).astype(np.float32)
    noise = fbm(h, w, rng)

    # sky + distant treeline
    img = (0.002 + 0.006 * smoothstep(0.1, 0.66, Y))[..., None] * cool
    img += (0.007 * np.exp(-((X - 0.18) ** 2 * 6 + (Y - 0.18) ** 2 * 10)))[..., None] * cool
    ridge = 0.63 + 0.035 * fbm(1, w, rng, ((5, 1.0), (40, 0.3)))[0]
    img *= (1 - 0.9 * (Y > ridge))[..., None]

    # massing
    gf, slab = box(0.14, 0.86, 0.55, 0.80), box(0.10, 0.92, 0.505, 0.55)
    uf, parapet = box(0.30, 0.90, 0.335, 0.505), box(0.28, 0.92, 0.315, 0.335)
    glass_gf, glass_uf = box(0.42, 0.68, 0.55, 0.80), box(0.36, 0.70, 0.37, 0.47)
    deck = box(0.0, 1.0, 0.80, 0.83)
    walls = np.clip(gf + uf - glass_gf - glass_uf, 0, 1)

    courses = (np.abs(((Y - 0.55) * h / 22) % 1 - 0.5) > 0.47).astype(np.float32)
    stone = 0.11 * (0.75 + 0.5 * noise) * (1 - 0.5 * courses)
    grain = fbm(h, w, rng, ((200, 1.0), (700, 0.6)))

    light = np.full((h, w), 0.004, np.float32)
    # LED line under the cantilever washing down the ground floor
    below = np.clip(Y - 0.55, 0, None)
    light += 1.6 * np.exp(-below / 0.05) * (Y >= 0.55) * gf
    # uplight scallops on the ground floor piers
    for xf in (0.20, 0.33, 0.745, 0.815):
        hgt = np.clip(0.80 - Y, 0, None)
        d = np.abs(X - xf) * aspect
        width = 0.006 + hgt * 0.24
        cone = smoothstep(1.0, 0.15, d / width) * smoothstep(0, 0.015, hgt)
        light += 3.0 * cone * (np.exp(-hgt / 0.09) + 0.8 * np.exp(-((hgt - 0.03) / 0.02) ** 2)) * gf
    # grazers up the upper-floor wall: texture pops under grazing light
    for xf in (0.74, 0.80, 0.86):
        hgt = np.clip(0.505 - Y, 0, None)
        d = np.abs(X - xf) * aspect
        cone = smoothstep(1.0, 0.1, d / (0.006 + hgt * 0.09)) * smoothstep(0, 0.01, hgt)
        light += 2.4 * cone * np.exp(-hgt / 0.12) * (0.4 + 1.4 * grain) * uf

    wall_rgb = (stone * light)[..., None] * warm * walls[..., None]
    wall_rgb += (0.02 * walls * (Y < 0.505))[..., None] * cool * 0.1
    img = img * (1 - np.clip(gf + uf + slab + parapet, 0, 1))[..., None] + wall_rgb

    # slab + parapet faces (light concrete), lit faintly by spill
    img += ((0.018 + 0.03 * noise) * slab)[..., None] * warm
    img += ((0.012 + 0.02 * noise) * parapet)[..., None] * warm

    # warm glazing: ceiling cove brighter at the top, mullions, a floor lamp glow
    def glazing(mask, y0, y1, x0, x1, level):
        v = np.clip((Y - y0) / (y1 - y0), 0, 1)
        u = (X - x0) / (x1 - x0)
        lamp = np.exp(-((u - 0.62) * (x1 - x0) * aspect / 0.04) ** 2 - ((v - 0.75) / 0.3) ** 2)
        interior = level * (0.12 + 0.25 * np.sin(np.pi * u) + 2.0 * np.exp(-v / 0.05) + 0.9 * lamp)
        mull = (np.abs(((X - x0) / 0.043) % 1 - 0.5) > 0.47).astype(np.float32)
        return (interior * (1 - 0.92 * mull) * mask)[..., None] * (0.9 * warm + 0.1)
    img += glazing(glass_gf, 0.55, 0.80, 0.42, 0.68, 0.22)
    img += glazing(glass_uf, 0.37, 0.47, 0.36, 0.70, 0.14)

    # emissive LED line + deck with glazing spill
    img += (18.0 * box(0.10, 0.92, 0.5485, 0.5515))[..., None] * warm
    spill = np.exp(-((X - 0.55) * aspect / 0.25) ** 2) * np.exp(-(Y - 0.80) / 0.02)
    img = img * (1 - deck)[..., None] + ((0.05 + 0.10 * noise) * (0.02 + 0.9 * spill) * deck)[..., None] * warm
    img += (0.35 * box(0.0, 1.0, 0.828, 0.832))[..., None] * warm * 0.4

    # pool: rippled mirror of everything above the waterline over a cool underwater glow
    yw = int(0.83 * h)
    rows = np.arange(yw, h)
    src_y = np.clip(2 * yw - rows, 0, h - 1)
    ripple = (np.sin(rows[:, None] * 0.9 + np.arange(w)[None] * 0.013) * (rows[:, None] - yw) * 0.06).astype(np.float32)
    mx = (np.arange(w)[None] + ripple).astype(np.float32)
    my = np.repeat(src_y[:, None], w, 1).astype(np.float32)
    refl = cv2.remap(img, mx, my, cv2.INTER_LINEAR)
    refl = cv2.GaussianBlur(refl, (0, 0), sigmaX=1.5, sigmaY=4)
    depth = (rows - yw)[:, None, None] / (h - yw)
    img[yw:] = 0.45 * refl + (0.006 + 0.02 * np.exp(-depth * 3)) * np.array([0.2, 0.55, 0.7], np.float32)

    bloom = cv2.GaussianBlur(np.clip(img - 0.8, 0, None), (0, 0), 6) + cv2.GaussianBlur(np.clip(img - 0.8, 0, None), (0, 0), 24)
    return to_srgb8(filmic((img + 0.12 * bloom) * 1.6))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-o", "--out", default=str(OUT / "samples" / "facade.png"))
    ap.add_argument("--brand", help="brand JSON (default: brand.json)")
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    rgb = render(Brand(a.brand), w, h, a.seed)
    OUT.joinpath("samples").mkdir(parents=True, exist_ok=True)
    cv2.imwrite(a.out, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    print(a.out)


if __name__ == "__main__":
    main()
