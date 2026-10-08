#!/usr/bin/env python3
"""Soundtrack for «الفرق بالـ ق» (Qashati 2D, spot «qaf»): 375 frames = 12.500 s, original synthesis, deterministic.

    nice -n 10 python3 video/src/qashati2d/qaf/audio/make_sound.py
      -> video/public/qashati2d/audio/qaf.mp3    48 kHz stereo, 192 kbps, exact spot length, -14 LUFS, <= -1 dBTP
      -> video/out/qashati2d/qaf.wav              24-bit master (mux this one for delivery)
      -> video/out/qashati2d/qaf/sound/           stems, onset table (cues.json), verify report, overview/zoom plots,
                                                  phone-band WAV, preview-half.mp4 (half-res render + this mix)

TIMING IS NOT COPIED. spec.ts (T, CUES) and the kit end card's cues.ts (EC) are evaluated with esbuild + node at run
time (sfx.ts_eval), so if a cue moves in spec.ts the sound follows on the next run. Every music hit that belongs to a
picture event is placed ON that cue; the grooves' filler notes (ghost strokes, jingles, off-beat strums) sit on a grid
anchored at the cues (the spicy groove at BLOOM_WHOOMP, the sweet groove at QAF_THUD, the end-card phrase at the CTA)
and drop out within 40 ms of any key SFX transient, so nothing flams against the foley.

Everything is synthesized from sines, seeded noise, polyBLEP saws, Karplus-Strong strings and modal resonators. There
are no samples and no borrowed melodies. The sonic logo «تشك-تشك» comes from the shared kit (sfx.endcard_sfx ->
sfx.sonic_logo, fixed brand seed): it is sample-identical to spot #2 and its two clacks land on the end card's two
logo dots. A quieter dry echo of it (sfx.logo_echo) plays when the ق's two cream drops land back on it (DOT_LAND).

THE MUSICAL IDEA: «الفرق كلّو بحرف» → the difference is ONE NOTE. The spot is scored like a cartoon (mickey-mousing:
the band hits what the picture does) on a three-note motif, D-E-F#, the start of D major (jins ajam, sweet). Flatten ONE
note, E -> Eb, and it becomes D-Eb-F#, the start of maqam hijaz on D: the dramatic, "spicy" sound. Same tonic, one
note apart, like قشطة and شطة. The sonic logo is tuned to D, so the sweet side resolves straight into the brand sound.
  ACT 1  0-26    playful and tiny. Frame 0: a pizzicato D3 under the shivering drops (the hook), the knuckle creaks and
                 three rising pizzicato ticks D5-E5-F#5 (the sweet motif, as tension) on 4/6/8. FLICK «طقّ» on 10, the ق
                 tumbles away up-left (spinning whir + a falling slide whistle, panned hard left), the sleeve swish,
                 the ش heals with an ink tick. Room tone fades.
  SILENCE 26-40  TRUE digital zero (enforced on the master AFTER limiting, so it survives in the WAV and the MP3) while
                 the spoon stares at us. One dry blink click at 34, peak -34 dBFS, is the only thing in it.
  ACT 2  40-104  the spicy sting. The silence breaks on a brass + timpani + cymbal D(b9) stab (hijaz colour) with a
                 low ink whoomp. Then three flame ignitions = three brass stabs D-Eb-F#: the motif with ONE note
                 changed. A frantic hijaz dabke follows: tabl (deep dum + stick tak), claps, low-brass ostinato and a
                 tremolo-picked buzuq riff. It peaks on the «شطة؟؟ 🥵» bubble with a brass rip-and-fall, and then the
                 music MELTS with the spoon: the groove stem slows like a dying tape, from 1x to 0.18x over MELT_DROOP.
  ACT 3  104-164 the ق boomerangs back: rising slide whistle + whir crossing left to right, a timpani roll and tremolo
                 strings on the dominant A7 swell into the SLAM (an A7 brass hit, which is maximum pull back to D). The
                 drops land «تشك-تشك» (the logo echo). The wave is the relief: a harp glissando up into D MAJOR exactly
                 as the crest crosses the cup, with warm strings, celesta and a pizzicato bass. The spoon boings back.
  ACT 4  148-270 a sweet, bouncy D-major groove at 112.5 BPM (a quarter is 16 frames): pizzicato bass, bendir (frame
                 drum with snares), riq jingles, buzuq off-beat strums and strings. The line is SUNG by bells on the
                 ink thuds: «الفرق» D5 · «كلّو» E5 · «بحرف.» F#5. Stop-time while «بحرف.» is scribbled out (the buzuq
                 bends that F# sour under the pen). Then «بالـ» A5 and «ق.» = D6, the top of the arpeggio on the downbeat,
                 the same D as the sonic logo, with a tutti hit. The payoff is mickey-moused: harp up on the jump, the
                 «schlup», three pizzicato «nom» notes, a string harmonic stretching up with the strand until it snaps
                 (plink), and a contented horn «mmm» (F#4 -> D4) when the spoon lands with its heap.
  END    270-375 the kit end card package on top of a soft D-major pad. Music holds a «logo break» for the sonic logo
                 (290/296) and comes back on the CTA stamp as the downbeat of a last phrase. On the comment bubble
                 «إنت فريق قشطة ولا فريق شطة؟» the band asks the same question: celesta D-E-F# (team qashta), then
                 buzuq D-Eb-F# (team shatta). The dot-hop echoes and a final D chord fade to digital zero on the last
                 frame, so the spot loops cleanly into the frame-0 hook.
Mix for phone speakers: weight sits in harmonics at 150-600 Hz (tabl and timpani shells, the brass, the bass
pizzicato's 2nd-4th partials). Nothing essential sits below 120 Hz, everything is tamed above 7 kHz (cymbals are
low-passed under 7.2 kHz, fire sizzle at 7 kHz), and key SFX duck the music by their own envelope (kit Mixer).

OPTIONAL HUMAN VO (panel lesson "add a human voice"): drop phone-recorded lines into audio/vo/ and re-run. bubble.wav
plays at BUBBLE_POP («شطة؟؟»), line.wav at TITLE_THUDS[0] («الفرق كلّو بالـ ق»), comment.wav at the comment pop. The
music ducks 4 dB under them. With no files there, nothing changes.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import resample_poly, stft

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "kit/audio"))
import sfx  # noqa: E402
from sfx import (GLOCK, SR, body, env, filt, hz, ks, mallet, midi, noise, norm, osc, pan2, peq,  # noqa: E402
                 place, reverb, smooth_rand, swell, swept, tt, tv_band)

VIDEO, REPO = sfx.VIDEO, sfx.REPO
MP3 = VIDEO / "public/qashati2d/audio/qaf.mp3"
WAV = VIDEO / "out/qashati2d/qaf.wav"
OUT = VIDEO / "out/qashati2d/qaf/sound"
PREVIEW_VIDEO = VIDEO / "out/qashati2d/qaf/render/qaf-half.mp4"
VO_DIR = HERE / "vo"
SEED = sfx.BRAND_SEED + 1100  # this spot's music; the sonic logo keeps the brand seed inside sfx.sonic_logo


# =============================== timeline: evaluated from the TypeScript sources ===============================
def load_timeline():
    return sfx.ts_eval("import {T, CUES, DURATION, FPS, ENDCARD_AT} from './src/qashati2d/qaf/spec';\n"
                       "import {EC, ENDCARD_DURATION} from './src/qashati2d/kit/endcard/cues';\n"
                       "console.log(JSON.stringify({T, CUES, DURATION, FPS, ENDCARD_AT, EC, ENDCARD_DURATION}));")


TL = load_timeline()
T, C, EC, FPS = TL["T"], TL["CUES"], TL["EC"], TL["FPS"]
assert FPS == sfx.FPS == 30
DUR = TL["DURATION"] / FPS                      # 12.5 s
N = int(round(DUR * SR))


def F(f):  # spec frame -> seconds
    return f / FPS


CARD = C["END_CARD"]                            # 270
assert CARD == TL["ENDCARD_AT"]
LOGO_DOTS = [CARD + d for d in EC["logoDots"]]  # 290 296
CTA = CARD + EC["cta"]                          # 316
COMMENT_POP = CARD + EC["comment"] + 2          # 338 (the kit plays its pop on the bubble's overshoot)
HOPS = [CARD + d for d in EC["dotHops"]]        # 362 368
SIL = (C["SILENCE_BEAT"][0], C["SILENCE_BEAT"][1] + 1)  # frames [26, 40) are digital zero (frame 39 is the last one)
BLINK = C["SPOON_BLINK"]                        # 34: the one dry click inside the silence
BLINK_PEAK_DB = -34.0
STING = C["BLOOM_WHOOMP"]                       # 40: the silence breaks
IGN = list(C["IGNITE"])                         # 44 48 52
E8S = IGN[1] - IGN[0]                           # 4 frames: the spicy groove's 8th note (225 BPM in 8ths: frantic)
GROOVE0 = IGN[-1] + E8S                         # 56: the dabke kicks in
MELT = tuple(C["MELT_DROOP"])                   # (80, 100): the music melts with the spoon
SLAM = C["QAF_SLAM"]                            # 118
WAVE = tuple(C["WAVE_SWOOSH"])                  # (134, 156)
ARRIVE = C["WAVE_OVER_CUP"]                     # 142: D major arrives with the crest on the cup
TH = list(C["TITLE_THUDS"])                     # 172 176 180
Q = 4 * T["titleStagger"]                       # 16 frames = a quarter note (112.5 BPM); an 8th = 8 frames
E8 = Q // 2
BAR_B = C["QAF_THUD"]                           # 212: «ق.» is the downbeat of the payoff bar
BAR_A = BAR_B - 4 * Q                           # 148: the sweet groove enters (HONEY_POUR)
BAR_C = BAR_B + 4 * Q                           # 276: the end-card landing chord (then the logo break)
STOP = tuple(C["STRIKE_SCRATCH"])               # stop-time from the scribble ...
STOP_END = C["TITLE3_THUD"]                     # ... to «بالـ» (206)
QUESTION = COMMENT_POP + 2                      # 340: the band asks «قشطة ولا شطة؟» (sweet 340/343/346, spicy 349/352/355)


# =============================== instruments (mono unless noted) ===============================
def saw_blep(f, ph0=0.0):
    """Band-limited sawtooth (polyBLEP) for a per-sample frequency curve f (Hz), in [-1, 1]."""
    dt = np.asarray(f, float) / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    s = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    s[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    s[m] -= x * x + x + x + 1
    return s


def warp(x, ratio):
    """Variable-speed playback: ratio = playback rate per output sample (mono or stereo)."""
    pos = np.cumsum(ratio) - ratio[0]
    pos = pos[pos < len(x) - 1]
    if x.ndim == 1:
        return np.interp(pos, np.arange(len(x)), x)
    return np.stack([np.interp(pos, np.arange(len(x)), x[:, c]) for c in range(x.shape[1])], 1)


def brass_tone(f, a, bright=.7):
    """One brass player: additive tone whose brightness follows its loudness (the «blat» of a hard attack)."""
    ph = 2 * np.pi * np.cumsum(f) / SR
    b = np.clip(.16 + bright * a, 0, .88)
    K = int(min(40, 6000 // max(float(f.min()), 40)))
    s, bk = np.zeros(len(f)), np.ones(len(f))
    for k in range(1, K + 1):
        s += bk * np.sin(k * ph) * np.clip((6200 - k * f) / 900, 0, 1)
        bk = bk * b
    return s * a * (1 - b)


def brass(rng, notes, dur, atk=.014, sfz=.09, hold=.45, rel=.07, bright=.75, scoop=.3, fall=0.0, fall_t=.2, vib=0.0,
          players=3, mute=False):
    """A brass section chord (trombones + horns, `players` per note): ensemble detune and a few ms of human spread,
    a scoop up into pitch, sforzando decay to `hold`, an optional rip-fall at the end. Stereo."""
    t = tt(dur)
    n = len(t)
    a = np.clip(t / atk, 0, 1) ** 1.5 * (hold + (1 - hold) * np.exp(-t / sfz)) * np.clip((dur - t) / rel, 0, 1)
    out = np.zeros((n, 2))
    for nt in notes:
        f0 = hz(nt) if isinstance(nt, str) else nt
        for p in range(players):
            d = 0 if p == 0 else int(rng.uniform(0, .006) * SR)
            fc = f0 * 2 ** (rng.uniform(-7, 7) / 1200) * 2 ** (-scoop / 12 * np.exp(-t / .028))
            if fall:
                fc = fc * 2 ** (-fall / 12 * np.clip((t - (dur - fall_t)) / fall_t, 0, 1) ** 1.6)
            if vib:
                fc = fc * (1 + vib * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6)) * np.clip((t - .15) / .2, 0, 1))
            aa = np.r_[np.zeros(d), a[:n - d]]
            out += pan2(brass_tone(fc, aa, bright), rng.uniform(-.4, .4))
    out = out / np.sqrt(len(notes) * players)
    out = peq(peq(out, 650, 2.5, .9), 1350, 2, 1.2)
    if mute:  # cup mute: nasal, thin, no low end
        out = peq(filt(out, "bandpass", [380, 3400]), 1500, 7, 1.6)
    out = filt(out, "lowpass", 5600)
    return np.tanh(1.6 * out / (np.abs(out).max() + 1e-9)) / np.tanh(1.6)


def strings(rng, notes, dur, atk=.15, rel=.25, trem=0.0, bright=1.0, voices=4, vib=.0045, shape=None):
    """String section (polyBLEP saws, `voices` desks per note spread across the stereo field), bowed body EQ.
    trem = bowed tremolo depth (~13 bow changes per second); shape(x) = dynamic curve over the note (x in 0..1). Stereo."""
    t = tt(dur)
    n = len(t)
    out = np.zeros((n, 2))
    for nt in notes:
        f0 = hz(nt) if isinstance(nt, str) else nt
        for k in range(voices):
            fv = f0 * 2 ** (rng.uniform(-8, 8) / 1200) * (1 + vib * np.sin(2 * np.pi * rng.uniform(4.8, 6.0) * t + rng.uniform(0, 6))
                                                          * np.clip((t - .08) / .2, 0, 1))
            out += pan2(saw_blep(fv, rng.uniform()), -.65 + 1.3 * k / max(1, voices - 1))
    out /= np.sqrt(len(notes) * voices)
    out = filt(out, "lowpass", 3000 * bright, 2)
    out = peq(peq(peq(out, 300, 2, 1.0), 1150, -2.5, 1.2), 2700, 2, 1.4)
    e = np.clip(t / atk, 0, 1) ** 1.6 * np.clip((dur - t) / rel, 0, 1)
    if shape is not None:
        e = e * shape(t / dur)
    if trem:
        tm = np.abs(np.sin(np.pi * 6.6 * t + .4 * smooth_rand(rng, n, 1.5)))
        e = e * ((1 - trem) + trem * tm)
    return out * e[:, None]


TIMP = [(1.0, 1.0, .55), (1.504, .55, .45), (1.742, .35, .35), (2.0, .28, .3), (2.245, .2, .25), (2.494, .15, .2),
        (2.8, .1, .15), (2.989, .08, .12)]


def timpani(rng, note, length=1.4, soft=False):
    """Timpani: the kettle's (1,1)..(1,5) modes (near-harmonic, what a phone hears), a short low boom, felt stick."""
    f = hz(note)
    t = tt(length)
    s = sum(a * np.sin(2 * np.pi * f * r * (1 + .012 * np.exp(-t / .04)) * t + rng.uniform(0, 6)) * np.exp(-t / (d * (.7 if soft else 1)))
            for r, a, d in TIMP)
    boom = osc(f * .55 * (1 + .9 * np.exp(-t / .01))) * env(t, .001, .07)
    stick = norm(filt(noise(rng, len(t)), "bandpass", [300, 2600])) * env(t, .0004, .005)
    return norm(s) * np.minimum(t / .0012, 1) + .55 * boom + (.12 if soft else .3) * stick


def timp_roll(rng, note, dur, v0=.12, v1=1.0):
    """A timpani roll (two mallets, ~17 strokes/s) with a crescendo v0 -> v1. Stereo."""
    out = np.zeros((int((dur + 1.0) * SR), 2))
    tc, k = 0.0, 0
    while tc < dur:
        v = v0 + (v1 - v0) * (tc / dur) ** 1.6
        place(out, timpani(rng, note, .9, soft=True) * v * rng.uniform(.85, 1), tc, -.15 if k % 2 else .15)
        tc += 1 / (17 * rng.uniform(.92, 1.08))
        k += 1
    return out


HARP_BODY = [(190, .02, 1.0), (380, .016, 1.1), (720, .01, .9), (1300, .007, .5)]


def harp(rng, note, length=1.4):
    f = hz(note)
    s = ks(rng, f, length, t60=1.5 * (400 / f) ** .25, damp=.22, pos=.32, exc_lp=5000)
    return norm(body(s * np.clip((length - tt(length)) / .05, 0, 1), HARP_BODY))


def harp_gliss(rng, notes, dur, length=1.2, pan=(-.4, .4)):
    """A harp glissando: `notes` spread over `dur` s (first note at 0, last at dur). Stereo."""
    out = np.zeros((int((dur + length) * SR), 2))
    for i, nt in enumerate(notes):
        x = i / max(1, len(notes) - 1)
        place(out, harp(rng, nt, length) * (.65 + .35 * x), x * dur, pan[0] + (pan[1] - pan[0]) * x)
    return out


def celesta(rng, note, length=1.3, d=None):
    m = midi(note)
    d = length / 4 if d is None else d  # rings out to ~-35 dB by the end of `length` (no cut-off)
    s = mallet(m, [(1, 1, 1), (4.0, .1, .12), (2.0, .05, .3)], d=d, length=length, attack=.0012)
    t = tt(length)
    return s + .1 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0002, .0015)


def glock(note, length=1.0, d=None):
    return mallet(midi(note), GLOCK, d=length / 4 if d is None else min(d, length / 3.5), length=length)


BUZUQ_BODY = [(260, .02, 1.0), (520, .015, 1.2), (950, .01, 1.3), (1650, .008, 1.1), (2700, .006, .8), (3800, .004, .4)]


def buzuq(rng, note, length=.6, bend=None, mute=False):
    """Buzuq: the bright long-neck lute (thin metal double course, plectrum tick, small body) — not the oud.
    bend(t) -> pitch ratio (played as a variable-speed read, so the pluck's attack survives)."""
    f = hz(note) if isinstance(note, str) else note
    ln = length + (.4 if bend is not None else .02)
    t60 = (.22 if mute else 1.3) * (400 / f) ** .3
    a = ks(rng, f * 2 ** (1.5 / 1200), ln, t60=t60, damp=.36 if mute else .12, pos=.1, exc_lp=7500)
    b = ks(rng, f * 2 ** (-1.5 / 1200), ln, t60=t60 * .9, damp=.38 if mute else .15, pos=.12, exc_lp=7000)
    s = a + .7 * np.r_[np.zeros(int(.001 * SR)), b][:len(a)]
    t = tt(ln)
    s = s + .28 * norm(filt(noise(rng, len(t)), "bandpass", [2500, 6500])) * env(t, .0002, .0012)
    if bend is not None:
        s = warp(s, bend(tt(ln * 2)))
    n = int(length * SR)
    s = s[:n] * np.clip((length - tt(length))[:len(s[:n])] / .02, 0, 1)
    return norm(body(s, BUZUQ_BODY))


def buzuq_trem(rng, note, dur, rate=2):
    """Tremolo-picked buzuq note: `rate` plucks per 4-frame 8th (i.e. every 2 frames at rate 2)."""
    step = F(E8S) / rate
    out = np.zeros(int((dur + .25) * SR))
    k = 0
    while k * step < dur - 1e-6:
        x = buzuq(rng, note, .2)
        i = int(round(k * step * SR))
        out[i:i + len(x)] += x[:len(out) - i] * (1 if k % 2 == 0 else .72)
        k += 1
    return out


def strum(rng, notes, mute=True, spread=.007):
    """A short off-beat buzuq strum (muted «chk»): the chord's strings one after the other."""
    out = np.zeros(int(.4 * SR))
    for i, nt in enumerate(notes):
        x = buzuq(rng, nt, .3, mute=mute)
        o = int(i * spread * SR)
        out[o:o + len(x)] += x[:len(out) - o] * (1 - .12 * i)
    return out


PIZZ_BODY = [(290, .02, 1.0), (450, .015, 1.2), (1100, .01, 1.0), (2500, .006, .6)]


def pizz(rng, note, length=.5):
    """Violin/viola pizzicato."""
    f = hz(note)
    s = ks(rng, f, length, t60=.35 * (600 / f) ** .2, damp=.3, pos=.25, exc_lp=4500)
    return norm(body(s * np.clip((length - tt(length)) / .03, 0, 1), PIZZ_BODY))


BASS_BODY = [(98, .03, 1.0), (180, .025, 1.2), (290, .02, 1.5), (520, .012, 1.0), (900, .008, .6)]


def pbass(rng, note, length=.45):
    """Pizzicato double bass: its 2nd-4th partials are lifted, so a phone speaker still hears the line."""
    f = hz(note)
    s = ks(rng, f, length + .02, t60=.9, damp=.3, pos=.18, exc_lp=3500)[:int(length * SR)]
    s = norm(body(s * np.clip((length - tt(length)) / .04, 0, 1), BASS_BODY))
    return norm(peq(peq(s, 2.5 * f, 5, .9), 4 * f, 3, 1.0))


def bendir(rng, kind, v=1.0):
    """Bendir (frame drum with gut snares): D = the low centre stroke with its snare buzz, T = the edge slap."""
    j = lambda: rng.uniform(.97, 1.03)
    if kind == "D":
        t = tt(.5)
        f0 = 80 * j()
        s = .45 * osc(f0 * (1 + .6 * np.exp(-t / .015))) * env(t, .002, .15)
        s = s + sum(a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / d)
                    for r, a, d in [(1.85, .55, .09), (2.6, .4, .06), (3.45, .3, .04), (4.3, .18, .03)])
        sn = norm(filt(noise(rng, len(t)), "bandpass", [900, 4500])) * env(t, .004, .1) * (1 + .5 * smooth_rand(rng, len(t), 40))
        return (s + .3 * sn) * v
    t = tt(.25)
    ring = sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
               for f, a, d in [(390, .5, .04), (730, .5, .03), (1160, .35, .02), (1900, .2, .012)])
    slap = norm(filt(noise(rng, len(t)), "bandpass", [1200, 5500])) * env(t, .0003, .006)
    sn = norm(filt(noise(rng, len(t)), "bandpass", [1500, 6000])) * env(t, .003, .07)
    return (.5 * ring + .6 * slap + .35 * sn) * v


def tabl(rng, kind, v=1.0):
    """Tabl baladi (the dabke drum): D = the beater on the big head (deep boom + loud shell), T = the thin stick's
    dry crack on the other head. The shell's 150-800 Hz modes are what a phone plays of the dum."""
    j = lambda: rng.uniform(.97, 1.03)
    if kind == "D":
        t = tt(.6)
        f0 = 62 * j()
        boom = osc(f0 * (1 + 1.2 * np.exp(-t / .02))) * env(t, .0015, .18)
        boom = filt(np.tanh(2.2 * boom) / np.tanh(2.2), "highpass", 75, 2)  # the sub is felt, not played: keep its harmonics
        shell = norm(sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                         for f, a, d in [(150, 1, .12), (228, .7, .09), (342, .5, .06), (520, .3, .04), (810, .15, .025)]))
        hit = norm(filt(noise(rng, len(t)), "bandpass", [200, 1500])) * env(t, .0008, .012)
        return (.45 * boom + .6 * shell * np.minimum(t / .001, 1) + .3 * hit) * v
    t = tt(.2)
    crack = norm(filt(noise(rng, len(t)), "bandpass", [1500, 5500])) * env(t, .0002, .004)
    ring = norm(sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                    for f, a, d in [(560, .6, .025), (890, .4, .018), (1400, .3, .01)]))
    return (.7 * crack + .5 * ring * np.minimum(t / .0005, 1)) * v


def clap(rng, v=1.0):
    """Hand claps (a few hands, a few ms apart)."""
    t = tt(.25)
    offs = np.r_[0, np.cumsum(rng.uniform(.004, .011, 3))]
    n = norm(filt(noise(rng, len(t)), "bandpass", [900, 3600]))
    e = sum(env(np.maximum(t - o, 0), .0003, .004) * (t >= o) for o in offs)
    e = e + .6 * env(np.maximum(t - offs[-1], 0), .001, .045) * (t >= offs[-1])
    return n * e * v


def cymbal(rng, length=1.8, dark=1.0):
    """Suspended cymbal: inharmonic plate partials + hiss, everything kept under 7.2 kHz for phone speakers."""
    t = tt(length)
    n = len(t)
    s = np.zeros(n)
    for _ in range(46):
        f = rng.uniform(380, 7000)
        s += rng.uniform(.3, 1) * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / (rng.uniform(.25, 1.0) * (900 / f) ** .35))
    hiss = norm(filt(noise(rng, n), "bandpass", [1800, 7000])) * env(t, .0005, .4)
    stick = norm(filt(noise(rng, n), "bandpass", [600, 4000])) * env(t, .0003, .006)
    s = .65 * norm(s) * np.minimum(t / .001, 1) + .45 * hiss + .3 * stick
    return filt(peq(s, 5200, -5 * dark, .7), "lowpass", 7200, 4)


def cym_swell(rng, dur):
    """A reversed cymbal: swells for `dur` s and ends ON its cue (place it with lead = dur)."""
    s = np.flip(cymbal(rng, dur + .05))[-int(dur * SR):]
    return s * np.clip(tt(dur) / .05, 0, 1)


def slide_whistle(rng, f):
    """Cartoon slide whistle: near-sine with breath, for a per-sample pitch curve f."""
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + .08 * np.sin(2 * ph) + .03 * np.sin(3 * ph)
    return tone + .22 * norm(tv_band(noise(rng, len(f)), f, .15))


def horn_line(rng, notes, dur, atk=.09, rel=.18, bright=.32):
    """A soft legato horn line (the «mmm»): notes [(t0 s, note)], 45 ms glides between them. Stereo."""
    t = tt(dur)
    bt, bv = [0.0], [np.log(hz(notes[0][1]))]
    for t0, nt in notes[1:]:
        bt += [t0 - .045, t0]
        bv += [bv[-1], np.log(hz(nt))]
    lf = np.interp(t, bt, bv)
    a = np.clip(t / atk, 0, 1) ** 1.4 * np.clip((dur - t) / rel, 0, 1)
    out = np.zeros((len(t), 2))
    for p in range(2):
        fc = np.exp(lf) * 2 ** (rng.uniform(-5, 5) / 1200) * (1 + .004 * np.sin(2 * np.pi * 5 * t + rng.uniform(0, 6)))
        out += pan2(brass_tone(fc, a, bright), -.2 + .4 * p)
    return filt(peq(out, 500, 3, .8), "lowpass", 3500)


def harmonic_gliss(rng, f0, f1, dur):
    """A violin harmonic sliding up (the strand stretching): flute-like, thin, vibrato growing."""
    t = tt(dur)
    x = t / dur
    f = f0 * (f1 / f0) ** (x ** 1.3) * (1 + .006 * np.sin(2 * np.pi * 6 * t) * x)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .12 * np.sin(2 * ph) + .05 * np.sin(3 * ph) + .08 * norm(tv_band(noise(rng, len(t)), f, .1))
    return s * np.clip(t / .06, 0, 1) * (.3 + .7 * x) * np.clip((dur - t) / .008, 0, 1)


# =============================== SFX voices: f(rng, **p) -> (audio, lead s) like the kit ===============================
def room_tone(rng, dur):
    """A breath of paper/room air under the hook (decorrelated L/R), fading out before the silence."""
    t = tt(dur)
    a, b = (norm(filt(noise(rng, len(t)), "bandpass", [170, 1800])) * (.8 + .2 * smooth_rand(rng, len(t), .7)) for _ in range(2))
    e = np.clip(t / .015, 0, 1) * np.clip((dur - t) / .14, 0, 1)
    return np.stack([a * e, b * e], 1), 0.0


def drop_jitter(rng):
    """The ق's cream drops shiver (on twos): a tiny wet wobble."""
    t = tt(.05)
    f = rng.uniform(950, 1300) * (1 + .22 * np.sin(2 * np.pi * 55 * t))
    return pan2(filt(osc(f) * env(t, .002, .011), "lowpass", 3000), .45), 0.0


def knuckle_creak(rng, dur):
    """The finger strains against the thumb: stick-slip skin/knuckle creak, faster and louder as tension rises."""
    t = tt(dur)
    imp = np.zeros(len(t))
    tc = 0.0
    while tc < dur - .002:
        x = tc / dur
        imp[int(tc * SR)] += rng.uniform(.5, 1) * (.35 + .65 * x)
        tc += 1 / (55 * 2.6 ** x) * rng.uniform(.6, 1.4)
    s = filt(body(imp, [(rng.uniform(950, 1100), .004, 1), (rng.uniform(1900, 2200), .003, .7), (3200, .0015, .3), (520, .006, .5)], .05), "lowpass", 5000)
    rub = norm(filt(noise(rng, len(t)), "bandpass", [300, 1400])) * .08
    e = np.clip(t / .01, 0, 1) * np.clip((dur - t) / .008, 0, 1)
    return pan2((norm(s) + rub) * e, .45), 0.0


def flick_snap(rng):
    """«طقّ»: the finger snaps out and its nail hits the thick ink ق — snap crack + a cardboard «tok» + a little thump."""
    t = tt(.4)
    snap = norm(filt(noise(rng, len(t)), "bandpass", [1000, 4500])) * env(t, .0003, .008)
    snap = snap + .5 * np.sin(2 * np.pi * 1750 * t) * env(t, .0002, .006)
    tok = norm(sum(a * np.sin(2 * np.pi * f * rng.uniform(.97, 1.03) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                   for f, a, d in [(420, 1, .03), (760, .7, .02), (1300, .45, .012), (2100, .3, .008)]))
    thump = osc(140 * (1 + .8 * np.exp(-t / .008))) * env(t, .0008, .03)
    s = np.tanh(1.5 * (snap + .8 * tok * np.minimum(t / .0005, 1) + .45 * thump)) / np.tanh(1.5)
    return pan2(s, .35), 0.0


def steel_tink(rng, f0=2600.0, squeak=0.0, pan=-.4):
    """The spoon character's own steel «tink» (+ an optional tiny rubbery «eep» for a flinch)."""
    t = tt(.35)
    st = norm(sum(a * np.sin(2 * np.pi * f0 * r * rng.uniform(.99, 1.01) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                  for r, a, d in [(1, 1, .12), (1.53, .5, .08), (2.41, .3, .05)] if f0 * r < 7000))
    tk = norm(filt(noise(rng, len(t)), "bandpass", [2500, 7000])) * env(t, .0002, .001)
    s = .6 * st * np.minimum(t / .0005, 1) + .3 * tk
    if squeak:
        s = s + squeak * osc(1150 * 2 ** (.45 * np.minimum(t / .06, 1))) * swell(t, .09, .35, a=.004, r=.02) * (t < .09)
    return pan2(filt(s, "lowpass", 7000), pan), 0.0


def spin_away(rng, dur):
    """The ق tumbles away up-left: a spinning whir (falling band = doppler) + a falling slide whistle, hard left."""
    t = tt(dur)
    x = t / dur
    turns = np.cumsum(14 * (1 - .3 * x)) / SR
    am = (.5 + .5 * np.sin(2 * np.pi * turns)) ** 2
    wh = norm(tv_band(noise(rng, len(t)), 2600 * 2 ** (-1.4 * x), .5)) * (.35 + .65 * am)
    sw = slide_whistle(rng, 1450 * 2 ** (-1.5 * x ** .8) * (1 + .03 * np.sin(2 * np.pi * turns)))
    e = np.clip(t / .006, 0, 1) * (1 - .7 * x) * np.clip((dur - t) / .03, 0, 1)
    return pan2((.6 * wh + .45 * sw) * e, np.linspace(.25, -.9, len(t))), 0.0


def sleeve(rng, dur=.24):
    """The kandura sleeve withdraws: a soft cotton swish with a fibrous rustle."""
    t = tt(dur)
    s = swept(rng, dur, 2200, 500, .9) * swell(t, dur, .3, a=.012, r=.06)
    rus = norm(filt(noise(rng, len(t)), "bandpass", [1200, 5000])) * np.clip(smooth_rand(rng, len(t), 90), 0, 1) ** 2
    return pan2((.7 * s + .25 * rus * swell(t, dur, .3, a=.012, r=.06)), np.linspace(.5, .9, len(t))), 0.0


def ink_tick(rng, f0=2200.0, pan=.1):
    """A tiny ink tick (the ش re-shapes / a letter edge)."""
    t = tt(.06)
    s = np.sin(2 * np.pi * f0 * t) * env(t, .0003, .006) + .6 * norm(filt(noise(rng, len(t)), "bandpass", [1500, 5000])) * env(t, .0002, .002)
    return pan2(s, pan), 0.0


def blink_click(rng):
    """The deadpan blink: one dry little «plik» (lid down) — the only sound inside the silence."""
    t = tt(.03)
    s = np.sin(2 * np.pi * 1350 * t) * env(t, .0004, .004) + .5 * norm(filt(noise(rng, len(t)), "bandpass", [1200, 4000])) * env(t, .0002, .0015)
    return pan2(s * np.clip((.03 - t) / .008, 0, 1), -.4), 0.0


def bloom_whoomp(rng):
    """Red ink floods out of the word: a low whoomp (saturated so a phone hears it) + a wet ink splash + air."""
    t = tt(1.0)
    wh = osc(140 * 2 ** (-1.0 * np.minimum(t / .25, 1))) * env(t, .003, .2)
    wh = filt(np.tanh(2.8 * wh) / np.tanh(2.8), "highpass", 60, 2)
    splash = norm(filt(noise(rng, len(t)), "bandpass", [400, 3200])) * env(t, .002, .12) * (1 + .5 * smooth_rand(rng, len(t), 50))
    body_ = norm(sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) for f, a, d in [(210, 1, .08), (330, .7, .06), (520, .4, .04)]))
    air = swept(rng, 1.0, 1800, 300, .8) * env(t, .01, .25)
    return pan2(.7 * wh + .4 * splash + .5 * body_ + .25 * air, 0), 0.0


def boing(rng, f0=170.0, up=1.0, dur=.45, depth=.32, rate=15.0, pan=-.4):
    """Cartoon spring «boing» (jaw-harp twang): a quick pitch jump and a decaying wobble."""
    t = tt(dur)
    f = f0 * 2 ** (.5 * up * np.minimum(t / .07, 1)) * (1 + depth * np.sin(2 * np.pi * rate * t) * np.exp(-t / .12))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .55 * np.sin(2 * ph) + .3 * np.sin(3 * ph) + .15 * np.sin(4 * ph)
    s = peq(s, 950, 7, 2.0)
    return pan2(filt(s, "lowpass", 3500) * env(t, .002, .14), pan), 0.0


def spoon_take(rng):
    """The spoon's TAKE: spring boing up + the metallic «!» ting."""
    out = np.zeros((int(.6 * SR), 2))
    place(out, boing(rng, 190, 1.0, .4, .28, 17)[0], 0, 0, .7)
    place(out, steel_tink(rng, 3100)[0], 0, 0, .55)
    return out, 0.0


def ignite(rng, size=1.0, pan=0.0):
    """Fire catching on a letter / the dome: a sharp «fwoomp» (onset ON the cue), a little thump, crackles."""
    t = tt(.7)
    e = env(t, .006, .1) + .45 * env(t, .03, .3)
    fw = norm(tv_band(noise(rng, len(t)), 300 * 2 ** (2.2 * np.minimum(t / .12, 1)), .9)) * e
    thump = osc(115 * (1 + .5 * np.exp(-t / .02))) * env(t, .003, .06)
    cr = np.zeros(len(t))
    for o in np.sort(rng.uniform(.03, .65, 40)):
        i, m = int(o * SR), int(rng.uniform(.0006, .002) * SR)
        cr[i:i + m] += rng.uniform(.3, 1) * rng.choice([-1, 1]) * np.hanning(m)
    cr = norm(filt(cr, "bandpass", [1500, 6500])) * np.exp(-t / .3)
    return pan2(size * (.8 * fw + .4 * thump) + .22 * cr, pan), 0.0


def glug(rng, dur):
    """Red-hot chili rises in the cup: thick bubbling glugs whose pitch climbs as the cup fills."""
    out = np.zeros(int((dur + .15) * SR))
    tc = 0.0
    while tc < dur:
        f = 230 * 2 ** (1.1 * tc / dur) * rng.uniform(.9, 1.1)
        t = tt(.07)
        b = osc(f * (1 + .9 * t / .07)) * env(t, .003, .022) * rng.uniform(.6, 1)
        i = int(tc * SR)
        out[i:i + len(b)] += b[:len(out) - i]
        tc += rng.uniform(.055, .09)
    t = tt(len(out) / SR)
    thick = norm(filt(noise(rng, len(t)), "lowpass", 700)) * np.clip(t / .05, 0, 1) * np.clip((dur - t) / .08, 0, 1)
    return pan2(filt(out + .22 * thick, "lowpass", 3000), .35), 0.0


def gulp(rng):
    """Cartoon gulp: a throat click, a hollow «glk» falling, then a lower «unk»."""
    t = tt(.35)
    a = osc(520 * 2 ** (-1.4 * np.minimum(t / .07, 1))) * env(t, .003, .05)
    click = norm(filt(noise(rng, len(t)), "bandpass", [800, 3000])) * env(t, .0003, .004)
    t2 = np.maximum(t - .09, 0)
    b = osc(210 * 2 ** (-.5 * np.minimum(t2 / .06, 1))) * env(t2, .004, .05) * (t > .09)
    return pan2(.25 * click + .7 * a + .5 * b, -.35), 0.0


def cam_air(rng, dur=.6):
    """The camera pushes in: a low, soft air swell (felt more than heard)."""
    t = tt(dur)
    return pan2(swept(rng, dur, 220, 900, .8) * swell(t, dur, .45, a=.03, r=.1), 0), 0.0


def pant(rng, times):
    """🥵 cartoon panting «hah-hah-hah» (breath through an /a/ mouth), exhales on the cues, small inhales between."""
    span = max(times) - min(times) + .2
    out = np.zeros(int(span * SR))
    for i, tc in enumerate(times):
        ex = i % 2 == 0
        d = .075 if ex else .05
        t = tt(d)
        src = noise(rng, len(t))
        s = sum(g * norm(filt(src, "bandpass", [f * .85, f * 1.15])) for f, g in ((800, 1), (1250, .8), (2600, .35)))
        s = s * np.clip(t / .006, 0, 1) * np.exp(-t / (.035 if ex else .02)) * (1 if ex else .45)
        i0 = int((tc - min(times)) * SR)
        out[i0:i0 + len(s)] += s[:len(out) - i0]
    return pan2(filt(out, "lowpass", 4500), -.35), 0.0


def drip(rng, pan=-.35):
    """A sweat drop lands on the hot table: a wet blip + a tiny «tss»."""
    s, _ = sfx.sweat_drip(rng)
    t = tt(.12)
    out = np.zeros(max(len(s), len(t)))
    out[:len(s)] += s
    out[:len(t)] += .25 * norm(filt(noise(rng, len(t)), "bandpass", [2500, 6500])) * env(np.maximum(t - .012, 0), .002, .03) * (t > .012)
    return pan2(out, pan), 0.0


def bubble_pop(rng):
    """The «شطة؟؟ 🥵» burst bubble springs out: a round pop + a papery slap."""
    p, _ = sfx.pop(rng, 540)
    t = tt(.16)
    slap = norm(filt(noise(rng, len(t)), "bandpass", [900, 4500])) * env(t, .0003, .01)
    out = np.zeros((len(t), 2))
    out[:len(p)] += p[:len(t)]
    return out + pan2(.45 * slap, -.3), 0.0


def melt_droop(rng, dur):
    """The spoon droops and melts: a rubbery stick-slip creak whose pitch sags, and drips falling off."""
    t = tt(dur)
    x = t / dur
    rate = 210 * 2 ** (-1.6 * x)
    imp = np.zeros(len(t))
    tc = 0.0
    while tc < dur - .003:
        imp[int(tc * SR)] += rng.uniform(.6, 1)
        tc += 1 / float(np.interp(tc, t, rate)) * rng.uniform(.85, 1.15)
    s = norm(filt(body(imp, [(780, .005, 1), (1250, .004, .6), (420, .007, .6)], 0.0), "lowpass", 3200))  # rubber is dull
    e = swell(t, dur, .3, a=.02, r=.12) * .9
    out = pan2(s * e, -.4)
    for k, o in enumerate(np.sort(rng.uniform(.15, dur - .1, 3))):
        tb = tt(.09)
        b = osc(1500 * 2 ** (-.8 * k) * (1 - .3 * np.exp(-tb / .006))) * env(tb, .001, .02)
        place(out, b, o, -.45, .35)
    return out, 0.0


def bubble_out(rng):
    """The bubble shrinks away: a falling «fwip»."""
    t = tt(.12)
    return pan2(filt(osc(1100 * 2 ** (-1.2 * t / .12)) * env(t, .004, .03), "lowpass", 3000), -.3), 0.0


def boomerang(rng, dur):
    """The ق boomerangs back: a whir + a rising slide whistle, from the far left over the top to centre, closing in
    (louder, brighter); it ends on the slam."""
    t = tt(dur)
    x = t / dur
    turns = np.cumsum(9 + 9 * x) / SR
    am = (.5 + .5 * np.sin(2 * np.pi * turns)) ** 2
    wh = norm(tv_band(noise(rng, len(t)), 900 * 2 ** (1.6 * x), .55)) * (.3 + .7 * am)
    sw = slide_whistle(rng, 430 * 2 ** (2.0 * x ** 1.2) * (1 + .025 * np.sin(2 * np.pi * turns)))
    e = (.15 + .85 * x ** 1.5) * np.clip(t / .02, 0, 1) * np.clip((dur - t) / .01, 0, 1)
    pan = -.9 + 1.5 * np.sin(np.pi / 2 * x) - .6 * x ** 3
    return pan2((.55 * wh + .45 * sw) * e, pan), 0.0


def slam_rattle(rng, dur=.45):
    """The screen shake after the slam: the drawn world rattles on twos (light paper/table clatter, decaying)."""
    out = np.zeros((int((dur + .1) * SR), 2))
    for k in range(int(dur / F(2))):
        s, _ = ink_tick(rng, rng.uniform(600, 900), rng.uniform(-.4, .4))
        place(out, filt(s, "lowpass", 2500), k * F(2), 0, .5 * np.exp(-k / 2.5))
    return out, 0.0


def puff(rng, size=1.0, pan=0.0):
    """A flame blown out: «fff-p» — a quick soft air burst and a tiny low pop."""
    t = tt(.2)
    a = norm(filt(noise(rng, len(t)), "bandpass", [250, 1800])) * env(t, .003, .045)
    p = osc(160 * (1 + .6 * np.exp(-t / .006))) * env(t, .001, .02)
    return pan2(size * (.8 * a + .35 * p), pan), 0.0


def wave_swoosh(rng, dur):
    """The turquoise wave with its cream crest: a big wet rush (peaks as it crosses the cup), foam, washing L->R."""
    t = tt(dur)
    x = t / dur
    n = len(t)
    fc = 450 * 2 ** (2.3 * np.sin(np.pi * np.clip(x / .75, 0, 1)) ** .7)
    rush = norm(tv_band(noise(rng, n), fc, .9))
    foam = norm(filt(sfx.curd(rng, n, 1400, .0003, .0015), "bandpass", [900, 5000]))
    e = swell(t, dur, F(ARRIVE - WAVE[0]) / dur, a=.01, r=.18)
    out = pan2((.75 * rush + .35 * foam * (.4 + .6 * x)) * e, np.linspace(-.7, .7, n))
    for o in np.sort(rng.uniform(.2 * dur, .9 * dur, 9)):  # bubbles in the foam
        tb = tt(.05)
        place(out, osc(rng.uniform(500, 1100) * (1 + .7 * tb / .05)) * env(tb, .002, .012), o, rng.uniform(-.5, .6), .18)
    return out, 0.0


def wet_wipe(rng):
    """Chili becomes qashta on the cup: a short creamy «shhlp» wipe."""
    t = tt(.18)
    s = norm(tv_band(noise(rng, len(t)), 2600 * 2 ** (-2.0 * t / .18), .6)) * env(t, .004, .05)
    return pan2(filt(s, "lowpass", 5000), .35), 0.0


def honey(rng, dur):
    """Honey pours over the dome again: a slow, viscous, soft stream and a few low glops."""
    t = tt(dur)
    n = len(t)
    st = norm(filt(noise(rng, n), "bandpass", [180, 900])) * (.7 + .3 * smooth_rand(rng, n, 4))
    out = pan2(st * np.clip(t / .12, 0, 1) * np.clip((dur - t) / .2, 0, 1) * .5, .35)
    for o in np.arange(.08, dur - .1, .19):
        tb = tt(.08)
        place(out, osc(170 * (1 + .5 * tb / .08)) * env(tb, .006, .025), o + rng.uniform(-.02, .02), .35, .5)
    return out, 0.0


def paper_peel(rng, dur=.22):
    """The big word lifts off the paper: sticky fibres letting go + a soft upward swish."""
    t = tt(dur)
    crk = norm(filt(sfx.curd(rng, len(t), 900, .0003, .0012), "bandpass", [1200, 5500]))
    sw = swept(rng, dur, 900, 3000, .8)
    return pan2((.5 * crk + .5 * sw) * np.clip(t / .004, 0, 1) * np.exp(-t / .09), .1), 0.0


def scribble(rng, times):
    """A red marker scribbles «بحرف.» out: back-and-forth strokes on twos (felt tip catching the paper grain),
    the last slash the hardest. `times` in s, relative."""
    out = np.zeros((int((max(times) + .2) * SR), 2))
    for i, tc in enumerate(times):
        d = .062
        t = tt(d)
        up = i % 2 == 0
        fc = (1700 if up else 3300) * (1.7 if up else 1 / 1.7) ** (t / d)
        grain = np.clip(smooth_rand(rng, len(t), 380), 0, 1) ** 2
        s = norm(tv_band(noise(rng, len(t)), fc, .5)) * (.4 + .6 * grain)
        e = np.clip(t / .003, 0, 1) * np.clip((d - t) / .012, 0, 1) * (1.3 if i == len(times) - 1 else 1)
        place(out, s * e, tc, .25 - .12 * i)
    return filt(out, "lowpass", 7000), 0.0


def spring_creak(rng, dur=.13):
    """The spoon crouches (anticipation): a coiled «eeek» of compressed steel."""
    t = tt(dur)
    imp = np.zeros(len(t))
    tc = 0.0
    while tc < dur - .002:
        imp[int(tc * SR)] += rng.uniform(.6, 1)
        tc += 1 / (95 + 160 * tc / dur) * rng.uniform(.9, 1.1)
    s = norm(filt(body(imp, [(1850, .004, 1), (2900, .003, .6), (430, .02, .4)], 0.0), "lowpass", 5000))
    return pan2(s * np.clip(t / .01, 0, 1) * np.clip((dur - t) / .02, 0, 1), -.4), 0.0


def schlup(rng):
    """«schlup»: the spoon dives head-first into the thick qashta (a sinking creamy squelch, never a raspberry)."""
    t = tt(.4)
    src = sfx.curd(rng, len(t), 520)
    s = norm(tv_band(src, 950 * 2 ** (-1.5 * np.minimum(t / .12, 1)), .4)) * env(t, .004, .09)
    th = osc(170 * (1 + .4 * np.exp(-t / .015))) * env(t, .002, .05)
    return pan2(filt(s + .45 * th, "lowpass", 4000), .15), 0.0


def nom(rng):
    """Nom: a muffled creamy squish under the dome while the handle wiggles."""
    t = tt(.16)
    s = norm(tv_band(sfx.curd(rng, len(t), 600), 620 * 2 ** (-.6 * np.minimum(t / .08, 1)), .45)) * env(t, .004, .045)
    s = filt(s + .4 * osc(190 * (1 + .3 * np.exp(-t / .01))) * env(t, .002, .03), "lowpass", 1800)
    return pan2(s, .2), 0.0


def flip_whoosh(rng, dur=.22):
    """The somersault: a quick whoosh that rises and falls (doppler)."""
    t = tt(dur)
    s = norm(tv_band(noise(rng, len(t)), 700 * 2 ** (2.2 * np.sin(np.pi * t / dur)), .6)) * swell(t, dur, .45, a=.006, r=.03)
    return pan2(s, np.linspace(.1, -.4, len(t))), 0.0


def hop_tap(rng, pan=.3):
    """The title's ق lands its hop: a soft ink «tup»."""
    t = tt(.12)
    s = osc(260 * (1 + .5 * np.exp(-t / .006))) * env(t, .001, .025) + .4 * norm(filt(noise(rng, len(t)), "bandpass", [900, 3500])) * env(t, .0003, .003)
    return pan2(s, pan), 0.0


# =============================== music bus ===============================
MUSIC_EVENTS = []  # (label, t s, dry stereo signal) of musical hits: their onsets are measured on their own


class Band:
    """Music stems: orch (strings, brass, harp, timpani, mallets: a hall), perc (bendir, riq, cymbals: a room),
    spicy (the dabke groove that melts), bass. Times in FRAMES."""

    def __init__(self):
        self.st = {k: np.zeros((N, 2)) for k in ("orch", "perc", "spicy", "bass")}

    def put(self, stem, sig, f, pan=0.0, v=1.0, label=None, lead=0.0):
        sig = pan2(sig, pan) if sig.ndim == 1 else sig
        place(self.st[stem], sig, F(f) - lead, 0.0, v)
        if label:
            MUSIC_EVENTS.append((label, F(f) - lead, sig * v))


def rngm(f, kind):
    return np.random.default_rng(SEED + int(round(f * 100)) + sum(map(ord, kind)))


def key_transients():
    """Key SFX transients (frames): grid filler notes keep 40 ms away from them."""
    ks_ = [C["FLICK_SNAP"], STING, C["SPOON_TAKE"], *IGN, C["SPOON_GULP"], *C["CUP_FLAMES"], C["BUBBLE_POP"], *C["SWEAT_DRIPS"],
           SLAM, *C["DOT_LAND"], *C["FLAMES_OUT_PUFF"], C["SPOON_BOING"], *C["WORD_HOP"], *TH, STOP[1], C["SWAP_OUT"],
           STOP_END, BAR_B, C["SPOON_JUMP"], C["SPOON_DIVE"], *C["SPOON_NOM"], C["STRAND_SNAP"], C["SPOON_LAND"],
           *C["QAF_HOPS"], CARD, CARD + EC["cupLand"], *LOGO_DOTS, CTA, COMMENT_POP, *HOPS]
    return np.array(sorted(ks_), float)


KT = key_transients()


def clear(f, w=.04):
    return bool(np.all(np.abs(KT - f) * (1 / FPS) >= w))


def act1_music(b):
    # frame 0 = the hook: a pizzicato D3 under the shivering drops (playful suspense)
    b.put("orch", pizz(rngm(0, "pz"), "D3", .6), 0, .1, .8, "hook pizz D3 (f0)")
    # the strain's tension ticks ARE the sweet motif, D5-E5-F#5 (rising), on 4 / 6 / 8
    lo, hi = C["FINGER_STRAIN"]
    for k, (f, nt) in enumerate(zip(range(lo, hi, 2), ("D5", "E5", "F#5"))):
        b.put("orch", pizz(rngm(f, "pz"), nt, .3), f, .3, .38 + .08 * k, f"strain tick {nt} (sweet motif)")


def spicy_music(b):
    # 40: THE STING. Silence breaks on a D(b9) brass stab (hijaz colour), timpani, a dark cymbal; low strings tremolo
    r = rngm(STING, "sting")
    b.put("orch", brass(r, ["D3", "A3", "D4", "F#4", "Eb5"], .62, sfz=.08, hold=.3, rel=.25, bright=.8), STING, 0, 1.0,
          "STING brass D(b9) (f40)")
    b.put("orch", timpani(r, "D3", 1.6), STING, 0, .9, "STING timpani D3")
    b.put("perc", cymbal(r, 1.8, dark=1.4), STING, .2, .35)
    b.put("orch", strings(r, ["D2", "D3"], F(GROOVE0 - STING) + .1, atk=.01, rel=.08, trem=.75, bright=.9,
                          shape=lambda x: .9 * np.exp(-x * 5) + .45), STING, 0, .3)
    # 44 / 48 / 52: the letters ignite = the motif with ONE note changed: D - Eb - F# (hijaz)
    for k, (f, (lo_, hi_)) in enumerate(zip(IGN, [("D3", "D4"), ("Eb3", "Eb4"), ("F#3", "F#4")])):
        r = rngm(f, "ign")
        last = k == len(IGN) - 1
        dur = F(GROOVE0 - f) + .04 if last else F(IGN[k + 1] - f) + .02
        b.put("orch", brass(r, [lo_, hi_], dur, sfz=.06, hold=.42 if last else .3, rel=.03, bright=.85), f, 0, .62 + .07 * k,
              f"IGNITE brass {hi_} (spicy motif)")
        b.put("spicy", tabl(r, "D", 1.0), f, 0, .7)
    # 56 ->: the frantic hijaz dabke (4-frame 8ths), rendered past the melt so the tape has something to slow down
    end = MELT[1] + 6
    riff = ["D5", "Eb5", "F#5", "G5", "F#5", "Eb5", "D5", "C5", "D5", "Eb5", "D5", "C5", "Bb4", "A4"]
    pat = ["D", "T", None, "T", "D", "D", "T", None]
    bassl = ["D2", "D3", "D2", "Eb3", "D2", "D3", "C3", "D3"]
    for i, f in enumerate(range(GROOVE0, end, E8S)):
        r = rngm(f, "dabke")
        if pat[i % 8] and (clear(f) or pat[i % 8] == "D"):
            b.put("spicy", tabl(r, pat[i % 8], 1.0 if pat[i % 8] == "D" else .55), f, .05 if pat[i % 8] == "D" else -.25, .9,
                  f"dabke tabl {pat[i % 8]}" if f < MELT[0] else None)
        if i % 2 and clear(f):
            b.put("spicy", clap(r), f, .35, .45)
        if clear(f + E8S / 2, .03):  # 16th ghost «tk» (frantic)
            b.put("spicy", tabl(r, "T", .22), f + E8S / 2, -.3, .8)
        lb = filt(brass(r, [bassl[i % 8]], F(E8S) * .8, sfz=.05, hold=.5, rel=.02, bright=.55, scoop=.15, players=2), "highpass", 110, 2)
        b.put("spicy", lb, f, 0, .55)  # low brass ostinato: its fundamental is cut, a phone hears the line in the harmonics
        if i < len(riff):
            b.put("spicy", buzuq_trem(r, riff[i], F(E8S)), f, .3, .38)
    # 76: the «شطة؟؟ 🥵» bubble — the big hijaz stab with a rip-and-fall (it falls into the melt)
    f = C["BUBBLE_POP"]
    r = rngm(f, "bubble")
    b.put("spicy", brass(r, ["D3", "D4", "F#4", "A4", "Eb5"], F(MELT[0] - f) + .3, sfz=.12, hold=.55, rel=.06, bright=.9,
                         fall=5, fall_t=.28, scoop=.8), f, 0, .95, "BUBBLE brass rip + fall (f76)")
    b.put("perc", cymbal(r, 1.2), f, -.2, .22)


def melt_stem(x):
    """The music melts with the spoon: from MELT[0] the stem plays back like a tape stopping (1x -> 0.18x at MELT[1],
    ~2.5 octaves down), with the top closing; then it is gone."""
    i0, i1 = int(round(F(MELT[0]) * SR)), int(round(F(MELT[1]) * SR))
    u = np.linspace(0, 1, i1 - i0)
    rate = 1 - .82 * u ** 1.25
    pos = i0 + np.cumsum(rate) - rate[0]
    out = x.copy()
    for c in range(2):
        out[i0:i1, c] = np.interp(pos, np.arange(len(x)), x[:, c])
    out[i1:] = 0
    g = np.ones(i1 - i0)
    g[-int(.12 * SR):] = np.cos(np.linspace(0, np.pi / 2, int(.12 * SR))) ** 2
    out[i0:i1] *= g[:, None]
    lp = filt(filt(out, "lowpass", 1400), "highpass", 110, 2)  # the slowed tape drops ~2.5 octaves: keep it out of the sub
    w = np.clip((np.arange(N) - i0) / (i1 - i0), 0, 1) ** 1.2
    return out * (1 - w[:, None]) + lp * w[:, None]


def return_music(b):
    a, z = C["BOOMERANG_WHISTLE"]
    d = F(z - a)
    r = rngm(a, "ret")
    # 104 -> 118: the dominant builds: timpani roll on A, tremolo strings A7 swelling, a reversed cymbal into the slam
    b.put("orch", timp_roll(r, "A2", d, .1, 1.0), a, 0, .55)
    b.put("orch", strings(r, ["A2", "E3", "A3", "C#4", "G4"], d, atk=.05, rel=.006, trem=.8, bright=1.2,
                          shape=lambda x: .12 + .88 * x ** 1.8), a, 0, .42)
    b.put("perc", cym_swell(r, d), SLAM, 0, .4, lead=d)
    # 118 SLAM: an A7 brass hit (maximum pull back to D), timpani, crash; short, to leave room for «تشك-تشك»
    r = rngm(SLAM, "slam")
    b.put("orch", brass(r, ["A2", "E3", "G3", "C#4", "A4"], .4, sfz=.06, hold=.2, rel=.15, bright=.85), SLAM, 0, .8,
          "SLAM brass A7 (f118)")
    b.put("orch", timpani(r, "A2", 1.4), SLAM, 0, .65, "SLAM timpani A2")
    b.put("perc", cymbal(r, 1.6), SLAM, .15, .3)
    # the A7 hangs on, pianissimo, then leans into the wave
    b.put("orch", strings(r, ["A3", "C#4", "E4", "G4"], F(ARRIVE - SLAM - 4) + .12, atk=.12, rel=.1, bright=.8,
                          shape=lambda x: .25 + .75 * np.clip((x - .5) / .5, 0, 1) ** 1.5), SLAM + 4, 0, .2)


def sweet_music(b):
    # 134 -> 142: the wave = relief. Harp glissando up, a cymbal swell, ARRIVING on D major exactly at WAVE_OVER_CUP
    r = rngm(WAVE[0], "wave")
    gl = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6"]
    b.put("orch", harp_gliss(r, gl, F(ARRIVE - WAVE[0])), WAVE[0], 0, .55, "wave harp gliss up (f134)")
    b.put("perc", cym_swell(r, F(ARRIVE - WAVE[0])) * .6, ARRIVE, -.2, .35, lead=F(ARRIVE - WAVE[0]))
    r = rngm(ARRIVE, "arrive")
    b.put("orch", strings(r, ["D3", "A3", "D4", "F#4", "A4"], F(STOP[0] - ARRIVE) + .2, atk=.05, rel=.2, bright=1.1,
                          shape=lambda x: .3 + .7 * np.exp(-x * 4)), ARRIVE, 0, .3, "ARRIVE strings D major (f142)")
    for k, nt in enumerate(["D5", "F#5", "A5", "D6"]):
        b.put("orch", celesta(r, nt, 1.5), ARRIVE + .15 * k, -.3 + .2 * k, .32)
    b.put("bass", pbass(r, "D2", .9), ARRIVE, 0, .8, "ARRIVE bass D2")
    b.put("orch", harp(r, "D3", 1.6), ARRIVE, -.2, .4)
    # 152: the spoon's glint gets a celesta A6 (in the chord)
    b.put("orch", celesta(rngm(C["SPOON_GLINT"], "gl"), "A6", .8), C["SPOON_GLINT"], -.4, .12)
    # 158 / 162: the ق's drops hop for joy: two little glock blips
    for f, nt in zip(C["WORD_HOP"], ("A5", "D6")):
        b.put("orch", glock(nt, .6, .2), f, .45, .2, f"word hop glock {nt}")

    # ---- BAR A (148 -> 212): the sweet groove enters, light; stop-time under the scribble
    groove(b, BAR_A, BAR_B, chords=[(BAR_A, "D"), (BAR_A + 2 * Q, "D")], stop=(STOP[0], STOP_END))
    # the line is SUNG: «الفرق» D5 · «كلّو» E5 · «بحرف.» F#5 (bells + buzuq an octave down, on the ink thuds)
    for f, nt, lo in zip(TH, ("D5", "E5", "F#5"), ("D4", "E4", "F#4")):
        r = rngm(f, "line")
        b.put("orch", glock(nt, 1.2, .3) + .6 * celesta(r, nt, 1.2, .3), f, .1, .42, f"LINE bell {nt}")
        if f != TH[-1]:
            b.put("orch", buzuq(r, lo, .4), f, .25, .3)
    # «بحرف.» gets scribbled out: its F# is held on the buzuq and bent SOUR (F# -> F) under the pen
    r = rngm(TH[-1], "sour")
    bend = lambda t: 2 ** (-1.0 * np.clip((t - F(STOP[0] - TH[-1])) / .3, 0, 1) ** 1.4 / 12)
    b.put("orch", buzuq(r, "F#4", F(STOP_END - TH[-1]) - .1, bend=bend), TH[-1], .25, .42, "LINE buzuq F#4 (bent sour)")
    # «بالـ» A5 · «ق.» D6 — the top of the arpeggio, the same D as the sonic logo, on the downbeat with a tutti hit
    r = rngm(STOP_END, "bal")
    b.put("orch", glock("A5", 1.2, .3) + .6 * celesta(r, "A5", 1.2, .3), STOP_END, .1, .42, "LINE bell A5 («بالـ»)")
    b.put("orch", buzuq(r, "A4", .3), STOP_END, .25, .3)
    b.put("bass", pbass(r, "A2", .2), STOP_END, 0, .7)
    r = rngm(BAR_B, "qaf")
    b.put("orch", glock("D6", 2.0, .5) + .7 * celesta(r, "D6", 2.0) + .4 * glock("D7", 2.0, .3), BAR_B, 0, .5, "QAF bell D6 (f212)")
    b.put("orch", brass(r, ["D3", "A3", "D4", "F#4", "A4"], .55, sfz=.1, hold=.35, rel=.2, bright=.7, scoop=.2), BAR_B, 0, .6,
          "QAF brass D major")
    b.put("orch", timpani(r, "D3", 1.4), BAR_B, 0, .38)
    b.put("perc", cymbal(r, 1.6), BAR_B, .2, .26)

    # ---- BAR B (212 -> 276): the payoff, mickey-moused
    groove(b, BAR_B, BAR_C, chords=[(BAR_B, "D"), (BAR_B + Q, "G"), (BAR_B + 2 * Q, "A"), (C["SPOON_LAND"], "D")], full=True, g=.7)
    # 218: the jump — harp up with the lunge; 224: the ق hops (glock); 228: «schlup» (low harp + bass)
    j = C["SPOON_JUMP"]
    b.put("orch", harp_gliss(rngm(j, "jump"), ["A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6"], F(C["SPOON_DIVE"] - j - 2)),
          j, .2, .4, "jump harp gliss up (f218)")
    for f in C["QAF_HOPS"]:
        b.put("orch", glock("D6", .7, .25), f, .35, .25, f"qaf hop glock D6 (f{f})")
        for k, nt in enumerate(("A6", "F#6")):
            b.put("orch", glock(nt, .4, .12), f + 2 * (k + 1), .45, .08)
    r = rngm(C["SPOON_DIVE"], "dive")
    b.put("orch", harp(r, "D3", 1.0) + .6 * harp(r, "A2", 1.0), C["SPOON_DIVE"], 0, .38, "DIVE harp D3")
    # 230 / 234 / 238: three pizzicato «nom» notes, D4 F#4 A4
    for f, nt in zip(C["SPOON_NOM"], ("D4", "F#4", "A4")):
        b.put("orch", pizz(rngm(f, "nom"), nt, .35), f, .2, .42, f"nom pizz {nt}")
    # 240 -> 254: a violin harmonic stretches up with the strand ... 254: it snaps (pizzicato plink D6)
    a, z = C["STRAND_STRETCH"]
    b.put("orch", harmonic_gliss(rngm(a, "str"), hz("A5"), hz("E6"), F(z - a)), a, .2, .2)
    b.put("orch", pizz(rngm(z, "snap"), "D6", .4), z, .2, .45, "SNAP pizz D6 (f254)")
    # 256: flip — a quick harp flourish; 258: the spoon lands blissful: horn «mmm» F#4 -> D4
    b.put("orch", harp_gliss(rngm(C["SPOON_FLIP"], "flip"), ["D5", "F#5", "A5"], F(2)), C["SPOON_FLIP"], .2, .3)
    lf = C["SPOON_LAND"]
    b.put("orch", horn_line(rngm(lf, "mmm"), [(0, "F#4"), (F(8), "E4"), (F(12), "D4")], F(BAR_C - lf) + .25), lf, 0, .55,
          "LAND horn «mmm» F#4->E4->D4")
    b.put("orch", celesta(rngm(C["CUP_GLINT"], "cg"), "A6", .9), C["CUP_GLINT"], .4, .1)

    # ---- END CARD: landing chord at BAR_C, logo break, the CTA = downbeat of the last phrase, the question, button
    r = rngm(BAR_C, "card")
    b.put("orch", strings(r, ["D3", "A3", "D4", "F#4", "A4"], F(CTA - BAR_C) + .3, atk=.06, rel=.3, bright=.9,
                          shape=lambda x: .3 + .7 * np.exp(-x * 3)), BAR_C, 0, .16, "END landing strings D")
    b.put("orch", harp(r, "D3", 1.5) + .7 * harp(r, "A3", 1.5), BAR_C, -.2, .26)
    b.put("bass", pbass(r, "D2", .8), BAR_C, 0, .6, "END landing bass D2")
    b.put("perc", bendir(r, "D", .8), BAR_C, 0, .4)
    # pickup into the CTA (8ths), harp up
    b.put("bass", pbass(rngm(CTA - E8, "pu"), "A2", .25), CTA - E8, 0, .55)
    b.put("perc", bendir(rngm(CTA - E8, "pu"), "T", .6), CTA - E8, -.2, .45)
    b.put("orch", harp_gliss(rngm(CTA - E8, "hg"), ["A3", "D4", "F#4", "A4", "D5"], F(E8) - F(1)), CTA - E8, .2, .3)
    groove(b, CTA, COMMENT_POP, chords=[(CTA, "D"), (CTA + Q, "G")], full=True, cta=True)
    # the question: celesta D5-E5-F#5 (team qashta) ... buzuq D4-Eb4-F#4 (team shatta)
    r = rngm(QUESTION, "q")
    b.put("orch", strings(r, ["G3", "D4", "B4"], F(HOPS[0] - QUESTION) + .1, atk=.08, rel=.12, bright=.8), QUESTION, 0, .1)
    for k, nt in enumerate(("D5", "E5", "F#5")):
        b.put("orch", celesta(r, nt, .8) + .5 * glock(nt, .8, .2), QUESTION + 3 * k, .3, .22, f"QUESTION sweet {nt}")
    for k, nt in enumerate(("D4", "Eb4", "F#4")):
        b.put("orch", buzuq(r, nt, .5 if k == 2 else .2), QUESTION + 9 + 3 * k, -.3, .36, f"QUESTION spicy {nt}")
    # the button: the dot-hop echo clack 1 (kit) + a soft final D chord, faded to digital zero by the master
    r = rngm(HOPS[0], "fin")
    b.put("orch", strings(r, ["D3", "A3", "D4", "F#4"], F(TL["DURATION"] - HOPS[0]) + .1, atk=.03, rel=.05, bright=.8), HOPS[0], 0, .2,
          "FINAL D chord")
    b.put("orch", celesta(r, "D6", 1.0) + .6 * celesta(r, "A5", 1.0), HOPS[0], .2, .22)
    b.put("bass", pbass(r, "D2", .6), HOPS[0], 0, .6)


CHORD = {"D": (["D2", "D3"], ["D4", "F#4", "A4"], ["D3", "A3", "D4", "F#4"]),
         "G": (["G2", "G3"], ["D4", "G4", "B4"], ["G3", "B3", "D4", "G4"]),
         "A": (["A2", "A3"], ["E4", "A4", "C#5"], ["A3", "C#4", "E4", "G4"])}


def groove(b, f0, f1, chords, full=False, stop=None, cta=False, g=1.0):
    """The sweet D-major groove from f0 to f1 (frames): pizz bass on the beats (+ the octave on «and»s when full),
    bendir D on 1 & 3 and T on 2 & 4, riq jingles on 8ths, buzuq muted strums on the off-beats, a soft string pad.
    Filler drops out near key SFX (clear()); `stop` = a stop-time window (only the thing that's held rings)."""
    def chord_at(f):
        return [c for fc, c in chords if fc <= f][-1]

    for f in np.arange(f0, f1, E8):
        f = float(f)
        if stop and stop[0] <= f < stop[1]:
            continue
        r = rngm(f, "groove")
        beat = int(round((f - f0) / Q * 2)) % 8  # 8th index in the 4/4 bar
        ch = CHORD[chord_at(f)]
        if beat % 2 == 0:  # on the beat: bass + bendir
            nt = ch[0][0] if beat in (0, 4) else (ch[0][1] if full else ch[0][0])
            b.put("bass", pbass(r, nt, .42), f, 0, g * (.75 if beat in (0, 4) else .6))
            if beat in (0, 4) or clear(f):
                b.put("perc", bendir(r, "D" if beat in (0, 4) else "T", .85 if beat in (0, 4) else .6), f, 0 if beat in (0, 4) else -.2, .7 * g)
        else:
            if full and clear(f):
                b.put("bass", pbass(r, ch[0][1], .2), f, 0, .35 * g)
            if clear(f):
                b.put("orch", strum(r, ch[1]), f, .35, .32 * g)
                b.put("perc", bendir(r, "T", .25), f, -.25, .6 * g)
        if clear(f, .03):
            b.put("perc", sfx.jingles(r, [0.0, F(E8) / 2], .5) * (1 if beat % 2 else .6), f, .4, .4 * g)
    # the pad (chord segments)
    segs = [(fc, c) for fc, c in chords if fc < f1] + [(f1, None)]
    for (fa, c), (fb, _) in zip(segs, segs[1:]):
        if stop and fa < stop[0] < fb:
            fb = stop[0]
        r = rngm(fa, "pad")
        b.put("orch", strings(r, CHORD[c][2], F(fb - fa) + .15, atk=.12, rel=.15, bright=.85, voices=3), fa, 0, .09 if not cta else .08)


# =============================== cue placement (SFX) ===============================
CUE_LOG = []  # (cue label, cue time s, kind, role, index into mx.cues)


def build(vo):
    mx = sfx.Mixer(DUR)

    def cue(label, f, fn, gain=1.0, duck=0.0, role="key", **p):
        t = F(f)
        sig, lead = fn(sfx.cue_rng(t, fn.__name__), **p)
        mx.sfx(t, sig, lead, gain, duck, fn.__name__)
        CUE_LOG.append((label, t, fn.__name__, role, len(mx.cues) - 1))

    def cue_sig(label, f, sig, gain=1.0, duck=0.0, role="key", kind="sig", lead=0.0):
        mx.sfx(F(f), sig, lead, gain, duck, kind)
        CUE_LOG.append((label, F(f), kind, role, len(mx.cues) - 1))

    # ---- ACT 1
    a, z = C["ROOM_TONE"]
    cue("ROOM_TONE", a, room_tone, .03, role="span", dur=F(SIL[0] - a))
    a, z = C["DROPS_SHIVER"]
    for f in range(a, z, 2):
        cue(f"DROPS_SHIVER f{f}", f, drop_jitter, .045, role="soft")
    a, z = C["FINGER_STRAIN"]
    cue("FINGER_STRAIN", a, knuckle_creak, .1, role="span", dur=F(z - a))
    cue("FLICK_SNAP", C["FLICK_SNAP"], flick_snap, .95, 6)
    cue("SPOON_FLINCH", C["SPOON_FLINCH"], steel_tink, .2, role="soft", f0=2900, squeak=.6, pan=-.45)
    a, z = C["QAF_SPIN_AWAY"]
    cue("QAF_SPIN_AWAY", a, spin_away, .32, role="span", dur=F(z - a))
    cue("HAND_OUT_SWISH", C["HAND_OUT_SWISH"], sleeve, .14, role="soft")
    cue("SHIN_HEAL_TICK", C["SHIN_HEAL_TICK"], ink_tick, .08, role="soft")
    # (SPOON_BLINK is added after the master, inside the true silence — see deliver())

    # ---- ACT 2
    cue("BLOOM_WHOOMP", STING, bloom_whoomp, .8, 3)
    cue("SPOON_TAKE", C["SPOON_TAKE"], spoon_take, .65, 3)
    for k, f in enumerate(IGN):
        cue(f"IGNITE {k + 1}", f, ignite, .95, 3, pan=(.25, 0, -.25)[k % 3])
    a, z = C["FIRE_LOOP"]
    sig, _ = sfx.fire_loop(sfx.cue_rng(F(a), "fire_loop"), F(z - a) + .12)
    cue_sig("FIRE_LOOP", a, filt(sig, "lowpass", 7000), .22, role="span", kind="fire_loop")
    a, z = C["CUP_FILL_GLUG"]
    cue("CUP_FILL_GLUG", a, glug, .6, role="span", dur=F(z - a))
    cue("SPOON_GULP", C["SPOON_GULP"], gulp, .85, 7)
    cue("CAM_PUSH_SPOON", C["CAM_PUSH_SPOON"], cam_air, .12, role="soft", dur=F(18))
    for k, f in enumerate(C["CUP_FLAMES"]):
        cue(f"CUP_FLAMES {k + 1}", f, ignite, .55, 2, size=.7, pan=(.2, .35, .5)[k % 3])
    a, z = C["SPOON_PANT"]
    cue("SPOON_PANT", a, pant, .95, 5, role="span", times=[F(f - a) for f in range(a, z + 1, 2)])
    s, _ = sfx.sizzle(sfx.cue_rng(F(a), "spoon_sizzle"), F(z - a) + .1)
    cue_sig("SPOON_PANT sizzle", a, filt(s, "lowpass", 7000), .05, role="soft", kind="sizzle")
    for f in C["SWEAT_DRIPS"]:
        cue(f"SWEAT_DRIPS f{f}", f, drip, .35, role="soft")
    cue("BUBBLE_POP", C["BUBBLE_POP"], bubble_pop, .75, 4)
    a, z = C["MELT_DROOP"]
    cue("MELT_DROOP", a, melt_droop, .9, role="span", dur=F(z - a))
    s, _ = sfx.whip(sfx.cue_rng(F(C["CAM_WHIP_BACK"]), "whip"), F(T["camBack"][1] - T["camBack"][0]))
    cue_sig("CAM_WHIP_BACK", C["CAM_WHIP_BACK"], s, .35, role="span", kind="whip")
    cue("BUBBLE_OUT", C["BUBBLE_OUT"], bubble_out, .3, role="soft")

    # ---- ACT 3
    a, z = C["BOOMERANG_WHISTLE"]
    cue("BOOMERANG_WHISTLE", a, boomerang, .5, role="span", dur=F(z - a))
    s, ld = sfx.ink_thud(sfx.cue_rng(F(SLAM), "ink_thud"), weight=1.3, big=True)
    cue_sig("QAF_SLAM", SLAM, filt(s, "highpass", 55, 2), .72, 8, kind="ink_thud", lead=ld)  # its 46 Hz sub only eats headroom
    cue("QAF_SLAM rattle", SLAM + 2, slam_rattle, .3, role="soft")
    s, _ = sfx.bloop(sfx.cue_rng(F(C["DROPS_FLUNG"]), "bloop"), 300, 1.9, .09)
    cue_sig("DROPS_FLUNG", C["DROPS_FLUNG"], s, .4, role="soft", kind="bloop")
    for k, f in enumerate(C["FLAMES_OUT_PUFF"]):
        cue(f"FLAMES_OUT_PUFF {k + 1}", f, puff, .7, role="soft", pan=(-.2, 0, .2)[k % 3])
    for k, f in enumerate(C["DOT_LAND"]):
        cue(f"DOT_LAND {k + 1} splat", f, sfx.splat, .5, 3, note=("D5", "A5")[k % 2], pan=(.3, .45)[k % 2])
    sig, _ = sfx.logo_echo(None, gap=F(C["DOT_LAND"][1] - C["DOT_LAND"][0]))
    cue_sig("DOT_LAND «تشك-تشك» echo", C["DOT_LAND"][0], sig, .5, 4, kind="logo_echo")
    a, z = C["WAVE_SWOOSH"]
    cue("WAVE_SWOOSH", a, wave_swoosh, .55, 2, role="span", dur=F(z - a))
    cue("WAVE_OVER_CUP", C["WAVE_OVER_CUP"], wet_wipe, .6, role="soft")
    for k in range(3):
        cue(f"CUP_FLAMES_OUT {k + 1}", C["CUP_FLAMES_OUT"] + 2 * k, puff, .45, role="soft", size=.6, pan=.3 + .1 * k)
    cue("SPOON_BOING", C["SPOON_BOING"], boing, .45, 3, f0=150, up=1.0, dur=.5)
    s, _ = sfx.sparkle(sfx.cue_rng(F(C["SPOON_GLINT"]), "sparkle"), "A6", -.4)
    cue_sig("SPOON_GLINT", C["SPOON_GLINT"], s, .1, role="soft", kind="sparkle")
    a, z = C["HONEY_POUR"]
    cue("HONEY_POUR", a, honey, .2, role="span", dur=F(z - a))
    for f in C["WORD_HOP"]:
        s, _ = sfx.pop(sfx.cue_rng(F(f), "pop"), 900)
        cue_sig(f"WORD_HOP f{f}", f, s, .14, role="soft", kind="pop")

    # ---- ACT 4
    cue("WORD_LIFT", C["WORD_LIFT"], paper_peel, .5, role="soft")
    for k, f in enumerate(TH):
        cue(f"TITLE_THUD {k + 1}", f, sfx.ink_thud, .62, 5, weight=.85, pitch=1.0 + .06 * k)
    a, z = C["STRIKE_SCRATCH"]
    cue("STRIKE_SCRATCH", a, scribble, .55, 3, role="span", times=[F(f - a) for f in range(a, z + 1, 2)])
    cue("SWAP_OUT", C["SWAP_OUT"], sfx.paper_flip, .35, role="soft")
    cue("TITLE3_THUD", C["TITLE3_THUD"], sfx.ink_thud, .62, 5, weight=.85, pitch=1.1)
    s, ld = sfx.ink_thud(sfx.cue_rng(F(BAR_B), "ink_thud"), weight=1.15, big=True)
    cue_sig("QAF_THUD", BAR_B, filt(s, "highpass", 55, 2), .68, 6, kind="ink_thud", lead=ld)
    s, _ = sfx.sparkle(sfx.cue_rng(F(BAR_B + 3), "sparkle"), "D7", .1)
    cue_sig("QAF_THUD sparkle", BAR_B + 3, s, .07, role="soft", kind="sparkle")
    cue("SPOON_CROUCH", C["SPOON_CROUCH"], spring_creak, .5, role="soft")
    cue("SPOON_JUMP", C["SPOON_JUMP"], boing, .35, 2, f0=210, up=1.2, dur=.35, pan=-.3)
    s, _ = sfx.swish(sfx.cue_rng(F(C["SPOON_JUMP"]), "swish"), F(C["SPOON_DIVE"] - C["SPOON_JUMP"] - 2), 600, 3000, .6, (-.4, .2))
    cue_sig("SPOON_JUMP lunge whoosh", C["SPOON_JUMP"], s, .3, role="span", kind="swish")
    for f in C["QAF_HOPS"]:
        cue(f"QAF_HOPS f{f}", f, hop_tap, .3, role="soft")
    cue("SPOON_DIVE «schlup»", C["SPOON_DIVE"], schlup, .95, 6)
    for f in C["SPOON_NOM"]:
        cue(f"SPOON_NOM f{f}", f, nom, .85, 4, role="soft")
    a, z = C["STRAND_STRETCH"]
    s, _ = sfx.suction(sfx.cue_rng(F(a), "suction"))
    cue_sig("STRAND_STRETCH suction", a, s, .4, role="soft", kind="suction")
    s, _ = sfx.stretch(sfx.cue_rng(F(a), "stretch"), F(z - a))
    cue_sig("STRAND_STRETCH", a, s, .55, role="span", kind="stretch")
    cue("STRAND_SNAP", C["STRAND_SNAP"], sfx.snap, .75, 4)
    cue("SPOON_FLIP", C["SPOON_FLIP"], flip_whoosh, .45, role="span")
    cue("SPOON_LAND", C["SPOON_LAND"], steel_tink, .6, 3, f0=2100, pan=-.35)
    s, _ = sfx.glint(sfx.cue_rng(F(C["CUP_GLINT"]), "glint"), .35)
    cue_sig("CUP_GLINT", C["CUP_GLINT"], s, .12, role="soft", kind="glint")

    # ---- the spoon comes along onto the end card: a light hop whoosh (right → centre) and a small, soft steel tink on
    #      its landing (well under the kit's cup plop at 284 and clear of the sonic logo at 290)
    a, z = C["EC_SPOON_HOP"]
    s, _ = sfx.swish(sfx.cue_rng(F(a), "swish"), F(z - a), 700, 2600, .5, (.55, .1))
    cue_sig("EC_SPOON_HOP", a, s, .5, role="span", kind="swish")
    cue("EC_SPOON_LAND", C["EC_SPOON_LAND"], steel_tink, .3, 2, f0=2350, pan=.15)

    # ---- END CARD: the kit package (sheet, thup, cup, SONIC LOGO on the logo dots, CTA, pop, glints, dot-hop echoes)
    k0 = len(mx.cues)
    used = sfx.endcard_sfx(mx, F(CARD), EC)
    for idx in range(k0, len(mx.cues)):
        t, kind, _, _ = mx.cues[idx]
        CUE_LOG.append((f"END_CARD {kind}", t, kind, "key", idx))

    # ---- optional human VO
    for name, f, sig in vo:
        mx.sfx(F(f), sig, 0, 1.0, 4, f"vo_{name}")
        CUE_LOG.append((f"VO {name}", F(f), f"vo_{name}", "key", len(mx.cues) - 1))
    return mx, used


def load_vo():
    out = []
    for name, f in (("bubble", C["BUBBLE_POP"]), ("line", TH[0]), ("comment", COMMENT_POP)):
        p = VO_DIR / f"{name}.wav"
        if p.exists():
            x, sr = sf.read(p, always_2d=True)
            x = x.mean(1)
            if sr != SR:
                x = resample_poly(x, SR, sr)
            x = filt(peq(x, 3000, 2, .8), "highpass", 90, 2)
            out.append((name, f, .3 * x / (np.abs(x).max() + 1e-9)))
    return out


# =============================== mastering with the TRUE SILENCE enforced after the master ===============================
def silence_mask():
    g = np.ones(N)
    a, b = int(round(F(SIL[0]) * SR)), int(round(F(SIL[1]) * SR))
    f = int(.003 * SR)
    g[a - f:a] = np.linspace(1, 0, f)
    g[a:b] = 0
    return g


def blink_signal():
    s, _ = blink_click(sfx.cue_rng(F(BLINK), "blink_click"))
    s = s * 10 ** (BLINK_PEAK_DB / 20) / np.abs(s).max()
    x = np.zeros((N, 2))
    place(x, s, F(BLINK), 0, 1.0, fade=.004)
    return x


def deliver(x, log):
    """sfx.deliver(), but the comic dead stop is re-zeroed AFTER the master's filters + limiter (their IIR ringing
    would otherwise leave dust in it), and the blink is the only thing written into it (at BLINK_PEAK_DB)."""
    mask = silence_mask()
    blink = blink_signal()
    ceil = -1.6
    for _ in range(5):
        out, g = sfx.master(x * mask[:, None], DUR, ceil, .38)
        out = out * mask[:, None] + blink
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
    gfull = 20 * np.log10(np.maximum(g, 1e-9) / g[int(.01 * SR):int((DUR - .4) * SR)].max())
    hot = int(.01 * SR) + np.flatnonzero(gfull[int(.01 * SR):int((DUR - .4) * SR)] < -2.5)
    if len(hot):
        runs = np.split(hot, np.flatnonzero(np.diff(hot) > SR // 50) + 1)
        log("  limiting > 2.5 dB at: " + ", ".join(f"f{r[0] / SR * FPS:.0f}-f{r[-1] / SR * FPS:.0f} (max {-gfull[r].min():.1f} dB)" for r in runs))
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


SWELLS = {"room_tone", "cam_air", "wave_swoosh", "paper_swish", "swish", "whip", "honey", "fire_loop", "sizzle", "stretch",
          "flip_whoosh", "boomerang", "glug", "melt_droop", "spin_away", "knuckle_creak", "sleeve"}


def verify(out, mu, sx, g, mx, dec, log):
    import librosa
    mono = out.mean(1)
    lib = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=SR, hop_length=128, units="time", backtrack=False)
    ph_mu = phone(mu)
    rows = []
    log("\nCUE vs ONSET (each cue measured on its own dry signal x master gain; 'mix' = nearest librosa onset of the full "
        "mix within 50 ms; 's' = a swell/span, its onset is where it first rises above -30 dB of its peak)")
    log(f"  {'cue':<34} {'frame':>6} {'cue s':>7} {'onset s':>8} {'err ms':>7} | {'mix onset':>9} {'err':>5} | over music dB full / phone")
    for label, t, kind, role, idx in CUE_LOG:
        _, _, i0, sig = mx.cues[idx]
        x = np.zeros((N, 2))
        a0 = max(0, i0)
        n = min(len(sig) - (a0 - i0), N - a0)
        if n <= 0:
            continue
        x[a0:a0 + n] = sig[a0 - i0:a0 - i0 + n] * g[a0:a0 + n, None]
        if not np.abs(x).max() > 0:
            log(f"  {label:<34} {t * FPS:6.1f} {t:7.3f}   (silenced)")
            continue
        sw = kind in SWELLS or role == "span"
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
        log(f"  {label:<34} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+7.0f}{'s' if sw else ' '}| {ms} | {rs}")
        rows.append(dict(cue=label, frame=round(t * FPS, 2), t=round(t, 4), kind=kind, role=role, onset=round(on, 4),
                         err_ms=round(1000 * (on - t), 1), swell=sw, mix_onset=None if mo != mo else round(float(mo), 4),
                         over_music_db=None if mdb < -90 else round(rel, 1), over_music_phone_db=None if mdb < -90 else round(relp, 1)))
        extra = []
        if kind == "sonic_logo":
            extra.append(("  SONIC LOGO clack 2 (logo dot 2)", LOGO_DOTS[1]))
        if kind == "logo_echo":
            extra.append(("  echo clack 2", t * FPS + EC["logoDots"][1] - EC["logoDots"][0] if "END" in label
                          else C["DOT_LAND"][1]))
        for lab2, f2 in extra:
            on2 = onset_near(x, F(f2), -.03, .05)
            log(f"  {lab2:<34} {f2:6.1f} {F(f2):7.3f} {on2:8.3f} {1000 * (on2 - F(f2)):+7.0f}")
            rows.append(dict(cue=lab2.strip(), frame=round(f2, 2), t=round(F(f2), 4), onset=round(on2, 4), err_ms=round(1000 * (on2 - F(f2)), 1)))
    log("\nMUSIC HITS vs ONSET (each hit's own dry signal; 'mix' = nearest librosa onset of the full mix within 50 ms)")
    errs, mrows = [], []
    for label, t, sig in sorted(MUSIC_EVENTS, key=lambda e: e[1]):
        e = uniform_filter1d(np.abs(sig).max(1), int(.001 * SR))
        on = max(0, int(round(t * SR))) / SR + np.argmax(e > e.max() * 10 ** (-15 / 20)) / SR
        errs.append(1000 * (on - t))
        near = lib[np.abs(lib - on) < .05]
        mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        ms = f"{mo:9.3f} {1000 * (mo - on):+5.0f}" if mo == mo else f"{'—':>9} {'':>5}"
        log(f"  {label[:46]:<46} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+6.0f} | {ms}")
        mrows.append(dict(hit=label, frame=round(t * FPS, 2), t=round(t, 4), onset=round(on, 4), err_ms=round(1000 * (on - t), 1),
                          mix_onset=None if mo != mo else round(float(mo), 4)))
    log(f"  music hits: {sum(abs(e) <= 12 for e in errs)}/{len(errs)} start within 12 ms of their frame (median {np.median(errs):+.1f} ms)")
    # the silence
    i0, i1 = int(round(F(SIL[0]) * SR)), int(round(F(SIL[1]) * SR))
    ib0 = int(round(F(BLINK) * SR))
    for name, x in (("WAV (24-bit)", sf.read(WAV)[0]), ("MP3 decoded", dec)):
        seg = x[i0:i1]
        nz = np.flatnonzero(np.abs(seg).max(1) > 0)
        pre, post = x[i0:ib0], x[ib0 + int(.035 * SR):i1]
        log(f"  {name}: {len(x)} samples = {len(x) / SR:.4f} s | SILENCE f{SIL[0]}-f{SIL[1]} ({F(SIL[0]):.3f}-{F(SIL[1]):.3f} s): "
            f"peak {20 * np.log10(np.abs(seg).max() + 1e-12):.1f} dBFS (= the blink), non-zero samples {len(nz)}/{len(seg)}"
            + (f" ({F(SIL[0]) + nz[0] / SR:.4f}..{F(SIL[0]) + nz[-1] / SR:.4f} s)" if len(nz) else "")
            + f" | before the blink peak {20 * np.log10(np.abs(pre).max() + 1e-12):.1f} dBFS, after it "
            f"{20 * np.log10(np.abs(post).max() + 1e-12):.1f} dBFS | last sample {20 * np.log10(np.abs(x[-1]).max() + 1e-12):.1f} dBFS"
            f" | samples >= .999: {int((np.abs(x) >= .999).sum())}")
    ws = sfx.silence_ranges(sf.read(WAV)[0], -90, 60)
    log("  true-silence ranges in the WAV (< -90 dBFS, >= 60 ms): " + ", ".join(f"{a:.3f}-{b:.3f} s (f{a * FPS:.1f}-f{b * FPS:.1f})" for a, b in ws))
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
    cs = [(0, SIL[0], "act 1"), (SIL[1], C["BOOMERANG_WHISTLE"][0], "spicy"), (C["BOOMERANG_WHISTLE"][0], WAVE[0], "return"),
          (WAVE[0], BAR_B, "relief+line"), (BAR_B, CARD, "payoff"), (CARD, TL["DURATION"], "end card")]
    seg = lambda x, a, b: x[int(F(a) * SR):int(F(b) * SR)]
    ld = lambda x: -.691 + 10 * np.log10((sfx.kweight(x) ** 2).mean(0).sum() + 1e-20)
    log("  section loudness (K-weighted RMS, LUFS-ish) full / phone: " + " | ".join(
        f"{n} f{a}-{b} {ld(seg(out, a, b)):.1f} / {ld(seg(P, a, b)):.1f}" for a, b, n in cs))
    log("  music vs sfx per section (dB re mix, full / phone): " + " | ".join(
        f"{n} mus {ld(seg(mu, a, b)) - ld(seg(out, a, b)):+.1f}/{ld(seg(phone(mu), a, b)) - ld(seg(P, a, b)):+.1f} "
        f"sfx {ld(seg(sx, a, b)) - ld(seg(out, a, b)):+.1f}/{ld(seg(phone(sx), a, b)) - ld(seg(P, a, b)):+.1f}" for a, b, n in cs))
    return rows, mrows, P


# =============================== pictures of the sound (PIL) ===============================
def _font(size):
    from PIL import ImageFont
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


MARKS = [(SIL[0], "SILENCE"), (STING, "sting"), (MELT[0], "melt"), (SLAM, "slam"), (ARRIVE, "D major"), (BAR_B, "«ق.» D6"),
         (CARD, "end card"), (LOGO_DOTS[0], "logo"), (CTA, "CTA")]


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
    for f_, lab in MARKS:
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

    log(f"timeline (spec.ts, kit cues.ts): {TL['DURATION']} f = {DUR:.4f} s = {N} samples | silence f{SIL[0]}-f{SIL[1]} (blink f{BLINK}) | "
        f"sting {STING} ignite {IGN} groove from {GROOVE0} melt {MELT} | slam {SLAM} wave {WAVE} arrive {ARRIVE} | line {TH} "
        f"stop {STOP[0]}-{STOP_END} «ق.» {BAR_B} | sweet bars {BAR_A}/{BAR_B}/{BAR_C} (quarter = {Q} f = {60 / F(Q):.1f} BPM) | "
        f"end card {CARD} logo dots {LOGO_DOTS} cta {CTA} comment pop {COMMENT_POP} question {QUESTION} hops {HOPS}")
    vo = load_vo()
    if vo:
        log(f"VO lines found: {[n for n, _, _ in vo]}")
    b = Band()
    act1_music(b)
    spicy_music(b)
    return_music(b)
    sweet_music(b)
    st = b.st
    st["spicy"] = melt_stem(st["spicy"])
    orch = st["orch"] + reverb(st["orch"], room_size=.62, damping=.45, wet_level=.2, dry_level=0, width=.9)
    perc = st["perc"] + reverb(st["perc"], room_size=.35, damping=.5, wet_level=.1, dry_level=0, width=.8)
    spicy = st["spicy"] + reverb(st["spicy"], room_size=.3, damping=.55, wet_level=.08, dry_level=0, width=.7)
    bass = sfx.lowshelf(st["bass"], 90, -4)
    music = filt(sfx.lowshelf(orch + perc + .63 * spicy + bass, 120, -3), "highpass", 50, 2)
    for k, v in (("orch", orch), ("perc", perc), ("spicy", spicy), ("bass", bass)):
        sf.write(OUT / f"stems/raw-{k}.wav", v / max(1.0, np.abs(v).max()), SR, subtype="FLOAT")
    mx, used = build(vo)
    mx.music(music)
    mx.silence(F(SIL[0]), F(SIL[1]))
    x = mx.mix(sfx_room=.07)
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
    log("end-card package cue times (s): " + json.dumps({k: (round(v, 3) if not isinstance(v, list) else [round(u, 3) for u in v]) for k, v in used.items()}))
    rows, mrows, P = verify(out, mu, sx, g, mx, dec, log)
    sf.write(OUT / "phone-sim.wav", P / max(1.0, np.abs(P).max()), SR, subtype="PCM_24")
    (OUT / "cues.json").write_text(json.dumps(dict(measure=meas, cues=rows, music=mrows), indent=1, ensure_ascii=False))
    (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")
    plot(out, P, OUT / "overview.png", title="QafDifference soundtrack - 0-12.5 s (cue lanes = spec frames)")
    plot(out, P, OUT / "zoom-act12.png", 0, F(C["BOOMERANG_WHISTLE"][0]) + .2, "zoom: hook → flick → TRUE SILENCE → sting → hijaz dabke → melt")
    plot(out, P, OUT / "zoom-act34.png", F(C["BOOMERANG_WHISTLE"][0]) - .2, F(CARD) + .2, "zoom: boomerang → slam → «تشك-تشك» → wave (D major) → the line → payoff")
    plot(out, P, OUT / "zoom-end.png", F(CARD) - .3, DUR, "zoom: end card → sonic logo on the dots → CTA → the question → button")
    if PREVIEW_VIDEO.exists():
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(PREVIEW_VIDEO), "-i", str(WAV), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT / "preview-half.mp4")], check=True)
        pv = decode(OUT / "preview-half.mp4")
        a, b_ = int(2.0 * SR), int(4.0 * SR)
        xc = np.correlate(pv[a - 4096:b_ + 4096, 0], out[a:b_, 0], "valid")
        log(f"preview: {(OUT / 'preview-half.mp4').relative_to(REPO)} (AAC audio vs master: {int(np.argmax(xc)) - 4096:+d} samples)")
        (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
