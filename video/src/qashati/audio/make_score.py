#!/usr/bin/env python3
"""Original music bed + synced SFX for the 16 s Qashati Alsham ("The Sweet Happiness") vertical ad.

    python3 video/src/qashati/audio/make_score.py
      -> video/public/qashati/audio/layers.mp3   48 kHz stereo, 192 kbps, 16.0 s, -14 LUFS, <= -1 dBTP
      -> video/out/qashati/layers.wav             24-bit copy for inspection

Everything is synthesized from sines and seeded noise: no samples, no borrowed melodies, so the brand
owns the result. F major, 120 BPM, 8 bars of 2.0 s. Move sound effects by editing SFX_CUES (seconds);
the music is laid out by the constants below it. Output is bit-identical run to run (fixed seeds).
"""
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Pedalboard, Reverb
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, istft, lfilter, resample_poly, sosfilt, stft

REPO = Path(__file__).resolve().parents[4]
MP3, WAV = REPO / "video/public/qashati/audio/layers.mp3", REPO / "video/out/qashati/layers.wav"
SR, DUR, BPM, SEED = 48000, 16.0, 120, 2026
N, BEAT = int(SR * DUR), 60 / BPM
BAR, S16 = 4 * BEAT, BEAT / 4
TARGET_LUFS, CEILING_DBTP, DUCK_DB = -14.0, -1.7, 4.0  # ceiling leaves headroom for MP3 overshoot

# ---- SFX timeline: (seconds, kind, params). Whoosh-type cues start at their time. ----
SFX_CUES = [
    (0.00, "whoosh", dict(dur=0.50, f0=300, f1=4500, peak=0.45)),  # cup springs in (upward)
    (0.60, "plop", {}),                                           # cream dollop lands
    (1.25, "pop", dict(note="C5", pan=-0.3)),                     # fruit pieces, rising
    (1.45, "pop", dict(note="D5", pan=0.3)),
    (1.65, "pop", dict(note="F5", pan=-0.3)),
    (1.85, "pop", dict(note="G5", pan=0.3)),
    (2.05, "pop", dict(note="A5", pan=-0.3)),
    (2.25, "pop", dict(note="C6", pan=0.3)),
    (2.80, "gloop", {}),                                          # thick cream
    (4.20, "pop", dict(note="D6", pan=0.3)),                      # more fruit, falling
    (4.45, "pop", dict(note="C6", pan=-0.3)),
    (4.70, "pop", dict(note="Bb5", pan=0.3)),
    (4.95, "pop", dict(note="F5", pan=-0.3)),
    (5.20, "drizzle", dict(dur=1.20)),                            # honey
    (6.40, "sprinkle", dict(dur=1.00, n=14)),                     # nuts
    (7.60, "ding", {}),                                           # hero sparkle
    (8.00, "swap", dict(note="F5", pan=-0.25)),                   # topping swaps: whoosh + pop @ +0.12
    (9.10, "swap", dict(note="A5", pan=0.25)),
    (10.20, "swap", dict(note="D6", pan=-0.25)),
    (11.30, "swap", dict(note="F6", pan=0.25)),
    (12.40, "whoosh", dict(dur=0.80, f0=5000, f1=250, peak=0.8)),  # downward wipe of dripping cream...
    (13.20, "splash", {}),                                        # ...into the splash
    (13.25, "drop", dict(note="C6", pan=-0.25)),                  # logo dot 1
    (13.45, "drop", dict(note="F6", pan=0.25)),                   # logo dot 2
    (14.70, "chime", {}),                                         # call to action
]
SFX_GAIN = dict(whoosh=0.55, plop=0.8, pop=0.55, gloop=0.75, drizzle=0.32, sprinkle=0.45, ding=0.42,
                swap=0.5, splash=0.7, drop=0.5, chime=0.4)

# ---- music ----
CHORDS = {"F": ("F2", "F4 A4 C5 F5 A5"), "Dm": ("D2", "D4 F4 A4 D5 F5"),  # (bass root, marimba voicing)
          "Bb": ("Bb1", "D4 F4 Bb4 D5 F5"), "C": ("C2", "E4 G4 C5 E5 G5")}
BARS = ["F", "Dm", "Bb", "C", "F", "Dm"]      # bar 1 = intro (marimba + shaker crescendo), 2-6 = groove
GROOVE = [(0, 0, 1.0), (3, 2, .7), (6, 1, .8), (8, 3, .9), (11, 2, .7), (14, 4, .8)]  # (16th, voice, vel)
BASSLINE = [(0, 0, 1.0), (6, 0, .6), (8, 7, .8), (14, 12, .55)]                        # (16th, semis, vel)
MELODY = [(8.0, "C6"), (8.375, "A5"), (8.75, "C6"), (9.0, "F6"), (9.5, "E6"), (9.75, "C6"),  # bars 5-6
          (10.0, "D6"), (10.5, "A5"), (10.75, "F5"), (11.0, "A5"), (11.25, "G5"), (11.625, "F5"), (11.75, "E5")]
CADENCE = [(12.0, "Bb"), (12.5, "C")]                  # bar 7 stabs, then a breath under the wipe
PICKUP = [(12.825, "C5"), (12.95, "E5"), (13.075, "G5")]
SPARKLES = [(3.5, "F6 A6"), (13.2, "A6 C7 F7")]        # glockenspiel accents (rolled)
HIT_T, DRUMS_END, FADE = 13.2, 12.5, 0.6
MARIMBA = [(1, 1, 1), (3.93, .35, .14), (9.2, .08, .05)]  # (partial ratio, amp, decay factor)
KALIMBA = [(1, 1, 1), (5.9, .25, .1), (2.0, .08, .5)]
GLOCK = [(1, 1, 1), (2.76, .3, .35), (5.4, .1, .15)]
BELL = [(1, 1, 1), (2.0, .3, .6), (3.0, .1, .35), (4.16, .05, .2)]
RNG = np.random.default_rng(SEED)


def hz(note):  # "Bb4" -> 466.16
    pc = "C D EF G A B".index(note[0]) + note[1:].count("#") - note[1:].count("b")
    return 440 * 2 ** ((pc + 12 * (int(note[-1]) + 1) - 69) / 12)


def tt(d): return np.arange(int(d * SR)) / SR
def env(t, a, d): return np.minimum(t / a, 1) * np.exp(-np.maximum(t - a, 0) / d)  # attack, decay const
def osc(f): return np.sin(2 * np.pi * np.cumsum(f) / SR)                          # f: Hz per sample
def noise(d): return RNG.standard_normal(int(d * SR))
def norm(x): return x / (np.abs(x).max() + 1e-12)
def filt(x, kind, fc, order=2): return sosfilt(butter(order, fc, kind, fs=SR, output="sos"), x, axis=0)
def delay(x, s): return np.concatenate([np.zeros(int(s * SR)), x])


def pan2(sig, pan=0.0):  # constant-power pan; pan may be an array (moving sources)
    th = (np.clip(np.broadcast_to(pan, sig.shape), -1, 1) + 1) * np.pi / 4
    return np.stack([sig * np.cos(th), sig * np.sin(th)], 1)


def place(buf, sig, t, pan=0.0, v=1.0):
    i = int(round(t * SR))
    n = max(0, min(len(sig), len(buf) - i))
    buf[i:i + n] += v * (pan2(sig, pan) if sig.ndim == 1 else sig)[:n]


def tone(note, parts=MARIMBA, d=None, length=None):  # additive mallet/bell voice
    f = hz(note)
    d = d or .55 * (440 / f) ** .5  # low bars ring longer
    t = tt(length or min(5 * d, 3.0))
    return sum(a * np.sin(2 * np.pi * f * r * t) * env(t, .0015, d * k) for r, a, k in parts if f * r < 9000)


def pluck(f, d=.3, length=1.0):  # soft plucked bass: harmonics decay faster than the fundamental
    t = tt(length)
    return sum(np.sin(2 * np.pi * f * k * t) / k * env(t, .004, d / k ** .6) for k in range(1, 7))


def kick(): t = tt(.3); return osc(50 + 100 * np.exp(-t / .025)) * env(t, .001, .09)
def shaker(): t = tt(.1); return norm(filt(noise(.1), "bandpass", [4500, 9500])) * env(t, .01, .022)


def snap():  # two close noise bursts = finger snap / light clap
    t = tt(.18)
    e = env(t, .0005, .025) + .6 * env(np.maximum(t - .011, 0), .0005, .04) * (t > .011)
    return norm(filt(noise(.18) * e, "bandpass", [1100, 4200]))


def swept(d, f0, f1, width=.5):  # noise band whose centre glides exponentially f0 -> f1
    f, ts, Z = stft(noise(d + .05), SR, nperseg=1024)
    fc = f0 * (f1 / f0) ** np.clip(ts / d, 0, 1)
    Z = Z * np.exp(-.5 * (np.log2(np.maximum(f, 20)[:, None] / fc) / width) ** 2)
    return norm(istft(Z, SR, nperseg=1024)[1][:int(d * SR)])


# ---- SFX voices (return mono or stereo, starting at the cue time) ----
def whoosh(dur, f0, f1, peak=.45, pan=(-.4, .4)):
    t = tt(dur)
    swell = np.sin(np.pi * np.clip(t / dur, 1e-9, 1) ** (np.log(.5) / np.log(peak)))
    e = np.minimum(t / .012, 1) * (.3 + .7 * swell) * np.minimum((dur - t) / .03, 1)
    return pan2(swept(dur, f0, f1) * e, np.linspace(*pan, len(t)))


def pop(note, pan=0.0):  # bubble: quick upward chirp that settles on a tuned pitch
    f, t = hz(note), tt(.16)
    fr = f * (1 - .35 * np.exp(-t / .012))
    return pan2((osc(fr) + .15 * osc(2 * fr)) * env(t, .001, .035), pan)


def plop():
    t = tt(.45)
    body = osc(330 * (1 - .5 * np.exp(-t / .02))) * env(t, .002, .07)
    thump = osc(60 + 80 * np.exp(-t / .015)) * env(t, .001, .08)
    return .9 * body + .7 * thump + .2 * norm(filt(noise(.45), "lowpass", 1400)) * env(t, .002, .04)


def gloop():  # lower, longer, rounder than the plop, with a sticky wobble and a second small bubble
    t = tt(.7)
    wob = 1 + .06 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / .15)
    a = osc(230 * (1 - .5 * np.exp(-t / .045)) * wob) * env(t, .004, .16)
    b = delay(osc(300 * (1 - .45 * np.exp(-t / .03))) * env(t, .003, .07), .14)[:len(t)]
    thump = osc(55 + 60 * np.exp(-t / .02)) * env(t, .002, .12)
    return a + .45 * b + .6 * thump + .15 * norm(filt(noise(.7), "lowpass", 700)) * env(t, .005, .1)


def drizzle(dur):  # glossy stream: narrow noise band + soft detuned sine glide, drifting L -> R
    t = tt(dur)
    e = np.minimum(t / .04, 1) * np.minimum((dur - t) / .4, 1) * (.85 + .15 * np.sin(2 * np.pi * 1.3 * t))
    f = 700 * 2 ** (.5 * t / dur) * (1 + .006 * np.sin(2 * np.pi * 5 * t))
    s = e * (.6 * swept(dur, 1800, 3000, width=.3) + .18 * (osc(f) + osc(f * 1.006)))
    return pan2(s, np.linspace(-.3, .3, len(t))) + .6 * np.pad(pop("F5"), ((0, len(t) - int(.16 * SR)), (0, 0)))


def sprinkle(dur, n):  # jittered grid of tiny woody ticks
    out, t = np.zeros((int((dur + .1) * SR), 2)), tt(.05)
    times = np.clip((np.arange(n) + RNG.uniform(-.35, .35, n)) * dur / n, 0, dur)
    times[0] = 0
    for tk in times:
        f = RNG.uniform(1800, 3600)
        tick = np.sin(2 * np.pi * f * t) * env(t, .0004, .008)
        tick += .5 * norm(filt(noise(.05), "bandpass", [2000, 6000])) * env(t, .0003, .004)
        place(out, tick, tk, RNG.uniform(-.6, .6), RNG.uniform(.6, 1.0))
    return out


def ding():  # hero sparkle: rolled glockenspiel triad + a shimmering high partial
    out, t = np.zeros((int(3.2 * SR), 2)), tt(2.0)
    for k, (note, pan) in enumerate([("F6", -.3), ("A6", 0), ("C7", .3)]):
        place(out, tone(note, GLOCK, d=.9), .03 * k, pan, 1 - .15 * k)
    place(out, np.sin(2 * np.pi * hz("F7") * t) * env(t, .01, .4) * (.6 + .4 * np.sin(2 * np.pi * 13 * t)), .06, 0, .2)
    return out


def swap(note, pan=0.0):
    out = np.zeros((int(.5 * SR), 2))
    place(out, whoosh(.12, 1200, 6000, peak=.7, pan=(-pan, pan)), 0, v=.8)
    place(out, pop(note, pan), .12, v=1.1)
    return out


def splash():
    t = tt(1.0)
    body = np.stack([norm(filt(noise(1.0), "lowpass", 2200)) for _ in range(2)], 1) * env(t, .003, .09)[:, None]
    thump = osc(45 + 90 * np.exp(-t / .02)) * env(t, .001, .12)
    return pan2(.8 * thump + .3 * norm(filt(noise(1.0), "lowpass", 800)) * env(t, .01, .3)) + .45 * body


def drop(note, pan=0.0):  # plink: short upward settle onto a tuned note
    f, t = hz(note), tt(.6)
    fr = f * (1 - .3 * np.exp(-t / .008))
    return pan2(osc(fr) * env(t, .001, .15) + .2 * osc(2 * fr) * env(t, .001, .05), pan)


def chime():
    out = np.zeros((int(1.9 * SR), 2))
    for k, (note, pan, v) in enumerate([("C6", -.2, 1), ("F6", .2, .9), ("A6", 0, .35)]):
        place(out, tone(note, BELL, d=.7, length=1.8), .07 * k, pan, v)
    return out


def sfx():
    global RNG
    buf = np.zeros((N, 2))
    for t, kind, p in SFX_CUES:
        RNG = np.random.default_rng(SEED + int(t * 1000))  # per-cue seed: moving one cue changes only it
        place(buf, globals()[kind](**p), t, v=SFX_GAIN[kind])
    return Pedalboard([Reverb(room_size=.2, damping=.6, wet_level=.07, dry_level=1, width=.8)])(buf.T.astype(np.float32), SR).T


def music():
    global RNG
    RNG = np.random.default_rng(SEED)
    mal, bass, drum = (np.zeros((N, 2)) for _ in range(3))
    for b, name in enumerate(BARS):
        (root, voicing), t0 = CHORDS[name], b * BAR
        for k, (pos, idx, v) in enumerate(GROOVE):
            vel = v * (.25 + .5 * pos / 16 if b == 0 else 1)  # intro crescendo
            place(mal, tone(voicing.split()[idx]), t0 + pos * S16, (-.25, .25)[k % 2], vel)
        if b == 0:
            continue
        for pos, semi, v in BASSLINE:
            place(bass, pluck(hz(root) * 2 ** (semi / 12)), t0 + pos * S16, 0, v)
        for beat in (0, 2):
            place(drum, kick(), t0 + beat * BEAT)
        for beat in (1, 3):
            place(drum, snap(), t0 + beat * BEAT, .2, .3)
    for t, name in CADENCE:
        root, voicing = CHORDS[name]
        for note in voicing.split():
            place(mal, tone(note), t, 0, .3)
        place(bass, pluck(hz(root)), t, 0, .9)
    place(drum, kick(), CADENCE[0][0])
    place(drum, snap(), CADENCE[1][0], .2, .3)
    for t, note in MELODY + PICKUP:
        place(mal, tone(note, KALIMBA), t, .15, .5)
    for k in range(int(DRUMS_END / (BEAT / 2))):  # shaker 8ths, offbeats accented, fading in over bar 1
        place(drum, shaker(), k * BEAT / 2, -.35, .12 * min(.3 + k / 8, 1) * (1 if k % 2 else .55))
    root, voicing = CHORDS["F"]  # the resolving hit, left to ring out
    for note in ["F3"] + voicing.split():
        place(mal, tone(note, d=1.1 * .55 * (440 / hz(note)) ** .5), HIT_T, 0, .45)
    place(bass, pluck(hz(root), d=.8, length=2.8), HIT_T, 0, 1)
    place(drum, kick(), HIT_T, 0, .7)
    t = tt(DUR - HIT_T)
    pad = sum(np.sin(2 * np.pi * hz(n) * t) + np.sin(2 * np.pi * hz(n) * 1.004 * t) for n in "F3 A3 C4 F4".split())
    place(mal, pad * env(t, .08, 1.4), HIT_T, 0, .05)
    for t, notes in SPARKLES:
        for j, note in enumerate(notes.split()):
            place(mal, tone(note, GLOCK, d=.8), t + .04 * j, (j - 1) * .3, .12)
    bed = .22 * filt(mal, "lowpass", 8000) + .3 * bass + .5 * drum
    return Pedalboard([Reverb(room_size=.3, damping=.5, wet_level=.12, dry_level=.9, width=1)])(bed.T.astype(np.float32), SR).T


def lufs(x):  # ITU-R BS.1770-4 integrated loudness (48 kHz K-weighting, gated)
    k = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, .73248077421585], x, axis=0)
    k = lfilter([1, -2, 1], [1, -1.99004745483398, .99007225036621], k, axis=0)
    ms = np.array([(k[i:i + 19200] ** 2).mean(0).sum() for i in range(0, len(k) - 19200 + 1, 4800)])
    ms = ms[ms > 10 ** ((-70 + .691) / 10)]
    ms = ms[ms > ms.mean() * .1]
    return -.691 + 10 * np.log10(ms.mean())


def limiter_gain(x, ceil_db, attack=.004, hold=.04):  # look-ahead gain curve against 4x-oversampled peaks
    pk = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)[:4 * len(x)].reshape(-1, 4).max(1)
    need = np.minimum(1, 10 ** (ceil_db / 20) / np.maximum(pk, 1e-9))
    w, h = int(attack * SR), int(hold * SR)
    g = minimum_filter1d(need, w + h + 1)
    g = uniform_filter1d(np.concatenate([np.full(h // 2, g[0]), g[:len(g) - h // 2]]), w)
    assert np.all(g <= need + 1e-9)
    return g


def master(music_bus, sfx_bus):
    """Duck music under SFX, shape, fade, normalise to TARGET_LUFS under the true-peak ceiling.
    Returns (out, music_part, sfx_part) with out == music_part + sfx_part."""
    lev = uniform_filter1d(maximum_filter1d(np.abs(sfx_bus).max(1), int(.02 * SR)), int(.06 * SR))
    music_bus = music_bus * (10 ** (-DUCK_DB * np.clip(lev / (.3 * lev.max()), 0, 1) / 20))[:, None]
    shape = lambda x: filt(filt(x, "highpass", 25), "lowpass", 14000)  # no DC / sub rumble, no fizz
    m, s = shape(music_bus), shape(sfx_bus)
    fade = np.ones(N)
    fade[-int(FADE * SR):] = np.cos(np.linspace(0, np.pi / 2, int(FADE * SR))) ** 2
    fade[:int(.003 * SR)] = np.linspace(0, 1, int(.003 * SR))
    mix, gain = (m + s) * fade[:, None], 1.0
    for _ in range(6):
        gain *= 10 ** ((TARGET_LUFS - lufs(mix * gain * limiter_gain(mix * gain, CEILING_DBTP)[:, None])) / 20)
    g = (gain * limiter_gain(mix * gain, CEILING_DBTP) * fade)[:, None]
    return g * (m + s), g * m, g * s


def main():
    out, _, _ = master(music(), sfx())
    WAV.parent.mkdir(parents=True, exist_ok=True)
    MP3.parent.mkdir(parents=True, exist_ok=True)
    sf.write(WAV, out, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(WAV), "-c:a", "libmp3lame", "-b:a", "192k",
                    "-ar", str(SR), "-ac", "2", str(MP3)], check=True)
    tp = 20 * np.log10(np.abs(resample_poly(out, 4, 1, axis=0)).max())
    print(f"{WAV.relative_to(REPO)}  {len(out) / SR:.3f} s  {lufs(out):.2f} LUFS  true peak {tp:.2f} dBTP")
    print(f"{MP3.relative_to(REPO)}  (192 kbps; verify with: ffmpeg -i {MP3.name} -af ebur128=peak=true -f null -)")


if __name__ == "__main__":
    main()
