#!/usr/bin/env python3
"""Write a tiny .riv (Rive runtime format v7) without the Rive editor.

    python3 src/showcase3d/rive/make_riv.py [--accent FFC478]  ->  public/rive/acumen-frame.riv

Artboard "Acumen" (1000x1000), animation "reveal" (30 fps, 120 frames): a square frame
draws on with a trim path while a warm radial glow blooms behind it. Real projects should
author .riv files in the Rive editor; this exists so the pipeline can be tested offline.
Type/property keys follow rive-runtime's dev/defs.
"""
import argparse
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "public" / "rive" / "acumen-frame.riv"
UINT, STRING, DOUBLE, COLOR = 0, 1, 2, 3

# property key -> (name, field type)
PROPS = {
    4: ("name", STRING), 5: ("parentId", UINT),
    7: ("width", DOUBLE), 8: ("height", DOUBLE),
    11: ("originX", DOUBLE), 12: ("originY", DOUBLE),
    13: ("x", DOUBLE), 14: ("y", DOUBLE),
    16: ("scaleX", DOUBLE), 17: ("scaleY", DOUBLE), 18: ("opacity", DOUBLE),
    20: ("pathWidth", DOUBLE), 21: ("pathHeight", DOUBLE),
    37: ("solidColor", COLOR), 38: ("stopColor", COLOR), 39: ("stopPosition", DOUBLE),
    42: ("startX", DOUBLE), 33: ("startY", DOUBLE), 34: ("endX", DOUBLE), 35: ("endY", DOUBLE),
    47: ("thickness", DOUBLE), 48: ("cap", UINT), 49: ("join", UINT),
    51: ("objectId", UINT), 53: ("propertyKey", UINT),
    55: ("animName", STRING), 56: ("fps", UINT), 57: ("duration", UINT), 59: ("loop", UINT),
    63: ("x1", DOUBLE), 64: ("y1", DOUBLE), 65: ("x2", DOUBLE), 66: ("y2", DOUBLE),
    67: ("frame", UINT), 68: ("interpolation", UINT), 69: ("interpolatorId", UINT), 70: ("value", DOUBLE),
    114: ("trimStart", DOUBLE), 115: ("trimEnd", DOUBLE), 116: ("trimOffset", DOUBLE), 117: ("trimMode", UINT),
}
KEY = {name: key for key, (name, _) in PROPS.items()}

BACKBOARD, ARTBOARD, SHAPE, ELLIPSE, RECTANGLE = 23, 1, 3, 4, 7
FILL, STROKE, SOLID, RADIAL, STOP, TRIM = 20, 24, 18, 17, 19, 47
LINEAR_ANIMATION, KEYED_OBJECT, KEYED_PROPERTY, KEYFRAME_DOUBLE, CUBIC_EASE = 31, 25, 26, 30, 28


def varuint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def value(field, v):
    if field == UINT:
        return varuint(int(v))
    if field == DOUBLE:
        return struct.pack("<f", v)
    if field == COLOR:
        return struct.pack("<I", v)
    data = v.encode()
    return varuint(len(data)) + data


class Riv:
    def __init__(self):
        self.objects = []  # (type key, {prop: value})
        self.artboard_start = None

    def add(self, type_key, **props):
        if type_key == ARTBOARD:
            self.artboard_start = len(self.objects)
        self.objects.append((type_key, props))
        return len(self.objects) - 1 - (self.artboard_start or 0)  # id inside the artboard

    def to_bytes(self):
        keys = sorted(PROPS)
        out = bytearray(b"RIVE") + varuint(7) + varuint(0) + varuint(0)
        for k in keys:
            out += varuint(k)
        out += varuint(0)
        for i in range(0, len(keys), 4):  # table of contents: 2 bits per key, 4 keys per uint32
            word = 0
            for j, k in enumerate(keys[i:i + 4]):
                word |= PROPS[k][1] << (j * 2)
            out += struct.pack("<I", word)
        for type_key, props in self.objects:
            out += varuint(type_key)
            for name, v in props.items():
                out += varuint(KEY[name]) + value(PROPS[KEY[name]][1], v)
            out += varuint(0)
        return bytes(out)


def argb(hex_color, alpha=1.0):
    return (round(alpha * 255) << 24) | int(hex_color.lstrip("#"), 16)


def build(accent):
    r = Riv()
    r.add(BACKBOARD)
    board = r.add(ARTBOARD, name="Acumen", width=1000.0, height=1000.0, originX=0.0, originY=0.0)

    glow = r.add(SHAPE, name="Glow", parentId=board, x=500.0, y=500.0)
    r.add(ELLIPSE, parentId=glow, pathWidth=900.0, pathHeight=900.0)
    glow_fill = r.add(FILL, parentId=glow)
    grad = r.add(RADIAL, parentId=glow_fill, startX=0.0, startY=0.0, endX=450.0, endY=0.0)
    r.add(STOP, parentId=grad, stopColor=argb(accent, 0.7), stopPosition=0.0)
    r.add(STOP, parentId=grad, stopColor=argb(accent, 0.18), stopPosition=0.45)
    r.add(STOP, parentId=grad, stopColor=argb(accent, 0.0), stopPosition=1.0)

    frame = r.add(SHAPE, name="Frame", parentId=board, x=500.0, y=500.0)
    r.add(RECTANGLE, parentId=frame, pathWidth=620.0, pathHeight=620.0)
    stroke = r.add(STROKE, parentId=frame, thickness=6.0, cap=0, join=0)
    r.add(SOLID, parentId=stroke, solidColor=argb("FFFFFF"))
    trim = r.add(TRIM, parentId=stroke, trimStart=0.0, trimEnd=0.0, trimOffset=0.0, trimMode=1)

    ease = r.add(CUBIC_EASE, x1=0.16, y1=1.0, x2=0.3, y2=1.0)

    r.add(LINEAR_ANIMATION, animName="reveal", fps=30, duration=120, loop=0)
    for obj, prop, keys in [
        (trim, "trimEnd", [(6, 0.0), (54, 1.0)]),
        (glow, "opacity", [(0, 0.0), (40, 0.0), (80, 1.0), (119, 0.7)]),
        (glow, "scaleX", [(40, 0.6), (100, 1.0)]),
        (glow, "scaleY", [(40, 0.6), (100, 1.0)]),
    ]:
        r.add(KEYED_OBJECT, objectId=obj)
        r.add(KEYED_PROPERTY, propertyKey=KEY[prop])
        for f, v in keys:
            r.add(KEYFRAME_DOUBLE, frame=f, value=v, interpolation=2, interpolatorId=ease)
    return r.to_bytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--accent", default="FFC478")
    args = ap.parse_args()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(build(args.accent))
    print(OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
