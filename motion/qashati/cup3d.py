#!/usr/bin/env python3
"""Qashati Alsham — «مش قشطة» Act 3: the 3D product hero shot of the cup.

Everything is procedural (no .blend): a clear tapered PET cup with visible fruit / qashta layers,
a glossy qashta dome with honey drizzle + pistachio crumbs, a turquoise sticker with the white Q,
two teardrop qashta drops (the ق dots) that land on the dome at spec T.cupDrops, a honey drip
running down the cup, on a turquoise seamless set. Timing is read from video/src/qashati2/spec.ts.

Two entry points:
  python3 cup3d.py sticker OUT.png              # sticker texture from the traced logo (system python, cairosvg)
  /opt/bpy5/bin/python cup3d.py render [opts]   # build scene + render frames (Blender 5 as a module, Cycles + OIDN)

Frames are rendered by our own loop: every per-frame thing (camera, drops, dome wobble, honey drip) is a
pure function of the shot time t, so any subset of frames can be rendered in any order / in parallel
(all randomness is seeded; never seed from Python's per-process-salted hash()).

Look notes (review pass): the set is a turquoise glow with studio falloff + an AO contact shadow, so the
cup sits ON a surface instead of floating on a flat fill; honey is a see-through amber film + Fresnel gloss
(a refractive ribbon in SSS cream rendered dark teal outlines = orange cable); qashta is warm ivory satin
with soft folds + crescent spoon ridges (not hammered foam); a streaky qashta smear on the inside of the PET
and a recessed back row of fruit break the 'pieces pasted on a sheet' look; the landed drops settle as soft
rounded beans like the logo's two dots.
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


# ----------------------------------------------------------------------------------------------
# spec.ts (single source of truth for timing + colours)
# ----------------------------------------------------------------------------------------------
def read_spec():
    s = open(SPEC_TS, encoding='utf-8').read()
    fps = int(re.search(r'export const FPS = (\d+)', s).group(1))
    w = int(re.search(r'export const W = (\d+)', s).group(1))
    h = int(re.search(r'export const H = (\d+)', s).group(1))
    cup = int(re.search(r'cupShot:\s*(\d+)', s).group(1))
    drops = [int(x) for x in re.search(r'cupDrops:\s*\[(\d+),\s*(\d+)\]', s).groups()]
    title = int(re.search(r'\btitle:\s*(\d+)', s).group(1))
    end_card = int(re.search(r'endCard:\s*(\d+)', s).group(1))
    colors = dict(re.findall(r"(\w+): '(#[0-9A-Fa-f]{6})'", s))
    return {
        'fps': fps, 'w': w, 'h': h,
        'frames': end_card - cup,                      # 150 = 5.0 s
        'drop_land': [(d - cup) / fps for d in drops],  # local seconds: 1.0, 1.3
        'title': (title - cup) / fps,                   # headline overlay from local 2.0 s
        'colors': colors,
    }


def hex_to_lin(hx):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(c(int(hx[i:i + 2], 16)) for i in (1, 3, 5))


# ----------------------------------------------------------------------------------------------
# sticker texture (system python: cairosvg + svgpathtools)
# ----------------------------------------------------------------------------------------------
def make_sticker(out, size=2048):
    import cairosvg
    from svgpathtools import parse_path
    s = open(LOGO_TS, encoding='utf-8').read()
    paths = []
    for k in ('dots', 'q'):
        m = re.search(k + r': \[(.*?)\]', s, re.S)
        paths += re.findall(r'"(M[^"]*)"', m.group(1))
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


# ----------------------------------------------------------------------------------------------
# brand-colour lock (system python: numpy + opencv) — a secondary grade applied to rendered frames
# ----------------------------------------------------------------------------------------------
def grade_frames(src_dir, dst_dir, ref_frame='0000.png'):
    """Pull the sweep exactly onto brand turquoise. The measured sweep colour (median of the top 20% of
    the reference frame — the calm headline zone) is mapped per channel (in linear light) onto #01E8D5;
    the correction is weighted by closeness to that colour, so the cream, fruit and honey are untouched
    and the sweep keeps its soft light gradient. Same correction for every frame (no flicker)."""
    import glob
    import cv2
    import numpy as np

    def s2l(v):
        return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)

    def l2s(v):
        v = np.clip(v, 0, 1)
        return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)

    def read(p):
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)[:, :, ::-1].astype(np.float32)
        return im / (65535.0 if im.max() > 255 else 255.0)

    ref = read(os.path.join(src_dir, ref_frame))
    h = ref.shape[0]
    cm = np.median(ref[: int(h * 0.2)].reshape(-1, 3), axis=0)
    ct = np.array([int(read_spec()['colors']['turquoise'][i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    ratio = s2l(ct) / np.maximum(s2l(cm), 1e-5)
    print(f'[cup] grade: sweep {np.round(cm * 255, 1)} -> {np.round(ct * 255)}  (linear ratio {np.round(ratio, 3)})')
    os.makedirs(dst_dir, exist_ok=True)
    # keyed on chromaticity (not absolute colour): the whole sweep incl. its falloff and the contact shadow
    # gets the same linear per-channel correction, so shadows keep their depth and stay on-brand
    lm = s2l(cm)
    ch_ref = lm / lm.sum()
    sig = 0.06
    for p in sorted(glob.glob(os.path.join(src_dir, '[0-9][0-9][0-9][0-9].png'))):
        im = read(p)
        li = s2l(im)
        ch = li / (li.sum(axis=2, keepdims=True) + 1e-4)
        w = np.exp(-np.sum((ch - ch_ref) ** 2, axis=2) / (2 * sig * sig))
        w *= np.clip(li.sum(axis=2) / 0.05, 0, 1)          # leave near-black alone
        out = l2s(li * (1 + w[..., None] * (ratio - 1)))
        cv2.imwrite(os.path.join(dst_dir, os.path.basename(p)),
                    (np.clip(out, 0, 1)[:, :, ::-1] * 65535 + 0.5).astype(np.uint16))
    print(f'[cup] graded frames -> {dst_dir}')


# ================================================================================================
# Blender part
# ================================================================================================
if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'sticker':
    make_sticker(sys.argv[2])
    sys.exit(0)
if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'grade':
    grade_frames(sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
    sys.exit(0)

import numpy as np  # noqa: E402  (bpy python has numpy)

try:
    import bpy  # noqa: E402
    import bmesh  # noqa: E402
    from mathutils import Vector, Matrix, Euler  # noqa: E402
except ImportError:  # imported for `sticker` only
    bpy = None

SPEC = read_spec()
FPS = SPEC['fps']
NFRAMES = SPEC['frames']

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


# layer plan (fruit / qashta bands seen through the wall)
FRUIT_LAYERS = [(0.0030, 0.0305), (0.0500, 0.0800)]
# qashta dome: an ellipsoidal mound that sits ON the rim and bulges slightly over it (generous),
# modulated by scoop lumps + a spoon-drag swirl. Height field for |r| < DOME_RX, extra lip rings below.
DOME_RX = R_TOP + 0.0011
DOME_HZ = 0.0170
DOME_PHI_MAX = math.radians(101.0)
DOME_ZC = CUP_H + 0.0016 - DOME_HZ * math.cos(DOME_PHI_MAX)
DOME_R = DOME_RX            # footprint used by samplers
HONEY_TINT = ((0.98, 0.72, 0.24), (0.93, 0.50, 0.07), (0.66, 0.20, 0.012))   # thin -> thick amber
SET_FALLOFF = (0.16, 0.10)   # backdrop glow falloff: floor towards the lens, frame sides
SET_AO = (0.045, 0.72)       # contact shadow: AO distance (m), strength
STICKER_Z = 0.0425
STICKER_R = 0.0205
STICKER_PHI = math.radians(-92.0)          # -90 = straight at the camera (-Y)
DRIP_PHI = math.radians(-90.0 - 40.0)      # honey drip: front-left
IMPACTS = [(-0.0095, -0.0150), (0.0098, -0.0085)]   # where the two drops land (x, y)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ease_in_out(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


# ------------------------------------------------------------------------------------------------
# dome height field (analytic; everything that sits on the dome samples it)
# ------------------------------------------------------------------------------------------------
_RNG = np.random.default_rng(7)
# the mound = smooth union of a low base cap + spooned scoops (x, y, radius, peak height above the rim)
_SCOOPS = [(-0.012, 0.011, 0.024, 0.0315), (0.015, 0.009, 0.022, 0.0275), (0.001, -0.015, 0.022, 0.0240),
           (-0.026, -0.011, 0.016, 0.0185), (0.027, -0.010, 0.017, 0.0195), (0.003, 0.029, 0.016, 0.0200),
           (-0.031, 0.013, 0.013, 0.0165)]
_WAVES = [(_RNG.normal(0, 1, 2), _RNG.uniform(0.009, 0.018), _RNG.uniform(0, 6.28)) for _ in range(6)]
# spoon marks: crescent ridges (centre x, y, radius, arc centre angle, arc half-width, height)
_SPOON = [(-0.004, 0.004, 0.017, 4.2, 1.1, 0.0016), (0.012, -0.004, 0.013, 1.0, 1.0, 0.0012),
          (-0.020, -0.004, 0.011, 5.6, 0.9, 0.0010), (0.006, 0.020, 0.012, 3.0, 1.0, 0.0010)]


def _smax(a, b, k=0.0013):
    return np.maximum(a, b) + k * np.log1p(np.exp(-np.abs(a - b) / k))


def dome_base(x, y):
    """Mound height at (x, y) before impact wobble."""
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
    # spoon texture: crested ridges (0.55 - |sin|) at 4-10 mm, plus a soft peak with a curl
    tex = 0.0
    for (d, wl, ph) in _WAVES:
        dn = d / (np.linalg.norm(d) + 1e-9)
        tex = tex + np.sin((x * dn[0] + y * dn[1]) * (2 * np.pi / wl) + ph)
    z = z + 0.00022 * tex * fall
    for (cx, cy, rad, ac, aw, hgt) in _SPOON:
        dx, dy = x - cx, y - cy
        d = np.sqrt(dx * dx + dy * dy)
        da = np.angle(np.exp(1j * (np.arctan2(dy, dx) - ac)))
        arc = np.exp(-(da / aw) ** 4)
        ridge = np.exp(-((d - rad) / 0.0016) ** 2) - 0.35 * np.exp(-((d - rad + 0.0034) / 0.0028) ** 2)
        z = z + hgt * ridge * arc * fall
    z = z + 0.0020 * np.exp(-((x + 0.012) ** 2 + (y - 0.011) ** 2) / (0.0045 ** 2))
    return z


class Wobble:
    """Impact response of the dome at shot time t (global squash + local dent + a faint ring)."""

    def __init__(self, t):
        self.t = t
        self.items = []
        for (ix, iy), tl in zip(IMPACTS, SPEC['drop_land']):
            tau = t - tl
            if tau > 0:
                self.items.append((ix, iy, tau))

    def dz(self, x, y, zbase):
        out = np.zeros_like(np.asarray(x, dtype=float))
        for ix, iy, tau in self.items:
            env = math.exp(-5.0 * tau)
            glob = -0.05 * env * math.sin(2 * math.pi * 3.0 * tau)       # whole mound squash/rebound
            out = out + glob * np.maximum(zbase - (CUP_H + 0.002), 0)
            d2 = (x - ix) ** 2 + (y - iy) ** 2
            dent = -0.0018 * math.exp(-8.0 * tau) * (1 - math.exp(-60 * tau))
            out = out + dent * np.exp(-d2 / (0.010 ** 2))
            d = np.sqrt(d2)
            ring = 0.0004 * math.exp(-6.0 * tau) * np.sin(800.0 * d - 34.0 * tau) * np.exp(-d / 0.03)
            out = out + ring * smoothstep(0.0, 0.004, d)
        return out

    def z(self, x, y):
        zb = dome_base(x, y)
        return zb + self.dz(x, y, zb)


def dome_normal(x, y, wob, e=0.0004):
    zx = (wob.z(x + e, y) - wob.z(x - e, y)) / (2 * e)
    zy = (wob.z(x, y + e) - wob.z(x, y - e)) / (2 * e)
    n = np.array([-zx, -zy, 1.0])
    return n / np.linalg.norm(n)


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
    return verts, faces


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


def get_verts(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    return co.reshape(-1, 3).astype(float)


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


def mat_qashta(name='qashta', tint_attr=None, bump=0.25, coat=0.0, rough=0.40):
    """Levantine qashta: ivory, satin (not plastic-glossy), soft SSS. Shape texture lives in the geometry;
    only a cheap fine-noise bump here (render time)."""
    m, nt = new_mat(name)
    tc = nt.n('ShaderNodeTexCoord')
    nzl = nt.n('ShaderNodeTexNoise', Scale=120.0, Detail=1.0, Roughness=0.5)
    nt.link(tc.outputs['Object'], nzl.inputs['Vector'])
    col = ramp(nt, nzl.outputs['Fac'], [(0.3, (0.82, 0.795, 0.715)), (0.7, (0.87, 0.85, 0.77))])
    col_out = col.outputs['Color']
    if tint_attr:
        attr = nt.n('ShaderNodeAttribute', _attribute_name=tint_attr)
        vo = nt.n('ShaderNodeTexVoronoi', Scale=230.0, Randomness=1.0)
        nt.link(tc.outputs['Object'], vo.inputs['Vector'])
        salad = ramp(nt, vo.outputs['Color'], [(0.0, (0.30, 0.012, 0.018)), (0.3, (0.55, 0.16, 0.01)),
                                              (0.5, (0.52, 0.42, 0.20)), (0.66, (0.40, 0.03, 0.03)),
                                              (0.8, (0.10, 0.22, 0.02)), (1.0, (0.60, 0.22, 0.012))])
        salad.color_ramp.interpolation = 'CONSTANT'
        mixc = nt.n('ShaderNodeMix', _data_type='RGBA')
        nt.link(salad.outputs['Color'], mixc.inputs[7])
        nt.link(math_node(nt, 'MULTIPLY', attr.outputs['Fac'], 0.97), mixc.inputs['Factor'])
        nt.link(col_out, mixc.inputs[6])
        col_out = mixc.outputs[2]
    p = principled(nt, **{'Roughness': rough, 'Subsurface Weight': 1.0,
                          'Subsurface Radius': (1.0, 0.92, 0.78), 'Subsurface Scale': 0.0024,
                          'Coat Weight': coat, 'Coat Roughness': 0.12, 'Specular IOR Level': 0.5,
                          'sss_method': 'BURLEY'})
    nt.link(col_out, p.inputs['Base Color'])
    if bump > 0:
        nz = nt.n('ShaderNodeTexNoise', Scale=520.0, Detail=3.0, Roughness=0.6)
        nt.link(tc.outputs['Object'], nz.inputs['Vector'])
        bn = nt.n('ShaderNodeBump', Strength=bump, Distance=0.0004)
        nt.link(nz.outputs['Fac'], bn.inputs['Height'])
        nt.link(bn.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_cup():
    m, nt = new_mat('cup_pet')
    p = principled(nt, **{'Base Color': (1.0, 1.0, 1.0), 'Roughness': 0.012, 'IOR': 1.57,
                          'Transmission Weight': 1.0, 'Specular IOR Level': 0.6})
    output(nt, shadow_transparent(nt, p, tint=(0.97, 0.98, 0.98)))
    return m


def mat_honey():
    """Honey as a see-through amber film over the cream (tint deepens with path length, i.e. towards
    grazing angles, like Beer's law) under a Fresnel-weighted glossy skin for the wet highlights.
    Deliberately not a refractive solid: a thin refractive ribbon embedded in the SSS cream renders
    dark teal outlines (grazing refraction/reflection of the set) and reads as an orange cable."""
    m, nt = new_mat('honey')
    lw = nt.n('ShaderNodeLayerWeight', Blend=0.5)
    thick = math_node(nt, 'POWER', lw.outputs['Facing'], 1.4)
    tint = ramp(nt, thick, [(0.0, HONEY_TINT[0]), (0.55, HONEY_TINT[1]), (1.0, HONEY_TINT[2])])
    tr = nt.n('ShaderNodeBsdfTransparent')
    nt.link(tint.outputs['Color'], tr.inputs['Color'])
    gl = nt.n('ShaderNodeBsdfGlossy', Color=rgba((1.0, 0.93, 0.80)), Roughness=0.03)
    fr = nt.n('ShaderNodeFresnel', IOR=1.47)
    mix = nt.n('ShaderNodeMixShader')
    nt.link(math_node(nt, 'MULTIPLY', fr.outputs['Fac'], 0.75), mix.inputs[0])
    nt.link(tr.outputs[0], mix.inputs[1])
    nt.link(gl.outputs[0], mix.inputs[2])
    output(nt, mix)
    return m


def mat_mango():
    m, nt = new_mat('mango')
    bump, nz, tc = noise_bump(nt, 70.0, 0.25, detail=4.0, distance=0.0005)
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 9.0)   # fibres
    nt.link(tc.outputs['Object'], mp.inputs['Vector'])
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    oi = nt.n('ShaderNodeObjectInfo')
    col = ramp(nt, oi.outputs['Random'], [(0.0, (0.95, 0.24, 0.006)), (1.0, (0.98, 0.40, 0.015))])
    p = principled(nt, **{'Roughness': 0.22, 'Subsurface Weight': 0.4,
                          'Subsurface Radius': (1.0, 0.45, 0.12), 'Subsurface Scale': 0.003,
                          'Coat Weight': 0.6, 'Coat Roughness': 0.05, 'sss_method': 'BURLEY'})
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
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', A=rgba((0.60, 0.012, 0.018)), B=rgba((0.85, 0.55, 0.12)))
    nt.link(seeds, mixc.inputs['Factor'])
    p = principled(nt, **{'Roughness': 0.22, 'Subsurface Weight': 0.35,
                          'Subsurface Radius': (1.0, 0.2, 0.15), 'Subsurface Scale': 0.003,
                          'Coat Weight': 0.5, 'Coat Roughness': 0.06, 'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    nt.link(bump.outputs['Normal'], p.inputs['Normal'])
    output(nt, p)
    return m


def mat_strawberry_flesh():
    """Cut face of a halved strawberry (the plane contains the fruit axis = local z, tip at z=-0.5):
    a pale pith core along the axis, pink-to-red flesh crossed by fine pale strands running out
    towards the skin, and a deep red rim."""
    m, nt = new_mat('strawberry_flesh')
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])
    rr = math_node(nt, 'SQRT', math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', sep.outputs[0], sep.outputs[0]),
                                          math_node(nt, 'MULTIPLY', sep.outputs[1], sep.outputs[1])))
    zz = sep.outputs[2]
    # local half-width of the fruit at this height (egg-ish, fat at the calyx end) -> q = 0 axis .. 1 skin
    zn = math_node(nt, 'ADD', zz, 0.5)                                   # 0 tip .. 1 calyx
    wid = math_node(nt, 'MULTIPLY', math_node(nt, 'POWER', math_node(nt, 'SINE', math_node(
        nt, 'MULTIPLY', math_node(nt, 'MINIMUM', math_node(nt, 'MULTIPLY', zn, 0.92), 1.0), math.pi), clamp=True),
        0.75), math_node(nt, 'ADD', 0.345, math_node(nt, 'MULTIPLY', zn, 0.115)))
    q = math_node(nt, 'DIVIDE', rr, math_node(nt, 'MAXIMUM', wid, 0.04), clamp=True)
    # strands: fine streaks that run from the core out to the skin (stretched noise across the axis)
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
    col = ramp(nt, qj, [(0.0, (0.93, 0.66, 0.56)), (0.17, (0.90, 0.50, 0.42)), (0.34, (0.84, 0.13, 0.11)),
                        (0.75, (0.72, 0.03, 0.04)), (0.93, (0.50, 0.008, 0.02))])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.92, 0.58, 0.50)))
    nt.link(math_node(nt, 'MULTIPLY', strand, 0.75), mixc.inputs['Factor'])
    nt.link(col.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.16, 'Subsurface Weight': 0.55,
                          'Subsurface Radius': (1.0, 0.22, 0.18), 'Subsurface Scale': 0.004,
                          'Coat Weight': 0.65, 'Coat Roughness': 0.04, 'sss_method': 'BURLEY'})
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
    m, nt = new_mat('kiwi')
    tc, sep, r, ang = radial_coords(nt)
    # seeds: voronoi cells in (angle, radius) space inside a ring
    comb = nt.n('ShaderNodeCombineXYZ')
    nt.link(math_node(nt, 'MULTIPLY', ang, 4.2), comb.inputs[0])
    nt.link(math_node(nt, 'MULTIPLY', r, 6.0), comb.inputs[1])
    vor = nt.n('ShaderNodeTexVoronoi', Scale=1.0, Randomness=0.8)
    nt.link(comb.outputs[0], vor.inputs['Vector'])
    ring = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', r, 0.30), math_node(nt, 'LESS_THAN', r, 0.54))
    seed = math_node(nt, 'MULTIPLY', ring, math_node(nt, 'LESS_THAN', vor.outputs['Distance'], 0.34))
    # radial streaks in the flesh
    nz = nt.n('ShaderNodeTexNoise', Scale=1.0, Detail=2.0)
    comb2 = nt.n('ShaderNodeCombineXYZ')
    nt.link(math_node(nt, 'MULTIPLY', ang, 12.0), comb2.inputs[0])
    nt.link(math_node(nt, 'MULTIPLY', r, 1.5), comb2.inputs[1])
    nt.link(comb2.outputs[0], nz.inputs['Vector'])
    f = math_node(nt, 'ADD', r, math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs['Fac'], 0.5), 0.12))
    flesh = ramp(nt, f, [(0.0, (0.90, 0.88, 0.62)), (0.26, (0.82, 0.83, 0.45)), (0.36, (0.36, 0.62, 0.05)),
                         (0.75, (0.20, 0.47, 0.02)), (0.92, (0.16, 0.38, 0.015)), (0.955, (0.22, 0.12, 0.03))])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.012, 0.01, 0.006)))
    nt.link(seed, mixc.inputs['Factor'])
    nt.link(flesh.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.2, 'Subsurface Weight': 0.5,
                          'Subsurface Radius': (0.5, 1.0, 0.25), 'Subsurface Scale': 0.003,
                          'Coat Weight': 0.55, 'Coat Roughness': 0.06, 'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_banana():
    m, nt = new_mat('banana')
    tc, sep, r, ang = radial_coords(nt)
    comb = nt.n('ShaderNodeCombineXYZ')
    nt.link(math_node(nt, 'MULTIPLY', ang, 1.6), comb.inputs[0])
    nt.link(math_node(nt, 'MULTIPLY', r, 12.0), comb.inputs[1])
    vor = nt.n('ShaderNodeTexVoronoi', Scale=1.0)
    nt.link(comb.outputs[0], vor.inputs['Vector'])
    seed = math_node(nt, 'MULTIPLY', math_node(nt, 'LESS_THAN', r, 0.2),
                     math_node(nt, 'LESS_THAN', vor.outputs['Distance'], 0.22))
    flesh = ramp(nt, r, [(0.0, (0.78, 0.64, 0.30)), (0.25, (0.90, 0.78, 0.42)), (0.9, (0.92, 0.80, 0.46)),
                         (1.0, (0.85, 0.70, 0.33))])
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.45, 0.33, 0.14)))
    nt.link(math_node(nt, 'MULTIPLY', seed, 0.8), mixc.inputs['Factor'])
    nt.link(flesh.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.3, 'Subsurface Weight': 0.6,
                          'Subsurface Radius': (1.0, 0.8, 0.45), 'Subsurface Scale': 0.003,
                          'Coat Weight': 0.3, 'Coat Roughness': 0.1, 'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_pistachio():
    m, nt = new_mat('pistachio')
    oi = nt.n('ShaderNodeObjectInfo')
    tc = nt.n('ShaderNodeTexCoord')
    nz = nt.n('ShaderNodeTexNoise', Scale=2.2, Detail=1.0)
    nt.link(tc.outputs['Object'], nz.inputs['Vector'])
    green = ramp(nt, oi.outputs['Random'], [(0.0, (0.14, 0.40, 0.025)), (0.5, (0.28, 0.55, 0.05)),
                                            (0.85, (0.50, 0.62, 0.12)), (1.0, (0.62, 0.58, 0.22))])
    skin = math_node(nt, 'GREATER_THAN', nz.outputs['Fac'], 0.58)
    mixc = nt.n('ShaderNodeMix', _data_type='RGBA', B=rgba((0.28, 0.07, 0.10)))
    nt.link(math_node(nt, 'MULTIPLY', skin, 0.9), mixc.inputs['Factor'])
    nt.link(green.outputs['Color'], mixc.inputs[6])
    p = principled(nt, **{'Roughness': 0.5, 'Subsurface Weight': 0.3,
                          'Subsurface Radius': (0.6, 1.0, 0.3), 'Subsurface Scale': 0.0008,
                          'sss_method': 'BURLEY'})
    nt.link(mixc.outputs[2], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_sticker(img_path):
    m, nt = new_mat('sticker')
    tex = nt.n('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img_path)
    tex.interpolation = 'Cubic'
    tc = nt.n('ShaderNodeTexCoord')
    nt.link(tc.outputs['UV'], tex.inputs['Vector'])
    p = principled(nt, **{'Roughness': 0.32, 'Coat Weight': 0.8, 'Coat Roughness': 0.06,
                          'Specular IOR Level': 0.5})
    nt.link(tex.outputs['Color'], p.inputs['Base Color'])
    output(nt, p)
    return m


def mat_backdrop(albedo, emit, bounce=0.3, lit=0.3):
    """Seamless paper in brand turquoise. What the camera sees = a constant brand-colour glow (emit) + a
    fraction (lit) of real diffuse shading, so the colour is locked to #01E8D5 while the cup still casts a
    soft shadow. Diffuse bounces off it are toned down (like flagging the sweep) so the contents stay warm."""
    m, nt = new_mat('backdrop')
    d = nt.n('ShaderNodeBsdfDiffuse', Color=rgba(tuple(c * lit for c in albedo)), Roughness=0.0)
    # Studio falloff baked into the glow so the set is not a flat fill: a light pool behind the cup, the
    # floor settling a touch deeper towards the lens and the frame sides (the far sweep = the headline zone
    # stays at full brand level), and a real contact shadow (AO) where the cup meets the floor.
    tc = nt.n('ShaderNodeTexCoord')
    sep = nt.n('ShaderNodeSeparateXYZ')
    nt.link(tc.outputs['Object'], sep.inputs[0])

    def mrange(v, a, b, lo, hi):
        r = nt.n('ShaderNodeMapRange', _interpolation_type='SMOOTHSTEP')
        nt.link(v, r.inputs['Value'])
        for k, val in (('From Min', a), ('From Max', b), ('To Min', lo), ('To Max', hi)):
            r.inputs[k].default_value = val
        return r.outputs['Result']
    g_y = mrange(sep.outputs[1], -0.22, 0.30, 1.0 - SET_FALLOFF[0], 1.0)            # floor towards the lens
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
# geometry builders
# ------------------------------------------------------------------------------------------------
def build_cup(mat, seg=224):
    """Closed PET cup solid (outer wall, rolled rim bead, inner wall, floor with foot ring)."""
    prof = []
    # outer bottom, from the centre outwards
    prof += [(0.0, 0.0016), (R_BOT - 0.0075, 0.0016), (R_BOT - 0.0045, 0.0006), (R_BOT - 0.0028, 0.0)]
    for i in range(1, 6):  # rounded foot corner
        a = -math.pi / 2 + (math.pi / 2) * i / 5
        prof.append((R_BOT - 0.0028 + 0.0028 * math.cos(a) * 1.0, 0.0028 + 0.0028 * math.sin(a)))
    zs = np.linspace(0.0035, CUP_H - 0.0020, 28)
    prof += [(float(r_out(z)), float(z)) for z in zs]
    # rolled rim bead
    cx, cz, rb = float(R_TOP) + 0.0003, CUP_H - 0.0001, 0.00135
    for i in range(0, 17):
        a = math.radians(-70 + (250 + 70) * i / 16)   # from outer-bottom over the top to inner side
        prof.append((cx + rb * math.cos(a), cz + rb * math.sin(a)))
    zs = np.linspace(CUP_H - 0.0022, BASE_T + 0.0025, 28)
    prof += [(float(r_in(z)), float(z)) for z in zs]
    zf = BASE_T + 0.0025
    cxf = float(r_in(zf)) - 0.0025
    for i in range(1, 6):  # inner floor fillet: from the wall (0 deg) down to the floor (-90 deg)
        a = -(math.pi / 2) * i / 5
        prof.append((cxf + 0.0025 * math.cos(a), zf + 0.0025 * math.sin(a)))
    prof += [(cxf - 0.004, BASE_T), (0.0, BASE_T)]
    v, f = lathe(prof, seg)
    # close the loop: the profile starts and ends at the axis (two poles) -> lathe is closed already
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
    # caps
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
    """Qashta smeared on the inside of the PET over the fruit (streaky, partial, translucent at the edges):
    breaks the 'pieces pasted on a sheet' look -- this is what a real layered cup looks like."""
    m, nt = new_mat('smear')
    tc = nt.n('ShaderNodeTexCoord')
    mp = nt.n('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.0, 0.45)          # swipes run along the wall (filling)
    nt.link(tc.outputs['Object'], mp.inputs['Vector'])
    nz = nt.n('ShaderNodeTexNoise', Scale=48.0, Detail=1.5, Roughness=0.45)
    nt.link(mp.outputs[0], nz.inputs['Vector'])
    attr = nt.n('ShaderNodeAttribute', _attribute_name='edge')   # 1 near the qashta bands
    th = math_node(nt, 'SUBTRACT', 0.655, math_node(nt, 'MULTIPLY', attr.outputs['Fac'], 0.11))
    cov = math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs['Fac'], th), 7.0, clamp=True)
    cov = math_node(nt, 'MULTIPLY', math_node(nt, 'POWER', cov, 0.6), 0.9)
    p = principled(nt, **{'Base Color': (0.84, 0.82, 0.74), 'Roughness': 0.3, 'Subsurface Weight': 1.0,
                          'Subsurface Radius': (1.0, 0.92, 0.78), 'Subsurface Scale': 0.0012,
                          'sss_method': 'BURLEY'})
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
    # distance to the nearest qashta band boundary -> more cream pushed over the fruit there
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


class Dome:
    """Polar-grid mesh: height field top (phi 0..90deg), overhanging lip (90..PHI_MAX), tuck + skirt."""

    def __init__(self, mat, nphi=80, ns=220):
        self.ns = ns
        th = np.linspace(0, 2 * np.pi, ns, endpoint=False)
        phis = np.linspace(0, math.pi / 2, nphi)[1:] ** 1.0
        P, T = np.meshgrid(phis, th, indexing='ij')
        rr = DOME_RX * np.sin(P)
        self.x = np.concatenate([[0.0], (rr * np.cos(T)).ravel()])
        self.y = np.concatenate([[0.0], (rr * np.sin(T)).ravel()])
        self.n_top = len(self.x)
        # lip rings (static): continue the ellipse past the equator, then tuck in over the rim, skirt down
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
        self.ob = mesh_obj('dome', self.coords(Wobble(-1)), faces, mat)
        recalc_normals(self.ob)

    def coords(self, wob):
        z = wob.z(self.x, self.y)
        top = np.stack([self.x, self.y, z], -1)
        return np.concatenate([top, self.lip])

    def update(self, wob):
        set_verts(self.ob, self.coords(wob))


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
    for (u, v) in verts:   # u: along circumference (arc length), v: up the slanted wall
        z = STICKER_Z + v * math.cos(slope)
        r = float(r_out(z)) + 0.00018
        phi = STICKER_PHI + u / r
        out.append((r * math.cos(phi), r * math.sin(phi), z))
    # the decal's u axis must run left->right as seen from the front: flip by reversing phi direction
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


def rounded_cube_mesh(name, bev=0.2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bev, segments=3, affect='EDGES',
                    profile=0.5)
    rng = np.random.default_rng(zlib.crc32(name.encode()) % 1000)   # stable across processes (not hash())
    for v in bm.verts:
        v.co += Vector(rng.normal(0, 0.018, 3))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def disc_mesh(name, depth, seg=48, half=False, bev=0.12):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1.0, radius2=1.0,
                          depth=depth)
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
        s = i / 24.0            # 0 bottom tip -> 1 top (calyx)
        z = s * 1.0
        r = 0.46 * math.sin(math.pi * min(1.0, s * 0.92) ** 0.85) ** 0.75 * (0.75 + 0.25 * s)
        if s >= 0.999:
            r = 0.0
        prof.append((max(r, 0.0), z - 0.5))
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
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    cuts = [Vector(rng.normal(0, 1, 3)).normalized() for _ in range(2)]
    offs = rng.uniform(0.25, 0.55, 2)
    for v in bm.verts:
        v.co = v.co.normalized() * (1.0 + rng.normal(0, 0.16))
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
    me = ob.data
    co = get_verts(me)
    M = np.array(ob.matrix_basis)[:3, :3]
    local = co @ M.T                     # rotated + scaled, relative to the piece centre
    d = np.array([math.cos(theta), math.sin(theta), 0.0])
    radial = local @ d
    # start with the centre deep inside, then push out until max(r_vertex - r_in(z_vertex)) = -gap
    best = 0.0
    for _ in range(3):
        c = d * best + np.array([0, 0, zc])
        wp = local + c
        rv = np.sqrt(wp[:, 0] ** 2 + wp[:, 1] ** 2)
        over = rv - r_in(wp[:, 2]) + gap
        best -= over.max()
        if abs(over.max()) < 1e-6:
            break
    _ = radial
    ob.location = (d[0] * best, d[1] * best, zc)


def build_fruit(mats, coll):
    rng = np.random.default_rng(3)
    meshes = {
        'mango': [rounded_cube_mesh(f'mango{i}', 0.18 + 0.04 * i) for i in range(3)],
        'straw_half': [strawberry_mesh('straw_half')],
        'straw_q': [strawberry_mesh('straw_q', quarter=True)],
        'kiwi': [disc_mesh('kiwi', 0.30)],
        'kiwi_half': [disc_mesh('kiwi_half', 0.30, half=True)],
        'banana': [disc_mesh('banana', 0.42, bev=0.2)],
    }
    for me in meshes['straw_half'] + meshes['straw_q']:
        me.materials.append(mats['straw_skin'])
        me.materials.append(mats['straw_flesh'])
    for me in meshes['mango']:
        me.materials.append(mats['mango'])
    for k in ('kiwi', 'kiwi_half'):
        meshes[k][0].materials.append(mats['kiwi'])
    meshes['banana'][0].materials.append(mats['banana'])

    # hand-designed ring sequences so the visible front always shows a mix
    # procedural packing: two staggered rows per fruit layer, weighted type sequence, all around the wall
    kinds = ['straw_half', 'mango', 'straw_q', 'mango', 'kiwi_half', 'straw_half', 'mango', 'banana',
             'mango', 'straw_half', 'kiwi', 'mango', 'straw_q', 'banana']
    size_of = {'straw_half': 0.0185, 'straw_q': 0.0175, 'mango': 0.0170, 'kiwi': 0.0128, 'kiwi_half': 0.0140,
               'banana': 0.0104}
    plans = []
    k = 0
    for li, (za, zb) in enumerate(FRUIT_LAYERS):
        plan = []
        hgt = zb - za
        for row, fz in enumerate((0.34, 0.74)):
            n = 15
            for j in range(n):
                deg = -180 + 360 * (j + 0.5 * row + 0.25 * li) / n + rng.normal(0, 3.5)
                kind = kinds[k % len(kinds)]
                k += 3 if row else 1
                zc = za + hgt * fz + rng.normal(0, 0.0012)
                plan.append((kind, deg, zc, size_of[kind] * rng.uniform(0.82, 1.12), None))
        # a recessed back row fills the gaps between the front pieces with more (shaded) fruit
        for j in range(15):
            deg = -180 + 360 * (j + 0.25 + 0.25 * li) / 15 + rng.normal(0, 6)
            kind = kinds[(k + 5) % len(kinds)]
            k += 2
            zc = za + hgt * rng.uniform(0.3, 0.75)
            plan.append((kind, deg, zc, size_of[kind] * rng.uniform(0.8, 1.0), 0.0045))
        plans.append(plan)
    obs = []
    for plan in plans:
        for (kind, deg, zc, size, gap_back) in plan:
            th = math.radians(deg + rng.normal(0, 3))
            mesh_list = meshes[kind]
            me = mesh_list[rng.integers(len(mesh_list))]
            ob = bpy.data.objects.new(f'{kind}', me)
            coll.objects.link(ob)
            d = Vector((math.cos(th), math.sin(th), 0))
            if kind in ('kiwi', 'kiwi_half', 'banana'):
                # face the wall: local z axis -> radial, with a random roll and a slight tilt
                q = d.to_track_quat('Z', 'Y')
                roll = Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z') if kind != 'kiwi_half' else \
                    Matrix.Rotation(math.radians(rng.choice([0, 180]) + rng.normal(0, 25)), 4, 'Z')
                tilt = Matrix.Rotation(math.radians(rng.normal(0, 8)), 4, 'X')
                rot = q.to_matrix().to_4x4() @ tilt @ roll
                ob.matrix_basis = rot
                ob.scale = (size, size, size)
            elif kind.startswith('straw'):
                cut_out = rng.random() < 0.92
                q = (-d if cut_out else d).to_track_quat('X', 'Z')   # kept half: round side at +X
                spin = Matrix.Rotation(rng.uniform(0, 6.28), 4, 'X')
                ob.matrix_basis = q.to_matrix().to_4x4() @ spin
                ob.scale = (size * 1.38, size * 1.38, size * 1.38)
            else:
                ob.rotation_euler = Euler(rng.uniform(-0.5, 0.5, 3).tolist(), 'XYZ')
                s = size * rng.uniform(0.9, 1.1, 3)
                ob.scale = tuple(s.tolist())
            bpy.context.view_layer.update()
            gp = 0.0003 if rng.random() < 0.75 else 0.0014
            place_on_wall(ob, th, zc, gap=gap_back if gap_back else gp)
            obs.append(ob)
    return obs


class Pistachios:
    def __init__(self, mat, coll, wob0, n=125):
        rng = np.random.default_rng(21)
        self.meshes = [chunk_mesh(f'pist{i}', 100 + i) for i in range(8)]
        for me in self.meshes:
            me.materials.append(mat)
        self.items = []
        tries = 0
        while len(self.items) < n and tries < 5000:
            tries += 1
            # mostly on the upper scoops; keep the two landing zones clear for the drops
            rr = DOME_R * 0.84 * math.sqrt(rng.uniform(0, 1)) ** 1.25
            a = rng.uniform(0, 2 * math.pi)
            x, y = rr * math.cos(a), rr * math.sin(a)
            if any((x - ix) ** 2 + (y - iy) ** 2 < 0.0120 ** 2 for ix, iy in IMPACTS):
                continue
            dust = len(self.items) >= 55
            size = rng.uniform(0.00035, 0.0007) if dust else rng.uniform(0.0012, 0.0022)
            ob = bpy.data.objects.new('pistachio', self.meshes[rng.integers(len(self.meshes))])
            coll.objects.link(ob)
            ob.scale = (size, size * rng.uniform(0.6, 1.0), size)
            ob.rotation_mode = 'XYZ'
            self.items.append((ob, x, y, size, rng.uniform(0, 6.28), rng.normal(0, 0.5), rng.normal(0, 0.5)))
        self.update(wob0)

    def update(self, wob):
        for (ob, x, y, size, rz, rx, ry) in self.items:
            z = float(wob.z(x, y))
            n = dome_normal(x, y, wob)
            q = Vector(n).to_track_quat('Z', 'Y')
            e = (q.to_matrix().to_4x4() @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X')
                 @ Matrix.Rotation(ry, 4, 'Y')).to_euler('XYZ')
            ob.rotation_euler = e
            ob.location = (x + n[0] * size * 0.2, y + n[1] * size * 0.2, z + n[2] * size * 0.25)


# ------------------------------------------------------------------------------------------------
# honey: drizzle on the dome that continues over the rim into a slow drip down the wall
# ------------------------------------------------------------------------------------------------
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


DRIZZLE_XY = [(0.030, 0.022), (0.010, 0.030), (-0.022, 0.022), (-0.004, 0.012), (0.026, 0.008),
              (0.014, -0.004), (-0.026, 0.001), (-0.030, -0.012), (-0.012, -0.016), (0.022, -0.020),
              (0.012, -0.030), (-0.012, -0.030)]


def honey_path(t, wob):
    """Centre-line points, surface normals, half-widths, half-heights of the honey ribbon."""
    rng = np.random.default_rng(5)
    xy = catmull(DRIZZLE_XY, 14)
    # exit towards the drip point on the edge of the mound
    r_exit = DOME_RX * 0.90
    dvec = np.array([math.cos(DRIP_PHI), math.sin(DRIP_PHI), 0.0])
    tgt = dvec[:2] * r_exit
    last = xy[-1]
    seg = np.linspace(0, 1, 18)[1:]
    xy = np.vstack([xy, last[None] + (tgt - last)[None] * seg[:, None]])
    z = wob.z(xy[:, 0], xy[:, 1])
    pts = [np.array([x, y, zz]) for (x, y), zz in zip(xy, z)]
    nrm = [dome_normal(x, y, wob) for (x, y) in xy]
    n_d = len(pts)
    w = list(0.0025 + 0.0007 * np.sin(np.linspace(0, 17, n_d)) + rng.normal(0, 0.00008, n_d))
    h = list(0.00085 + 0.00022 * np.sin(np.linspace(0, 11, n_d) + 1))
    # over the rounded lip of the mound (ellipse continued past the equator)
    ph0 = math.asin(0.90)
    for ph in np.linspace(ph0, DOME_PHI_MAX, 12)[1:]:
        rr = DOME_RX * math.sin(ph)
        zz = DOME_ZC + DOME_HZ * math.cos(ph)
        pts.append(dvec * rr + np.array([0, 0, zz]))
        n = dvec * math.sin(ph) / DOME_RX + np.array([0, 0, math.cos(ph) / DOME_HZ])
        nrm.append(n / np.linalg.norm(n))
        w.append(0.0023)
        h.append(0.0009)
    # down the outer wall: grows with time, bulb at the tip
    L = 0.0035 + 0.029 * (ease_in_out(t / 4.9) ** 1.05)
    slope = (R_TOP - R_BOT) / CUP_H
    z_top = CUP_H + 0.0008
    nseg = max(5, int(L / 0.0006))
    tang = np.array([-dvec[1], dvec[0], 0])
    for i in range(1, nseg + 1):
        s = i / nseg
        dz = L * s
        zz = z_top - dz
        wob_x = 0.0008 * math.sin(dz * 240 + 0.5) * s
        rr = float(r_out(zz)) + 0.0002
        pts.append(dvec * rr + tang * wob_x + np.array([0, 0, zz]))
        n = dvec + np.array([0, 0, slope])
        nrm.append(n / np.linalg.norm(n))
        bulb = math.exp(-((1 - s) * L / 0.0034) ** 2)
        w.append(0.0020 - 0.0005 * s + 0.0012 * bulb)
        h.append(0.0008 + 0.0013 * bulb)
    return np.array(pts), np.array(nrm), np.array(w), np.array(h)


def tube_mesh(pts, nrm, w, h, nsec=14):
    n = len(pts)
    T = np.gradient(pts, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
    verts, faces = [], []
    # rounded end caps: taper the first/last few rings
    cap = 5
    scale = np.ones(n)
    for k in range(cap):
        f = math.sqrt(1 - ((cap - k) / (cap + 0.3)) ** 2)
        scale[k] = min(scale[k], f)
        scale[n - 1 - k] = min(scale[n - 1 - k], f)
    for i in range(n):
        N = nrm[i] - np.dot(nrm[i], T[i]) * T[i]
        N /= np.linalg.norm(N) + 1e-12
        B = np.cross(T[i], N)
        for j in range(nsec):
            a = 2 * math.pi * j / nsec
            sa, ca = math.sin(a), math.cos(a)
            up = h[i] * (sa if sa > 0 else sa * 0.35) + h[i] * 0.18
            verts.append(pts[i] + N * up * scale[i] + B * (w[i] * ca * scale[i]))
    for i in range(n - 1):
        for j in range(nsec):
            a, b = i * nsec + j, i * nsec + (j + 1) % nsec
            faces.append((a, b, b + nsec, a + nsec))
    c0 = len(verts)
    verts.append(pts[0] + nrm[0] * h[0] * 0.18)
    c1 = len(verts)
    verts.append(pts[-1] + nrm[-1] * h[-1] * 0.18)
    faces += [(c0, (j + 1) % nsec, j) for j in range(nsec)]
    last = (n - 1) * nsec
    faces += [(c1, last + j, last + (j + 1) % nsec) for j in range(nsec)]
    return np.array(verts), faces


class Honey:
    def __init__(self, mat, coll):
        me = bpy.data.meshes.new('honey')
        self.ob = bpy.data.objects.new('honey', me)
        coll.objects.link(self.ob)
        me.materials.append(mat)

    def update(self, t, wob):
        pts, nrm, w, h = honey_path(t, wob)
        v, f = tube_mesh(pts, nrm, w, h)
        me = self.ob.data
        me.clear_geometry()
        me.from_pydata(v.tolist(), [], f)
        me.shade_smooth()
        me.update()


# ------------------------------------------------------------------------------------------------
# the two qashta drops (the ق dots)
# ------------------------------------------------------------------------------------------------
DROP_RINGS, DROP_SEG = 34, 44
DROP_M = 0.62          # falling-drop tip: a rounded teardrop like the logo's dots (not a pointed cone)


def drop_profile(m, width, height, shear=0.0):
    """Teardrop-ish solid of revolution, tip up. m: tip sharpness (1.4 falling drop, 0.6 dollop)."""
    ts = np.linspace(0, math.pi, DROP_RINGS)
    r = width * np.sin(ts) * np.power(np.sin(ts / 2), m)
    z = height * 0.5 * np.cos(ts)          # +h/2 at the tip (t=0), -h/2 at the bottom (t=pi)
    return r, z


class Drop:
    FALL = 0.42          # seconds from entering (above the frame) to contact

    def __init__(self, name, mat, coll, ix, iy, t_land, tilt):
        self.ix, self.iy, self.tl, self.tilt = ix, iy, t_land, tilt
        ts = np.linspace(0, math.pi, DROP_RINGS)
        self.ang = np.linspace(0, 2 * math.pi, DROP_SEG, endpoint=False)
        verts = [(0, 0, 0)] * (2 + (DROP_RINGS - 2) * DROP_SEG)
        faces = []
        for j in range(DROP_SEG):
            faces.append((0, 1 + j, 1 + (j + 1) % DROP_SEG))
        for i in range(DROP_RINGS - 3):
            for j in range(DROP_SEG):
                a = 1 + i * DROP_SEG + j
                b = 1 + i * DROP_SEG + (j + 1) % DROP_SEG
                faces.append((a, a + DROP_SEG, b + DROP_SEG, b))
        last = 1 + (DROP_RINGS - 3) * DROP_SEG
        bot = len(verts) - 1
        for j in range(DROP_SEG):
            faces.append((last + j, bot, last + (j + 1) % DROP_SEG))
        _ = ts
        self.ob = mesh_obj(name, verts, faces, mat)
        coll.objects.link(self.ob) if coll else None
        self.ob.rotation_mode = 'XYZ'
        self.set_shape(DROP_M, 0.0108, 0.0215, 0.0)
        recalc_normals(self.ob)

    def set_shape(self, m, width, height, shear):
        r, z = drop_profile(m, width, height)
        co = [(0.0, 0.0, z[0])]
        for i in range(1, DROP_RINGS - 1):
            s = (z[i] + height / 2) / height     # 0 bottom .. 1 top
            sx = shear * s * s
            for a in self.ang:
                co.append((r[i] * math.cos(a) + sx, r[i] * math.sin(a), z[i]))
        co.append((0.0, 0.0, z[-1]))
        set_verts(self.ob, co)

    def state(self, t, wob):
        """-> dict(loc, rot, scale, shape) or None when not in the shot yet."""
        tl = self.tl
        t0 = tl - self.FALL
        zc = float(wob.z(self.ix, self.iy))
        H0, W0 = 0.0215, 0.0108
        if t <= tl:
            u = (t - t0) / self.FALL
            vis = u > -0.15
            u = max(u, -0.15)
            stretch = 1.0 + 0.07 * (0.3 + 1.4 * max(u, 0))
            zb_start, zb_contact = 0.26, zc - 0.0008
            sfall = 0.3 * u + 0.7 * u * u if u >= 0 else 0.3 * u
            zb = zb_start + (zb_contact - zb_start) * sfall
            wob_t = 0.05 * math.sin(t * 38 + self.tilt * 3)
            side = 0.003 * (1 - max(u, 0)) * math.copysign(1, self.tilt)
            return dict(loc=(self.ix - side, self.iy, zb + H0 * stretch / 2),
                        rot=(wob_t, self.tilt * 0.35 * (1 - max(u, 0)), 0.0),
                        scale=(1 / math.sqrt(stretch), 1 / math.sqrt(stretch), stretch),
                        shape=(DROP_M, W0, H0, 0.0), visible=vis)
        tau = t - tl
        # morph teardrop -> resting dollop (a soft kiss that leans like the dots of the logo)
        mm = 1 - math.exp(-tau / 0.05)
        m = DROP_M + (0.42 - DROP_M) * mm
        width = W0 + (0.0134 - W0) * mm
        height = H0 + (0.0180 - H0) * mm
        hf = 1.0 - 0.62 * math.exp(-6.5 * tau) * math.cos(math.pi * tau / 0.11) * (1 - math.exp(-tau / 0.012))
        hf = max(hf, 0.3)
        wf = 1 / math.sqrt(hf)
        n = dome_normal(self.ix, self.iy, wob)
        zb = zc - (0.0010 + 0.0046 * mm)
        shear = self.tilt * 0.0085 * mm
        rot = (math.atan2(-n[1], n[2]) * 0.7, math.atan2(n[0], n[2]) * 0.7, 0.0)
        return dict(loc=(self.ix, self.iy, zb + height * hf / 2), rot=rot, scale=(wf, wf, hf),
                    shape=(m, width, height, shear), visible=True)


class Splash:
    """Tiny cream droplets thrown out at each impact (slow-motion ballistic, then stick to the dome)."""

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
        for (ix, iy), tl in zip(IMPACTS, SPEC['drop_land']):
            for k in range(4):
                a = rng.uniform(0, 2 * math.pi)
                sp = rng.uniform(0.07, 0.13)
                vz = rng.uniform(0.10, 0.17)
                size = rng.uniform(0.0008, 0.0014)
                ob = bpy.data.objects.new('splash', me)
                coll.objects.link(ob)
                self.items.append((ob, ix, iy, tl, sp * math.cos(a), sp * math.sin(a), vz, size))

    def update(self, t, wob):
        g = -1.6
        for (ob, ix, iy, tl, vx, vy, vz, size) in self.items:
            tau = t - tl - 0.02
            if tau <= 0:
                ob.hide_render = True
                continue
            ob.hide_render = False
            z0 = float(wob.z(ix, iy)) + 0.004
            # find landing time
            tland = None
            for k in range(1, 80):
                tt = k * 0.005
                x, y = ix + vx * tt, iy + vy * tt
                if z0 + vz * tt + 0.5 * g * tt * tt <= float(wob.z(x, y)) and tt > 0.02:
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
                n = dome_normal(x, y, wob)
                ob.location = (x, y, float(wob.z(x, y)) + size * 0.15)
                ob.scale = (size * 1.35, size * 1.35, size * 0.45)
                ob.rotation_euler = (math.atan2(-n[1], n[2]), math.atan2(n[0], n[2]), 0)
            if abs(x) > DOME_R * 0.98 or abs(y) > DOME_R * 0.98:
                ob.hide_render = True


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
    # make sure normals face up / towards the camera
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


CAM = dict(az=(-17.0, 3.0), elev=(27.0, 22.0), dist=(0.565, 0.44), tz=(0.081, 0.0835))


def camera_state(t):
    """Slow push-in with a slight orbit + crane down (ease-out, already moving at the cut)."""
    u = min(max(t / (NFRAMES / FPS), 0.0), 1.0)
    e = 1 - (1 - u) ** 1.7                     # decelerating push
    e = 0.15 * u + 0.85 * e

    def lerp(k):
        return CAM[k][0] + (CAM[k][1] - CAM[k][0]) * e
    az, el, dist = math.radians(lerp('az')), math.radians(lerp('elev')), lerp('dist')
    tgt = np.array([0.0, 0.0, lerp('tz')])
    pos = tgt + dist * np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])
    focus = np.array([0.0, -0.022, 0.100])       # between the sticker and the front of the dome
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
    cy.denoising_prefilter = 'FAST'
    if hasattr(cy, 'denoising_quality'):
        cy.denoising_quality = 'HIGH'
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
    sc.render.film_transparent = False
    sc.view_settings.view_transform = args.view
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = args.exposure
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = 'sRGB'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
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
    bg = world.node_tree.nodes.get('Background') or world.node_tree.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (0.62, 0.66, 0.66, 1)
    bg.inputs['Strength'].default_value = args.world

    turq = hex_to_lin(SPEC['colors']['turquoise'])
    alb = tuple(float(v) for v in args.backdrop.split(',')) if args.backdrop else turq
    mats = {
        'qashta': mat_qashta(coat=0.22, rough=0.34, bump=0.18),
        'drop': mat_qashta('qashta_drop', bump=0.0, coat=0.75, rough=0.2),
        'core': mat_qashta('qashta_core', tint_attr='fruitmask', bump=0.35),
        'cup': mat_cup(),
        'honey': mat_honey(),
        'mango': mat_mango(),
        'straw_skin': mat_strawberry_skin(),
        'straw_flesh': mat_strawberry_flesh(),
        'kiwi': mat_kiwi(),
        'banana': mat_banana(),
        'pistachio': mat_pistachio(),
        'sticker': mat_sticker(args.sticker),
        'backdrop': mat_backdrop(alb, args.backdrop_emit, lit=args.backdrop_lit),
    }
    coll = sc.collection
    build_set(mats['backdrop'])
    build_cup(mats['cup'])
    _, band_fn = build_core(mats['core'])
    if not args.no_smear:
        build_smear(mat_smear(), band_fn)
    build_sticker(mats['sticker'])
    build_fruit(mats, coll)
    wob0 = Wobble(-1)
    S = {'dome': Dome(mats['qashta']), 'honey': Honey(mats['honey'], coll),
         'pist': Pistachios(mats['pistachio'], coll, wob0), 'splash': Splash(mats['drop'], coll)}
    S['drops'] = [Drop(f'drop{i}', mats['drop'], None, ix, iy, tl, tilt)
                  for i, ((ix, iy), tl, tilt) in enumerate(zip(IMPACTS, SPEC['drop_land'], (-0.45, 0.4)))]

    # floor props: a few out-of-focus pistachio crumbs near the base (depth + parallax)
    rng = np.random.default_rng(4)
    pm = S['pist'].meshes
    for k in range(6):
        ob = bpy.data.objects.new('floor_pist', pm[k % len(pm)])
        coll.objects.link(ob)
        a = rng.uniform(-2.3, -0.5)
        rr = rng.uniform(0.050, 0.080)
        sz = rng.uniform(0.0018, 0.0030)
        ob.location = (rr * math.cos(a), rr * math.sin(a), sz * 0.3)
        ob.rotation_euler = (0, 0, rng.uniform(0, 6.28))
        ob.scale = (sz, sz, sz)

    # light linking: subject lights never touch the set, the set light never touches the subject
    subject = bpy.data.collections.new('subject')
    setonly = bpy.data.collections.new('setonly')
    for ob in list(sc.objects):
        if ob.type != 'MESH':
            continue
        (setonly if (ob.name.startswith('sweep') or ob.name.startswith('floor')) else subject).objects.link(ob)

    L = args.light
    # food-style: big soft KEY from back-left-top (texture + gloss on cream/honey, fruit glows through the
    # PET), a front bounce FILL for the sticker/layers, two strip RIMS, a small TOP kicker
    kpos = (-0.30, 0.26, 0.38)
    area_light('key', 0.55, 0.45, kpos, (0, 0, 0.09), args.key * L, temp=5600, recv=subject)
    # same position, set only: the cup's soft shadow falls forward on the floor; set brightness decoupled
    area_light('key_set', 0.55, 0.45, kpos, (0.02, -0.03, 0.0), args.keyset * L, temp=6500, glossy=False,
               recv=setonly)
    # the broad fill must not show up as a milky veil across the PET -> diffuse only
    area_light('fill', 0.70, 0.55, (0.10, -0.60, 0.16), (0, 0, 0.07), args.fill * L, temp=5200, recv=subject,
               glossy=False)
    # glossy-only strip softboxes: the crisp vertical streaks that make clear plastic read as plastic and
    # put sharp wet highlights on honey, cream and fruit (they slide across the cup as the camera orbits)
    for nm, az, w, pw in (('specL', -68.0, 0.030, args.spec * 1.0), ('specR', 58.0, 0.050, args.spec * 0.8)):
        if pw <= 0:     # off by default: at a visible level they veil the fruit instead of drawing streaks
            continue
        a = math.radians(az)
        # the wall tilts up ~9 deg and the camera looks down 22-27 deg, so a reflection in the wall needs the
        # source a few degrees BELOW the reflecting point: floor-standing strips, like a real table-top set
        pos = (0.36 * math.sin(a), -0.36 * math.cos(a), 0.085)
        s = area_light(nm, w, 0.34, pos, (0, 0, 0.085), pw * L, temp=6000, recv=subject)
        s.visible_diffuse = False
        s.visible_transmission = False
        s.visible_volume_scatter = False
    area_light('top', 0.22, 0.22, (0.10, -0.05, 0.50), (0, 0, 0.11), 0.9 * L, temp=5800, recv=subject)
    area_light('rimL', 0.05, 0.50, (-0.30, 0.20, 0.22), (0, 0, 0.08), 3.2 * L, spread=50, temp=6200,
               recv=subject)
    area_light('rimR', 0.05, 0.50, (0.30, 0.22, 0.24), (0, 0, 0.08), 3.6 * L, spread=50, temp=6200,
               recv=subject)
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

    # keyframes for camera + falling drops (so Cycles motion blur sees the motion)
    for f in range(NFRAMES + 1):
        t = f / FPS
        pos, tgt, fd = camera_state(t)
        cam.location = pos.tolist()
        cam.rotation_euler = (Vector(tgt.tolist()) - Vector(pos.tolist())).to_track_quat('-Z', 'Y').to_euler()
        cam_d.dof.focus_distance = fd
        cam.keyframe_insert('location', frame=f + 1)
        cam.keyframe_insert('rotation_euler', frame=f + 1)
        cam_d.keyframe_insert('dof.focus_distance', frame=f + 1)
        wob = Wobble(t)
        for d in S['drops']:
            st = d.state(t, wob)
            d.ob.location = st['loc']
            d.ob.rotation_euler = st['rot']
            d.ob.scale = st['scale']
            for p in ('location', 'rotation_euler', 'scale'):
                d.ob.keyframe_insert(p, frame=f + 1)
    return S


def update_frame(S, t):
    wob = Wobble(t)
    S['dome'].update(wob)
    S['pist'].update(wob)
    S['honey'].update(t, wob)
    S['splash'].update(t, wob)
    for d in S['drops']:
        st = d.state(t, wob)
        d.ob.hide_render = not st['visible']
        d.set_shape(*st['shape'])


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


def main():
    argv = sys.argv[sys.argv.index('render') + 1:] if 'render' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--res', default='1080x1920')
    ap.add_argument('--frames', default='0', help='local frames, e.g. 0,30,45 or 0-149:2')
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
    ap.add_argument('--spec', type=float, default=0.0)
    ap.add_argument('--world', type=float, default=0.03)
    ap.add_argument('--backdrop', default='', help='linear albedo r,g,b (default: brand turquoise)')
    ap.add_argument('--backdrop-emit', type=float, default=0.77)
    ap.add_argument('--backdrop-lit', type=float, default=0.3)
    ap.add_argument('--save-blend', default='')
    ap.add_argument('--no-mblur', action='store_true')
    ap.add_argument('--no-smear', action='store_true')
    ap.add_argument('--shutter', type=float, default=0.8)
    ap.add_argument('--border', default='', help='debug crop: xmin,xmax,ymin,ymax (0-1, y up)')
    ap.add_argument('--hide', default='', help='debug: comma list of object name prefixes to hide')
    ap.add_argument('--cy', action='append', default=[], help='extra scene.cycles overrides key=value')
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()
    S = build_scene(args)
    print(f'[cup] scene built in {time.time() - t0:.1f}s', flush=True)
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    sc = bpy.context.scene
    for pre in filter(None, args.hide.split(',')):
        for ob in sc.objects:
            if ob.name.startswith(pre):
                ob.hide_render = True
    times = {}
    for lf in parse_frames(args.frames):
        t = lf / FPS
        ts = time.time()
        sc.frame_set(lf + 1)
        sc.render.use_motion_blur = (not args.no_mblur) and any(
            d.tl - d.FALL - 0.1 <= t <= d.tl + 0.06 for d in S['drops'])
        update_frame(S, t)
        tu = time.time() - ts
        sc.render.filepath = os.path.join(os.path.abspath(args.out), f'{lf:04d}.png')
        bpy.ops.render.render(write_still=True)
        times[lf] = round(time.time() - ts, 2)
        print(f'[cup] frame {lf:3d} t={t:4.2f}s  {times[lf]:6.1f}s (update {tu:.2f}s)', flush=True)
    json.dump({'times': times, 'args': vars(args), 'total_s': round(time.time() - t0, 1)},
              open(os.path.join(args.out, f'timing_{min(times) if times else 0:04d}.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
