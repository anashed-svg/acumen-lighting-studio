#!/usr/bin/env python3
"""Procedural light sweep: a warm spot rakes across a dark plaster wall (per-pixel N.L on a
height map, so the texture catches the light), then the logo's halo backlight comes on.
Pure numpy + OpenCV, streamed into ffmpeg."""
import argparse

import cv2
import numpy as np

from brandkit import OUT, Brand, VideoWriter, blur, filmic, to_linear, to_srgb8


def fbm(h, w, rng, octaves):
    acc = np.zeros((h, w), np.float32)
    for cells, amp in octaves:
        small = rng.random((max(2, cells * h // w), cells)).astype(np.float32)
        acc += amp * cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    return (acc - acc.min()) / np.ptp(acc)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def logo_mask(brand, w, h, frac):
    rgba = cv2.imread(str(brand.file("logo_png")), cv2.IMREAD_UNCHANGED)
    alpha = rgba[..., 3] if rgba.shape[2] == 4 else cv2.cvtColor(rgba, cv2.COLOR_BGR2GRAY)
    side = int(h * frac)
    small = cv2.resize(alpha, (side, side), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    mask = np.zeros((h, w), np.float32)
    y, x = (h - side) // 2, (w - side) // 2
    mask[y:y + side, x:x + side] = small
    return mask


def build_wall(brand, w, h, seed, with_logo):
    rng = np.random.default_rng(seed)
    plaster = fbm(h, w, rng, ((8, 1.0), (40, 0.45), (160, 0.3), (640, 0.25)))
    height = 6.0 * plaster
    xs = np.arange(w, dtype=np.float32)
    joints = np.exp(-(((xs % (w / 4)) - w / 8) / 1.2) ** 2)  # recessed panel joints
    height -= 3.0 * joints[None, :]
    logo = logo_mask(brand, w, h, 0.34) if with_logo else np.zeros((h, w), np.float32)
    height += 14.0 * blur(logo, 1.2)  # stand-off letters
    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) / 8
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) / 8
    n = np.dstack([-gx, -gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    albedo = (0.16 + 0.10 * fbm(h, w, rng, ((5, 1.0), (20, 0.5)))) * (1 - 0.5 * logo)
    halo = np.clip(blur(logo, h * 0.018) * 1.6 - logo, 0, None) + 0.35 * blur(logo, h * 0.06)
    return n, albedo, halo, logo


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-o", "--out", default=str(OUT / "light-sweep.mp4"))
    ap.add_argument("--brand", help="brand JSON (default: brand.json)")
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("-d", "--duration", type=float, default=4.0)
    ap.add_argument("--intensity", type=float, default=1.0)
    ap.add_argument("--no-logo", action="store_true")
    ap.add_argument("--seed", type=int, default=3)
    a = ap.parse_args()

    brand = Brand(a.brand)
    w, h = map(int, a.size.split("x"))
    warm = to_linear(brand.rgb("glow"))
    normals, albedo, halo, logo = build_wall(brand, w, h, a.seed, not a.no_logo)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    frames = int(round(a.duration * a.fps))
    cos_in, cos_out = float(np.cos(np.radians(7))), float(np.cos(np.radians(19)))

    with VideoWriter(a.out, (w, h), a.fps) as vw:
        for i in range(frames):
            t = i / max(frames - 1, 1)
            e = smoothstep(0.0, 0.85, t)
            cx = w * (-0.3 + 1.6 * e)                      # aim point sweeps left -> right
            src = np.array([cx - 0.42 * w, 0.62 * h, 0.55 * h], np.float32)  # raking from low left
            aim = np.array([cx, 0.5 * h, 0.0], np.float32) - src
            aim /= np.linalg.norm(aim)
            L = np.dstack([src[0] - xs, src[1] - ys, np.full_like(xs, src[2])])
            dist = np.linalg.norm(L, axis=2)
            L /= dist[..., None]
            cone = smoothstep(cos_out, cos_in, -(L @ aim))
            ndotl = np.clip(np.sum(normals * L, axis=2), 0, None)
            beam = a.intensity * 8.0 * cone * ndotl * (0.6 * h / dist) ** 2
            halo_on = smoothstep(0.42, 0.75, t) * (0.92 + 0.08 * np.sin(t * 9))
            lin = albedo[..., None] * (beam[..., None] + 0.004) * warm
            lin += (1.6 * halo_on * halo * albedo * 6)[..., None] * warm
            lin += (0.02 * halo_on * logo)[..., None] * warm  # letter faces catch a little spill
            hi = np.clip(lin - 0.6, 0, None)
            lin += 0.25 * blur(hi, h * 0.01) + 0.2 * blur(hi, h * 0.05)
            vw.write(to_srgb8(filmic(lin * 1.4)))
    print(a.out)


if __name__ == "__main__":
    main()
