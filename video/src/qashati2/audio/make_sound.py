#!/usr/bin/env python3
"""Soundtrack for «مش قشطة» (Qashati Alsham spot #2): 18.0 s, original synthesis, deterministic.

    nice -n 10 python3 video/src/qashati2/audio/make_sound.py
      -> video/public/qashati2/audio/mish-qashta.mp3   48 kHz stereo, 192 kbps, 18.000 s, -14 LUFS, <= -1 dBTP
      -> video/out/qashati2/mish-qashta.wav              24-bit master (+ audio/stems/, audio/spectrogram.png)

Everything is synthesized here from sines, seeded noise, Karplus-Strong strings and modal resonators: no samples,
no borrowed melodies. Story (see ../SPEC.md):
  ACT 1  0-4.8   "not qashta": pizzicato/clock/reed-bass ostinato in 6/8 that steps up a semitone and a tempo
                 notch at every rubber-stamp THUD, horns, a message ding, group-chat pings multiplying ... CUT DEAD.
  ACT 2  4.8-8.5 order ping, then the SONIC LOGO (the Damascene liquorice-seller's brass cups «تشك-تشك» + a tuned
                 D/A ring), a shimmering Gmaj9 pad, two drops on glass, four ascending "little win" chimes as «مش»
                 melts off each stamp, a creamy flood + oud tremolo + darbuka roll into the drop.
  ACT 3  8.5-18  120 BPM D-major/mixolydian Levantine pop: oud-like KS lead (nasal body, double course, risha
                 tremolo, a quarter-tone Rast grace), maqsum darbuka (dum/tak/ka), claps, round bass, qanun-ish
                 offbeat plucks; splats, headline accent, end-card swish, logo-dot plinks, CTA chime, and the
                 sonic logo again as the button. Tail rings out to digital silence.
Mix for phone speakers: bass harmonics sustain, darbuka membrane modes/claps/taks carry the groove above 300 Hz,
the drum bus clips its sub + transient peaks (so the master limiter never squashes the drop), and the flood + build
music rise continuously into a 45 ms suck-out before the 8.5 s downbeat.
Timing mirrors ../spec.ts (frames / 30) and, for the UI micro-beats, ../phone/timeline.ts + ../phone/ui/Chats.tsx.
Move a cue by editing the constants below; every cue has its own seed, so moving one changes only that one
(the sonic logo has a fixed seed: it is the same brand sound at 5.0 s and 16.0 s).
"""
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Pedalboard, Reverb
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, istft, lfilter, resample_poly, sosfilt, sosfiltfilt, stft

REPO = Path(__file__).resolve().parents[4]
MP3 = REPO / "video/public/qashati2/audio/mish-qashta.mp3"
OUT = REPO / "video/out/qashati2/audio"                  # stems + spectrogram for inspection
WAV = REPO / "video/out/qashati2/mish-qashta.wav"
SR, DUR, FPS, SEED = 48000, 18.0, 30, 1402
N = int(SR * DUR)
TARGET_LUFS, TP_MAX = -14.0, -1.0


def fr(f):  # spec.ts frame -> seconds
    return f / FPS


# =============================== CUE LIST (mirrors spec.ts, in seconds) ===============================
SCREENS = [fr(0), fr(36), fr(72), fr(108)]              # T.screens[i].start
STAMPS = [fr(8), fr(44), fr(80), fr(116)]               # T.screens[i].stamp  0.267 1.467 2.667 3.867
ACT1_END = fr(144)                                      # 4.800 dead stop
NOTIFICATION, CYMBAL = fr(148), fr(150)                 # 4.933 order banner, 5.000 sonic logo
DROP_LAND = [fr(174), fr(183)]                          # 5.800 6.100
ERASE = [fr(195), fr(204), fr(213), fr(222)]            # 6.500 6.800 7.100 7.400 («مش» melts; ink flips at +5 f)
FLOOD, CUP_SHOT = fr(237), fr(255)                      # 7.900, 8.500 (the drop, 120 BPM groove starts)
CUP_DROPS = [fr(285), fr(294)]                          # 9.500 9.800
TITLE, END_CARD = fr(315), fr(405)                      # 10.500, 13.500
LOGO_DOTS = [fr(417), fr(423)]                          # 13.900 14.100
CTA, SONIC_LOGO = fr(450), fr(480)                      # 15.000, 16.000
# UI micro-beats, mirrored from phone/timeline.ts (P.*) — they are offsets from the spec anchors above.
SWIPES = [(fr(36 - 7), fr(9)), (fr(72 - 3), fr(6)), (fr(108 - 8), fr(10))]  # (start, dur): swipe, open chat, back+push
LOCK_NOTIF = fr(72 - 9)                                 # 2.100 boss message banner springs in on the lock screen
BADGE = fr(80 + 10), fr(108 - 5)                        # 3.000-3.433 family badge counts 0 -> 37 (boss chat)
FIRST_ERASE_FLIP = 5 / FPS                              # erase frame -> ink flips turquoise + happy bounce
CHAOS_T0 = SCREENS[3] + .025                            # first family blip, as the group chat slides in


def _family_arrivals():  # phone/ui/Chats.tsx `arrivals` (P.chaos.from = stamp[3] + 2), JS Math.round
    out, t = [], 116 + 2 + 1
    for i in range(14):
        out.append(np.floor(t + .5) / FPS)
        t += max(1.2, 3.6 - i * 0.28)
    return out


FAMILY_ARRIVALS = [t for t in _family_arrivals() if t < ACT1_END - .01]
FAMILY_SENDERS = "mama leen reem sami leen jiddo mama sami baba mama reem leen jiddo mama".split()

BEAT = 60 / 120                                          # ACT 3 grid: 120 BPM from CUP_SHOT
S16 = BEAT / 4

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


def swept(rng, d, f0, f1, width=.5, shape=None):  # noise band whose centre glides f0 -> f1 (exp, or `shape(x)`)
    f, ts, Z = stft(rng.standard_normal(int((d + .05) * SR)), SR, nperseg=1024)
    x = np.clip(ts / d, 0, 1)
    fc = f0 * (f1 / f0) ** (x if shape is None else shape(x))
    Z = Z * np.exp(-.5 * (np.log2(np.maximum(f, 20)[:, None] / fc) / width) ** 2)
    return norm(istft(Z, SR, nperseg=1024)[1][:int(round(d * SR))])


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
    P = SR / f
    L = int(np.floor(P - damp - .1))
    d = P - damp - L
    c = (1 - d) / (1 + d)
    g = 10 ** (-3 / (t60 * f))
    den = np.zeros(L + 3)
    den[0], den[1] = 1, c
    den[L] -= g * (1 - damp) * c
    den[L + 1] -= g * ((1 - damp) + damp * c)
    den[L + 2] -= g * damp
    m = max(4, int(round(P)))
    burst = filt(rng.uniform(-1, 1, m + 64), "lowpass", min(exc_lp, .45 * SR))[64:]
    k = max(1, int(round(pos * P)))
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
def stamp(rng, weight=1.0):
    """Rubber stamp slammed on a phone lying on a desk: air, weighty thump, desk thock, rubber squash, paper
    thwack + crinkle, and the sticky lift a moment later. `weight` escalates across the four."""
    t = tt(.75)
    j = lambda lo=.93, hi=1.07: rng.uniform(lo, hi)
    thump = osc(66 * j() * (1 + 1.7 * np.exp(-t / .016))) * env(t, .0008, .075 * weight)
    thock = sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(172, 1, .07), (251, .85, .05), (402, .7, .035), (655, .5, .022), (1130, .35, .012)])
    thock = norm(thock * np.minimum(t / .0006, 1))
    squash = norm(filt(rng.standard_normal(len(t)), "bandpass", [280 * j(), 1250 * j()])) * env(t, .0012, .02)
    n2 = norm(filt(rng.standard_normal(len(t)), "bandpass", [1500, 6500]))
    flam = j(.005, .009)
    paper = n2 * (env(t, .0002, .005) + .55 * env(np.maximum(t - flam, 0), .0002, .004) * (t > flam))
    crink = np.zeros(len(t))
    for tc in np.sort(rng.uniform(.006, .09, 22)):
        i = int(tc * SR)
        crink[i:i + 24] += rng.uniform(.2, 1) * np.exp(-tc / .035) * rng.choice([-1, 1]) * np.hanning(24)
    crink = norm(filt(crink, "bandpass", [1800, 6000]))
    tl = j(.20, .26)
    lift = norm(filt(rng.standard_normal(len(t)), "bandpass", [700, 2800])) * env(np.maximum(t - tl, 0), .001, .009) * (t > tl)
    s = .8 * weight * thump + 1.1 * thock + .6 * squash + .8 * norm(paper) + .22 * crink + .10 * lift
    s = np.tanh(1.4 * s) / np.tanh(1.4)
    lead = .06  # the stamp comes down 2 frames before impact: a short air push
    air = swept(rng, lead, 700, 2400, .8) * np.linspace(0, 1, int(round(lead * SR))) ** 2 * .10
    return pan2(np.r_[air, s], rng.uniform(-.08, .08)), lead


def swish(rng, dur=.3, f0=900, f1=3600, peak=.4, pan=(-.5, .5)):  # soft UI swish; cue = gesture start
    t = tt(dur)
    s = .8 * swept(rng, dur, f0, f1, .55) + .35 * norm(filt(rng.standard_normal(len(t)), "lowpass", 900))
    return pan2(s * swell(t, dur, peak, a=.02), np.linspace(*pan, len(t))), 0.0


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


def msg_ding(rng):  # the boss's message: a clean, slightly "corporate" bell ding (tritone against the ostinato)
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


def buzz(rng, dur=.16):  # phone vibrating on a desk
    t = tt(dur)
    ph = 2 * np.pi * np.cumsum(172 * (1 + .02 * smooth_rand(rng, len(t), 30))) / SR
    s = sum(np.sin(k * ph) / k for k in (1, 2, 3, 5, 7, 9))
    rattle = 1 + .6 * np.clip(smooth_rand(rng, len(t), 90), 0, 1)
    e = np.clip(np.minimum(t / .012, (dur - t) / .02), 0, 1)
    return pan2(norm(filt(s * rattle * e, "bandpass", [140, 2500])), rng.uniform(-.2, .2)), 0.0


def chat_chaos(rng):
    """3.6 -> 4.8: the family group explodes. One blip per message that lands on screen (Chats.tsx arrivals,
    one pitch per family member), plus other chats multiplying in between, denser and higher towards the cut."""
    t0 = CHAOS_T0
    out = np.zeros((int((ACT1_END - t0 + .3) * SR), 2))
    hits = [(t0, "mama", .7), (t0 + .117, "leen", .6)]  # the group opens: two blips, then the arrivals
    hits += [(t, FAMILY_SENDERS[i], 1.0) for i, t in enumerate(FAMILY_ARRIVALS)]
    t = 4.02
    while t < ACT1_END - .015:
        x = (t - 4.0) / .8
        if min(abs(t - h[0]) for h in hits) > .028:
            hits.append((t, None, .45 + .35 * x))
        t += rng.uniform(.9, 1.3) * (.11 - .075 * x)
    for th, who, v in hits:
        if abs(th - STAMPS[3]) < .045:
            continue
        rise = 2 ** (2.5 * max(0, th - 4.0) / 12)  # stress rises
        f = (PERSON_HZ[who] if who else rng.choice([hz("A5"), hz("C#6"), hz("F#6"), hz("A6"), hz("D#6")])) * rise
        place(out, blip(rng, f, two=bool(who) and rng.random() < .45)[0], th - t0,
              rng.uniform(-.55, .55) if who is None else {"mama": -.3, "leen": .35, "reem": -.5, "sami": .2,
                                                         "jiddo": -.1, "baba": .5}[who], v)
    for tb, d in [(4.13, .16), (4.47, .14), (4.68, .13)]:
        place(out, buzz(rng, d)[0], tb - t0, 0, .55)
    return out, 0.0


def badge_pings(rng):  # the family badge counting up to 37 while we're in the boss chat: muffled, background
    out = np.zeros((int(.7 * SR), 2))
    for k, tb in enumerate([0, .08, .15, .21, .26, .31, .36, .40]):
        place(out, blip(rng, hz("E6") * 2 ** (k / 24), muffle=True)[0], tb, .3, .55 + .05 * k)
    place(out, buzz(rng, .12)[0], .02, 0, .4)
    return out, 0.0


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
    A brand asset: fixed seed, so both appearances are the same sound (only the bloom level differs)."""
    rng = np.random.default_rng(SEED + 5000)
    out = np.zeros((int(3.2 * SR), 2))
    place(out, clink(rng, hz("D6"), .95), 0, -.18, .85)
    place(out, clink(rng, hz("D6") * 1.003, 1.1), gap, .18, 1.0)
    t = tt(3.0)
    bloom = (np.sin(2 * np.pi * hz("D6") * t) + .5 * np.sin(2 * np.pi * hz("A6") * t + 1)) * env(t, .04, .7)
    place(out, bloom * (1 + .12 * np.sin(2 * np.pi * 5.5 * t)), gap + .01, 0, .16 * ring_v)
    out = .8 * out + reverb(out, room_size=.45, damping=.35, wet_level=.3, dry_level=0, width=.8)
    return out, 0.0


def plink(rng, note, pan=0.0):  # a qashta drop hitting the glass: tick + tuned bubble + tiny splash
    t = tt(.8)
    f = hz(note)
    f1 = f * (1 - .3 * np.exp(-t / .007))
    tone = osc(f1) * env(t, .0008, .17) + .15 * osc(2.01 * f1) * env(t, .0008, .05)
    tick = norm(filt(rng.standard_normal(len(t)), "bandpass", [3000, 7000])) * env(t, .0002, .0015)
    glass = np.sin(2 * np.pi * f * 3.1 * t) * env(t, .0002, .012)
    splash = norm(filt(rng.standard_normal(len(t)), "bandpass", [500, 2600])) * env(t, .001, .025)
    thud = osc(110 * (1 + .6 * np.exp(-t / .01))) * env(t, .001, .04)
    return pan2(tone + .22 * tick + .18 * glass + .2 * splash + .35 * thud, pan), 0.0


def glide(rng, dur):  # the drops running down the glass: wet, slow, squeaky-soft, with micro-bubbles
    t = tt(dur)
    w = smooth_rand(rng, len(t), 7)
    body_ = swept(rng, dur, 1700, 800, .45, shape=lambda x: x + .08 * np.sin(9 * x))
    sq_f = 2100 * 2 ** (-.45 * t / dur + .04 * w)
    squeak = osc(sq_f) * (.5 + .5 * np.clip(smooth_rand(rng, len(t), 5), 0, 1)) * .25
    s = (body_ * (.7 + .3 * w) + squeak) * np.clip(np.minimum(t / .25, (dur - t) / .35), 0, 1)
    out = pan2(s, np.linspace(-.35, .35, len(t)))
    for tb in np.sort(rng.uniform(.1, dur - .2, 10)):
        place(out, blip(rng, rng.uniform(1500, 2800))[0] * .5, tb, rng.uniform(-.4, .4), rng.uniform(.3, .6))
    return out, 0.0


WIN = [("D5 E5 G5", "A5"), ("E5 G5 A5", "B5"), ("G5 A5 B5", "D6"), ("A5 B5 D6", "F#6")]  # G-major pentatonic, rising


def win(rng, k):
    """«مش» melts off stamp k: a fizzy melt + a quick rising sparkle that lands on the bell as the ink flips."""
    out = np.zeros((int(1.8 * SR), 2))
    gl, main = WIN[k]
    pan = (-.3, .3, -.15, .15)[k]
    for j, n in enumerate(gl.split()):
        place(out, mallet(midi(n), GLOCK, d=.25, length=.6), .05 * j, pan * (j - 1), .45 + .1 * j)
    m = midi(main)
    place(out, mallet(m, GLOCK, d=.6, length=1.6) + .25 * mallet(m + 12, GLOCK, d=.4, length=1.6), FIRST_ERASE_FLIP, pan, 1.0)
    if k == 3:
        place(out, mallet(m + 3, GLOCK, d=.7, length=1.5), FIRST_ERASE_FLIP + .03, -pan, .45)  # A6: the biggest win
    t = tt(.4)
    fizz = norm(filt(rng.standard_normal(len(t)), "bandpass", [1500, 4200])) * np.clip(smooth_rand(rng, len(t), 60), 0, 1)
    place(out, fizz * env(t, .02, .12), 0, pan, .22)
    for j in range(4):
        tj = FIRST_ERASE_FLIP + .06 + .07 * j + rng.uniform(0, .03)
        place(out, mallet(m + (12, 19, 24, 16)[j], [(1, 1, 1)], d=.08, length=.3), tj, rng.uniform(-.6, .6), .12)
    return out, 0.0


def flood(rng, dur):
    """Cream floods the screen: a thick, gurgly whoosh that is audible from the first drip (7.9 s) and keeps rising
    to the drop, then sucks out ~45 ms before it (the breath before the downbeat)."""
    t = tt(dur)
    x = t / dur
    sw = np.stack([swept(rng, dur, 260, 2400, .9, shape=lambda u: u ** 1.3) for _ in range(2)], 1)
    low = np.stack([norm(filt(rng.standard_normal(len(t)), "bandpass", [150, 700])) for _ in range(2)], 1)
    gurgle = 1 + .35 * smooth_rand(rng, len(t), 14)
    glug = np.zeros(len(t))  # thick bubbles popping in the cream, faster as it rises
    tb = .06
    while tb < dur - .1:
        u = tb / dur
        g = osc(np.full(int(.06 * SR), rng.uniform(260, 420) * (1 + .6 * u))) * env(tt(.06), .002, .014)
        i = int(tb * SR)
        glug[i:i + len(g)] += g[:len(glug) - i] * (.4 + .6 * u)
        tb += rng.uniform(.8, 1.2) * (.11 - .06 * u)
    e = (.3 + .7 * x ** 1.2) * np.clip((dur - .045 - t) / .02, 0, 1) * np.minimum(t / .06, 1)
    return (.75 * sw + .45 * low + .25 * glug[:, None]) * (gurgle * e)[:, None], 0.0


def splat(rng, note="D5", pan=0.0):  # a soft, creamy drop landing on the qashta dome
    t = tt(.6)
    thump = osc(140 * (1 + .8 * np.exp(-t / .01))) * env(t, .001, .035)
    mush = norm(filt(rng.standard_normal(len(t)), "bandpass", [350, 2400])) * env(t, .0015, .03)
    sq = osc(1150 * 2 ** (-1.4 * np.minimum(t / .07, 1))) * env(t, .002, .05) * (1 + .5 * smooth_rand(rng, len(t), 120))
    f = hz(note)
    bub = osc(f * (1 - .25 * np.exp(-t / .01))) * env(np.maximum(t - .03, 0), .002, .07) * (t > .03)
    return pan2(.45 * thump + .8 * mush + .5 * sq + .3 * bub, pan), 0.0


def jingles(rng, times, level=1.0):  # riq zills: inharmonic brass partials, kept below 8 kHz for phone speakers
    t = tt(max(times) + .3)
    parts = [(rng.uniform(2600, 7200), rng.uniform(.03, .09)) for _ in range(10)]
    s = np.zeros(len(t))
    for i, tc in enumerate(times):
        tt_ = np.maximum(t - tc, 0)
        s += (1 - .25 * i) * sum(np.sin(2 * np.pi * f * tt_ + rng.uniform(0, 6)) * np.exp(-tt_ / d) for f, d in parts) * (t >= tc)
    return filt(s / 4, "lowpass", 8000) * level


def accent(rng):  # headline accent: a round tuned pop + a little riq shake
    t = tt(.5)
    f = hz("D5") * (1 - .4 * np.exp(-t / .008))
    pop = osc(f) * env(t, .001, .07) + .3 * osc(2 * f) * env(t, .001, .03)
    j = jingles(rng, [0, .035, .07], .45)
    out = pan2(pop, 0)
    place(out, pan2(j[:len(t)], .25), 0)
    return out, 0.0


def swish_big(rng, dur=.5):  # end-card transition: airy swish with a sweet tonal glide; peaks at the cue
    t = tt(dur)
    s = swept(rng, dur, 450, 4200, .6) + .18 * osc(700 * 2 ** (1.0 * t / dur)) * np.sin(np.pi * t / dur)
    return pan2(s * swell(t, dur, .72, a=.03), np.linspace(.55, -.55, len(t))), .72 * dur


def cta_chime(rng):  # gentle call-to-action chime over the A chord
    out = np.zeros((int(1.9 * SR), 2))
    for k, (n, pan, v) in enumerate([("A5", -.2, .8), ("C#6", .2, .9), ("E6", 0, .6)]):
        place(out, mallet(midi(n), BELL, d=.7, length=1.8), .045 * k, pan, v)
    return out, 0.0


# (time, kind, params, key) — key: must sit >= 3 dB over the local music and ducks it; bg: background by design.
# (The flood barely ducks: it rides WITH the build music — oud tremolo + darbuka roll — rather than over a dip.)
SFX_CUES = [
    *[(t, "stamp", dict(weight=w), "key") for t, w in zip(STAMPS, [.85, .95, 1.0, 1.15])],
    *[(t, "swish", dict(dur=d + .06, pan=p, gain=g), "key")
      for (t, d), p, g in zip(SWIPES, [(-.6, .6), (0, 0), (.6, -.6)], [1.25, 1.4, 1.7])],
    (1.62, "horn", dict(f=415, beeps=((0, .11), (.17, .11)), far=.4, pan=-.35), "bg"),
    (1.93, "horn", dict(f=349, beeps=((0, .42),), interval=1.26, far=.7, pan=.4), "bg"),
    (2.28, "horn", dict(f=466, beeps=((0, .12),), far=.85, pan=-.1), "bg"),
    (LOCK_NOTIF, "msg_ding", {}, "key"),
    (BADGE[0], "badge_pings", {}, "bg"),
    (CHAOS_T0, "chat_chaos", {}, "key"),
    (NOTIFICATION, "order_ping", {}, "key"),
    (CYMBAL, "sonic_logo", dict(gain=1.2), "key"),
    (DROP_LAND[0], "plink", dict(note="A5", pan=-.25), "key"),
    (DROP_LAND[1], "plink", dict(note="D6", pan=.25), "key"),
    (DROP_LAND[1] + .1, "glide", dict(dur=1.4), "bg"),
    *[(t, "win", dict(k=k), "key") for k, t in enumerate(ERASE)],
    (FLOOD, "flood", dict(dur=CUP_SHOT - FLOOD), "key"),
    (CUP_DROPS[0], "splat", dict(note="A4", pan=-.15), "key"),
    (CUP_DROPS[1], "splat", dict(note="D5", pan=.15), "key"),
    (TITLE, "accent", {}, "key"),
    (END_CARD, "swish_big", {}, "key"),
    (LOGO_DOTS[0], "plink", dict(note="A5", pan=-.2, gain=1.2), "key"),
    (LOGO_DOTS[1], "plink", dict(note="D6", pan=.2, gain=1.2), "key"),
    (CTA, "cta_chime", {}, "key"),
    (SONIC_LOGO, "sonic_logo", dict(ring_v=1.3, gain=1.45), "key"),
]
SFX_GAIN = dict(stamp=.60, swish=.60, horn=.22, msg_ding=.22, badge_pings=.30, chat_chaos=.55, order_ping=.30,
                sonic_logo=.68, plink=.26, glide=.16, win=.20, flood=.80, splat=.65, accent=.70, swish_big=.58,
                cta_chime=.16)
DUCK_DB = dict(stamp=5, swish=3, msg_ding=4, chat_chaos=3, order_ping=0, sonic_logo=7, plink=4, win=3, flood=1,
               splat=6, accent=5, swish_big=4, cta_chime=4)


# =============================== ACT 1 music: the nervous ostinato ===============================
def pizz(rng, m, length=.5):
    f = mhz(m)
    s = ks(rng, f, length, t60=.30 * (220 / f) ** .35, damp=.42, pos=.21, exc_lp=3200)
    t = tt(length)
    return s + .12 * norm(filt(rng.standard_normal(len(t)), "lowpass", 500)) * env(t, .0005, .004)


def reed(m, dur):  # staccato bassoon-ish nervous bass (odd harmonics -> reads on phone speakers)
    f = mhz(m)
    t = tt(dur + .04)
    ph = 2 * np.pi * f * t
    s = sum(np.sin(k * ph) / k for k in (1, 3, 5, 7, 9, 11) if f * k < 4000) + .35 * np.sin(2 * ph)
    e = np.minimum(t / .005, 1) * np.clip((dur + .04 - t) / .04, 0, 1) * (.65 + .35 * np.exp(-t / .03))
    return filt(s * e, "lowpass", 1900)


def tick(rng, hi):
    t = tt(.06)
    f = 2150 if hi else 1480
    s = np.sin(2 * np.pi * f * t) * env(t, .0003, .011) + .4 * np.sin(2 * np.pi * f * 2.71 * t) * env(t, .0003, .005)
    return s + .3 * norm(filt(rng.standard_normal(len(t)), "bandpass", [2000, 6000])) * env(t, .0002, .0015)


def bowed(rng, ms, length, trem=13.0):  # thin tremolo strings (tension), saw-ish, bandlimited
    t = tt(length)
    s = 0
    for m in ms:
        f = mhz(m)
        ph = 2 * np.pi * np.cumsum(f * (1 + .004 * np.sin(2 * np.pi * 5.5 * t + rng.uniform(0, 6)))) / SR
        s = s + sum(np.sin(k * ph + rng.uniform(0, 6)) / k for k in range(1, 10) if f * k < 6000)
    return filt(s * (.55 + .45 * np.abs(np.sin(np.pi * trem * t))), "bandpass", [300, 5000])


def act1_pulses():
    """(time, midi, accent, seg). 6/8 cells of three; each stamp = downbeat, +1 semitone and a tempo notch."""
    ev = [(0.0, 52, .8, 0), (STAMPS[0] / 2, 56, .8, 0)]  # pickups E3, G#3 -> A on the first THUD
    cells = {"A": (-12, 1, 0), "B": (-5, 3, 1), "L": (-2, -1, 0)}
    segs = [(STAMPS[0], STAMPS[1], 9, 57), (STAMPS[1], STAMPS[2], 12, 58), (STAMPS[2], STAMPS[3], 15, 59)]
    for s, (a, b, n, r) in enumerate(segs):
        order = ("AB" * 5)[:n // 3 - 1] + "L"
        for i in range(n):
            ev.append((a + i * (b - a) / n, r + cells[order[i // 3]][i % 3], 1.0 if i % 3 == 0 else .62, s + 1))
    t, i, r = STAMPS[3], 0, 60
    while t < ACT1_END - .02:  # last segment keeps accelerating into the cut
        x = (t - STAMPS[3]) / (ACT1_END - STAMPS[3])
        ev.append((t, r + cells["AB"[(i // 3) % 2]][i % 3], 1.0 if i % 3 == 0 else .62, 4))
        t += .075 - .028 * x
        i += 1
    return ev


def act1_music():
    rng = np.random.default_rng(SEED + 1)
    pz, bs, clk, ten = (np.zeros((N, 2)) for _ in range(4))
    ev = act1_pulses()
    seg_gain = [1.0, 1.0, .9, .75, .62]
    for k, (t, m, acc, s) in enumerate(ev):
        place(pz, pizz(rng, m + (12 if acc < 1 else 0)), t, (-.25, .25)[k % 2] if acc < 1 else 0, acc * seg_gain[s])
        if acc == 1.0 or s == 0:
            place(bs, reed(m - (12 if s == 0 else 0), .09), t, 0, .9 * seg_gain[s])
        elif s >= 3:
            place(bs, reed(m + (-12 if m > 55 else 0), .05), t, 0, .35)
        place(clk, tick(rng, k % 2 == 0), t, .35 if k % 2 else -.35, .5 + .1 * (s >= 3))
    # tension: tremolo strings from the 2nd stamp, clusters tighten, then a rising gliss + noise riser to the cut
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
    place(ten, np.stack([nr, np.roll(nr, 311)], 1), STAMPS[3], 0, .09)
    bed = 1.4 * (.30 * body(pz, [(280, .02, 1.5), (460, .015, 1.0), (1000, .01, .6), (2800, .006, .8)]) + .20 * bs + .07 * clk + ten)
    return reverb(bed, room_size=.18, damping=.5, wet_level=.08, dry_level=1, width=.7)


# =============================== ACT 2 music: magic pad + the build ===============================
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
        s += .25 * norm(filt(rng.standard_normal(len(tt_)), "bandpass", [2000, 6000])) * env(tt_, .0002, .0018)  # risha
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
        s += .32 * norm(filt(rng.standard_normal(len(t)), "bandpass", [250, 1800])) * env(t, .0005, .008)
        return s * v
    t = tt(.25)  # tak (rim, dominant hand) / ka (rim, other hand: softer, duller)
    sc = 1.0 if kind == "T" else .93
    ring = sum(a * np.sin(2 * np.pi * f * sc * j() * t + rng.uniform(0, 6)) * np.exp(-t / (d * (1 if kind == "T" else .7)))
               for f, a, d in [(640, .5, .03), (1015, .6, .025), (1390, .45, .02), (1810, .35, .015), (2430, .3, .012), (3300, .2, .008)])
    click = norm(filt(rng.standard_normal(len(t)), "bandpass", [1800, 6500])) * env(t, .0002, .003)
    s = .6 * ring + .7 * click
    return (s if kind == "T" else .55 * filt(s, "lowpass", 3500)) * v


def act2_music():
    rng = np.random.default_rng(SEED + 2)
    bus = np.zeros((N, 2))
    a, b = CYMBAL + .25, FLOOD
    ln = b - a + .35
    t = tt(ln)
    e = np.clip(t / .9, 0, 1) ** 2 * np.clip((ln - t) / .35, 0, 1)
    place(bus, filt(pad_chord(rng, "G3 B3 D4 F#4 A4", ln), "lowpass", 2600) * e, a, 0, .2)
    t = tt(b - a)
    shimmer = (np.sin(2 * np.pi * hz("D6") * t) + .7 * np.sin(2 * np.pi * hz("A6") * t)) * (1 + .5 * np.sin(2 * np.pi * 6.2 * t))
    place(bus, pan2(shimmer * np.clip(t / 1.2, 0, 1) * np.clip((b - a - t) / .3, 0, 1), np.sin(2 * np.pi * .4 * t) * .5), a, 0, .025)
    # the build: A7sus4 -> A7, oud tremolo on A4, darbuka roll, A bass swell — all cut at the drop
    ln = CUP_SHOT - FLOOD
    t = tt(ln)
    e = (.15 + .85 * (t / ln) ** 1.3) * np.minimum(t / .08, 1) * np.clip((ln - .01 - t) / .01, 0, 1)
    sus, dom = (filt(pad_chord(rng, ch, ln * .5), "lowpass", fc) for ch, fc in (("A3 D4 E4 G4", 3000), ("A3 C#4 E4 G4", 3500)))
    place(bus, sus * e[:len(sus)], FLOOD, 0, .085)
    place(bus, dom * e[-len(dom):], CUP_SHOT - len(dom) / SR, 0, .085)
    bass = sum(np.sin(2 * np.pi * hz("A2") * k * t) / k ** 1.1 for k in range(1, 7))
    place(bus, bass * e, FLOOD, 0, .08)
    roll_t0 = CUP_SHOT - BEAT  # 8.0: last beat before the drop
    k = 0
    tr = roll_t0
    while tr < CUP_SHOT - .03:
        x = (tr - roll_t0) / (CUP_SHOT - roll_t0)
        place(bus, darbuka(rng, "T" if k % 2 == 0 else "K", .25 + .75 * x ** 1.3), tr, (.15, -.15)[k % 2], .5)
        tr += S16 / 2
        k += 1
    trem = oud_line(rng, [(roll_t0, midi("A4"), CUP_SHOT - roll_t0 - S16 / 2, .9, "trem")])
    ramp = np.zeros(N)
    i0, i1 = int(roll_t0 * SR), int(CUP_SHOT * SR)
    ramp[i0:i1] = np.linspace(.35, 1, i1 - i0)
    bus += pan2(trem * ramp * .55, .1)
    return reverb(bus, room_size=.6, damping=.4, wet_level=.2, dry_level=.9, width=.9)


# =============================== ACT 3 music: 120 BPM Levantine pop ===============================
CHORDS3 = [(0, "D"), (2, "C"), (3, "D"), (4, "G"), (6, "A"), (8, "Bm"), (10, "G"), (12, "A"), (15, "D")]  # beats from CUP_SHOT
COMP = {"D": "F#4 A4 D5", "C": "E4 G4 C5", "G": "G4 B4 D5", "A": "E4 A4 C#5", "Bm": "F#4 B4 D5"}
PADV = {"D": "D3 A3 F#4", "C": "C3 G3 E4", "G": "G3 B3 D4", "A": "A2 E3 C#4", "Bm": "B2 F#3 D4"}
BASS3 = [(0, "D2", .6, 1), (.75, "D2", .2, .65), (1.5, "A2", .45, .8), (2, "C2", .6, .95), (2.75, "C2", .2, .6),
         (3, "D2", .45, .9), (3.5, "F#2", .2, .7), (3.75, "A2", .2, .75),
         (4, "G2", .6, 1), (4.75, "G2", .2, .65), (5.5, "D2", .45, .8), (6, "A2", .6, .95), (6.75, "A2", .2, .65),
         (7.25, "E2", .2, .7), (7.5, "A2", .2, .75), (7.75, "A#2", .2, .8),
         (8, "B2", .6, 1), (8.75, "B2", .2, .65), (9.5, "F#2", .45, .8), (10, "G2", 1.4, .9), (11.5, "D2", .45, .75),
         (12, "A2", .6, .95), (12.75, "A2", .2, .6), (13.5, "E2", .45, .75), (14, "A2", .4, .85), (14.5, "B2", .2, .75),
         (14.75, "C#3", .2, .8), (15, "D2", 3.2, .6)]
LEAD = [  # (beat, note, dur beats, vel, ornament) — original hook, D major with a mixolydian C and one Rast grace
    (0, "D5", .5, 1.0, ""), (.5, "F#5", .25, .8, ""), (.75, "A5", .25, .85, ""), (1, "G5", .5, .9, "mord"),
    (1.5, "F#5", .25, .8, ""), (1.75, "E5", .5, .75, ""), (2.25, "D5", .25, .7, ""),
    (2.5, "C5", .5, .9, ""), (3, "D5", 1.0, .8, "trem"),
    (4, "B5", .5, 1.0, ""), (4.5, "A5", .25, .8, ""), (4.75, "G5", .25, .8, ""), (5, "A5", .25, .85, ""),
    (5.25, "B5", .25, .8, ""), (5.5, "A5", .5, .85, "up"), (6, "E5", .5, .9, ""), (6.5, "F#5", .25, .75, ""),
    (6.75, "G5", .25, .8, ""), (7, "F#5", .25, .8, ""), (7.25, "E5", .25, .75, ""), (7.5, "C#5", .25, .8, ""),
    (7.75, "E5", .25, .8, ""),
    (8, "F#5", .5, .95, "neutral"), (8.5, "D5", .25, .75, ""), (8.75, "F#5", .25, .8, ""), (9, "B5", .5, .95, ""),
    (9.5, "A5", .25, .8, ""), (9.75, "F#5", .5, .75, ""),  # rest: the end-card swish + logo-dot plinks answer
    (14, "A4", .25, .7, ""), (14.25, "B4", .25, .75, ""), (14.5, "C#5", .25, .8, ""), (14.75, "E5", .25, .85, ""),
    (15, "D5", 3.0, .35, ""),
]
MAQSUM = {0: "D", 2: "T", 6: "T", 8: "D", 12: "T"}


def bt(b): return CUP_SHOT + b * BEAT


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
        .3 * norm(filt(rng.standard_normal(len(t)), "bandpass", [1500, 5000])) * env(t, .0002, .002)


def clap(rng):
    t = tt(.3)
    e = sum(env(np.maximum(t - o, 0), .0003, .004) * (t >= o) for o in (0, .009, .017, .024))
    e = e + .5 * env(np.maximum(t - .024, 0), .001, .04) * (t >= .024)
    return norm(filt(rng.standard_normal(len(t)) * e, "bandpass", [900, 3800]))


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


def act3_music(stems=False):
    rng = np.random.default_rng(SEED + 3)
    drums, bass, comp, pad = (np.zeros((N, 2)) for _ in range(4))
    # darbuka + kick + claps, bar by bar (bars A, B, C, D = 8.5, 10.5, 12.5, 14.5)
    for bar in range(4):
        for step in range(16):
            b = bar * 4 + step / 4
            t = bt(b) + rng.uniform(-.004, .004) * (step % 4 != 0)
            if bt(b) >= SONIC_LOGO - 1e-6:
                continue
            thin = bt(b) >= END_CARD - 1e-6 and bt(b) < bt(12)  # end card: one-bar breakdown, the logo lands
            room = any(abs(bt(b) - c) < .06 for c in CUP_DROPS + [TITLE])  # a key SFX sits on this hit
            if room and bt(b) != TITLE:
                continue  # the creamy splat plays this beat
            if step in MAQSUM and not thin and not (bar == 3 and step >= 8):
                v = (.6 if room else 1.0) if step in (0, 8) else 1.0
                place(drums, darbuka(rng, MAQSUM[step], v), t, .1 if MAQSUM[step] == "T" else 0, 1)
            elif not thin and bar < 3 and step % 2 == 1 and rng.random() < .8:
                place(drums, darbuka(rng, "K", rng.uniform(.45, .7)), t, -.12, 1)
            if step in (0, 8) and not thin and not room and not (bar == 3 and step == 8):
                place(drums, kick(rng), bt(b), 0, .45)
            if step in (4, 12) and bar < 3 and not thin:
                place(drums, clap(rng), bt(b) + .003, -.2, .8)  # the backbeat: must read on a phone
                place(drums, clap(rng), bt(b) + .011, .2, .62)
        if bar == 1:  # turnaround fill into bar C
            for s_, k in [(14, "T"), (15, "T"), (15.5, "K")]:
                place(drums, darbuka(rng, k, .8), bt(4 + s_ / 4), .1, 1)
    # the drop: doubled dum, a clap stack and a riq crash — the mid/high layers are what a phone hears
    place(drums, darbuka(rng, "D", .35), CUP_SHOT, 0, 1)
    for o, pn, v in ((.0, -.3, .5), (.006, .3, .4), (.013, 0, .3)):
        place(drums, clap(rng), CUP_SHOT + o, pn, v)
    place(drums, pan2(jingles(rng, [0, .02, .045], 1.0), -.2), CUP_SHOT, 0, .6)
    place(drums, pan2(jingles(rng, [.01, .03], .8), .25), CUP_SHOT, 0, .6)
    tr, k = bt(14), 0  # bar D fill: 32nd roll crescendo, then one 16th of air so the button clink lands clean
    while tr < SONIC_LOGO - S16 - .01:
        x = (tr - bt(14)) / (SONIC_LOGO - bt(14))
        place(drums, darbuka(rng, "T" if k % 2 == 0 else "K", .3 + .7 * x), tr, (.12, -.12)[k % 2], .8)
        tr += S16 / 2
        k += 1
    place(drums, darbuka(rng, "D", .35), SONIC_LOGO, 0, 1)
    # riq jingle shimmer on the offbeat 8ths (bars A-B), very light
    for b in np.arange(.5, 8, 1.0):
        place(drums, pan2(jingles(rng, [0], .35), .3), bt(b), 0, .5)
    for b, n, d, v in BASS3:
        place(bass, round_bass(hz(n), d * BEAT if b < 15 else 1.6), bt(b), 0, v)
    # offbeat comp (qanun-ish strums) and the warm pad
    chord_at = lambda b: [c for cb, c in CHORDS3 if cb <= b + 1e-9][-1]
    for b in np.arange(.5, 15, 1.0):
        if bt(b) >= END_CARD - 1e-6 and b < 12.5 or any(0 < c - bt(b) < .08 for c in CUP_DROPS):
            continue  # end-card breakdown; and no strum 50 ms before a splat (it would flam it)
        for j, n in enumerate(COMP[chord_at(b)].split()):
            place(comp, qanun(rng, n), bt(b) + .006 * j, (-.3, 0, .3)[j], .5 if b < 12 else .35)
    for i, (cb, c) in enumerate(CHORDS3):
        end = CHORDS3[i + 1][0] if i + 1 < len(CHORDS3) else 18.5
        ln = min(bt(end) - bt(cb) + .05, DUR - bt(cb))
        t = tt(ln)
        e = np.minimum(t / .03, 1) * np.clip((ln - t) / .05, 0, 1)
        last = c == "D" and cb == 15
        if last:  # the resolve: warm, longer, a touch louder, so the tail is a chord and not just a high ring
            e = np.minimum(t / .01, 1) * np.exp(-t / 1.3)
        place(pad, filt(pad_chord(rng, PADV[c], ln, .35), "lowpass", 2000) * e, bt(cb), 0, .1 if last else .05)
    # full down-strokes on the drop and on the final chord (the same gesture opens and closes the groove)
    for t0, g in ((CUP_SHOT + .004, .28), (SONIC_LOGO + .004, .15)):
        for j, n in enumerate("D3 A3 D4 A4 D5 F#5".split()):
            place(comp, ks(rng, hz(n), 1.8, t60=1.6, damp=.3, pos=.12, exc_lp=6500), t0 + .011 * j, (j - 2.5) * .12,
                  g * (.75 if j < 2 else 1))
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


def build():
    """Returns (music_a1, music_rest, sfx_a1, sfx_rest, duck_db curve, cues [(t, kind, role, start, dry signal)])."""
    s1, s2, cues = np.zeros((N, 2)), np.zeros((N, 2)), []
    duck = np.zeros(N)
    for t, kind, p, role in SFX_CUES:
        rng = np.random.default_rng(SEED + int(round(t * 1000)) + sum(map(ord, kind)))
        sig, lead = globals()[kind](rng, **{k: v for k, v in p.items() if k != "gain"})
        sig = sig * SFX_GAIN[kind] * p.get("gain", 1.0)
        place(s1 if t < ACT1_END else s2, sig, t - lead)
        cues.append((t, kind, role, int(round((t - lead) * SR)), sig))
        dd = DUCK_DB.get(kind, 0)
        if dd:  # duck the music by the shape of this cue's own envelope (8 ms look-ahead)
            e = maximum_filter1d(np.abs(sig).max(1), int(.03 * SR))
            e = np.minimum(1, e / (e.max() * .5)) * dd
            i = int(round((t - lead - .008) * SR))
            e = e[max(0, -i):]
            i = max(i, 0)
            n = min(len(e), N - i)
            duck[i:i + n] = np.maximum(duck[i:i + n], e[:n])
    d = duck.reshape(-1, 48).max(1)  # 1 kHz control rate: instant attack, ~70 ms release
    for i in range(1, len(d)):
        d[i] = max(d[i], d[i - 1] * .986)
    duck = uniform_filter1d(np.repeat(uniform_filter1d(d, 4), 48), 96)
    s1 = reverb(s1, room_size=.2, damping=.6, wet_level=.07, dry_level=1, width=.7)
    s2 = reverb(s2, room_size=.25, damping=.55, wet_level=.08, dry_level=1, width=.8)
    return act1_music(), act2_music() + act3_music(), s1, s2, duck, cues


def lowshelf(x, f0, gain_db):  # RBJ low shelf, S = 1
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    al, c = np.sin(w) / np.sqrt(2), np.cos(w)
    r = 2 * np.sqrt(A) * al
    b = [A * ((A + 1) - (A - 1) * c + r), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - r)]
    a = [(A + 1) + (A - 1) * c + r, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - r]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def master(m1, m2, s1, s2, duck, ceil_db):
    """Cleanup filters, dead cut at ACT1_END (after the filters, so the gap is digital zero), ducking, end fade,
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
    a, b = int(17.15 * SR), int(17.92 * SR)
    fade[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2
    fade[b:] = 0
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


def verify(out, mu, g, cues, dec):
    """Each cue is measured on its own (dry, times the master gain), against the final music stem."""
    import librosa
    mono = out.mean(1)
    lib = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=SR, hop_length=128, units="time", backtrack=False)
    swells = {"swish", "glide", "flood", "swish_big"}
    print("\n  cue(s)  event          role  onset(s)  err ms  | mix onset  err ms | peak(s) | SFX over music dB")
    rows = []
    for t, kind, role, i0, sig in cues:
        x = np.zeros((N + len(sig), 2))
        x[i0:i0 + len(sig)] = sig * g[i0:i0 + len(sig), None] if i0 + len(sig) <= N else \
            np.r_[sig[:N - i0] * g[i0:, None], sig[N - i0:] * 0]
        x = x[:N]
        e = uniform_filter1d(np.abs(x[i0:i0 + len(sig)]).max(1), int(.001 * SR))
        on = (i0 + np.argmax(e > e.max() * 10 ** ((-30 if kind in swells else -15) / 20))) / SR
        pk = (i0 + np.argmax(uniform_filter1d(e, int(.03 * SR)))) / SR
        if kind in swells:
            a, b = (pk - .12, pk + .03) if kind == "flood" else (pk - .08, pk + .08)
            mo = np.nan
        else:
            a, b = on, {"chat_chaos": ACT1_END, "badge_pings": on + .45, "win": on + .3}.get(kind, on + .12)
            near = lib[np.abs(lib - on) < .05]
            mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        mdb = krms_db(mu, a, b)
        rel = krms_db(x, a, b) - mdb
        rel_s = "music silent" if mdb < -90 else f"{rel:+6.1f}"
        mo_s = f"{mo:9.3f}  {1000 * (mo - on):+5.0f}" if mo == mo else "      —      "
        print(f"  {t:6.3f}  {kind:<13} {role:>4}  {on:7.3f}   {1000 * (on - t):+5.0f}  | {mo_s} | {pk:7.3f} | {rel_s}")
        rows.append((t, kind, role, on, mo, pk, rel))
        if kind == "sonic_logo":
            on2 = onset_in(x, t + .15, -.03, .05)
            print(f"  {t + .15:6.3f}    clink #2          {on2:7.3f}   {1000 * (on2 - t - .15):+5.0f}")
    beats = [bt(b) for b in range(0, 15) if not END_CARD <= bt(b) < bt(12)]
    errs = [1000 * (lib[np.argmin(np.abs(lib - x))] - x) for x in beats]
    print(f"\n  groove: {sum(abs(e) < 25 for e in errs)}/{len(beats)} quarter-note beats 8.5-15.5 s (excl. the drumless "
          f"end-card bar) have a mix onset within 25 ms (median {np.median(errs):+.0f} ms); "
          f"no onset at: {[round(b, 2) for b, e in zip(beats, errs) if abs(e) >= 25] or 'none'}")
    i0, i1 = int((ACT1_END + .004) * SR), int((NOTIFICATION - .002) * SR)
    for name, x in (("WAV", out), ("MP3", dec)):
        gap = 20 * np.log10(np.abs(x[i0:i1]).max() + 1e-12)
        tail = 20 * np.log10(np.abs(x[int(17.95 * SR):]).max() + 1e-12)
        clip = int((np.abs(x) >= .999).sum())
        print(f"  {name}: {len(x)} samples = {len(x) / SR:.4f} s | dead-cut gap {ACT1_END + .004:.3f}-{NOTIFICATION - .002:.3f} s "
              f"peak {gap:.1f} dBFS | last 50 ms peak {tail:.1f} dBFS | samples >= 0.999: {clip}")
    L, R = out[:, 0], out[:, 1]
    corr = np.corrcoef(L, R)[0, 1]
    mono2 = np.stack([mono, mono], 1)
    seg = lambda x, a, b: x[int(a * SR):int(b * SR)]
    print(f"  mono: L/R correlation {corr:+.2f}; mono fold-down {lufs(mono2) - lufs(out):+.2f} dB vs stereo "
          f"(ACT1 {lufs(seg(mono2, 0, 4.8)) - lufs(seg(out, 0, 4.8)):+.2f}, ACT3 {lufs(seg(mono2, 8.5, 16)) - lufs(seg(out, 8.5, 16)):+.2f})")
    f, _, Z = stft(mono, SR, nperseg=4096)
    p = (np.abs(Z) ** 2).sum(1)
    print("  energy share: " + ", ".join(f"{a}-{b} Hz {100 * p[(f >= a) & (f < b)].sum() / p.sum():.0f}%"
                                         for a, b in [(0, 150), (150, 5000), (5000, 24000)]))
    phone = filt(filt(out, "highpass", 300, 4), "lowpass", 8000, 4)
    tempo, _ = librosa.beat.beat_track(y=seg(phone, 8.5, 16).mean(1).astype(np.float32), sr=SR, hop_length=256, start_bpm=100)
    print(f"  phone-speaker sim (HPF 300 Hz, LPF 8 kHz): loudness {lufs(phone) - lufs(out):+.1f} dB vs full; "
          f"ACT3 tempo estimate {float(np.atleast_1d(tempo)[0]):.1f} BPM")
    print("  short-term loudness (3 s windows, LUFS): " + "  ".join(
        f"{c:.1f}s {lufs(seg(out, max(0, c - 1.5), c + 1.5)):.1f}" for c in (1.5, 3.3, 6.0, 7.5, 10, 12.5, 15, 16.5)))
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    MP3.parent.mkdir(parents=True, exist_ok=True)
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
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(WAV), "-lavfi",
                    "showspectrumpic=s=1800x700:legend=1:scale=log:fscale=log:stop=12000:color=intensity", str(OUT / "spectrogram.png")], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels",
                          "-of", "compact", str(MP3)], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
    print(f"limiter ceiling {ceil:.2f} dBFS (4x oversampled)")
    print(f"{WAV.relative_to(REPO)}: I {Iw:.1f} LUFS, TP {tpw:.1f} dBTP, LRA {lraw:.1f} LU (ffmpeg ebur128); own meter {lufs(out):.2f} LUFS")
    print(f"{MP3.relative_to(REPO)}: I {I:.1f} LUFS, TP {tp:.1f} dBTP, LRA {lra:.1f} LU; {dur}")
    verify(out, mu, g, cues, dec)


if __name__ == "__main__":
    main()
