#!/usr/bin/env python3
"""moviepy 2 composition: brand title card -> crossfade -> footage clip, over a generated
ambient audio bed (numpy pad + air + a soft hit on the cut) with audio fades."""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from moviepy import AudioArrayClip, ColorClip, CompositeVideoClip, ImageClip, VideoFileClip, afx, vfx
from moviepy import concatenate_videoclips
from PIL import Image

from brandkit import HERE, OUT, Brand, text_image

SR = 44100


def audio_bed(duration, hit_at, seed=1):
    """Warm A-minor(add9) pad, band-limited 'air' noise and a sub thump + chime on the cut."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(duration * SR)) / SR
    out = np.zeros((t.size, 2))
    for f, amp in ((55, 0.5), (110, 0.35), (164.81, 0.22), (220, 0.18), (246.94, 0.1), (329.63, 0.12)):
        for ch, detune in ((0, -0.35), (1, 0.35)):  # L/R detune = width
            out[:, ch] += amp * np.sin(2 * np.pi * (f + detune) * t + rng.uniform(0, 6.28))
    out *= (1 - np.exp(-t / 1.2))[:, None] * (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t))[:, None]
    spec = np.fft.rfft(rng.standard_normal((t.size, 2)), axis=0)
    freqs = np.fft.rfftfreq(t.size, 1 / SR)[:, None]
    air = np.fft.irfft(spec * np.exp(-((np.log(freqs + 1) - np.log(2500)) ** 2) / 0.5), n=t.size, axis=0)
    out += 0.6 * air / np.abs(air).max()
    dt = np.clip(t - hit_at, 0, None) * (t >= hit_at)
    hit = 0.9 * np.sin(2 * np.pi * 48 * dt) * np.exp(-dt / 0.35) + 0.12 * np.sin(2 * np.pi * 1318.5 * dt) * np.exp(-dt / 0.9)
    out += (hit * (t >= hit_at))[:, None]
    return 0.5 * out / np.abs(out).max()


def title_card(brand, size, duration):
    w, h = size
    bg = ColorClip(size, color=tuple(int(c * 255) for c in brand.rgb("background"))).with_duration(duration)
    logo = Image.open(brand.file("logo_png")).convert("RGBA")
    side = int(h * 0.3)
    logo = ImageClip(np.array(logo.resize((side, side), Image.LANCZOS))).with_duration(duration)
    # CrossFadeIn fades the layer's mask; FadeIn would fade RGB up from black (visible on lighter backgrounds)
    logo = logo.with_effects([vfx.Resize(lambda t: 0.96 + 0.04 * min(t / duration, 1)), vfx.CrossFadeIn(0.8)])
    logo = logo.with_position(("center", int(h * 0.44 - side / 2)))
    layers = [bg, logo]
    for i, (key, font, px, y) in enumerate((("tagline_en", "font_latin", 0.034, 0.66), ("tagline_ar", "font_arabic", 0.046, 0.73))):
        img = text_image(brand[key], brand.file(font), int(h * px), brand.rgb("ink"), brand["tracking_em"])
        clip = ImageClip(np.array(img)).with_duration(duration - 0.3 - 0.2 * i).with_start(0.3 + 0.2 * i)
        layers.append(clip.with_effects([vfx.CrossFadeIn(0.7)]).with_position(("center", int(h * y - img.height / 2))))
    return CompositeVideoClip(layers, size=size).with_duration(duration)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-o", "--out", default=str(OUT / "moviepy-promo.mp4"))
    ap.add_argument("--clip", help="footage after the title card (default: out/ken-burns.mp4, rendered if missing)")
    ap.add_argument("--brand", help="brand JSON (default: brand.json)")
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--card", type=float, default=2.4, help="title card seconds")
    ap.add_argument("--shot", type=float, default=2.4, help="footage seconds")
    ap.add_argument("--xfade", type=float, default=0.8)
    a = ap.parse_args()

    if not a.clip:
        a.clip = str(OUT / "ken-burns.mp4")
        if not Path(a.clip).exists():
            subprocess.run([str(HERE / "ken-burns.sh"), "-o", a.clip], check=True, stdout=subprocess.DEVNULL)
    brand = Brand(a.brand)
    size = tuple(map(int, a.size.split("x")))
    card = title_card(brand, size, a.card)
    shot = VideoFileClip(a.clip, audio=False)
    shot = shot.subclipped(0, min(a.shot, shot.duration)).with_effects([vfx.Resize(size), vfx.CrossFadeIn(a.xfade)])
    video = concatenate_videoclips([card, shot], method="compose", padding=-a.xfade)
    bed = AudioArrayClip(audio_bed(video.duration, hit_at=a.card - a.xfade), fps=SR)
    bed = bed.with_effects([afx.AudioFadeIn(0.5), afx.AudioFadeOut(1.0)])
    video = video.with_audio(bed.with_duration(video.duration))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    video.write_videofile(a.out, fps=30, codec="libx264", audio_codec="aac", audio_bitrate="192k",
                          ffmpeg_params=["-crf", "17", "-movflags", "+faststart"], pixel_format="yuv420p", logger=None)
    print(a.out)


if __name__ == "__main__":
    main()
