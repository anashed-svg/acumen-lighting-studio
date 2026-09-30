"""Shared helpers for the Acumen Blender templates.

CLI + brand config, engine presets, small mesh/material/light helpers, and the
render pipeline: frames (PNG) -> optional OIDN denoise (Cycles) -> glare/vignette -> ffmpeg.
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINES = {'CYCLES': 'CYCLES', 'EEVEE': 'BLENDER_EEVEE', 'BLENDER_EEVEE': 'BLENDER_EEVEE',
           'WORKBENCH': 'BLENDER_WORKBENCH', 'BLENDER_WORKBENCH': 'BLENDER_WORKBENCH'}
BRAND_DEFAULTS = {
    'logo_svg': '../../video/public/logo-white.svg',
    'background': '#050505', 'ink': '#F4F1EA', 'glow': '#FFC478',
    'light_kelvin': 3000, 'white_balance_kelvin': 4000, 'sky_zenith': '#010204', 'sky_horizon': '#0C1422',
    'logo_style': 'metal', 'logo_metal': '#D9D6D0',
    'font_latin': 'Poppins Light', 'font_latin_weight': 300, 'font_arabic': 'Noto Kufi Arabic', 'font_arabic_weight': 300,
    'tracking_em': 0.38, 'tagline_en': 'CRAFTING THE ATMOSPHERE', 'tagline_ar': 'نصنع الأجواء',
}


# ---------------------------------------------------------------- CLI / brand

def parse_args(name, extra=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    script = next((os.path.basename(sys.argv[i + 1]) for i, v in enumerate(sys.argv[:-1])
                   if v in ('-P', '--python')), f'{name}.py')
    p = argparse.ArgumentParser(prog=f'blender -b --factory-startup -P {script} --')
    p.add_argument('--out', default=os.path.join(HERE, 'out', name),
                   help='PNG frames -> OUT/, video -> OUT.mp4 (default: out/ next to this script)')
    p.add_argument('--engine', default='CYCLES', type=str.upper, choices=sorted(ENGINES))
    p.add_argument('--res', default='640x360')
    p.add_argument('--frames', type=int, default=48)
    p.add_argument('--fps', type=int, default=24)
    p.add_argument('--samples', type=int, default=16, help='Cycles path samples / EEVEE TAA samples')
    p.add_argument('--denoise', choices=['auto', 'oidn', 'off'], default='auto',
                   help='Cycles only: Intel OIDN via the pyoidn package (auto = use it if installed)')
    p.add_argument('--brand', default=os.path.join(HERE, 'brand.json'))
    p.add_argument('--threads', type=int, default=0, help='render threads (0 = all cores)')
    p.add_argument('--transparent', action='store_true', help='alpha background, also writes OUT.mov (ProRes 4444)')
    p.add_argument('--save-blend', action='store_true', help='also save OUT.blend to open in the Blender GUI')
    p.add_argument('--no-render', action='store_true', help='only build the scene')
    if extra:
        extra(p)
    a = p.parse_args(argv)
    a.engine = ENGINES[a.engine]
    a.width, a.height = map(int, a.res.lower().split('x'))
    a.out = os.path.abspath(a.out.rstrip('/'))
    return a


def load_brand(path):
    with open(path, encoding='utf-8') as f:
        brand = {**BRAND_DEFAULTS, **json.load(f)}
    brand['logo_svg'] = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(path)), brand['logo_svg']))
    return brand


# ---------------------------------------------------------------- colour

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    """'#RRGGBB' (sRGB) -> linear RGB tuple."""
    h = h.lstrip('#')
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def kelvin(k, white=6500):
    """Colour temperature -> linear RGB (Tanner Helland fit) as seen by a camera balanced
    to `white` kelvin; the same numbers drive Cycles, EEVEE and Workbench."""
    def raw(k):
        t = k / 100
        r = 255 if t <= 66 else 329.699 * (t - 60) ** -0.13320
        g = 99.4708 * math.log(t) - 161.1196 if t <= 66 else 288.1222 * (t - 60) ** -0.07551
        b = 255 if t >= 66 else 0 if t <= 19 else 138.5177 * math.log(t - 10) - 305.0448
        return [lin(min(max(c, 0), 255) / 255) for c in (r, g, b)]
    c = [x / w for x, w in zip(raw(k), raw(white))]
    return tuple(x / max(c) for x in c)


# ---------------------------------------------------------------- scene / engines

def new_scene(a, look='AgX - Medium High Contrast', exposure=0.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    r = s.render
    r.engine = a.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = a.width, a.height, 100
    r.fps, s.frame_start, s.frame_end = a.fps, 1, a.frames
    r.film_transparent = a.transparent
    if a.threads:
        r.threads_mode, r.threads = 'FIXED', a.threads
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = look
    s.view_settings.exposure = exposure

    if a.engine == 'CYCLES':
        c = s.cycles
        c.device, c.samples = 'CPU', a.samples
        c.use_adaptive_sampling, c.adaptive_threshold = True, 0.02
        c.use_denoising = False  # the apt build has no OIDN; see denoise.py
        c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 6, 2, 3
        c.transmission_bounces, c.volume_bounces = 4, 1
        c.caustics_reflective = c.caustics_refractive = False
        c.sample_clamp_indirect, c.blur_glossy = 4.0, 1.0
        r.use_persistent_data = True  # keep the BVH between frames (camera-only animation)
    elif a.engine == 'BLENDER_EEVEE':
        e = s.eevee
        e.taa_render_samples = a.samples
        e.use_soft_shadows, e.use_shadow_high_bitdepth = True, True
        e.shadow_cube_size, e.shadow_cascade_size = '1024', '1024'
        e.use_gtao, e.gtao_distance = True, 0.8
        e.use_ssr, e.use_ssr_halfres, e.ssr_thickness, e.ssr_firefly_fac = True, False, 0.3, 1.0
        e.use_bloom = False  # glare is done in the compositor for every engine
    else:
        sh = s.display.shading
        sh.light, sh.color_type = 'STUDIO', 'MATERIAL'
        sh.show_cavity, sh.cavity_type = True, 'WORLD'
        s.display.render_aa = '8'
    return s


def world(s, color_nodes):
    """Create the world; color_nodes(nt) -> output socket feeding the Background colour."""
    w = bpy.data.worlds.new('World')
    s.world, w.use_nodes = w, True
    nt = w.node_tree
    bg = nt.nodes['Background']
    nt.links.new(color_nodes(nt), bg.inputs['Color'])
    return w


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def box(name, lo, hi, mat=None):
    lo, hi = Vector(lo), Vector(hi)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = (lo + hi) / 2 + Vector(c * d for c, d in zip(v.co, hi - lo))
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()
    return ob


def light(name, kind, loc, target=None, power=100.0, color=(1, 1, 1), **props):
    data = bpy.data.lights.new(name, kind)
    data.energy, data.color = power, color
    for k, v in props.items():
        setattr(data, k, v)
    ob = link(bpy.data.objects.new(name, data))
    ob.location = loc
    if target:
        aim(ob, target)
    return ob


def camera(loc, target, lens=35.0):
    cam = bpy.data.cameras.new('Camera')
    cam.lens, cam.sensor_width, cam.clip_end = lens, 36.0, 500.0
    ob = link(bpy.data.objects.new('Camera', cam))
    ob.location = loc
    tgt = link(bpy.data.objects.new('CameraTarget', None))
    tgt.location = target
    con = ob.constraints.new('TRACK_TO')
    con.target, con.track_axis, con.up_axis = tgt, 'TRACK_NEGATIVE_Z', 'UP_Y'
    bpy.context.scene.camera = ob
    return ob, tgt


def keys(owner, path, values, frames, easing='EASE_IN_OUT', index=-1):
    """Keyframe owner.path at the given frames: Bezier ease in/out, or 'LINEAR'."""
    for f, v in zip(frames, values):
        if index < 0:
            setattr(owner, path, v)
        else:
            getattr(owner, path)[index] = v
        owner.keyframe_insert(path, frame=f, index=index)
    full = owner.path_from_id(path)
    for fc in owner.id_data.animation_data.action.fcurves:
        if fc.data_path == full:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR' if easing == 'LINEAR' else 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'


# ---------------------------------------------------------------- materials

def material(name, color=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, spec=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = (*(emit if emit and strength else color), 1)  # Workbench preview colour
    m.roughness, m.metallic = rough, metal
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    m.diffuse_color = (*color, 1)
    return m


def add(nt, kind, *links, **inputs):
    """Create a node; positional args feed its inputs in order (socket -> link, value -> default),
    keyword args set inputs by name or node properties."""
    n = nt.nodes.new(kind)
    for i, src in enumerate(links):
        if isinstance(src, bpy.types.NodeSocket):
            nt.links.new(src, n.inputs[i])
        elif src is not None:
            n.inputs[i].default_value = src
    for k, v in inputs.items():
        if k in n.inputs:
            n.inputs[k].default_value = v
        else:
            setattr(n, k, v)
    return n


# ---------------------------------------------------------------- render pipeline

def _clean(folder, patterns=('.png', '.hdr')):
    os.makedirs(folder, exist_ok=True)
    for f in os.listdir(folder):
        if f.endswith(patterns):
            os.remove(os.path.join(folder, f))


def _post_chain(s, src, glare, vignette):
    """src socket -> fog glow -> vignette -> Composite."""
    nt = s.node_tree
    if glare:
        g = add(nt, 'CompositorNodeGlare', src, glare_type='FOG_GLOW', quality='HIGH',
                threshold=glare.get('threshold', 1.0), mix=glare.get('mix', -0.6), size=glare.get('size', 8))
        src = g.outputs[0]
    if vignette:
        canvas = add(nt, 'CompositorNodeMath', src, 0.0, operation='MULTIPLY')  # gives the mask a resolution
        aspect = s.render.resolution_y / s.render.resolution_x  # mask sizes are relative to the width
        e = add(nt, 'CompositorNodeEllipseMask', canvas.outputs[0], width=1.15, height=1.3 * aspect)
        b = add(nt, 'CompositorNodeBlur', e.outputs[0], filter_type='GAUSS', use_relative=True,
                factor_x=30, factor_y=30)
        m = add(nt, 'CompositorNodeMapRange', b.outputs[0], **{'From Min': 0.0, 'From Max': 1.0,
                                                              'To Min': 1.0 - vignette, 'To Max': 1.0})
        mix = add(nt, 'CompositorNodeMixRGB', None, src, m.outputs[0], blend_type='MULTIPLY')
        src = mix.outputs[0]
    return src


def _compositor(s, source='render', glare=None, vignette=0.0, seq=None, frames=0):
    s.use_nodes = True
    nt = s.node_tree
    nt.nodes.clear()
    comp = nt.nodes.new('CompositorNodeComposite')
    if source == 'render':
        rl = nt.nodes.new('CompositorNodeRLayers')
        img, alpha = rl.outputs['Image'], rl.outputs['Alpha']
    else:  # denoised HDR sequence (+ alpha sequence when transparent)
        img_node = add(nt, 'CompositorNodeImage', image=_load_seq(seq['color']),
                       frame_duration=frames, frame_start=1, frame_offset=0)
        img, alpha = img_node.outputs['Image'], None
        if seq.get('alpha'):
            a_node = add(nt, 'CompositorNodeImage', image=_load_seq(seq['alpha'], 'Non-Color'),
                         frame_duration=frames, frame_start=1, frame_offset=0)
            alpha = a_node.outputs['Image']
    out = _post_chain(s, img, None if s.render.film_transparent else glare,
                      0 if s.render.film_transparent else vignette)
    if s.render.film_transparent and alpha is not None:
        sa = add(nt, 'CompositorNodeSetAlpha', out, alpha, mode='REPLACE_ALPHA')
        out = sa.outputs[0]
    nt.links.new(out, comp.inputs['Image'])
    return nt


def _load_seq(path, colorspace=None):
    img = bpy.data.images.load(path)
    img.source = 'SEQUENCE'
    if colorspace:
        img.colorspace_settings.name = colorspace
    return img


def _render_animation(s, times=None):
    """Render the frame range; times gets the wall-clock seconds of each frame (sync + render + save)."""
    t = {'last': time.perf_counter()}

    def written(*_):
        now = time.perf_counter()
        if times is not None:
            times.append(round(now - t['last'], 2))
        t['last'] = now

    bpy.app.handlers.render_write.append(written)
    try:
        bpy.ops.render.render(animation=True)
    finally:
        bpy.app.handlers.render_write.remove(written)


def _oidn_python(mode):
    if mode == 'off':
        return None
    py = os.environ.get('ACUMEN_PYTHON') or shutil.which('python3')
    ok = py and subprocess.run([py, '-c', 'import pyoidn, cv2'], capture_output=True).returncode == 0
    if not ok and mode == 'oidn':
        raise RuntimeError('--denoise oidn needs `python3 -m pip install pyoidn` (or set ACUMEN_PYTHON)')
    if not ok:
        print('[acumen] pyoidn not found: rendering Cycles without denoising')
    return py if ok else None


def _set_png(s, folder, rgba):
    im = s.render.image_settings
    im.file_format, im.color_mode, im.color_depth, im.compression = 'PNG', 'RGBA' if rgba else 'RGB', '8', 15
    s.render.filepath = os.path.join(folder, '')


def _passes_stage(s, passes, rgba):
    """Stage A: noisy colour + albedo + normal (+ alpha) as Radiance HDR for denoise.py."""
    s.view_layers[0].cycles.denoising_store_passes = True
    s.use_nodes = True
    nt = s.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    nt.links.new(rl.outputs['Image'], nt.nodes.new('CompositorNodeComposite').inputs['Image'])
    # normals are stored as n * 0.5 + 0.5 because .hdr cannot hold negatives
    mul = add(nt, 'CompositorNodeMixRGB', None, rl.outputs['Denoising Normal'], blend_type='MULTIPLY', use_clamp=False)
    mul.inputs[2].default_value = (0.5, 0.5, 0.5, 1)
    enc = add(nt, 'CompositorNodeMixRGB', None, mul.outputs[0], blend_type='ADD', use_clamp=False)
    enc.inputs[2].default_value = (0.5, 0.5, 0.5, 1)
    fo = nt.nodes.new('CompositorNodeOutputFile')
    fo.base_path = os.path.join(passes, '')
    fo.format.file_format = 'HDR'
    fo.file_slots[0].path = 'albedo_'
    fo.file_slots.new('normal_')
    nt.links.new(rl.outputs['Denoising Albedo'], fo.inputs[0])
    nt.links.new(enc.outputs[0], fo.inputs[1])
    if rgba:
        fo.file_slots.new('alpha_')
        nt.links.new(rl.outputs['Alpha'], fo.inputs[2])
    im = s.render.image_settings
    im.file_format, im.color_mode = 'HDR', 'RGB'
    s.render.filepath = os.path.join(passes, 'color_')


def render(s, a, glare=None, vignette=0.2):
    """Render a.frames frames to a.out/####.png and encode a.out + '.mp4' (and .mov if transparent)."""
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.out + '.blend', check_existing=False)
    if a.no_render:
        return
    frames, rgba = a.out, a.transparent
    _clean(frames)
    workbench = a.engine == 'BLENDER_WORKBENCH'
    py = _oidn_python(a.denoise) if a.engine == 'CYCLES' else None
    stats = {'engine': a.engine, 'res': f'{a.width}x{a.height}', 'frames': a.frames,
             'samples': a.samples, 'denoise': 'oidn' if py else 'off', 'cpu_threads': os.cpu_count()}
    times, t0 = [], time.perf_counter()
    if py:
        passes = os.path.join(frames, '_passes')
        shutil.rmtree(passes, ignore_errors=True)
        _passes_stage(s, passes, rgba)
        _render_animation(s, times)
        td = time.perf_counter()
        subprocess.run([py, os.path.join(HERE, 'denoise.py'), passes], check=True)
        stats['denoise_s'] = round(time.perf_counter() - td, 2)
        seq = {'color': os.path.join(passes, 'denoised_0001.hdr')}
        if rgba:
            seq['alpha'] = os.path.join(passes, 'alpha_0001.hdr')
        _compositor(s, 'sequence', glare, vignette, seq, a.frames)
        _set_png(s, frames, rgba)
        tc = time.perf_counter()
        _render_animation(s)  # compositor only: no 3D render happens here
        stats['composite_s'] = round(time.perf_counter() - tc, 2)
        shutil.rmtree(passes)
    else:
        _compositor(s, 'render', None if workbench else glare, vignette)
        _set_png(s, frames, rgba)
        _render_animation(s, times)
    rest = times[1:] or times
    stats['render_s_per_frame'] = times
    stats['avg_s_per_frame'] = round(sum(times) / max(len(times), 1), 2)
    stats['avg_s_per_frame_after_first'] = round(sum(rest) / max(len(rest), 1), 2)
    encode(frames, a.fps, rgba)
    stats['total_s'] = round(time.perf_counter() - t0, 2)
    with open(frames + '.json', 'w') as f:
        json.dump(stats, f, indent=1)
    print(f"[acumen] {os.path.basename(frames)}: {a.engine} {stats['res']} x{a.frames} "
          f"avg {stats['avg_s_per_frame']}s/frame (after first {stats['avg_s_per_frame_after_first']}s), "
          f"denoise {stats['denoise']}, total {stats['total_s']}s -> {frames}.mp4")


def encode(frames, fps, rgba=False):
    src = ['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(frames, '%04d.png')]
    flat = 'premultiply=inplace=1,format=yuv420p' if rgba else 'format=yuv420p'
    subprocess.run(src + ['-vf', flat, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                          '-movflags', '+faststart', frames + '.mp4'], check=True)
    if rgba:
        subprocess.run(src + ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
                              frames + '.mov'], check=True)


def run(main):
    """Run main() and make Blender exit non-zero on errors (it exits 0 by default)."""
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
