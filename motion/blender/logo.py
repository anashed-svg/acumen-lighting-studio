"""Logo end card: brand SVG extruded + bevelled (metal or emissive), revealed by a rim light,
a light sweep across the face, then the bilingual tagline (Arabic shaped by Inkscape/HarfBuzz).

blender -b --factory-startup -P logo.py -- --out out/logo --engine CYCLES --res 640x360 --frames 48 --samples 16
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
from xml.sax.saxutils import escape

import bpy

sys.dont_write_bytecode = True  # keep the template folder clean
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

LOGO_W = 2.0  # logo width in metres; everything else is laid out relative to it


def import_svg(path, name):
    """Import an SVG as one joined, centred, flat curve object (scale applied)."""
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    parts = [o for o in bpy.data.objects if o not in before]
    if not parts:
        raise RuntimeError(f'no paths imported from {path}')
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    ob.location = (0, 0, 0)
    for coll in list(ob.users_collection):
        coll.objects.unlink(ob)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.clear()  # drop the SVG fill colours, we assign our own
    return ob


def fit(ob, width=None, height=None):
    """Uniformly scale (and apply) so the flat curve is `width` wide or `height` tall."""
    w, h = ob.dimensions.x, ob.dimensions.y
    k = width / w if width else height / h
    ob.scale = (k, k, k)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return ob


def text_svg(text, family, weight, tracking_em, rtl, folder, name):
    """Shape text with Inkscape (Pango/HarfBuzz: Arabic joins + RTL) and return an outline SVG."""
    size = 200
    src, dst = os.path.join(folder, f'{name}.svg'), os.path.join(folder, f'{name}_paths.svg')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="600">'
                f'<text x="4000" y="400" text-anchor="middle" direction="{"rtl" if rtl else "ltr"}" '
                f'style="font-family:\'{family}\';font-weight:{weight};font-size:{size}px;'
                f'letter-spacing:{0 if rtl else tracking_em * size}px;fill:#fff">{escape(text)}</text></svg>')
    # text -> glyph paths -> one union path: joined Arabic letters and variable-font glyphs overlap,
    # and Blender fills overlapping splines even-odd (the overlaps would turn into holes)
    actions = ('select-all:all;object-to-path;select-all:all;selection-ungroup;select-by-element:path;'
               f'path-union;export-plain-svg;export-filename:{dst};export-do')
    subprocess.run(['inkscape', src, f'--actions={actions}'], check=True, capture_output=True,
                   env={**os.environ, 'LC_ALL': 'C.UTF-8'})
    return dst


def front_factor(nt):
    """1 on the flat front/back caps, 0 on the extruded sides and bevels (object-space normal Z)."""
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    obj_n = C.add(nt, 'ShaderNodeVectorTransform', geo.outputs['Normal'], vector_type='NORMAL',
                  convert_from='WORLD', convert_to='OBJECT')
    z = C.add(nt, 'ShaderNodeSeparateXYZ', obj_n.outputs[0]).outputs['Z']
    zabs = C.add(nt, 'ShaderNodeMath', z, operation='ABSOLUTE').outputs[0]
    return C.add(nt, 'ShaderNodeMapRange', zabs, **{'From Min': 0.92, 'From Max': 0.99}).outputs[0]


def sweep_band(nt, width=0.35):
    """Soft diagonal band in object space whose position is driven by an animated Value node."""
    coord = nt.nodes.new('ShaderNodeTexCoord')
    xyz = C.add(nt, 'ShaderNodeSeparateXYZ', coord.outputs['Object'])
    diag = C.add(nt, 'ShaderNodeMath', xyz.outputs['Y'], 0.45, xyz.outputs['X'], operation='MULTIPLY_ADD')
    pos = nt.nodes.new('ShaderNodeValue')
    pos.name = 'Sweep'
    d = C.add(nt, 'ShaderNodeMath', diag.outputs[0], pos.outputs[0], operation='SUBTRACT')
    dist = C.add(nt, 'ShaderNodeMath', d.outputs[0], operation='ABSOLUTE')
    band = C.add(nt, 'ShaderNodeMapRange', dist.outputs[0], interpolation_type='SMOOTHSTEP',
                 **{'From Max': width, 'To Min': 1.0, 'To Max': 0.0})
    return band.outputs[0], pos.outputs[0]


def logo_material(brand):
    style = brand['logo_style']
    base, glow = C.hex_rgb(brand['logo_metal']), C.hex_rgb(brand['glow'])
    m = C.material('Logo', base, rough=0.2, metal=1.0, emit=glow, strength=0.0)
    nt, bsdf = m.node_tree, m.node_tree.nodes['Principled BSDF']
    front = front_factor(nt)
    # brushed caps, polished bevels: the bevels catch the rim light
    rough = C.add(nt, 'ShaderNodeMapRange', front, **{'To Min': 0.12, 'To Max': 0.38})
    nt.links.new(rough.outputs[0], bsdf.inputs['Roughness'])
    band, sweep = sweep_band(nt)
    glow_amount = 5.0 if style == 'emissive' else 0.0
    lit = C.add(nt, 'ShaderNodeMath', band, 1.6, glow_amount, operation='MULTIPLY_ADD')  # base glow + sweep glint
    emit = C.add(nt, 'ShaderNodeMath', lit.outputs[0], front, operation='MULTIPLY')
    reveal = nt.nodes.new('ShaderNodeValue')
    reveal.name = 'Reveal'
    emit = C.add(nt, 'ShaderNodeMath', emit.outputs[0], reveal.outputs[0], operation='MULTIPLY')
    nt.links.new(emit.outputs[0], bsdf.inputs['Emission Strength'])
    if style == 'emissive':
        m.diffuse_color = (*glow, 1)
    return m, sweep, reveal.outputs[0]


def build(a, brand):
    s = C.new_scene(a, look='AgX - Punchy', exposure=0.0)
    bg, ink, glow = C.hex_rgb(brand['background']), C.hex_rgb(brand['ink']), C.hex_rgb(brand['glow'])

    def studio(nt):
        """Camera sees the flat brand background; reflections see a dark studio with one soft band."""
        coord = nt.nodes.new('ShaderNodeTexCoord')
        z = C.add(nt, 'ShaderNodeSeparateXYZ', coord.outputs['Generated']).outputs['Z']
        ramp = C.add(nt, 'ShaderNodeValToRGB', z)
        el = ramp.color_ramp.elements
        el[0].position, el[0].color = 0.3, (0.0015, 0.0015, 0.0015, 1)
        el[1].position, el[1].color = 0.8, (0.003, 0.003, 0.003, 1)
        el.new(0.55).color = (1.0, 0.95, 0.9, 1)
        cam = C.add(nt, 'ShaderNodeLightPath').outputs['Is Camera Ray']
        return C.add(nt, 'ShaderNodeMixRGB', cam, ramp.outputs['Color'], (*bg, 1)).outputs['Color']

    C.world(s, studio).color = bg
    s.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

    # logo: extrude + bevel, stood upright facing -Y
    logo = fit(import_svg(brand['logo_svg'], 'Logo'), width=LOGO_W)
    cu = logo.data
    cu.dimensions, cu.fill_mode = '2D', 'BOTH'
    cu.extrude, cu.bevel_depth, cu.bevel_resolution = 0.012, 0.0025, 3
    cu.offset = -0.0025  # keep thin strokes thin: the bevel grows outward by bevel_depth
    mat, sweep, reveal = logo_material(brand)
    cu.materials.append(mat)
    logo.location = (0, 0, 0.35)
    f, n = 1, a.frames
    at = lambda t: 1 + round(t * (n - 1))  # noqa: E731  normalised time -> frame
    logo.rotation_euler = (math.radians(90), 0, 0)
    C.keys(logo, 'rotation_euler', [math.radians(-38), 0.0], [f, at(0.75)], index=2)
    C.keys(sweep, 'default_value', [-2.2, 2.4], [at(0.15), at(0.85)], 'LINEAR')
    C.keys(reveal, 'default_value', [0.0, 1.0], [f, at(0.35)])

    # lights: warm rim from behind reveals the edges, a tall strip sweeps across the face
    rim = C.light('Rim', 'AREA', (0, 3.5, 3.0), target=(0, 0, 0.6), power=0, color=glow,
                  shape='RECTANGLE', size=5.0, size_y=0.6)
    C.keys(rim.data, 'energy', [0, 900], [f, at(0.4)])
    strip = C.light('Sweep', 'AREA', (-5, -5.5, 0.6), target=(0, 0, 0.35), power=500, color=(1, 0.96, 0.9),
                    shape='RECTANGLE', size=0.35, size_y=7.0)
    strip.visible_camera = False
    C.keys(strip, 'location', [(-6.0, -5.5, 0.6), (6.0, -5.5, 0.6)], [at(0.1), at(0.9)], 'LINEAR')
    track = strip.constraints.new('TRACK_TO')
    track.target, track.track_axis, track.up_axis = logo, 'TRACK_NEGATIVE_Z', 'UP_Y'
    # soft box above the lens: its reflection gives the brushed caps a readable top-down gradient
    soft = C.light('Softbox', 'AREA', (0, -9.0, 2.4), target=(0, 0, 0.35), power=0, color=(1, 0.97, 0.93),
                   shape='RECTANGLE', size=6.0, size_y=2.5)
    soft.visible_camera = False
    C.keys(soft.data, 'energy', [0, 450], [at(0.2), at(0.7)])

    # bilingual tagline, flat emissive outlines, fading up after the logo lands
    if shutil.which('inkscape') and (brand['tagline_en'] or brand['tagline_ar']):
        tmp = tempfile.mkdtemp(prefix='acumen_txt_')
        try:
            # text, font, weight, rtl, height (m), z, start (normalised time)
            lines = [(brand['tagline_en'], brand['font_latin'], brand['font_latin_weight'], False, 0.075, -1.02, 0.5),
                     (brand['tagline_ar'], brand['font_arabic'], brand['font_arabic_weight'], True, 0.19, -1.36, 0.6)]
            for i, (text, family, weight, rtl, height, z, t0) in enumerate(lines):
                if not text:
                    continue
                svg = text_svg(text, family, weight, brand['tracking_em'], rtl, tmp, f'line{i}')
                ob = fit(import_svg(svg, f'Tagline{i}'), height=height)
                if ob.dimensions.x > 1.6 * LOGO_W:
                    fit(ob, width=1.6 * LOGO_W)
                tm = C.emission(f'Tagline{i}', ink, 0.0)
                ob.data.materials.append(tm)
                ob.rotation_euler = (math.radians(90), 0, 0)
                strength = tm.node_tree.nodes['Emission'].inputs['Strength']
                C.keys(strength, 'default_value', [0.0, 1.1], [at(t0), at(t0 + 0.3)])
                C.keys(ob, 'location', [(0, 0, z - 0.05), (0, 0, z)], [at(t0), at(t0 + 0.35)])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        print('[acumen] inkscape not found or empty taglines: skipping the tagline')

    cam, _ = C.camera((0, -17.0, 0.0), (0, 0, -0.08), lens=85)
    C.keys(cam, 'location', [(0, -17.0, 0.0), (0, -15.6, -0.03)], [f, n], 'LINEAR')
    return s


def main():
    a = C.parse_args('logo')
    s = build(a, C.load_brand(a.brand))
    C.render(s, a, glare={'threshold': 0.9, 'mix': -0.5, 'size': 8}, vignette=0.15)


C.run(main)
