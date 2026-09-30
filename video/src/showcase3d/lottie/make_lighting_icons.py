#!/usr/bin/env python3
"""Generate lighting-type line icons as Lottie JSON (python-lottie, no downloads).

    python3 src/showcase3d/lottie/make_lighting_icons.py [--accent FFC478] [--line FFFFFF]

Writes public/lottie/{uplight,wall-washer,linear-led,spotlight}.json (512x512, 30 fps, 4 s):
line art draws on (trim path), then the light switches on and breathes.
"""
import argparse
import json
from pathlib import Path

from lottie import Color, NVector, Point, objects
from lottie.exporters.core import export_lottie
from lottie.objects.easing import KeyframeBezierHandle

FPS, FRAMES, SIZE = 30, 120, 512
OUT = Path(__file__).resolve().parents[3] / "public" / "lottie"


def ease(kf):  # brand curve, cubic-bezier(0.16, 1, 0.3, 1)
    kf.out_value = KeyframeBezierHandle(0.16, 1)
    kf.in_value = KeyframeBezierHandle(0.3, 1)


def rgb(hex_color, alpha=None):
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return Color(*c) if alpha is None else Color(*c, alpha)


def path(*pts, closed=False):
    shape = objects.Path()
    for p in pts:
        shape.shape.value.add_point(Point(*p))
    shape.shape.value.closed = closed
    return shape


def line_art(paths, color, start=0, dur=26, width=6):
    g = objects.Group()
    for p in paths:
        g.add_shape(p)
    trim = objects.Trim()
    trim.end.add_keyframe(start, 0, ease)
    trim.end.add_keyframe(start + dur, 100)
    g.add_shape(trim)
    stroke = objects.Stroke(color, width)
    stroke.line_cap = objects.LineCap.Round
    stroke.line_join = objects.LineJoin.Round
    g.add_shape(stroke)
    return g


def light(shape, accent, grad_from, grad_to, pivot, on=22, radial=False, peak=0.85, grow="y"):
    """A gradient-filled light shape that grows out of `pivot` (along y or uniformly), then breathes."""
    g = objects.Group()
    g.add_shape(shape)
    fill = objects.GradientFill()
    fill.gradient_type = objects.GradientType.Radial if radial else objects.GradientType.Linear
    fill.start_point.value = Point(*grad_from)
    fill.end_point.value = Point(*grad_to)
    fill.colors.set_stops([(0, rgb(accent, peak)), (0.45, rgb(accent, peak * 0.35)), (1, rgb(accent, 0))])
    g.add_shape(fill)
    tr = g.transform
    tr.anchor_point.value = Point(*pivot)
    tr.position.value = Point(*pivot)
    tr.scale.add_keyframe(on, NVector(100, 0) if grow == "y" else NVector(30, 30), ease)
    tr.scale.add_keyframe(on + 24, NVector(100, 100))
    tr.opacity.add_keyframe(on, 0, ease)
    tr.opacity.add_keyframe(on + 10, 100)
    for i, f in enumerate(range(on + 30, FRAMES, 20)):
        tr.opacity.add_keyframe(f, 78 if i % 2 == 0 else 100)
    return g


def fixture(center, size, accent, on=22):
    """Small solid lens that switches from line color to accent."""
    g = objects.Group()
    rect = objects.Rect(Point(*center), Point(*size))
    rect.rounded.value = min(size) / 2
    g.add_shape(rect)
    fill = objects.Fill(rgb(accent))
    fill.opacity.add_keyframe(on - 4, 0)
    fill.opacity.add_keyframe(on + 4, 100)
    g.add_shape(fill)
    return g


def icon(name, groups):
    anim = objects.Animation(FRAMES, FPS)
    anim.width = anim.height = SIZE
    anim.name = name
    layer = objects.ShapeLayer()
    layer.name = name
    for g in groups:  # first group renders on top
        layer.add_shape(g)
    anim.add_layer(layer)
    return anim


def build(accent, line):
    ln = rgb(line)
    floor = path((64, 432), (448, 432))
    return {
        # uplight grazing a wall
        "uplight": icon("Uplight", [
            fixture((318, 424), (30, 12), accent),
            line_art([floor, path((352, 432), (352, 96)), path((304, 432), (304, 420), (332, 420), (332, 432))], ln),
            light(path((312, 420), (236, 96), (352, 96), (352, 420), (324, 420), closed=True), accent, (318, 420), (318, 96), (318, 420)),
        ]),
        # wall washer: fixture on top, wide soft wash down the wall
        "wall-washer": icon("Wall Washer", [
            fixture((256, 112), (150, 10), accent),
            line_art([floor, path((64, 96), (448, 96)), path((176, 96), (176, 118), (336, 118), (336, 96))], ln),
            light(path((186, 118), (326, 118), (430, 432), (82, 432), closed=True), accent, (256, 118), (256, 432), (256, 118), peak=0.7),
        ]),
        # linear LED hidden under a cantilevered slab
        "linear-led": icon("Linear LED", [
            fixture((268, 206), (296, 6), accent, on=30),
            line_art([floor, path((96, 432), (96, 150), (448, 150), (448, 200), (120, 200), (120, 432))], ln),
            light(path((120, 206), (416, 206), (416, 432), (120, 432), closed=True), accent, (268, 206), (268, 432), (268, 206), on=30),
        ]),
        # spotlight aimed at a specimen tree
        "spotlight": icon("Spotlight", [
            fixture((158, 418), (20, 20), accent),
            line_art([
                floor,
                path((340, 432), (340, 262)),
                objects.Ellipse(Point(340, 190), Point(170, 150)),
                path((136, 432), (158, 404), (180, 432)),
            ], ln),
            light(path((158, 410), (262, 150), (412, 222), closed=True), accent, (158, 410), (340, 190), (158, 410), grow="xy"),
            light(objects.Ellipse(Point(340, 190), Point(210, 190)), accent, (340, 190), (445, 190), (340, 190), on=34, radial=True, peak=0.4, grow="xy"),
        ]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--accent", default="FFC478")
    ap.add_argument("--line", default="FFFFFF")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, anim in build(args.accent, args.line).items():
        target = OUT / f"{name}.json"
        export_lottie(anim, str(target))
        data = json.loads(target.read_text())
        target.write_text(json.dumps(data, separators=(",", ":")))
        print(target, target.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
