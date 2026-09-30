"""Brand motion templates for Manim Community 0.21 (Acumen by default).

Re-skin: copy brand.json, edit it, then run with BRAND_JSON=/path/to/copy.json.
Render:  cd motion/manim && manim scenes.py LogoReveal -o LogoReveal
"""

import io
import json
import os
from html import escape
from pathlib import Path

import cairosvg
import numpy as np
from manim import *
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
BRAND_FILE = Path(os.environ.get("BRAND_JSON", HERE / "brand.json")).resolve()
B = json.loads(BRAND_FILE.read_text(encoding="utf-8"))
LOGO = (BRAND_FILE.parent / B["logo_svg"]).resolve()
BG, INK, MUTED, GLOW = (ManimColor(B[k]) for k in ("background", "ink", "muted", "glow"))

SANS_MATH = TexTemplate()
SANS_MATH.add_to_preamble(r"\usepackage{sfmath}")
config.tex_template = SANS_MATH


def tracked(text, size, color=INK, track=B["tracking_em"], font=B["font_latin"]):
    """Latin text with letter-spacing in em (Pango's Text has no tracking)."""
    t = Text(text, font=font, weight=B["font_weight"], font_size=size, color=color)
    offsets = [i for i, c in enumerate(text) if not c.isspace()]
    if len(offsets) == len(t):
        em = size / 72  # scene units per em in Manim's Text
        for glyph, i in zip(t, offsets):
            glyph.shift(RIGHT * track * em * i)
    return t.center()


def arabic(text, size, color=INK):
    """Arabic/RTL text, shaped by Pango + HarfBuzz. Never track or split it into letters.

    MarkupText on purpose: plain Text (manimpango 0.6 text2svg) silently renders
    some RTL strings as nothing, e.g. "هنا" or "زاوية".
    """
    t = MarkupText(escape(text), font=B["font_arabic"], weight=B["font_weight"], font_size=size, color=color)
    if not len(t):
        raise ValueError(f"Pango drew no glyphs for {text!r} in {B['font_arabic']!r}")
    return t


def bloom(svg, target, color=GLOW, radii=(4, 14, 44), gains=(0.9, 0.55, 0.5), pad=0.2):
    """Real Gaussian glow: rasterise the SVG, blur its alpha, tint it, fit it over `target`."""
    size = 720
    png = cairosvg.svg2png(url=str(svg), output_width=size)
    alpha = Image.open(io.BytesIO(png)).getchannel("A")
    margin = int(size * pad)
    canvas = Image.new("L", (alpha.width + 2 * margin, alpha.height + 2 * margin))
    canvas.paste(alpha, (margin, margin))
    x0, y0, x1, y1 = canvas.getbbox()
    glow = sum(g * np.asarray(canvas.filter(ImageFilter.GaussianBlur(r)), float) for r, g in zip(radii, gains))
    rgba = np.zeros((*glow.shape, 4), np.uint8)
    rgba[..., :3] = (np.array(color.to_rgb()) * 255).astype(np.uint8)
    rgba[..., 3] = np.clip(glow, 0, 255).astype(np.uint8)
    img = ImageMobject(rgba).set(height=target.height * canvas.height / (y1 - y0))
    px = img.height / canvas.height
    offset = np.array([(x0 + x1 - canvas.width) / 2 * px, -(y0 + y1 - canvas.height) / 2 * px, 0])
    return img.move_to(target.get_center() - offset)


def led_strip(length, color=GLOW):
    """A linear LED: white-hot core inside a warm halo.

    Many thin nested strokes whose opacities add up to a Gaussian falloff, so the halo has no visible bands.
    """
    core = Line(LEFT * length / 2, RIGHT * length / 2).set_cap_style(CapStyleType.ROUND)
    widths = np.linspace(48, 2, 24)
    falloff = 0.32 * np.exp(-0.5 * (widths / 18) ** 2)
    halo = VGroup(*(core.copy().set_stroke(color, w, o) for w, o in zip(widths, np.diff(falloff, prepend=0))))
    return VGroup(halo, core.set_stroke(INK, 1.6))


class LogoReveal(MovingCameraScene):
    def construct(self):
        self.camera.background_color = BG
        cam = self.camera.frame
        cam.add_updater(lambda m, dt: m.scale(1 - 0.012 * dt))  # slow push-in

        logo = SVGMobject(LOGO, height=3.2).set_stroke(width=0)
        if logo.width > 7:  # wide wordmarks: fit a 7 x 3.2 box
            logo.set(width=7)
        if B.get("logo_recolor", True):
            logo.set_fill(INK, 1)
        frame, mark = logo[0], logo[1:]  # first path = frame/emblem, the rest drawn one by one
        strip = led_strip(2.2).next_to(logo, DOWN, buff=0.5)
        en = tracked(B["tagline_en"], 17).next_to(strip, DOWN, buff=0.42)
        ar = arabic(B["tagline_ar"], 21, MUTED).next_to(en, DOWN, buff=0.3)
        VGroup(logo, strip, en, ar).center()
        glow = bloom(LOGO, logo).set_z_index(-1)

        draw = [DrawBorderThenFill(frame, stroke_color=GLOW, stroke_width=1.5)]
        if mark:  # single-path logos have nothing else to stagger
            letters = (DrawBorderThenFill(m, stroke_color=GLOW, stroke_width=1.2) for m in mark)
            draw.append(LaggedStart(*letters, lag_ratio=0.1))
        self.play(*draw, run_time=1.6)
        self.play(FadeIn(glow, scale=0.96), GrowFromCenter(strip), run_time=0.8, rate_func=rush_from)
        self.play(
            LaggedStart(*(FadeIn(c, shift=UP * 0.08) for c in en), lag_ratio=0.035),
            FadeIn(ar, shift=UP * 0.08),
            run_time=0.9,
        )
        self.wait(0.6)


class BeamAngle(Scene):
    GROUND, WALL_X = -2.6, -4.7
    APEX = np.array([-3.4, 1.55, 0])

    def outline(self, half):
        """Cone from the lens to the ground, clipped where it hits the wall."""
        (x0, y0, _), h = self.APEX, self.APEX[1] - self.GROUND
        xl, xr = x0 - h * np.tan(half), x0 + h * np.tan(half)
        if xl >= self.WALL_X:
            return [self.APEX, [xr, self.GROUND, 0], [xl, self.GROUND, 0]]
        y_hit = y0 - (x0 - self.WALL_X) / np.tan(half)
        return [self.APEX, [xr, self.GROUND, 0], [self.WALL_X, self.GROUND, 0], [self.WALL_X, y_hit, 0]]

    def beam(self, theta, power):
        """Wider beams spread the same lumens thinner, so the cone and pool dim as theta grows."""
        half = np.radians(theta) / 2
        spread = np.tan(np.radians(B["beam_from_deg"]) / 2) / np.tan(half)
        level = power * np.clip(spread, 0.3, 1) ** 0.5

        cones = VGroup(*(
            Polygon(*self.outline(half * k), stroke_width=0)
            .set_fill([GLOW, GLOW], opacity=[0.16 * level, 0.04 * level]).set_sheen_direction(DOWN)
            for k in (1, 0.82, 0.62, 0.4)
        ))
        pts = self.outline(half)
        xl, xr = pts[2][0], pts[1][0]
        pool = VGroup(*(
            Ellipse(width=(xr - xl) * s, height=0.3 * s, stroke_width=0)
            .set_fill(GLOW, 0.14 * level).move_to([(xl + xr) / 2, self.GROUND, 0])
            for s in (1.2, 0.9, 0.62, 0.36)
        ))
        graze = VGroup()
        if len(pts) == 4:  # beam wide enough to graze the wall
            face = Line(pts[3], pts[2])
            graze = VGroup(*(face.copy().set_stroke(GLOW, w, o * level) for w, o in ((24, 0.06), (10, 0.16), (2.5, 0.75))))
        lens = VGroup(*(Circle(r, stroke_width=0).set_fill(GLOW, 0.05 * power).move_to(self.APEX) for r in np.geomspace(0.4, 0.04, 8)))
        edges = VGroup(Line(self.APEX, pts[1]), Line(self.APEX, pts[-1])).set_stroke(INK, 1, 0.22 * power)
        arc = Arc(0.7, -PI / 2 - half, 2 * half, arc_center=self.APEX).set_stroke(INK, 1.5, power)
        return VGroup(cones, pool, graze, lens, edges, arc)

    def construct(self):
        self.camera.background_color = BG
        t0, t1 = B["beam_from_deg"], B["beam_to_deg"]
        theta, power = ValueTracker(t0), ValueTracker(0)

        wall = Rectangle(width=0.4, height=7, stroke_width=0).set_fill(BG.interpolate(INK, 0.06), 1)
        wall.move_to([self.WALL_X - 0.2, self.GROUND + 3.5, 0])
        ground = Line([self.WALL_X, self.GROUND, 0], [7.2, self.GROUND, 0]).set_stroke(MUTED, 1, 0.6)
        arm = Line([self.WALL_X, self.APEX[1] + 0.3, 0], self.APEX + UP * 0.3).set_stroke(MUTED, 2)
        body = RoundedRectangle(corner_radius=0.06, width=0.46, height=0.3).set_stroke(INK, 1.2)
        body.set_fill(BG.interpolate(INK, 0.1), 1).move_to(self.APEX + UP * 0.15)
        scenery = VGroup(wall, ground, arm, body)

        light = always_redraw(lambda: self.beam(theta.get_value(), power.get_value()))
        theta_mark = MathTex(r"\theta", font_size=26, color=INK)
        theta_mark.add_updater(lambda m: m.move_to(self.APEX + DOWN * 1.0).set_opacity(power.get_value()))

        label_en = tracked(B["beam_title_en"], 15, MUTED)
        label_ar = arabic(B["beam_title_ar"], 34)
        eq = MathTex(r"\theta =", font_size=70, color=INK)
        num = DecimalNumber(t0, num_decimal_places=0, unit=r"^{\circ}", font_size=70, color=GLOW)
        num.add_updater(lambda m: m.set_value(theta.get_value()).next_to(eq, RIGHT, buff=0.22), call_updater=True)
        readout = VGroup(eq, num)

        track = Line(LEFT * 1.6, RIGHT * 1.6).set_stroke(MUTED, 1.5, 0.7)
        ticks = VGroup(*(Line(UP * 0.07, DOWN * 0.07).move_to(p) for p in (track.get_start(), track.get_end())))
        ticks.set_stroke(MUTED, 1.5, 0.7)
        knob = Dot(radius=0.07, color=GLOW)
        knob.add_updater(
            lambda m: m.move_to(track.point_from_proportion((theta.get_value() - t0) / (t1 - t0))), call_updater=True
        )
        ends = VGroup(
            tracked(f"{B['beam_narrow_en']} {t0}°", 11, MUTED, 0.2).next_to(track.get_start(), DOWN, buff=0.22),
            tracked(f"{B['beam_wide_en']} {t1}°", 11, MUTED, 0.2).next_to(track.get_end(), DOWN, buff=0.22),
        )
        slider = VGroup(track, ticks, ends, knob)

        panel = VGroup(label_en, label_ar, readout, slider).arrange(DOWN, buff=0.45).move_to(RIGHT * 3.4)
        label_ar.shift(UP * 0.12)

        self.play(FadeIn(scenery), FadeIn(panel, shift=UP * 0.1), run_time=0.6)
        light.set_z_index(-1)
        wall.set_z_index(-2)
        self.add(light, theta_mark)
        self.play(power.animate.set_value(1), run_time=0.5, rate_func=rush_from)
        self.play(theta.animate.set_value(t1), run_time=2.2, rate_func=smooth)
        self.wait(0.5)
