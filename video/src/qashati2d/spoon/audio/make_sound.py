#!/usr/bin/env python3
"""Soundtrack for «ملعقة وحدة بس» (Qashati 2D, spot «spoon»): 461 frames = 15.367 s, original synthesis, deterministic.

    nice -n 10 python3 video/src/qashati2d/spoon/audio/make_sound.py
      -> video/public/qashati2d/audio/spoon.mp3    48 kHz stereo, 192 kbps, exact spot length, -14 LUFS, <= -1 dBTP
      -> video/out/qashati2d/spoon.wav              24-bit master (mux this one for delivery)
      -> video/out/qashati2d/spoon/sound/           stems, onset table (cues.txt / cues.json), verify report,
                                                    overview/zoom plots, preview-half.mp4 (half-res render + this mix)

TIMING IS NOT COPIED. spec.ts (T, CUES, HANDS) and the kit end card's cues.ts (EC) are evaluated with esbuild + node
at run time (sfx.ts_eval), so if a cue moves in spec.ts the sound follows on the next run. Every musical grid is
derived from the cues: the Act 1 bars run from one spoon dig to the next, and the owner's bar is two beats long so
that MUSIC_STOP lands on its beat 2. The end-card bars run end card → CTA → comment pop → dot hop.

Everything is synthesized from sines, seeded noise, Karplus-Strong strings and modal resonators. There are no
samples and no borrowed melodies. The sonic logo «تشك-تشك» comes from the shared kit (sfx.endcard_sfx →
sfx.sonic_logo, fixed brand seed), so it is sample-identical to spot #2 and lands on the end card's logo dots.

THE MUSIC: a cheeky counting groove that keeps speeding up.
  ACT 1 (0 → MUSIC_STOP). A 2/4 malfuf (darbuka D..T..T.) with an oom-pah tuba. Each bar runs from one dig to the
        next, so the groove speeds up with the family: 32 → 28 → 26 → 24 → 22 frames per bar (112 → 164 BPM). The
        teen's bar is slower again, because he's typing. Every dig is a downbeat (dum + tuba + the spoon's ceramic
        clink). The bass climbs one step of D major per hand, and the counter "counts" in pitch: each flip rings the
        next note of the scale, D5 E5 F#5 G5 A5 B5 C#6. Each family member's line is "said" by their own
        instrument as a pickup into their dig:
          kandura → oud · abaya → qanun (her ring tick = «والله») · dino kid → toy glockenspiel «One spoon!»
          grandpa → a shaky ney (over his misbaha) · Egyptian uncle → mizmar wind-up · Shami aunt → violin
          portamento (+ her bangles) · teen → lo-fi blips on his two key taps
        The owner arrives whistling a happy line up the scale: A B C# E … C#, then a glide to the top D. The music
        dies on that glide (MUSIC_STOP = beat 2 of his bar, hard cut, no tail), leaving a short spoon skid.
  ACT 2 (silence). TRUE SILENCE (digital zero, enforced on the master after mastering), then one lonely dry
        cricket, the drop's glint and two jelly wobbles, and a thin rising tension string under the creeping spoon.
        The string is cut by the snatch whoosh. Then clink + slurp, the spotlight blowing open, and the counter's
        8th note at last: the D that completes the scale, as a low tolling bell with a minor tierce («ding of doom»).
        A short sad oud bend plays as the owner slumps.
  ACT 3 (moral). The note slaps down and a warm Levantine accordion (musette reeds) holds IV → V7 under the
        title's seven ink taps. A darbuka roll and a qanun run up the counting scale D-E-F#-G-A-B-C# resolve,
        finally, on the high D of the end card's downbeat: everyone gets their own cup.
  ACT 4 (end card, kit package on top). The groove comes back at the family's top speed: 2/4 bars of 23 frames,
        156 BPM, end card → CTA → comment → dot hop. There is a logo break for «تشك-تشك», the CTA stamp is the
        groove's downbeat, the oud plays the «one spoon» motif resolved in D, and the last bar is a button chord
        under the logo's small dot-hop echoes. The tail fades to digital zero exactly at the last frame, so the
        spot loops cleanly into the frame-0 hook (bubble pop + the kandura's oud).
Mix for phone speakers: the bass is a tuba whose 2nd-6th harmonics carry the line at 150-600 Hz. The darbuka's
membrane modes, snaps and pops all sit at 300 Hz-4 kHz. Nothing essential sits below 120 Hz, everything is tamed
above 7 kHz, and key SFX duck the music by their own envelope (kit Mixer).

OPTIONAL HUMAN VO (panel lesson "add a human voice"): put phone-recorded dialect lines in audio/vo/<hand id>.wav
(kandura, abaya, kid, grandpa, uncle, aunt, teen, owner) and re-run. Each line starts at its VOICE_LINE cue (the
owner's «وأنا؟» at OWNER_LINE_POP). The line replaces that hand's instrument phrase, and the music ducks 4 dB under
it. With no files there, nothing changes.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import resample_poly, stft

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "kit/audio"))
import sfx  # noqa: E402
from sfx import (BELL, GLOCK, SR, body, env, filt, hz, ks, mallet, midi, noise, norm, osc, pan2, peq,  # noqa: E402
                 place, reverb, smooth_rand, swell, swept, tt, tv_band)

VIDEO, REPO = sfx.VIDEO, sfx.REPO
MP3 = VIDEO / "public/qashati2d/audio/spoon.mp3"
WAV = VIDEO / "out/qashati2d/spoon.wav"
OUT = VIDEO / "out/qashati2d/spoon/sound"
PREVIEW_VIDEO = VIDEO / "out/qashati2d/spoon/OneSpoon-half.mp4"
VO_DIR = HERE / "vo"
SEED = sfx.BRAND_SEED + 2200  # this spot's music; the sonic logo keeps the brand seed inside sfx.sonic_logo


# =============================== timeline: evaluated from the TypeScript sources ===============================
def load_timeline():
    return sfx.ts_eval("import {T, CUES, HANDS, DURATION, FPS} from './src/qashati2d/spoon/spec';\n"
                       "import {EC, ENDCARD_DURATION} from './src/qashati2d/kit/endcard/cues';\n"
                       "console.log(JSON.stringify({T, CUES, HANDS, DURATION, FPS, EC, ENDCARD_DURATION}));")


TL = load_timeline()
T, C, HANDS, EC, FPS = TL["T"], TL["CUES"], TL["HANDS"], TL["EC"], TL["FPS"]
assert FPS == sfx.FPS == 30
DUR = TL["DURATION"] / FPS                      # 15.367 s
N = int(round(DUR * SR))
IDS = [h["id"] for h in HANDS]


def F(f):  # spec frame -> seconds
    return f / FPS


DIG = list(C["SPOON_DIG"])                      # 14 46 74 100 124 146 170
VOICE = list(C["VOICE_LINE"])                   # 0 34 60 88 110 134 156
HEAP = [h["heap"] for h in HANDS]               # 1.0 .. 2.3
SIDE = [-1 if h["bubble"]["x"] < 540 else 1 for h in HANDS]  # which side the speaker reaches in from
STOP = C["MUSIC_STOP"]                          # 206: owner stops dead, the music dies
SIL = tuple(C["TRUE_SILENCE"])                  # (208, 218) digital zero
CARD = C["END_CARD"]                            # 356
ECG = lambda k: CARD + EC[k]                    # end-card cue -> global frame
LOGO_DOTS = [CARD + d for d in EC["logoDots"]]  # 376 382
CTA = ECG("cta")                                # 402
COMMENT_POP = ECG("comment") + 2                # 424 (the kit plays its pop on the bubble's overshoot)
HOPS = [CARD + d for d in EC["dotHops"]]        # 448 454

# ---- ACT 1 grid: bar i runs from dig i to dig i+1 (2/4, eight 16ths). The owner's thought pop closes the teen's
# bar; the owner's own bar is two beats of (STOP - pop) so MUSIC_STOP is exactly its beat 2.
OWNER_BAR = C["OWNER_THOUGHT_POP"]              # 194
BARS = [(a, b) for a, b in zip(DIG, DIG[1:] + [OWNER_BAR])] + [(OWNER_BAR, OWNER_BAR + 2 * (STOP - OWNER_BAR))]
PICKUP = (DIG[0] - (DIG[1] - DIG[0]), DIG[0])   # bar -1 (same length as bar 0): frame 0 sits inside it


def bar_of(i):
    return PICKUP if i < 0 else BARS[i]


def gstep(i, s, div=8):  # frame of step s (of `div`) in bar i (time-warped grid)
    a, b = bar_of(i)
    return a + (b - a) * s / div


assert abs(gstep(7, 4) - STOP) < 1e-9, "MUSIC_STOP must be beat 2 of the owner's bar"

# ---- ACT 4 grid (end card): 2/4 bars end card → CTA (two bars) → comment pop → dot hop (button)
EBARS = [(CARD, (CARD + CTA) / 2), ((CARD + CTA) / 2, CTA), (CTA, COMMENT_POP), (COMMENT_POP, HOPS[0])]
BUTTON = HOPS[0]
# moral pickup bar into the end card (same length as the first end-card bar): the qanun run lives in it
RUNBAR = (CARD - (EBARS[0][1] - EBARS[0][0]), CARD)

SCALE = ["D5", "E5", "F#5", "G5", "A5", "B5", "C#6"]       # the counter counts in pitch (1..7); 8 = the doom D
BASS = [("D2", "A2", "D3"), ("E2", "B2", "E3"), ("F#2", "C#3", "F#3"), ("G2", "D3", "G3"), ("A2", "E3", "A3"),
        ("B2", "F#3", "B3"), ("C#3", "E3", "G3"), ("A2", "E3", "A3")]  # climbs a step per hand; teen = A7/C#


# =============================== instruments (voices return mono unless noted) ===============================
OUD_BODY = [(110, .03, 1.2), (220, .025, 1.0), (295, .02, 1.8), (480, .015, .8), (840, .012, 1.0), (1250, .01, 2.2),
            (1850, .008, 1.0), (2700, .006, .5)]
QANUN_BODY = [(240, .02, .8), (520, .015, 1.0), (980, .01, 1.2), (1900, .008, .8), (3100, .006, .5)]


def warp(x, ratio):
    """Variable-speed playback (a pitch bend that keeps the pluck's attack): ratio = pitch multiplier per out sample."""
    ph = np.cumsum(ratio) - ratio[0]
    ph = ph[ph < len(x) - 1]
    return np.interp(ph, np.arange(len(x)), x)


def oud(rng, note, length=.45, bend=None):
    """Oud: two detuned KS courses + risha (plectrum) tick, through a resonant bowl. bend(t) -> pitch ratio."""
    f = hz(note) if isinstance(note, str) else note
    ln = length + (.25 if bend is not None else .02)
    a = ks(rng, f * 2 ** (2.5 / 1200), ln, t60=1.2 * (300 / f) ** .3, damp=.3, pos=.11, exc_lp=6500)
    b = ks(rng, f * 2 ** (-2.5 / 1200), ln, t60=1.1 * (300 / f) ** .3, damp=.33, pos=.13, exc_lp=6000)
    s = a + .8 * np.r_[np.zeros(int(.0015 * SR)), b][:len(a)]
    t = tt(ln)
    s = s + .22 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 5500])) * env(t, .0002, .0018)
    if bend is not None:
        s = warp(s, bend(tt(ln * 2)))
    n = int(length * SR)
    s = s[:n] * np.clip((length - tt(length))[:len(s[:n])] / .02, 0, 1)
    return norm(body(s, OUD_BODY))


def qanun(rng, note, length=.35):
    """Qanun: a course of three strings (bright KS, slightly detuned), short and sparkly."""
    f = hz(note)
    s = ks(rng, f, length, t60=.8, damp=.16, pos=.09, exc_lp=8000)
    s = s + .6 * ks(rng, f * 2 ** (3 / 1200), length, t60=.75, damp=.18, pos=.1, exc_lp=7500)
    s = s * np.clip((length - tt(length)) / .03, 0, 1)
    return norm(body(s, QANUN_BODY))


def toy(rng, note, length=.6):
    """Toy glockenspiel (the dino kid): bright metal bar + a plasticky click."""
    m = midi(note)
    s = mallet(m, [(1, 1, 1), (2.76, .22, .3)], d=.2, length=length, attack=.001)
    t = tt(length)
    s = s + .25 * norm(filt(noise(rng, len(t)), "bandpass", [1500, 4500])) * env(t, .0002, .002)
    return s


def blip8(rng, note, dur=.075):
    """The teen's lo-fi phone-game blip: a soft pulse wave with a tiny pitch drop (no real app sound)."""
    t = tt(dur + .06)
    f = hz(note) * (1 + .05 * np.exp(-t / .008))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(k * ph) / k for k in (1, 2, 3, 5, 7) if hz(note) * k < 4500)
    return filt(s * np.minimum(t / .002, 1) * np.exp(-np.maximum(t - dur * .4, 0) / (dur * .5)), "lowpass", 3500)


def tuba(note, dur):
    """Oom-pah tuba: brassy at the attack (the lip "blat"), rounder in the body; the 2nd-6th harmonics carry the
    line on a phone speaker (missing-fundamental pitch)."""
    f = hz(note)
    t = tt(dur + .05)
    br = .55 + .3 * np.exp(-t / .045)
    s = sum(br ** (k - 1) * np.sin(2 * np.pi * f * k * t + .3 * k) for k in range(1, 14) if f * k < 3000)
    s = np.tanh(2.2 * s / 2) / np.tanh(2.2)
    e = np.minimum(t / .012, 1) * (.72 + .28 * np.exp(-t / .07)) * np.clip((dur + .05 - t) / .05, 0, 1)
    return s * e


def darb(rng, kind, v=1.0):
    """Darbuka: D = dum (centre: pitch drop + membrane modes + slap), T = tak (rim), K = ka (other hand, duller).
    The membrane modes 150-500 Hz are what a phone hears of the dum."""
    j = lambda: rng.uniform(.97, 1.03)
    if kind == "D":
        t = tt(.45)
        f0 = 96 * j()
        s = .6 * osc(f0 * (1 + .8 * np.exp(-t / .012))) * env(t, .001, .14)
        s += sum(a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / d)
                 for r, a, d in [(1.59, .62, .08), (2.14, .5, .06), (2.65, .42, .05), (3.16, .34, .04), (3.92, .24, .03),
                                 (4.71, .16, .022)])
        s += .3 * norm(filt(noise(rng, len(t)), "bandpass", [250, 1800])) * env(t, .0005, .008)
        return s * v
    t = tt(.22)
    sc = 1.0 if kind == "T" else .93
    ring = sum(a * np.sin(2 * np.pi * f * sc * j() * t + rng.uniform(0, 6)) * np.exp(-t / (d * (1 if kind == "T" else .7)))
               for f, a, d in [(660, .5, .03), (1040, .6, .024), (1420, .45, .02), (1840, .35, .015), (2460, .28, .011),
                               (3300, .18, .008)])
    click = norm(filt(noise(rng, len(t)), "bandpass", [1800, 6000])) * env(t, .0002, .003)
    s = .6 * ring + .65 * click
    return (s if kind == "T" else .55 * filt(s, "lowpass", 3500)) * v


def fsnap(rng):
    """Finger snap (the cheeky backbeat)."""
    t = tt(.1)
    s = norm(filt(noise(rng, len(t)), "bandpass", [1100, 4200])) * env(t, .0004, .011)
    return s + .45 * np.sin(2 * np.pi * rng.uniform(1500, 1800) * t) * env(t, .0003, .007)


def riq(rng, times, level=1.0):
    return sfx.jingles(rng, list(times), level)


def accordion(rng, notes, dur, bright=.55):
    """Levantine accordion: three musette reeds per note (-7/0/+7 cents beat into the "wet" tremolo), bellows swell."""
    t = tt(dur)
    s = 0
    for n in notes:
        f = hz(n)
        for det in (-7, 0, 7):
            ff = f * 2 ** (det / 1200)
            ph = rng.uniform(0, 6)
            s = s + sum(bright ** (k - 1) / k * np.sin(2 * np.pi * ff * k * t + k * ph) for k in range(1, 10) if ff * k < 4200)
    s = filt(s / len(notes), "lowpass", 3000)
    return s * (1 + .06 * smooth_rand(rng, len(t), 3))


def legato(notes, atk=.012, rel=.03, tail=.08):
    """notes [(t0, f, dur, vel)] (s, Hz) -> (pitch curve, amplitude curve) for a monophonic wind/bowed/whistled line.
    Pitch glides into each note over its first 22 ms; amplitude has tongued dips between notes."""
    end = max(t0 + d for t0, _, d, _ in notes) + tail
    n = int(round(end * SR))
    t = np.arange(n) / SR
    bt, bv = [0.0], [np.log(notes[0][1])]
    for t0, f, _, _ in notes[1:]:
        bt += [max(t0 - .022, bt[-1] + 1e-4), max(t0, bt[-1] + 2e-4)]
        bv += [bv[-1], np.log(f)]
    f = np.exp(np.interp(t, bt, bv))
    a = np.zeros(n)
    for t0, _, d, v in notes:
        a = np.maximum(a, v * np.clip((t - t0) / atk, 0, 1) * np.clip(1 - (t - t0 - d) / rel, 0, 1))
    return f, uniform_filter1d(a, int(.002 * SR))


def ney_voice(rng, f, a, shaky=0.0):
    """Ney (grandpa): breathy reed flute; `shaky` adds his trembling hand (wide, irregular vibrato)."""
    n = len(f)
    t = np.arange(n) / SR
    vib = .006 * np.sin(2 * np.pi * 5.3 * t) + shaky * (.02 * np.sin(2 * np.pi * 6.6 * t) + .012 * smooth_rand(rng, n, 9))
    ff = f * (1 + vib)
    ph = 2 * np.pi * np.cumsum(ff) / SR
    tone = np.sin(ph) + .22 * np.sin(2 * ph + .4) + .1 * np.sin(3 * ph + 1.1)
    breath = norm(tv_band(noise(rng, n), ff, .2))
    hiss = norm(filt(noise(rng, n), "bandpass", [1800, 5000]))
    chiff = np.clip(np.r_[0, np.diff(uniform_filter1d(a, 240))] * SR * .012, 0, 1)
    return filt((.85 * tone + .38 * breath + .06 * hiss) * a + .22 * hiss * chiff, "lowpass", 6000)


def mizmar_voice(rng, f, a):
    """Mizmar (the Egyptian uncle): a nasal double reed, band-limited buzz through two formants."""
    n = len(f)
    t = np.arange(n) / SR
    ff = f * (1 + .004 * np.sin(2 * np.pi * 6 * t) + .003 * smooth_rand(rng, n, 12))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    s = 0
    for k in range(1, 26):
        m = np.clip((5500 - ff * k) / 500, 0, 1)
        if m.max() == 0:
            break
        s = s + m * np.sin(k * ph) / k ** .75
    s = filt(peq(peq(s, 1250, 9, 1.4), 2600, 6, 2.0), "highpass", 300)
    s = np.tanh(2.0 * norm(s))
    return filt((s + .06 * norm(filt(noise(rng, n), "bandpass", [1500, 4000]))) * a, "lowpass", 6000)


def violin_voice(rng, f, a):
    """Violin (the Shami aunt): bowed saw with a delayed vibrato and a body; portamento comes from the pitch curve."""
    n = len(f)
    t = np.arange(n) / SR
    ff = f * (1 + .0065 * np.sin(2 * np.pi * 5.6 * t + 1) * np.clip((t - .05) / .1, 0, 1))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    s = 0
    for k in range(1, 30):
        m = np.clip((7000 - ff * k) / 600, 0, 1)
        if m.max() == 0:
            break
        s = s + m * np.sin(k * ph + .7 * k) / k
    for f0, g, q in ((300, 3, 1.2), (520, 4, 1.4), (1150, -2, 1.0), (2900, 4, 1.3), (4600, -4, 1.0)):
        s = peq(s, f0, g, q)
    bow = .05 * norm(filt(noise(rng, n), "bandpass", [2000, 6000]))
    return filt((norm(s) + bow) * a, "lowpass", 7000)


def whistle_voice(rng, f, a):
    """A person whistling happily (the owner): near-sine with breath and a late vibrato."""
    n = len(f)
    t = np.arange(n) / SR
    ff = f * (1 + .008 * np.sin(2 * np.pi * 5.8 * t) * np.clip((t - .08) / .1, 0, 1) + .002 * smooth_rand(rng, n, 20))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    tone = np.sin(ph) + .05 * np.sin(2 * ph)
    breath = .2 * norm(tv_band(noise(rng, n), ff, .1)) + .025 * norm(filt(noise(rng, n), "bandpass", [2500, 6000]))
    return (tone + breath) * a


def tension(rng, dur):
    """A thin rising tremolo string (two violins a semitone apart, sul ponticello), crescendo — cut by the snatch."""
    t = tt(dur)
    x = t / dur
    s = 0
    for semi, g in ((0, 1.0), (1, .7)):
        f = hz("E5") * 2 ** ((semi + 5 * x ** 1.4) / 12)
        ph = 2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6)
        s = s + g * sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 9))
    trem = .45 + .55 * np.abs(np.sin(np.pi * 15 * t))
    return filt(s * trem * (.15 + .85 * x ** 1.3) * np.minimum(t / .05, 1), "bandpass", [450, 5500])


# =============================== SFX voices: f(rng, **p) -> (audio, lead s) like the kit ===============================
def count_ding(rng, note="D5", pan=0.0):
    """The taped counter flips: a tuned bell «ding» (the count, in pitch) + the tally's tiny click."""
    s = mallet(midi(note), [(1, 1, 1), (2.0, .3, .5), (3.0, .12, .3)], d=.32, length=.9, attack=.0012)
    t = tt(.9)
    s = s + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2500, 6000])) * env(t, .0002, .002)
    return pan2(s, pan), 0.0


def doom_bell(rng, note="D4"):
    """«Ding of doom»: the counting scale's 8th note at last — a low tolling bell (hum, prime, MINOR tierce, quint,
    nominal), its 300-1200 Hz partials are what a phone plays."""
    f = hz(note)
    t = tt(2.0)
    parts = [(.5, .3, 1.0), (1, 1, 1.0), (1.19, .8, .85), (1.5, .45, .6), (2, .6, .5), (2.52, .3, .32), (3.01, .2, .22),
             (4.07, .1, .14)]
    s = sum(a * (np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) + .5 * np.sin(2 * np.pi * f * r * 1.002 * t)) * np.exp(-t / d)
            for r, a, d in parts)
    s = norm(s) * np.minimum(t / .001, 1) + .25 * norm(filt(noise(rng, len(t)), "bandpass", [300, 2500])) * env(t, .0005, .012)
    out = pan2(s, 0)
    return .8 * out + reverb(out, room_size=.55, damping=.5, wet_level=.22, dry_level=0, width=.8), 0.0


def sad_bend(rng):
    """The owner slumps: a short «wah-waaah» on the oud — a quick E4, then D4 sagging a semitone."""
    out = np.zeros((int(1.4 * SR), 2))
    place(out, oud(rng, "E4", .14), 0, -.1, .8)
    bend = lambda t: 2 ** (-1.1 * np.clip((t - .08) / .45, 0, 1) ** 1.3 / 12)
    place(out, oud(rng, "D4", 1.0, bend=bend), .1, -.1, 1.0)
    return out, 0.0


def ring_tick(rng):
    """The abaya's gold ring ticks the spoon handle (her «والله»)."""
    t = tt(.12)
    f = rng.uniform(3000, 3300)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .03) + .5 * np.sin(2 * np.pi * f * 1.53 * t) * np.exp(-t / .015)
    s = s * np.minimum(t / .0004, 1) + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2500, 6500])) * env(t, .0002, .0015)
    return pan2(s, -.3), 0.0


def misbaha(rng, dur):
    """Grandpa's misbaha: resin beads clicking in the rhythm of his trembling hand (~6.6 Hz) + the cord's swish."""
    out = np.zeros(int((dur + .1) * SR))
    tc = 0.0
    while tc < dur:
        for k in range(rng.integers(2, 4)):
            o = tc + k * rng.uniform(.006, .016)
            t = tt(.03)
            f1, f2 = rng.uniform(1700, 2600), rng.uniform(3200, 4600)
            c = (np.sin(2 * np.pi * f1 * t) * np.exp(-t / .006) + .6 * np.sin(2 * np.pi * f2 * t) * np.exp(-t / .004))
            place(out[:, None], (c * rng.uniform(.4, 1))[:, None], o)
        tc += 1 / 6.6 * rng.uniform(.8, 1.2)
    t = tt(dur + .1)
    sw = norm(filt(noise(rng, len(t)), "bandpass", [600, 2500])) * swell(t, dur + .1, .5, a=.03, r=.06) * .12
    return pan2(filt(out, "lowpass", 6500) + sw, -.35), 0.0


def bangles(rng):
    """The aunt's gold bangles jingling on her dig: thin rings, inharmonic partials, a little cascade."""
    t = tt(.7)
    rings = [[(rng.uniform(1500, 2300) * r, d) for r, d in ((1, .12), (2.71, .07), (5.0, .04))] for _ in range(4)]
    s = np.zeros(len(t))
    for o, g in zip((0, .028, .05, .085, .13, .19), (1, .8, .7, .55, .4, .25)):
        tt_ = np.maximum(t - o, 0)
        for ring in [rings[i] for i in rng.choice(4, 2, replace=False)]:
            s += g * sum(np.sin(2 * np.pi * f * tt_ + rng.uniform(0, 6)) * np.exp(-tt_ / d) for f, d in ring if f < 7000) * (t >= o)
    return pan2(filt(s, "lowpass", 7000) / 3, -.3), 0.0


def skid(rng, dur=.062):
    """The owner's spoon screeches to a halt: a short stick-slip squeak (steel), ending before the silence."""
    t = tt(dur)
    f = 2050 * (1 + .04 * smooth_rand(rng, len(t), 150)) * (1 - .1 * t / dur)
    s = osc(f) + .3 * osc(2 * f)
    s = s * (.65 + .35 * np.sign(np.sin(2 * np.pi * 85 * t)))
    s = s + .4 * norm(filt(noise(rng, len(t)), "bandpass", [1500, 5000]))
    return pan2(filt(s, "lowpass", 6500) * np.minimum(t / .004, 1) * np.clip((dur - t) / .015, 0, 1), .05), 0.0


def cricket(rng, times, dur):
    """One lonely cricket, dry and centred: tri-pulse chirps on a ~4.4 kHz carrier at `times` (s, relative)."""
    out = np.zeros(int((dur + .3) * SR))
    f0 = rng.uniform(4250, 4500)
    for tc in times:
        for k in range(3):
            t = tt(.02)
            ch = np.sin(2 * np.pi * f0 * t) * np.sin(np.pi * t / .02) ** 2 * (1 + .25 * np.sin(2 * np.pi * 2 * f0 * t))
            place(out[:, None], ch[:, None], tc + k * .032, v=1 - .12 * k)
    out = filt(out, "bandpass", [2500, 7000])
    o2 = pan2(out, .05)
    return o2 + reverb(o2, room_size=.3, damping=.5, wet_level=.12, dry_level=0, width=.3), 0.0


def jelly(rng, f0=360.0):
    """The lonely drop shivers: a soft jelly wobble blip."""
    t = tt(.28)
    f = f0 * (1 + .16 * np.sin(2 * np.pi * 15 * t) * np.exp(-t / .07))
    return pan2(filt(osc(f) * env(t, .004, .06) + .2 * osc(2 * f) * env(t, .004, .03), "lowpass", 2200), .15), 0.0


def light_open(rng):
    """The spotlight blows open: a soft airy bloom (swell) with a low-mid «fwump» a phone can play."""
    t = tt(.5)
    s = .7 * swept(rng, .5, 1800, 500, .7) * swell(t, .5, .12, a=.005, r=.1)
    s = s + .5 * osc(190 * (1 + .5 * np.exp(-t / .02))) * env(t, .003, .06)
    return pan2(s, 0), 0.0


def note_slap(rng):
    """The paper note slaps onto the table: a sharp flat-hand slap + paper body + the tape's tick."""
    t = tt(.35)
    slap = norm(filt(noise(rng, len(t)), "bandpass", [700, 5000])) * env(t, .0003, .009)
    th, _ = sfx.paper_thup(rng)
    knock = osc(230 * (1 + .5 * np.exp(-t / .008))) * env(t, .0008, .03)
    s = pan2(.9 * slap + .5 * knock, 0)
    s[:len(th)] += .9 * th[:len(s)]
    return s, 0.0


def spoon_down(rng):
    """The owner's clean spoon sinks onto the table: a dull clink and one tiny bounce."""
    out = np.zeros((int(.8 * SR), 2))
    a, _ = sfx.spoon_clink(rng, .55, .1)
    place(out, filt(a, "lowpass", 4500), 0, 0, .8)
    b, _ = sfx.spoon_clink(rng, .4, .1)
    place(out, filt(b, "lowpass", 4000), .075, 0, .35)
    return out, 0.0


def heap_scoop(rng, heap=1.0):
    """A «one spoon» leaving with an ever bigger heap: the kit's creamy scoop, longer and heavier with the heap,
    a low «glorp» that sinks as the heap grows, and the suction release."""
    dur = .17 + .13 * (heap - 1)
    sc, _ = sfx.scoop(rng, dur)
    out = np.zeros((int((dur + .4) * SR), 2))
    place(out, sc, 0, 0, .8 + .25 * (heap - 1))
    t = tt(.22)
    f0 = 330 / heap ** .6
    gl = osc(f0 * (1 + .45 * np.minimum(t / .08, 1))) * env(t, .006, .05)
    place(out, pan2(filt(gl, "lowpass", 1800), .15), dur * .45, 0, .35 + .25 * (heap - 1))
    su, _ = sfx.suction(rng)
    place(out, su, dur * .9, 0, .55 + .1 * (heap - 1))
    return out, 0.0


def arm_swish(rng, dur=.26, up=True, pan=0.0, big=False):
    f0, f1 = (500, 2600) if up else (2600, 600)
    if big:
        f0, f1, dur = 300, 3200, dur + .12
    s, _ = sfx.swish(rng, dur, f0, f1, .45 if up else .35, (pan, pan * .3) if up else (pan * .3, pan))
    return s, 0.0


# =============================== ACT 1 music: the accelerating counting groove ===============================
# Each family member "says" their line with their own instrument as a pickup into their dig. Steps are 32nds of the
# PREVIOUS bar (the one the pickup sits in), relative to the dig (negative = before it); (step, note, length, vel).
TALK = {
    "kandura": ("oud", [(-7, "A4", 1.6, .85), (-5, "D5", 1, 1), (-4, "C#5", 1, .7), (-3, "D5", 1, .75), (-2, "F#5", 1, .95),
                        (-1, "E5", 1, .8)]),                       # «بس ملعقة وحدة» — step -7 = frame 0: the hook
    "abaya": ("qanun", [(-6, "B4", 1, .8), (-5, "E5", 1, .95), (-4, "D5", 1, .7), (-3, "E5", 1, .75), (-2, "G5", 2, .95)]),
    "kid": ("toy", [(-7, "C#6", 2, 1.0), (-4, "F#6", 3, 1.0)]),     # «One spoon!»
    "grandpa": ("ney", [(-7, "D5", 1.6, .8), (-5, "B4", 3.2, 1.0), (-1.5, "A4", 1.3, .7)]),  # «بس دوقة», shaky
    "uncle": ("mizmar", [(-9, "E5", .9, .8), (-8, "D5", .9, .7), (-7, "E5", .9, .75), (-6, "A5", 2.6, 1.0), (-3, "G5", .9, .8),
                         (-2, "E5", 1.7, .85)]),                   # «معلقة واحدة بس», the big wind-up
    "aunt": ("violin", [(-8, "F#5", .9, .75), (-7, "D5", .9, .6), (-6, "E5", .9, .65), (-5, "F#5", .9, .7), (-4, "B5", 1.8, 1.0),
                        (-2, "A5", 1.9, .8)]),                     # «بس معلقة وحدة يا تقبرني», portamento
    "teen": ("blip", None),                                        # typed: blips on his key taps (picture frames)
}
TALK_GAIN = {"oud": .55, "qanun": .5, "toy": .3, "ney": .3, "mizmar": .2, "violin": .24, "blip": .2, "whistle": .3}
# the owner whistles up the scale and is cut on the glide to the top D (frames, absolute)
WHISTLE = [(0, "F#5", 1, .5), (1, "A5", 2.8, .85), (4, "B5", 2.8, .8), (7, "C#6", 2.8, .9), (10, "E6", 2.8, 1.0),
           (13, "F#6", 1.4, .8), (14.5, "E6", 1.4, .8), (16, "C#6", 1.4, .8), (17.5, "B5", 1.4, .75), (19, "C#6", 2.6, .9),
           (21.6, "D6", 3, 1.0)]  # relative to OWNER_ENTER (184); the D6 glide starts at 205.1 and is cut at 206


def render_talk(i, rng, vo_ids):
    """(mono signal, start s, events [(name, t)]) of hand i's instrument line, or None if a VO replaces it."""
    hid = IDS[i]
    if hid in vo_ids:
        return None
    inst, fig = TALK[hid]
    a, b = bar_of(i - 1)
    s32 = (b - a) / 16
    ev = []
    if inst == "blip":  # the teen types: a blip on each key tap (+ one more lazy one)
        taps = list(C["TEEN_TAPS"])
        frames = taps + [taps[-1] + (taps[-1] - taps[0])]
        notes = list(zip(frames, ("E5", "G5", "E5"), (.07, .07, .1), (.8, .8, .7)))
        out = np.zeros(int(2 * SR))
        for fr_, n_, d_, v_ in notes:
            place(out[:, None], blip8(rng, n_, d_)[:, None], F(fr_) - F(frames[0]), v=v_)
        return out, F(frames[0]), [(f"{hid}:{n_}", F(fr_)) for fr_, n_, _, _ in notes]
    notes = [(F(DIG[i] + st * s32), nt, F(ln * s32), v) for st, nt, ln, v in fig]
    t0 = notes[0][0]
    ev = [(f"{hid}:{nt}", t) for t, nt, _, _ in notes]
    if inst in ("oud", "qanun", "toy"):
        out = np.zeros(int(1.5 * SR))
        for t, nt, d, v in notes:
            sig = {"oud": lambda: oud(rng, nt, max(.18, d * 2.2)), "qanun": lambda: qanun(rng, nt, .4),
                   "toy": lambda: toy(rng, nt)}[inst]()
            place(out[:, None], sig[:, None], t - t0, v=v)
        return out, t0, ev
    f, amp = legato([(t - t0, hz(nt), d, v) for t, nt, d, v in notes])
    if inst == "ney":
        sig = ney_voice(rng, f, amp, shaky=1.0)
    elif inst == "mizmar":  # the wind-up: the long A5 scoops up from a fourth below
        sig = mizmar_voice(rng, f * scoop_curve(notes, t0, 3, -5, .07), amp)
    else:
        sig = violin_voice(rng, f * scoop_curve(notes, t0, 4, -7, .06), amp)
    return sig, t0, ev


def scoop_curve(notes, t0, k, semis, d):
    """Pitch-ratio curve: note k starts `semis` semitones off and slides home over `d` s (scoop / portamento)."""
    t_end = max(t + dd for t, _, dd, _ in notes) - t0 + .08
    t = np.arange(int(round(t_end * SR))) / SR
    tk = notes[k][0] - t0
    x = np.clip((t - tk) / d, 0, 1)
    return np.where(t >= tk, 2 ** (semis * (1 - x) ** 2 / 12), 1.0)


MUSIC_EVENTS = []  # (label, t s, dry stereo signal) of musical hits: their onsets are measured on their own


def mput(buf, sig, t, pan=0.0, v=1.0, label=None):
    """place() into a music bus; with a label the hit is also logged (dry) for the onset table."""
    sig = pan2(sig, pan) if sig.ndim == 1 else sig
    place(buf, sig, t, 0, v)
    if label:
        MUSIC_EVENTS.append((label, t, sig * v))


ACT1_STEMS = {}


def act1_music(vo_ids, clear):
    """Act 1 bus (stereo), already cut dead at MUSIC_STOP. `clear(t, w)` = no key SFX transient within w s."""
    rng = np.random.default_rng(SEED + 1)
    drums, bass, lead, perc = (np.zeros((N, 2)) for _ in range(4))
    nb = len(BARS)
    for i in range(nb):
        x = min(1.0, i / 5)  # the band gets busier and louder as the family speeds up
        dv = .78 + .22 * x
        for s in range(8):
            t = F(gstep(i, s))
            if t >= F(STOP) - 1e-6:
                break
            if s == 0:
                mput(drums, darb(rng, "D", dv), t, 0, 1, f"downbeat bar {i} = " + (f"dig ({IDS[i]})" if i < 7 else "OWNER_THOUGHT_POP"))
            elif s in (3, 6):
                if clear(t, .025):
                    place(drums, darb(rng, "T", .9 * dv), t, .12, 1)
            elif s == 2 and i >= 2 and clear(t, .04):
                place(drums, darb(rng, "K", .4 * dv), t, -.12, 1)
            elif s == 5 and i >= 3 and clear(t, .04):
                place(drums, darb(rng, "K", .38 * dv), t, -.12, 1)
            elif s == 7 and i >= 1 and clear(t, .04):
                place(drums, darb(rng, "K", .5 * dv), t, -.12, 1)
            if s == 4 and i >= 1 and clear(t, .04):  # the cheeky backbeat: a finger snap (+ riq) on beat 2
                place(perc, pan2(fsnap(rng), .25), t, 0, .55 + .2 * x)
                place(perc, pan2(riq(rng, [0], .4), -.2), t, 0, .5)
        # oom-pah tuba: root on 1, fifth on the malfuf's 2nd stroke, octave on its 3rd; it climbs a step per hand
        a, b = bar_of(i)
        s16 = F(b - a) / 8
        for s, n_, ln in zip((0, 3, 6), BASS[i], (1.6, 1.3, 1.1)):  # staccato: bouncy, not a carpet
            t = F(gstep(i, s))
            if t < F(STOP) - .01:
                place(bass, pan2(tuba(n_, ln * s16)), t, 0, (1.0, .7, .62)[[0, 3, 6].index(s)])
    # the hook (frame 0): a riq shake that swells into the first dig
    sh = np.arange(F(0), F(DIG[0]) - .02, F(DIG[0]) / 14)
    r = riq(rng, list(sh - sh[0]), .5)
    place(perc, pan2(r * np.linspace(.35, 1, len(r)), -.15), F(0), 0, .55)
    # a tuba pickup into the first dig (bar -1, last 16th)
    place(bass, pan2(tuba("A1", F(4) * .8)), F(gstep(-1, 7)), 0, .6)
    # the talk lines
    for i in range(7):
        r_ = render_talk(i, np.random.default_rng(SEED + 100 + i), vo_ids)
        if r_ is None:
            continue
        sig, t0, ev = r_
        inst = TALK[IDS[i]][0]
        mput(lead, sig, t0, .35 * SIDE[i], TALK_GAIN[inst], f"{IDS[i]} line ({inst}) " + " ".join(e[0].split(':')[1] for e in ev))
    # the owner's happy whistle (cut with the music)
    if True:  # (an owner VO is his «وأنا؟» later on: the whistle stays)
        e0 = C["OWNER_ENTER"]
        f, amp = legato([(F(fr_), hz(n_), F(d_), v_) for fr_, n_, d_, v_ in WHISTLE], atk=.02, rel=.04)
        mput(lead, whistle_voice(np.random.default_rng(SEED + 7), f, amp), F(e0), .1, TALK_GAIN["whistle"],
             "owner whistle (OWNER_ENTER)")
    ACT1_STEMS.update(drums=.9 * sfx.lowshelf(drums, 120, -2), bass=.42 * sfx.lowshelf(bass, 110, -3), lead=lead, perc=.9 * perc)
    bus = sum(ACT1_STEMS.values())
    bus = reverb(bus, room_size=.22, damping=.5, wet_level=.1, dry_level=1, width=.8)
    # HARD STOP: no tail, no reverb (3 ms fade so it doesn't click)
    i = int(round(F(STOP) * SR))
    g = np.ones(N)
    g[i - int(.003 * SR):i] = np.linspace(1, 0, int(.003 * SR))
    g[i:] = 0
    return bus * g[:, None]


# =============================== ACT 2-4 music: tension, the moral, the end-card groove ===============================
def act234_music(clear):
    rng = np.random.default_rng(SEED + 2)
    bus = np.zeros((N, 2))
    # tension string under the crickets: OWNER_CREEP -> cut at SNATCH_WHOOSH
    a, b = F(C["OWNER_CREEP"]), F(C["SNATCH_WHOOSH"])
    ts = tension(rng, b - a + .01)
    ts[-int(.004 * SR):] *= np.linspace(1, 0, int(.004 * SR))
    place(bus, pan2(ts, -.05), a, 0, .11, fade=.001)
    MUSIC_EVENTS.append(("tension string in (OWNER_CREEP, a swell)", a, pan2(ts, -.05) * .11))
    # the moral: accordion IV (G) under the title, V7sus -> V7 under the run, all resolving on the end card's D
    slap = F(C["NOTE_SLAP"])
    run0 = F(RUNBAR[0])
    mid = F((RUNBAR[0] + CARD) / 2)
    for t0, t1, notes, lv in ((slap + .06, run0, "G3 B3 D4 G4", .085), (run0, mid, "A3 D4 E4 G4", .09),
                              (mid, F(CARD), "A3 C#4 E4 G4", .1)):
        ln = t1 - t0 + .04
        t = tt(ln)
        e = np.clip(t / (.35 if notes.startswith("G") else .04), 0, 1) ** 1.5 * np.clip((ln - t) / .04, 0, 1)
        if notes.startswith("G"):  # a gentle crescendo after the last title word, leaning into the run
            e = e * np.interp(t0 + t, [F(C["TITLE_WORDS"][-1]), run0], [1, 1.6])
        place(bus, pan2(accordion(rng, notes.split(), ln) * e, .05), t0, 0, lv)
    place(bus, pan2(tuba("G2", .9)), slap + .06, 0, .22)
    place(bus, pan2(tuba("A2", F(RUNBAR[1] - RUNBAR[0]) * .45)), run0, 0, .28)
    place(bus, pan2(tuba("A2", .15)), mid, 0, .3)
    # darbuka roll (16ths of the run bar, crescendo) + the qanun counting run D..C# -> D6 on the end card
    s16 = F(RUNBAR[1] - RUNBAR[0]) / 8
    for k in range(8):
        t = run0 + k * s16
        place(bus, pan2(darb(rng, "T" if k % 2 == 0 else "K", .3 + .55 * k / 7), (.1, -.1)[k % 2]), t, 0, .85)
        if k >= 1:
            mput(bus, qanun(rng, SCALE[k - 1], .35), t, -.3 + .08 * k, .3 + .04 * k, f"run {k}/7 {SCALE[k - 1]}")

    # ---------- the end card groove (2/4 malfuf at the family's top speed) ----------
    def es(j, s):  # end-card bar j, 16th s -> seconds
        a_, b_ = EBARS[j] if j < len(EBARS) else (BUTTON, BUTTON + (EBARS[-1][1] - EBARS[-1][0]))
        return F(a_ + (b_ - a_) * s / 8)

    def hit(t, v=1.0, chord="D4 F#4 A4 D5 F#5", top="D6", label=None):  # the band's downbeat gesture
        mput(bus, darb(rng, "D", .9 * v), t, 0, 1, label)
        place(bus, pan2(tuba("D2", .35)), t, 0, .55 * v)
        for j_, n_ in enumerate(chord.split()):
            place(bus, pan2(qanun(rng, n_, .9), (j_ - 2) * .15), t + .007 * j_, 0, .22 * v)
        place(bus, pan2(oud(rng, top, .8), .1), t, 0, .3 * v)
        place(bus, pan2(riq(rng, [0, .02, .045], 1.0), -.2), t, 0, .35 * v)

    hit(F(CARD), 1.0, label="END CARD downbeat (the run lands on D6)")
    # a warm D pad from the downbeat through the logo break (the logo ducks it)
    ln = F(CTA - CARD) + .05
    t = tt(ln)
    place(bus, pan2(accordion(rng, "D3 A3 D4 F#4".split(), ln) * np.clip(t / .03, 0, 1) * np.clip((ln - t) / .05, 0, 1), 0),
          F(CARD), 0, .07)
    place(bus, pan2(tuba("A2", es(0, 2) - es(0, 0))), es(0, 3), 0, .4)
    # logo break: nothing near the clacks; a darbuka pickup fill into the CTA stamp (the groove's downbeat)
    for k, s in enumerate((4, 5, 6, 7)):
        t = es(1, s)
        if clear(t, .05):
            place(bus, pan2(darb(rng, "T" if k % 2 == 0 else "K", .35 + .2 * k), (.1, -.1)[k % 2]), t, 0, .85)
    for j in (2, 3):
        x = j - 2
        for s in range(8):
            t = es(j, s)
            if s == 0:
                if j == 2:
                    hit(t, .9, label="CTA stamp = groove downbeat")
                else:  # the comment pop IS this downbeat: only the bass under it
                    place(bus, pan2(tuba("D2", es(j, 2) - es(j, 0))), t, 0, .5)
                continue
            if s in (3, 6):
                place(bus, pan2(darb(rng, "T", .85), .12), t, 0, 1)
            elif s in (2, 5, 7) and clear(t, .04):
                place(bus, pan2(darb(rng, "K", (.4, .38, .5)[(2, 5, 7).index(s)]), -.12), t, 0, 1)
            if s == 4 and clear(t, .04):
                place(bus, pan2(fsnap(rng), .25), t, 0, .6)
                place(bus, pan2(riq(rng, [0], .4), -.2), t, 0, .5)
            if s == 3:
                place(bus, pan2(tuba("A2", es(j, 2) - es(j, 0))), t, 0, .4)
            if s == 6:
                place(bus, pan2(tuba("D3", es(j, 1.6) - es(j, 0))), t, 0, .36)
            if s in (2, 6) and clear(t, .05):  # offbeat qanun chord "chk"
                for q, n_ in enumerate(("F#4", "A4", "D5") if s == 2 or x == 0 else ("E4", "A4", "C#5")):
                    place(bus, pan2(qanun(rng, n_, .22), (q - 1) * .25), t + .005 * q, 0, .16)
    # the «one spoon» motif, resolved: the oud sings it over the CTA and the comment, ending on the button's D
    MOTIF = [(2, 1, "A4", 1, .8), (2, 2, "D5", 1, 1), (2, 3, "C#5", 1, .7), (2, 4, "D5", 1, .75), (2, 5, "F#5", 2, .95),
             (2, 7, "E5", 1, .8), (3, 1, "A4", 1, .8), (3, 2, "D5", 1, 1), (3, 3, "C#5", 1, .7), (3, 4, "D5", 1, .75),
             (3, 5, "A5", 2, 1.0), (3, 7, "G5", .8, .7), (3, 7.5, "F#5", .8, .7)]
    for j, s, n_, ln_, v in MOTIF:
        place(bus, pan2(oud(rng, n_, max(.16, (es(j, s + ln_) - es(j, s)) * 1.8)), .08), es(j, s), 0, .42 * v)
    # BUTTON on the first dot hop (the dots' dry «تشك-تشك» echo rides on it): a soft dum, chord, D5 + D6 ringing
    t = F(BUTTON)
    mput(bus, darb(rng, "D", .55), t, 0, 1, "BUTTON = dot hop 1")
    place(bus, pan2(tuba("D2", .5)), t, 0, .5)
    for j_, n_ in enumerate("D3 A3 D4 F#4 A4 D5".split()):
        place(bus, pan2(ks(rng, hz(n_), 1.2, t60=1.4, damp=.3, pos=.12, exc_lp=6000), (j_ - 2.5) * .12), t + .012 * j_, 0, .2)
    place(bus, pan2(oud(rng, "D5", .9), .05), t, 0, .35)
    place(bus, pan2(accordion(rng, "D4 F#4 A4".split(), .5) * np.exp(-tt(.5) / .25)), t, 0, .06)
    return reverb(bus, room_size=.3, damping=.5, wet_level=.12, dry_level=1, width=.85)


# =============================== SFX cue sheet ===============================
CUE_LOG = []  # (cue label, cue time s, kind, role, index into mx.cues)


def build(vo):
    mx = sfx.Mixer(DUR)

    def cue(label, f, fn, gain=1.0, duck=0.0, role="key", t=None, **p):
        tt_ = F(f) if t is None else t
        mx.voice(tt_, fn, gain=gain, duck_db=duck, **p)
        CUE_LOG.append((label, tt_, fn.__name__, role, len(mx.cues) - 1))

    # ---- ACT 1: per hand
    for i in range(7):
        side = SIDE[i]
        if C["HAND_ENTER"][i] > 0:  # (the kandura's hand is already poised in frame on frame 0: no swish)
            cue(f"HAND_ENTER[{i}] {IDS[i]}", C["HAND_ENTER"][i], arm_swish, gain=.16 if IDS[i] != "uncle" else .24,
                role="bed", pan=.5 * side, big=IDS[i] == "uncle")
        # (review: pops 1-3 sat only 0-2 dB over the instrument "voices" they share a frame with — +2.5 dB so the
        #  bubble arrival still ticks on a phone speaker)
        cue(f"BUBBLE_POP[{i}]", C["BUBBLE_POP"][i], sfx.pop, gain=(.62, .75, .75, .75, .56, .56, .56)[i], duck=3,
            f0=(560, 640, 760, 520, 600, 660, 700)[i])
        cue(f"SPOON_DIG[{i}] clink", DIG[i], sfx.spoon_clink, gain=.36 + .03 * i, duck=3, bright=.9 + .03 * i, pan=.25 * side)
        cue(f"SCOOP_SLURP[{i}] heap {HEAP[i]}", C["SCOOP_SLURP"][i], heap_scoop, gain=.5, duck=2, role="key", heap=HEAP[i])
        cue(f"COUNTER_FLIP[{i}] -> {i + 1}", C["COUNTER_FLIP"][i], sfx.paper_flip, gain=.3, duck=1, pan=0)
        cue(f"COUNT_DING[{i}] {SCALE[i]}", C["COUNTER_FLIP"][i], count_ding, gain=.2, duck=1, note=SCALE[i], pan=0)
        cue(f"HAND_EXIT[{i}]", C["HAND_EXIT"][i], arm_swish, gain=.12, role="bed", up=False, pan=.5 * side)
    # character foley
    cue("RING_TICK (abaya)", C["RING_TICK"], ring_tick, gain=.3, duck=1)
    m0, m1 = C["MISBAHA_RATTLE"]
    cue("MISBAHA_RATTLE (grandpa)", m0, misbaha, gain=.3, role="bed", dur=F(m1 - m0))
    cue("BRACELET_JINGLE (aunt)", C["BRACELET_JINGLE"], bangles, gain=.22, duck=1)
    for k, f in enumerate(C["TEEN_TAPS"]):
        cue(f"TEEN_TAPS[{k}]", f, sfx.tap, gain=.35)
    # the owner
    cue("OWNER_ENTER swish", C["OWNER_ENTER"], arm_swish, gain=.2, role="bed", pan=0)
    cue("OWNER_THOUGHT_POP", C["OWNER_THOUGHT_POP"], sfx.pop, gain=.4, duck=2, f0=720)
    cue("OWNER_STOP skid", C["OWNER_STOP"], skid, gain=.22)
    # ---- ACT 2: silence, crickets, the snatch
    c0, c1 = C["CRICKETS"]
    chirps = [0.0, F(14), F(22)]  # 218, 232, 240: a lonely «cri .. cri .. cri», clear of the glint and the wobbles
    cue("CRICKETS (first chirp)", c0, cricket, gain=.16, role="key", times=chirps, dur=F(c1 - c0))
    cue("OWNER_DOTS_POP", C["OWNER_DOTS_POP"], sfx.pop, gain=.3, f0=430)
    cue("DROP_GLINT", C["DROP_GLINT"], sfx.sparkle, gain=.1, note="A6", pan=.2)
    for k, f in enumerate(C["DROP_WOBBLE"]):
        cue(f"DROP_WOBBLE[{k}]", f, jelly, gain=.3, f0=(360, 330)[k])
    cue("SNATCH_WHOOSH", C["SNATCH_WHOOSH"], sfx.whip, gain=.3, role="bed", dur=F(C["SNATCH_GRAB"] - C["SNATCH_WHOOSH"]) * 1.1)
    cue("SNATCH_GRAB clink", C["SNATCH_GRAB"], sfx.spoon_clink, gain=.45, duck=3, bright=1.1, pan=-.15)
    cue("SNATCH_GRAB slurp", C["SNATCH_GRAB"] + 1, heap_scoop, gain=.4, role="bed", heap=.9)
    cue("SPOTLIGHT_OUT", C["SPOTLIGHT_OUT"], light_open, gain=.22, role="bed")
    cue("SNATCH_FLIP -> 8 (flip)", C["SNATCH_FLIP"], sfx.paper_flip, gain=.32)
    cue("SNATCH_FLIP doom bell", C["SNATCH_FLIP"], doom_bell, gain=.34, note="D4")
    cue("SNATCH_EXIT", C["SNATCH_EXIT"], arm_swish, gain=.16, role="bed", up=False, pan=-.4)
    # ---- ACT 3: the slump and the moral
    cue("OWNER_SLUMP sad oud bend", C["OWNER_SLUMP"], sad_bend, gain=.42)
    cue("OWNER_SLUMP+12 spoon on table", C["OWNER_SLUMP"] + 12, spoon_down, gain=.32)
    cue("OWNER_LINE_POP", C["OWNER_LINE_POP"], sfx.pop, gain=.38, duck=2, f0=480)
    cue("COUNTER_OUT", C["COUNTER_OUT"], sfx.paper_swish, gain=.16, role="bed", dur=.22, peak=.3)
    cue("NOTE_SLAP", C["NOTE_SLAP"], note_slap, gain=.6, duck=4)
    for k, f in enumerate(C["TITLE_WORDS"]):
        last = k >= len(C["TITLE_WORDS"]) - 2  # «ملعقة وحدة.» in red: the two heaviest
        cue(f"TITLE_WORDS[{k}]", f, sfx.ink_thud, gain=.3 + (.12 if last else 0) + .015 * k, duck=2,
            weight=.45 + (.25 if last else 0), pitch=1.05 + .04 * k)
    # optional VO lines
    for name, t0, x in vo:
        sig = pan2(x)
        mx.sfx(t0, sig, 0, 1.0, 4.0, "vo")
        CUE_LOG.append((f"VO {name}", t0, "vo", "key", len(mx.cues) - 1))
    # ---- ACT 4: the kit's end-card package (sheet, thup, cup plop, SONIC LOGO on the logo dots, CTA stamp, pop, glints,
    # dot-hop echoes) — every cue locked to kit/endcard/cues.ts
    n0 = len(mx.cues)
    used = sfx.endcard_sfx(mx, F(CARD))
    names = ["sheet swish", "sheet thup", "cup plop", "SONIC LOGO", "CTA stamp", "CTA chime", "comment pop", "glint cup",
             "glint CTA", "dot hop echo 1", "dot hop echo 2"]
    for k, (t, kind, _, _) in enumerate(mx.cues[n0:]):
        CUE_LOG.append((f"END_CARD {names[k] if k < len(names) else kind}", t, kind,
                        "bed" if kind in ("paper_swish", "glint", "sparkle", "cta_chime") else "key", n0 + k))
    return mx, used


def key_transients():
    """Frames of the key SFX transients the music must not flam (drum ghosts/snaps step aside)."""
    fs = list(C["BUBBLE_POP"]) + list(C["COUNTER_FLIP"]) + [C["RING_TICK"], C["OWNER_THOUGHT_POP"], C["OWNER_LINE_POP"]]
    fs += list(C["TEEN_TAPS"]) + list(C["SCOOP_SLURP"]) + LOGO_DOTS + [COMMENT_POP, CTA]
    return np.array([F(f) for f in fs])


def load_vo():
    out = []
    if not VO_DIR.exists():
        return out
    anchors = {h: F(C["VOICE_LINE"][i]) for i, h in enumerate(IDS)}
    anchors["owner"] = F(C["OWNER_LINE_POP"])
    for h, t0 in anchors.items():
        f = VO_DIR / f"{h}.wav"
        if f.exists():
            x, sr = sf.read(f, always_2d=True)
            x = x.mean(1)
            if sr != SR:
                x = resample_poly(x, SR, sr)
            x = filt(peq(x, 3000, 2, .8), "highpass", 90, 2)
            out.append((h, t0, .25 * x / (np.abs(x).max() + 1e-9)))
    return out


# =============================== mastering with the TRUE SILENCE enforced after the master ===============================
def silence_mask():
    g = np.ones(N)
    a, b = int(round(F(SIL[0]) * SR)), int(round(F(SIL[1]) * SR))
    f = int(.003 * SR)
    g[a - f:a] = np.linspace(1, 0, f)
    g[a:b] = 0
    g[b:b + f] = np.linspace(0, 1, f)
    return g


def deliver(x, log):
    """sfx.deliver(), but the comic dead stop is re-zeroed AFTER the master's filters + limiter (their IIR ringing
    would otherwise leave -100 dB dust in it): the window is digital zero in the WAV and survives the MP3."""
    mask = silence_mask()
    ceil = -1.6
    for _ in range(5):
        out, g = sfx.master(x * mask[:, None], DUR, ceil, .38)
        out = out * mask[:, None]
        sf.write(WAV, out, SR, subtype="PCM_24")
        sfx.encode_mp3(WAV, MP3, 0.0)
        i0, _, _ = sfx.ebur128(MP3)
        sfx.encode_mp3(WAV, MP3, sfx.TARGET_LUFS - i0)
        I, tp, lra = sfx.ebur128(MP3)
        if tp <= sfx.TP_MAX - .2:
            break
        ceil -= tp - (sfx.TP_MAX - .3)
    Iw, tpw, lraw = sfx.ebur128(WAV)
    body_ = g[int(.01 * SR):int((DUR - .4) * SR)]
    body_ = body_[body_ > 0]
    gr = 20 * np.log10(body_ / body_.max())
    log(f"limiter ceiling {ceil:.2f} dBFS (4x oversampled); gain reduction: max {-gr.min():.1f} dB, median {-np.median(gr):.1f} dB, "
        f">2 dB for {100 * (gr < -2).mean():.1f}% of the spot")
    log(f"{WAV.relative_to(REPO)}: {len(out)} samples = {len(out) / SR:.4f} s | I {Iw:.1f} LUFS, TP {tpw:.1f} dBTP, LRA {lraw:.1f} LU "
        f"(ffmpeg ebur128); own meter {sfx.lufs(out):.2f} LUFS")
    log(f"{MP3.relative_to(REPO)}: I {I:.1f} LUFS, TP {tp:.1f} dBTP, LRA {lra:.1f} LU")
    assert len(out) == N
    return out, g * mask, dict(wav_I=Iw, wav_TP=tpw, wav_LRA=lraw, mp3_I=I, mp3_TP=tp, mp3_LRA=lra, ceiling=ceil)


# =============================== verification ===============================
def decode(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True)
    return np.frombuffer(pcm.stdout, np.float32).reshape(-1, 2).astype(np.float64)


def krms_db(x, a, b):
    k = sfx.kweight(x[max(0, int(a * SR)):max(int(a * SR) + 1, int(b * SR))])
    return 10 * np.log10((k ** 2).mean() + 1e-20)


def phone(x):
    return filt(filt(x, "highpass", 300, 4), "lowpass", 8000, 4)


def onset_near(x, t, lo=-.03, hi=.08, db=-15):
    """First time in [t+lo, t+hi] where the 1 ms envelope reaches window peak + db and stands >= 9 dB over the
    previous 15 ms minimum (so a decaying tail is not taken for the onset)."""
    pre, w = int(.02 * SR), int(.015 * SR)
    a, b = max(0, int((t + lo) * SR) - pre), int((t + hi) * SR)
    e = uniform_filter1d(np.abs(x[a:b]).max(1), int(.001 * SR)) + 1e-9
    mf = minimum_filter1d(e, w)
    prev = np.r_[np.full(w // 2, e[0]), mf[:-(w // 2)]]
    ok = (e > e[pre:].max() * 10 ** (db / 20)) & (e > prev * 10 ** (9 / 20))
    ok[:pre] = False
    return (a + (np.argmax(ok) if ok.any() else pre + np.argmax(e[pre:] > e[pre:].max() * 10 ** (db / 20)))) / SR


SWELLS = {"arm_swish", "whip", "paper_swish", "misbaha", "heap_scoop", "light_open", "swish_big"}


def verify(out, mu, sx, g, mx, dec, log):
    import librosa
    mono = out.mean(1)
    lib = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=SR, hop_length=128, units="time", backtrack=False)
    ph_mu = phone(mu)
    rows = []
    log("\nCUE vs ONSET (each cue measured on its own dry signal x master gain; 'mix' = nearest librosa onset of the full "
        "mix within 50 ms)")
    log(f"  {'cue':<38} {'frame':>6} {'cue s':>7} {'onset s':>8} {'err ms':>7} | {'mix onset':>9} {'err':>5} | over music dB full / phone")
    for label, t, kind, role, idx in CUE_LOG:
        _, _, i0, sig = mx.cues[idx]
        x = np.zeros((N, 2))
        a0 = max(0, i0)
        n = min(len(sig) - (a0 - i0), N - a0)
        if n <= 0:
            continue
        x[a0:a0 + n] = sig[a0 - i0:a0 - i0 + n] * g[a0:a0 + n, None]
        if not np.abs(x).max() > 0:
            log(f"  {label:<38} {t * FPS:6.1f} {t:7.3f}   (silenced)")
            continue
        sw = kind in SWELLS
        e = uniform_filter1d(np.abs(x[a0:a0 + n]).max(1), int(.001 * SR))
        on = (a0 + np.argmax(e > e.max() * 10 ** ((-30 if sw else -15) / 20))) / SR
        win = (on, on + .12) if not sw else (on, on + .25)
        near = lib[np.abs(lib - on) < .05]
        mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        mdb = krms_db(mu, *win)
        rel = krms_db(x, *win) - mdb
        relp = krms_db(phone(x), *win) - krms_db(ph_mu, *win)
        rs = "music silent" if mdb < -90 else f"{rel:+5.1f} / {relp:+5.1f}"
        ms = f"{mo:9.3f} {1000 * (mo - on):+5.0f}" if mo == mo else f"{'—':>9} {'':>5}"
        log(f"  {label:<38} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+7.0f}{'s' if sw else ' '}| {ms} | {rs}")
        rows.append(dict(cue=label, frame=round(t * FPS, 2), t=round(t, 4), kind=kind, role=role, onset=round(on, 4),
                         err_ms=round(1000 * (on - t), 1), swell=sw, mix_onset=None if mo != mo else round(float(mo), 4),
                         over_music_db=None if mdb < -90 else round(rel, 1), over_music_phone_db=None if mdb < -90 else round(relp, 1)))
        if kind == "sonic_logo":
            t2 = F(LOGO_DOTS[1])
            on2 = onset_near(x, t2, -.03, .05)
            log(f"  {'  SONIC LOGO clack 2 (logo dot 2)':<38} {LOGO_DOTS[1]:6.1f} {t2:7.3f} {on2:8.3f} {1000 * (on2 - t2):+7.0f}")
            rows.append(dict(cue="SONIC LOGO clack 2", frame=LOGO_DOTS[1], t=round(t2, 4), onset=round(on2, 4), err_ms=round(1000 * (on2 - t2), 1)))
        if kind == "logo_echo":
            t2 = t + F(EC["logoDots"][1] - EC["logoDots"][0])
            on2 = onset_near(x, t2, -.03, .05)
            log(f"  {'  echo clack 2':<38} {t2 * FPS:6.1f} {t2:7.3f} {on2:8.3f} {1000 * (on2 - t2):+7.0f}")
    log("\nMUSIC HITS vs ONSET (each hit's own dry signal; 'mix' = nearest librosa onset of the full mix within 50 ms)")
    errs, mrows = [], []
    for label, t, sig in sorted(MUSIC_EVENTS, key=lambda e: e[1]):
        e = uniform_filter1d(np.abs(sig).max(1), int(.001 * SR))
        on = max(0, int(round(t * SR))) / SR + np.argmax(e > e.max() * 10 ** (-15 / 20)) / SR
        errs.append(1000 * (on - t))
        near = lib[np.abs(lib - on) < .05]
        mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        ms = f"{mo:9.3f} {1000 * (mo - on):+5.0f}" if mo == mo else f"{'—':>9} {'':>5}"
        log(f"  {label[:52]:<52} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+6.0f} | {ms}")
        mrows.append(dict(hit=label, frame=round(t * FPS, 2), t=round(t, 4), onset=round(on, 4), err_ms=round(1000 * (on - t), 1),
                          mix_onset=None if mo != mo else round(float(mo), 4)))
    log(f"  music hits: {sum(abs(e) <= 12 for e in errs)}/{len(errs)} start within 12 ms of their frame (median {np.median(errs):+.1f} ms)")
    # the dead stop + silence
    i_stop = int(round(F(STOP) * SR))
    pk = lambda a, b: 20 * np.log10(np.abs(mu[int(a * SR):int(b * SR)]).max() + 1e-12)
    log(f"\nMUSIC_STOP f{STOP} ({F(STOP):.3f} s), hard cut: music stem before the cut (last 100 ms) {pk(F(STOP) - .1, F(STOP)):.1f} dBFS; "
        f"after it: first 7 ms {pk(F(STOP), F(STOP) + .007):.1f} dBFS (the master's 32 Hz HPF ringing on the cut, under the skid), "
        f"7 ms..f{SIL[0]} {pk(F(STOP) + .007, F(SIL[0])):.1f} dBFS, f{SIL[0]}..f{C['OWNER_CREEP']} {pk(F(SIL[0]), F(C['OWNER_CREEP']) - .001):.1f} dBFS")
    i0, i1 = int(round(F(SIL[0]) * SR)), int(round(F(SIL[1]) * SR))
    for name, x in (("WAV (24-bit)", sf.read(WAV)[0]), ("MP3 decoded", dec)):
        seg = x[i0:i1]
        nz = np.flatnonzero(np.abs(seg).max(1) > 0)
        inner = x[i0 + int(.03 * SR):i1 - int(.03 * SR)]
        log(f"  {name}: {len(x)} samples = {len(x) / SR:.4f} s | TRUE SILENCE f{SIL[0]}-f{SIL[1]} ({F(SIL[0]):.3f}-{F(SIL[1]):.3f} s): "
            f"peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS, non-zero samples {len(nz)}/{len(seg)}"
            + (f" ({F(SIL[0]) + nz[0] / SR:.4f}..{F(SIL[0]) + nz[-1] / SR:.4f} s)" if len(nz) else "")
            + f", inner (±30 ms) peak {20 * np.log10(np.abs(inner).max() + 1e-12):.1f} dBFS | last sample "
            f"{20 * np.log10(np.abs(x[-1]).max() + 1e-12):.1f} dBFS | samples >= .999: {int((np.abs(x) >= .999).sum())}")
    a, b = int(2.0 * SR), int(4.0 * SR)
    xc = np.correlate(dec[a - 2048:b + 2048, 0], out[a:b, 0], "valid")
    log(f"  MP3 vs WAV alignment: {int(np.argmax(xc)) - 2048:+d} samples (cross-correlation 2-4 s)")
    # phone translation, balance, spectrum
    P = phone(out)
    L, R = out[:, 0], out[:, 1]
    log(f"\n  mono: L/R correlation {np.corrcoef(L, R)[0, 1]:+.2f}; mono fold-down {sfx.lufs(np.stack([out.mean(1)] * 2, 1)) - sfx.lufs(out):+.2f} dB")
    f, _, Z = stft(mono, SR, nperseg=4096)
    p = (np.abs(Z) ** 2).sum(1)
    log("  energy share: " + ", ".join(f"{a}-{b} Hz {100 * p[(f >= a) & (f < b)].sum() / p.sum():.1f}%"
                                       for a, b in [(0, 120), (120, 300), (300, 5000), (5000, 8000), (8000, 24000)]))
    log(f"  phone-speaker sim (HPF 300 Hz + LPF 8 kHz, 4th order): loudness {sfx.lufs(P) - sfx.lufs(out):+.1f} dB vs full")
    cs = [(.0, 2.0, "act 1a"), (2.0, F(STOP), "act 1b"), (F(STOP), F(C["SNATCH_WHOOSH"]), "silence+crickets"),
          (F(C["SNATCH_WHOOSH"]), F(C["NOTE_SLAP"]), "snatch+slump"), (F(C["NOTE_SLAP"]), F(CARD), "moral"), (F(CARD), DUR, "end card")]
    seg = lambda x, a, b: x[int(a * SR):int(b * SR)]
    ld = lambda x: -.691 + 10 * np.log10((sfx.kweight(x) ** 2).mean(0).sum() + 1e-20)
    log("  section loudness (K-weighted RMS, LUFS-ish) full / phone: " + " | ".join(
        f"{n} {ld(seg(out, a, b)):.1f} / {ld(seg(P, a, b)):.1f}" for a, b, n in cs))
    # Act 1 balance (stems x master gain), phone band
    g2 = g[:, None]
    a, b = 0.0, F(STOP)
    log("  act 1 stems, K-weighted level f0-f%d full / phone (dB re mix): " % STOP + " | ".join(
        f"{k} {ld(seg(v * g2, a, b)) - ld(seg(out, a, b)):+.1f} / {ld(seg(phone(v * g2), a, b)) - ld(seg(P, a, b)):+.1f}"
        for k, v in ACT1_STEMS.items()) + f" | sfx {ld(seg(sx, a, b)) - ld(seg(out, a, b)):+.1f} / {ld(seg(phone(sx), a, b)) - ld(seg(P, a, b)):+.1f}")
    return rows, mrows, P


# =============================== pictures of the sound (PIL) ===============================
def _font(size):
    from PIL import ImageFont
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def plot(out, P, path, t0=0.0, t1=None, title=""):
    from PIL import Image, ImageDraw
    t1 = DUR if t1 is None else t1
    W_, M = 2600, 60
    pw = W_ - 2 * M
    X = lambda t: M + (t - t0) / (t1 - t0) * pw
    hw, hs, hl = 230, 380, 150
    H_ = 50 + hw + hs + hl + 330 + 60
    im = Image.new("RGB", (W_, H_), (18, 18, 22))
    d = ImageDraw.Draw(im)
    f12, f18 = _font(12), _font(18)
    d.text((M, 12), title, fill=(230, 230, 230), font=f18)
    y0 = 50
    for x_, col in ((out, (200, 200, 210)), (P, (1, 232, 213))):
        mono = x_[int(t0 * SR):int(t1 * SR)].mean(1)
        idx = np.linspace(0, len(mono), pw + 1).astype(int)
        for c in range(pw):
            sl = mono[idx[c]:max(idx[c] + 1, idx[c + 1])]
            d.line([(M + c, y0 + hw / 2 - sl.max() * hw / 2), (M + c, y0 + hw / 2 - sl.min() * hw / 2)], fill=col)
    d.text((M + 4, y0 + 2), "waveform: full (grey), phone band 300 Hz-8 kHz (turquoise)", fill=(160, 160, 160), font=f12)
    y1 = y0 + hw + 10
    seg_ = out[int(t0 * SR):int(t1 * SR)].mean(1)
    hop = max(64, int(len(seg_) / pw))
    f, _, Z = stft(seg_, SR, nperseg=2048, noverlap=2048 - hop)
    db = 20 * np.log10(np.abs(Z) + 1e-9)
    fl = np.geomspace(40, 12000, hs)[::-1]
    img = np.array([np.interp(fl, f, db[:, i]) for i in range(db.shape[1])]).T
    img = np.clip((img - (db.max() - 80)) / 80, 0, 1)[:, np.linspace(0, img.shape[1] - 1, pw).astype(int)]
    lut = np.stack([np.clip(1.6 * img - .2, 0, 1), np.clip(1.6 * img - .75, 0, 1) ** .8, np.clip(np.sin(np.pi * img) * .85, 0, 1)], -1)
    im.paste(Image.fromarray((lut * 255).astype(np.uint8)), (M, y1))
    for fq in (100, 300, 1000, 3000, 8000):
        yy = y1 + np.argmin(np.abs(fl - fq))
        d.text((4, yy - 7), f"{fq if fq < 1000 else str(fq // 1000) + 'k'}", fill=(160, 160, 160), font=f12)
    y2 = y1 + hs + 10
    for x_, col in ((out, (200, 200, 210)), (P, (1, 232, 213))):
        k = sfx.kweight(x_)
        pts = []
        for tc in np.arange(t0, t1, .02):
            a, b = int(max(0, tc - .2) * SR), int(min(DUR, tc + .2) * SR)
            v = -.691 + 10 * np.log10((k[a:b] ** 2).mean(0).sum() + 1e-12)
            pts.append((X(tc), y2 + hl * (1 - np.clip((v + 50) / 45, 0, 1))))
        d.line(pts, fill=col, width=2)
    d.line([(M, y2 + hl * (1 - 36 / 45)), (W_ - M, y2 + hl * (1 - 36 / 45))], fill=(120, 60, 60))
    d.text((M + 4, y2 + 2), "momentary loudness (400 ms) -50..-5 LUFS; red = -14", fill=(160, 160, 160), font=f12)
    y3 = y2 + hl + 10
    lanes = [0] * 14
    for label, t, kind, role, _ in CUE_LOG:
        if not t0 - .05 <= t <= t1:
            continue
        x = X(t)
        col = (255, 120, 120) if role == "key" else (140, 140, 170)
        d.line([(x, y0), (x, y3)], fill=col)
        lab = f"{t * FPS:.0f} {label.split(' ')[0] if t1 - t0 > 6 else label}"
        lane = next((i for i, e in enumerate(lanes) if e < x), len(lanes) - 1)
        lanes[lane] = x + d.textlength(lab, font=f12) + 6
        d.text((x + 2, y3 + 4 + lane * 22), lab, fill=col, font=f12)
    for f_, lab in ((STOP, "MUSIC STOP"), (SIL[0], "silence"), (SIL[1], "crickets"), (C["NOTE_SLAP"], "note"), (CARD, "end card"),
                    (BUTTON, "button")):
        if t0 <= F(f_) <= t1:
            d.line([(X(F(f_)), y0), (X(F(f_)), y3)], fill=(255, 210, 60), width=2)
            d.text((X(F(f_)) + 3, y0 - 16), lab, fill=(255, 210, 60), font=f12)
    step = .5 if t1 - t0 > 4 else .1
    for tc in np.arange(np.ceil(t0 / step) * step, t1 + 1e-9, step):
        d.text((X(tc) - 14, H_ - 38), f"{tc:.1f}s", fill=(190, 190, 190), font=f12)
        d.text((X(tc) - 14, H_ - 22), f"f{tc * FPS:.0f}", fill=(120, 120, 120), font=f12)
    im.save(path)


# =============================== main ===============================
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "stems").mkdir(exist_ok=True)
    MP3.parent.mkdir(parents=True, exist_ok=True)
    lines = []

    def log(s=""):
        print(s)
        lines.append(s)

    log(f"timeline (spec.ts, kit cues.ts): {TL['DURATION']} f = {DUR:.4f} s = {N} samples | digs {DIG} | voice {VOICE} | "
        f"stop {STOP} silence {SIL} crickets {C['CRICKETS']} snatch {C['SNATCH_WHOOSH']}/{C['SNATCH_GRAB']}/{C['SNATCH_FLIP']} "
        f"note {C['NOTE_SLAP']} title {C['TITLE_WORDS']} | end card {CARD} logo dots {LOGO_DOTS} cta {CTA} comment pop "
        f"{COMMENT_POP} hops {HOPS}")
    log("act 1 bars (frames): " + " ".join(f"[{a:g}-{b:g}]" for a, b in BARS) + "  ->  BPM " +
        " ".join(f"{60 / (F(b - a) / 2):.0f}" for a, b in BARS))
    log("end-card bars (frames): " + " ".join(f"[{a:g}-{b:g}]" for a, b in EBARS) + f" button {BUTTON} | run bar {RUNBAR}")
    vo = load_vo()
    vo_ids = {h for h, _, _ in vo}
    if vo:
        log(f"VO lines found: {sorted(vo_ids)}")
    kt = key_transients()
    clear = lambda t, w=.04: bool(np.all(np.abs(kt - t) >= w))
    music = sfx.lowshelf(act1_music(vo_ids, clear) + act234_music(clear), 110, -2)
    mx, used = build(vo)
    mx.music(music)
    mx.silence(F(SIL[0]), F(SIL[1]))
    x = mx.mix(sfx_room=.08)
    out, g, meas = deliver(x, log)
    # stems at the master gain (for checks and remixes)
    dd = np.r_[mx.duck, np.zeros(-N % 48)].reshape(-1, 48).max(1)  # (the kit Mixer.mix() ducking curve, replayed)
    for k in range(1, len(dd)):
        dd[k] = max(dd[k], dd[k - 1] * .986)
    d = 10 ** (-uniform_filter1d(np.repeat(uniform_filter1d(dd, 4), 48), 96)[:N] / 20)
    mu = filt(filt(mx.m * d[:, None], "highpass", 32, 3), "lowpass", 15000) * g[:, None]
    sx = out - mu
    sf.write(OUT / "stems/music.wav", mu, SR, subtype="PCM_24")
    sf.write(OUT / "stems/sfx.wav", sx, SR, subtype="PCM_24")
    dec = decode(MP3)
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels",
                           "-of", "compact", str(MP3)], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
    log(f"MP3: {info} | decoded {len(dec)} samples (spot = {N})")
    rows, mrows, P = verify(out, mu, sx, g, mx, dec, log)
    (OUT / "cues.json").write_text(json.dumps(dict(measure=meas, cues=rows, music=mrows), indent=1, ensure_ascii=False))
    (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")
    plot(out, P, OUT / "overview.png", title="OneSpoon soundtrack - 0-15.37 s (cue lanes = spec frames)")
    plot(out, P, OUT / "zoom-act1.png", 0, F(STOP) + .4, "zoom: the counting groove (hook → 7 hands → the owner → MUSIC STOP)")
    plot(out, P, OUT / "zoom-silence.png", F(STOP) - .4, F(C["NOTE_SLAP"]) + .3, "zoom: dead stop → true silence → cricket → snatch → doom → slump")
    plot(out, P, OUT / "zoom-end.png", F(C["NOTE_SLAP"]) - .3, DUR, "zoom: the moral → the run → end card groove → sonic logo → CTA → button")
    if PREVIEW_VIDEO.exists():
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(PREVIEW_VIDEO), "-i", str(WAV), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT / "preview-half.mp4")], check=True)
        pv = decode(OUT / "preview-half.mp4")
        a, b = int(2.0 * SR), int(4.0 * SR)
        xc = np.correlate(pv[a - 4096:b + 4096, 0], out[a:b, 0], "valid")
        log(f"preview: {(OUT / 'preview-half.mp4').relative_to(REPO)} (AAC audio vs master: {int(np.argmax(xc)) - 4096:+d} samples)")


if __name__ == "__main__":
    main()
