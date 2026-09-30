#!/usr/bin/env python3
"""Light-reveal logo sting built in code with python-lottie → Lottie JSON (+ MP4 / GIF).

The logo SVG goes through python-lottie's SVG importer, then every letter gets a stroke-draw (Trim Path)
before its fill fades up. Behind it: slow light rays + a pulsing radial glow. Taglines are HarfBuzz-shaped
outlines (Arabic joins correctly, no fonts needed by the player).

  python3 make_lottie.py                    # out/lottie/<brand>.json + out/lottie/<brand>-lines.json
  python3 make_lottie.py --mp4 --gif        # + H.264 mp4 (cairo frames → ffmpeg) + GIF (lottie exporter)
  python3 make_lottie.py --still 3.5        # + one PNG frame (quick look)
  BRAND_JSON=brands/example.json python3 make_lottie.py --mp4
"""
import argparse
import copy
import io
import json
import math
import subprocess

from PIL import Image
from lottie import Color, NVector, objects
from lottie.exporters.cairo import export_png
from lottie.importers.svg import import_svg
from lottie.objects import easing
from lottie.parsers.svg.importer import PathDParser

from common import OUT, FFmpegWriter, load_brand, rgb, text_outline

W, H, FPS, FRAMES = 1280, 720, 30, 120
SMOOTH = easing.Sigmoid(0.45)
DECEL = easing.EaseOut(0.7)


def color(hex_color, alpha=None):
    return Color(*rgb(hex_color), *([] if alpha is None else [alpha]))


def animate(prop, *keys, ease=SMOOTH):
    """animate(prop, (frame, value), (frame, value), ...)"""
    for frame, value in keys:
        prop.add_keyframe(frame, NVector(*value) if isinstance(value, (tuple, list)) else value, ease)


def polygon(points):
    bez = objects.Bezier()
    for x, y in points:
        bez.add_point(NVector(x, y))
    bez.close()
    return objects.Path(bez)


def radial(stops, radius, hex_color):
    fill = objects.GradientFill()
    fill.gradient_type = objects.GradientType.Radial
    fill.start_point.value = NVector(0, 0)
    fill.end_point.value = NVector(radius, 0)
    fill.colors.set_stops([(off, color(hex_color, a)) for off, a in stops])
    return fill


def shape_layer(anim, name):
    """New layer on top of everything added so far."""
    layer = objects.ShapeLayer()
    layer.name = name
    anim.insert_layer(0, layer)
    return layer


# ── logo ────────────────────────────────────────────────────────────────────

def leaf_groups(group, scale=1.0, found=None):
    """Groups that hold paths + a Fill (one per SVG <path>), with their total scale factor."""
    found = [] if found is None else found
    tr = group.transform
    scale *= abs(tr.scale.get_value(0)[0]) / 100 if tr and tr.scale else 1
    if any(isinstance(s, objects.Fill) for s in group.shapes):
        found.append((group, scale))
    for child in group.shapes:
        if isinstance(child, objects.Group):
            leaf_groups(child, scale, found)
    return found


class Logo:
    """Logo SVG → one lottie Group (python-lottie's SVG importer), fitted into box=(w, h).

    Centred horizontally; bottom edge at `bottom` (or centred vertically when None)."""

    def __init__(self, svg_file, box, canvas, bottom=None):
        src = import_svg(svg_file)
        self.group = objects.Group()
        for layer in reversed(src.layers):
            g = objects.Group()
            for shape in layer.shapes:
                g.add_shape(shape)
            g.transform.position.value = layer.transform.position.value
            g.transform.scale.value = layer.transform.scale.value
            self.group.insert_shape(0, g)
        self.size = (src.width, src.height)
        self.k = min(box[0] / src.width, box[1] / src.height)
        h = src.height * self.k
        self.center = (canvas[0] / 2, canvas[1] / 2 if bottom is None else bottom - h / 2)


def add_logo(anim, brand, logo, t0=0, draw_frames=40, stagger=3):
    """Two layers: stroke-draw outlines (on top) and the filled logo fading in after them."""
    (sw, sh), k = logo.size, logo.k
    layers = {}
    for name in ("logo-fill", "logo-lines"):
        g = copy.deepcopy(logo.group)
        g.transform.anchor_point.value = NVector(sw / 2, sh / 2)
        g.transform.position.value = NVector(*logo.center)
        animate(g.transform.scale, (t0, (k * 97, k * 97)), (anim.out_point, (k * 103, k * 103)), ease=easing.Linear())
        shape_layer(anim, name).add_shape(g)
        layers[name] = g

    reverse = brand.get("logo_draw_order", "ltr") == "rtl"

    def order(leaves):
        """A frame/badge that encloses everything draws first, then letters left→right (or rtl)."""
        boxes = [grp.bounding_box(0) for grp, _ in leaves]
        encloses = lambda a: all(a.x1 <= b.x1 and a.y1 <= b.y1 and a.x2 >= b.x2 and a.y2 >= b.y2 for b in boxes)
        pos = lambda i: (-boxes[i].x2 if reverse else boxes[i].x1)
        return sorted(range(len(leaves)), key=lambda i: (not encloses(boxes[i]), pos(i)))

    fills = leaf_groups(layers["logo-fill"])
    lines = leaf_groups(layers["logo-lines"])
    for rank, i in enumerate(order(fills)):
        start = t0 + (0 if rank == 0 else 10 + rank * stagger)
        end = start + (draw_frames if rank == 0 else draw_frames * 0.65)

        grp, _ = fills[i]
        fill = next(s for s in grp.shapes if isinstance(s, objects.Fill))
        fill.color.value = color(brand["ink"])
        animate(fill.opacity, (end - 6, 0), (end + 16, 100))

        grp, scale = lines[i]
        grp.shapes = [s for s in grp.shapes if not isinstance(s, (objects.Fill, objects.Stroke))]
        trim = objects.Trim()
        animate(trim.end, (start, 0), (end, 100), ease=DECEL)
        stroke = objects.Stroke(color(brand["glow"]), 1.6 / scale)
        stroke.line_cap = objects.LineCap.Butt  # round caps leave dots on zero-length trims (cairo)
        stroke.line_join = objects.LineJoin.Round
        animate(stroke.opacity, (end, 100), (end + 18, 0))
        grp.add_shape(trim)
        grp.add_shape(stroke)


# ── light ───────────────────────────────────────────────────────────────────

def add_light(anim, brand, center):
    glow = objects.Group()
    glow.add_shape(objects.Ellipse(NVector(0, 0), NVector(1100, 1100)))
    glow.add_shape(radial([(0, 0.34), (0.35, 0.12), (1, 0)], 550, brand["glow"]))
    glow.transform.position.value = NVector(*center)
    animate(glow.transform.opacity, (6, 0), (46, 100), (70, 62), (92, 90), (FRAMES, 70))
    animate(glow.transform.scale, (6, (80, 56)), (60, (100, 70)), (FRAMES, (108, 76)))

    rays = objects.Group()
    n, reach = 18, 720
    for i in range(n):
        a = 2 * math.pi * i / n + (0.09 if i % 2 else 0)
        w = math.radians(0.8 if i % 3 else 1.5)
        r = reach * (0.75 if i % 2 else 1.0)
        rays.add_shape(polygon([(0, 0), (r * math.cos(a - w), r * math.sin(a - w)),
                                (r * math.cos(a + w), r * math.sin(a + w))]))
    rays.add_shape(radial([(0, 0), (0.22, 0.17), (0.45, 0.05), (0.72, 0)], reach, brand["glow"]))
    rays.transform.position.value = NVector(*center)
    animate(rays.transform.rotation, (0, -6), (FRAMES, 8), ease=easing.Linear())
    animate(rays.transform.opacity, (24, 0), (70, 100), (96, 70), (FRAMES, 95))

    layer = shape_layer(anim, "light")
    layer.add_shape(rays)
    layer.add_shape(glow)


def add_led_line(anim, brand, y, length, t0):
    """Hot core over two glow passes; one sub-group per stroke (python-lottie's renderer keeps one stroke per group)."""
    g = objects.Group()
    for hex_color, width, alpha in ((brand["ink"], 1.4, 95), (brand["glow"], 3.5, 55), (brand["glow"], 10, 14)):
        bez = objects.Bezier()
        bez.add_point(NVector(-length / 2, 0))
        bez.add_point(NVector(length / 2, 0))
        trim = objects.Trim()
        animate(trim.start, (t0, 50), (t0 + 24, 0), ease=DECEL)
        animate(trim.end, (t0, 50), (t0 + 24, 100), ease=DECEL)
        s = objects.Stroke(color(hex_color), width)
        s.line_cap = objects.LineCap.Round
        s.opacity.value = alpha
        sub = objects.Group()
        for shape in (objects.Path(bez), trim, s):
            sub.add_shape(shape)
        g.add_shape(sub)
    g.transform.position.value = NVector(W / 2, y)
    animate(g.transform.opacity, (0, 0), (t0, 0), (t0 + 3, 100), ease=easing.Linear())
    shape_layer(anim, "led-line").add_shape(g)


def add_text(anim, name, outline, hex_color, baseline_y, t0, opacity=100):
    g = objects.Group()
    for d in outline.glyphs:
        parser = PathDParser(d)
        parser.parse()
        for bez in parser.paths:
            g.add_shape(objects.Path(bez))
    g.add_shape(objects.Fill(color(hex_color)))
    layer = shape_layer(anim, name)
    layer.add_shape(g)
    x = (W - outline.width) / 2
    animate(layer.transform.position, (t0, (x, baseline_y + 14)), (t0 + 22, (x, baseline_y)), ease=DECEL)
    animate(layer.transform.opacity, (t0, 0), (t0 + 22, opacity))


# ── build / export ──────────────────────────────────────────────────────────

def background(anim, hex_color, w, h):
    g = objects.Group()
    g.add_shape(objects.Rect(NVector(w / 2, h / 2), NVector(w, h)))
    g.add_shape(objects.Fill(color(hex_color)))
    shape_layer(anim, "background").add_shape(g)


def build_sting(brand):
    anim = objects.Animation(FRAMES, FPS)
    anim.width, anim.height, anim.name = W, H, f"{brand['name']} light reveal"
    logo = Logo(brand["logo_svg"], (520, 280), (W, H), bottom=426)
    background(anim, brand["background"], W, H)
    add_light(anim, brand, logo.center)
    add_logo(anim, brand, logo, t0=4)
    add_led_line(anim, brand, 472, 220, t0=58)
    en = text_outline(brand["tagline_en"], brand["font_latin_file"], 18, brand.get("tracking_em", 0.38))
    ar = text_outline(brand["tagline_ar"], brand["font_arabic_file"], 30)
    add_text(anim, "tagline-en", en, brand["ink"], 530, 70)
    add_text(anim, "tagline-ar", ar, brand["ink"], 598, 80, opacity=72)
    return anim


def build_lines(brand, size=512):
    """Small reusable asset: transparent logo stroke-draw → fill, 2.5 s."""
    anim = objects.Animation(75, FPS)
    anim.width = anim.height = size
    anim.name = f"{brand['name']} logo lines"
    logo = Logo(brand["logo_svg"], (size * 0.86, size * 0.86), (size, size))
    add_logo(anim, brand, logo, t0=0, draw_frames=30, stagger=2)
    return anim


def save_json(anim, path):
    def rounded(v):
        if isinstance(v, float):
            return round(v, 2)
        if isinstance(v, list):
            return [rounded(x) for x in v]
        if isinstance(v, dict):
            return {k: rounded(x) for k, x in v.items()}
        return v
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rounded(anim.to_dict()), separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path} ({path.stat().st_size // 1024} KB)")


def render_mp4(anim, path):
    """Rasterise each frame with python-lottie's cairo exporter and pipe it to x264."""
    with FFmpegWriter(path, (anim.width, anim.height), anim.frame_rate) as out:
        for f in range(int(anim.in_point), int(anim.out_point)):
            buf = io.BytesIO()
            export_png(anim, buf, f)
            out.write(Image.open(buf))
    print(f"wrote {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mp4", action="store_true", help="render out/lottie/<brand>.mp4")
    ap.add_argument("--gif", action="store_true", help="render out/lottie/<brand>.gif via lottie_convert.py")
    ap.add_argument("--assets", action="store_true", help="also refresh assets/<brand>-lines.json")
    ap.add_argument("--still", type=float, metavar="SEC", help="also write one PNG frame at this time")
    args = ap.parse_args()

    brand = load_brand()
    out = OUT / "lottie"
    sting, lines = out / f"{brand['slug']}.json", out / f"{brand['slug']}-lines.json"
    save_json(build_sting(brand), sting)
    save_json(build_lines(brand), lines)
    if args.assets:
        save_json(build_lines(brand), OUT.parent / "assets" / lines.name)
    if args.still is not None:
        png = out / f"{brand['slug']}_{args.still:g}s.png"
        export_png(objects.Animation.load(json.loads(sting.read_text())), str(png), round(args.still * FPS))
        print(f"wrote {png}")
    if args.mp4:
        render_mp4(objects.Animation.load(json.loads(sting.read_text())), out / f"{brand['slug']}.mp4")
    if args.gif:
        gif = out / f"{brand['slug']}.gif"
        run = subprocess.run(["lottie_convert.py", str(sting), str(gif), "--width", "640", "--gif-skip-frames", "2"],
                             capture_output=True, text=True)
        if run.returncode:
            raise SystemExit(run.stderr[-2000:])
        print(f"wrote {gif}")


if __name__ == "__main__":
    main()
