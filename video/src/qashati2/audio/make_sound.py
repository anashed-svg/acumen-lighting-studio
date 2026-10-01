#!/usr/bin/env python3
"""Soundtrack for «مش قشطة» v2 (Qashati Alsham spot #2): 17.0 s, original synthesis, deterministic.

    nice -n 10 python3 video/src/qashati2/audio/make_sound.py
      -> video/public/qashati2/audio/mish-qashta.mp3   48 kHz stereo, 192 kbps, 17.000 s, -14 LUFS, <= -1 dBTP
      -> video/out/qashati2/mish-qashta.wav              24-bit master (deliver.sh muxes this one)
      -> video/out/qashati2/v2/sound/                    stems, cue table, verify report, overview/zoom plots,
                                                         preview-half.mp4 (the latest half-res render + this mix)

TIMING IS NOT COPIED: spec.ts (T), phone/timeline.ts (P) and endcard/layout.ts (E) are evaluated with esbuild +
node at run time, and the spoon sub-beats are read from motion/qashati/cup3d.py (SPOON_KEYS' T_SEP/T_BREAK and the
crater window). Move a cue in spec.ts and the sound follows on the next run.

Everything is synthesized here from sines, seeded noise, Karplus-Strong strings and modal resonators: no samples,
no borrowed melodies. Story (see ../SPEC.md and ../spec.ts):
  ACT 1  0-4.8    "not qashta": the hook stamp lands on frame 2 and starts a pizzicato/reed/clock ostinato in 6/8
                  that steps up a semitone and a tempo notch at every stamp (128 -> 94 -> 78 -> 67 ms pulses), horns,
                  the screen-lock click, the boss's ding, the family badge exploding, then a machine-gun burst of
                  five rising thuds (the band hits each one, a semitone higher) ... HARD CUT at 4.800 s.
  silence 4.8-5.27 digital zero (the comic "record stop"), until the order ping at T.notification.
  ACT 2  5.27-9.33 ping, SONIC LOGO «تشك-تشك» (the Damascene liquorice seller's brass cups + a tuned D/A bloom),
                  two big drops on the glass, the camera push, the hero «مش» smear (a slow creamy slide), its bell,
                  the whip back out, seven rising domino chimes into the all-«قشطة» "ta-da" + a second bounce, a held
                  music-box shimmer, then the flood + oud tremolo + darbuka roll into the drop.
  ACT 3  9.33-17  120 BPM D-major/mixolydian Levantine pop from T.cupShot: oud-like KS lead, maqsum darbuka,
                  claps, round bass, qanun offbeats; slumping cream splats, the title stamp as a band hit, a hushed
                  bar for the spoon-scoop ASMR (the spoon glides in, squelch, suction, stretch, snap), a fill into the
                  end card, a logo break where the sonic logo's two clacks ARE the two logo dots, the CTA stamp as the
                  pickup into a last groove phrase, small dry «تشك-تشك» echoes on the living logo's dot hops (beat 12
                  and the button), a stop-time BUTTON on the beat (T.end - 20) and a ringing, twinkling tail that
                  fades to digital zero exactly at 17.000 s. The creamy foley (smear, scoop) uses an aperiodic
                  "curd" source, never a low pitched buzz (which reads as a raspberry).
Mix for phone speakers (kept from v1): bass harmonics sustain, darbuka membrane modes/claps/taks carry the groove
above 300 Hz, the drum bus clips its sub + transient peaks, key SFX duck the music by their own envelope.
Every cue has its own seed (moving one changes only that one); the sonic logo has a fixed seed (same brand sound).
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Pedalboard, Reverb
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, istft, lfilter, resample_poly, sosfilt, sosfiltfilt, stft

REPO = Path(__file__).resolve().parents[4]
VIDEO = REPO / "video"
MP3 = VIDEO / "public/qashati2/audio/mish-qashta.mp3"
WAV = VIDEO / "out/qashati2/mish-qashta.wav"
OUT = VIDEO / "out/qashati2/v2/sound"
CUP3D = REPO / "motion/qashati/cup3d.py"
# latest half-res assembly render (optional, for eyes + ears): the newest of the known preview renders
PREVIEW_VIDEO = max((p for p in (VIDEO / "out/qashati2/v2/endcard/mish-qashta-half.mp4",
                                 VIDEO / "out/qashati2/v2/sound/check/now2-half.mp4") if p.exists()),
                    key=lambda p: p.stat().st_mtime, default=VIDEO / "out/qashati2/v2/endcard/mish-qashta-half.mp4")
SR, SEED = 48000, 1402
TARGET_LUFS, TP_MAX = -14.0, -1.0


# =============================== timeline: evaluated from the TypeScript sources ===============================
def _ts_eval(src):
    esb = subprocess.run([str(VIDEO / "node_modules/.bin/esbuild"), "--bundle", "--platform=node", "--format=cjs",
                          "--loader=ts", "--sourcefile=sound-timeline.ts", "--log-level=error"],
                         input=src, cwd=VIDEO, capture_output=True, text=True)
    if esb.returncode:
        raise RuntimeError(esb.stderr)
    run = subprocess.run(["node"], input=esb.stdout, cwd=VIDEO, capture_output=True, text=True)
    if run.returncode:
        raise RuntimeError(run.stderr)
    return json.loads(run.stdout)


def load_timeline():
    base = ("import {T, FPS, DURATION} from './src/qashati2/spec';\n"
            "import {P} from './src/qashati2/phone/timeline';\n")
    try:
        return _ts_eval(base + "import {E} from './src/qashati2/endcard/layout';\n"
                               "console.log(JSON.stringify({T, FPS, DURATION, P, E}));")
    except RuntimeError:  # the end-card layout is optional: its beats are offsets from T anyway (mirrored below)
        d = _ts_eval(base + "console.log(JSON.stringify({T, FPS, DURATION, P}));")
        T_ = d["T"]
        d["E"] = dict(morph={"from": T_["endCard"] - 4, "to": T_["endCard"] + 12}, ctaGlint=[T_["cta"] + 34, T_["cta"] + 62],
                      dotHops=[T_["end"] - 50, T_["end"] - 20], dotGap=T_["logoDots"][1] - T_["logoDots"][0])
        return d


def load_spoon(sp0):
    """Spoon sub-beats (global frames) from cup3d.py, which owns the animation (offsets from T.spoon[0])."""
    d = dict(contact=11.0, dig_end=26.0, sep=25.0, thread=28.0, brk=39.0)
    try:
        txt = CUP3D.read_text()
        for k, name in (("sep", "T_SEP"), ("thread", "T_THREAD"), ("brk", "T_BREAK")):
            m = re.search(rf"^{name}\s*=\s*SP0\s*\+\s*([\d.]+)\s*\*\s*F", txt, re.M)
            if m:
                d[k] = float(m.group(1))
        m = re.search(r"def crater_g.*?sstep\(SP0\s*\+\s*([\d.]+)\s*\*\s*F,\s*SP0\s*\+\s*([\d.]+)\s*\*\s*F", txt, re.S)
        if m:
            d["contact"], d["dig_end"] = float(m.group(1)), float(m.group(2))
    except OSError:
        pass
    return {k: sp0 + v for k, v in d.items()}


TL = load_timeline()
T, P, E, FPS = TL["T"], TL["P"], TL["E"], TL["FPS"]
DUR = TL["DURATION"] / FPS                              # 17.0
N = int(round(SR * DUR))


def fr(f):  # spec frame -> seconds
    return f / FPS


# =============================== CUE ANCHORS (seconds) ===============================
SCREENS = [fr(s["start"]) for s in T["screens"]]        # 0 1.333 2.467 3.467
STAMPS = [fr(s["stamp"]) for s in T["screens"]]         # 0.067 1.600 2.733 3.667 (stamp 0 = the hook)
BURST = [fr(f) for f in T["burst"]]                     # 4.267 .. 4.667, every 100 ms
ACT1_END = fr(T["act1End"])                             # 4.800 HARD CUT -> digital zero
NOTIFICATION, CYMBAL = fr(T["notification"]), fr(T["cymbal"])  # 5.267 ping, 5.333 sonic logo
DROP_LAND = [fr(f) for f in T["dropLand"]]              # 5.533 5.733
ERASE = [fr(f) for f in T["erase"]]                     # 5.933 (hero) .. 7.767
HOLD, FLOOD, CUP_SHOT = fr(T["holdQashta"]), fr(T["flood"]), fr(T["cupShot"])  # 7.867 8.733 9.333 (the drop)
CUP_DROPS = [fr(f) for f in T["cupDrops"]]              # 10.133 10.433
TITLE = fr(T["title"])                                  # 10.733
SPOON = {k: fr(v) for k, v in load_spoon(T["spoon"][0]).items()}
SPOON_END = fr(T["spoon"][1])
END_CARD = fr(T["endCard"])                             # 13.333
LOGO_DOTS = [fr(f) for f in T["logoDots"]]              # 13.667 13.867
SONIC_LOGO = fr(T["sonicLogo"])                         # = LOGO_DOTS[0]
CTA, COMMENT = fr(T["cta"]), fr(T["commentPrompt"])     # 14.267 14.733
# The comment bubble is a spring from T.commentPrompt (endcard/Cta.tsx): opacity 0 / 0.20 / 0.62 / 1 on +0..+3 f,
# so its pop sits one frame later (it would lead the first visible frame by 33-67 ms on T.commentPrompt itself).
POP = fr(T["commentPrompt"] + 1)                        # 14.767
SPOON_IN = fr(T["spoon"][0] + 3)                        # 11.433: the spoon slides in at the right edge (cup-shot 343-344)
ECHO = [fr(f) for f in E["dotHops"]]                    # 15.333 16.333: the living logo's dot hops (= beat 12, BUTTON)
ECHO_GAP = E["dotGap"] / FPS                            # 0.2 s, the dots' (and the sonic logo's) gap
# Picture micro-beats (phone/glass/Stamp.tsx): a stamp's ink flips red -> white flash -> turquoise and starts its
# happy bounce at erase + fl0 + 0.5 frames, fl0 = 14 for the hero, 4.5 for the others. The win sounds sit there
# (the bell must ring when the stamp turns, not when the cream touches it).
HERO_WIN = ERASE[0] + 15 / FPS                          # 6.433
FLIP = 4 / FPS                                          # domino chime = erase + 4 f (bounce starts at +5)
BEAT = 60 / 120                                         # ACT 3 grid: 120 BPM from CUP_SHOT
S16 = BEAT / 4
BREATH = .1  # the gasp before the drop: everything sustained is out 100 ms before T.cupShot (the screen is all cream)


def bt(b):  # beat (from the drop) -> seconds
    return CUP_SHOT + b * BEAT


def bof(t):  # seconds -> beat
    return (t - CUP_SHOT) / BEAT


B_TITLE = bof(TITLE)                                    # 2.8: the title stamp (pushed, off the 16th grid by 25 ms)
B_SPOON = bof(fr(T["spoon"][0])), bof(SPOON_END)        # 4 .. 7: hushed bar
B_CARD = bof(END_CARD)                                  # 8: the end card's downbeat
B_GROOVE2 = 10                                          # the groove returns (the CTA stamp is its pickup)
BUTTON = bt(round(bof(fr(T["end"] - 20))))              # 16.333: the button, on the beat 20 frames before the end
B_BUTTON = bof(BUTTON)                                  # 14
FADE = (DUR - .38, DUR)                                 # the tail rings, then cos^2 to digital zero AT 17.000 s
assert abs(bof(END_CARD) - round(bof(END_CARD))) < 1e-6, "end card expected on a beat of the 120 BPM grid"


# =============================== small DSP kit ===============================
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


# =============================== SFX voices: f(rng, **p) -> (audio, lead seconds before the cue) =========
# ---------------------------------------------------------------- ACT 1
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


def hook_stamp(rng, **p):  # stamp 0: THE hook (mid-slam on frame 0, lands on frame 2), biggest of all
    out, lead = stamp(rng, hook=True, pan=0.0, **p)
    return lowshelf(peq(out, 1000, 4, .7), 120, -2), lead  # voiced for phone speakers: weight in the mids


def burst_stamp(rng, **p):  # the machine-gun pile-up: smaller stamps, rising thuds, no sticky lift
    return stamp(rng, lift=0, air=.5, **p)


def title_stamp(rng, **p):  # «خلّيها قشطة.»: the last and biggest stamp (callback to the hook)
    out, lead = stamp(rng, hook=True, pan=0.0, **p)
    return lowshelf(peq(out, 950, 7, .6), 120, -5), lead  # the band hit carries the lows; the stamp owns the mids


def cta_stamp(rng, **p):  # the CTA stamp-button: a lighter, brighter thud
    return stamp(rng, lift=.5, air=.7, pan=0.0, **p)


def desk_rattle(rng):  # the hook slams the phone into the desk: it bounces and clatters twice, settling
    out = np.zeros((int(.5 * SR), 2))
    t = tt(.12)
    for k, (o, v) in enumerate(((.05, 1.0), (.1, .6), (.135, .35), (.158, .2))):
        clack = sum(a * np.sin(2 * np.pi * f * rng.uniform(.95, 1.05) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                    for f, a, d in [(185, .8, .03), (930, 1, .014), (1520, .7, .01), (2350, .45, .007), (3700, .25, .004)])
        tk = norm(filt(noise(rng, len(t)), "bandpass", [1500, 6000])) * env(t, .0002, .0012)
        place(out, (.8 * clack + .35 * tk) * np.minimum(t / .0005, 1), o, (-.12, .12)[k % 2], v)
    return out, 0.0


def ink_spat(rng):  # the hook's ink specks and blots fly and land: tiny wet ticks
    out = np.zeros((int(.4 * SR), 2))
    t = tt(.03)
    for o in np.sort(rng.uniform(.02, .16, 9)):
        s = norm(filt(noise(rng, len(t)), "bandpass", [rng.uniform(1300, 2200), rng.uniform(3500, 6000)])) * env(t, .0004, .003)
        place(out, s, o, rng.uniform(-.7, .7), rng.uniform(.3, 1))
    return out, 0.0


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


def swish(rng, dur=.3, f0=900, f1=3600, peak=.4, pan=(-.5, .5)):  # soft UI swish; cue = gesture start
    t = tt(dur)
    s = .8 * swept(rng, dur, f0, f1, .55) + .35 * norm(filt(noise(rng, len(t)), "lowpass", 900))
    return pan2(s * swell(t, dur, peak, a=.02), np.linspace(*pan, len(t))), 0.0


def tap(rng):  # fingertip on glass: a soft, dull tick (the thumb-tap ripple)
    t = tt(.06)
    s = norm(filt(noise(rng, len(t)), "bandpass", [700, 3200])) * env(t, .0004, .004)
    s += .5 * np.sin(2 * np.pi * rng.uniform(900, 1100) * t) * env(t, .0005, .008)
    return pan2(s, rng.uniform(-.1, .1)), 0.0


def lock_click(rng):  # side button, the screen goes off: a short plastic double click (generic)
    t = tt(.12)
    c = sum(a * env(np.maximum(t - o, 0), .0002, .0025) * (t >= o) for o, a in ((0, 1), (.011, .55)))
    click = norm(filt(noise(rng, len(t)), "bandpass", [1800, 6000])) * c
    bod = np.sin(2 * np.pi * 520 * t) * env(t, .0005, .012) + .5 * np.sin(2 * np.pi * 1340 * t) * env(t, .0005, .006)
    return pan2(.8 * click + .45 * bod, .1), 0.0


def horn(rng, f=415.0, beeps=((0, .11), (.17, .11)), interval=1.19, far=.5, pan=0.0):
    """Two-disc car horn (buzzy diaphragm tone, nasal formant), heard from a few cars away."""
    total = max(a + b for a, b in beeps) + .05
    t = tt(total)
    s = 0
    for ff in (f, f * interval):
        ph = 2 * np.pi * np.cumsum(ff * (1 + .004 * smooth_rand(rng, len(t), 12))) / SR
        s = s + sum(np.sin(k * ph + rng.uniform(0, 6)) / k ** .8 for k in range(1, 12) if ff * k < 3500)
    e = sum(np.clip(np.minimum((t - a) / .008, (a + b - t) / .025), 0, 1) for a, b in beeps)
    s = peq(filt(s * e, "bandpass", [300, 2600]), 1700, 5, 1.2)
    s = norm(filt(s, "lowpass", 3200 - 1600 * far))
    wet = reverb(pan2(s, pan), room_size=.75, damping=.6, wet_level=.35 + .3 * far, dry_level=1 - .5 * far, width=.9)
    return wet, 0.0


def msg_ding(rng):  # the boss's message wakes the phone: a clean, slightly "corporate" bell ding
    s = mallet(midi("E6"), [(1, 1, 1), (2.76, .35, .3), (5.4, .12, .12)], d=.35, length=1.2, attack=.001)
    return pan2(s, .12), 0.0


def blip(rng, f, two=False, muffle=False):  # group-chat message blip
    t = tt(.16)
    f1 = f * (1 - .32 * np.exp(-t / .006))
    s = osc(f1) * env(t, .0008, .032) + .22 * osc(2 * f1) * env(t, .0008, .012)
    if two:
        t2 = np.maximum(t - .045, 0)
        s += .7 * osc(1.26 * f * (1 - .2 * np.exp(-t2 / .005))) * env(t2, .0008, .03) * (t > .045)
    return (filt(s, "lowpass", 1800) * 1.6 if muffle else s), 0.0


PERSON_HZ = dict(mama=hz("E6"), leen=hz("G6"), reem=hz("F6"), sami=hz("D6"), jiddo=hz("B5"), baba=hz("C#6"))
PERSON_PAN = dict(mama=-.3, leen=.35, reem=-.5, sami=.2, jiddo=-.1, baba=.5)


def buzz(rng, dur=.16):  # phone vibrating on a desk
    t = tt(dur)
    ph = 2 * np.pi * np.cumsum(172 * (1 + .02 * smooth_rand(rng, len(t), 30))) / SR
    s = sum(np.sin(k * ph) / k for k in (1, 2, 3, 5, 7, 9))
    rattle = 1 + .6 * np.clip(smooth_rand(rng, len(t), 90), 0, 1)
    e = np.clip(np.minimum(t / .012, (dur - t) / .02), 0, 1)
    return pan2(norm(filt(s * rattle * e, "bandpass", [140, 2500])), rng.uniform(-.2, .2)), 0.0


def tick(rng, hi):
    t = tt(.06)
    f = 2150 if hi else 1480
    s = np.sin(2 * np.pi * f * t) * env(t, .0003, .011) + .4 * np.sin(2 * np.pi * f * 2.71 * t) * env(t, .0003, .005)
    return s + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0002, .0015)


def fam_notif(rng, dur):
    """Lock screen, 23:04 -> 23:31: the family group's notification lands and its unread count rolls 12 -> 37
    (LockScreen.tsx, P.famNotif .. P.famTap - 1): the group ping, then a rapid run of rising pings + a buzz."""
    out = np.zeros((int((dur + .5) * SR), 2))
    place(out, blip(rng, PERSON_HZ["mama"], two=True)[0], 0, -.1, 1.0)
    n = 11
    for k in range(n):
        u = k / (n - 1)
        place(out, blip(rng, hz("E6") * 2 ** (u * 4 / 12), muffle=k % 3 == 2)[0], .07 + (dur - .05) * u ** .8,
              rng.uniform(-.45, .45), .42 + .25 * u)
    place(out, buzz(rng, .14)[0], .015, 0, .5)
    return out, 0.0


def clock_roll(rng, dur, n=9):  # the lock-screen clock rolls 23:04 -> 23:31 (eased): ticks, densest mid-roll
    out = np.zeros((int((dur + .1) * SR), 2))
    u = np.linspace(0, 1, 2001)
    ease = np.where(u < .5, 2 * u * u, 1 - (-2 * u + 2) ** 2 / 2)  # Easing.inOut(quad)
    for k in range(1, n + 1):
        place(out, pan2(tick(rng, k % 2 == 0), .25), dur * np.interp(k / (n + 1), ease, u), 0, .55)
    return out, 0.0


def chat_chaos(rng):
    """The family group explodes (P.chaos .. T.act1End): one blip per message counted on the chat's 'new messages'
    badge (Chats.tsx: incoming = round(1 + 23 t^2) across the chaos window), one pitch per family member, stress
    rising a few semitones; plus the phone buzzing on the desk. Frozen dead at the cut."""
    f0, f1 = P["chaos"]["from"], T["act1End"]
    t0 = fr(f0)
    out = np.zeros((int((ACT1_END - t0 + .3) * SR), 2))
    prev, hits = 0, []
    for f in range(f0, f1):
        c = int(np.floor(1 + 23 * ((f - f0) / (f1 - f0)) ** 2 + .5))  # JS Math.round
        for j in range(c - prev):
            hits.append(fr(f) + (j / max(1, c - prev)) / FPS * .8 + rng.uniform(0, .004))
        prev = c
    who = list(PERSON_HZ)
    for k, th in enumerate(hits):
        if any(-.02 < th - s < .045 for s in BURST + STAMPS):
            continue  # a stamp thud owns this instant
        w = who[int(rng.integers(len(who)))]
        rise = 2 ** (3.0 * (th - t0) / (ACT1_END - t0) / 12)
        place(out, blip(rng, PERSON_HZ[w] * rise, two=rng.random() < .35)[0], th - t0, PERSON_PAN[w],
              .55 + .45 * (th - t0) / (ACT1_END - t0))
    for fb, d in ((f0 + 3, .15), (f0 + 13, .14), (f0 + 22, .13), (f0 + 28, .12)):
        place(out, buzz(rng, d)[0], fr(fb) - t0, 0, .5)
    return out, 0.0


# ---------------------------------------------------------------- ACT 2
def order_ping(rng):  # the order-arrived banner: round, friendly glass "pling" on A5 (-> the cymbals land on D).
    # Short and a little under the brass, so the brand sound — not the phone ping — is what the ear keeps.
    t = tt(1.0)
    f = hz("A5") * (1 - .05 * np.exp(-t / .008))
    s = osc(f) * env(t, .002, .20) + .28 * osc(2 * f) * env(t, .002, .10) + .1 * osc(3 * f) * env(t, .002, .05)
    s += .10 * np.sin(2 * np.pi * hz("E7") * t) * env(t, .001, .04)
    return pan2(s, 0.0), 0.0


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


def push_air(rng, dur):  # the camera pushes in on stamp 0: a low, soft air swell (felt more than heard)
    t = tt(dur)
    s = .8 * swept(rng, dur, 220, 900, .7) + .35 * norm(filt(noise(rng, len(t)), "lowpass", 350))
    return pan2(s * swell(t, dur, .7, a=.04, r=.06), 0), 0.0


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


def smear(rng, dur):
    """THE hero erase (P.smear, 18 frames): the merged bead breaks free and slides down through «مش», dragging the
    red ink with it. A slow, thick, creamy slide: a viscous body gliding down, a wet squelch formant that wobbles
    as the bead wobbles, a soft rubbery squeak of ink smearing on glass, and the melt's little drip pops."""
    t = tt(dur)
    x = t / dur
    wob = smooth_rand(rng, len(t), 7)
    glide_ = swept(rng, dur, 950, 360, .45, shape=lambda u: u + .05 * np.sin(11 * u))
    sq = norm(tv_band(curd(rng, len(t), 360), 620 * 2 ** (-.7 * x + .3 * wob), .36))
    sq2 = norm(tv_band(noise(rng, len(t)), 1700 * 2 ** (-.5 * x + .2 * wob), .25))
    squeak = osc(820 * 2 ** (-.55 * x + .04 * smooth_rand(rng, len(t), 11))) * np.clip(np.sin(np.pi * np.clip((x - .12) / .62, 0, 1)), 0, 1) ** 2
    e = np.clip(t / .06, 0, 1) * (.55 + .45 * np.sin(np.pi * np.clip(x / 1.1, 0, 1))) * np.clip((dur - t) / .12, 0, 1)
    s = (.7 * glide_ + .9 * sq + .25 * sq2) * (1 + .25 * wob) * e + .09 * squeak * e
    out = pan2(s, .05 * wob)
    for tb in np.sort(rng.uniform(.33 * dur, .8 * dur, 5)):  # the «مش» drips (Stamp.tsx: drips grow 184-192)
        tt_ = tt(.05)
        b = osc(rng.uniform(520, 760) * 2 ** (.7 * tt_ / .05)) * env(tt_, .002, .012)
        place(out, b, tb, rng.uniform(-.3, .3), rng.uniform(.18, .3))
    return out, 0.0


def win_hero(rng):
    """Stamp 0 turns turquoise «قشطة» (the bounce starts at erase[0] + 14.5 f): the big win. A warm G bell with
    its octave and fifth, a rubbery bounce pop, a quick rising glock sparkle and a little riq shake."""
    out = np.zeros((int(2.2 * SR), 2))
    m = midi("G5")
    place(out, mallet(m, BELL, d=.9, length=2.0) + .35 * mallet(m + 12, GLOCK, d=.6, length=2.0)
          + .18 * mallet(m + 7, GLOCK, d=.5, length=2.0), 0, 0, 1.0)
    t = tt(.25)
    pop = osc(330 * 2 ** (1.0 * np.minimum(t / .05, 1))) * env(t, .002, .04)
    place(out, pop, 0, 0, .5)
    for j, n in enumerate(("D6", "G6", "B6", "D7")):
        place(out, mallet(midi(n), [(1, 1, 1)], d=.1, length=.4), .05 + .045 * j, (-.5, .5, -.25, .25)[j], .22)
    place(out, pan2(jingles(rng, [0, .03, .06], .5), .2), 0)
    return out, 0.0


def whip(rng, dur):  # whip back out (P.whip, Easing.inOut(poly5): fastest mid-gesture) — airy, with a low whomp
    s, _ = swish(rng, dur + .08, 600, 5200, .5, (.6, -.6))
    t = tt(dur + .08)
    whomp = osc(110 * 2 ** (-.8 * t / dur)) * swell(t, dur + .08, .45, a=.02)
    return s + pan2(.12 * filt(whomp, "highpass", 70), 0), 0.0


def glide(rng, dur):  # the bead running on down the glass: wet, slow, squeaky-soft, with micro-bubbles
    t = tt(dur)
    w = smooth_rand(rng, len(t), 7)
    body_ = swept(rng, dur, 1700, 800, .45, shape=lambda x: x + .08 * np.sin(9 * x))
    sq_f = 2100 * 2 ** (-.45 * t / dur + .04 * w)
    squeak = osc(sq_f) * (.5 + .5 * np.clip(smooth_rand(rng, len(t), 5), 0, 1)) * .25
    s = (body_ * (.7 + .3 * w) + squeak) * np.clip(np.minimum(t / .25, (dur - t) / .35), 0, 1)
    out = pan2(s, np.linspace(-.2, .35, len(t)))
    for tb in np.sort(rng.uniform(.1, dur - .2, 8)):
        place(out, blip(rng, rng.uniform(1500, 2800))[0] * .5, tb, rng.uniform(-.4, .4), rng.uniform(.3, .6))
    return out, 0.0


def chime(rng, note, pan=0.0):  # domino: «مش» is gone and the stamp flips turquoise — a clean little bell
    m = midi(note)
    s = mallet(m, GLOCK, d=.42, length=1.1) + .22 * mallet(m + 12, GLOCK, d=.22, length=1.1)
    t = tt(1.1)
    wet = norm(filt(noise(rng, len(t)), "bandpass", [1500, 5000])) * env(t, .0003, .003)  # cream tick on the glass
    return pan2(s + .22 * wet, pan), 0.0


def tada(rng, top="D7"):
    """All «قشطة» (T.holdQashta): the happy synced bounce. A G-major bell chord topped by the next step of the
    domino run (it lands on the 3-frame grid of the burst chimes), a rubbery bounce pop, a riq shake, a soft dum."""
    out = np.zeros((int(2.2 * SR), 2))
    for k, (n, pn, v) in enumerate([("G5", -.25, .7), ("B5", .25, .6), ("D6", -.1, .7), ("G6", .1, .55), (top, 0, .6)]):
        place(out, mallet(midi(n), BELL, d=.8, length=1.9), .01 * k, pn, v)
    t = tt(.3)
    pop = osc(260 * 2 ** (1.1 * np.minimum(t / .06, 1))) * env(t, .002, .05)
    place(out, pop, 0, 0, .6)
    place(out, pan2(jingles(rng, [0, .025, .05, .075], .8), -.15), 0)
    place(out, pan2(darbuka(rng, "D", .5), 0), 0, 0, .5)
    return out, 0.0


def bounce(rng):  # the hold's second synced bounce: a smaller pop + a riq flick
    out = np.zeros((int(1.0 * SR), 2))
    t = tt(.3)
    place(out, osc(330 * 2 ** (.9 * np.minimum(t / .05, 1))) * env(t, .002, .04), 0, 0, .55)
    place(out, pan2(jingles(rng, [0, .03], .5), .2), 0)
    place(out, pan2(mallet(midi("B6"), GLOCK, d=.3, length=.9), .3), 0, 0, .35)
    return out, 0.0


def flood(rng, dur):
    """Cream floods the screen: a thick, gurgly whoosh that is audible from the first drip and keeps rising to the
    drop, then sucks out BREATH before it (the gasp before the downbeat, while the screen is all cream)."""
    t = tt(dur)
    x = t / dur
    sw = np.stack([swept(rng, dur, 260, 2400, .9, shape=lambda u: u ** 1.3) for _ in range(2)], 1)
    low = np.stack([norm(filt(noise(rng, len(t)), "bandpass", [150, 700])) for _ in range(2)], 1)
    gurgle = 1 + .35 * smooth_rand(rng, len(t), 14)
    glug = np.zeros(len(t))  # thick bubbles popping in the cream, faster as it rises
    tb = .06
    while tb < dur - .1:
        u = tb / dur
        g = osc(np.full(int(.06 * SR), rng.uniform(260, 420) * (1 + .6 * u))) * env(tt(.06), .002, .014)
        i = int(tb * SR)
        glug[i:i + len(g)] += g[:len(glug) - i] * (.4 + .6 * u)
        tb += rng.uniform(.8, 1.2) * (.11 - .06 * u)
    e = (.3 + .7 * x ** 1.2) * np.clip((dur - BREATH - t) / .02, 0, 1) * np.minimum(t / .06, 1)
    return (.75 * sw + .45 * low + .25 * glug[:, None]) * (gurgle * e)[:, None], 0.0


def slide_off(rng, dur=.5):  # CreamReveal: the cream sheet slides off the glass, downwards, under the drop
    t = tt(dur)
    s = swept(rng, dur, 1500, 300, .7) * swell(t, dur, .3, a=.02)
    return pan2(s, np.linspace(.1, -.1, len(t))), 0.0


# ---------------------------------------------------------------- ACT 3
def jingles(rng, times, level=1.0):  # riq zills: inharmonic brass partials, kept below 8 kHz for phone speakers
    t = tt(max(times) + .3)
    parts = [(rng.uniform(2600, 7200), rng.uniform(.03, .09)) for _ in range(10)]
    s = np.zeros(len(t))
    for i, tc in enumerate(times):
        tt_ = np.maximum(t - tc, 0)
        s += (1 - .25 * min(i, 3)) * sum(np.sin(2 * np.pi * f * tt_ + rng.uniform(0, 6)) * np.exp(-tt_ / d) for f, d in parts) * (t >= tc)
    return filt(s / 4, "lowpass", 8000) * level


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


def spoon_in(rng, dur, glint_at=.1):
    """The steel teaspoon glides in from the right edge (cup3d SPOON_KEYS: fastest off-screen, easing into the
    cream at the contact frame). In picture it touches nothing before the cream, so no strike/tink: a soft air
    swish travelling right -> centre, and the spoon catching the light — its steel modes swelling in with a soft
    10 ms attack (a glint, not a collision)."""
    t = tt(dur)
    air = swept(rng, dur, 1400, 3800, .55) * swell(t, dur, .35, a=.02, r=.06)
    out = pan2(air, np.linspace(.7, .25, len(t)))
    t2 = tt(.7)
    s = sum(a * np.sin(2 * np.pi * f * rng.uniform(.99, 1.01) * t2 + rng.uniform(0, 6)) * np.exp(-t2 / d)
            for f, a, d in [(2480, 1, .16), (3920, .55, .09), (5960, .25, .045)])
    place(out, filt(s * np.minimum(t2 / .010, 1), "lowpass", 7500), glint_at, .45, .3)
    return out, 0.0


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


def cta_chime(rng):  # the CTA stamp's "turquoise" side: a light D-major bell flick over the thud
    out = np.zeros((int(1.6 * SR), 2))
    for k, (n, pan, v) in enumerate([("D6", -.2, .8), ("F#6", .2, .7), ("A6", 0, .6)]):
        place(out, mallet(midi(n), BELL, d=.5, length=1.5), .03 * k, pan, v)
    return out, 0.0


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


# =============================== CUE LIST: (time s, kind, params, role) ===============================
# role key: must sit >= 3 dB over the local music and ducks it by DUCK_DB; bg: background texture by design.
def _p(path):  # P["a"]["b"] in seconds
    v = P
    for k in path.split("."):
        v = v[k]
    return fr(v)


DOMINO = ["A5", "B5", "D6", "E6", "G6", "A6", "B6", "D7"]  # G-major pentatonic, rising; the 8th tops the "ta-da"
SFX_CUES = [
    # ---- ACT 1
    (STAMPS[0], "hook_stamp", dict(weight=1.25), "key"),  # THE HOOK (mid-slam on frame 0)
    (STAMPS[0], "desk_rattle", {}, "key"),
    (STAMPS[0] + .01, "ink_spat", {}, "bg"),
    (STAMPS[0] + .2, "sizzle", dict(dur=_p("swipe.from") + .1 - STAMPS[0] - .2), "bg"),
    *[(STAMPS[i], "stamp", dict(weight=w, gain=g), "key") for i, w, g in ((1, .9, 1.0), (2, .97, 1.05), (3, 1.05, 1.3))],
    *[(BURST[k], "burst_stamp", dict(weight=.68 + .06 * k, pitch=1.06 * 2 ** (2 * k / 12), pan=(-.25, .25, -.12, .12, 0)[k],
                                     gain=1 + .07 * k), "key") for k in range(5)],
    (_p("swipe.touch"), "tap", {}, "bg"),
    (_p("swipe.from"), "swish", dict(dur=_p("swipe.to") - _p("swipe.from") + .06, pan=(-.6, .6), gain=1.25), "key"),
    (SCREENS[1] + .08, "horn", dict(f=415, beeps=((0, .11), (.17, .11)), far=.4, pan=-.35), "bg"),
    (SCREENS[1] + .34, "horn", dict(f=349, beeps=((0, .32),), interval=1.26, far=.7, pan=.4), "bg"),
    (SCREENS[1] + .62, "horn", dict(f=466, beeps=((0, .12),), far=.85, pan=-.1), "bg"),
    (_p("screenOff"), "lock_click", {}, "key"),
    (_p("bossNotif"), "msg_ding", {}, "key"),
    (_p("famNotif"), "fam_notif", dict(dur=_p("famTap") - _p("famNotif") - 1 / FPS), "key"),
    (_p("clockRoll.from"), "clock_roll", dict(dur=_p("clockRoll.to") - _p("clockRoll.from")), "bg"),
    (_p("famTap"), "tap", {}, "bg"),
    (_p("openFam.from"), "swish", dict(dur=_p("openFam.to") - _p("openFam.from") + .06, pan=(.6, -.6), gain=1.5), "key"),
    (_p("famScroll.touch"), "tap", {}, "bg"),
    (_p("famScroll.from"), "swish", dict(dur=_p("famScroll.to") - _p("famScroll.from"), f0=1300, f1=3000, peak=.25,
                                         pan=(.2, -.2), gain=.7), "bg"),
    (_p("chaos.from"), "chat_chaos", {}, "key"),
    # ---- the silence: nothing between ACT1_END and NOTIFICATION
    # ---- ACT 2
    (NOTIFICATION, "order_ping", {}, "key"),
    (CYMBAL, "sonic_logo", dict(gain=1.2), "key"),
    (_p("banner.out"), "swish", dict(dur=.25, f0=1500, f1=4200, peak=.5, pan=(0, 0), gain=.45), "bg"),
    (DROP_LAND[0], "plink", dict(note="A5", pan=-.2, big=True), "key"),
    (DROP_LAND[1], "plink", dict(note="D6", pan=.2, big=True), "key"),
    (_p("push.from"), "push_air", dict(dur=_p("push.to") - _p("push.from") + .12), "bg"),
    (DROP_LAND[1] + 3.5 / FPS, "bloop", {}, "bg"),  # the two dots merge into one bead (layout.ts beadKeys)
    (ERASE[0], "smear", dict(dur=_p("smear.to") - _p("smear.from")), "key"),
    (HERO_WIN, "win_hero", {}, "key"),
    (_p("whip.from"), "whip", dict(dur=_p("whip.to") - _p("whip.from")), "key"),
    (_p("whip.to"), "glide", dict(dur=fr(T["erase"][3] + 22) - _p("whip.to")), "bg"),
    *[(ERASE[i] + FLIP, "chime", dict(note=DOMINO[i - 1], pan=(-.35, .35)[i % 2] * (1 - .08 * i)), "key") for i in range(1, 8)],
    (HOLD, "tada", dict(top=DOMINO[7]), "key"),
    (fr(P["holdBounce"][1]), "bounce", {}, "key"),
    (FLOOD, "flood", dict(dur=CUP_SHOT - FLOOD), "key"),
    # ---- ACT 3
    (CUP_SHOT, "slide_off", {}, "bg"),
    (CUP_DROPS[0], "splat", dict(note="A4", pan=-.15), "key"),
    (CUP_DROPS[1], "splat", dict(note="D5", pan=.15), "key"),
    (TITLE, "title_stamp", dict(weight=1.3, pitch=.92), "key"),  # «خلّيها قشطة.»
    (SPOON_IN, "spoon_in", dict(dur=SPOON["contact"] - SPOON_IN, glint_at=2.5 / FPS), "key"),
    (SPOON["contact"], "scoop", dict(dur=SPOON["sep"] - SPOON["contact"] + .06), "key"),
    (SPOON["sep"], "suction", {}, "key"),
    (SPOON["sep"] + 1 / FPS, "stretch", dict(dur=SPOON["brk"] - SPOON["sep"] - 1 / FPS), "key"),
    (SPOON["brk"], "snap", {}, "key"),
    (fr(T["endCard"] + 2), "swish_big", dict(dur=.55), "key"),  # into the card's downbeat + the pull-back (396-412)
    (SONIC_LOGO, "sonic_logo", dict(gap=LOGO_DOTS[1] - LOGO_DOTS[0], ring_v=1.3, gain=1.4), "key"),  # clacks = dots
    (LOGO_DOTS[0], "plink", dict(note="A5", pan=-.15, gain=.45), "bg"),
    (LOGO_DOTS[1], "plink", dict(note="D6", pan=.15, gain=.45), "bg"),
    (CTA, "cta_stamp", dict(weight=.72, pitch=1.15), "key"),
    (CTA + .01, "cta_chime", {}, "bg"),
    (POP, "pop", {}, "key"),
    *[(t, "logo_echo", dict(gap=ECHO_GAP, gain=g), "bg") for t, g in zip(ECHO, (.8, .7))],  # «تشك-تشك» = the dot hops
    # CupToCard sparkles start at T.cta+20, +27, T.end-26 and swell sin(pi t/14): the glint rings near their peak (+5)
    (fr(T["cta"] + 25), "sparkle", dict(note="A6", pan=-.35), "bg"),
    (fr(T["cta"] + 32), "sparkle", dict(note="D7", pan=-.2), "bg"),
    (fr(T["end"] - 21), "sparkle", dict(note="F#6", pan=-.3), "bg"),
    (fr(E["ctaGlint"][0]), "glint", {}, "bg"),
    (fr(E["ctaGlint"][1]), "glint", dict(dur=.4), "bg"),
]
SFX_GAIN = dict(hook_stamp=.85, desk_rattle=.50, ink_spat=.25, sizzle=.38, stamp=.60, burst_stamp=.80, title_stamp=1.15, cta_stamp=.72, swish=.60, tap=.20, lock_click=.85, horn=.22, msg_ding=.22, fam_notif=.36, clock_roll=.16,
                chat_chaos=.55, order_ping=.30, sonic_logo=.68, plink=.26, push_air=.12, bloop=.20, smear=.55,
                win_hero=.24, whip=.55, glide=.13, chime=.20, tada=.16, bounce=.36, flood=.80, slide_off=.16,
                splat=.75, spoon_in=.30, scoop=.72, suction=.5, stretch=.45, snap=.6, swish_big=.70,
                cta_chime=.08, pop=.85, sparkle=.06, glint=.14, logo_echo=.68)
DUCK_DB = dict(hook_stamp=5, stamp=5, burst_stamp=7, title_stamp=5, cta_stamp=6, swish=3, lock_click=2, msg_ding=4, fam_notif=3, chat_chaos=3, order_ping=0, sonic_logo=7,
               plink=4, smear=5, win_hero=3, whip=3, chime=3, tada=2, bounce=2, flood=1, splat=3, spoon_in=3,
               scoop=6, suction=5, stretch=5, snap=4, swish_big=4, pop=4)
CUE_GAIN_OVERRIDE = {}  # (kind, index) -> gain, for quick tuning


# =============================== ACT 1 music: the nervous ostinato ===============================
def pizz(rng, m, length=.5):
    f = mhz(m)
    s = ks(rng, f, length, t60=.30 * (220 / f) ** .35, damp=.42, pos=.21, exc_lp=3200)
    t = tt(length)
    return s + .12 * norm(filt(noise(rng, len(t)), "lowpass", 500)) * env(t, .0005, .004)


def reed(m, dur):  # staccato bassoon-ish nervous bass (odd harmonics -> reads on phone speakers)
    f = mhz(m)
    t = tt(dur + .04)
    ph = 2 * np.pi * f * t
    s = sum(np.sin(k * ph) / k for k in (1, 3, 5, 7, 9, 11) if f * k < 4000) + .35 * np.sin(2 * ph)
    e = np.minimum(t / .005, 1) * np.clip((dur + .04 - t) / .04, 0, 1) * (.65 + .35 * np.exp(-t / .03))
    return filt(s * e, "lowpass", 1900)


def bowed(rng, ms, length, trem=13.0):  # thin tremolo strings (tension), saw-ish, bandlimited
    t = tt(length)
    s = 0
    for m in ms:
        f = mhz(m)
        ph = 2 * np.pi * np.cumsum(f * (1 + .004 * np.sin(2 * np.pi * 5.5 * t + rng.uniform(0, 6)))) / SR
        s = s + sum(np.sin(k * ph + rng.uniform(0, 6)) / k for k in range(1, 10) if f * k < 6000)
    return filt(s * (.55 + .45 * np.abs(np.sin(np.pi * trem * t))), "bandpass", [300, 5000])


ACT1_SEGS = [12, 12, 12, 9]  # pulses between stamps 0-1, 1-2, 2-3 and stamp 3 -> burst (128/94/78/67 ms)


def act1_pulses():
    """(time, midi, accent, seg). 6/8 cells of three; each stamp = downbeat, +1 semitone and a tempo notch.
    The burst: the band hits every thud in unison, a semitone higher each time, with an off-hit in between."""
    ev = []
    cells = {"A": (-12, 1, 0), "B": (-5, 3, 1), "L": (-2, -1, 0)}
    bounds = STAMPS + [BURST[0]]
    for s, (a, b, n) in enumerate(zip(bounds[:-1], bounds[1:], ACT1_SEGS)):
        r = 57 + s
        order = ("AB" * 5)[:n // 3 - 1] + "L"
        for i in range(n):
            ev.append((a + i * (b - a) / n, r + cells[order[i // 3]][i % 3], 1.0 if i % 3 == 0 else .62, s))
    for k, tb in enumerate(BURST):
        r = 61 + k
        ev.append((tb, r - 12, 1.0, 4))
        for o in (1.5 / FPS,):
            ev.append((tb + o, r, .62, 4))
    ev.append((BURST[-1] + 3 / FPS, 66 - 12, 1.0, 4))  # one more hit at 143: the peak, then the cut
    return [e for e in ev if e[0] < ACT1_END - .008]


def act1_music():
    rng = np.random.default_rng(SEED + 1)
    pz, bs, clk, ten = (np.zeros((N, 2)) for _ in range(4))
    seg_gain = [1.7, 1.05, .9, .74, .66]  # the hook segment carries the opening: it plays loudest
    for k, (t, m, acc, s) in enumerate(act1_pulses()):
        place(pz, pizz(rng, m + (12 if acc < 1 else 0)), t, (-.25, .25)[k % 2] if acc < 1 else 0, acc * seg_gain[s])
        if acc == 1.0:
            place(bs, reed(m, .09 if s < 4 else .07), t, 0, .9 * seg_gain[s] * (1.15 if s == 4 else 1))
        elif s >= 3:
            place(bs, reed(m + (-12 if m > 55 else 0), .05), t, 0, .35)
        place(clk, tick(rng, k % 2 == 0), t, .35 if k % 2 else -.35, .5 + .1 * (s >= 3))
    # tension: tremolo strings from the 2nd stamp, clusters tighten, then a rising gliss + noise riser to the cut
    # the hook stinger: the little band hits the first stamp with it — a nervous A/Bb cluster, sforzando, dying away
    d = .9
    place(ten, bowed(rng, [57, 58, 64, 69], d, trem=1e-4) * env(tt(d), .004, .25), STAMPS[0], 0, .2)
    for j, m in enumerate((45, 52, 57, 58)):
        place(pz, pizz(rng, m, .7), STAMPS[0] + .004 * j, (-.2, .2)[j % 2], .55)
    place(bs, reed(45, .28), STAMPS[0], 0, 1.0)
    tr = bowed(rng, [69, 70], STAMPS[1] - STAMPS[0] + .05, trem=10)  # the day starts nervous: thin tremolo
    place(ten, tr * np.linspace(.7, 1, len(tr)), STAMPS[0] + .25, 0, .075)
    for s, (a, b) in enumerate(zip(STAMPS[1:], STAMPS[2:] + [ACT1_END])):
        r = 58 + s
        tr = bowed(rng, [r + 12, r + 13] + ([r + 18] if s >= 1 else []), b - a + .05, trem=12 + 3 * s)
        tt_ = tt(b - a + .05)
        place(ten, tr * (.35 + .65 * tt_ / (b - a)), a, 0, .07 + .015 * s)
    d = ACT1_END - STAMPS[2]
    t = tt(d)
    f = mhz(59 + 7) * 2 ** (1.35 * (t / d) ** 1.4)
    riser = sum(np.sin(2 * np.pi * np.cumsum(f * k) / SR) / k for k in range(1, 7)) * (t / d) ** 2
    place(ten, filt(riser, "bandpass", [300, 4500]), STAMPS[2], 0, .08)
    d = ACT1_END - STAMPS[3]
    nr = swept(rng, d, 500, 4500, .5) * (tt(d) / d) ** 1.8
    place(ten, np.stack([nr, np.roll(nr, 311)], 1), STAMPS[3], 0, .1)
    bed = 1.4 * (.30 * body(pz, [(280, .02, 1.5), (460, .015, 1.0), (1000, .01, .6), (2800, .006, .8)]) + .20 * bs + .07 * clk + ten)
    return reverb(bed, room_size=.18, damping=.5, wet_level=.08, dry_level=1, width=.7)


# =============================== ACT 2 music: magic pad, the hold shimmer, the build ===============================
def pad_chord(rng, notes, length, bright=.45):
    t = tt(length)
    s = 0
    for n in notes.split():
        f = hz(n)
        for det in (-7, 0, 7):
            ff = f * 2 ** (det / 1200)
            s = s + sum(np.sin(2 * np.pi * ff * k * t + rng.uniform(0, 6)) * bright ** (k - 1) / k for k in range(1, 7) if ff * k < 5000)
    return s / len(notes.split())


def oud_line(rng, notes):
    """Monophonic oud: notes (t, midi, dur, vel, orn). A new pick damps the previous one (same course).
    orn: 'trem' risha tremolo in 32nds, 'mord' upper mordent, 'up' upper grace, 'neutral' quarter-tone Rast grace."""
    picks = []
    for t, m, d, v, orn in notes:
        if orn == "trem":
            k = int(round(d / (S16 / 2)))
            picks += [(t + i * S16 / 2 + rng.uniform(-.003, .003), m, S16 / 2, v * (1 if i % 2 == 0 else .72) * (.8 + .2 * i / k)) for i in range(k)]
        elif orn == "mord":
            picks += [(t, m, S16 / 2, v), (t + S16 / 2, m + 2, S16 / 2, .7 * v), (t + S16, m, d - S16, .85 * v)]
        elif orn in ("up", "neutral"):
            g = m + 2 if orn == "up" else m - .5
            picks += [(t - .045, g, .045, .55 * v), (t, m, d, v)]
        else:
            picks.append((t, m, d, v))
    picks.sort()
    out = np.zeros(N)
    for i, (t, m, d, v) in enumerate(picks):
        nxt = picks[i + 1][0] if i + 1 < len(picks) else t + d + 2
        length = min(max(d, .06) + .5, nxt - t + .012)
        f = mhz(m)
        s = ks(rng, f * 2 ** (2.5 / 1200), length, t60=1.3 * (300 / f) ** .3, damp=.3, pos=.11, exc_lp=7000)
        s2 = ks(rng, f * 2 ** (-2.5 / 1200), length, t60=1.2 * (300 / f) ** .3, damp=.33, pos=.13, exc_lp=6500)
        s = s + .8 * np.r_[np.zeros(int(.0015 * SR)), s2][:len(s)]
        tt_ = tt(length)
        s += .25 * norm(filt(noise(rng, len(tt_)), "bandpass", [2000, 6000])) * env(tt_, .0002, .0018)  # risha
        if nxt - t < length + .001:
            s *= np.clip((length - tt_) / .012, 0, 1)
        place(out[:, None], s[:, None], t, v=v)
    return body(out, [(110, .03, 1.2), (220, .025, 1.0), (295, .02, 1.8), (480, .015, .8), (840, .012, 1.0),
                      (1250, .01, 2.4), (1850, .008, 1.0), (2700, .006, .6)])


def darbuka(rng, kind, v=1.0):
    j = lambda: rng.uniform(.97, 1.03)
    if kind == "D":  # dum: centre stroke, pitch drop + membrane modes + slap
        t = tt(.5)
        f0 = 100 * j()
        s = .62 * osc(f0 * (1 + .8 * np.exp(-t / .012))) * env(t, .001, .15)
        s += sum(a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / d)  # membrane modes: these
                 for r, a, d in [(1.59, .62, .08), (2.14, .5, .06), (2.65, .42, .05), (3.16, .34, .04),  # are what a
                                 (3.92, .24, .03), (4.71, .16, .022)])                                   # phone hears
        s += .32 * norm(filt(noise(rng, len(t)), "bandpass", [250, 1800])) * env(t, .0005, .008)
        return s * v
    t = tt(.25)  # tak (rim, dominant hand) / ka (rim, other hand: softer, duller)
    sc = 1.0 if kind == "T" else .93
    ring = sum(a * np.sin(2 * np.pi * f * sc * j() * t + rng.uniform(0, 6)) * np.exp(-t / (d * (1 if kind == "T" else .7)))
               for f, a, d in [(640, .5, .03), (1015, .6, .025), (1390, .45, .02), (1810, .35, .015), (2430, .3, .012), (3300, .2, .008)])
    click = norm(filt(noise(rng, len(t)), "bandpass", [1800, 6500])) * env(t, .0002, .003)
    s = .6 * ring + .7 * click
    return (s if kind == "T" else .55 * filt(s, "lowpass", 3500)) * v


def act2_music():
    rng = np.random.default_rng(SEED + 2)
    bus = np.zeros((N, 2))
    a, b = CYMBAL + .25, FLOOD
    ln = b - a + .35
    t = tt(ln)
    # the G pad: hushed under the drops and the hero smear, lifting through the domino, blooming on the hold
    lvl = np.interp(a + t, [a, ERASE[1], HOLD - .05, HOLD + .25, FLOOD], [.8, .85, 1.05, 1.2, 1.1])
    e = np.clip(t / .9, 0, 1) ** 2 * np.clip((ln - t) / .35, 0, 1) * lvl
    place(bus, filt(pad_chord(rng, "G3 B3 D4 F#4 A4", ln), "lowpass", 2600) * e, a, 0, .2)
    ln2 = b - HOLD + .35
    t2 = tt(ln2)
    e2 = np.clip(t2 / .12, 0, 1) * np.clip((ln2 - t2) / .35, 0, 1)
    place(bus, filt(pad_chord(rng, "G4 B4 D5 A5", ln2, .5), "lowpass", 4200) * e2, HOLD, 0, .05)  # the bloom
    t = tt(b - a)
    shimmer = (np.sin(2 * np.pi * hz("D6") * t) + .7 * np.sin(2 * np.pi * hz("A6") * t)) * (1 + .5 * np.sin(2 * np.pi * 6.2 * t))
    place(bus, pan2(shimmer * np.clip(t / 1.2, 0, 1) * np.clip((b - a - t) / .3, 0, 1), np.sin(2 * np.pi * .4 * t) * .5), a, 0, .025)
    # the held shimmer: a soft music-box figure in 16ths on the 120 BPM grid that the drop will continue
    seq = "D6 G6 B6 G6 D7 B6 G6 B6".split()
    k = 0
    tb = HOLD + S16
    while tb < FLOOD + .05:
        x = (tb - HOLD) / (FLOOD - HOLD)
        place(bus, mallet(midi(seq[k % len(seq)]), GLOCK, d=.22, length=.7), tb, (-.4, .4)[k % 2], .055 * (1 - .3 * x))
        tb += S16
        k += 1
    # the build: A7sus4 -> A7, oud tremolo on A4, darbuka roll, A bass swell — all out BREATH before the drop
    # (the roll's last tak sits a 16th before it), so the downbeat lands out of a gasp, not out of a wall
    ln = CUP_SHOT - FLOOD
    t = tt(ln)
    e = (.15 + .85 * (t / ln) ** 1.3) * np.minimum(t / .08, 1) * np.clip((ln - BREATH - t) / .02, 0, 1)
    sus, dom = (filt(pad_chord(rng, ch, ln * .5), "lowpass", fc) for ch, fc in (("A3 D4 E4 G4", 3000), ("A3 C#4 E4 G4", 3500)))
    place(bus, sus * e[:len(sus)], FLOOD, 0, .085)
    place(bus, dom * e[-len(dom):], CUP_SHOT - len(dom) / SR, 0, .085)
    bass = sum(np.sin(2 * np.pi * hz("A2") * k * t) / k ** 1.1 for k in range(1, 7))
    place(bus, bass * e, FLOOD, 0, .08)
    roll_t0 = CUP_SHOT - BEAT
    k = 0
    tr = roll_t0
    while tr < CUP_SHOT - S16 + .001:
        x = (tr - roll_t0) / (CUP_SHOT - roll_t0)
        place(bus, darbuka(rng, "T" if k % 2 == 0 else "K", .25 + .75 * x ** 1.3), tr, (.15, -.15)[k % 2], .5)
        tr += S16 / 2
        k += 1
    trem = oud_line(rng, [(roll_t0, midi("A4"), CUP_SHOT - roll_t0 - S16 / 2, .9, "trem")])
    ramp = np.zeros(N)
    i0, i1 = int(roll_t0 * SR), int((CUP_SHOT - BREATH) * SR)
    ramp[i0:i1] = np.linspace(.35, 1, i1 - i0) * np.clip((i1 - np.arange(i0, i1)) / (.015 * SR), 0, 1)
    bus += pan2(trem * ramp * .55, .1)
    return reverb(bus, room_size=.6, damping=.4, wet_level=.2, dry_level=.9, width=.9)


# =============================== ACT 3 music: 120 BPM Levantine pop ===============================
# beats from CUP_SHOT. Bar A 0-4 groove (title stamp pushed at 2.8), bar B 4-7 hushed (spoon), 7-8 fill, 8 the
# end card's downbeat, 8-10 logo break, 10-14 last phrase, 14 BUTTON, then the ringing tail.
CHORDS3 = [(0, "D"), (2, "C"), (B_TITLE, "D"), (4, "G"), (6, "A"), (8, "D"), (10, "G"), (11, "A"), (12, "Bm"),
           (13, "G"), (13.5, "A"), (14, "D")]
COMP = {"D": "F#4 A4 D5", "C": "E4 G4 C5", "G": "G4 B4 D5", "A": "E4 A4 C#5", "Bm": "F#4 B4 D5"}
PADV = {"D": "D3 A3 F#4", "C": "C3 G3 E4", "G": "G3 B3 D4", "A": "A2 E3 C#4", "Bm": "B2 F#3 D4"}
BASS3 = [(0, "D2", .6, 1), (.75, "D2", .2, .65), (1.25, "A2", .2, .7), (2, "C2", .45, .95), (B_TITLE, "D2", .9, 1.0),
         (3.75, "A2", .2, .7),
         (4, "G2", 1.4, .8), (5.5, "D2", .45, .6), (6, "A2", 1.0, .8), (7, "E2", .45, .6), (7.5, "A2", .2, .7),
         (7.75, "C#3", .2, .75),
         (8, "D2", 1.8, .85),
         (10, "G2", .6, 1), (10.75, "G2", .2, .65), (11, "A2", .6, .95), (11.75, "A2", .2, .65), (12, "B2", .6, 1),
         (12.75, "B2", .2, .65), (13, "G2", .45, .9), (13.5, "A2", .2, .85), (13.75, "C#3", .2, .8), (14, "D2", .45, 1.0)]
LEAD = [  # (beat, note, dur beats, vel, ornament) — original hook, D major with a mixolydian C and one Rast grace
    (0, "D5", .5, 1.0, ""), (.5, "F#5", .25, .8, ""), (.75, "A5", .25, .85, ""), (1, "G5", .5, .9, "mord"),
    (2, "E5", .2, .7, ""), (B_TITLE, "D5", .2, .9, ""), (3, "A5", .5, .85, ""), (3.5, "G5", .25, .8, ""),
    (3.75, "F#5", .25, .8, ""),
    (4, "B4", 1.0, .5, ""),  # the spoon bar: one soft long note, then air for the ASMR
    (7, "A4", .25, .6, ""), (7.25, "B4", .25, .65, ""), (7.5, "C#5", .25, .7, ""), (7.75, "E5", .25, .75, ""),
    (8, "D5", .5, .8, ""),   # the end card lands; the logo break is the sonic logo's
    (10, "B5", .5, 1.0, ""), (10.5, "A5", .25, .8, ""), (11, "E5", .5, .9, "mord"), (11.5, "F#5", .25, .8, ""),
    (11.75, "G5", .25, .8, ""), (12, "F#5", .5, .95, "neutral"), (12.5, "D5", .25, .75, ""), (12.75, "F#5", .25, .8, ""),
    (13, "B5", .5, .95, ""), (13.25, "A4", .25, .7, ""), (13.5, "B4", .25, .75, ""), (13.75, "C#5", .25, .8, ""),
    (14, "D5", 2.0, .9, ""),  # the button
]
MAQSUM = {0: "D", 2: "T", 6: "T", 8: "D", 12: "T"}


def round_bass(f, dur):
    """Round, warm bass whose 2nd-5th harmonics SUSTAIN (not just the pluck), so a phone speaker that cannot
    play 73-123 Hz still hears the line at 150-600 Hz (missing-fundamental pitch)."""
    t = tt(dur + .06)
    s = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (k - 1) * 1.1) for k, a in
            enumerate([.6, .78, .58, .4, .24, .12, .06], 1) if f * k < 1500)
    e = np.minimum(t / .005, 1) * (.6 + .4 * np.exp(-t / .12)) * np.clip((dur + .06 - t) / .06, 0, 1)
    s = np.tanh(1.6 * s * e) / np.tanh(1.6)
    return s + .08 * osc(np.full(len(t), f * 4)) * env(t, .001, .025)


def kick(rng):  # soft kick + a 280 Hz knock so the downbeat still lands on a phone speaker
    t = tt(.35)
    knock = osc(280 * (1 + .5 * np.exp(-t / .006))) * env(t, .001, .03)
    return filt(osc(55 + 120 * np.exp(-t / .02)), "highpass", 42) * env(t, .001, .1) + .45 * knock + \
        .3 * norm(filt(noise(rng, len(t)), "bandpass", [1500, 5000])) * env(t, .0002, .002)


def clap(rng):
    t = tt(.3)
    e = sum(env(np.maximum(t - o, 0), .0003, .004) * (t >= o) for o in (0, .009, .017, .024))
    e = e + .5 * env(np.maximum(t - .024, 0), .001, .04) * (t >= .024)
    return norm(filt(noise(rng, len(t)) * e, "bandpass", [900, 3800]))


def qanun(rng, n, length=.28):
    f = hz(n)
    s = ks(rng, f, length, t60=.7, damp=.18, pos=.09, exc_lp=9000)
    return s * np.clip((length - tt(length)) / .06, 0, 1)


def drum_bus(x, fc=150.0, knee=.5, thr=.36, room=.16):
    """Drum-bus peak control. The synthesized hits have ~21 dB crest (1-3 ms clicks over quiet bodies), so without
    this the master limiter pulled the whole mix down 7-9 dB on the drop and pumped 3-6 dB through the groove.
    1) soft-clip the sub band (dum + kick) — its odd harmonics (300-500 Hz) are also what a phone plays of the dum;
    2) a soft-knee transient clipper: untouched below `thr`, rounds only the click peaks into thr + room."""
    lo = sosfiltfilt(butter(2, fc, "lowpass", fs=SR, output="sos"), x, axis=0)  # zero-phase: x - lo is exact
    x = x - lo + knee * np.tanh(lo / knee)
    a = np.abs(x)
    return np.where(a > thr, np.sign(x) * (thr + room * np.tanh((a - thr) / room)), x)


# SFX that need the clear in Act 3: no drum hit / strum within 50 ms of them (they would flam it)
CLEAR = [SPOON_IN + 2.5 / FPS, SPOON["contact"], SPOON["sep"], SPOON["brk"], POP]
NO_RIQ = [t + ECHO_GAP for t in ECHO]  # the 2nd echo clack is off the 16th grid: keep the riq's brass from flamming it
GROOVE_BEATS = []  # quarter-note beats that carry a drum hit (for verify)


def act3_music(stems=False):
    rng = np.random.default_rng(SEED + 3)
    drums, bass, comp, pad = (np.zeros((N, 2)) for _ in range(4))
    clear = lambda t, w=.05: all(abs(t - c) >= w for c in CLEAR)
    GROOVE_BEATS.clear()

    def hit(kind, b, v, pn=0.0):
        place(drums, darbuka(rng, kind, v), bt(b) + (rng.uniform(-.004, .004) if b % 1 else 0), pn, 1)
        if b % 1 == 0 and kind in "DT" and v >= .4:
            GROOVE_BEATS.append(bt(b))

    for s16 in range(int(B_BUTTON * 4)):
        b, step = s16 / 4, s16 % 16
        if not clear(bt(b)):
            continue
        full = b < B_SPOON[0] or b >= B_GROOVE2
        if full:
            if B_TITLE - .3 <= b < B_TITLE + .2:
                continue  # a 16th of air before the title stamp: it lands as the band's hit
            if b >= B_BUTTON - .25:
                continue  # one 16th of air before the button
            if b >= B_BUTTON - .5:
                continue  # (the 32nd roll below plays here)
            if step in MAQSUM:
                hit(MAQSUM[step], b, .6 if b == B_GROOVE2 and MAQSUM[step] == "D" else 1.0, .1 if MAQSUM[step] == "T" else 0)
            elif step % 2 == 1 and rng.random() < .8:
                hit("K", b, rng.uniform(.45, .7), -.12)
            if step in (0, 8) and b != B_GROOVE2:
                place(drums, kick(rng), bt(b), 0, .45)
            if step in (4, 12):
                place(drums, clap(rng), bt(b) + .003, -.2, .8)  # the backbeat: must read on a phone
                place(drums, clap(rng), bt(b) + .011, .2, .62)
        elif b < B_SPOON[1]:  # the spoon bar: a hushed pulse so the scoop sits in front
            if step in (0, 8):
                hit("D", b, .5)
            elif step % 4 == 2:
                hit("K", b, .36, -.12)
        elif b < B_CARD:  # fill into the end card: 16ths crescendo
            x = (b - B_SPOON[1]) / (B_CARD - B_SPOON[1])
            hit("T" if s16 % 2 == 0 else "K", b, .3 + .6 * x, (.12, -.12)[s16 % 2])
            if s16 % 2 == 1:
                hit("K", b + .125, .2 + .4 * x, -.1)
        # (8 .. 10: the logo break — no drums; the downbeat hit at 8 is placed below)
    # fill into the button: 32nd roll crescendo over beat 13.5-13.75, then a 16th of air
    tr, k = bt(B_BUTTON - .5), 0
    while tr < bt(B_BUTTON - .25) - .01:
        x = (tr - bt(B_BUTTON - .5)) / (BEAT / 4)
        place(drums, darbuka(rng, "T" if k % 2 == 0 else "K", .45 + .5 * x), tr, (.12, -.12)[k % 2], .85)
        tr += S16 / 2
        k += 1
    # the hits: the drop, the title stamp, the end card's downbeat, the button — the same gesture each time
    for t0, v, crash, claps in ((CUP_SHOT, 1.0, 1.0, 1.0), (TITLE, .9, .8, .8), (END_CARD, .5, .3, .5), (BUTTON, 1.0, 1.0, 1.0)):
        place(drums, darbuka(rng, "D", .35 + .2 * v), t0, 0, 1)
        place(drums, kick(rng), t0, 0, .5 * v)
        for o, pn, cv in ((.0, -.3, .5), (.006, .3, .4), (.013, 0, .3)):
            if claps:
                place(drums, clap(rng), t0 + o, pn, cv * v * claps)
        place(drums, pan2(jingles(rng, [0, .02, .045], 1.0), -.2), t0, 0, .6 * crash)
        place(drums, pan2(jingles(rng, [.01, .03], .8), .25), t0, 0, .6 * crash)
        GROOVE_BEATS.append(t0)
    # riq jingle shimmer on the offbeat 8ths of the groove, very light
    for b in [*np.arange(.5, 4, 1.0), *np.arange(10.5, 14, 1.0)]:
        if clear(bt(b)) and not B_TITLE - .3 <= b < B_TITLE + .2 and all(abs(bt(b) - c) >= .07 for c in NO_RIQ):
            place(drums, pan2(jingles(rng, [0], .35), .3), bt(b), 0, .5)
    for b, n, d, v in BASS3:
        place(bass, round_bass(hz(n), d * BEAT), bt(b), 0, v)
    # offbeat comp (qanun-ish strums) in the two groove sections
    chord_at = lambda b: [c for cb, c in CHORDS3 if cb <= b + 1e-9][-1]
    for b in [*np.arange(.5, 4, 1.0), *np.arange(10.5, 14, 1.0)]:
        if not clear(bt(b), .08) or B_TITLE - .3 <= b < B_TITLE + .2 or any(0 < c - bt(b) < .08 for c in CUP_DROPS):
            continue
        for j, n in enumerate(COMP[chord_at(b)].split()):
            place(comp, qanun(rng, n), bt(b) + .006 * j, (-.3, 0, .3)[j], .5)
    for i, (cb, c) in enumerate(CHORDS3):
        end = CHORDS3[i + 1][0] if i + 1 < len(CHORDS3) else bof(DUR) + .1
        ln = min(bt(end) - bt(cb) + .05, DUR - bt(cb))
        t = tt(ln)
        e = np.minimum(t / .03, 1) * np.clip((ln - t) / .05, 0, 1)
        last = cb == B_BUTTON
        if last:  # the resolve: warm, a touch louder, ringing into the fade (a chord, not just a high ring)
            e = np.minimum(t / .01, 1) * np.exp(-t / 1.1)
        lv = .1 if last else .09 if B_SPOON[0] <= cb < B_GROOVE2 else .05  # the pad fills the hushed bars
        place(pad, filt(pad_chord(rng, PADV[c], ln, .35), "lowpass", 2000) * e, bt(cb), 0, lv)
    # full down-strokes on the drop, the title stamp, the end card and the button
    for t0, g in ((CUP_SHOT + .004, .28), (TITLE + .004, .22), (END_CARD + .004, .16), (BUTTON + .004, .26)):
        for j, n in enumerate("D3 A3 D4 A4 D5 F#5".split()):
            place(comp, ks(rng, hz(n), 1.8, t60=1.6, damp=.3, pos=.12, exc_lp=6500), t0 + .011 * j, (j - 2.5) * .12,
                  g * (.75 if j < 2 else 1))
    # the tail's living motion: a soft qanun twinkle climbing out of the button chord, fading with the master
    # (it steps around the button's 2nd echo clack, 0.2 s after the button: no note within 70 ms of it)
    tw = [b for b in np.arange(B_BUTTON + .25, B_BUTTON + 2.5, .25) if all(abs(bt(b) - c) >= .07 for c in NO_RIQ)][:5]
    for j, (n, b) in enumerate(zip("A5 D6 F#6 A6 D7".split(), tw)):
        place(comp, qanun(rng, n, .6), bt(b), (-.35, .35)[j % 2], .3 * .8 ** j)
    lead = oud_line(rng, [(bt(b), midi(n), d * BEAT, v, o) for b, n, d, v, o in LEAD])
    parts = dict(drums=.85 * drum_bus(drums), bass=.36 * bass, comp=.85 * comp, pad=pad, lead=pan2(lead * .58, -.05))
    if stems:
        return parts
    return reverb(sum(parts.values()), room_size=.35, damping=.5, wet_level=.12, dry_level=.95, width=.9)


# =============================== mix + master ===============================
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


# =============================== optional human VO (panel fix: "add a human voice") ===============================
# Drop the phone-recorded lines into audio/vo/ (any rate, mono or stereo) and re-run. Each line is placed dry and
# centred, levelled VO_OVER_DB above the local music, and the music ducks VO_DUCK_DB under it; the sonic logo is
# untouched. With no files here nothing changes (the current master has no VO: it needs a real voice).
VO_DIR = Path(__file__).resolve().parent / "vo"
VO_CUES = [  # (file, anchor s, "end" = the line ends on the anchor | "start" = it starts on it)
    ("mish-qashta.wav", ACT1_END, "end"),              # tired, deadpan «مش قشطة…» over the burst; the hard cut ends it
    ("khalliha-qashta.wav", TITLE + 4 / FPS, "start"),  # relieved «آه… خلّيها قشطة» right after the title thud
]
VO_DUCK_DB, VO_OVER_DB = 4.0, 6.0


def load_vo():
    out = []
    for name, anchor, align in VO_CUES:
        f = VO_DIR / name
        if not f.exists():
            continue
        x, sr = sf.read(f, always_2d=True)
        x = x.mean(1)
        if sr != SR:
            x = resample_poly(x, SR, sr)
        x = filt(peq(x, 3000, 2, .8), "highpass", 90, 2)  # phone-voice presence, no rumble
        out.append((name, anchor - len(x) / SR if align == "end" else anchor, x))
    return out


def kloud(x):  # K-weighted mean-square level of a stereo block, dB
    return 10 * np.log10((kweight(x) ** 2).mean(0).sum() + 1e-12)


def build():
    """Returns (music_a1, music_rest, sfx_a1, sfx_rest, duck_db curve, cues [(t, kind, role, start, dry signal)])."""
    m1, m2 = act1_music(), act2_music() + act3_music()  # (each part seeds its own rng: the order does not matter)
    s1, s2, cues = np.zeros((N, 2)), np.zeros((N, 2)), []
    duck = np.zeros(N)
    seen = {}
    for t, kind, p, role in SFX_CUES:
        idx = seen[kind] = seen.get(kind, -1) + 1
        rng = np.random.default_rng(SEED + int(round(t * 1000)) + sum(map(ord, kind)))
        sig, lead = globals()[kind](rng, **{k: v for k, v in p.items() if k != "gain"})
        sig = sig * SFX_GAIN[kind] * CUE_GAIN_OVERRIDE.get((kind, idx), p.get("gain", 1.0))
        assert not ACT1_END - 1e-9 <= t - lead < NOTIFICATION - 1e-9, f"{kind} would break the silence"
        assert t < ACT1_END or t - lead >= ACT1_END, f"{kind} straddles the cut"

        place(s1 if t < ACT1_END else s2, sig, t - lead)
        cues.append((t, kind, role, int(round((t - lead) * SR)), sig))
        dd = DUCK_DB.get(kind, 0) if role == "key" else 0
        if dd:  # duck the music by the shape of this cue's own envelope (8 ms look-ahead)
            e = maximum_filter1d(np.abs(sig).max(1), int(.03 * SR))
            e = np.minimum(1, e / (e.max() * .5)) * dd
            i = int(round((t - lead - .008) * SR))
            e = e[max(0, -i):]
            i = max(i, 0)
            n = min(len(e), N - i)
            duck[i:i + n] = np.maximum(duck[i:i + n], e[:n])
    vo = []
    for name, t0, x in load_vo():
        assert t0 + len(x) / SR <= ACT1_END + 1e-9 or t0 >= NOTIFICATION, f"VO {name} would play in the silence"
        i0 = int(round(t0 * SR))
        a, b = max(0, i0), min(N, i0 + len(x))
        sig = pan2(x)
        sig = sig * 10 ** ((kloud((m1 if t0 < ACT1_END else m2)[a:b]) + VO_OVER_DB - kloud(sig[a - i0:b - i0])) / 20)
        e = uniform_filter1d(maximum_filter1d(np.abs(x), int(.05 * SR)), int(.15 * SR))
        duck[a:b] = np.maximum(duck[a:b], np.minimum(1, e[a - i0:b - i0] / (e.max() * .3)) * VO_DUCK_DB)
        vo.append((t0, sig))
        cues.append((t0, "vo", "key", a, sig[a - i0:]))
    d = duck.reshape(-1, 48).max(1)  # 1 kHz control rate: instant attack, ~70 ms release
    for i in range(1, len(d)):
        d[i] = max(d[i], d[i - 1] * .986)
    duck = uniform_filter1d(np.repeat(uniform_filter1d(d, 4), 48), 96)
    s1 = reverb(s1, room_size=.2, damping=.6, wet_level=.07, dry_level=1, width=.7)
    s2 = reverb(s2, room_size=.25, damping=.55, wet_level=.08, dry_level=1, width=.8)
    for t0, sig in vo:  # dry: a voice recorded on a phone, not in the SFX room
        place(s1 if t0 < ACT1_END else s2, sig, t0, fade=.02)
    return m1, m2, s1, s2, duck, cues


def lowshelf(x, f0, gain_db):  # RBJ low shelf, S = 1
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    al, c = np.sin(w) / np.sqrt(2), np.cos(w)
    r = 2 * np.sqrt(A) * al
    b = [A * ((A + 1) - (A - 1) * c + r), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - r)]
    a = [(A + 1) + (A - 1) * c + r, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - r]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def master(m1, m2, s1, s2, duck, ceil_db):
    """Cleanup filters, the HARD CUT at ACT1_END (after the filters, so the gap is digital zero), ducking, end fade,
    loudness to TARGET_LUFS under a true-peak ceiling. Returns (mix, music part, sfx part, gain curve)."""
    clean = lambda x: filt(filt(x, "highpass", 32, 3), "lowpass", 15000)
    cut = np.ones(N)
    i = int(round(ACT1_END * SR))
    cut[i - int(.003 * SR):i] = np.linspace(1, 0, int(.003 * SR))
    cut[i:] = 0
    m = lowshelf(clean(m1), 110, -3) * cut[:, None] + lowshelf(clean(m2), 110, -3)
    m = m * (10 ** (-duck / 20))[:, None]
    s = clean(s1) * cut[:, None] + clean(s2)
    fade = np.ones(N)
    a, b = int(FADE[0] * SR), N
    fade[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2   # last sample = 0 exactly at 17.000 s
    fade[:int(.002 * SR)] = np.linspace(0, 1, int(.002 * SR))
    mix, gain = (m + s) * fade[:, None], 1.0
    for _ in range(6):
        gain *= 10 ** ((TARGET_LUFS - lufs(mix * gain * limiter_gain(mix * gain, ceil_db)[:, None])) / 20)
    g = gain * limiter_gain(mix * gain, ceil_db) * fade
    return g[:, None] * (m + s), g[:, None] * m, g[:, None] * s, g


# =============================== encode + verification ===============================
def ebur128(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    summ = r[r.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1)), float(re.search(r"Peak:\s+(-?[\d.inf]+) dBFS", summ).group(1)), \
        float(re.search(r"LRA:\s+(-?[\d.]+) LU", summ).group(1))


def encode(gain_db):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(WAV), "-af", f"volume={gain_db:.3f}dB",
                    "-c:a", "libmp3lame", "-b:a", "192k", "-ar", str(SR), "-ac", "2", str(MP3)], check=True)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(MP3), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(pcm.stdout, np.float32).reshape(-1, 2).astype(np.float64)


def onset_in(x, t, lo=-.03, hi=.12, db=-18):
    """First sample in [t+lo, t+hi] where the 1 ms envelope reaches (window peak + db) while standing >= 9 dB over
    its minimum in the preceding 15 ms, so the tail of an earlier sound is not mistaken for this onset."""
    pre, w = int(.02 * SR), int(.015 * SR)
    a, b = int((t + lo) * SR) - pre, int((t + hi) * SR)
    e = uniform_filter1d(np.abs(x[a:b]).max(1), int(.001 * SR)) + 1e-9
    mf = minimum_filter1d(e, w)
    prev = np.r_[np.full(w // 2, e[0]), mf[:-(w // 2)]]
    ok = (e > e[pre:].max() * 10 ** (db / 20)) & (e > prev * 10 ** (9 / 20))
    ok[:pre] = False
    return (a + (np.argmax(ok) if ok.any() else pre + np.argmax(e[pre:] > e[pre:].max() * 10 ** (db / 20)))) / SR


def krms_db(x, a, b):
    k = kweight(x[max(0, int(a * SR)):int(b * SR)])
    return 10 * np.log10((k ** 2).mean() + 1e-20)


SWELLS = {"swish", "whip", "glide", "flood", "swish_big", "push_air", "smear", "scoop", "stretch", "slide_off", "clock_roll",
          "spoon_in"}
WINDOW = {"chat_chaos": lambda on: (on, ACT1_END), "fam_notif": lambda on: (on, on + .3), "win_hero": lambda on: (on, on + .3),
          "tada": lambda on: (on, on + .3), "chime": lambda on: (on, on + .1)}


def verify(out, mu, g, cues, dec, log):
    """Each cue is measured on its own (dry, times the master gain), against the final music stem; plus the mix's
    librosa onsets, the silence window, length, loudness, the phone-speaker band and MP3 alignment."""
    import librosa
    mono = out.mean(1)
    lib = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=SR, hop_length=128, units="time", backtrack=False)
    phone = filt(filt(out, "highpass", 300, 4), "lowpass", 8000, 4)
    phone_mu = filt(filt(mu, "highpass", 300, 4), "lowpass", 8000, 4)
    log(f"\n  frame  cue(s)  event         role  onset(s)  err ms | mix onset err ms | peak(s) | over music dB (full / phone)")
    rows = []
    for t, kind, role, i0, sig in cues:
        x = np.zeros((N, 2))
        n = min(len(sig), N - i0)
        x[i0:i0 + n] = sig[:n] * g[i0:i0 + n, None]
        e = uniform_filter1d(np.abs(x[i0:i0 + n]).max(1), int(.001 * SR))
        on = (i0 + np.argmax(e > e.max() * 10 ** ((-30 if kind in SWELLS else -15) / 20))) / SR
        pk = (i0 + np.argmax(uniform_filter1d(e, int(.03 * SR)))) / SR
        if kind in SWELLS:
            a, b = (pk - .12, pk + .03) if kind == "flood" else (pk - .08, pk + .08)
            mo = np.nan
        else:
            a, b = WINDOW.get(kind, lambda on: (on, on + .12))(on)
            near = lib[np.abs(lib - on) < .05]
            mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        mdb = krms_db(mu, a, b)
        rel = krms_db(x, a, b) - mdb
        relp = krms_db(filt(filt(x, "highpass", 300, 4), "lowpass", 8000, 4), a, b) - krms_db(phone_mu, a, b)
        rel_s = "   music silent  " if mdb < -90 else f"{rel:+6.1f} / {relp:+6.1f}"
        mo_s = f"{mo:8.3f} {1000 * (mo - on):+5.0f}" if mo == mo else "      —       "
        ref = pk if kind == "swish_big" else on
        log(f"  {t * FPS:5.1f}  {t:6.3f}  {kind:<12} {role:>4}  {on:7.3f}  {1000 * (ref - t):+5.0f}{'p' if kind == 'swish_big' else ' '}| {mo_s} | {pk:7.3f} | {rel_s}")
        rows.append(dict(frame=round(t * FPS, 2), t=round(t, 4), kind=kind, role=role, onset=round(on, 4),
                         err_ms=round(1000 * (ref - t), 1), mix_onset=None if mo != mo else round(float(mo), 4),
                         peak=round(pk, 4), over_music_db=None if mdb < -90 else round(rel, 1),
                         over_music_phone_db=None if mdb < -90 else round(relp, 1)))
        if kind in ("sonic_logo", "logo_echo"):
            p = dict(next(c[2] for c in SFX_CUES if c[0] == t and c[1] == kind))
            t2 = t + p.get("gap", .15)
            on2 = onset_in(x, t2, -.03, .05)
            log(f"  {t2 * FPS:5.1f}  {t2:6.3f}    clink #2          {on2:7.3f}  {1000 * (on2 - t2):+5.0f}")
    errs = [1000 * (lib[np.argmin(np.abs(lib - x))] - x) for x in GROOVE_BEATS]
    log(f"\n  groove: {sum(abs(e) < 25 for e in errs)}/{len(GROOVE_BEATS)} drum beats of the 120 BPM grid have a mix onset "
        f"within 25 ms (median {np.median(errs):+.0f} ms); missed: {[round(b, 2) for b, e in zip(GROOVE_BEATS, errs) if abs(e) >= 25] or 'none'}")
    i0, i1 = int(ACT1_END * SR), int(NOTIFICATION * SR)
    for name, x in (("WAV file (24-bit)", sf.read(WAV)[0]), ("MP3 decoded", dec)):
        gap = 20 * np.log10(np.abs(x[i0:i1]).max() + 1e-12)
        nz = np.flatnonzero(np.abs(x[i0:i1]).max(1) > 0)
        inner = 20 * np.log10(np.abs(x[i0 + int(.03 * SR):i1 - int(.03 * SR)]).max() + 1e-12)
        tail = 20 * np.log10(np.abs(x[-int(.005 * SR):]).max() + 1e-12)
        last = 20 * np.log10(np.abs(x[-1]).max() + 1e-12)
        clip = int((np.abs(x) >= .999).sum())
        log(f"  {name}: {len(x)} samples = {len(x) / SR:.4f} s | silence {ACT1_END:.3f}-{NOTIFICATION:.3f} s: peak {gap:.1f} dBFS, "
            f"non-zero samples {len(nz)}" + (f" ({ACT1_END + nz[0] / SR:.4f}..{ACT1_END + nz[-1] / SR:.4f} s)" if len(nz) else "") +
            f", inner (+-30 ms) peak {inner:.1f} dBFS | last 5 ms peak {tail:.1f} dBFS, last sample {last:.1f} dBFS | samples >= 0.999: {clip}")
    # MP3 vs WAV alignment (LAME delay is trimmed by the decoder: should be 0 samples)
    a, b = int(9.0 * SR), int(11.0 * SR)
    xc = np.correlate(dec[a - 2048:b + 2048, 0], out[a:b, 0], "valid")
    log(f"  MP3 vs WAV alignment: {int(np.argmax(xc)) - 2048:+d} samples (cross-correlation 9-11 s)")
    L, R = out[:, 0], out[:, 1]
    mono2 = np.stack([mono, mono], 1)
    seg = lambda x, a, b: x[int(a * SR):int(b * SR)]
    log(f"  mono: L/R correlation {np.corrcoef(L, R)[0, 1]:+.2f}; mono fold-down {lufs(mono2) - lufs(out):+.2f} dB vs stereo "
        f"(ACT1 {lufs(seg(mono2, 0, ACT1_END)) - lufs(seg(out, 0, ACT1_END)):+.2f}, ACT3 {lufs(seg(mono2, CUP_SHOT, 16)) - lufs(seg(out, CUP_SHOT, 16)):+.2f})")
    f, _, Z = stft(mono, SR, nperseg=4096)
    p = (np.abs(Z) ** 2).sum(1)
    log("  energy share: " + ", ".join(f"{a}-{b} Hz {100 * p[(f >= a) & (f < b)].sum() / p.sum():.0f}%"
                                       for a, b in [(0, 150), (150, 5000), (5000, 24000)]))
    tempo, _ = librosa.beat.beat_track(y=seg(phone, CUP_SHOT, bt(8)).mean(1).astype(np.float32), sr=SR, hop_length=256, start_bpm=110)
    log(f"  phone-speaker sim (HPF 300 Hz, LPF 8 kHz, 4th order): loudness {lufs(phone) - lufs(out):+.1f} dB vs full; "
        f"ACT3 bar A-B tempo estimate {float(np.atleast_1d(tempo)[0]):.1f} BPM")
    cs = (1.5, 3.3, 6.0, 7.5, 10.0, 12.0, 14.0, 15.5)
    log("  short-term loudness (3 s windows, LUFS) full:  " + "  ".join(f"{c:.1f}s {lufs(seg(out, max(0, c - 1.5), c + 1.5)):.1f}" for c in cs))
    log("  short-term loudness (3 s windows, LUFS) phone: " + "  ".join(f"{c:.1f}s {lufs(seg(phone, max(0, c - 1.5), c + 1.5)):.1f}" for c in cs))
    return rows, phone


# =============================== pictures of the sound (PIL; no matplotlib here) ===============================
def _font(size):
    from PIL import ImageFont
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def _spec_img(x, t0, t1, w, h, fmin=40, fmax=12000):
    seg_ = x[int(t0 * SR):int(t1 * SR)].mean(1)
    hop = max(64, int(len(seg_) / w))
    f, ts, Z = stft(seg_, SR, nperseg=2048, noverlap=2048 - hop)
    db = 20 * np.log10(np.abs(Z) + 1e-9)
    fl = np.geomspace(fmin, fmax, h)[::-1]
    img = np.array([np.interp(fl, f, db[:, i]) for i in range(db.shape[1])]).T
    img = np.clip((img - (db.max() - 80)) / 80, 0, 1)
    cols = np.linspace(0, img.shape[1] - 1, w).astype(int)
    img = img[:, cols]
    lut = np.stack([np.clip(1.6 * img - .2, 0, 1), np.clip(1.6 * img - .75, 0, 1) ** .8, np.clip(np.sin(np.pi * img) * .85, 0, 1)], -1)
    return (lut * 255).astype(np.uint8), fl


def plot_overview(out, phone, cues, path, t0=0.0, t1=None, title=""):
    from PIL import Image, ImageDraw
    t1 = DUR if t1 is None else t1
    W, M = 2600, 60
    pw = W - 2 * M
    X = lambda t: M + (t - t0) / (t1 - t0) * pw
    hw, hs, hl, ht = 230, 420, 150, 300
    H = 50 + hw + hs + hl + ht + 60
    im = Image.new("RGB", (W, H), (18, 18, 22))
    d = ImageDraw.Draw(im)
    f12, f14, f18 = _font(12), _font(14), _font(18)
    d.text((M, 12), title, fill=(230, 230, 230), font=f18)
    y0 = 50
    # waveform (full = light, phone band = turquoise), min/max per column, dB-ish scale
    for x_, col in ((out, (200, 200, 210)), (phone, (1, 232, 213))):
        mono = x_[int(t0 * SR):int(t1 * SR)].mean(1)
        idx = np.linspace(0, len(mono), pw + 1).astype(int)
        for c in range(pw):
            sl = mono[idx[c]:max(idx[c] + 1, idx[c + 1])]
            lo, hi = sl.min(), sl.max()
            d.line([(M + c, y0 + hw / 2 - hi * hw / 2), (M + c, y0 + hw / 2 - lo * hw / 2)], fill=col)
    d.text((M + 4, y0 + 2), "waveform: full (grey), phone-speaker band 300 Hz-8 kHz (turquoise)", fill=(160, 160, 160), font=f12)
    y1 = y0 + hw + 10
    sp, fl = _spec_img(out, t0, t1, pw, hs)
    im.paste(Image.fromarray(sp), (M, y1))
    for fq in (100, 300, 1000, 3000, 8000):
        yy = y1 + np.argmin(np.abs(fl - fq))
        d.line([(M - 8, yy), (M, yy)], fill=(160, 160, 160))
        d.text((4, yy - 7), f"{fq if fq < 1000 else str(fq // 1000) + 'k'}", fill=(160, 160, 160), font=f12)
    # momentary loudness (400 ms) full + phone, with -14 reference
    y2 = y1 + hs + 10
    for x_, col in ((out, (200, 200, 210)), (phone, (1, 232, 213))):
        k = kweight(x_)
        pts = []
        for tc in np.arange(t0, t1, .025):
            a, b = int(max(0, tc - .2) * SR), int(min(DUR, tc + .2) * SR)
            ms = (k[a:b] ** 2).mean(0).sum() if b > a else 0
            v = -.691 + 10 * np.log10(ms + 1e-12)
            pts.append((X(tc), y2 + hl * (1 - np.clip((v + 50) / 45, 0, 1))))
        d.line(pts, fill=col, width=2)
    yr = y2 + hl * (1 - (TARGET_LUFS + 50) / 45)
    d.line([(M, yr), (W - M, yr)], fill=(120, 60, 60))
    d.text((M + 4, y2 + 2), "momentary loudness (400 ms), -50..-5 LUFS; red = -14", fill=(160, 160, 160), font=f12)
    # cue lanes
    y3 = y2 + hl + 10
    lanes = [0] * 12
    for t, kind, role, i0, sig in cues:
        if not t0 - .05 <= t <= t1:
            continue
        x = X(t)
        col = (255, 120, 120) if role == "key" else (140, 140, 170)
        d.line([(x, y0), (x, y3)], fill=col, width=1)
        lab = f"{t * FPS:.0f} {kind}"
        wlab = d.textlength(lab, font=f12)
        lane = next((i for i, e in enumerate(lanes) if e < x), len(lanes) - 1)
        lanes[lane] = x + wlab + 6
        d.text((x + 2, y3 + 4 + lane * 22), lab, fill=col, font=f12)
    for ref, lab in ((ACT1_END, "CUT"), (NOTIFICATION, "ping"), (CUP_SHOT, "DROP"), (END_CARD, "end card"), (BUTTON, "button")):
        if t0 <= ref <= t1:
            d.line([(X(ref), y0), (X(ref), y3)], fill=(255, 210, 60), width=2)
            d.text((X(ref) + 3, y0 - 16), lab, fill=(255, 210, 60), font=f14)
    # time axis (seconds + frames)
    step = .5 if t1 - t0 > 4 else .1
    for tc in np.arange(np.ceil(t0 / step) * step, t1 + 1e-9, step):
        d.line([(X(tc), H - 50), (X(tc), H - 42)], fill=(160, 160, 160))
        d.text((X(tc) - 14, H - 38), f"{tc:.1f}s", fill=(190, 190, 190), font=f12)
        d.text((X(tc) - 14, H - 22), f"f{tc * FPS:.0f}", fill=(120, 120, 120), font=f12)
    im.save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    MP3.parent.mkdir(parents=True, exist_ok=True)
    lines = []

    def log(s=""):
        print(s)
        lines.append(s)

    log(f"timeline: T.end {T['end']} f = {DUR:.3f} s | screens {[s['stamp'] for s in T['screens']]} burst {T['burst']} "
        f"cut {T['act1End']} ping {T['notification']} cymbal {T['cymbal']} drops {T['dropLand']} erase {T['erase']} "
        f"hold {T['holdQashta']} flood {T['flood']} drop {T['cupShot']} cupDrops {T['cupDrops']} title {T['title']} "
        f"spoon {T['spoon']} card {T['endCard']} dots {T['logoDots']} cta {T['cta']} prompt {T['commentPrompt']}")
    log("spoon sub-beats (cup3d.py, frames): " + ", ".join(f"{k} {v * FPS:.0f}" for k, v in SPOON.items()) +
        f" | button {BUTTON * FPS:.0f} f = {BUTTON:.3f} s | fade {FADE[0]:.2f}-{FADE[1]:.2f} s")
    m1, m2, s1, s2, duck, cues = build()
    ceil = -1.6
    for attempt in range(4):
        out, mu, sx, g = master(m1, m2, s1, s2, duck, ceil)
        sf.write(WAV, out, SR, subtype="PCM_24")
        encode(0.0)
        i0, _, _ = ebur128(MP3)
        dec = encode(TARGET_LUFS - i0)  # correct the encoder's level shift
        I, tp, lra = ebur128(MP3)
        if tp <= TP_MAX - .2:
            break
        ceil -= tp - (TP_MAX - .3)
    Iw, tpw, lraw = ebur128(WAV)
    (OUT / "stems").mkdir(exist_ok=True)
    sf.write(OUT / "stems/music.wav", mu, SR, subtype="PCM_24")
    sf.write(OUT / "stems/sfx.wav", sx, SR, subtype="PCM_24")
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels",
                          "-of", "compact", str(MP3)], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
    log(f"limiter ceiling {ceil:.2f} dBFS (4x oversampled)")
    log(f"{WAV.relative_to(REPO)}: I {Iw:.1f} LUFS, TP {tpw:.1f} dBTP, LRA {lraw:.1f} LU (ffmpeg ebur128); own meter {lufs(out):.2f} LUFS")
    log(f"{MP3.relative_to(REPO)}: I {I:.1f} LUFS, TP {tp:.1f} dBTP, LRA {lra:.1f} LU; {dur}")
    rows, phone = verify(out, mu, g, cues, dec, log)
    (OUT / "cues.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")
    plot_overview(out, phone, cues, OUT / "overview.png", title="«مش قشطة» v2 soundtrack — 0-17 s, cue lanes = spec frames")
    plot_overview(out, phone, cues, OUT / "zoom-act1.png", 0.0, 4.0, "zoom: hook stamp -> maps -> lock/boss -> family (Act 1)")
    plot_overview(out, phone, cues, OUT / "zoom-act1-turn.png", 3.9, 6.2, "zoom: burst -> HARD CUT -> silence -> ping + sonic logo -> drops")
    plot_overview(out, phone, cues, OUT / "zoom-twist.png", 5.8, 9.6, "zoom: hero smear -> whip -> domino -> hold -> flood -> DROP")
    plot_overview(out, phone, cues, OUT / "zoom-act3.png", 9.2, 17.0, "zoom: cup shot -> title -> spoon -> end card -> button -> fade")
    if PREVIEW_VIDEO.exists():  # the latest assembly preview with this mix, for eyes + ears
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(PREVIEW_VIDEO), "-i", str(WAV), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT / "preview-half.mp4")], check=True)
        log(f"preview: {(OUT / 'preview-half.mp4').relative_to(REPO)} ({PREVIEW_VIDEO.relative_to(REPO)} + this mix)")


if __name__ == "__main__":
    main()
