#!/usr/bin/env python3
"""Qashati Alsham — «مش قشطة» Act 3: the 3D product hero shot of the cup (v2).

Everything is procedural (no .blend): a clear tapered PET cup with visible fruit / qashta layers, a glossy
qashta dome with a honey ribbon, a pistachio crown and a hero garnish (strawberry half + mango cubes), a
turquoise sticker with the white Q, fine condensation beads (cold cue), on a brand-turquoise seamless set.
Timing is read from video/src/qashati2/spec.ts (T.cupShot .. T.endCard = 120 frames, T.cupDrops, T.spoon).

Story of the shot (local frames, 30 fps):
  0-23   slow push-in on the cup, honey slowly running between/in front of where the dots will land
  24/33  the two qashta drops (the ق dots) land, SLUMP and SPREAD into the dome as two glossy comma-shaped
         dollops (the logo's dots, from logoPaths.ts) with a small crown ring that relaxes into a soft rim
  42     the headline stamp is overlaid in the top ~22% (kept clean turquoise from here on)
  60-105 a spoon enters from the right, dips into the dome, drags and lifts a heaped scoop of clotted qashta:
         a stretchy cream strand necks and snaps (~local 99), a honey thread keeps running off the spoon
  105+   the camera settles on the closer second framing (the push-in never stops, no cuts)

Entry points (render_cup.sh drives them all):
  python3 cup3d.py sticker OUT.png                 # sticker texture from the traced logo (cairosvg)
  python3 cup3d.py dots OUT.npz                    # signed-distance fields of the logo's two dots (scipy)
  python3 cup3d.py grade SRC DST RATIO.json        # brand-colour lock + food (appetite) grade (numpy + opencv)
  python3 cup3d.py assemble SRC DST N flow|hold    # exactly N frames; in-betweens for the frames on twos
  python3 cup3d.py verify MP4 PREVIEW_DIR N        # ffprobe + BT.709 decode colour check + contact sheet
  python3 cup3d.py grade-packshot RAW OUT RATIO    # same brand lock + food grade on the RGBA end-card still
  /opt/bpy5/bin/python cup3d.py render [opts]      # build scene + render frames (Blender 5 module, Cycles+OIDN)
  /opt/bpy5/bin/python cup3d.py render --packshot OUT.png --res 900x1300   # transparent end-card still

Every per-frame thing (camera, drops, dome, honey, spoon, strand) is a pure function of the shot time t, so any
subset of frames renders identically in any order; all randomness is seeded with fixed ints / crc32 (never
Python's per-process-salted hash()).
"""
import argparse
import json
import math
import os
import re
import sys
import time
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
SPEC_TS = os.path.join(REPO, 'video', 'src', 'qashati2', 'spec.ts')
LOGO_TS = os.path.join(REPO, 'video', 'src', 'qashati', 'logoPaths.ts')
DOTS_NPZ = os.path.join(HERE, 'out', 'dots_sdf.npz')


# ----------------------------------------------------------------------------------------------
# spec.ts (single source of truth for timing + colours)
# ----------------------------------------------------------------------------------------------
def read_spec():
    s = open(SPEC_TS, encoding='utf-8').read()

    def one(pat):
        return int(re.search(pat, s).group(1))

    def pair(key):
        return [int(x) for x in re.search(key + r':\s*\[(\d+),\s*(\d+)\]', s).groups()]
    fps, cup = one(r'export const FPS = (\d+)'), one(r'cupShot:\s*(\d+)')
    return {
        'fps': fps, 'w': one(r'export const W = (\d+)'), 'h': one(r'export const H = (\d+)'),
        'frames': one(r'endCard:\s*(\d+)') - cup,                  # 120 = 4.0 s
        'drop_land': [(d - cup) / fps for d in pair('cupDrops')],   # local s: 0.8, 1.1
        'title': (one(r'\btitle:\s*(\d+)') - cup) / fps,             # headline overlay from local 1.4 s
        'spoon': [(d - cup) / fps for d in pair('spoon')],          # local s: 2.0 .. 3.5
        'colors': dict(re.findall(r"(\w+): '(#[0-9A-Fa-f]{6})'", s)),
    }


def hex_to_lin(hx):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(c(int(hx[i:i + 2], 16)) for i in (1, 3, 5))


def logo_paths(key):
    s = open(LOGO_TS, encoding='utf-8').read()
    m = re.search(key + r': \[(.*?)\]', s, re.S)
    return re.findall(r'"(M[^"]*)"', m.group(1))


# ----------------------------------------------------------------------------------------------
# sticker texture + dot SDFs (system python: cairosvg + svgpathtools + scipy)
# ----------------------------------------------------------------------------------------------
def make_sticker(out, size=2048):
    import cairosvg
    from svgpathtools import parse_path
    paths = logo_paths('dots') + logo_paths('q')
    xs0, xs1, ys0, ys1 = 1e9, -1e9, 1e9, -1e9
    for p in paths:
        a, b, c, d = parse_path(p).bbox()
        xs0, xs1, ys0, ys1 = min(xs0, a), max(xs1, b), min(ys0, c), max(ys1, d)
    bw, bh = xs1 - xs0, ys1 - ys0
    turq = read_spec()['colors']['turquoise']
    sc = 0.56 * size / bh
    tx = size / 2 - (xs0 + bw / 2) * sc
    ty = size / 2 - (ys0 + bh / 2) * sc + size * 0.01
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">',
           f'<rect width="{size}" height="{size}" fill="{turq}"/>',
           f'<circle cx="{size/2}" cy="{size/2}" r="{size*0.462}" fill="none" stroke="#FFFFFF" '
           f'stroke-width="{size*0.011}"/>',
           f'<g transform="translate({tx:.2f},{ty:.2f}) scale({sc:.5f})" fill="#FFFFFF">']
    svg += [f'<path d="{p}"/>' for p in paths]
    svg += ['</g></svg>']
    cairosvg.svg2png(bytestring='\n'.join(svg).encode(), write_to=out)
    print(f'[cup] sticker -> {out}')


def make_dots(out, px=1.5):
    """Signed distance field (logo units, + inside) of each of the logo's two dots, lightly blurred so the
    medial ridge of the comma's tail becomes a soft crest. Used as the footprint of the landed dollops."""
    import io
    import cairosvg
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    from svgpathtools import parse_path
    res = {}
    for k, p in enumerate(logo_paths('dots')):
        a, b, c, d = parse_path(p).bbox()
        pad = 0.35 * max(b - a, d - c)
        x0, y0 = a - pad, c - pad
        nx, ny = int((b - a + 2 * pad) / px), int((d - c + 2 * pad) / px)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{nx}" height="{ny}" '
               f'viewBox="{x0} {y0} {nx * px} {ny * px}"><rect x="{x0}" y="{y0}" width="{nx * px}" '
               f'height="{ny * px}" fill="#000"/><path d="{p}" fill="#fff"/></svg>')
        im = np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('L')) / 255.0
        ins = im > 0.5
        sdf = (ndimage.distance_transform_edt(ins) - ndimage.distance_transform_edt(~ins)) * px
        sdf = ndimage.gaussian_filter(sdf, 2.5)
        res[f'sdf{k}'] = sdf.astype(np.float32)
        res[f'org{k}'] = np.array([x0, y0, px])
        res[f'bbox{k}'] = np.array([a, b, c, d])
    np.savez_compressed(out, **res)
    print(f'[cup] dot SDFs -> {out}')


# ----------------------------------------------------------------------------------------------
# brand-colour lock (system python: numpy + opencv) — a secondary grade applied to rendered frames
# ----------------------------------------------------------------------------------------------
def _s2l(v):
    import numpy as np
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def _l2s(v):
    import numpy as np
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


_OK_M1 = ((0.4122214708, 0.5363325363, 0.0514459929), (0.2119034982, 0.6806995451, 0.1073969566),
          (0.0883024619, 0.2817188376, 0.6299787005))
_OK_M2 = ((0.2104542553, 0.7936177850, -0.0040720468), (1.9779984951, -2.4285922050, 0.4505937099),
          (0.0259040371, 0.7827717662, -0.8086757660))


def food_grade(im, strength=None, keep=None):
    """Appetite grade (panel food fix: 'fruit saturation x1.3 for hues away from 174 deg', honey 'more saturated
    amber'). The Cycles + PBR Neutral render leaves everything coloured on the bright dome high-key and
    washed out: honey and mango measure a pale salmon (OKLCh h 56, C 0.10, L 0.83 ~ #FBB989) instead of amber
    (#F4AE22: h 78, C 0.16), the strawberry is coral-pink and the pistachio pale lime. In OKLCh, weighted by
    chroma (cream / PET / speculars / shadows below C 0.03 are bit-exact untouched) and excluding the turquoise
    hue band (set + sticker): rotate the salmon band ~+14 deg toward amber, raise chroma (amber x1.6,
    red x1.45, green x1.3) and add density to the bright coloured pixels; then a soft gamut knee.
    A pure per-pixel colour function -> no flicker, identical on frames, in-betweens and the packshot.
    keep: optional 0..1 weight of pixels to leave alone (grade_image passes the brand lock's turquoise weight,
    so set noise whose hue drifts can never be touched). FOOD_GRADE=0 disables it, FOOD_GRADE=0.5 halves it."""
    import numpy as np
    if strength is None:
        strength = float(os.environ.get('FOOD_GRADE', '1'))
    if strength <= 0:
        return im
    m1, m2 = np.array(_OK_M1), np.array(_OK_M2)
    m1i, m2i = np.linalg.inv(m1), np.linalg.inv(m2)
    li = _s2l(np.clip(im, 0, 1))
    o = np.cbrt(np.maximum(li @ m1.T, 0)) @ m2.T
    L, C = o[..., 0], np.hypot(o[..., 1], o[..., 2])
    h = np.degrees(np.arctan2(o[..., 2], o[..., 1])) % 360

    def bump(c, s):
        d = (h - c + 180) % 360 - 180
        return np.exp(-(d / s) ** 2)

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)
    turq = sstep(140, 152, h) * (1 - sstep(228, 240, h))     # set + sticker hue band (#01E8D5 = h 184)
    w = sstep(0.03, 0.075, C) * (1 - turq) * strength
    if keep is not None:
        w = w * np.clip(1 - 4 * keep, 0, 1)
    sel = w > 1e-3
    if not sel.any():
        return im
    wl, Ll, Cl, hl = w[sel], L[sel], C[sel], h[sel]
    h = hl                                              # bump() reads h
    gain = 1 + 0.60 * bump(70, 24) + 0.45 * bump(22, 16) + 0.30 * bump(132, 22)
    h2 = np.radians(hl + 14 * bump(57, 14) * wl)       # max slope 0.86 < 1 -> the hue map stays monotonic
    C2 = Cl * (1 + (gain - 1) * wl)
    L2 = Ll - wl * sstep(0.62, 0.92, Ll) * (0.07 + 0.07 * bump(22, 16) + 0.05 * bump(132, 22))

    def to_lin(Cs):
        lab = np.stack([L2, Cs * np.cos(h2), Cs * np.sin(h2)], -1)
        return ((lab @ m2i.T) ** 3) @ m1i.T
    # soft gamut knee instead of a hard clip (a hard clip flattens the honey to B = 0): find each pixel's
    # largest in-gamut chroma Cm at (L2, h2) by bisection, then compress the boosted chroma smoothly into 0.96 Cm
    lo, hi = np.zeros_like(C2), np.full_like(C2, 0.40)
    for _ in range(12):
        mid = (lo + hi) / 2
        t = to_lin(mid)
        ok = (t.min(-1) >= -1e-4) & (t.max(-1) <= 1 + 1e-4)
        lo, hi = np.where(ok, mid, lo), np.where(ok, hi, mid)
    cm = 0.96 * lo
    knee = 0.80 * cm
    soft = np.where(C2 <= knee, C2, knee + (cm - knee) * np.tanh((C2 - knee) / np.maximum(cm - knee, 1e-6)))
    out = to_lin(np.minimum(np.maximum(soft, np.minimum(Cl, C2)), lo))   # never below the original chroma
    res = im.copy()
    res[sel] = _l2s(out)
    return res


def grade_image(im, ratio, ch_ref, sig=0.06):
    """im: float RGB (sRGB-encoded, 0..1). The sweep's chromaticity gets one linear per-channel correction onto
    #01E8D5 (weighted by closeness to that chromaticity -> the soft falloff, the contact shadow and the sticker
    move together, the cream / fruit / honey are untouched); then the food (appetite) grade on the coloured
    non-turquoise pixels (food_grade)."""
    import numpy as np
    li = _s2l(im)
    ch = li / (li.sum(axis=2, keepdims=True) + 1e-4)
    w = np.exp(-np.sum((ch - ch_ref) ** 2, axis=2) / (2 * sig * sig))
    w *= np.clip(li.sum(axis=2) / 0.05, 0, 1)          # leave near-black alone
    return food_grade(_l2s(li * (1 + w[..., None] * (ratio - 1))), keep=w)


def grade_frames(src_dir, dst_dir, ref_frame='0000.png', ratio_json=None):
    """Pull the sweep exactly onto brand turquoise: the measured sweep colour (median of the top 20% of the
    reference frame — the calm headline zone) is mapped per channel (linear light) onto #01E8D5. Same
    correction for every frame (no flicker); saved to ratio_json so the packshot gets the identical grade."""
    import glob
    import cv2
    import numpy as np

    def read(p):
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)[:, :, ::-1].astype(np.float32)
        return im / (65535.0 if im.max() > 255 else 255.0)

    ref = read(os.path.join(src_dir, ref_frame))
    cm = np.median(ref[: int(ref.shape[0] * 0.2)].reshape(-1, 3), axis=0)
    ct = np.array([int(read_spec()['colors']['turquoise'][i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    ratio = _s2l(ct) / np.maximum(_s2l(cm), 1e-5)
    lm = _s2l(cm)
    ch_ref = lm / lm.sum()
    print(f'[cup] grade: sweep {np.round(cm * 255, 1)} -> {np.round(ct * 255)}  (linear ratio {np.round(ratio, 3)})')
    if ratio_json:
        json.dump({'ratio': ratio.tolist(), 'ch_ref': ch_ref.tolist(), 'sweep': (cm * 255).tolist()},
                  open(ratio_json, 'w'), indent=1)
    os.makedirs(dst_dir, exist_ok=True)
    for p in sorted(glob.glob(os.path.join(src_dir, '[0-9][0-9][0-9][0-9].png'))):
        out = grade_image(read(p), ratio, ch_ref)
        cv2.imwrite(os.path.join(dst_dir, os.path.basename(p)),
                    (np.clip(out, 0, 1)[:, :, ::-1] * 65535 + 0.5).astype(np.uint16))
    print(f'[cup] graded frames -> {dst_dir}')


def grade_packshot(src, dst, ratio_json):
    """Same brand lock on the RGBA packshot (sticker), a cleaned contact shadow, then an 8-bit straight-alpha
    PNG for the end card. The shadow catcher's alpha is noisy at sane sample counts (speckle + a faint veil far
    from the cup), so shadow-only pixels (black RGB, outside the cup) are denoised, lose their noise floor and
    are kept only in a soft ellipse around the base -> a clean, soft, semi-transparent contact shadow."""
    import cv2
    import numpy as np
    from PIL import Image
    im = cv2.imread(src, cv2.IMREAD_UNCHANGED).astype(np.float32)
    im /= 65535.0 if im.max() > 255 else 255.0
    im = im[:, :, [2, 1, 0, 3]]
    g = json.load(open(ratio_json))
    rgb = grade_image(im[..., :3], np.array(g['ratio']), np.array(g['ch_ref']))
    a = im[..., 3].copy()
    body = cv2.dilate(((a > 0.5) | (rgb.max(axis=2) > 0.2)).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    shadow = (~body) & (rgb.max(axis=2) < 0.16)
    sh = cv2.GaussianBlur(np.where(shadow, a, 0).astype(np.float32), (0, 0), 5.0)
    sh = np.clip((sh - 0.045) / (1 - 0.045), 0, 1)
    ys, xs = np.nonzero(a > 0.8)
    cx, by, half = (xs.min() + xs.max()) / 2, ys.max(), (xs.max() - xs.min()) / 2
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    ell = ((xx - cx - 0.12 * half) / (1.25 * half)) ** 2 + ((yy - by + 0.02 * half) / (0.42 * half)) ** 2
    sh *= np.clip(1.6 - ell, 0, 1) ** 1.5
    sh *= min(8.0, 0.40 / max(float(sh.max()), 1e-3))      # a readable soft contact shadow, peak ~40%
    a = np.where(shadow, sh, a)
    rgb = np.where(shadow[..., None], 0.0, rgb)
    out = np.concatenate([rgb, a[..., None]], axis=2)
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst, optimize=True)
    print(f'[cup] packshot -> {dst}  {out.shape[1]}x{out.shape[0]}  alpha: opaque {np.mean(a > 0.99):.2f}, '
          f'soft {np.mean((a > 0.01) & (a <= 0.99)):.2f}, clear {np.mean(a <= 0.01):.2f}; '
          f'contact shadow max alpha {sh.max():.2f}')


def _flow_mid(A, B, w):
    """Motion-compensated in-between of two 16-bit RGB frames at 0 < w < 1 (DIS optical flow both ways)."""
    import cv2
    import numpy as np

    def gray(im):
        return cv2.cvtColor((im / 257).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    ga, gb = gray(A), gray(B)
    f_ab = dis.calc(ga, gb, None)
    f_ba = dis.calc(gb, ga, None)
    h, w_ = ga.shape
    gx, gy = np.meshgrid(np.arange(w_, dtype=np.float32), np.arange(h, dtype=np.float32))
    Aw = cv2.remap(A.astype(np.float32), gx - w * f_ab[..., 0], gy - w * f_ab[..., 1], cv2.INTER_CUBIC,
                   borderMode=cv2.BORDER_REPLICATE)
    Bw = cv2.remap(B.astype(np.float32), gx - (1 - w) * f_ba[..., 0], gy - (1 - w) * f_ba[..., 1], cv2.INTER_CUBIC,
                   borderMode=cv2.BORDER_REPLICATE)
    return np.clip((1 - w) * Aw + w * Bw, 0, 65535).astype(np.uint16)


def assemble(src_dir, dst_dir, n, mode='flow'):
    """Exactly n frames 0000..n-1 in dst_dir: rendered frames as they are; the frames rendered on twos get a
    motion-compensated in-between of their rendered neighbours (mode 'flow') or repeat the previous one
    ('hold'). Also reports how well 'flow' predicts frames that WERE rendered (PSNR check)."""
    import os as _os
    import shutil
    import cv2
    import numpy as np
    n = int(n)
    _os.makedirs(dst_dir, exist_ok=True)
    have = {f: _os.path.join(src_dir, f'{f:04d}.png') for f in range(n)
            if _os.path.exists(_os.path.join(src_dir, f'{f:04d}.png'))}
    if 0 not in have:
        raise SystemExit('missing frame 0')
    rd = sorted(have)
    made = []
    for f in range(n):
        dst = _os.path.join(dst_dir, f'{f:04d}.png')
        if f in have:
            shutil.copyfile(have[f], dst)
            continue
        a = max(x for x in rd if x < f)
        nxt = [x for x in rd if x > f]
        if mode == 'flow' and nxt and nxt[0] - a <= 2:
            b = nxt[0]
            A = cv2.imread(have[a], cv2.IMREAD_UNCHANGED)
            B = cv2.imread(have[b], cv2.IMREAD_UNCHANGED)
            cv2.imwrite(dst, _flow_mid(A, B, (f - a) / (b - a)))
            made.append(f)
        else:
            shutil.copyfile(have[a], dst)
    print(f'[cup] assembled {n} frames: {len(have)} rendered, {len(made)} flow in-betweens ({mode})')
    # quality check: predict rendered odd frames of the full-rate windows from their neighbours
    tests = [f for f in rd if f % 2 == 1 and f - 1 in have and f + 1 in have][::6][:6]
    for f in tests:
        A, B, R = (cv2.imread(have[x], cv2.IMREAD_UNCHANGED).astype(np.float64) for x in (f - 1, f + 1, f))
        P = _flow_mid(A.astype(np.uint16), B.astype(np.uint16), 0.5).astype(np.float64)
        hold = 10 * np.log10(65535.0 ** 2 / np.mean((A - R) ** 2))
        flow = 10 * np.log10(65535.0 ** 2 / np.mean((P - R) ** 2))
        print(f'[cup]   check f{f:03d}: PSNR vs render  hold {hold:5.1f} dB  flow {flow:5.1f} dB')


def verify(mp4, prev_dir, n):
    """ffprobe the delivery, decode with the BT.709 matrix (tv range) and measure the set against #01E8D5;
    write a contact sheet of the key frames."""
    import subprocess
    import numpy as np
    os.makedirs(prev_dir, exist_ok=True)
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                         'stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_range,'
                         'color_space,color_primaries,color_transfer', '-of', 'default=nw=1', mp4],
                        capture_output=True, text=True).stdout
    print('[cup] ffprobe:', ' '.join(pr.split()))
    assert f'nb_read_frames={n}' in pr, 'frame count mismatch'

    def frame(i):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf',
                              f'select=eq(n\,{i}),scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24',
                              '-frames:v', '1', '-f', 'rawvideo', '-'], capture_output=True).stdout
        return np.frombuffer(raw, np.uint8).reshape(1920, 1080, 3)
    turq = np.array([0x01, 0xE8, 0xD5])
    rep = {}
    for i in (0, 42, 90, n - 1):
        im = frame(i).astype(float)
        top = np.median(im[:422].reshape(-1, 3), axis=0)
        rep[i] = top
        print(f'[cup] frame {i:3d}: headline zone (y<422) median RGB {np.round(top).astype(int)} '
              f'(#01E8D5 = {turq}); max |d| {np.abs(top - turq).max():.1f}; '
              f'zone p1-p99 G {np.percentile(im[:422, :, 1], 1):.0f}-{np.percentile(im[:422, :, 1], 99):.0f}')
    keys = [0, 20, 24, 28, 33, 40, 60, 75, 90, 105, n - 1]
    for i in keys:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-vf',
                        f'select=eq(n\,{i}),scale=in_color_matrix=bt709:in_range=tv:out_range=pc',
                        '-frames:v', '1', os.path.join(prev_dir, f'cup-{i:03d}.png')])
    files = [os.path.join(prev_dir, f'cup-{i:03d}.png') for i in keys]
    subprocess.run(['montage', *files, '-tile', f'{len(keys)}x1', '-geometry', '270x480+3+3', '-background', '#222',
                    '-pointsize', '14', os.path.join(prev_dir, 'contact.jpg')])
    print(f'[cup] contact sheet -> {os.path.join(prev_dir, "contact.jpg")}')


# ================================================================================================
# Blender part
# ================================================================================================
if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] in ('sticker', 'dots', 'grade', 'grade-packshot',
                                                                   'assemble', 'verify'):
    cmd = sys.argv[1]
    if cmd == 'sticker':
        make_sticker(sys.argv[2])
    elif cmd == 'dots':
        make_dots(sys.argv[2])
    elif cmd == 'grade':
        grade_frames(sys.argv[2], sys.argv[3], ratio_json=(sys.argv[4] if len(sys.argv) > 4 else None))
    elif cmd == 'grade-packshot':
        grade_packshot(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == 'assemble':
        assemble(*sys.argv[2:6])
    else:
        verify(sys.argv[2], sys.argv[3], int(sys.argv[4]))
    sys.exit(0)

import numpy as np  # noqa: E402  (bpy python has numpy)

try:
    import bpy  # noqa: E402
    import bmesh  # noqa: E402
    from mathutils import Vector, Matrix, Euler  # noqa: E402
except ImportError:
    bpy = None

SPEC = read_spec()
FPS = SPEC['fps']
NFRAMES = SPEC['frames']
DROP_T = SPEC['drop_land']
SP0, SP1 = SPEC['spoon']            # spoon window (local s)
F = 1.0 / FPS                        # one frame in seconds

# --- cup geometry (metres) ---------------------------------------------------------------------
CUP_H = 0.098          # wall height (rim bead on top)
R_BOT = 0.0305         # outer radius at the base
R_TOP = 0.0462         # outer radius at the rim
WALL = 0.0008          # PET wall thickness
BASE_T = 0.0022        # inner floor height


def r_out(z):
    return R_BOT + (R_TOP - R_BOT) * np.clip(z, 0, CUP_H) / CUP_H


def r_in(z):
    return r_out(z) - WALL


FRUIT_LAYERS = [(0.0030, 0.0305), (0.0500, 0.0800)]
DOME_RX = R_TOP + 0.0011
DOME_HZ = 0.0170
DOME_PHI_MAX = math.radians(101.0)
DOME_ZC = CUP_H + 0.0016 - DOME_HZ * math.cos(DOME_PHI_MAX)
DOME_R = DOME_RX
SET_FALLOFF = (0.16, 0.10)
SET_AO = (0.045, 0.72)
STICKER_Z = 0.0425
STICKER_R = 0.0205
STICKER_PHI = math.radians(-92.0)          # -90 = straight at the camera (-Y)
DRIP_PHI = math.radians(-90.0 - 28.0)      # honey bead hangs on the dome lip, front-left

# --- the two dots (logo's ق dots) ---------------------------------------------------------------
DOT_W = 0.0132          # width of one dot footprint (m)
DOT_YSTR = 1.22         # footprint stretched along y (back) to pre-compensate the camera's foreshortening
DOT_PAIR = (-0.0058, -0.0200)    # world xy of the pair's bbox centre
DOT_OFF = (-0.0016, 0.0016)      # a little more gap than the logo (the honey runs between them)
DOT_H = 0.0080          # settled dollop height
# --- the spoon scoop -----------------------------------------------------------------------------
CR_C = np.array([0.0235, -0.0030])           # crater centre (right of the dots, facing the camera)
CR_U = np.array([-0.700, 0.714])             # scoop direction (the spoon tip leads: away, to the left-back)
CR_V = np.array([-CR_U[1], CR_U[0]])
CR_A, CR_B, CR_D = 0.0122, 0.0088, 0.0068    # crater half-length (along U), half-width, depth


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def sstep(e0, e1, x):
    return float(smoothstep(e0, e1, x))


def ease_in_out(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def pchip(ts, vs, t):
    """Monotone C1 cubic through (ts, vs) (Fritsch-Carlson); constant outside."""
    ts, vs = np.asarray(ts, float), np.asarray(vs, float)
    if t <= ts[0]:
        return float(vs[0])
    if t >= ts[-1]:
        return float(vs[-1])
    h = np.diff(ts)
    dl = np.diff(vs) / h
    m = np.zeros(len(ts))
    for i in range(1, len(ts) - 1):
        if dl[i - 1] * dl[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i])
    m[0] = dl[0] if len(ts) < 3 else ((2 * h[0] + h[1]) * dl[0] - h[0] * dl[1]) / (h[0] + h[1])
    if m[0] * dl[0] <= 0:
        m[0] = 0.0
    m[-1] = dl[-1] if len(ts) < 3 else ((2 * h[-1] + h[-2]) * dl[-1] - h[-1] * dl[-2]) / (h[-1] + h[-2])
    if m[-1] * dl[-1] <= 0:
        m[-1] = 0.0
    i = int(np.searchsorted(ts, t) - 1)
    u = (t - ts[i]) / h[i]
    h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
    return float(h00 * vs[i] + h10 * h[i] * m[i] + h01 * vs[i + 1] + h11 * h[i] * m[i + 1])


# ------------------------------------------------------------------------------------------------
# dome height field (analytic; everything that sits on the dome samples it)
# ------------------------------------------------------------------------------------------------
_RNG = np.random.default_rng(7)
_SCOOPS = [(-0.012, 0.011, 0.024, 0.0315), (0.015, 0.009, 0.022, 0.0275), (0.001, -0.015, 0.022, 0.0240),
           (-0.026, -0.011, 0.016, 0.0185), (0.027, -0.010, 0.017, 0.0195), (0.003, 0.029, 0.016, 0.0200),
           (-0.031, 0.013, 0.013, 0.0165)]
_WAVES = [(_RNG.normal(0, 1, 2), _RNG.uniform(0.009, 0.018), _RNG.uniform(0, 6.28)) for _ in range(6)]
_CURD = [(_RNG.normal(0, 1, 2), _RNG.uniform(0.0022, 0.0045), _RNG.uniform(0, 6.28)) for _ in range(7)]
_SPOON = [(-0.004, 0.004, 0.017, 4.2, 1.1, 0.0016), (0.012, -0.004, 0.013, 1.0, 1.0, 0.0012),
          (-0.020, -0.004, 0.011, 5.6, 0.9, 0.0010), (0.006, 0.020, 0.012, 3.0, 1.0, 0.0010)]
_TORN = [(np.random.default_rng(41 + i).normal(0, 1, 2), 0.0014 + 0.0005 * i, 0.9 * i) for i in range(6)]


def _smax(a, b, k=0.0013):
    return np.maximum(a, b) + k * np.log1p(np.exp(-np.abs(a - b) / k))


def _field(x, y, waves):
    tex = 0.0
    for (d, wl, ph) in waves:
        dn = d / (np.linalg.norm(d) + 1e-9)
        tex = tex + np.sin((x * dn[0] + y * dn[1]) * (2 * np.pi / wl) + ph)
    return tex


def dome_base(x, y):
    """Mound height at (x, y): a low cap + spooned scoops, spoon-marked ridges and a fine curd texture."""
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    r = np.sqrt(x * x + y * y)
    e = np.sqrt(np.clip(1 - (r / DOME_RX) ** 2, 0, 1))
    z = DOME_ZC + DOME_HZ * e
    zr = CUP_H + 0.0016
    for (cx, cy, rad, pk) in _SCOOPS:
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        hc = rad * 0.72
        cap = zr + pk - hc + hc * np.sqrt(np.clip(1 - (d / rad) ** 2, 0, 1))
        cap = np.where(d < rad, cap, zr + pk - hc - (d - rad) * 0.6)
        z = _smax(z, cap)
    fall = 1 - smoothstep(0.80 * DOME_RX, 0.97 * DOME_RX, r)
    z = z + 0.00013 * _field(x, y, _WAVES) * fall
    # clotted qashta is not whipped foam: a soft, slightly curdled surface (2-4 mm lumps, ~0.1 mm)
    z = z + 0.00005 * _field(x, y, _CURD) * fall
    for (cx, cy, rad, ac, aw, hgt) in _SPOON:
        dx, dy = x - cx, y - cy
        d = np.sqrt(dx * dx + dy * dy)
        da = np.angle(np.exp(1j * (np.arctan2(dy, dx) - ac)))
        arc = np.exp(-(da / aw) ** 4)
        ridge = np.exp(-((d - rad) / 0.0016) ** 2) - 0.35 * np.exp(-((d - rad + 0.0034) / 0.0028) ** 2)
        z = z + 0.7 * hgt * ridge * arc * fall
    z = z + 0.0020 * np.exp(-((x + 0.012) ** 2 + (y - 0.011) ** 2) / (0.0045 ** 2))
    return z


class Dots:
    """The logo's two dots as dollop footprints on the dome (signed distance fields from dots_sdf.npz)."""

    def __init__(self, path=DOTS_NPZ):
        d = np.load(path)
        self.sdf = [d['sdf0'], d['sdf1']]
        self.org = [d['org0'], d['org1']]
        bb = [d['bbox0'], d['bbox1']]
        self.S = DOT_W / (bb[0][1] - bb[0][0])                       # m per logo unit
        self.pair = ((min(b[0] for b in bb) + max(b[1] for b in bb)) / 2,
                     (min(b[2] for b in bb) + max(b[3] for b in bb)) / 2)
        self.head, self.dmax = [], []
        for k in range(2):
            i, j = np.unravel_index(np.argmax(self.sdf[k]), self.sdf[k].shape)
            x0, y0, px = self.org[k]
            self.head.append(np.array(self.l2w(k, x0 + (j + 0.5) * px, y0 + (i + 0.5) * px)))
            self.dmax.append(float(self.sdf[k].max()) * self.S)

    def l2w(self, k, lx, ly):
        return (DOT_PAIR[0] + (lx - self.pair[0]) * self.S + DOT_OFF[k],
                DOT_PAIR[1] - (ly - self.pair[1]) * self.S * DOT_YSTR)

    def w2l(self, k, wx, wy):
        return (self.pair[0] + (wx - DOT_PAIR[0] - DOT_OFF[k]) / self.S,
                self.pair[1] - (wy - DOT_PAIR[1]) / (self.S * DOT_YSTR))

    def sdist(self, k, wx, wy):
        """Signed distance (m, + inside) of world points to dot k's footprint (bilinear)."""
        lx, ly = self.w2l(k, np.asarray(wx, float), np.asarray(wy, float))
        x0, y0, px = self.org[k]
        g = self.sdf[k]
        ny, nx = g.shape
        fx, fy = (lx - x0) / px - 0.5, (ly - y0) / px - 0.5
        inside = (fx >= 0) & (fx <= nx - 1) & (fy >= 0) & (fy <= ny - 1)
        ix = np.clip(np.floor(fx).astype(int), 0, nx - 2)
        iy = np.clip(np.floor(fy).astype(int), 0, ny - 2)
        tx, ty = np.clip(fx - ix, 0, 1), np.clip(fy - iy, 0, 1)
        v = (g[iy, ix] * (1 - tx) * (1 - ty) + g[iy, ix + 1] * tx * (1 - ty) + g[iy + 1, ix] * (1 - tx) * ty
             + g[iy + 1, ix + 1] * tx * ty)
        return np.where(inside, v, -1e3) * self.S

    @staticmethod
    def spread(tau):
        return 1 - 0.40 * math.exp(-tau / 0.05) + 0.03 * math.exp(-tau / 0.15) * math.sin(2 * math.pi * tau / 0.25)

    def dollop(self, k, x, y, tau):
        """Height added to the dome by dot k at tau s after its drop touched: it SLUMPS (tall + compact ->
        settled) and SPREADS (footprint 60% -> 100%), with a small crown ring that relaxes into a soft rim."""
        sp = self.spread(tau)
        hx, hy = self.head[k]
        d = self.sdist(k, hx + (x - hx) / sp, hy + (y - hy) / sp) * sp
        dm = self.dmax[k] * sp
        E = 0.0004
        s = np.clip((d + E) / (dm + E), 0, 1)
        H = DOT_H * (1 + 0.45 * math.exp(-tau / 0.06)) * sstep(0.0, 0.05, tau)
        h = H * np.sqrt(1 - (1 - s) ** 2) ** 0.85 * smoothstep(0.0, 0.14, s)
        # the drop's tip leaves a soft kiss on the head (fresh, not moulded)
        rr = np.sqrt((x - hx) ** 2 + (y - hy + 0.0012) ** 2)
        h = h + H * 0.14 * np.exp(-(rr / 0.0024) ** 2)
        # impact crown: a lobed ring thrown up around the footprint, relaxing into a soft rim; between the rim
        # and the dollop the weight presses a shallow groove -> a readable contour, white on white
        settle = sstep(0.0, 0.12, tau)
        hc = 0.0016 * (1 - math.exp(-tau / 0.018)) * math.exp(-tau / 0.09) + 0.00034 * settle
        ang = np.arctan2(y - hy, x - hx)
        crown = hc * np.exp(-((d + 0.0015 * sp) / 0.0008) ** 2) * (1 + 0.45 * np.cos(7 * ang + 1.3 * k))
        groove = -0.00045 * settle * np.exp(-((d + 0.00035) / 0.00045) ** 2)
        crown = crown + groove
        fresh = smoothstep(-0.0018, 0.0002, d)
        return h + crown, fresh


DOTS = None


def dots():
    global DOTS
    if DOTS is None:
        DOTS = Dots()
    return DOTS


def crater_g(t):
    """Crater growth 0..1 while the spoon is in the cream."""
    return sstep(SP0 + 11 * F, SP0 + 26 * F, t)


def crater(x, y, g):
    """Dome change where the spoon took its scoop: a torn bowl-shaped hollow with a pushed-up lip ahead."""
    if g <= 0:
        return 0.0, 0.0
    c = CR_C + CR_U * (0.002 * g - 0.003)
    dx, dy = x - c[0], y - c[1]
    u = (dx * CR_U[0] + dy * CR_U[1]) / (CR_A * (0.55 + 0.45 * g))
    v = (dx * CR_V[0] + dy * CR_V[1]) / (CR_B * (0.75 + 0.25 * g))
    q2 = u * u + v * v
    q = np.sqrt(q2)
    inside = np.clip(1 - q2, 0, 1)
    bowl = -CR_D * g * inside ** 1.25
    ahead = np.clip(u / (q + 1e-9), 0, 1)
    lip = 0.0013 * g * np.exp(-((q - 1.10) / 0.17) ** 2) * (0.45 + 0.55 * ahead)
    torn = 0.00050 * g * _field(x, y, _TORN) / 3.0 * smoothstep(0.0, 0.5, inside)
    return bowl + lip + torn, smoothstep(0.0, 0.25, inside) * g


class Surf:
    """Qashta surface at shot time t: base mound + impact wobble + the two dollops + the scoop crater."""

    def __init__(self, t, scoop=True, drops=True):
        self.t = t
        self.hits = [(k, t - tl) for k, tl in enumerate(DROP_T) if drops and t > tl]
        self.g = crater_g(t) if scoop else 0.0

    def parts(self, x, y):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        zb = dome_base(x, y)
        z = zb.copy()
        fresh = np.zeros_like(z)
        for k, tau in self.hits:
            env = math.exp(-6.0 * tau)
            z = z - 0.035 * env * math.sin(2 * math.pi * 3.0 * tau) * np.maximum(zb - (CUP_H + 0.002), 0)
            h, fr = dots().dollop(k, x, y, tau)
            z = z + h
            fresh = np.maximum(fresh, fr)
        torn = np.zeros_like(z)
        if self.g > 0:
            dz, torn = crater(x, y, self.g)
            z = z + dz
        return z, fresh, torn

    def z(self, x, y):
        return self.parts(x, y)[0]

    def normal(self, x, y, e=0.0004):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        zx = (self.z(x + e, y) - self.z(x - e, y)) / (2 * e)
        zy = (self.z(x, y + e) - self.z(x, y - e)) / (2 * e)
        n = np.stack([-zx, -zy, np.ones_like(zx)], -1)
        return n / np.linalg.norm(n, axis=-1, keepdims=True)


# ------------------------------------------------------------------------------------------------
# small mesh helpers
# ------------------------------------------------------------------------------------------------
def mesh_obj(name, verts, faces, mat=None, smooth=True, coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if mat:
        me.materials.append(mat)
    return ob


def lathe(profile, seg):
    """profile: list of (r, z) — r==0 endpoints become poles. Returns verts, faces (quads/tris)."""
    verts, rings = [], []
    for (r, z) in profile:
        if r <= 1e-9:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
        else:
            ring = []
            for j in range(seg):
                a = 2 * math.pi * j / seg
                ring.append(len(verts))
                verts.append((r * math.cos(a), r * math.sin(a), z))
            rings.append(ring)
    return verts, ring_faces(rings, seg)


def ring_faces(rings, seg):
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            faces += [(a[0], b[j], b[(j + 1) % seg]) for j in range(seg)]
        elif len(b) == 1:
            faces += [(a[j], b[0], a[(j + 1) % seg]) for j in range(seg)]
        else:
            faces += [(a[j], b[j], b[(j + 1) % seg], a[(j + 1) % seg]) for j in range(seg)]
    return faces


def rings_mesh(rings_pts):
    """rings_pts: list of (n,3) arrays or single (3,) points (poles) -> verts, faces."""
    verts, rings, seg = [], [], None
    for rp in rings_pts:
        rp = np.asarray(rp, float)
        if rp.ndim == 1:
            rings.append([len(verts)])
            verts.append(rp)
        else:
            seg = len(rp)
            rings.append(list(range(len(verts), len(verts) + seg)))
            verts += list(rp)
    return np.array(verts), ring_faces(rings, seg)


def recalc_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def set_verts(ob, co):
    me = ob.data
    me.vertices.foreach_set('co', np.asarray(co, dtype=np.float32).ravel())
    me.update()


def set_mesh(ob, verts, faces, smooth=True):
    me = ob.data
    me.clear_geometry()
    me.from_pydata(np.asarray(verts).tolist(), [], [tuple(f) for f in faces])
    if smooth:
        me.shade_smooth()
    me.update()


def get_verts(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    return co.reshape(-1, 3).astype(float)


def tube_mesh(pts, nrm, w, h, nsec=16, flat=0.35, cap=5):
    """Ribbon/tube along pts: elliptic section (half-width w, half-height h), the underside flattened by
    `flat` (0 = flat bottom, 1 = round). nrm: the 'up' vector per point. Rounded end caps."""
    pts = np.asarray(pts, float)
    n = len(pts)
    T = np.gradient(pts, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
    verts, faces = [], []
    scale = np.ones(n)
    cap = min(cap, max(1, n // 3))
    for k in range(cap):
        f = math.sqrt(max(0.0, 1 - ((cap - k) / (cap + 0.3)) ** 2))
        scale[k] = min(scale[k], f)
        scale[n - 1 - k] = min(scale[n - 1 - k], f)
    for i in range(n):
        N = nrm[i] - np.dot(nrm[i], T[i]) * T[i]
        N /= np.linalg.norm(N) + 1e-12
        B = np.cross(T[i], N)
        for j in range(nsec):
            a = 2 * math.pi * j / nsec
            sa, ca = math.sin(a), math.cos(a)
            up = h[i] * (sa if sa > 0 else sa * flat) + h[i] * (0.18 if flat < 1 else 0.0)
            verts.append(pts[i] + N * up * scale[i] + B * (w[i] * ca * scale[i]))
    for i in range(n - 1):
        for j in range(nsec):
            a, b = i * nsec + j, i * nsec + (j + 1) % nsec
            faces.append((a, b, b + nsec, a + nsec))
    off = 0.18 if flat < 1 else 0.0
    c0 = len(verts)
    verts.append(pts[0] + nrm[0] * h[0] * off - T[0] * 0.0)
    c1 = len(verts)
    verts.append(pts[-1] + nrm[-1] * h[-1] * off)
    faces += [(c0, (j + 1) % nsec, j) for j in range(nsec)]
    last = (n - 1) * nsec
    faces += [(c1, last + j, last + (j + 1) % nsec) for j in range(nsec)]
    return np.array(verts), faces


def catmull(pts, n_per):
    pts = np.asarray(pts, float)
    P = np.vstack([pts[0], pts, pts[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return np.array(out)


def resample(pts, step):
    """Polyline -> points every `step` metres (+ cumulative arc length)."""
    pts = np.asarray(pts, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(s[-1] / step) + 1)
    si = np.linspace(0, s[-1], n)
    return np.stack([np.interp(si, s, pts[:, k]) for k in range(pts.shape[1])], -1), si


# ------------------------------------------------------------------------------------------------
# materials
# ------------------------------------------------------------------------------------------------
class NT:
    """Tiny node-tree builder."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.nodes, self.links = self.nt.nodes, self.nt.links
        self.nodes.clear()
        self.x = 0

    def n(self, kind, **inputs):
        node = self.nodes.new(kind)
        node.location = (self.x, 0)
        self.x += 200
        for k, v in inputs.items():
            if k.startswith('_'):
                setattr(node, k[1:], v)
            elif kind == 'ShaderNodeMix' and k in ('A', 'B'):
                self.set(node.inputs[6 if k == 'A' else 7], v)   # the colour sockets
            else:
                self.set(node.inputs[k], v)
        return node

    def set(self, sock, v):
        if hasattr(v, 'bl_idname') or hasattr(v, 'is_output'):
            self.links.new(v if hasattr(v, 'is_output') else v.outputs[0], sock)
        else:
            sock.default_value = v

    def link(self, a, b):
        self.links.new(a, b)


def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m, NT(m)


def rgba(c):
    return (c[0], c[1], c[2], 1.0)


def principled(nt, **kw):
    p = nt.n('ShaderNodeBsdfPrincipled')
    for k, v in kw.items():
        if k == 'sss_method':
            p.subsurface_method = v
        else:
            nt.set(p.inputs[k], rgba(v) if (isinstance(v, tuple) and len(v) == 3 and 'Radius' not in k) else v)
    return p


def output(nt, shader, volume=None):
    o = nt.n('ShaderNodeOutputMaterial')
    o.target = 'CYCLES'
    nt.link(shader.outputs[0], o.inputs['Surface'])
    if volume is not None:
        nt.link(volume.outputs[0], o.inputs['Volume'])
    return o


def shadow_transparent(nt, shader, tint=(1, 1, 1), diffuse_too=True):
    """Clear things let light through to shadow (+diffuse) rays instead of needing caustics."""
    lp = nt.n('ShaderNodeLightPath')
    tr = nt.n('ShaderNodeBsdfTransparent', Color=rgba(tint))
    fac = lp.outputs['Is Shadow Ray']
    if diffuse_too:
        mx = nt.n('ShaderNodeMath', _operation='MAXIMUM')
        nt.link(lp.outputs['Is Shadow Ray'], mx.inputs[0])
        nt.link(lp.outputs['Is Diffuse Ray'], mx.inputs[1])
        fac = mx.outputs[0]
    mix = nt.n('ShaderNodeMixShader')
    nt.link(fac, mix.inputs[0])
    nt.link(shader.outputs[0], mix.inputs[1])
    nt.link(tr.outputs[0], mix.inputs[2])
    return mix


def noise_bump(nt, scale, strength, detail=6.0, coords='Object', distance=0.001):
    tc = nt.n('ShaderNodeTexCoord')
    nz = nt.n('ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=0.55)
    nt.link(tc.outputs[coords], nz.inputs['Vector'])
    bump = nt.n('ShaderNodeBump', Strength=strength, Distance=distance)
    nt.link(nz.outputs['Fac'], bump.inputs['Height'])
    return bump, nz, tc


def ramp(nt, fac_socket, stops):
    r = nt.n('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0][0], rgba(stops[0][1])
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = rgba(col)
    nt.link(fac_socket, r.inputs['Fac'])
    return r


def math_node(nt, op, a, b=None, clamp=False):
    m = nt.n('ShaderNodeMath', _operation=op)
    m.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            m.inputs[i].default_value = v
        else:
            nt.link(v, m.inputs[i])
    return m.outputs[0]


def mix_val(nt, fac, a, b):
    """a + (b - a) * fac (fac socket)."""
    return math_node(nt, 'ADD', a, math_node(nt, 'MULTIPLY', fac, b - a))


QASHTA = ((0.84, 0.815, 0.735), (0.885, 0.865, 0.785))    # ivory ramp (linear)
FRESH = (0.905, 0.885, 0.815)                              # fresh, glossier cream of the drops


def mat_qashta(name='qashta', tint_attr=None, bump=0.25, coat=0.0, rough=0.40, glow=0.0, fresh_attr=None):
    """Levantine qashta: ivory, satin, soft SSS. `fresh_attr` (0..1 vertex attribute) blends towards the
    glossier fresh cream of the landed drops; `glow` adds a little self-light so it never goes grey through
    the PET or under the dome's overhang (qashta must be the brightest, creamiest ivory in frame)."""
    m, nt = new_mat(name)
    tc = nt.n('ShaderNodeTexCoord')
    nzl = nt.n('ShaderNodeTexNoise', Scale=120.0, Detail=1.0, Roughness=0.5)
    nt.link(tc.outputs['Object'], nzl.inputs['Vector'])
    col = ramp(nt, nzl.outputs['Fac'], [(0.3, QASHTA[0]), (0.7, QASHTA[1])])
    col_out = col.outputs['Color']
    fr = None
    if fresh_attr:
        fr = nt.n('ShaderNodeAttribute', _attribute_name=fresh_attr).outputs['Fac']
        mixf = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba(FRESH))
        nt.link(fr, mixf.inputs['Factor'])
        nt.link(col_out, mixf.inputs[6])
        col_out = mixf.outputs[2]
    if tint_attr:
        attr = nt.n('ShaderNodeAttribute', _attribute_name=tint_attr)
        vo = nt.n('ShaderNodeTexVoronoi', Scale=110.0, Randomness=1.0)
        nt.link(tc.outputs['Object'], vo.inputs['Vector'])
        # what shows between the pieces: deeper fruit in shadow + cream, never bright confetti
        salad = ramp(nt, vo.outputs['Color'], [(0.0, (0.30, 0.04, 0.035)), (0.3, (0.46, 0.20, 0.05)),
                                              (0.5, (0.55, 0.48, 0.34)), (0.66, (0.36, 0.06, 0.05)),
                                              (0.8, (0.20, 0.26, 0.06)), (1.0, (0.50, 0.26, 0.06))])
        salad.color_ramp.interpolation = 'CONSTANT'
        mixc = nt.n('ShaderNodeMix', _data_type='RGBA')
        nt.link(salad.outputs['Color'], mixc.inputs[7])
        nt.link(math_node(nt, 'MULTIPLY', attr.outputs['Fac'], 0.88), mixc.inputs['Factor'])
        nt.link(col_out, mixc.inputs[6])
        col_out = mixc.outputs[2]
    p = principled(nt, **{'Roughness': rough, 'Subsurface Weight': 1.0,
                          'Subsurface Radius': (1.0, 0.92, 0.78), 'Subsurface Scale': 0.0024,
                          'Coat Weight': coat, 'Coat Roughness': 0.10, 'Specular IOR Level': 0.5,
                          'sss_method': 'BURLEY'})
    nt.link(col_out, p.inputs['Base Color'])
    if fr is not None:
        nt.link(mix_val(nt, fr, rough, 0.19), p.inputs['Roughness'])
        nt.link(mix_val(nt, fr, coat, 0.58), p.inputs['Coat Weight'])
    if glow > 0:
        nt.link(col_out, p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = glow
    if bump > 0:
        nz = nt.n('ShaderNodeTexNoise', Scale=520.0, Detail=3.0, Roughness=0.6)
        nt.link(tc.outputs['Object'], nz.inputs['Vector'])
        bn = nt.n('ShaderNodeBump', Strength=bump, Distance=0.0004)
        nt.link(nz.outputs['Fac'], bn.inputs['Height'])
        if fr is not None:   # the fresh cream is smooth
            nt.link(mix_val(nt, fr, bump, 0.02), bn.inputs['Strength'])
        nt.link(bn.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_drop_fall():
    """The falling drop: fresh cream, glossy, minimal SSS (a thin refractive/SSS teardrop in motion blur
    rendered blue/pink fringes in v1)."""
    m, nt = new_mat('drop_fall')
    p = principled(nt, **{'Base Color': FRESH, 'Roughness': 0.22, 'Subsurface Weight': 0.25,
                          'Subsurface Radius': (1.0, 0.95, 0.9), 'Subsurface Scale': 0.0006,
                          'Coat Weight': 0.6, 'Coat Roughness': 0.08, 'Emission Color': rgba(FRESH),
                          'Emission Strength': 0.08, 'sss_method': 'BURLEY'})
    output(nt, p)
    return m


def mat_strand():
    """Stretched clotted cream: glossy fresh cream with fine streaks running along the pull (UV u = length)."""
    m, nt = new_mat('strand')
    tc = nt.n('ShaderNodeTexCoord')
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (4.0, 60.0, 1.0)
    nt.link(tc.outputs['UV'], mp.inputs['Vector'])
    nz = nt.n('ShaderNodeTexNoise', Scale=6.0, Detail=3.0, Roughness=0.5)
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    bump = nt.n('ShaderNodeBump', Strength=0.25, Distance=0.0003)
    nt.link(nz.outputs['Fac'], bump.inputs['Height'])
    p = principled(nt, **{'Base Color': FRESH, 'Roughness': 0.2, 'Subsurface Weight': 1.0,
                          'Subsurface Radius': (1.0, 0.92, 0.78), 'Subsurface Scale': 0.0012,
                          'Coat Weight': 0.6, 'Coat Roughness': 0.1, 'Emission Color': rgba(FRESH),
                          'Emission Strength': 0.06, 'sss_method': 'BURLEY'})
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_cup():
    m, nt = new_mat('cup_pet')
    p = principled(nt, **{'Base Color': (1.0, 1.0, 1.0), 'Roughness': 0.012, 'IOR': 1.57,
                          'Transmission Weight': 1.0, 'Specular IOR Level': 0.6})
    output(nt, shadow_transparent(nt, p, tint=(0.97, 0.98, 0.98)))
    return m


def mat_water():
    """Condensation beads: clear water caps (they sparkle and lens the contents; shadow-transparent)."""
    m, nt = new_mat('water')
    p = principled(nt, **{'Base Color': (1.0, 1.0, 1.0), 'Roughness': 0.04, 'IOR': 1.33,
                          'Transmission Weight': 1.0, 'Specular IOR Level': 0.9})
    tr = nt.n('ShaderNodeBsdfTransparent')
    mix = nt.n('ShaderNodeMixShader')
    mix.inputs[0].default_value = 0.45          # 45% glass: highlights + a hint of lensing, never black specks
    nt.link(tr.outputs[0], mix.inputs[1])
    nt.link(p.outputs[0], mix.inputs[2])
    output(nt, shadow_transparent(nt, mix, tint=(1.0, 1.0, 1.0)))
    return m


def mat_haze():
    """Faint cold mist on the PET (micro-condensation): a whisper of white scatter, patchy, strongest low on
    the cup, fading towards the rim; cleared where the big beads ran. Mostly transparent."""
    m, nt = new_mat('haze')
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])
    zfade = math_node(nt, 'SUBTRACT', 1.0, math_node(nt, 'DIVIDE', sep.outputs[2], CUP_H * 1.05, clamp=True))
    nz = nt.n('ShaderNodeTexNoise', Scale=90.0, Detail=2.0, Roughness=0.5)
    nt.link(tc.outputs['Object'], nz.inputs['Vector'])
    patch = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs['Fac'], 0.35), 2.5, clamp=True)
    fac = math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', zfade, patch), 0.16)
    tr = nt.n('ShaderNodeBsdfTransparent')
    tl = nt.n('ShaderNodeBsdfTranslucent', Color=rgba((0.9, 0.95, 0.95)))
    mix = nt.n('ShaderNodeMixShader')
    nt.link(fac, mix.inputs[0])
    nt.link(tr.outputs[0], mix.inputs[1])
    nt.link(tl.outputs[0], mix.inputs[2])
    lp = nt.n('ShaderNodeLightPath')
    mix2 = nt.n('ShaderNodeMixShader')
    nt.link(lp.outputs['Is Shadow Ray'], mix2.inputs[0])
    nt.link(mix.outputs[0], mix2.inputs[1])
    nt.link(tr.outputs[0], mix2.inputs[2])
    output(nt, mix2)
    return m


HONEY_TINT = ((1.0, 0.80, 0.26), (1.0, 0.58, 0.08), (0.85, 0.36, 0.02))   # thin -> thick amber (linear)


def mat_honey():
    """Honey on the cream: a see-through amber film (tint deepens towards grazing angles, like Beer's law), a
    little golden body so it glows, and a Fresnel-weighted glossy skin for sharp wet highlights."""
    m, nt = new_mat('honey')
    lw = nt.n('ShaderNodeLayerWeight', Blend=0.5)
    thick = math_node(nt, 'POWER', lw.outputs['Facing'], 1.2)
    tint = ramp(nt, thick, [(0.0, HONEY_TINT[0]), (0.5, HONEY_TINT[1]), (1.0, HONEY_TINT[2])])
    tr = nt.n('ShaderNodeBsdfTransparent')
    nt.link(tint.outputs['Color'], tr.inputs['Color'])
    em = nt.n('ShaderNodeEmission', Color=rgba((1.0, 0.60, 0.09)), Strength=0.30)
    body = nt.n('ShaderNodeAddShader')
    nt.link(tr.outputs[0], body.inputs[0])
    nt.link(em.outputs[0], body.inputs[1])
    gl = nt.n('ShaderNodeBsdfGlossy', Color=rgba((1.0, 0.95, 0.85)), Roughness=0.02)
    fr = nt.n('ShaderNodeFresnel', IOR=1.49)
    mix = nt.n('ShaderNodeMixShader')
    nt.link(math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', fr.outputs['Fac'], 0.65), 0.03), mix.inputs[0])
    nt.link(body.outputs[0], mix.inputs[1])
    nt.link(gl.outputs[0], mix.inputs[2])
    output(nt, mix)
    return m


def mat_honey_body():
    """Free-hanging honey (bead on the lip, thread off the spoon): seen against turquoise a see-through film
    turns olive, so these read as a glowing golden body (SSS amber + glossy coat)."""
    m, nt = new_mat('honey_body')
    p = principled(nt, **{'Base Color': (0.88, 0.42, 0.018), 'Roughness': 0.08, 'Subsurface Weight': 0.0,
                          'Coat Weight': 0.35, 'Coat Roughness': 0.03, 'Coat IOR': 1.49,
                          'Emission Color': rgba((1.0, 0.50, 0.04)), 'Emission Strength': 0.60})
    output(nt, p)
    return m


WET = {'Coat Weight': 0.45, 'Coat Roughness': 0.10}       # the wet coat on all cut fruit


def mat_mango():
    m, nt = new_mat('mango')
    bump, nz, tc = noise_bump(nt, 70.0, 0.25, detail=4.0, distance=0.0005)
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 9.0)   # fibres
    nt.link(tc.outputs['Object'], mp.inputs['Vector'])
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    oi = nt.n('ShaderNodeObjectInfo')
    # #FFA41B vivid mango (linear 1.0 / 0.37 / 0.011), a little variation per cube
    col = ramp(nt, oi.outputs['Random'], [(0.0, (1.0, 0.31, 0.008)), (1.0, (1.0, 0.42, 0.016))])
    p = principled(nt, **{'Roughness': 0.2, 'Subsurface Weight': 0.55,
                          'Subsurface Radius': (1.0, 0.5, 0.12), 'Subsurface Scale': 0.004,
                          'sss_method': 'BURLEY', **WET})
    nt.link(col.outputs['Color'], p.inputs['Base Color'])
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_strawberry_skin():
    m, nt = new_mat('strawberry_skin')
    tc = nt.n('ShaderNodeTexCoord')
    vor = nt.n('ShaderNodeTexVoronoi', Scale=9.0)
    nt.link(tc.outputs['Object'], vor.inputs['Vector'])
    seeds = math_node(nt, 'LESS_THAN', vor.outputs['Distance'], 0.16)
    bump = nt.n('ShaderNodeBump', Strength=0.6, Distance=0.0008)
    nt.link(math_node(nt, 'SUBTRACT', 1.0, seeds), bump.inputs['Height'])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', A=rgba((0.72, 0.015, 0.022)), B=rgba((0.85, 0.55, 0.12)))
    nt.link(seeds, mixc.inputs['Factor'])
    p = principled(nt, **{'Roughness': 0.2, 'Subsurface Weight': 0.35,
                          'Subsurface Radius': (1.0, 0.2, 0.15), 'Subsurface Scale': 0.003,
                          'sss_method': 'BURLEY', 'Coat Weight': 0.55, 'Coat Roughness': 0.06})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_strawberry_flesh():
    """Cut face of a halved strawberry (the plane contains the fruit axis = local z, tip at z=-0.5): a pale
    pith core along the axis, pink-to-red flesh crossed by fine pale strands, and a deep red rim."""
    m, nt = new_mat('strawberry_flesh')
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])
    rr = math_node(nt, 'SQRT', math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', sep.outputs[0], sep.outputs[0]),
                                          math_node(nt, 'MULTIPLY', sep.outputs[1], sep.outputs[1])))
    zz = sep.outputs[2]
    zn = math_node(nt, 'ADD', zz, 0.5)
    wid = math_node(nt, 'MULTIPLY', math_node(nt, 'POWER', math_node(nt, 'SINE', math_node(
        nt, 'MULTIPLY', math_node(nt, 'MINIMUM', math_node(nt, 'MULTIPLY', zn, 0.92), 1.0), math.pi), clamp=True),
        0.75), math_node(nt, 'ADD', 0.345, math_node(nt, 'MULTIPLY', zn, 0.115)))
    q = math_node(nt, 'DIVIDE', rr, math_node(nt, 'MAXIMUM', wid, 0.04), clamp=True)
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.2, 1.2, 16.0)
    nt.link(tc.outputs['Object'], mp.inputs['Vector'])
    nz = nt.n('ShaderNodeTexNoise', Scale=4.0, Detail=4.0, Roughness=0.6)
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    strand = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', nz.outputs['Fac'], 0.60),
                       math_node(nt, 'SUBTRACT', 1.0, math_node(nt, 'POWER', q, 1.6)))
    nz2 = nt.n('ShaderNodeTexNoise', Scale=9.0, Detail=2.0)
    nt.link(tc.outputs['Object'], nz2.inputs['Vector'])
    qj = math_node(nt, 'ADD', q, math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz2.outputs['Fac'], 0.5), 0.16))
    col = ramp(nt, qj, [(0.0, (0.97, 0.80, 0.70)), (0.22, (0.95, 0.60, 0.52)), (0.42, (0.90, 0.14, 0.11)),
                        (0.78, (0.78, 0.025, 0.035)), (0.93, (0.55, 0.008, 0.02))])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.95, 0.55, 0.47)))
    nt.link(math_node(nt, 'MULTIPLY', strand, 0.75), mixc.inputs['Factor'])
    nt.link(col.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.14, 'Subsurface Weight': 0.55,
                          'Subsurface Radius': (1.0, 0.22, 0.18), 'Subsurface Scale': 0.004,
                          'Coat Weight': 0.7, 'Coat Roughness': 0.05, 'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    bump = nt.n('ShaderNodeBump', Strength=0.15, Distance=0.0003)
    nt.link(nz.outputs['Fac'], bump.inputs['Height'])
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def radial_coords(nt):
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])
    r = math_node(nt, 'SQRT', math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', sep.outputs[0], sep.outputs[0]),
                                         math_node(nt, 'MULTIPLY', sep.outputs[1], sep.outputs[1])))
    ang = math_node(nt, 'ARCTAN2', sep.outputs[1], sep.outputs[0])
    return tc, sep, r, ang


def mat_kiwi():
    """Kiwi cross-section that reads as kiwi at phone size: creamy-white core with rays, a clear ring of
    black seeds, vivid green flesh, thin brown skin edge."""
    m, nt = new_mat('kiwi')
    tc, sep, r, ang = radial_coords(nt)
    comb = nt.n('ShaderNodeCombineXYZ')
    nt.link(math_node(nt, 'MULTIPLY', ang, 5.5), comb.inputs[0])
    nt.link(math_node(nt, 'MULTIPLY', r, 7.0), comb.inputs[1])
    vor = nt.n('ShaderNodeTexVoronoi', Scale=1.0, Randomness=0.7)
    nt.link(comb.outputs[0], vor.inputs['Vector'])
    ring = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', r, 0.25), math_node(nt, 'LESS_THAN', r, 0.44))
    seed = math_node(nt, 'MULTIPLY', ring, math_node(nt, 'LESS_THAN', vor.outputs['Distance'], 0.30))
    nz = nt.n('ShaderNodeTexNoise', Scale=1.0, Detail=2.0)
    comb2 = nt.n('ShaderNodeCombineXYZ')
    nt.link(math_node(nt, 'MULTIPLY', ang, 14.0), comb2.inputs[0])
    nt.link(math_node(nt, 'MULTIPLY', r, 1.5), comb2.inputs[1])
    nt.link(comb2.outputs[0], nz.inputs['Vector'])
    f = math_node(nt, 'ADD', r, math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs['Fac'], 0.5), 0.10))
    flesh = ramp(nt, f, [(0.0, (0.93, 0.92, 0.78)), (0.19, (0.90, 0.90, 0.70)), (0.27, (0.50, 0.72, 0.10)),
                         (0.34, (0.30, 0.66, 0.03)), (0.80, (0.20, 0.55, 0.015)), (0.93, (0.15, 0.42, 0.012)),
                         (0.965, (0.20, 0.11, 0.03))])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.010, 0.008, 0.005)))
    nt.link(seed, mixc.inputs['Factor'])
    nt.link(flesh.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.18, 'Subsurface Weight': 0.5,
                          'Subsurface Radius': (0.5, 1.0, 0.25), 'Subsurface Scale': 0.003,
                          'sss_method': 'BURLEY', **WET})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_banana():
    m, nt = new_mat('banana')
    tc, sep, r, ang = radial_coords(nt)
    flesh = ramp(nt, r, [(0.0, (0.80, 0.66, 0.32)), (0.25, (0.92, 0.80, 0.44)), (0.9, (0.94, 0.82, 0.48)),
                         (1.0, (0.87, 0.72, 0.35))])
    p = principled(nt, **{'Roughness': 0.28, 'Subsurface Weight': 0.6,
                          'Subsurface Radius': (1.0, 0.8, 0.45), 'Subsurface Scale': 0.003,
                          'sss_method': 'BURLEY', **WET})
    nt.link(flesh.outputs['Color'], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_pistachio():
    """Vivid chopped pistachio: bright green kernels with purple-brown skin flecks."""
    m, nt = new_mat('pistachio')
    oi = nt.n('ShaderNodeObjectInfo')
    tc = nt.n('ShaderNodeTexCoord')
    nz = nt.n('ShaderNodeTexNoise', Scale=2.2, Detail=1.0)
    nt.link(tc.outputs['Object'], nz.inputs['Vector'])
    green = ramp(nt, oi.outputs['Random'], [(0.0, (0.05, 0.36, 0.006)), (0.45, (0.11, 0.50, 0.012)),
                                            (0.8, (0.22, 0.58, 0.03)), (1.0, (0.40, 0.60, 0.07))])
    skin = math_node(nt, 'GREATER_THAN', nz.outputs['Fac'], 0.56)
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.30, 0.06, 0.10)))
    nt.link(math_node(nt, 'MULTIPLY', skin, 0.9), mixc.inputs['Factor'])
    nt.link(green.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.45, 'Subsurface Weight': 0.15,
                          'Subsurface Radius': (0.6, 1.0, 0.3), 'Subsurface Scale': 0.0006,
                          'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_sticker(img_path, glow):
    """Printed sticker. A share of self-light fed from the print itself so the face renders at the same level
    as the set glow -> after the brand lock it measures #01E8D5 with a clean white Q (not a dull teal)."""
    m, nt = new_mat('sticker')
    tex = nt.n('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img_path)
    tex.interpolation = 'Cubic'
    tc = nt.n('ShaderNodeTexCoord')
    nt.link(tc.outputs['UV'], tex.inputs['Vector'])
    p = principled(nt, **{'Roughness': 0.32, 'Coat Weight': 0.6, 'Coat Roughness': 0.08,
                          'Specular IOR Level': 0.5})
    nt.link(tex.outputs['Color'], p.inputs['Base Color'])
    nt.link(tex.outputs['Color'], p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = glow
    output(nt, p)
    return m


def mat_steel():
    m, nt = new_mat('steel')
    bump, nz, tc = noise_bump(nt, 900.0, 0.02, detail=2.0, distance=0.0002)
    p = principled(nt, **{'Base Color': (0.93, 0.93, 0.94), 'Metallic': 1.0, 'Roughness': 0.09,
                          'Anisotropic': 0.2})
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_backdrop(albedo, emit, bounce=0.3, lit=0.3):
    """Seamless paper in brand turquoise: a constant brand-colour glow (emit) + a fraction (lit) of real
    diffuse shading, so the colour is locked while the cup still casts a soft shadow; toned-down bounce."""
    m, nt = new_mat('backdrop')
    d = nt.n('ShaderNodeBsdfDiffuse', Color=rgba(tuple(c * lit for c in albedo)), Roughness=0.0)
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])

    def mrange(v, a, b, lo, hi):
        r = nt.n('ShaderNodeMapRange', _interpolation_type='SMOOTHSTEP')
        nt.link(v, r.inputs['Value'])
        for k, val in (('From Min', a), ('From Max', b), ('To Min', lo), ('To Max', hi)):
            r.inputs[k].default_value = val
        return r.outputs['Result']
    g_y = mrange(sep.outputs[1], -0.22, 0.30, 1.0 - SET_FALLOFF[0], 1.0)
    g_x = mrange(math_node(nt, 'ABSOLUTE', sep.outputs[0]), 0.06, 0.40, 1.0, 1.0 - SET_FALLOFF[1])
    ao = nt.n('ShaderNodeAmbientOcclusion', Distance=SET_AO[0])
    ao.samples = 8
    ao_f = math_node(nt, 'SUBTRACT', 1.0, math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', 1.0, ao.outputs['AO']),
                                                    SET_AO[1]))
    strength = math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', math_node(nt, 'MULTIPLY', g_y, g_x), ao_f), emit)
    em = nt.n('ShaderNodeEmission', Color=rgba(albedo))
    nt.link(strength, em.inputs['Strength'])
    add = nt.n('ShaderNodeAddShader')
    nt.link(d.outputs[0], add.inputs[0])
    nt.link(em.outputs[0], add.inputs[1])
    luma = 0.2126 * albedo[0] + 0.7152 * albedo[1] + 0.0722 * albedo[2]
    bl = tuple(0.7 * (bounce * c + (1 - bounce) * 0.35 * luma) for c in albedo)
    d2 = nt.n('ShaderNodeBsdfDiffuse', Color=rgba(bl), Roughness=0.0)
    lp = nt.n('ShaderNodeLightPath')
    mix = nt.n('ShaderNodeMixShader')
    nt.link(lp.outputs['Is Diffuse Ray'], mix.inputs[0])
    nt.link(add.outputs[0], mix.inputs[1])
    nt.link(d2.outputs[0], mix.inputs[2])
    gl = tuple(0.45 * (0.5 * c + 0.5 * luma) for c in albedo)
    em2 = nt.n('ShaderNodeEmission', Color=rgba(gl), Strength=emit)
    mix2 = nt.n('ShaderNodeMixShader')
    nt.link(lp.outputs['Is Glossy Ray'], mix2.inputs[0])
    nt.link(mix.outputs[0], mix2.inputs[1])
    nt.link(em2.outputs[0], mix2.inputs[2])
    output(nt, mix2)
    return m


# ------------------------------------------------------------------------------------------------
# geometry builders: cup, contents, sticker, condensation
# ------------------------------------------------------------------------------------------------
def build_cup(mat, seg=224):
    """Closed PET cup solid (outer wall, rolled rim bead, inner wall, floor with foot ring)."""
    prof = []
    prof += [(0.0, 0.0016), (R_BOT - 0.0075, 0.0016), (R_BOT - 0.0045, 0.0006), (R_BOT - 0.0028, 0.0)]
    for i in range(1, 6):
        a = -math.pi / 2 + (math.pi / 2) * i / 5
        prof.append((R_BOT - 0.0028 + 0.0028 * math.cos(a) * 1.0, 0.0028 + 0.0028 * math.sin(a)))
    zs = np.linspace(0.0035, CUP_H - 0.0020, 28)
    prof += [(float(r_out(z)), float(z)) for z in zs]
    cx, cz, rb = float(R_TOP) + 0.0003, CUP_H - 0.0001, 0.00135
    for i in range(0, 17):
        a = math.radians(-70 + (250 + 70) * i / 16)
        prof.append((cx + rb * math.cos(a), cz + rb * math.sin(a)))
    zs = np.linspace(CUP_H - 0.0022, BASE_T + 0.0025, 28)
    prof += [(float(r_in(z)), float(z)) for z in zs]
    zf = BASE_T + 0.0025
    cxf = float(r_in(zf)) - 0.0025
    for i in range(1, 6):
        a = -(math.pi / 2) * i / 5
        prof.append((cxf + 0.0025 * math.cos(a), zf + 0.0025 * math.sin(a)))
    prof += [(cxf - 0.004, BASE_T), (0.0, BASE_T)]
    v, f = lathe(prof, seg)
    ob = mesh_obj('cup', v, f, mat)
    recalc_normals(ob)
    return ob


def build_core(mat, seg=160, nz=90):
    """Contents core: qashta bands pressed against the wall, fruit layers recessed (tinted)."""
    rng = np.random.default_rng(11)
    ph = rng.uniform(0, 6.28, 8)

    def boundary(z0, th, amp=0.0022):
        return z0 + amp * (0.6 * np.sin(2 * th + ph[0]) + 0.3 * np.sin(5 * th + ph[1]) + 0.2 * np.sin(9 * th + ph[2]))

    th = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    zs = np.linspace(BASE_T + 0.0004, CUP_H - 0.0030, nz)
    T, Z = np.meshgrid(th, zs)
    fruit = np.zeros_like(Z)
    for (za, zb) in FRUIT_LAYERS:
        a = boundary(za, T) if za > 0.01 else za
        b = boundary(zb, T + 1.3)
        fruit = np.maximum(fruit, smoothstep(a - 0.0012, a + 0.0012, Z) * (1 - smoothstep(b - 0.0012, b + 0.0012, Z)))
    gap = 0.00025 + 0.0036 * fruit
    R = r_in(Z) - gap
    X, Y = R * np.cos(T), R * np.sin(T)
    verts = np.stack([X, Y, Z], -1).reshape(-1, 3).tolist()
    faces = []
    for i in range(nz - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    c0 = len(verts)
    verts.append((0, 0, zs[0]))
    c1 = len(verts)
    verts.append((0, 0, zs[-1]))
    faces += [(c0, (j + 1) % seg, j) for j in range(seg)]
    top = (nz - 1) * seg
    faces += [(c1, top + j, top + (j + 1) % seg) for j in range(seg)]
    ob = mesh_obj('core', verts, faces, mat)
    me = ob.data
    attr = me.color_attributes.new('fruitmask', 'FLOAT_COLOR', 'POINT')
    fm = np.concatenate([fruit.ravel(), [1.0, 0.0]])
    cols = np.repeat(fm[:, None], 4, 1)
    cols[:, 3] = 1
    attr.data.foreach_set('color', cols.astype(np.float32).ravel())
    recalc_normals(ob)
    return ob, (lambda z, t: boundary(z, t))


def mat_smear():
    """Qashta smeared on the inside of the PET over the fruit (streaky, partial, translucent at the edges)."""
    m, nt = new_mat('smear')
    tc = nt.n('ShaderNodeTexCoord')
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 0.45)
    nt.link(tc.outputs['Object'], mp.inputs['Vector'])
    nz = nt.n('ShaderNodeTexNoise', Scale=48.0, Detail=1.5, Roughness=0.45)
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    attr = nt.n('ShaderNodeAttribute', _attribute_name='edge')
    th = math_node(nt, 'SUBTRACT', 0.68, math_node(nt, 'MULTIPLY', attr.outputs['Fac'], 0.11))
    cov = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs['Fac'], th), 7.0, clamp=True)
    cov = math_node(nt, 'MULTIPLY', math_node(nt, 'POWER', cov, 0.6), 0.85)
    p = principled(nt, **{'Base Color': QASHTA[1], 'Roughness': 0.3, 'Subsurface Weight': 1.0,
                          'Subsurface Radius': (1.0, 0.92, 0.78), 'Subsurface Scale': 0.0012,
                          'Emission Color': rgba(QASHTA[1]), 'Emission Strength': 0.12, 'sss_method': 'BURLEY'})
    tr = nt.n('ShaderNodeBsdfTransparent')
    mix = nt.n('ShaderNodeMixShader')
    nt.link(cov, mix.inputs[0])
    nt.link(tr.outputs[0], mix.inputs[1])
    nt.link(p.outputs[0], mix.inputs[2])
    output(nt, mix)
    return m


def build_smear(mat, band_fn, seg=192, nz=70):
    th = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    zs = np.linspace(FRUIT_LAYERS[0][0] + 0.001, FRUIT_LAYERS[1][1] + 0.002, nz)
    T, Z = np.meshgrid(th, zs)
    R = r_in(Z) - 0.00012
    verts = np.stack([R * np.cos(T), R * np.sin(T), Z], -1).reshape(-1, 3).tolist()
    faces = []
    for i in range(nz - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    ob = mesh_obj('smear', verts, faces, mat)
    d = np.full(Z.shape, 1.0)
    for li, (za, zb) in enumerate(FRUIT_LAYERS):
        for zz, off in ((za, 0.0), (zb, 1.3)):
            if zz < 0.01:
                continue
            d = np.minimum(d, np.abs(Z - band_fn(zz, T + off)))
    edge = np.exp(-(d / 0.005) ** 2).ravel()
    attr = ob.data.color_attributes.new('edge', 'FLOAT_COLOR', 'POINT')
    cols = np.repeat(edge[:, None], 4, 1)
    cols[:, 3] = 1
    attr.data.foreach_set('color', cols.astype(np.float32).ravel())
    return ob


def build_sticker(mat, rings=40, seg=96):
    """Circular decal wrapped on the conical outer wall."""
    verts, uvs = [(0.0, 0.0)], [(0.5, 0.5)]
    for i in range(1, rings + 1):
        rr = STICKER_R * i / rings
        for j in range(seg):
            a = 2 * math.pi * j / seg
            verts.append((rr * math.cos(a), rr * math.sin(a)))
            uvs.append((0.5 + 0.5 * math.cos(a) * i / rings, 0.5 + 0.5 * math.sin(a) * i / rings))
    faces = [(0, 1 + j, 1 + (j + 1) % seg) for j in range(seg)]
    for i in range(rings - 1):
        for j in range(seg):
            a = 1 + i * seg + j
            b = 1 + i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    slope = math.atan((R_TOP - R_BOT) / CUP_H)
    out = []
    for (u, v) in verts:
        z = STICKER_Z + v * math.cos(slope)
        r = float(r_out(z)) + 0.00018
        phi = STICKER_PHI + u / r
        out.append((r * math.cos(phi), r * math.sin(phi), z))
    ob = mesh_obj('sticker', out, faces, mat)
    me = ob.data
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            u, v = uvs[vi]
            uvl.data[li].uv = (u, v)
    recalc_normals(ob)
    return ob


def build_condensation(mat_w, mat_h, n=1100, haze=True):
    """Cold cue: fine water beads on the PET (denser low on the cup, none on the sticker, only on the side
    that can be seen), plus an optional whisper of mist (a shell just outside the wall)."""
    rng = np.random.default_rng(zlib.crc32(b'condensation'))
    # unit cap template: spherical cap of base radius 1 and height hh (set per bead)
    nseg, nr = 9, 3
    beads_v, beads_f = [], []
    slope = (R_TOP - R_BOT) / CUP_H
    placed = 0
    tries = 0
    while placed < n and tries < n * 6:
        tries += 1
        phi = math.radians(-90 + rng.uniform(-125, 125))
        z = CUP_H * (1 - math.sqrt(rng.uniform(0.0, 1.0))) * 0.94 + 0.004      # denser low on the cup
        if z > CUP_H - 0.004:
            continue
        # keep the sticker clean
        rz = float(r_out(z))
        du = (phi - STICKER_PHI) * rz
        dv = (z - STICKER_Z)
        if du * du + dv * dv < (STICKER_R + 0.0012) ** 2:
            continue
        u = rng.uniform()
        rb = (rng.uniform(0.00012, 0.00030) if u < 0.72 else rng.uniform(0.00030, 0.00065) if u < 0.96
              else rng.uniform(0.00065, 0.0011))
        hh = rb * rng.uniform(0.45, 0.65)
        nrm = np.array([math.cos(phi), math.sin(phi), -slope])
        nrm /= np.linalg.norm(nrm)
        t1 = np.array([-math.sin(phi), math.cos(phi), 0.0])
        t2 = np.cross(nrm, t1)
        c = np.array([rz * math.cos(phi), rz * math.sin(phi), z]) - nrm * 0.00002
        Rs = (rb * rb + hh * hh) / (2 * hh)
        a_max = math.asin(min(1.0, rb / Rs))
        base = len(beads_v)
        beads_v.append(c + nrm * hh)
        for i in range(1, nr + 1):
            a = a_max * i / nr
            for j in range(nseg):
                b = 2 * math.pi * j / nseg
                p = (Rs * math.sin(a)) * (math.cos(b) * t1 + math.sin(b) * t2) + nrm * (hh - Rs * (1 - math.cos(a)))
                beads_v.append(c + p)
        beads_v.append(c - nrm * 0.00001)
        rings = [[base]] + [list(range(base + 1 + (i - 1) * nseg, base + 1 + i * nseg)) for i in range(1, nr + 1)]
        rings.append([base + 1 + nr * nseg])
        beads_f += ring_faces(rings, nseg)
        placed += 1
    ob = mesh_obj('beads', beads_v, beads_f, mat_w)
    recalc_normals(ob)
    hz = None
    if haze:
        prof = [(float(r_out(z)) + 0.00006, float(z)) for z in np.linspace(0.004, CUP_H - 0.006, 40)]
        v, f = lathe(prof, 160)
        hz = mesh_obj('haze', v, f, mat_h)
    print(f'[cup] condensation: {placed} beads', flush=True)
    return ob, hz


class Dome:
    """Polar-grid mesh: height field top (phi 0..90deg), overhanging lip (90..PHI_MAX), tuck + skirt.
    Per frame: vertex z from Surf + the 'fresh' (drop cream) attribute for the material."""

    def __init__(self, mat, nphi=150, ns=320):
        self.ns = ns
        th = np.linspace(0, 2 * np.pi, ns, endpoint=False)
        phis = np.linspace(0, math.pi / 2, nphi)[1:]
        P, T = np.meshgrid(phis, th, indexing='ij')
        rr = DOME_RX * np.sin(P)
        self.x = np.concatenate([[0.0], (rr * np.cos(T)).ravel()])
        self.y = np.concatenate([[0.0], (rr * np.sin(T)).ravel()])
        ring_rz = []
        for ph in np.linspace(math.pi / 2, DOME_PHI_MAX, 6)[1:]:
            ring_rz.append((DOME_RX * math.sin(ph), DOME_ZC + DOME_HZ * math.cos(ph)))
        r_last, z_last = ring_rz[-1]
        for k in range(1, 5):
            u = k / 4
            ring_rz.append((r_last + (float(r_in(CUP_H)) - 0.0004 - r_last) * u,
                            z_last - 0.0011 * math.sin(u * math.pi / 2)))
        ring_rz.append((float(r_in(CUP_H)) - 0.0004, CUP_H - 0.010))
        lip = []
        for (r, z) in ring_rz:
            lip += [(r * math.cos(a), r * math.sin(a), z) for a in th]
        self.lip = np.array(lip)
        nrings = len(phis) + len(ring_rz)
        faces = [(0, 1 + j, 1 + (j + 1) % ns) for j in range(ns)]
        for i in range(nrings - 1):
            for j in range(ns):
                a = 1 + i * ns + j
                b = 1 + i * ns + (j + 1) % ns
                faces.append((a, a + ns, b + ns, b))
        self.ob = mesh_obj('dome', self.coords(Surf(-1))[0], faces, mat)
        recalc_normals(self.ob)
        self.attr = self.ob.data.color_attributes.new('fresh', 'FLOAT_COLOR', 'POINT')

    def coords(self, surf):
        z, fresh, torn = surf.parts(self.x, self.y)
        top = np.stack([self.x, self.y, z], -1)
        return np.concatenate([top, self.lip]), np.concatenate([fresh, np.zeros(len(self.lip))])

    def update(self, surf):
        co, fresh = self.coords(surf)
        set_verts(self.ob, co)
        cols = np.repeat(fresh[:, None], 4, 1)
        cols[:, 3] = 1
        self.attr.data.foreach_set('color', cols.astype(np.float32).ravel())
        self.ob.data.update()


# ------------------------------------------------------------------------------------------------
# fruit (behind the wall) + hero garnish (on the dome)
# ------------------------------------------------------------------------------------------------
def rounded_cube_mesh(name, bev=0.2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bev, segments=3, affect='EDGES', profile=0.5)
    rng = np.random.default_rng(zlib.crc32(name.encode()) % 1000)
    for v in bm.verts:
        v.co += Vector(rng.normal(0, 0.018, 3))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def disc_mesh(name, depth, seg=48, half=False, bev=0.12):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1.0, radius2=1.0, depth=depth)
    if half:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, -0.05, 0), plane_no=(0, 1, 0), clear_inner=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.contextual_create(bm, geom=edges)
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.calc_face_angle(0) > 0.6], offset=bev * depth,
                    segments=3, affect='EDGES', profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def strawberry_mesh(name, quarter=False):
    prof = []
    for i in range(0, 25):
        s = i / 24.0
        r = 0.46 * math.sin(math.pi * min(1.0, s * 0.92) ** 0.85) ** 0.75 * (0.75 + 0.25 * s)
        if s >= 0.999:
            r = 0.0
        prof.append((max(r, 0.0), s - 0.5))
    prof[0] = (0.0, prof[0][1])
    v, f = lathe(prof, 36)
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    for pl in ([(1, 0, 0)] + ([(0, 1, 0)] if quarter else [])):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=pl, clear_inner=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        out = bmesh.ops.contextual_create(bm, geom=edges)
        for fc in out['faces']:
            fc.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def chunk_mesh(name, seed, flat=0.6):
    """Chopped-nut shard: coarse icosphere, jittered, with two knife facets, flat shaded."""
    rng = np.random.default_rng(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    cuts = [Vector(rng.normal(0, 1, 3)).normalized() for _ in range(2)]
    offs = rng.uniform(0.25, 0.55, 2)
    for v in bm.verts:
        v.co = v.co.normalized() * (1.0 + rng.normal(0, 0.10))
        v.co.z *= flat
        for c, o in zip(cuts, offs):
            dd = v.co.dot(c)
            if dd > o:
                v.co -= c * (dd - o) * 0.9
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def place_on_wall(ob, theta, zc, gap=0.00035):
    """Push a fruit piece (already rotated/scaled) radially so its outermost point touches the wall."""
    co = get_verts(ob.data)
    M = np.array(ob.matrix_basis)[:3, :3]
    local = co @ M.T
    d = np.array([math.cos(theta), math.sin(theta), 0.0])
    best = 0.0
    for _ in range(3):
        c = d * best + np.array([0, 0, zc])
        wp = local + c
        rv = np.sqrt(wp[:, 0] ** 2 + wp[:, 1] ** 2)
        over = rv - r_in(wp[:, 2]) + gap
        best -= over.max()
        if abs(over.max()) < 1e-6:
            break
    ob.location = (d[0] * best, d[1] * best, zc)


def fruit_meshes(mats):
    meshes = {
        'mango': [rounded_cube_mesh(f'mango{i}', 0.16 + 0.04 * i) for i in range(3)],
        'straw_half': [strawberry_mesh('straw_half')],
        'kiwi': [disc_mesh('kiwi', 0.26)],
        'kiwi_half': [disc_mesh('kiwi_half', 0.26, half=True)],
        'banana': [disc_mesh('banana', 0.42, bev=0.2)],
    }
    for me in meshes['straw_half']:
        me.materials.append(mats['straw_skin'])
        me.materials.append(mats['straw_flesh'])
    for me in meshes['mango']:
        me.materials.append(mats['mango'])
    for k in ('kiwi', 'kiwi_half'):
        meshes[k][0].materials.append(mats['kiwi'])
    meshes['banana'][0].materials.append(mats['banana'])
    return meshes


def build_fruit(meshes, coll):
    """Fewer, larger, juicier pieces (~1.3x v1): strawberry halves (mostly cut face out), vivid mango cubes,
    kiwi with seed ring + white core; each tilted so it is not pasted flat on the wall; no banana in the
    front rows (a few recessed in the back row only)."""
    rng = np.random.default_rng(zlib.crc32(b'fruit-v2'))
    front = ['straw_half', 'mango', 'kiwi_half', 'mango', 'straw_half', 'kiwi', 'mango', 'straw_half',
             'mango', 'kiwi_half', 'straw_half', 'mango']
    back = ['mango', 'straw_half', 'banana', 'mango', 'kiwi_half', 'straw_half', 'mango', 'banana', 'kiwi']
    size_of = {'straw_half': 0.0200, 'mango': 0.0205, 'kiwi': 0.0158, 'kiwi_half': 0.0170, 'banana': 0.0120}
    plan = []
    k = 0
    for li, (za, zb) in enumerate(FRUIT_LAYERS):
        hgt = zb - za
        n = 10
        for j in range(n):
            deg = -180 + 360 * (j + 0.37 * li) / n + rng.normal(0, 4)
            kind = front[k % len(front)]
            k += 1
            zc = za + hgt * (0.5 + rng.normal(0, 0.08))
            plan.append((kind, deg, zc, size_of[kind] * rng.uniform(0.9, 1.08), None))
        for j in range(n):                                  # fillers in the gaps, a touch smaller + recessed
            deg = -180 + 360 * (j + 0.5 + 0.37 * li) / n + rng.normal(0, 5)
            kind = front[(k + 3) % len(front)]
            k += 1
            zc = za + hgt * (0.26 if j % 2 else 0.76) + rng.normal(0, 0.0012)
            plan.append((kind, deg, zc, size_of[kind] * rng.uniform(0.72, 0.86), 0.0012))
        for j in range(9):                                  # back row: shaded depth behind the front pieces
            deg = -180 + 360 * (j + 0.25 + 0.3 * li) / 9 + rng.normal(0, 6)
            kind = back[(j + li * 4) % len(back)]
            zc = za + hgt * rng.uniform(0.3, 0.72)
            plan.append((kind, deg, zc, size_of[kind] * rng.uniform(0.8, 0.95), 0.0050))
    obs = []
    for (kind, deg, zc, size, gap_back) in plan:
        th = math.radians(deg)
        mesh_list = meshes[kind]
        me = mesh_list[rng.integers(len(mesh_list))]
        ob = bpy.data.objects.new(kind, me)
        coll.objects.link(ob)
        d = Vector((math.cos(th), math.sin(th), 0))
        if kind in ('kiwi', 'kiwi_half', 'banana'):
            q = d.to_track_quat('Z', 'Y')
            roll = Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z') if kind != 'kiwi_half' else \
                Matrix.Rotation(math.radians(rng.choice([0, 180]) + rng.normal(0, 25)), 4, 'Z')
            tilt = Matrix.Rotation(math.radians(rng.normal(0, 14)), 4, 'X') @ \
                Matrix.Rotation(math.radians(rng.normal(0, 10)), 4, 'Y')
            ob.matrix_basis = q.to_matrix().to_4x4() @ tilt @ roll
            ob.scale = (size, size, size)
        elif kind.startswith('straw'):
            cut_out = rng.random() < 0.72
            q = (-d if cut_out else d).to_track_quat('X', 'Z')
            spin = Matrix.Rotation(rng.uniform(0, 6.28), 4, 'X')
            tilt = Matrix.Rotation(math.radians(rng.normal(0, 14)), 4, 'Z')
            ob.matrix_basis = q.to_matrix().to_4x4() @ tilt @ spin
            ob.scale = (size * 1.38, size * 1.38, size * 1.38)
        else:
            ob.rotation_euler = Euler(rng.uniform(-0.7, 0.7, 3).tolist(), 'XYZ')
            s = size * rng.uniform(0.88, 1.12, 3)
            ob.scale = tuple(s.tolist())
        bpy.context.view_layer.update()
        gp = 0.0003 if rng.random() < 0.7 else 0.0012
        place_on_wall(ob, th, zc, gap=gap_back if gap_back else gp)
        obs.append(ob)
    return obs


GARNISH = [  # kind, x, y, size, yaw (deg), sink (fraction of size into the cream)
    ('straw_half', -0.0215, 0.0200, 0.0155, -8.0, 0.30),
    ('mango', -0.0325, 0.0010, 0.0088, 20.0, 0.30),
    ('mango', -0.0045, 0.0290, 0.0082, -35.0, 0.30),
    ('mango', -0.0300, -0.0170, 0.0078, 50.0, 0.35),
]


class Garnish:
    """Hero garnish on the dome: a strawberry half standing with its cut face to camera, mango cubes."""

    def __init__(self, meshes, coll):
        self.items = []
        rng = np.random.default_rng(zlib.crc32(b'garnish'))
        for (kind, x, y, size, yaw, sink) in GARNISH:
            ob = bpy.data.objects.new('garnish_' + kind, meshes[kind][0 if kind != 'mango' else len(self.items) % 3])
            coll.objects.link(ob)
            ob.rotation_mode = 'XYZ'
            if kind == 'straw_half':
                # cut face (local +X side removed -> the flat face at x=0 looks towards -X): face the camera
                # (-Y) and a little up, tip up and leaning back
                q = Vector((0.10, 0.90, -0.42)).to_track_quat('X', 'Z')
                R = q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(170), 4, 'X')
                sc = size * 1.38
                ob.matrix_basis = R
                ob.scale = (sc, sc, sc)
            else:
                ob.rotation_euler = (rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), math.radians(yaw))
                ob.scale = tuple((size * rng.uniform(0.9, 1.1, 3)).tolist())
            self.items.append((ob, x, y, size, sink, np.array(ob.matrix_basis)))

    def update(self, surf):
        for (ob, x, y, size, sink, _) in self.items:
            z = float(surf.z(x, y))
            ob.location = (x, y, z + size * (0.5 - sink) * (0.8 if ob.name.startswith('garnish_straw') else 1.0))


class Pistachios:
    """A generous vivid pistachio crown: chunks on the back/top of the dome + dust, clear of the two dots,
    the scoop crater, the honey and the garnish."""

    def __init__(self, mat, coll, avoid_fn, n_clusters=38, n_dust=45):
        rng = np.random.default_rng(zlib.crc32(b'pistachio-crown'))
        self.meshes = [chunk_mesh(f'pist{i}', 100 + i) for i in range(10)]
        for me in self.meshes:
            me.materials.append(mat)
        xs, ys, sz, ob_l = [], [], [], []

        def put(x, y, size):
            if avoid_fn(x, y) or math.hypot(x, y) > DOME_R * 0.9:
                return False
            if any((x - px) ** 2 + (y - py) ** 2 < (0.55 * (size + ps)) ** 2 for px, py, ps in zip(xs, ys, sz)):
                return False
            ob = bpy.data.objects.new('pistachio', self.meshes[rng.integers(len(self.meshes))])
            coll.objects.link(ob)
            ob.scale = (size, size * rng.uniform(0.6, 1.0), size)
            ob.rotation_mode = 'XYZ'
            xs.append(x)
            ys.append(y)
            sz.append(size)
            ob_l.append((ob, rng.uniform(0, 6.28), rng.normal(0, 0.5), rng.normal(0, 0.5)))
            return True
        # the crown: clusters of chopped pieces along a band over the back/top of the dome (behind the dots,
        # around the garnish), a few clusters on the flanks; the front stays clean for the dots + honey
        centres = []
        for i in range(n_clusters):
            th = math.radians(rng.uniform(-25, 205))
            r = DOME_R * rng.uniform(0.30, 0.82)
            centres.append((r * math.cos(th), r * math.sin(th)))
        for (cx, cy) in centres:
            for _ in range(int(rng.integers(3, 8))):
                put(cx + rng.normal(0, 0.0032), cy + rng.normal(0, 0.0032), rng.uniform(0.0017, 0.0033))
        for _ in range(n_dust * 4):
            if sum(1 for q in sz if q < 0.001) >= n_dust:
                break
            cx, cy = centres[int(rng.integers(len(centres)))]
            put(cx + rng.normal(0, 0.005), cy + rng.normal(0, 0.005), rng.uniform(0.0005, 0.0009))
        self.x, self.y, self.size = np.array(xs), np.array(ys), np.array(sz)
        self.obs = ob_l
        print(f'[cup] pistachios: {len(xs)}', flush=True)

    def update(self, surf):
        z = surf.z(self.x, self.y)
        n = surf.normal(self.x, self.y)
        for i, (ob, rz, rx, ry) in enumerate(self.obs):
            q = Vector(n[i].tolist()).to_track_quat('Z', 'Y')
            ob.rotation_euler = (q.to_matrix().to_4x4() @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X')
                                 @ Matrix.Rotation(ry, 4, 'Y')).to_euler('XYZ')
            s = self.size[i]
            ob.location = (self.x[i] + n[i][0] * s * 0.2, self.y[i] + n[i][1] * s * 0.2, z[i] + n[i][2] * s * 0.22)


# ------------------------------------------------------------------------------------------------
# honey: a glossy ribbon that runs between and in front of the dots, keeps slowly running, and ends
# as a hanging bead on the dome lip (never down the cup wall)
# ------------------------------------------------------------------------------------------------
HONEY_XY = [(-0.0010, 0.0300), (-0.0062, 0.0215), (-0.0074, 0.0110), (-0.0068, 0.0000), (-0.0062, -0.0110),
            (-0.0060, -0.0215), (-0.0072, -0.0300), (-0.0118, -0.0352)]
HONEY_POOLS = [0.018, 0.036, 0.058]     # arc positions (m) where it pools wider
HONEY_FRONT0 = (-0.0066, -0.0260)       # where the flowing front is at local frame 0 (between the dot tails)
HONEY_V = 0.0095                        # the front creeps ~9.5 mm/s -> over the lip ~3.4 s, bead grows


class Honey:
    def __init__(self, mat, mat_body, coll):
        me = bpy.data.meshes.new('honey')
        self.ob = bpy.data.objects.new('honey', me)
        coll.objects.link(self.ob)
        me.materials.append(mat)
        me2 = bpy.data.meshes.new('honey_bead')
        self.bead = bpy.data.objects.new('honey_bead', me2)
        coll.objects.link(self.bead)
        me2.materials.append(mat_body)
        xy = catmull(HONEY_XY, 16)
        dvec = np.array([math.cos(DRIP_PHI), math.sin(DRIP_PHI)])
        r_exit = DOME_RX * 0.90
        tgt = dvec * r_exit
        seg = np.linspace(0, 1, 10)[1:]
        xy = np.vstack([xy, xy[-1][None] + (tgt - xy[-1])[None] * seg[:, None]])
        self.xy, self.s = resample(xy, 0.0005)
        self.dvec = dvec
        self.L_dome = self.s[-1]
        # over the rounded lip of the mound (ellipse continued past the equator)
        ph0 = math.asin(0.90)
        lip = []
        for ph in np.linspace(ph0, DOME_PHI_MAX, 14)[1:]:
            rr = DOME_RX * math.sin(ph)
            zz = DOME_ZC + DOME_HZ * math.cos(ph)
            n = np.array([dvec[0] * math.sin(ph) / DOME_RX, dvec[1] * math.sin(ph) / DOME_RX, math.cos(ph) / DOME_HZ])
            lip.append((np.array([dvec[0] * rr, dvec[1] * rr, zz]), n / np.linalg.norm(n)))
        self.lip = lip
        self.L_lip = sum(np.linalg.norm(b[0] - a[0]) for a, b in zip(lip[:-1], lip[1:]))
        self.s0 = float(self.s[np.argmin(np.sum((self.xy - np.array(HONEY_FRONT0)) ** 2, axis=1))])

    def front(self, t):
        return self.s0 + HONEY_V * t

    def update(self, t, surf):
        sf = self.front(t)
        L = self.L_dome + self.L_lip
        sf_c = min(sf, L)
        keep = self.s <= min(sf_c, self.L_dome)
        xy = self.xy[keep]
        ss = self.s[keep]
        # honey levels itself: the ribbon follows the mound, not every ripple (running mean over ~5 mm)
        z = surf.z(xy[:, 0], xy[:, 1])
        k = 9
        zp = np.pad(z, (k, k), mode='edge')
        z = np.maximum(np.convolve(zp, np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k], z)
        nrm = surf.normal(xy[:, 0], xy[:, 1], e=0.0016)
        pts = np.stack([xy[:, 0], xy[:, 1], z], -1) + nrm * 0.00040
        if sf_c > self.L_dome:
            acc = self.L_dome
            for (p0, n0), (p1, n1) in zip(self.lip[:-1], self.lip[1:]):
                acc += np.linalg.norm(p1[0:3] - p0[0:3])
                if acc > sf_c:
                    break
                pts = np.vstack([pts, p1[None]])
                nrm = np.vstack([nrm, n1[None]])
                ss = np.append(ss, acc)
        n = len(pts)
        rng = np.random.default_rng(5)
        w = 0.0029 + 0.0005 * np.sin(ss * 420.0) + rng.normal(0, 0.00005, n)
        h = np.full(n, 0.00105)
        for pc in HONEY_POOLS:
            g = np.exp(-((ss - pc) / 0.0045) ** 2)
            w = w + 0.0016 * g
            h = h + 0.00035 * g
        w = w * (0.25 + 0.75 * smoothstep(0.0, 0.010, ss))           # thin tail where the pour started
        # the flowing front: a rounded bulb
        bulb = np.exp(-((sf_c - ss) / 0.0035) ** 2)
        w = w * (1 + 0.18 * bulb)
        h = h * (1 + 0.45 * bulb)
        on_lip = ss > self.L_dome
        w[on_lip] = np.minimum(w[on_lip], 0.0026)
        v, f = tube_mesh(pts, nrm, w, h, nsec=18, flat=0.22, cap=6)
        set_mesh(self.ob, v, f)
        # the hanging bead: grows once the front has rolled over the lip
        over = sf - L
        if over > 0:
            p_end, n_end = self.lip[-1]
            gr = min(1.0, over / 0.006)
            rb = 0.0012 + 0.0011 * gr
            hang = 0.0008 + 0.0026 * gr
            down = np.array([self.dvec[0] * 0.25, self.dvec[1] * 0.25, -1.0])
            down /= np.linalg.norm(down)
            path = [p_end - n_end * 0.0006 + down * hang * s for s in np.linspace(0, 1, 12)]
            ww = [0.0017 + (rb - 0.0017) * math.sin(0.5 * math.pi * s) ** 3 for s in np.linspace(0, 1, 12)]
            vb, fb = tube_mesh(np.array(path), [np.array([self.dvec[0], self.dvec[1], 0.0])] * 12,
                               np.array(ww), np.array(ww), nsec=16, flat=1.0, cap=4)
            set_mesh(self.bead, vb, fb)
            self.bead.hide_render = False
        else:
            self.bead.hide_render = True


# ------------------------------------------------------------------------------------------------
# the two qashta drops (the ق dots) — falling teardrops; on contact they hand over to the dome dollops
# ------------------------------------------------------------------------------------------------
DROP_RINGS, DROP_SEG = 34, 44
DROP_M = 0.62
DROP_W, DROP_HT = 0.0068, 0.0170     # falling drop: radius, height


def drop_profile(m, width, height):
    ts = np.linspace(0, math.pi, DROP_RINGS)
    r = width * np.sin(ts) * np.power(np.sin(ts / 2), m)
    z = height * 0.5 * np.cos(ts)
    return r, z


class Drop:
    FALL = 0.30          # seconds from entering (above the frame) to contact

    def __init__(self, name, mat, k, t_land, tilt):
        self.k, self.tl, self.tilt = k, t_land, tilt
        hx, hy = dots().head[k]
        self.ix, self.iy = float(hx), float(hy)
        self.ang = np.linspace(0, 2 * math.pi, DROP_SEG, endpoint=False)
        verts = [(0, 0, 0)] * (2 + (DROP_RINGS - 2) * DROP_SEG)
        faces = [(0, 1 + j, 1 + (j + 1) % DROP_SEG) for j in range(DROP_SEG)]
        for i in range(DROP_RINGS - 3):
            for j in range(DROP_SEG):
                a = 1 + i * DROP_SEG + j
                b = 1 + i * DROP_SEG + (j + 1) % DROP_SEG
                faces.append((a, a + DROP_SEG, b + DROP_SEG, b))
        last = 1 + (DROP_RINGS - 3) * DROP_SEG
        bot = len(verts) - 1
        for j in range(DROP_SEG):
            faces.append((last + j, bot, last + (j + 1) % DROP_SEG))
        self.ob = mesh_obj(name, verts, faces, mat)
        self.ob.rotation_mode = 'XYZ'
        self.set_shape(DROP_M, DROP_W, DROP_HT)
        recalc_normals(self.ob)

    def set_shape(self, m, width, height):
        r, z = drop_profile(m, width, height)
        co = [(0.0, 0.0, z[0])]
        for i in range(1, DROP_RINGS - 1):
            for a in self.ang:
                co.append((r[i] * math.cos(a), r[i] * math.sin(a), z[i]))
        co.append((0.0, 0.0, z[-1]))
        set_verts(self.ob, co)

    def state(self, t, surf):
        tl = self.tl
        zc = float(dome_base(self.ix, self.iy))
        if t <= tl:
            u = (t - (tl - self.FALL)) / self.FALL
            vis = u > -0.05
            u = max(u, -0.1)
            stretch = 1.0 + 0.10 * max(u, 0)
            zb_start, zb_contact = 0.215, zc - 0.0004
            sfall = 0.35 * u + 0.65 * u * u if u >= 0 else 0.35 * u
            zb = zb_start + (zb_contact - zb_start) * sfall
            wob_t = 0.05 * math.sin(t * 38 + self.tilt * 3)
            side = 0.002 * (1 - max(u, 0)) * math.copysign(1, self.tilt)
            return dict(loc=(self.ix - side, self.iy, zb + DROP_HT * stretch / 2),
                        rot=(wob_t, self.tilt * 0.3 * (1 - max(u, 0)), 0.0),
                        scale=(1 / math.sqrt(stretch), 1 / math.sqrt(stretch), stretch), visible=vis)
        tau = t - tl
        # contact: the teardrop squashes and sinks into the growing dollop within ~2 frames
        q = max(0.0, 1 - tau / 0.075)
        hf = 0.15 + 0.85 * q ** 1.5
        wf = 1 / math.sqrt(hf) * (1 + 0.25 * (1 - q))
        zb = zc - 0.0004 - 0.004 * (1 - q)
        return dict(loc=(self.ix, self.iy, zb + DROP_HT * hf / 2), rot=(0.0, 0.0, 0.0),
                    scale=(wf, wf, hf), visible=tau < 0.075)


class Splash:
    """A few tiny cream droplets thrown out at each impact (ballistic, then stick to the dome)."""

    def __init__(self, mat, coll):
        rng = np.random.default_rng(9)
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
        me = bpy.data.meshes.new('splash')
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        me.materials.append(mat)
        self.items = []
        for k, tl in enumerate(DROP_T):
            ix, iy = dots().head[k]
            for _ in range(3):
                a = rng.uniform(0, 2 * math.pi)
                sp = rng.uniform(0.06, 0.11)
                vz = rng.uniform(0.09, 0.14)
                size = rng.uniform(0.0006, 0.0011)
                ob = bpy.data.objects.new('splash', me)
                coll.objects.link(ob)
                self.items.append((ob, float(ix), float(iy), tl, sp * math.cos(a), sp * math.sin(a), vz, size))

    def update(self, t, surf):
        g = -1.6
        for (ob, ix, iy, tl, vx, vy, vz, size) in self.items:
            tau = t - tl - 0.02
            if tau <= 0:
                ob.hide_render = True
                continue
            ob.hide_render = False
            z0 = float(surf.z(ix, iy)) + 0.003
            tland = None
            for k in range(1, 80):
                tt = k * 0.005
                x, y = ix + vx * tt, iy + vy * tt
                if z0 + vz * tt + 0.5 * g * tt * tt <= float(surf.z(x, y)) and tt > 0.02:
                    tland = tt
                    break
            if tland is None or tau < tland:
                x, y = ix + vx * tau, iy + vy * tau
                z = z0 + vz * tau + 0.5 * g * tau * tau
                sp = math.sqrt(vx * vx + vy * vy + (vz + g * tau) ** 2)
                ob.location = (x, y, z)
                ob.scale = (size, size, size * (1 + 1.2 * sp))
                ob.rotation_euler = (0, 0, 0)
            else:
                x, y = ix + vx * tland, iy + vy * tland
                n = surf.normal(x, y)
                ob.location = (x, y, float(surf.z(x, y)) + size * 0.1)
                ob.scale = (size * 1.35, size * 1.35, size * 0.4)
                ob.rotation_euler = (math.atan2(-n[1], n[2]), math.atan2(n[0], n[2]), 0)
            if math.hypot(x, y) > DOME_R * 0.95:
                ob.hide_render = True


# ------------------------------------------------------------------------------------------------
# the spoon: enters, dips, drags, lifts a heaped scoop; a stretchy cream strand + a honey thread
# ------------------------------------------------------------------------------------------------
SP_A, SP_B, SP_D, SP_T = 0.0150, 0.0100, 0.0050, 0.0007   # bowl half-length, half-width, depth, thickness
SP_BEND = math.radians(12.0)                                # handle rises from the bowl plane
SCOOP_H = 0.0090                                            # heap of cream above the bowl rim


def bowl_outline(th):
    """Egg-shaped bowl outline (spoon local, tip at -X, a touch wider towards the tip)."""
    c, s = np.cos(th), np.sin(th)
    return SP_A * c, SP_B * s * (1 + 0.10 * (-c))


def spoon_bowl_mesh(nrho=14, nth=64):
    th = np.linspace(0, 2 * np.pi, nth, endpoint=False)
    ox, oy = bowl_outline(th)
    rings = []
    rhos_in = np.linspace(0, 1, nrho)
    for rho in rhos_in:                                   # inner surface, centre -> rim
        z = -SP_D * (1 - rho ** 2) ** 0.62
        if rho == 0:
            rings.append(np.array([0, 0, z]))
        else:
            rings.append(np.stack([rho * ox, rho * oy, np.full(nth, z)], -1))
    for i in range(1, 6):                                 # rolled rim: inner lip -> over -> outer
        a = math.pi * i / 6
        grow = 1 + (SP_T * 0.5 / SP_B) * (1 - math.cos(a))
        z = -SP_T * 0.5 + SP_T * 0.5 * math.cos(a) + 0.00025 * math.sin(a)
        rings.append(np.stack([grow * ox, grow * oy, np.full(nth, z)], -1))
    grow = 1 + SP_T / SP_B
    for rho in rhos_in[::-1]:                             # outer surface, rim -> centre
        z = -SP_T - SP_D * (1 - rho ** 2) ** 0.62
        if rho == 0:
            rings.append(np.array([0, 0, z]))
        else:
            rings.append(np.stack([rho * grow * ox, rho * grow * oy, np.full(nth, z)], -1))
    return rings_mesh(rings)


def spoon_handle_mesh(L=0.115, nsec=22, nseg=60):
    """Handle: a flat rounded strip swept from the back of the bowl, bending up by SP_BEND, widening."""
    s = np.linspace(0, L, nseg)
    ang = SP_BEND * smoothstep(0.003, 0.016, s)
    dx, dz = np.cos(ang), np.sin(ang)
    ds = np.gradient(s)
    x = SP_A * 0.80 + np.cumsum(dx * ds) - dx[0] * ds[0]
    z = -0.0004 + np.cumsum(dz * ds) - dz[0] * ds[0]
    w = 0.0026 + 0.0046 * smoothstep(0.012, 0.095, s)
    hth = np.full(nseg, 0.00085)
    endr = smoothstep(L - 0.005, L, s)
    w = w * np.sqrt(np.clip(1 - endr ** 2, 0.0, 1))
    hth = hth * np.sqrt(np.clip(1 - endr ** 2, 0.0, 1))
    rings = [np.array([x[0] - 0.0005, 0, z[0]])]
    for i in range(nseg):
        a = np.linspace(0, 2 * np.pi, nsec, endpoint=False)
        ca, sa = np.cos(a), np.sin(a)
        yy = w[i] * np.sign(ca) * np.abs(ca) ** 0.5
        zz = hth[i] * np.sign(sa) * np.abs(sa) ** 0.5
        nx, nz = -dz[i], dx[i]            # section 'up' normal
        if w[i] < 1e-6:
            continue
        rings.append(np.stack([x[i] + nx * zz, yy, z[i] + nz * zz], -1))
    rings.append(np.array([x[-1] + 0.0003, 0, z[-1]]))
    return rings_mesh(rings)


def scoop_top(x, y, heap):
    """Height of the scooped cream above the bowl rim plane (spoon local), heaped, torn on the tip side."""
    rho = np.sqrt((x / SP_A) ** 2 + (y / (SP_B * (1 + 0.10 * np.clip(-x / SP_A, -1, 1)))) ** 2)
    base = heap * np.clip(1 - (rho / 1.04) ** 2, 0, 1) ** 0.7
    tip = np.clip(-x / SP_A, 0, 1)
    lumps = 0.0006 * (_field(x, y, _TORN) / 3.0) * (0.35 + 0.65 * tip) * np.clip(1 - rho, 0, 1) ** 0.3
    ridge = 0.0012 * np.exp(-((y + 0.002) / 0.003) ** 2) * np.exp(-((x + 0.004) / 0.006) ** 2)
    return base + lumps + ridge * heap / SCOOP_H - 0.0002


def scoop_mesh(heap, nrho=18, nth=72):
    th = np.linspace(0, 2 * np.pi, nth, endpoint=False)
    ox, oy = bowl_outline(th)
    rings = [np.array([0.0, 0.0, float(scoop_top(np.array(0.0), np.array(0.0), heap))])]
    for rho in np.linspace(0, 1.05, nrho)[1:]:
        x, y = rho * ox, rho * oy
        z = scoop_top(x, y, heap) - 0.0012 * smoothstep(0.97, 1.05, rho)
        rings.append(np.stack([x, y, z], -1))
    rings.append(np.stack([0.9 * ox, 0.9 * oy, np.full(nth, -SP_D * 0.45)], -1))
    rings.append(np.array([0.0, 0.0, -SP_D * 0.85]))
    return rings_mesh(rings)


# spoon keyframes: local frame offset from SP0, (du along CR_U, dv along CR_V, dz above the crater surface),
# bowl pitch (deg, + = tip down), roll (deg)
SPOON_KEYS = [
    (0, -0.078, -0.022, 0.024, 6.0, 8.0),
    (7, -0.032, -0.008, 0.014, 16.0, 6.0),
    (12, -0.007, 0.000, 0.0045, 22.0, 0.0),
    (17, 0.001, 0.000, -0.0055, 21.0, 0.0),
    (22, 0.004, 0.000, -0.0060, 11.0, 0.0),
    (26, 0.004, -0.001, -0.0015, 3.0, 4.0),
    (33, 0.000, -0.003, 0.0135, -1.0, 12.0),
    (40, -0.003, -0.005, 0.0228, 0.0, 17.0),
    (45, -0.004, -0.006, 0.0258, 0.5, 18.0),
    (59, -0.0046, -0.0066, 0.0272, 1.0, 18.5),
]
SPOON_YAW = math.atan2(-CR_U[1], -CR_U[0])     # local +X (handle) points away from the scoop direction
T_SCOOP_ON = SP0 + 18 * F        # the cream in the bowl exists from here (the bowl is under the surface)
T_SEP = SP0 + 25 * F             # the bowl bottom leaves the crater: the strand starts
T_BREAK = SP0 + 39 * F           # the strand necks and snaps
T_THREAD = SP0 + 28 * F          # honey starts to run off the spoon
ZC_CRATER = None


def spoon_pose(t):
    """-> (Matrix world, visible)."""
    global ZC_CRATER
    if ZC_CRATER is None:
        ZC_CRATER = float(dome_base(CR_C[0], CR_C[1]))
    lf = (t - SP0) * FPS
    ks = SPOON_KEYS
    tt = [k[0] for k in ks]
    du, dv, dz, pitch, roll = (pchip(tt, [k[i] for k in ks], lf) for i in range(1, 6))
    p = CR_C + CR_U * du + CR_V * dv
    loc = Vector((float(p[0]), float(p[1]), ZC_CRATER + dz))
    R = (Matrix.Rotation(SPOON_YAW, 4, 'Z') @ Matrix.Rotation(math.radians(-pitch), 4, 'Y')
         @ Matrix.Rotation(math.radians(roll), 4, 'X'))
    return Matrix.Translation(loc) @ R, lf >= -0.5


def scoop_heap(t):
    return SCOOP_H * (0.45 + 0.55 * sstep(T_SEP - 6 * F, T_SEP + 6 * F, t))


class Spoon:
    def __init__(self, mats, coll):
        self.root = bpy.data.objects.new('spoon', None)
        coll.objects.link(self.root)
        v, f = spoon_bowl_mesh()
        self.bowl = mesh_obj('spoon_bowl', v, f, mats['steel'], coll=coll)
        v, f = spoon_handle_mesh()
        self.handle = mesh_obj('spoon_handle', v, f, mats['steel'], coll=coll)
        v, f = scoop_mesh(SCOOP_H)
        self.scoop = mesh_obj('spoon_scoop', v, f, mats['strand'], coll=coll)
        for ob in (self.bowl, self.handle, self.scoop):
            recalc_normals(ob)
            ob.parent = self.root
        # a little honey on the heap, running to the tip edge (the thread hangs from there)
        self.honey = mesh_obj('spoon_honey', [(0, 0, 0)], [], mats['honey_body'], coll=coll)
        self.honey.parent = self.root
        self.strand = mesh_obj('strand', [(0, 0, 0)], [], mats['strand'], coll=coll)
        self.thread = mesh_obj('honey_thread', [(0, 0, 0)], [], mats['honey_body'], coll=coll)
        uvl = self.strand.data.uv_layers.new(name='UVMap')
        _ = uvl
        # crumbs of pistachio on the scoop
        rng = np.random.default_rng(zlib.crc32(b'scoop-crumbs'))
        self.crumbs = []
        for i in range(6):
            ob = bpy.data.objects.new('scoop_pist', mats['pist_meshes'][i % len(mats['pist_meshes'])])
            coll.objects.link(ob)
            ob.parent = self.root
            x, y = rng.uniform(-0.6, 0.6) * SP_A, rng.uniform(-0.5, 0.5) * SP_B
            s = rng.uniform(0.0012, 0.0022)
            ob.scale = (s, s * 0.8, s)
            ob.rotation_euler = tuple(rng.uniform(-0.5, 0.5, 3).tolist())
            self.crumbs.append((ob, x, y, s))
        self.tip_local = Vector((-SP_A * 0.92, 0.0012, 0.0))

    def honey_path_local(self, heap):
        xs = np.array([0.004, 0.0005, -0.004, -0.0085, -0.0125, -0.0142])
        ys = np.array([-0.0035, -0.0012, 0.0006, 0.0011, 0.0012, 0.0012])
        pts = catmull(np.stack([xs, ys], -1), 8)
        z = scoop_top(pts[:, 0], pts[:, 1], heap) + 0.0003
        return np.stack([pts[:, 0], pts[:, 1], z], -1)

    def update(self, t, surf):
        M, vis = spoon_pose(t)
        self.root.matrix_world = M
        for ob in (self.bowl, self.handle):
            ob.hide_render = not vis
        heap = scoop_heap(t)
        scoop_vis = vis and t >= T_SCOOP_ON
        self.scoop.hide_render = not scoop_vis
        for (ob, x, y, s) in self.crumbs:
            ob.hide_render = not (scoop_vis and t >= T_SEP)
            ob.location = (x, y, float(scoop_top(np.array(x), np.array(y), heap)) + s * 0.25)
        if scoop_vis:
            v, f = scoop_mesh(heap)
            if len(self.scoop.data.vertices) == len(v):
                set_verts(self.scoop, v)
            else:
                set_mesh(self.scoop, v, f)
        # honey on the heap + the thread off the tip
        hp = self.honey_path_local(heap)
        n = len(hp)
        wv = 0.0013 + 0.0004 * np.sin(np.linspace(0, 6, n))
        v, f = tube_mesh(hp, [np.array([0, 0, 1.0])] * n, wv, np.full(n, 0.0006), nsec=12, flat=0.3, cap=4)
        set_mesh(self.honey, v, f)
        self.honey.hide_render = not (scoop_vis and t >= T_SEP - 2 * F)
        self.update_strand(t, surf, M)
        self.update_thread(t, surf, M, hp)

    def update_strand(self, t, surf, M):
        """Stretchy clotted-cream strand between the scoop's underside and the crater: thick feet, a neck
        that thins as it stretches (volume ~ conserved), snaps at T_BREAK and recoils."""
        if t < T_SEP:
            self.strand.hide_render = True
            return
        A = np.array(M @ Vector((-SP_A * 0.55, 0.0005, -SP_D * 0.75 - SP_T)))
        bxy = CR_C + CR_U * 0.0045
        B = np.array([bxy[0], bxy[1], float(surf.z(bxy[0], bxy[1])) - 0.0006])
        L = float(np.linalg.norm(A - B))
        axis = (A - B) / max(L, 1e-6)
        side = np.cross(axis, np.array([0, 0, 1.0]))
        side /= np.linalg.norm(side) + 1e-9
        nsamp = 48
        s = np.linspace(0, 1, nsamp)
        if t < T_BREAK:
            r_mid = float(np.clip(0.0030 * math.sqrt(0.0035 / max(L, 0.0035)), 0.00045, 0.0030))
            wgt = np.abs(2 * s - 1) ** 2.6
            r = r_mid + ((0.0040 * (1 - s) + 0.0030 * s) - r_mid) * wgt
            sag = 0.0012 * math.sin(t * 9.0) * np.sin(np.pi * s)
            pts = B[None] + (A - B)[None] * s[:, None] + side[None] * sag[:, None]
            pts[:, 2] -= 0.0008 * np.sin(np.pi * s)
            parts = [(pts, r)]
        else:
            tau = t - T_BREAK
            Lb = L_BREAK[0] if L_BREAK[0] else L
            lu = max(0.0045, 0.5 * Lb * math.exp(-tau / 0.07))
            ll = 0.5 * Lb * math.exp(-tau / 0.045)
            parts = []
            su = np.linspace(0, 1, 28)
            sway = 0.0015 * math.sin(tau * 22) * math.exp(-tau / 0.25)
            down = np.array([0.0, 0.0, -1.0])
            du = 0.65 * down + 0.35 * (-axis)
            du /= np.linalg.norm(du)
            pts_u = A[None] + du[None] * (su * lu)[:, None] + side[None] * (sway * su ** 2)[:, None]
            r_u = 0.0026 * (1 - su) ** 1.4 + 0.00055 + 0.0009 * np.exp(-((1 - su) / 0.12) ** 2)
            parts.append((pts_u, r_u))
            if ll > 0.0008:
                pts_l = B[None] + axis[None] * (su * ll)[:, None]
                r_l = 0.0034 * (1 - su) ** 1.6 + 0.0003
                parts.append((pts_l, r_l))
        V, Fc, UV = [], [], []
        for pts, r in parts:
            nrm = [np.cross(np.gradient(pts, axis=0)[i], side) for i in range(len(pts))]
            nrm = [x / (np.linalg.norm(x) + 1e-12) for x in nrm]
            v, f = tube_mesh(pts, nrm, r * 0.8, r * 1.35, nsec=18, flat=1.0, cap=2)   # a stretched ribbon
            base = len(V)
            V += list(v)
            Fc += [tuple(i + base for i in fc) for fc in f]
        set_mesh(self.strand, V, Fc)
        # uv: u along the strand length (streaks run along the pull)
        me = self.strand.data
        uvl = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
        co = get_verts(me)
        proj = (co - B[None]) @ axis
        ang = np.arctan2((co - B[None]) @ side, (co - B[None]) @ np.cross(axis, side))
        loop_v = np.empty(len(me.loops), dtype=np.int32)
        me.loops.foreach_get('vertex_index', loop_v)
        uv = np.stack([ang[loop_v] / (2 * np.pi), proj[loop_v] / 0.03], -1).astype(np.float32)
        uvl.data.foreach_set('uv', uv.ravel())
        self.strand.hide_render = False

    def update_thread(self, t, surf, M, hp):
        """A thin honey thread running off the spoon's tip back down into the crater."""
        if t < T_THREAD:
            self.thread.hide_render = True
            return
        top = np.array(M @ Vector(tuple(hp[-1])))
        bxy = CR_C + CR_U * 0.0075 + CR_V * 0.0015
        zb = float(surf.z(bxy[0], bxy[1]))
        fall = top[2] - 0.30 * (t - T_THREAD)
        bot = np.array([bxy[0], bxy[1], max(zb, fall)])
        bot[:2] = top[:2] + (bot[:2] - top[:2]) * min(1.0, (top[2] - bot[2]) / max(top[2] - zb, 1e-6))
        n = 30
        s = np.linspace(0, 1, n)
        pts = top[None] + (bot - top)[None] * s[:, None]
        drift = np.array(M.col[0][:3]) * 0.0014
        pts += drift[None] * (np.sin(np.pi * s) * s)[:, None]
        r = 0.00055 * (1 - s) ** 0.8 + 0.00024
        if bot[2] <= zb + 1e-5:     # a small coil where it lands
            r = r + 0.0005 * np.exp(-((1 - s) / 0.05) ** 2)
        nrm = [np.array([0, 1.0, 0])] * n
        v, f = tube_mesh(pts, nrm, r, r, nsec=12, flat=1.0, cap=2)
        set_mesh(self.thread, v, f)
        self.thread.hide_render = False


L_BREAK = [None]


# ------------------------------------------------------------------------------------------------
# set, lights, camera
# ------------------------------------------------------------------------------------------------
def build_set(mat):
    """Seamless sweep: floor -> cove -> back wall (extruded along X)."""
    prof = []
    for y in np.linspace(-2.0, 0.55, 30):
        prof.append((y, 0.0))
    rc = 0.45
    for i in range(1, 24):
        a = -math.pi / 2 + (math.pi / 2) * i / 23
        prof.append((0.55 + rc * math.cos(a), rc + rc * math.sin(a)))
    for z in np.linspace(rc + 0.05, 3.0, 12):
        prof.append((0.55 + rc, z))
    xs = np.linspace(-2.5, 2.5, 3)
    verts, faces = [], []
    for x in xs:
        for (y, z) in prof:
            verts.append((x, y, z))
    n = len(prof)
    for i in range(len(xs) - 1):
        for j in range(n - 1):
            a = i * n + j
            faces.append((a, a + 1, a + n + 1, a + n))
    ob = mesh_obj('sweep', verts, faces, mat)
    recalc_normals(ob)
    me = ob.data
    me.update()
    if me.polygons[0].normal.z < 0:
        for p in me.polygons:
            p.flip()
    return ob


def area_light(name, size, size_y, loc, target, power, color=(1, 1, 1), spread=180.0, shape='RECTANGLE',
               glossy=True, temp=None, recv=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = shape
    ld.size = size
    ld.size_y = size_y
    ld.energy = power
    ld.color = color
    if temp and hasattr(ld, 'use_temperature'):
        ld.use_temperature = True
        ld.temperature = temp
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob.visible_glossy = glossy
    ob.visible_camera = False
    if recv is not None:
        ob.light_linking.receiver_collection = recv
    return ob


# camera keys: t (s), azimuth, elevation (deg), distance (m), target z, focus point (x, y, z)
# A gentle push-in on the whole cup while the dots land, then a slow move to a closer, lower-in-frame framing
# of the dome for the scoop (so the lifted spoon stays below the headline zone), settling at the end.
CAM_KEYS = [
    (0.00, -15.0, 26.5, 0.590, 0.0745),
    (1.40, -9.0, 25.0, 0.520, 0.0790),
    (2.20, -5.0, 23.0, 0.470, 0.0880),
    (3.30, -0.5, 20.5, 0.420, 0.1030),
    (4.00, 0.6, 20.0, 0.410, 0.1060),
]
FOCUS_A = np.array([0.0, -0.020, 0.104])        # front of the dome, between the dots and the sticker
FOCUS_B = np.array([0.012, 0.000, 0.122])       # the lifted scoop


def camera_state(t):
    ts = [k[0] for k in CAM_KEYS]
    az, el, dist, tz = (pchip(ts, [k[i] for k in CAM_KEYS], t) for i in range(1, 5))
    az, el = math.radians(az), math.radians(el)
    tgt = np.array([0.0, 0.0, tz])
    pos = tgt + dist * np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])
    fb = sstep(SP0 + 0.2, SP0 + 1.1, t)
    focus = FOCUS_A + (FOCUS_B - FOCUS_A) * fb
    return pos, tgt, float(np.linalg.norm(focus - pos))


# ------------------------------------------------------------------------------------------------
# scene assembly + render loop
# ------------------------------------------------------------------------------------------------
def setup_render(args):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = args.samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = args.threshold
    cy.adaptive_min_samples = min(args.min_samples, args.samples)
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.denoising_prefilter = 'ACCURATE' if args.packshot else 'FAST'
    if hasattr(cy, 'denoising_quality'):
        cy.denoising_quality = 'HIGH'
    cy.seed = 0
    cy.use_animated_seed = False
    cy.max_bounces = 12
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 4
    cy.transmission_bounces = 12
    cy.transparent_max_bounces = 16
    cy.volume_bounces = 0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 0.6
    cy.sample_clamp_indirect = 6.0
    cy.sample_clamp_direct = 0.0
    cy.use_light_tree = True
    sc.render.threads_mode = 'FIXED' if args.threads else 'AUTO'
    if args.threads:
        sc.render.threads = args.threads
    sc.render.use_persistent_data = True
    rx, ry = (int(v) for v in args.res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.render.use_motion_blur = not args.no_mblur
    if args.border:
        b = [float(v) for v in args.border.split(',')]
        sc.render.use_border, sc.render.use_crop_to_border = True, True
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = b
    for kv in args.cy:
        k, v = kv.split('=')
        cur = getattr(cy, k)
        setattr(cy, k, type(cur)(float(v)) if not isinstance(cur, str) else v)
    sc.render.motion_blur_shutter = args.shutter
    sc.render.film_transparent = bool(args.packshot)
    if args.packshot:
        cy.film_transparent_glass = True
    sc.view_settings.view_transform = args.view
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = args.exposure
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = 'sRGB'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if args.packshot else 'RGB'
    sc.render.image_settings.color_depth = '16'
    sc.render.image_settings.compression = 15
    sc.frame_start = 1
    sc.frame_end = NFRAMES


def build_scene(args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    setup_render(args)

    world = bpy.data.worlds.new('world')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    wn = world.node_tree.nodes
    bg = wn.get('Background') or wn.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (0.62, 0.66, 0.66, 1)
    bg.inputs['Strength'].default_value = args.world
    # glossy rays see a bright studio ceiling (soft gradient, brightest overhead) so the honey, the fresh
    # cream and the steel reflect light instead of a black void; camera/diffuse rays keep the dim world
    tc = wn.new('ShaderNodeTexCoord')
    sep = wn.new('ShaderNodeSeparateXYZ')
    world.node_tree.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp_w = wn.new('ShaderNodeMapRange')
    world.node_tree.links.new(sep.outputs[2], ramp_w.inputs['Value'])
    ramp_w.inputs['From Min'].default_value, ramp_w.inputs['From Max'].default_value = -0.2, 1.0
    ramp_w.inputs['To Min'].default_value, ramp_w.inputs['To Max'].default_value = 0.05, args.world_gloss
    bg2 = wn.new('ShaderNodeBackground')
    bg2.inputs['Color'].default_value = (0.95, 0.97, 0.97, 1)
    world.node_tree.links.new(ramp_w.outputs[0], bg2.inputs['Strength'])
    lpw = wn.new('ShaderNodeLightPath')
    mxw = wn.new('ShaderNodeMixShader')
    mxr = wn.new('ShaderNodeMath')
    mxr.operation = 'MAXIMUM'
    world.node_tree.links.new(lpw.outputs['Is Glossy Ray'], mxr.inputs[0])
    world.node_tree.links.new(lpw.outputs['Is Transmission Ray'], mxr.inputs[1])
    world.node_tree.links.new(mxr.outputs[0], mxw.inputs[0])
    world.node_tree.links.new(bg.outputs[0], mxw.inputs[1])
    world.node_tree.links.new(bg2.outputs[0], mxw.inputs[2])
    wout = wn.get('World Output') or wn.new('ShaderNodeOutputWorld')
    world.node_tree.links.new(mxw.outputs[0], wout.inputs['Surface'])

    turq = hex_to_lin(SPEC['colors']['turquoise'])
    mats = {
        'qashta': mat_qashta(coat=0.22, rough=0.34, bump=0.16, glow=args.glow, fresh_attr='fresh'),
        'drop': mat_drop_fall(),
        'strand': mat_strand(),
        'core': mat_qashta('qashta_core', tint_attr='fruitmask', bump=0.35, glow=args.core_glow),
        'cup': mat_cup(),
        'water': mat_water(),
        'haze': mat_haze(),
        'honey': mat_honey(),
        'honey_body': mat_honey_body(),
        'mango': mat_mango(),
        'straw_skin': mat_strawberry_skin(),
        'straw_flesh': mat_strawberry_flesh(),
        'kiwi': mat_kiwi(),
        'banana': mat_banana(),
        'pistachio': mat_pistachio(),
        'steel': mat_steel(),
        'sticker': mat_sticker(args.sticker, args.sticker_glow),
        'backdrop': mat_backdrop(turq, args.backdrop_emit, lit=args.backdrop_lit),
    }
    coll = sc.collection
    sweep = build_set(mats['backdrop'])
    build_cup(mats['cup'])
    _, band_fn = build_core(mats['core'])
    build_smear(mat_smear(), band_fn)
    build_sticker(mats['sticker'])
    if not args.no_beads:
        build_condensation(mats['water'], mats['haze'], haze=not args.no_haze)
    fm = fruit_meshes(mats)
    build_fruit(fm, coll)
    S = {'dome': Dome(mats['qashta']), 'honey': Honey(mats['honey'], mats['honey_body'], coll),
         'garnish': Garnish(fm, coll)}

    honey_xy = S['honey'].xy

    def avoid(x, y):
        for k in range(2):
            if dots().sdist(k, x, y) > -0.0045:
                return True
        c = np.array([x, y]) - CR_C
        u, v = c @ CR_U / (CR_A * 1.3), c @ CR_V / (CR_B * 1.35)
        if u * u + v * v < 1.0:
            return True
        if np.min((honey_xy[:, 0] - x) ** 2 + (honey_xy[:, 1] - y) ** 2) < 0.0036 ** 2:
            return True
        for (_, gx, gy, gs, _, _) in GARNISH:
            if (x - gx) ** 2 + (y - gy) ** 2 < (0.75 * gs + 0.0015) ** 2:
                return True
        return False
    S['pist'] = Pistachios(mats['pistachio'], coll, avoid)
    mats['pist_meshes'] = S['pist'].meshes
    S['splash'] = Splash(mats['drop'], coll)
    S['drops'] = [Drop(f'drop{k}', mats['drop'], k, tl, tilt)
                  for k, (tl, tilt) in enumerate(zip(DROP_T, (-0.45, 0.4)))]
    S['spoon'] = Spoon(mats, coll)

    # light linking: subject lights never touch the set, the set light never touches the subject
    subject = bpy.data.collections.new('subject')
    setonly = bpy.data.collections.new('setonly')
    for ob in list(sc.objects):
        if ob.type != 'MESH':
            continue
        (setonly if ob.name.startswith('sweep') else subject).objects.link(ob)

    # the toppings (dome, dots, honey, garnish, spoon + scoop): they get a low raking light from the left
    # (shape: dots, crater, curd) and a glossy-only softbox above the camera (wet highlights on the fresh dots,
    # honey, fruit and steel) without veiling the PET
    tops = bpy.data.collections.new('toppings')
    for ob in list(sc.objects):
        if ob.type == 'MESH' and ob.name.split('.')[0].split('_')[0] in (
                'dome', 'drop0', 'drop1', 'splash', 'honey', 'pistachio', 'garnish', 'spoon', 'strand', 'scoop'):
            tops.objects.link(ob)

    L = args.light
    area_light('raker', 0.10, 0.16, (-0.34, -0.12, 0.20), (0.0, 0.0, 0.122), args.raker * L, temp=5400,
               recv=tops)
    g = area_light('gloss', 0.26, 0.10, (-0.06, -0.30, 0.40), (0.0, -0.01, 0.125), args.gloss * L, temp=6200,
                   recv=tops)
    g.visible_diffuse = False
    g.visible_transmission = False
    kpos = (-0.30, 0.26, 0.38)
    area_light('key', 0.55, 0.45, kpos, (0, 0, 0.09), args.key * L, temp=5600, recv=subject)
    area_light('key_set', 0.55, 0.45, kpos, (0.02, -0.03, 0.0), args.keyset * L, temp=6500, glossy=False,
               recv=setonly)
    area_light('fill', 0.70, 0.55, (0.10, -0.60, 0.16), (0, 0, 0.07), args.fill * L, temp=5200, recv=subject,
               glossy=False)
    area_light('top', 0.22, 0.22, (0.10, -0.05, 0.50), (0, 0, 0.11), 0.9 * L, temp=5800, recv=subject)
    area_light('rimL', 0.05, 0.50, (-0.30, 0.20, 0.22), (0, 0, 0.08), 3.2 * L, spread=50, temp=6200,
               recv=subject)
    area_light('rimR', 0.05, 0.50, (0.30, 0.22, 0.24), (0, 0, 0.08), 3.6 * L, spread=50, temp=6200,
               recv=subject)
    # a small glossy-only strip, front-right: a crisp highlight along the spoon and on the wet fruit/honey
    s = area_light('specF', 0.04, 0.30, (0.22, -0.30, 0.20), (0.02, 0, 0.11), args.spec * L, temp=6000,
                   recv=subject)
    s.visible_diffuse = False
    s.visible_transmission = False
    area_light('halo', 0.8, 0.8, (0.0, -0.2, 0.60), (0, 0.8, 0.1), args.halo * L, temp=6500, glossy=False,
               shape='DISK', spread=90, recv=setonly)

    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = args.lens
    cam_d.sensor_fit = 'AUTO'
    cam_d.sensor_width = 36
    cam_d.dof.use_dof = args.fstop > 0
    cam_d.dof.aperture_fstop = args.fstop
    cam_d.dof.aperture_blades = 7
    cam = bpy.data.objects.new('cam', cam_d)
    coll.objects.link(cam)
    sc.camera = cam
    S['cam'] = cam
    cam_d.clip_start = 0.02
    cam_d.clip_end = 20

    if args.packshot:
        sweep.is_shadow_catcher = True
        return S

    # keyframes for camera + falling drops + spoon (so Cycles motion blur sees the motion)
    for f in range(NFRAMES + 1):
        t = f / FPS
        pos, tgt, fd = camera_state(t)
        cam.location = pos.tolist()
        cam.rotation_euler = (Vector(tgt.tolist()) - Vector(pos.tolist())).to_track_quat('-Z', 'Y').to_euler()
        cam_d.dof.focus_distance = fd
        cam.keyframe_insert('location', frame=f + 1)
        cam.keyframe_insert('rotation_euler', frame=f + 1)
        cam_d.keyframe_insert('dof.focus_distance', frame=f + 1)
        surf = Surf(t)
        for d in S['drops']:
            st = d.state(t, surf)
            d.ob.location = st['loc']
            d.ob.rotation_euler = st['rot']
            d.ob.scale = st['scale']
            for p in ('location', 'rotation_euler', 'scale'):
                d.ob.keyframe_insert(p, frame=f + 1)
        M, _ = spoon_pose(t)
        S['spoon'].root.matrix_world = M
        for p in ('location', 'rotation_euler'):
            S['spoon'].root.keyframe_insert(p, frame=f + 1)
    return S


def update_frame(S, t, scoop=True, spoon=True):
    surf = Surf(t, scoop=scoop)
    S['dome'].update(surf)
    S['pist'].update(surf)
    S['garnish'].update(surf)
    S['honey'].update(t, surf)
    S['splash'].update(t, surf)
    for d in S['drops']:
        st = d.state(t, surf)
        d.ob.hide_render = not st['visible']
    if spoon:
        S['spoon'].update(t, surf)
    else:
        sp = S['spoon']
        for ob in (sp.bowl, sp.handle, sp.scoop, sp.honey, sp.strand, sp.thread):
            ob.hide_render = True
        for (ob, *_r) in sp.crumbs:
            ob.hide_render = True


def motion_window(t):
    """Motion blur only where things move fast: falling drops, the spoon's entrance, dip and lift."""
    drops = any(tl - Drop.FALL - 0.05 <= t <= tl + 0.04 for tl in DROP_T)
    return drops or (SP0 - 0.05 <= t <= SP0 + 45 * F)


def parse_frames(spec):
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            step = 1
            if ':' in b:
                b, step = b.split(':')
            out += list(range(int(a), int(b) + 1, int(step)))
        elif part:
            out.append(int(part))
    return out


def render_packshot(S, args):
    """Clean hero still for the end card: transparent film, the set becomes a shadow catcher (soft
    semi-transparent contact shadow), the cup before the scoop (dots settled, honey bead on the lip)."""
    sc = bpy.context.scene
    t = args.state_t
    update_frame(S, t, scoop=False, spoon=False)
    for d in S['drops']:
        d.ob.hide_render = True
    az, el, dist, tz = (math.radians(args.pk_cam[0]), math.radians(args.pk_cam[1]), args.pk_cam[2],
                        args.pk_cam[3])
    tgt = np.array([0.0, 0.0, tz])
    pos = tgt + dist * np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])
    cam = S['cam']
    cam.animation_data_clear()
    cam.data.animation_data_clear()
    cam.location = pos.tolist()
    cam.rotation_euler = (Vector(tgt.tolist()) - Vector(pos.tolist())).to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.focus_distance = float(np.linalg.norm(np.array([0, -0.03, 0.07]) - pos))
    sc.render.use_motion_blur = False
    sc.render.filepath = os.path.abspath(args.packshot)
    ts = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'[cup] packshot {args.packshot} in {time.time() - ts:.1f}s', flush=True)


def make_parser():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='')
    ap.add_argument('--res', default='1080x1920')
    ap.add_argument('--frames', default='0', help='local frames, e.g. 0,30,45 or 0-119:2')
    ap.add_argument('--samples', type=int, default=64)
    ap.add_argument('--threshold', type=float, default=0.03)
    ap.add_argument('--min-samples', type=int, default=6)
    ap.add_argument('--threads', type=int, default=0)
    ap.add_argument('--sticker', default=os.path.join(HERE, 'out', 'sticker.png'))
    ap.add_argument('--view', default='Khronos PBR Neutral')
    ap.add_argument('--exposure', type=float, default=0.0)
    ap.add_argument('--lens', type=float, default=72.0)
    ap.add_argument('--fstop', type=float, default=5.0)
    ap.add_argument('--light', type=float, default=1.0)
    ap.add_argument('--halo', type=float, default=3.0)
    ap.add_argument('--keyset', type=float, default=1.8)
    ap.add_argument('--key', type=float, default=9.0)
    ap.add_argument('--fill', type=float, default=2.6)
    ap.add_argument('--spec', type=float, default=1.2)
    ap.add_argument('--raker', type=float, default=2.2)
    ap.add_argument('--gloss', type=float, default=5.0)
    ap.add_argument('--world', type=float, default=0.03)
    ap.add_argument('--world-gloss', type=float, default=0.55)
    ap.add_argument('--glow', type=float, default=0.06, help='self-light of the dome qashta')
    ap.add_argument('--core-glow', type=float, default=0.22, help='self-light of the qashta seen through the PET')
    ap.add_argument('--sticker-glow', type=float, default=0.55)
    ap.add_argument('--backdrop-emit', type=float, default=0.77)
    ap.add_argument('--backdrop-lit', type=float, default=0.3)
    ap.add_argument('--save-blend', default='')
    ap.add_argument('--no-mblur', action='store_true')
    ap.add_argument('--no-beads', action='store_true')
    ap.add_argument('--no-haze', action='store_true')
    ap.add_argument('--shutter', type=float, default=0.35)
    ap.add_argument('--border', default='', help='debug crop: xmin,xmax,ymin,ymax (0-1, y up)')
    ap.add_argument('--hide', default='', help='debug: comma list of object name prefixes to hide')
    ap.add_argument('--cy', action='append', default=[], help='extra scene.cycles overrides key=value')
    ap.add_argument('--packshot', default='', help='render the transparent end-card still to this PNG')
    ap.add_argument('--state-t', type=float, default=3.9, help='packshot: shot time of the contents state')
    ap.add_argument('--pk-cam', default='-11,17,0.43,0.071', help='packshot camera: az,el,dist,target z')
    return ap


def main():
    argv = sys.argv[sys.argv.index('render') + 1:] if 'render' in sys.argv else sys.argv[1:]
    args = make_parser().parse_args(argv)
    args.pk_cam = [float(v) for v in args.pk_cam.split(',')]
    t0 = time.time()
    S = build_scene(args)
    print(f'[cup] scene built in {time.time() - t0:.1f}s', flush=True)
    sc = bpy.context.scene
    for pre in filter(None, args.hide.split(',')):
        for ob in sc.objects:
            if ob.name.startswith(pre):
                ob.hide_render = True
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    if args.packshot:
        render_packshot(S, args)
        return
    os.makedirs(args.out, exist_ok=True)
    times = {}
    frames = parse_frames(args.frames)
    # the strand's break length is a function of the pose at T_BREAK: evaluate it once (order-independent)
    surf_b = Surf(T_BREAK - 1e-4)
    Mb, _ = spoon_pose(T_BREAK - 1e-4)
    A = np.array(Mb @ Vector((-SP_A * 0.55, 0.0005, -SP_D * 0.75 - SP_T)))
    bxy = CR_C + CR_U * 0.0045
    L_BREAK[0] = float(np.linalg.norm(A - np.array([bxy[0], bxy[1], float(surf_b.z(bxy[0], bxy[1])) - 0.0006])))
    for lf in frames:
        t = lf / FPS
        ts = time.time()
        sc.frame_set(lf + 1)
        sc.render.use_motion_blur = (not args.no_mblur) and motion_window(t)
        update_frame(S, t)
        for pre in filter(None, args.hide.split(',')):
            for ob in sc.objects:
                if ob.name.startswith(pre):
                    ob.hide_render = True
        tu = time.time() - ts
        sc.render.filepath = os.path.join(os.path.abspath(args.out), f'{lf:04d}.png')
        bpy.ops.render.render(write_still=True)
        times[lf] = round(time.time() - ts, 2)
        print(f'[cup] frame {lf:3d} t={t:4.2f}s  {times[lf]:6.1f}s (update {tu:.2f}s)', flush=True)
    json.dump({'times': times, 'args': vars(args), 'total_s': round(time.time() - t0, 1)},
              open(os.path.join(args.out, f'timing_{min(times) if times else 0:04d}.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
