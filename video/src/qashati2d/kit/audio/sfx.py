#!/usr/bin/env python3
"""«Qashati 2D» shared audio kit — import it from each spot's make_sound.py:

    import sys; from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "kit/audio"))
    import sfx                                    # (or: from sfx import *)

What is in here
  • THE SONIC LOGO «تشك-تشك»: clink(), sonic_logo(), logo_echo() — ported VERBATIM from spot #2
    (video/src/qashati2/audio/make_sound.py) with the same fixed seed (BRAND_SEED + 5000), so every spot plays the
    exact same two brass clacks of the Damascene liquorice seller + the D6/A6 bloom. `demo_sfx.py --check` proves the
    port is sample-identical to spot #2.
  • the DSP kit (tt, env, osc, filt, peq, lowshelf, reverb, pan2, place, tv_band, swept, swell, ks, mallet, …) — also
    verbatim, so voices behave exactly as in spot #2.
  • reusable foley for the 2D series: pops, paper swishes/flips/thups, ink thuds (stamp), spoon clinks (ceramic plate,
    plastic cup), plinks, splats, scoops/suction/stretch/snap (creamy, never a raspberry), whooshes, crickets, doorbell,
    flame whoosh, sizzle, glints/sparkles.
  • endcard_cues(): the kit end card's cue table (relative frames) evaluated from kit/endcard/cues.ts, and
    endcard_sfx(mixer, t0): the standard end-card sound package (sheet swish → thup → cup plop → SONIC LOGO on the
    logo's two dots → CTA stamp → comment pop → glints → small «تشك-تشك» echoes on the dot hops).
  • mixing + mastering: Mixer (cue placement with per-cue ducking), master() (−14 LUFS integrated, true peak ≤ −1 dBTP
    on the MP3 after encode, EXACT length, cos² fade to digital zero), deliver() (24-bit WAV master + MP3 with the
    encoder's level shift corrected), ebur128() (ffmpeg's meter), ts_eval() (read a spot's spec.ts timeline).

Conventions: 48 kHz stereo float64; a voice is f(rng, **params) -> (audio, lead_seconds) like spot #2, where `lead` is
how long before its cue the sound starts (e.g. an air push before an impact). Seed every cue on its own
(cue_rng(t, kind)) so moving one cue never changes another. Mix for phone speakers: keep weight in 150–500 Hz
harmonics, nothing essential below 120 Hz, tame > 7 kHz.
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Pedalboard, Reverb
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, istft, lfilter, resample_poly, sosfilt, stft

SR = 48000
BRAND_SEED = 1402  # spot #2's SEED: the sonic logo uses default_rng(BRAND_SEED + 5000) — never change it
SEED = BRAND_SEED  # (the ported code refers to SEED)
TARGET_LUFS, TP_MAX = -14.0, -1.0
FPS = 30

KIT = Path(__file__).resolve().parents[1]          # video/src/qashati2d/kit
VIDEO = Path(__file__).resolve().parents[4]        # video/
REPO = VIDEO.parent


def fr(f, fps=FPS):  # frame -> seconds
    return f / fps


def cue_rng(t, kind, base=BRAND_SEED):
    """Per-cue seeded generator (same recipe as spot #2): moving one cue changes only that cue."""
    return np.random.default_rng(base + int(round(t * 1000)) + sum(map(ord, kind)))


# =====================================================================================================================
# PORTED VERBATIM from video/src/qashati2/audio/make_sound.py (spot #2) — do not edit; demo_sfx.py --check compares.
# =====================================================================================================================
def tt(d): return np.arange(int(round(d * SR))) / SR


def env(t, a, d): return np.minimum(t / a, 1) * np.exp(-np.maximum(t - a, 0) / d)


def osc(f): return np.sin(2 * np.pi * np.cumsum(f) / SR)


def norm(x): return x / (np.abs(x).max() + 1e-12)


def filt(x, kind, fc, order=2): return sosfilt(butter(order, fc, kind, fs=SR, output="sos"), x, axis=0)


def midi(n):  # "F#5" -> 78, "Bb4" -> 70
    return "C D EF G A B".index(n[0]) + n[1:].count("#") - n[1:].count("b") + 12 * (int(n[-1]) + 1)


def mhz(m): return 440 * 2 ** ((m - 69) / 12)


def hz(n): return mhz(midi(n))


def noise(rng, n): return rng.standard_normal(n)


def reverb(x, dry_level=1.0, wet_level=.1, **kw):
    """Freeverb. pedalboard/JUCE scales dry by 2 (and wet by ~3) internally; halve both so dry_level is linear."""
    rv = Reverb(dry_level=dry_level / 2, wet_level=wet_level / 2, **kw)
    return Pedalboard([rv])(np.ascontiguousarray(x.T, np.float32), SR).T.astype(np.float64)


def pan2(sig, pan=0.0):  # constant-power pan; pan may be an array (moving source)
    th = (np.clip(np.broadcast_to(pan, sig.shape), -1, 1) + 1) * np.pi / 4
    return np.stack([sig * np.cos(th), sig * np.sin(th)], 1)


def place(buf, sig, t, pan=0.0, v=1.0, fade=.01):  # mix in at t (s); short tail fade so nothing truncates with a click
    sig = pan2(sig, pan) if sig.ndim == 1 else sig
    sig = sig * np.minimum(1, np.arange(len(sig), 0, -1) / max(1, fade * SR))[:, None]
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    n = max(0, min(len(sig), len(buf) - i))
    buf[i:i + n] += v * sig[:n]


def peq(x, f0, gain_db, q):  # RBJ peaking EQ
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    al = np.sin(w) / (2 * q)
    b, a = [1 + al * A, -2 * np.cos(w), 1 - al * A], [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def body(x, modes, direct=1.0):  # convolve with a synthetic body: direct path + damped modes (f, decay, gain)
    t = tt(max(d for _, d, _ in modes) * 6)
    ir = np.zeros(len(t))
    ir[0] = direct
    for f, d, g in modes:
        ir += 2 * g / (d * SR) * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    return fftconvolve(x, ir if x.ndim == 1 else ir[:, None], axes=0)[:len(x)]


def tv_band(x, fc, width=.5, nper=1024):
    """Time-varying band-pass (STFT mask): `fc` is a per-sample centre-frequency curve, `width` in octaves."""
    f, ts, Z = stft(x, SR, nperseg=nper)
    fcs = np.interp(ts, np.arange(len(fc)) / SR, fc)
    Z = Z * np.exp(-.5 * (np.log2(np.maximum(f, 20)[:, None] / fcs) / width) ** 2)
    return istft(Z, SR, nperseg=nper)[1][:len(x)]


def swept(rng, d, f0, f1, width=.5, shape=None):  # noise band whose centre glides f0 -> f1 (exp, or `shape(x)`)
    n = int(round(d * SR))
    x = np.clip(np.arange(n) / SR / d, 0, 1)
    return norm(tv_band(noise(rng, n), f0 * (f1 / f0) ** (x if shape is None else shape(x)), width))


def swell(t, dur, peak, a=.008, r=.03):  # 0 -> 1 at `peak` (fraction of dur) -> 0
    x = np.clip(t / dur, 1e-9, 1)
    return np.sin(np.pi * x ** (np.log(.5) / np.log(peak))) * np.minimum(t / a, 1) * np.clip((dur - t) / r, 0, 1)


def smooth_rand(rng, n, rate):  # smooth random curve in [-1, 1] wiggling at ~rate Hz
    k = max(1, int(SR / rate))
    x = uniform_filter1d(uniform_filter1d(rng.standard_normal(n + 2 * k), k), k)[k:k + n]
    return x / (np.abs(x).max() + 1e-12)


def ks(rng, f, length, t60=1.0, damp=.5, pos=.15, exc_lp=8000.0):
    """Karplus-Strong string, tuned exactly with a first-order allpass in the loop.
    damp 0..0.5 = one-zero loss filter weight (0.5 darkest); pos = pluck position (comb on the excitation)."""
    P_ = SR / f
    L = int(np.floor(P_ - damp - .1))
    d = P_ - damp - L
    c = (1 - d) / (1 + d)
    g = 10 ** (-3 / (t60 * f))
    den = np.zeros(L + 3)
    den[0], den[1] = 1, c
    den[L] -= g * (1 - damp) * c
    den[L + 1] -= g * ((1 - damp) + damp * c)
    den[L + 2] -= g * damp
    m = max(4, int(round(P_)))
    burst = filt(rng.uniform(-1, 1, m + 64), "lowpass", min(exc_lp, .45 * SR))[64:]
    k = max(1, int(round(pos * P_)))
    burst = burst - np.r_[np.zeros(k), burst[:-k]]
    x = np.zeros(int(round(length * SR)))
    x[:m] = (burst - burst.mean()) * np.hanning(m + 2)[1:-1] ** .3
    y = lfilter([1, c], den, x)
    return y / (np.abs(y).max() + 1e-12)


GLOCK = [(1, 1, 1), (2.76, .3, .35), (5.4, .1, .15)]


BELL = [(1, 1, 1), (2.0, .3, .6), (3.0, .1, .35), (4.16, .05, .2)]


def mallet(m, parts=GLOCK, d=.6, length=None, attack=.0015):
    f = mhz(m)
    t = tt(length or min(5 * d, 3.0))
    return sum(a * np.sin(2 * np.pi * f * r * t) * env(t, attack, d * k) for r, a, k in parts if f * r < 9000)


def lowshelf(x, f0, gain_db):  # RBJ low shelf, S = 1
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    al, c = np.sin(w) / np.sqrt(2), np.cos(w)
    r = 2 * np.sqrt(A) * al
    b = [A * ((A + 1) - (A - 1) * c + r), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - r)]
    a = [(A + 1) + (A - 1) * c + r, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - r]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def stamp(rng, weight=1.0, pitch=1.0, hook=False, lift=1.0, air=1.0, pan=None):
    """Rubber stamp slammed on a phone lying on a desk: air, weighty thump, desk thock, rubber squash, paper
    thwack + crinkle, and the sticky lift a moment later. `pitch` raises the burst's machine-gun thuds;
    `hook` = the opening stamp / the title stamp: a heavier body, a sub drop whose harmonics a phone speaker
    plays (150-500 Hz), and a wet ink splash."""
    t = tt(1.0 if hook else .75)
    j = lambda lo=.93, hi=1.07: rng.uniform(lo, hi)
    thump = osc(66 * pitch * j() * (1 + 1.7 * np.exp(-t / .016))) * env(t, .0008, .075 * weight)
    thock = sum(a * np.sin(2 * np.pi * f * pitch * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(172, 1, .07), (251, .85, .05), (402, .7, .035), (655, .5, .022), (1130, .35, .012)])
    thock = norm(thock * np.minimum(t / .0006, 1))
    squash = norm(filt(noise(rng, len(t)), "bandpass", [280 * j() * pitch, 1250 * j()])) * env(t, .0012, .02)
    n2 = norm(filt(noise(rng, len(t)), "bandpass", [1500, 6500]))
    flam = j(.005, .009)
    paper = n2 * (env(t, .0002, .005) + .55 * env(np.maximum(t - flam, 0), .0002, .004) * (t > flam))
    crink = np.zeros(len(t))
    for tc in np.sort(rng.uniform(.006, .09, 22)):
        i = int(tc * SR)
        crink[i:i + 24] += rng.uniform(.2, 1) * np.exp(-tc / .035) * rng.choice([-1, 1]) * np.hanning(24)
    crink = norm(filt(crink, "bandpass", [1800, 6000]))
    tl = j(.20, .26)
    lifted = norm(filt(noise(rng, len(t)), "bandpass", [700, 2800])) * env(np.maximum(t - tl, 0), .001, .009) * (t > tl)
    s = .8 * weight * thump + 1.1 * thock + .6 * squash + .8 * norm(paper) + .22 * crink + .10 * lift * lifted
    s = np.tanh(1.4 * s) / np.tanh(1.4)
    if hook:  # added after the saturation, so the sub does not squash the mid body that a phone speaker plays
        boom = osc(46 * (1 + 2.4 * np.exp(-t / .022))) * env(t, .001, .09)
        boom = np.tanh(2.6 * boom) / np.tanh(2.6)          # odd harmonics: what a phone hears of the sub
        thunk = norm(sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)  # phone + desk body
                         for f, a, d in [(310, 1, .09), (515, .75, .06), (790, .55, .04), (1240, .35, .025)]))
        splash = norm(filt(noise(rng, len(t)), "bandpass", [500, 3800])) * env(t, .002, .045) * \
            (1 + .6 * smooth_rand(rng, len(t), 70))
        rub = norm(filt(noise(rng, len(t)), "bandpass", [350, 1600])) * env(t, .002, .06)
        s = s + .5 * boom + .6 * thunk * np.minimum(t / .0008, 1) + .35 * splash + .3 * rub
    lead = .06  # the stamp comes down 2 frames before impact: a short air push
    a = swept(rng, lead, 700, 2400, .8) * np.linspace(0, 1, int(round(lead * SR))) ** 2 * .10 * air
    out = pan2(np.r_[a, s], rng.uniform(-.08, .08) if pan is None else pan)
    if hook:  # a short room bloom: the big stamps keep ringing ~0.3 s in the mids
        out = out + reverb(out, room_size=.36, damping=.5, wet_level=.42, dry_level=0, width=.8)
    return out, lead


def swish(rng, dur=.3, f0=900, f1=3600, peak=.4, pan=(-.5, .5)):  # soft UI swish; cue = gesture start
    t = tt(dur)
    s = .8 * swept(rng, dur, f0, f1, .55) + .35 * norm(filt(noise(rng, len(t)), "lowpass", 900))
    return pan2(s * swell(t, dur, peak, a=.02), np.linspace(*pan, len(t))), 0.0


def tap(rng):  # fingertip on glass: a soft, dull tick (the thumb-tap ripple)
    t = tt(.06)
    s = norm(filt(noise(rng, len(t)), "bandpass", [700, 3200])) * env(t, .0004, .004)
    s += .5 * np.sin(2 * np.pi * rng.uniform(900, 1100) * t) * env(t, .0005, .008)
    return pan2(s, rng.uniform(-.1, .1)), 0.0


def tick(rng, hi):
    t = tt(.06)
    f = 2150 if hi else 1480
    s = np.sin(2 * np.pi * f * t) * env(t, .0003, .011) + .4 * np.sin(2 * np.pi * f * 2.71 * t) * env(t, .0003, .005)
    return s + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0002, .0015)


def blip(rng, f, two=False, muffle=False):  # group-chat message blip
    t = tt(.16)
    f1 = f * (1 - .32 * np.exp(-t / .006))
    s = osc(f1) * env(t, .0008, .032) + .22 * osc(2 * f1) * env(t, .0008, .012)
    if two:
        t2 = np.maximum(t - .045, 0)
        s += .7 * osc(1.26 * f * (1 - .2 * np.exp(-t2 / .005))) * env(t2, .0008, .03) * (t > .045)
    return (filt(s, "lowpass", 1800) * 1.6 if muffle else s), 0.0


def plink(rng, note, pan=0.0, big=False):
    """A qashta drop hitting the glass: tick + tuned bubble + splash. `big`: the logo's dots on the phone glass
    are fat drops now (DOT_R 84 px): a rounder body, a wetter splat and a little spread."""
    t = tt(.8)
    f = hz(note)
    f1 = f * (1 - .3 * np.exp(-t / .007))
    tone = osc(f1) * env(t, .0008, .17) + .15 * osc(2.01 * f1) * env(t, .0008, .05)
    tick_ = norm(filt(noise(rng, len(t)), "bandpass", [3000, 7000])) * env(t, .0002, .0015)
    glass = np.sin(2 * np.pi * f * 3.1 * t) * env(t, .0002, .012)
    splash = norm(filt(noise(rng, len(t)), "bandpass", [500, 2600])) * env(t, .001, .025)
    thud = osc(110 * (1 + .6 * np.exp(-t / .01))) * env(t, .001, .04)
    s = tone + .22 * tick_ + .18 * glass + .2 * splash + .35 * thud
    if big:
        spread = tv_band(noise(rng, len(t)), 1400 * 2 ** (-1.2 * np.minimum(t / .12, 1)), .6) * env(t, .006, .05)
        s = s + .35 * norm(spread) + .3 * osc(160 * (1 + .5 * np.exp(-t / .012))) * env(t, .001, .05)
    return pan2(s, pan), 0.0


def bloop(rng, f0=290.0, up=1.6, dur=.11):  # two cream dots coalesce into one bead: a soft liquid bloop
    t = tt(dur + .12)
    s = osc(f0 * up ** np.minimum(t / dur, 1)) * env(t, .004, .04)
    return pan2(filt(s, "lowpass", 2500), 0), 0.0


def curd(rng, n, rate, lo=.0006, hi=.0025):
    """Aperiodic squelch source: a dense, irregular crackle of tiny wet grains (thick cream giving way) over soft
    noise. Deliberately NOT a pitched buzz: a 90-120 Hz pulse train through a moving low formant is the recipe for
    a raspberry/fart, which a food spot cannot afford (checker fix, v2)."""
    g = np.zeros(n)
    for o in np.sort(rng.uniform(0, n / SR - hi, int(rate * n / SR))):
        i, m = int(o * SR), int(rng.uniform(lo, hi) * SR)
        g[i:i + m] += rng.uniform(.2, 1) * rng.choice([-1, 1]) * np.hanning(m)
    return norm(g) + .35 * norm(noise(rng, n))


def splat(rng, note="D5", pan=0.0):
    """A cream drop lands on the qashta dome and SLUMPS into it (cup3d: the dots spread into comma dollops): a soft
    plop, a creamy mush, then a slow settling squish that glides down over ~0.2 s, and a small low bubble."""
    t = tt(.8)
    thump = osc(125 * (1 + .7 * np.exp(-t / .012))) * env(t, .0015, .04)
    mush = norm(filt(noise(rng, len(t)), "bandpass", [300, 2000])) * env(t, .002, .03)
    slump = norm(tv_band(noise(rng, len(t)), 900 * 2 ** (-1.6 * np.minimum(t / .25, 1)), .45)) * env(t, .02, .1)
    f = hz(note)
    bub = osc(f * (1 - .25 * np.exp(-t / .01))) * env(np.maximum(t - .03, 0), .002, .06) * (t > .03)
    return pan2(.45 * thump + .7 * mush + .6 * slump + .25 * bub, pan), 0.0


def scoop(rng, dur):
    """The spoon dips into the dome and drags a heaped scoop of clotted qashta (crater window in cup3d.py): a thick,
    soft creamy squelch — low-mid and rounded, a slow formant that sinks as the bowl goes in and lifts as it drags
    out, with the curd's tiny air pockets giving way. Satisfying, not wet-mouthy: nothing above ~4 kHz."""
    t = tt(dur)
    x = t / dur
    wob = smooth_rand(rng, len(t), 5)
    src = curd(rng, len(t), 420)  # aperiodic (see curd): no pitched buzz under the formant
    fc = 560 * 2 ** (-.9 * np.sin(np.pi * np.clip(x / .7, 0, 1)) * (x < .7) + .5 * np.clip((x - .7) / .3, 0, 1) + .25 * wob)
    s = norm(tv_band(src, fc, .38)) + .35 * norm(tv_band(noise(rng, len(t)), 2.3 * fc, .25))
    push = osc(150 * (1 + .35 * np.exp(-t / .02))) * env(t, .006, .06)  # the bowl pressing into the thick mass
    e = np.clip(t / .07, 0, 1) * (.65 + .35 * np.sin(np.pi * np.clip(x, 0, 1))) * np.clip((dur - t) / .1, 0, 1)
    out = pan2(filt(s * e + .35 * push, "lowpass", 4000), .22)
    for tb in np.sort(rng.uniform(.15 * dur, .85 * dur, 7)):  # curd air pockets giving way
        tt_ = tt(.04)
        place(out, osc(rng.uniform(190, 420) * (1 + .4 * tt_ / .04)) * env(tt_, .002, .008), tb, .22, rng.uniform(.12, .22))
    return out, 0.0


def suction(rng):  # the bowl leaves the crater (T_SEP): a soft, rounded suction release — "tchup"
    t = tt(.22)
    f = 430 * (1 - .4 * (1 - np.exp(-t / .015)))
    s = osc(f) * env(t, .002, .03) + .35 * norm(filt(noise(rng, len(t)), "bandpass", [700, 2800])) * env(t, .001, .012)
    return pan2(s, .22), 0.0


def stretch(rng, dur):
    """The cream strand stretches and necks (T_SEP .. T_BREAK): a gentle, slowly rising strain — breathy band noise
    that narrows and climbs as the strand thins, with a faint sticky crackle. Soft; it should feel elastic."""
    t = tt(dur)
    x = t / dur
    fc = 380 * 2 ** (2.0 * x ** 1.3 + .08 * smooth_rand(rng, len(t), 9))
    s = norm(tv_band(noise(rng, len(t)), fc, .35 - .2 * x.mean()))
    tone = osc(fc * .98) * .05  # a hint of pitch only (more would read as a slide whistle)
    crk = np.zeros(len(t))
    for tc in np.sort(rng.uniform(.1 * dur, .95 * dur, int(14))):
        i = int(tc * SR)
        crk[i:i + 30] += rng.uniform(.3, 1) * np.hanning(30)[:len(crk[i:i + 30])] * rng.choice([-1, 1])
    crk = norm(filt(crk, "bandpass", [1500, 4500])) * (.2 + .8 * x)
    e = np.clip(t / .08, 0, 1) * (.35 + .65 * x ** 1.5) * np.clip((dur - t) / .02, 0, 1)
    return pan2((s + tone + .18 * crk) * e, .2), 0.0


def snap(rng):  # the strand necks and snaps (T_BREAK): a tiny soft tck + the cream springing back
    t = tt(.3)
    tk = norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0003, .0015)
    wob = osc(300 * (1 + .18 * np.sin(2 * np.pi * 21 * t) * np.exp(-t / .05))) * env(t, .002, .05)
    return pan2(.5 * tk + .6 * wob, .18), 0.0


def swish_big(rng, dur=.5, peak=.72):  # end-card pull-back: airy swish with a sweet tonal glide; peaks at the cue
    t = tt(dur)
    s = swept(rng, dur, 450, 4200, .6) + .18 * osc(700 * 2 ** (1.0 * t / dur)) * np.sin(np.pi * t / dur)
    return pan2(s * swell(t, dur, peak, a=.03), np.linspace(.55, -.55, len(t))), peak * dur


def pop(rng, f0=620.0):  # the comment bubble springs in: a small round "pop-up" (pitch rises)
    t = tt(.16)
    s = osc(f0 * 2 ** (.85 * np.minimum(t / .035, 1))) * env(t, .0015, .035)
    s += .25 * osc(2 * f0 * 2 ** (.85 * np.minimum(t / .035, 1))) * env(t, .0015, .015)
    return pan2(s, 0), 0.0


def sparkle(rng, note="A6", pan=0.0):  # a tiny glint on the packshot
    s = mallet(midi(note), [(1, 1, 1), (2.76, .2, .3)], d=.25, length=.9) + .4 * mallet(midi(note) + 7, [(1, 1, 1)], d=.15, length=.9)
    return pan2(s, pan), 0.0


def glint(rng, dur=.5):  # the CTA's light sweep: a soft rising riq/glass shimmer
    out = np.zeros((int((dur + .6) * SR), 2))
    for j, n in enumerate(("A6", "D7", "F#7")):
        place(out, mallet(midi(n), [(1, 1, 1)], d=.18, length=.6), j * dur / 3, -.4 + .4 * j, .5)
    place(out, pan2(jingles(rng, list(np.linspace(0, dur * .8, 6)), .35), 0), 0)
    return out, 0.0


def jingles(rng, times, level=1.0):  # riq zills: inharmonic brass partials, kept below 8 kHz for phone speakers
    t = tt(max(times) + .3)
    parts = [(rng.uniform(2600, 7200), rng.uniform(.03, .09)) for _ in range(10)]
    s = np.zeros(len(t))
    for i, tc in enumerate(times):
        tt_ = np.maximum(t - tc, 0)
        s += (1 - .25 * min(i, 3)) * sum(np.sin(2 * np.pi * f * tt_ + rng.uniform(0, 6)) * np.exp(-tt_ / d) for f, d in parts) * (t >= tc)
    return filt(s / 4, "lowpass", 8000) * level


def chime(rng, note, pan=0.0):  # domino: «مش» is gone and the stamp flips turquoise — a clean little bell
    m = midi(note)
    s = mallet(m, GLOCK, d=.42, length=1.1) + .22 * mallet(m + 12, GLOCK, d=.22, length=1.1)
    t = tt(1.1)
    wet = norm(filt(noise(rng, len(t)), "bandpass", [1500, 5000])) * env(t, .0003, .003)  # cream tick on the glass
    return pan2(s + .22 * wet, pan), 0.0


def whip(rng, dur):  # whip back out (P.whip, Easing.inOut(poly5): fastest mid-gesture) — airy, with a low whomp
    s, _ = swish(rng, dur + .08, 600, 5200, .5, (.6, -.6))
    t = tt(dur + .08)
    whomp = osc(110 * 2 ** (-.8 * t / dur)) * swell(t, dur + .08, .45, a=.02)
    return s + pan2(.12 * filt(whomp, "highpass", 70), 0), 0.0


def sizzle(rng, dur):
    """41°, feels like 48°: under the weather screen the phone (or the pavement) is frying — a soft, crackly
    sizzle that fades in after the hook and out into the swipe. High band only (2-8 kHz): a phone plays it."""
    t = tt(dur)
    hiss = norm(filt(noise(rng, len(t)), "bandpass", [3000, 8000])) * (.6 + .4 * smooth_rand(rng, len(t), 3))
    pops = np.zeros(len(t))
    for o in np.sort(rng.uniform(0, dur - .01, int(170 * dur))):
        i = int(o * SR)
        n = int(rng.uniform(.0008, .003) * SR)
        pops[i:i + n] += rng.uniform(.2, 1) * rng.choice([-1, 1]) * np.hanning(n)[:len(pops[i:i + n])]
    pops = norm(filt(pops, "bandpass", [2000, 7500]))
    e = np.clip(t / .15, 0, 1) * np.clip((dur - t) / .2, 0, 1)
    return np.stack([(.35 * hiss + pops) * e, (.35 * np.roll(hiss, 997) + np.roll(pops, 1499)) * e], 1), 0.0


def order_ping(rng):  # the order-arrived banner: round, friendly glass "pling" on A5 (-> the cymbals land on D).
    # Short and a little under the brass, so the brand sound — not the phone ping — is what the ear keeps.
    t = tt(1.0)
    f = hz("A5") * (1 - .05 * np.exp(-t / .008))
    s = osc(f) * env(t, .002, .20) + .28 * osc(2 * f) * env(t, .002, .10) + .1 * osc(3 * f) * env(t, .002, .05)
    s += .10 * np.sin(2 * np.pi * hz("E7") * t) * env(t, .001, .04)
    return pan2(s, 0.0), 0.0


def cta_chime(rng):  # the CTA stamp's "turquoise" side: a light D-major bell flick over the thud
    out = np.zeros((int(1.6 * SR), 2))
    for k, (n, pan, v) in enumerate([("D6", -.2, .8), ("F#6", .2, .7), ("A6", 0, .6)]):
        place(out, mallet(midi(n), BELL, d=.5, length=1.5), .03 * k, pan, v)
    return out, 0.0


def clink(rng, f0, bright=1.0):
    """One clack of the liquorice seller's brass cups: strike tick, a 20 ms chatter of the two plates ("shk"), an FM
    clang, and the brass ring: a principal tuned to f0 (so the logo sits in D) with a fifth, over a dense cluster of
    inharmonic plate modes that ring about as long as the principal and beat slowly against each other (the brassy
    shimmer that tells "metal cups" from "bell"). Upper modes kept < 7 kHz and tamed for phone speakers."""
    t = tt(1.5)
    n = lambda: rng.standard_normal(len(t))
    strike = norm(filt(n(), "bandpass", [2200, 7500])) * env(t, .0002, .0012)
    ch = np.zeros(len(t))
    for tc in np.cumsum(rng.uniform(.0012, .0034, 9)):
        ch += rng.uniform(.3, 1) * env(np.maximum(t - tc, 0), .0002, .0016) * (t >= tc)
    chk = norm(filt(n(), "bandpass", [2400, 6500])) * (.8 * ch + env(t, .001, .022))
    ring = 0
    for r, a, d, dt in [(1.0, 1.0, .28, .0008), (1.5, .5, .2, .001), (2.09, .46, .17, .0018), (2.56, .42, .15, .002),
                        (2.98, .38, .14, .0022), (3.52, .32, .12, .0025), (4.21, .24, .1, .0025), (4.83, .17, .08, .0025),
                        (5.6, .11, .06, .0025)]:
        for det in (-1, 1):
            f = f0 * r * (1 + det * dt * rng.uniform(.6, 1))
            if f < 7000:
                ring = ring + a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d)
    ring = norm(ring * np.minimum(t / .0004, 1))
    clang = np.sin(2 * np.pi * f0 * 2.37 * t + 2.0 * np.exp(-t / .018) * np.sin(2 * np.pi * f0 * 3.41 * t)) * env(t, .0003, .03)
    s = .7 * strike * bright + .75 * chk * bright + .8 * ring + .35 * clang
    return filt(peq(peq(s, 7000, -4, .8), 3300, -1.5, 1.2), "lowpass", 8000, 4)


def sonic_logo(rng, gap=.15, ring_v=1.0):
    """«تشك-تشك»: two clacks (the second answers, a touch brighter) + the brass bloom (D6 + A6).
    A brand asset: fixed seed, so every appearance is the same two clacks (only the gap and bloom level differ:
    on the end card the gap is the logo dots' 6 frames, so the clacks ARE the dots)."""
    rng = np.random.default_rng(SEED + 5000)
    out = np.zeros((int(3.2 * SR), 2))
    place(out, clink(rng, hz("D6"), .95), 0, -.18, .85)
    place(out, clink(rng, hz("D6") * 1.003, 1.1), gap, .18, 1.0)
    t = tt(3.0)
    bloom = (np.sin(2 * np.pi * hz("D6") * t) + .5 * np.sin(2 * np.pi * hz("A6") * t + 1)) * env(t, .04, .7)
    place(out, bloom * (1 + .12 * np.sin(2 * np.pi * 5.5 * t)), gap + .01, 0, .16 * ring_v)
    out = .8 * out + reverb(out, room_size=.45, damping=.35, wet_level=.3, dry_level=0, width=.8)
    return out, 0.0


def logo_echo(rng, gap=.2):
    """The end card's living logo hops its two dots on the music (endcard/layout.ts E.dotHops: beat 12 of the
    groove and the stop-time button), one dot-gap apart — the sonic logo as a picture. The sound answers with the
    SAME two brass clacks (fixed seed), dry of the D/A bloom: a small «تشك-تشك» locked to the dots."""
    return sonic_logo(rng, gap=gap, ring_v=0.0)


def lufs(x):  # ITU-R BS.1770-4 integrated loudness (48 kHz K-weighting, 400 ms blocks, gated)
    k = kweight(x)
    ms = np.array([(k[i:i + 19200] ** 2).mean(0).sum() for i in range(0, len(k) - 19200 + 1, 4800)])
    ms = ms[ms > 10 ** ((-70 + .691) / 10)]
    return -.691 + 10 * np.log10(ms[ms > ms.mean() * .1].mean())


def kweight(x):
    k = lfilter([1.53512486, -2.69169619, 1.19839281], [1, -1.69065929, .73248077], x, axis=0)
    return lfilter([1, -2, 1], [1, -1.99004745, .99007225], k, axis=0)


def limiter_gain(x, ceil_db, attack=.004, hold=.04):  # look-ahead gain curve vs 4x-oversampled peaks
    pk = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)[:4 * len(x)].reshape(-1, 4).max(1)
    need = np.minimum(1, 10 ** (ceil_db / 20) / np.maximum(pk, 1e-9))
    w, h = int(attack * SR), int(hold * SR)
    g = minimum_filter1d(need, w + h + 1)
    g = uniform_filter1d(np.r_[np.full(h // 2, g[0]), g[:len(g) - h // 2]], w)
    assert np.all(g <= need + 1e-9)
    return g


# =====================================================================================================================
# NEW FOLEY for the 2D series (paper, ink, spoon, plate, fire, house). Same voice convention: f(rng, **p) -> (audio, lead)
# =====================================================================================================================
def ink_thud(rng, weight=1.0, pitch=1.0, big=False, pan=0.0):
    """A printed word / stamp landing (InkTitle impact, CTA stamp): spot #2's stamp voice, lighter by default.
    big=True = the hook-size press (sub harmonics a phone plays + room bloom)."""
    out, lead = stamp(rng, weight=weight, pitch=pitch, hook=big, lift=.4, air=.7, pan=pan)
    return (lowshelf(peq(out, 1000, 3, .7), 120, -3) if big else out), lead


def paper_swish(rng, dur=.32, f0=500, f1=3800, peak=.55, pan=(.3, -.3)):
    """A paper sheet sliding (the end card's turquoise sheet, a page flip): dry, papery noise with a fibrous rasp."""
    t = tt(dur)
    base = swept(rng, dur, f0, f1, .7)
    rasp = norm(filt(noise(rng, len(t)), "bandpass", [2500, 7000])) * (.5 + .5 * np.clip(smooth_rand(rng, len(t), 60), 0, 1))
    s = (.8 * base + .35 * rasp) * swell(t, dur, peak, a=.015, r=.04)
    return pan2(s, np.linspace(pan[0], pan[1], len(t))), peak * dur


def paper_flip(rng, pan=0.0):
    """A quick card/page flip on twos: two little flaps + a crisp tick."""
    out = np.zeros((int(.3 * SR), 2))
    for k, o in enumerate((0, .045)):
        s, _ = paper_swish(rng, .09, 1200, 5200, .4, (pan - .1, pan + .1))
        place(out, s, o, 0, 1 - .3 * k)
    t = tt(.02)
    place(out, norm(filt(noise(rng, len(t)), "bandpass", [3000, 8000])) * env(t, .0002, .002), .09, pan, .5)
    return out, 0.0


def paper_thup(rng, pan=0.0):
    """A paper sheet settling flat (the end card is in): a soft low 'thup' of air + paper body."""
    t = tt(.25)
    air = norm(filt(noise(rng, len(t)), "lowpass", 600)) * env(t, .002, .03)
    knock = osc(180 * (1 + .4 * np.exp(-t / .01))) * env(t, .001, .035)
    tick_ = norm(filt(noise(rng, len(t)), "bandpass", [1800, 5000])) * env(t, .0003, .004)
    return pan2(.7 * air + .5 * knock + .25 * tick_, pan), 0.0


def cup_plop(rng, pan=0.0):
    """The hero cup lands on the table (plastic cup, full): a dull, rounded plastic knock + a creamy wobble."""
    t = tt(.5)
    knock = sum(a * np.sin(2 * np.pi * f * rng.uniform(.97, 1.03) * t) * np.exp(-t / d)
                for f, a, d in [(210, 1, .05), (480, .6, .03), (1150, .3, .012), (2300, .15, .006)])
    knock = norm(knock) * np.minimum(t / .0008, 1)
    wob = osc(260 * (1 + .12 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / .08))) * env(np.maximum(t - .015, 0), .004, .07) * (t > .015)
    return pan2(.8 * knock + .3 * wob, pan), 0.0


def spoon_clink(rng, bright=1.0, pan=0.0):
    """Steel teaspoon on a ceramic plate: a short bright ring (ceramic modes) + the spoon's own steel modes."""
    t = tt(.9)
    cer = sum(a * np.sin(2 * np.pi * f * rng.uniform(.985, 1.015) * t + rng.uniform(0, 6)) * np.exp(-t / d)
              for f, a, d in [(1870, 1, .12), (3110, .7, .08), (4620, .45, .05), (6400, .2, .03)])
    steel = sum(a * np.sin(2 * np.pi * f * rng.uniform(.99, 1.01) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(2480, .6, .2), (3920, .35, .1)])
    tk = norm(filt(noise(rng, len(t)), "bandpass", [2500, 7500])) * env(t, .0002, .0015)
    s = (.8 * norm(cer) + .45 * norm(steel)) * np.minimum(t / .0006, 1) + .35 * tk
    return pan2(filt(s * bright, "lowpass", 8000), pan), 0.0


def spoon_plastic(rng, pan=0.0):
    """Spoon tapping the plastic cup: a dull hollow tick (no ring)."""
    t = tt(.2)
    s = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) for f, a, d in [(740, 1, .02), (1650, .6, .012), (3100, .3, .006)])
    s = norm(s) * np.minimum(t / .0005, 1) + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0002, .002)
    return pan2(s, pan), 0.0


def crickets(rng, dur=2.0, rate=2.2, pan=(-.4, .4)):
    """The empty-plate silence: a couple of crickets far away (tri-pulse chirps on a ~4.6 kHz carrier, a little reverb)."""
    out = np.zeros((int((dur + .6) * SR), 2))
    for c, p in enumerate(pan):
        f0 = rng.uniform(4300, 4900)
        tc = rng.uniform(0, .3)
        while tc < dur:
            for k in range(3):
                t = tt(.022)
                ch = np.sin(2 * np.pi * f0 * t) * np.sin(np.pi * t / .022) ** 2
                ch = ch * (1 + .3 * np.sin(2 * np.pi * 2 * f0 * t))
                place(out, ch, tc + k * .034, p, .5 if c else .4)
            tc += 1 / rate * rng.uniform(.85, 1.2)
    out = filt(out, "bandpass", [2500, 7500])
    return .7 * out + reverb(out, room_size=.6, damping=.4, wet_level=.4, dry_level=0, width=.9), 0.0


def doorbell(rng, notes=("E6", "C6"), gap=.42, pan=0.0):
    """«دينغ دونغ»: a two-tone house chime (struck bars, a little room)."""
    out = np.zeros((int((gap + 2.2) * SR), 2))
    for k, n in enumerate(notes):
        s = mallet(midi(n), [(1, 1, 1), (3.0, .25, .3), (4.1, .1, .2)], d=.55, length=2.0, attack=.002)
        place(out, s, k * gap, pan, 1.0 - .1 * k)
    return out + reverb(out, room_size=.5, damping=.5, wet_level=.25, dry_level=0, width=.7), 0.0


def flame_whoosh(rng, dur=.6, pan=0.0):
    """Fire catching (the «شطة» letters ignite): a breathy low whoomp that blooms into crackle."""
    t = tt(dur)
    whoomp = swept(rng, dur, 140, 900, .9, shape=lambda x: np.sqrt(x)) * swell(t, dur, .25, a=.01, r=.1)
    roar = norm(filt(noise(rng, len(t)), "bandpass", [300, 2500])) * swell(t, dur, .5, a=.05, r=.15) * (.7 + .3 * smooth_rand(rng, len(t), 9))
    cr = np.zeros(len(t))
    for o in np.sort(rng.uniform(.1, dur - .02, int(70 * dur))):
        i, m = int(o * SR), int(rng.uniform(.0006, .002) * SR)
        cr[i:i + m] += rng.uniform(.3, 1) * rng.choice([-1, 1]) * np.hanning(m)
    cr = norm(filt(cr, "bandpass", [1500, 7000])) * np.clip(t / (.5 * dur), 0, 1)
    return pan2(.8 * whoomp + .4 * roar + .35 * cr, pan), .04


def fire_loop(rng, dur, pan=0.0):
    """Steady drawn-flame crackle bed (under the burning letters)."""
    out, _ = sizzle(rng, dur)
    t = tt(dur)
    roar = norm(filt(noise(rng, len(t)), "bandpass", [250, 1800])) * (.6 + .4 * smooth_rand(rng, len(t), 5))
    roar = roar * np.clip(np.minimum(t / .1, (dur - t) / .2), 0, 1)
    return out + pan2(.35 * roar, pan), 0.0


def whoosh(rng, dur=.35, up=True, pan=(-.5, .5)):
    """A clean camera/prop whoosh (rising or falling)."""
    f0, f1 = (500, 4200) if up else (4200, 500)
    return swish(rng, dur, f0, f1, .5, pan)


def sweat_drip(rng, pan=0.0):
    """A sweat drop flicking off the melting spoon: tiny wet blip."""
    return blip(rng, rng.uniform(1700, 2300))


# =====================================================================================================================
# TIMELINE: read the TypeScript (spec.ts / kit cues) so the sound follows the picture
# =====================================================================================================================
def ts_eval(src):
    """Bundle a TS snippet with esbuild and run it in node; it must console.log(JSON.stringify(...))."""
    esb = subprocess.run([str(VIDEO / "node_modules/.bin/esbuild"), "--bundle", "--platform=node", "--format=cjs",
                          "--loader=ts", "--sourcefile=sound-timeline.ts", "--log-level=error"],
                         input=src, cwd=VIDEO, capture_output=True, text=True)
    if esb.returncode:
        raise RuntimeError(esb.stderr)
    run = subprocess.run(["node"], input=esb.stdout, cwd=VIDEO, capture_output=True, text=True)
    if run.returncode:
        raise RuntimeError(run.stderr)
    return json.loads(run.stdout)


def endcard_cues():
    """The kit end card's cue table (relative frames) + its duration, from kit/endcard/cues.ts."""
    return ts_eval("import {EC, ENDCARD_DURATION} from './src/qashati2d/kit/endcard/cues';\n"
                   "console.log(JSON.stringify({EC, ENDCARD_DURATION}));")


# =====================================================================================================================
# MIXER: SFX cues with per-cue ducking of the music
# =====================================================================================================================
class Mixer:
    """mx = Mixer(dur); mx.sfx(t, sig, lead=0, gain=1, duck_db=0, pan=0); mx.music(sig, t=0); x = mx.mix()
    Ducking follows each key cue's own envelope (8 ms look-ahead, ~70 ms release), like spot #2."""

    def __init__(self, dur):
        self.dur = dur
        self.N = int(round(dur * SR))
        self.m = np.zeros((self.N, 2))
        self.s = np.zeros((self.N, 2))
        self.duck = np.zeros(self.N)
        self.cues = []  # (t, kind, start_sample, signal)

    def music(self, sig, t=0.0, gain=1.0):
        place(self.m, sig, t, 0.0, gain)

    def sfx(self, t, sig, lead=0.0, gain=1.0, duck_db=0.0, kind="sfx", pan=0.0):
        sig = pan2(sig, pan) if sig.ndim == 1 else sig
        sig = sig * gain
        place(self.s, sig, t - lead)
        self.cues.append((t, kind, int(round((t - lead) * SR)), sig))
        if duck_db:
            e = maximum_filter1d(np.abs(sig).max(1), int(.03 * SR))
            e = np.minimum(1, e / (e.max() * .5 + 1e-12)) * duck_db
            i = int(round((t - lead - .008) * SR))
            e = e[max(0, -i):]
            i = max(i, 0)
            n = min(len(e), self.N - i)
            self.duck[i:i + n] = np.maximum(self.duck[i:i + n], e[:n])

    def voice(self, t, fn, gain=1.0, duck_db=0.0, **p):
        """Place voice `fn` at cue time t with its own seed (cue_rng)."""
        sig, lead = fn(cue_rng(t, fn.__name__), **p)
        self.sfx(t, sig, lead, gain, duck_db, fn.__name__)
        return sig

    def silence(self, t0, t1):
        """Digital zero in [t0, t1) on both buses (the comic dead stop) — with 3 ms fades so nothing clicks."""
        a, b = int(round(t0 * SR)), int(round(t1 * SR))
        g = np.ones(self.N)
        f = int(.003 * SR)
        g[max(0, a - f):a] = np.linspace(1, 0, min(f, a))
        g[a:b] = 0
        g[b:b + f] = np.linspace(0, 1, len(g[b:b + f]))
        self.m *= g[:, None]
        self.s *= g[:, None]

    def mix(self, sfx_room=.08):
        d = self.duck.reshape(-1, 48).max(1) if self.N % 48 == 0 else np.r_[self.duck, np.zeros(48 - self.N % 48)].reshape(-1, 48).max(1)
        for i in range(1, len(d)):
            d[i] = max(d[i], d[i - 1] * .986)
        duck = uniform_filter1d(np.repeat(uniform_filter1d(d, 4), 48), 96)[:self.N]
        s = reverb(self.s, room_size=.25, damping=.55, wet_level=sfx_room, dry_level=1, width=.8) if sfx_room else self.s
        return self.m * (10 ** (-duck / 20))[:, None] + s


# =====================================================================================================================
# THE END CARD PACKAGE (kit/endcard/EndCard2D.tsx) — call with t0 = the end card's start in seconds
# =====================================================================================================================
def endcard_sfx(mx, t0, ec=None, gain=1.0):
    """Standard end-card sound, locked to kit/endcard/cues.ts: sheet swish → paper thup → cup plop → THE SONIC LOGO
    (clack 1 = logo dot 1, clack 2 = dot 2) → CTA ink thud + a light bell → comment pop (on the bubble's overshoot)
    → cup sparkle + CTA glint → small dry «تشك-تشك» echoes on the living logo's dot hops.
    Returns the cue times (s) it used."""
    if ec is None:
        ec = endcard_cues()["EC"]
    at = lambda f: t0 + fr(f)
    dots = ec["logoDots"]
    gap = fr(dots[1] - dots[0])
    used = {}
    used["sheet"] = at(ec["sheet"])
    mx.sfx(used["sheet"], *paper_swish(cue_rng(used["sheet"], "paper_swish"), dur=fr(ec["sheetIn"] - ec["sheet"]) + .12, peak=.7), gain=.55 * gain, duck_db=3, kind="paper_swish")
    used["sheetIn"] = at(ec["sheetIn"])
    mx.voice(used["sheetIn"], paper_thup, gain=.45 * gain)
    used["cupLand"] = at(ec["cupLand"])
    mx.voice(used["cupLand"], cup_plop, gain=.5 * gain, duck_db=2)
    used["sonicLogo"] = at(dots[0])
    sig, _ = sonic_logo(None, gap=gap, ring_v=1.3)
    mx.sfx(used["sonicLogo"], sig, 0, .68 * 1.4 * gain, 7, "sonic_logo")
    used["cta"] = at(ec["cta"])
    mx.voice(used["cta"], ink_thud, gain=.62 * gain, duck_db=6, weight=.72, pitch=1.15)
    mx.voice(used["cta"] + .01, cta_chime, gain=.08 * gain)
    used["comment"] = at(ec["comment"] + 2)
    mx.voice(used["comment"], pop, gain=.85 * gain, duck_db=4)
    used["glintCup"] = at(ec["glintCup"] + 5)
    mx.voice(used["glintCup"], sparkle, gain=.08 * gain, note="A6", pan=-.3)
    used["glintCta"] = at(ec["glintCta"])
    mx.voice(used["glintCta"], glint, gain=.14 * gain)
    used["dotHops"] = [at(f) for f in ec["dotHops"]]
    for t, g in zip(used["dotHops"], (.8, .7)):
        sig, _ = logo_echo(None, gap=gap)
        mx.sfx(t, sig, 0, .68 * g * gain, 0, "logo_echo")
    return used


# =====================================================================================================================
# MASTERING + DELIVERY
# =====================================================================================================================
def master(x, dur=None, ceil_db=-1.6, fade_out=.38, fade_in=.002, target=TARGET_LUFS, hp=32, lp=15000):
    """Clean-up filters, EXACT length (dur s → round(dur·SR) samples), loudness to `target` LUFS under a 4×-oversampled
    true-peak ceiling (look-ahead limiter), cos² fade so the LAST SAMPLE IS DIGITAL ZERO (seamless loop). → (out, gain)"""
    N = int(round((dur if dur is not None else len(x) / SR) * SR))
    x = np.r_[x, np.zeros((max(0, N - len(x)), 2))][:N]
    x = filt(filt(x, "highpass", hp, 3), "lowpass", lp)
    fade = np.ones(N)
    a = int((N / SR - fade_out) * SR) if fade_out else N
    if fade_out:
        fade[a:] = np.cos(np.linspace(0, np.pi / 2, N - a)) ** 2
    fade[:int(fade_in * SR)] = np.linspace(0, 1, int(fade_in * SR))
    mix, gain = x * fade[:, None], 1.0
    for _ in range(6):
        gain *= 10 ** ((target - lufs(mix * gain * limiter_gain(mix * gain, ceil_db)[:, None])) / 20)
    g = gain * limiter_gain(mix * gain, ceil_db) * fade
    return g[:, None] * x, g


def ebur128(path):
    """ffmpeg's EBU R128 meter → (integrated LUFS, true peak dBTP, LRA LU)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    summ = r[r.rfind("Summary:"):]
    return (float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1)), float(re.search(r"Peak:\s+(-?[\d.inf]+) dBFS", summ).group(1)),
            float(re.search(r"LRA:\s+(-?[\d.]+) LU", summ).group(1)))


def encode_mp3(wav, mp3, gain_db=0.0, kbps=192):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", f"volume={gain_db:.3f}dB",
                    "-c:a", "libmp3lame", "-b:a", f"{kbps}k", "-ar", str(SR), "-ac", "2", str(mp3)], check=True)


def deliver(x, dur, wav, mp3, target=TARGET_LUFS, tp_max=TP_MAX, fade_out=.38, log=print):
    """Master `x` (stereo float) to exactly `dur` s and write the 24-bit WAV master + the MP3 for Remotion.
    The MP3 is re-encoded with the encoder's level shift corrected (its integrated loudness lands on `target`), and the
    limiter ceiling is lowered until the MP3's true peak is ≤ tp_max − 0.2. Returns a dict of measurements."""
    wav, mp3 = Path(wav), Path(mp3)
    wav.parent.mkdir(parents=True, exist_ok=True)
    mp3.parent.mkdir(parents=True, exist_ok=True)
    ceil = -1.6
    for _ in range(5):
        out, g = master(x, dur, ceil, fade_out, target=target)
        sf.write(wav, out, SR, subtype="PCM_24")
        encode_mp3(wav, mp3, 0.0)
        i0, _, _ = ebur128(mp3)
        encode_mp3(wav, mp3, target - i0)
        I, tp, lra = ebur128(mp3)
        if tp <= tp_max - .2:
            break
        ceil -= tp - (tp_max - .3)
    Iw, tpw, lraw = ebur128(wav)
    n = sf.info(wav).frames
    res = dict(wav=str(wav), mp3=str(mp3), samples=n, seconds=n / SR, wav_I=Iw, wav_TP=tpw, wav_LRA=lraw, mp3_I=I, mp3_TP=tp,
               mp3_LRA=lra, ceiling=ceil, last_sample=float(np.abs(out[-1]).max()))
    log(f"{wav.name}: {n} samples = {n / SR:.3f} s | WAV I {Iw:.1f} LUFS TP {tpw:.1f} | MP3 I {I:.1f} LUFS TP {tp:.1f} dBTP LRA {lra:.1f} "
        f"| limiter ceiling {ceil:.2f} dBFS | last sample {res['last_sample']:.1e}")
    assert n == int(round(dur * SR)), "length is not exact"
    return res


def silence_ranges(x, thresh_db=-90, min_ms=60):
    """[(t0, t1)] of true silence (all samples below thresh) — to verify comic dead stops survive the master."""
    a = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    q = a < 10 ** (thresh_db / 20)
    out, i, n = [], 0, len(q)
    while i < n:
        if q[i]:
            j = i
            while j < n and q[j]:
                j += 1
            if (j - i) / SR * 1000 >= min_ms:
                out.append((i / SR, j / SR))
            i = j
        else:
            i += 1
    return out
