"""Night villa: minimal modern facade lit with warm architectural lighting, slow push-in.

blender -b --factory-startup -P scene.py -- --out out/villa --engine CYCLES --res 640x360 --frames 24 --samples 16
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True  # keep the template folder clean
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def world_pos_2d(nt, axes='XZ'):
    """World position projected onto a plane (metres), so textures line up across objects."""
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = C.add(nt, 'ShaderNodeSeparateXYZ', geo.outputs['Position'])
    return C.add(nt, 'ShaderNodeCombineXYZ', *(sep.outputs[a] for a in axes)).outputs[0]


def bumped(m, height, strength, distance=0.02, invert=False):
    nt = m.node_tree
    bump = C.add(nt, 'ShaderNodeBump', None, None, height, Strength=strength, Distance=distance, invert=invert)
    nt.links.new(bump.outputs[0], nt.nodes['Principled BSDF'].inputs['Normal'])


def mat_paving():
    m = C.material('Paving', (0.012, 0.012, 0.013), rough=0.35)
    nt, bsdf = m.node_tree, m.node_tree.nodes['Principled BSDF']
    brick = C.add(nt, 'ShaderNodeTexBrick', world_pos_2d(nt, 'XY'), offset=0.5, Scale=1.0,
                  Color1=(0.010, 0.010, 0.011, 1), Color2=(0.016, 0.016, 0.016, 1), Mortar=(0.006, 0.006, 0.006, 1),
                  **{'Mortar Size': 0.006, 'Brick Width': 1.2, 'Row Height': 0.6, 'Bias': 0.0})
    nt.links.new(brick.outputs['Color'], bsdf.inputs['Base Color'])
    wet = C.add(nt, 'ShaderNodeTexNoise', world_pos_2d(nt, 'XY'), Scale=0.35, Detail=3.0)
    rough = C.add(nt, 'ShaderNodeMapRange', wet.outputs['Fac'], **{'From Min': 0.35, 'From Max': 0.65, 'To Min': 0.22, 'To Max': 0.45})
    nt.links.new(rough.outputs[0], bsdf.inputs['Roughness'])
    bumped(m, brick.outputs['Fac'], 0.25, 0.004, invert=True)
    return m


def mat_ledgestone():
    m = C.material('Ledgestone', (0.25, 0.21, 0.17), rough=0.85)
    nt, bsdf = m.node_tree, m.node_tree.nodes['Principled BSDF']
    uv = world_pos_2d(nt, 'XZ')
    brick = C.add(nt, 'ShaderNodeTexBrick', uv, offset=0.37, squash=1.0, Scale=1.0,
                  Color1=(0.19, 0.16, 0.13, 1), Color2=(0.33, 0.28, 0.22, 1), Mortar=(0.02, 0.018, 0.016, 1),
                  **{'Mortar Size': 0.004, 'Mortar Smooth': 0.3, 'Brick Width': 0.42, 'Row Height': 0.075, 'Bias': 0.0})
    nt.links.new(brick.outputs['Color'], bsdf.inputs['Base Color'])
    rock = C.add(nt, 'ShaderNodeTexNoise', uv, Scale=14.0, Detail=8.0, Roughness=0.65)
    face = C.add(nt, 'ShaderNodeMath', 1.0, brick.outputs['Fac'], operation='SUBTRACT', use_clamp=True)
    height = C.add(nt, 'ShaderNodeMath', face.outputs[0], rock.outputs['Fac'], operation='MULTIPLY')
    bumped(m, height.outputs[0], 1.0, 0.03)
    return m


def mat_plaster():
    m = C.material('Plaster', (0.72, 0.71, 0.69), rough=0.85, spec=0.3)
    nt = m.node_tree
    grain = C.add(nt, 'ShaderNodeTexNoise', world_pos_2d(nt, 'XZ'), Scale=60.0, Detail=4.0)
    bumped(m, grain.outputs['Fac'], 0.06, 0.01)
    return m


def mat_window(warm, bay=1.8, x0=-3.2):
    """Dark reflective glass with warm interiors: each glazing bay is a room with its own
    brightness (some dark), sheer curtain folds on top. No transmission, same on every engine."""
    m = C.material('Window', (0.004, 0.004, 0.005), rough=0.03, spec=0.6, emit=warm, strength=1.0)
    nt, bsdf = m.node_tree, m.node_tree.nodes['Principled BSDF']
    uv = world_pos_2d(nt, 'XZ')
    folds = C.add(nt, 'ShaderNodeTexWave', uv, wave_type='BANDS', bands_direction='X', Scale=9.0, Distortion=1.5)
    x = C.add(nt, 'ShaderNodeSeparateXYZ', uv).outputs['X']
    bay_index = C.add(nt, 'ShaderNodeMath', x, 1 / bay, -x0 / bay, operation='MULTIPLY_ADD')
    room = C.add(nt, 'ShaderNodeMath', bay_index.outputs[0], operation='FLOOR')
    rnd = C.add(nt, 'ShaderNodeTexWhiteNoise', None, room.outputs[0], noise_dimensions='1D')
    f = C.add(nt, 'ShaderNodeMapRange', folds.outputs['Fac'], **{'To Min': 0.55, 'To Max': 1.0})
    r = C.add(nt, 'ShaderNodeMapRange', rnd.outputs['Value'], **{'From Min': 0.3, 'From Max': 1.0, 'To Min': 0.0, 'To Max': 0.4})
    z = C.add(nt, 'ShaderNodeSeparateXYZ', nt.nodes.new('ShaderNodeTexCoord').outputs['Generated']).outputs['Z']
    ceiling = C.add(nt, 'ShaderNodeMapRange', z, **{'To Min': 0.35, 'To Max': 1.2})  # brighter under the ceiling
    s = C.add(nt, 'ShaderNodeMath', f.outputs[0], r.outputs[0], operation='MULTIPLY')
    s = C.add(nt, 'ShaderNodeMath', s.outputs[0], ceiling.outputs[0], operation='MULTIPLY')
    nt.links.new(s.outputs[0], bsdf.inputs['Emission Strength'])
    return m


def mat_water():
    m = C.material('Water', (0.0, 0.003, 0.005), rough=0.015, spec=0.5)
    nt = m.node_tree
    ripple = C.add(nt, 'ShaderNodeTexNoise', world_pos_2d(nt, 'XY'), noise_dimensions='4D', Scale=1.4, Detail=2.0)
    bumped(m, ripple.outputs['Fac'], 0.04, 0.05)
    return m, ripple.inputs['W']


def cylinder(name, loc, radius, depth, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = C.link(bpy.data.objects.new(name, me))
    ob.location = loc
    return ob


def build(a, brand):
    s = C.new_scene(a, exposure=-0.4)
    warm = C.kelvin(brand['light_kelvin'], brand['white_balance_kelvin'])
    zen, hor = C.hex_rgb(brand['sky_zenith']), C.hex_rgb(brand['sky_horizon'])

    def sky(nt):
        coord = nt.nodes.new('ShaderNodeTexCoord')
        z = C.add(nt, 'ShaderNodeSeparateXYZ', coord.outputs['Generated']).outputs['Z']
        ramp = C.add(nt, 'ShaderNodeValToRGB', z)
        el = ramp.color_ramp.elements
        el[0].position, el[0].color = 0.0, (*hor, 1)
        el[1].position, el[1].color = 0.35, (*zen, 1)
        return ramp.outputs['Color']

    C.world(s, sky).color = hor

    # materials
    paving, stone, plaster = mat_paving(), mat_ledgestone(), mat_plaster()
    trav = C.material('Travertine', (0.42, 0.38, 0.33), rough=0.55)
    metal = C.material('BlackMetal', (0.02, 0.02, 0.02), rough=0.35, metal=1.0)
    window = mat_window(warm)
    water, water_w = mat_water()
    led = C.emission('LED', warm, 40.0)
    lens = C.emission('Lens', warm, 12.0)

    # ground, terrace, pool
    C.box('Ground', (-150, -150, -0.1), (150, 150, 0.0), paving)
    C.box('Terrace', (-11, -3.0, 0.0), (4.6, 9, 0.35), trav)
    C.box('Water', (-10, -11, -0.1), (2.5, -3.7, 0.02), water)
    for name, lo, hi in (('CopingFront', (-10.3, -11.3, 0), (2.8, -11, 0.06)),
                         ('CopingBack', (-10.3, -3.7, 0), (2.8, -3.4, 0.06)),
                         ('CopingLeft', (-10.3, -11, 0), (-10.0, -3.7, 0.06)),
                         ('CopingRight', (2.5, -11, 0), (2.8, -3.7, 0.06))):
        C.box(name, lo, hi, trav)

    # ground floor: plaster wall + glazing with slim mullions; cantilevered upper volume
    C.box('GroundFloor', (-7, 0.3, 0.35), (4.0, 8, 3.6), plaster)
    C.box('WashWall', (-7, 0.0, 0.35), (-3.2, 0.3, 3.6), plaster)
    C.box('Glazing', (-3.2, 0.27, 0.35), (4.0, 0.3, 3.6), window)
    for i in range(5):
        x = -3.2 + i * 1.8
        C.box(f'Mullion{i}', (x - 0.03, 0.2, 0.35), (x + 0.03, 0.29, 3.6), metal)
    C.box('Upper', (-10, -2.2, 3.6), (3.2, 7, 6.9), plaster)
    C.box('Ribbon', (-8.8, -2.21, 4.35), (1.8, -2.19, 6.05), window)
    C.box('RibbonSill', (-8.85, -2.26, 4.3), (1.85, -2.19, 4.35), metal)
    for i in range(-3, 3):
        x = -3.2 + i * 1.8
        C.box(f'RibbonMullion{i}', (x - 0.025, -2.25, 4.35), (x + 0.025, -2.19, 6.05), metal)

    # feature wall with ledgestone, lit by in-ground uplights
    C.box('FeatureWall', (4.8, 0.2, 0.0), (9.3, 0.7, 4.4), stone)
    C.box('FeatureCap', (4.78, 0.18, 4.4), (9.32, 0.72, 4.44), metal)

    # --- lighting (all warm, brand colour temperature)
    # linear LED under the cantilever edge: visible strip + area light doing the actual lighting
    strip = C.box('SoffitLED', (-9.9, -2.08, 3.585), (3.1, -2.03, 3.6), led)
    strip.visible_shadow = False
    C.light('SoffitWash', 'AREA', (-3.4, -1.9, 3.57), power=320, color=warm, shape='RECTANGLE',
            size=13.0, size_y=0.1)
    # floating terrace: hidden LED under the nosing grazing the paving
    C.box('TerraceLED', (-11, -3.03, 0.02), (4.6, -3.0, 0.035), led).visible_shadow = False
    C.light('TerraceGlow', 'AREA', (-3.2, -3.1, 0.05), target=(-3.2, -3.8, -1), power=50, color=warm,
            shape='RECTANGLE', size=15.6, size_y=0.05)
    # wall washers in the soffit (wide, soft) on the plaster wall
    for x in (-6.4, -5.1, -3.8):
        C.light(f'Washer{x}', 'SPOT', (x, -0.8, 3.56), target=(x, 0.0, 1.2), power=70, color=warm,
                spot_size=1.9, spot_blend=1.0, shadow_soft_size=0.05)
        cylinder(f'WasherLens{x}', (x, -0.8, 3.595), 0.05, 0.01, lens)
    # downlights over the terrace in front of the glazing
    for x in (-2.3, 0.0, 2.3):
        C.light(f'Down{x}', 'SPOT', (x, -1.1, 3.56), target=(x, -1.1, 0), power=45, color=warm,
                spot_size=0.9, spot_blend=0.6, shadow_soft_size=0.03)
        cylinder(f'DownLens{x}', (x, -1.1, 3.595), 0.05, 0.01, lens)
    # in-ground uplights grazing the ledgestone (narrow beam, tiny source = crisp texture)
    for i in range(4):
        x = 5.4 + i * 1.1
        C.light(f'Up{i}', 'SPOT', (x, -0.05, 0.03), target=(x, 0.32, 4.4), power=140, color=warm,
                spot_size=0.5, spot_blend=0.35, shadow_soft_size=0.01)
        cylinder(f'UpRing{i}', (x, -0.05, 0.005), 0.07, 0.01, metal)
        cylinder(f'UpLens{i}', (x, -0.05, 0.012), 0.045, 0.004, lens)
    # linear grazer at the parapet: light rakes down the upper plaster facade
    C.light('ParapetGrazer', 'AREA', (-3.4, -2.32, 6.95), target=(-3.4, -2.24, 0), power=150, color=warm,
            shape='RECTANGLE', size=13.0, size_y=0.04)
    # cool moonlight rim so the dark volumes still read
    C.light('Moon', 'SUN', (0, 0, 30), target=(6, 12, 0), power=0.06, color=(0.55, 0.65, 1.0), angle=0.03)

    if a.haze:
        vol = C.add(s.world.node_tree, 'ShaderNodeVolumePrincipled', Density=a.haze, Anisotropy=0.3)
        s.world.node_tree.links.new(vol.outputs[0], s.world.node_tree.nodes['World Output'].inputs['Volume'])
        s.eevee.use_volumetric_lights, s.eevee.volumetric_end = True, 60

    if a.engine == 'BLENDER_EEVEE':
        # EEVEE has no GI: fake the soffit bounce. Pool reflections come from SSR
        # (planar reflection probes render empty on Mesa llvmpipe).
        C.light('SoffitBounce', 'AREA', (-3.4, -1.9, 3.3), target=(-3.4, -1.9, 10), power=60, color=warm,
                shape='RECTANGLE', size=13.0, size_y=1.5)

    # --- animation: slow constant push-in (~0.9 m/s, capped), gentle water ripples
    start, look = Vector((4.2, -17.5, 1.35)), Vector((-1.6, 0.0, 3.0))
    seconds = a.frames / a.fps
    end = start + (look - start).normalized() * min(0.9 * seconds, 5.0)
    cam, _ = C.camera(start, look, lens=28)
    C.keys(cam, 'location', [start, end], [1, a.frames], 'LINEAR')
    C.keys(water_w, 'default_value', [0.0, 0.15 * seconds], [1, a.frames], 'LINEAR')
    return s


def main():
    a = C.parse_args('villa', lambda p: p.add_argument(
        '--haze', type=float, default=0.0, help='volumetric haze density, e.g. 0.012 (about 3x slower on Cycles)'))
    brand = C.load_brand(a.brand)
    s = build(a, brand)
    C.render(s, a, glare={'threshold': 1.0, 'mix': -0.55, 'size': 8}, vignette=0.22)


C.run(main)
