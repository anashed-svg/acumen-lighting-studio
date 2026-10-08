#!/usr/bin/env python3
"""Soundtrack for «ضيوف فجأة» (Qashati 2D, spot «guests»): 480 frames = 16.000 s, original synthesis, deterministic.

    nice -n 10 python3 video/src/qashati2d/guests/audio/make_sound.py
      -> video/public/qashati2d/audio/guests.mp3   48 kHz stereo, 192 kbps, exact spot length, -14 LUFS, <= -1 dBTP
      -> video/out/qashati2d/guests.wav             24-bit master (mux this one for delivery)
      -> video/out/qashati2d/guests/sound/          stems, onset table (cues.txt / cues.json), verify report,
                                                    overview/zoom plots, phone-band WAV, preview-half.mp4

TIMING IS NOT COPIED. spec.ts (T, CUES) and the kit end card's cues.ts (EC) are evaluated with esbuild + node at run
time (sfx.ts_eval), so if a cue moves in spec.ts the sound follows on the next run. Every music grid is derived from
cues: the peephole vamp runs DING → DONG → KID_LEAN → KID_SMUSH → RECOIL, the panic ostinato's eighths ARE the clock
ticks, the salon waltz's three beats ARE the three coffee pours, the feast groove's quarters ARE the spoon digs, and
the end-card bars run end card → CTA → comment pop → dot hop. One picture rule is mirrored on purpose: props move on
twos, so a door that swings «at» its cue is first drawn swung one two later (TWOS = 2, see doorAngle() in
shots/Fridge.tsx and shots/Door.tsx; measured on the render). The fridge seal strains on FRIDGE_YANK and lets go with
the drawn swing. The front door's hinge creaks from DOOR_SWING, and its air arrives with the drawn swing.

Everything is synthesized from sines, seeded noise, Karplus-Strong strings, modal resonators and a small additive
formant-voice engine. There are no samples and no borrowed melodies. The sonic logo «تشك-تشك» comes from the shared
kit (sfx.sonic_logo / sfx.endcard_sfx, fixed brand seed), so it is sample-identical to spot #2. It plays twice: as
THE DOORBELL when the qashati arrives (ARRIVAL_SONIC_LOGO, out of true silence), and on the end card's two logo dots.

THE MUSIC: «domestic panic comedy → warm hospitality». The house band is a Levantine clarinet (the host's nerves,
later his warm welcome), a santur (hammered dulcimer: the salon's manners), a pizzicato double bass, a xylophone, a
daf with ring chains, a Khaleeji-style clap section, a riq and the guests' own voices. The motif is the DOORBELL:
F#6 → D6 «دينغ-دونغ», a falling third that lands on D, the sonic logo's own note.
  PEEPHOLE 0-50    the chime on frame 0 IS the hook. On «دونغ!» a low «gulp» hit, then a tiptoe pizzicato vamp
                   that creeps down chromatically under the muffled chatter through the door. The clarinet winds up
                   with the boy (KID_LEAN), steps aside for the glass squeak (KID_SMUSH), then a tutti stab on RECOIL
                   and a clarinet «waaah» that falls into the whip.
  FRIDGE 50-110    a xylophone panic run with the whip, a santur tremolo D/Eb as the hand grabs, a rip up as the
                   door is yanked: HOPE. The fridge light comes on to a «heavenly» choir and the choir RUNS ON THE
                   FRIDGE LIGHT: it cuts out with each flicker and comes back flatter and weaker, then dies at
                   DEAD_BEAT. Only the compressor hum is left (the hum is the joke). The lemon rolls, clinks the egg,
                   and the bulb pops. The hum dies with it.
  CLOCK 110-168    panic in maqam saba (D, E half-flat, F, Gb): pizzicato bass and xylophone sixteenths on a grid
                   whose eighths are the accelerating clock ticks. The doorbell double-rings on the ticks
                   (ding-dong… ding-dong). The clarinet trills on the saba quarter-tone. A sus tremolo winds up with
                   the thumb, and on «اطلب» it resolves: a D-major chord, relief, then a clarinet «phew».
  DOOR 168-206     a hushed tremolo under the hinge creak. On «مرحبااا!» the band hits, and the six guests' voices,
                   cheek kisses and khala's bracelets come in. Then a crescendo push as they surge, and a HARD CUT to…
  SALON 206-258    …a polite santur waltz in D whose three beats ARE the three pours. Each finjan makes it more
                   wired: clean eighths, then mordents a little sharp, then tremolo sharper still. WIRED is a
                   rising chromatic tremolo with a fluttering clarinet and a caffeine buzz…
  ARRIVAL 258-292  …FREEZE: 0.4 s of true digital silence. «تشك-تشك» rings as the doorbell. Six heads snap and the guests go
                   «awww». A warm santur swell and a glissando into the whip.
  FEAST 292-375    the payoff: a warm maqsum groove (daf D T . T D . T .) with claps, a walking pizzicato bass, and
                   the clarinet singing the doorbell motif as a hospitality theme. The host's own dig gets the long
                   note. Stop-time on the title: one band hit per word, «ضيوف · فجأة؟ · خلّيها · قشطة.» =
                   B · C# · E · F#, and the last one opens into a held D chord with a choir «aah».
  END 375-480      the kit end-card package on top. The groove comes back at the end card's own tempo, there is a
                   logo break for «تشك-تشك», the CTA stamp is the groove's downbeat, the comment pop is the next
                   one, and the theme rests across the first dot hop (the dots' clack is the button's percussion), then
                   resolves on D just after it. Everything fades to digital zero on the
                   last frame, so the loop restarts cleanly on the frame-0 chime.
Mix for phone speakers: the bass is a saturated pizzicato whose 2nd-5th harmonics carry the line at 150-600 Hz, the
daf's membrane modes sit at 150-500 Hz, and the fridge hum is built from 100 Hz harmonics, so it reads at 200-800 Hz.
Nothing essential sits below 120 Hz, everything is tamed above 7 kHz, and key SFX duck the music by their own
envelope (kit Mixer).

OPTIONAL HUMAN VO (panel lesson "add a human voice"): put phone-recorded lines in audio/vo/ and re-run.
chatter.wav plays at GUEST_CHATTER, hello.wav at CROWD_HELLO, enough.wav at ENOUGH_BUBBLE_POP, awww.wav at HEARTS_POP,
mmm1.wav and mmm2.wav at MMM. Each replaces its synthesized voice, and the music ducks 4 dB under it. With no files
there, nothing changes.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import istft, resample_poly, stft

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "kit/audio"))
import sfx  # noqa: E402
from sfx import (SR, body, env, filt, hz, ks, mallet, midi, noise, norm, osc, pan2, peq,  # noqa: E402
                 place, reverb, smooth_rand, swell, swept, tt, tv_band)

VIDEO, REPO = sfx.VIDEO, sfx.REPO
MP3 = VIDEO / "public/qashati2d/audio/guests.mp3"
WAV = VIDEO / "out/qashati2d/guests.wav"
OUT = VIDEO / "out/qashati2d/guests/sound"
PREVIEW_VIDEO = VIDEO / "out/qashati2d/guests/SurpriseGuests-half.mp4"
VO_DIR = HERE / "vo"
SEED = sfx.BRAND_SEED + 3300  # this spot's music; the sonic logo keeps the brand seed inside sfx.sonic_logo


# =============================== timeline: evaluated from the TypeScript sources ===============================
def load_timeline():
    return sfx.ts_eval("import {T, CUES, DURATION, FPS} from './src/qashati2d/guests/spec';\n"
                       "import {EC, ENDCARD_DURATION} from './src/qashati2d/kit/endcard/cues';\n"
                       "console.log(JSON.stringify({T, CUES, DURATION, FPS, EC, ENDCARD_DURATION}));")


TL = load_timeline()
T, C, EC, FPS = TL["T"], TL["CUES"], TL["EC"], TL["FPS"]
assert FPS == sfx.FPS == 30
DUR = TL["DURATION"] / FPS                      # 16.0 s
N = int(round(DUR * SR))


def F(f):  # spec frame -> seconds
    return f / FPS


DING, DONG = C["DOORBELL_DING"], C["DOORBELL_DONG"]
CHAT = tuple(C["GUEST_CHATTER"])
LEAN, SMUSH, RECOIL, WHIP1 = C["KID_LEAN"], C["KID_SMUSH"], C["RECOIL"], C["WHIP_1"]
GRAB, YANK, BULB = C["HAND_GRAB"], C["FRIDGE_YANK"], C["BULB_DIES"]
LON, LOFF = list(C["LIGHT_FLICKER_ON"]), list(C["LIGHT_FLICKER_OFF"])
DEAD = tuple(C["DEAD_BEAT"])
TICKS = list(C["CLOCK_TICKS"])
DB2, TILT, WIND, PRESS, WHIP2 = C["DOORBELL_2"], C["TILT_WHOOSH"], C["THUMB_WIND"], C["THUMB_PRESS"], C["WHIP_2"]
UNLATCH, SWING, HELLO, SURGE = C["DOOR_UNLATCH"], C["DOOR_SWING"], C["CROWD_HELLO"], C["SURGE"]
SOFA = T["sofa"]
POUR_S, POUR_E, EYES = list(C["POUR_START"]), list(C["POUR_END"]), list(C["EYES_WIDE"])
ENOUGH, ENOUGH_POP = C["ENOUGH_SHAKE"], C["ENOUGH_BUBBLE_POP"]
WIRED = tuple(C["WIRED"])
SIL = tuple(C["TRUE_SILENCE"])
LOGO, SNAP, HEARTS = C["ARRIVAL_SONIC_LOGO"], C["HEAD_SNAP"], C["HEARTS_POP"]
WHIP3, FEAST = C["WHIP_3"], C["FEAST_MUSIC"]
DIGS, HPOPS, MMM = list(C["SPOON_DIGS"]), list(C["HEART_POPS"]), list(C["MMM"])
TCW, TAW, TFW = list(C["TITLE_COFFEE_WORDS"]), list(C["TITLE_ARRIVAL_WORDS"]), list(C["TITLE_FINAL_WORDS"])
CARD = C["END_CARD"]
ECG = lambda k: CARD + EC[k]                    # end-card cue -> global frame
LOGO_DOTS = [CARD + d for d in EC["logoDots"]]  # 395 401
CTA = ECG("cta")                                # 421
COMMENT_POP = ECG("comment") + 2                # 443 (the kit plays its pop on the bubble's overshoot)
HOPS = [CARD + d for d in EC["dotHops"]]        # 467 473
LOGO_GAP = .15                                  # the arrival «تشك-تشك» = spot #2's default clack gap
LOGO2 = LOGO + LOGO_GAP * FPS                   # its second clack (frame LOGO + 4.5)

# ---- music grids (frames), all derived from cues
A_BEATS = [DING, DONG, LEAN, SMUSH, RECOIL]                                   # peephole vamp
_iv = TICKS[-1] - TICKS[-2]
_n = max(1, int(round((WIND - TICKS[-1]) / _iv)))
C_GRID = TICKS + [TICKS[-1] + (WIND - TICKS[-1]) * k / _n for k in range(1, _n + 1)]   # eighths = clock ticks
WQ = POUR_S[1] - POUR_S[0]                                                    # salon waltz quarter (= pour spacing)
FQ = DIGS[1] - DIGS[0]                                                        # feast quarter (= dig spacing)
EBARS = [(CARD, (CARD + CTA) / 2), ((CARD + CTA) / 2, CTA), (CTA, COMMENT_POP), (COMMENT_POP, HOPS[0])]
BUTTON = HOPS[0]
DB2_NOTES = [DB2] + [t for t in TICKS if t > DB2][:3]                         # ding-dong… ding-dong ON the ticks
# Props move ON TWOS: a swing that starts at a cue frame keeps its anticipation drawing there and is first drawn swung
# one "two" later (doorAngle() in shots/Fridge.tsx and shots/Door.tsx: t = 0 returns the anticipation angle). Measured
# on the half-res render: the fridge door's big change is f67 -> f68, the front door's f175 -> f176.
TWOS = 2
SWING_FRIDGE = YANK + TWOS                      # 68: the seal lets go («thwock») + the music's hope rip
SWING_DOOR = SWING + TWOS                       # 176: the door's air pushes in (the hinge creak starts on the cue)
assert C_GRID[-1] == WIND and len(DB2_NOTES) == 4


def note_f(n, cents=0.0):
    return (hz(n) if isinstance(n, str) else float(n)) * 2 ** (cents / 1200)


def msum(*xs):
    """Sum mono signals of different lengths."""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


def add(buf, sig, t, v=1.0):
    """Mix a mono signal into a mono buffer at t seconds (clipped to the buffer)."""
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    n = max(0, min(len(sig), len(buf) - i))
    buf[i:i + n] += v * sig[:n]


# =============================== instruments (mono unless noted) ===============================
def legato(notes, atk=.014, rel=.04, tail=.1, glide=.024):
    """notes [(t0, f, dur, vel)] or [(t0, f, dur, vel, f_end)] (s, Hz) -> (pitch curve, amplitude curve) of a
    monophonic line: pitch glides into each note over `glide` s; an optional f_end bends the note over its length."""
    end = max(n[0] + n[2] for n in notes) + tail
    n_ = int(round(end * SR))
    t = np.arange(n_) / SR
    bt, bv = [0.0], [np.log(notes[0][1])]
    for nt in notes:
        t0, f, d = nt[0], nt[1], nt[2]
        if nt is not notes[0]:
            bt += [max(t0 - glide, bt[-1] + 1e-4), max(t0, bt[-1] + 2e-4)]
            bv += [bv[-1], np.log(f)]
        if len(nt) > 4 and nt[4]:
            bt += [max(t0 + .02, bt[-1] + 1e-4), max(t0 + d, bt[-1] + 2e-4)]
            bv += [np.log(f), np.log(nt[4])]
    f = np.exp(np.interp(t, bt, bv))
    a = np.zeros(n_)
    for nt in notes:
        t0, _, d, v = nt[:4]
        a = np.maximum(a, v * np.clip((t - t0) / atk, 0, 1) * np.clip(1 - (t - t0 - d) / rel, 0, 1))
    return f, uniform_filter1d(a, int(.002 * SR))


def clarinet(rng, f, a, vib=.0045, flutter=0.0, bright=1.0):
    """Levantine clarinet: additive, odd harmonics strong and even ones weak in the low register (they come up above
    ~1.5 kHz), louder = brighter, a delayed vibrato, breath. `flutter` = flutter-tongue (the caffeine buzz)."""
    n = len(f)
    t = np.arange(n) / SR
    vdep = vib * np.clip((t - .1) / .25, 0, 1)
    ff = f * (1 + vdep * np.sin(2 * np.pi * 5.4 * t + rng.uniform(0, 6)) + .0012 * smooth_rand(rng, n, 7))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    dyn = np.clip(a, 0, 1)
    s = np.zeros(n)
    for k in range(1, 40):
        fk = ff * k
        m = np.clip((6000 - fk) / 900, 0, 1)
        if m.max() <= 0:
            break
        base = k ** -1.0 if k % 2 else .09 * k ** -.6 * (1 + 4 * np.clip((fk - 1500) / 2000, 0, 1))
        br = (.22 + .78 * dyn) ** (bright * .5 * (k - 1))
        s += m * base * br * np.sin(k * ph + rng.uniform(0, 6))
    breath = norm(filt(noise(rng, n), "bandpass", [1200, 4500]))
    out = norm(s) * a + .03 * breath * a
    if flutter:
        g = .5 + .5 * np.sin(2 * np.pi * 27 * t + .8 * smooth_rand(rng, n, 30))
        out = out * (1 - flutter + flutter * g) + flutter * .05 * breath * a
    out = peq(peq(out, 1450, 2.5, 1.2), 2900, -2.5, 1.0)
    return filt(out, "lowpass", 6500)


def cl_line(rng, notes, **kw):
    f, a = legato(notes, **{k: v for k, v in kw.items() if k in ("atk", "rel", "tail", "glide")})
    return clarinet(rng, f, a, **{k: v for k, v in kw.items() if k in ("vib", "flutter", "bright")})


SANTUR_BODY = [(220, .03, .8), (340, .025, 1.0), (560, .02, .9), (880, .015, .7), (1400, .01, .6), (2300, .008, .4)]


def santur(rng, note, length=1.2, t60=1.5, soft=False, cents=0.0):
    """Santur: four struck strings per course (a few cents apart: the shimmer), light hammers, a trapezoid box."""
    f = note_f(note, cents)
    s = 0
    for k, det in enumerate((-2.2, 1.1, 2.7, -.7)):
        s = s + ks(rng, f * 2 ** (det / 1200), length, t60=t60 * (440 / f) ** .2, damp=.22 if soft else .1,
                   pos=.1 + .025 * k, exc_lp=4500 if soft else 7500)
    t = tt(length)
    ham = norm(filt(noise(rng, len(t)), "bandpass", [1500, 6000])) * env(t, .0002, .0015)
    s = norm(s) + (.1 if soft else .2) * ham
    s = s * np.clip((length - t) / .03, 0, 1)
    return norm(body(s, SANTUR_BODY))


def santur_trem(rng, notes, dur, rate=14.0, v0=.3, v1=1.0, cents=None, soft=True):
    """Santur tremolo: alternating hammers at `rate` Hz across `notes`, velocity v0 -> v1. cents(t) detunes."""
    out = np.zeros(int((dur + .7) * SR))
    k, tc = 0, 0.0
    while tc < dur:
        x = tc / max(dur, 1e-6)
        c = cents(tc) if cents else 0.0
        add(out, santur(rng, notes[k % len(notes)], .6, 1.0, soft, c), tc, (v0 + (v1 - v0) * x) * rng.uniform(.85, 1))
        k += 1
        tc += 1 / rate * rng.uniform(.9, 1.1)
    return out


BASS_BODY = [(98, .04, 1.0), (178, .03, .8), (262, .025, .6), (410, .02, .4), (640, .015, .25)]


def pizz(rng, note, length=.45, dark=.4):
    """Pizzicato double bass: a dark KS pluck + body, saturated so the 2nd-5th harmonics carry it on a phone."""
    f = note_f(note)
    s = ks(rng, f, length + .05, t60=.7, damp=dark, pos=.2, exc_lp=2600)
    t = tt(length + .05)
    s = norm(body(s, BASS_BODY)) + .25 * osc(2 * f * (1 + .02 * np.exp(-t / .01))) * env(t, .002, .04)
    s = np.tanh(1.8 * norm(s)) / np.tanh(1.8)
    s = filt(s, "lowpass", 1700, 4)  # keep the saturation's 2nd-10th harmonics, not its buzz up where the brass clacks live
    return s * np.clip((length + .05 - t) / .04, 0, 1)


def xylo(rng, note, length=.45):
    """Xylophone: hard mallet on a rosewood bar (partials 1 : 3 : 6) + the mallet click."""
    s = mallet(midi(note), [(1, 1, 1), (3.0, .3, .3), (6.0, .07, .15)], d=.14, length=length, attack=.0006)
    t = tt(length)
    return s + .16 * norm(filt(noise(rng, len(t)), "bandpass", [1500, 6000])) * env(t, .0002, .0012)


def daf(rng, kind, v=1.0):
    """Daf with ring chains: D = the deep centre stroke (pitch drop + membrane modes 110-330 Hz, which is what a phone
    hears), T = the rim stroke, K = a muted slap; every stroke shakes the inner rings (a short metal rattle)."""
    j = lambda: rng.uniform(.97, 1.03)
    t = tt(.6)
    if kind == "D":
        f0 = 70 * j()
        s = .7 * osc(f0 * (1 + .55 * np.exp(-t / .015))) * env(t, .001, .17)
        s = s + sum(a * np.sin(2 * np.pi * f0 * r * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                    for r, a, d in [(1.59, .6, .11), (2.14, .5, .08), (2.30, .35, .07), (2.65, .42, .06), (2.92, .3, .05),
                                    (3.5, .25, .04), (4.06, .18, .03), (4.6, .12, .025)])
        s = s + .25 * norm(filt(noise(rng, len(t)), "bandpass", [200, 1500])) * env(t, .0005, .01)
        ra = .22
    elif kind == "T":
        s = sum(a * np.sin(2 * np.pi * f * j() * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(340, .4, .05), (610, .5, .04), (890, .45, .03), (1270, .35, .02), (1800, .25, .015),
                                (2600, .15, .01)])
        s = .7 * s + .55 * norm(filt(noise(rng, len(t)), "bandpass", [800, 5000])) * env(t, .0003, .004)
        ra = .4
    else:
        s = .5 * norm(filt(noise(rng, len(t)), "bandpass", [400, 2500])) * env(t, .0004, .006)
        s = s + .3 * osc(240 * j() * np.ones(len(t))) * env(t, .001, .02)
        ra = .2
    r = np.zeros(len(t))
    for o in rng.uniform(.003, .03, 9):
        t_ = np.maximum(t - o, 0)
        r = r + rng.uniform(.3, 1) * np.sin(2 * np.pi * rng.uniform(2800, 6200) * t_ + rng.uniform(0, 6)) * \
            np.exp(-t_ / rng.uniform(.015, .04)) * (t >= o)
    s = norm(s) + ra * norm(filt(r, "lowpass", 7000))
    return s * v


def claps(rng, n=6, v=1.0, spread=.006):
    """A clap section (Khaleeji style): `n` clappers, each a resonant palm burst, a few ms apart."""
    t = tt(.15)
    out = np.zeros(len(t))
    for _ in range(n):
        o = abs(rng.normal(0, spread))
        t_ = np.maximum(t - o, 0)
        fc = rng.uniform(900, 1800)
        out = out + rng.uniform(.6, 1) * norm(filt(noise(rng, len(t)), "bandpass", [fc / 1.6, fc * 1.6])) * \
            env(t_, .0006, rng.uniform(.008, .016)) * (t >= o)
    out = norm(out) + .25 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6000])) * env(t, .0005, .006)
    return norm(out) * v


def riq(rng, times, level=1.0):
    return sfx.jingles(rng, list(times), level)


# =============================== the formant voice engine (the guests) ===============================
# male formants F1-F4 (Hz) and bandwidths; a speaker's `scale` stretches them (women ~1.16, kids ~1.3)
VOW = {
    "a": ((730, 1150, 2450, 3400), (90, 110, 160, 250)),
    "A": ((880, 1320, 2500, 3500), (120, 140, 180, 260)),   # pharyngeal ح colour
    "e": ((500, 1800, 2500, 3400), (70, 100, 160, 250)),
    "i": ((300, 2200, 2950, 3500), (60, 100, 160, 250)),
    "o": ((560, 900, 2400, 3300), (80, 90, 160, 250)),
    "u": ((330, 820, 2250, 3300), (60, 90, 160, 250)),
    "w": ((650, 1000, 2400, 3300), (90, 100, 160, 250)),    # the «aww» glide
    "m": ((260, 1150, 2300, 3300), (70, 300, 300, 400)),    # nasal murmur
    "r": ((650, 1250, 1800, 3300), (90, 110, 160, 250)),
    "b": ((300, 1000, 2300, 3300), (80, 120, 200, 300)),
    "h": ((500, 1500, 2500, 3400), (120, 150, 200, 280)),
}


def _tract(f, Fs, Bs):  # cascade of 2-pole resonances, unity gain at DC (Klatt)
    g = 1.0
    for Fi, Bi in zip(Fs, Bs):
        g = g * Fi ** 2 / np.sqrt((Fi ** 2 - f ** 2) ** 2 + (Bi * f) ** 2)
    return g


def voice(rng, kf, f0kf, base, scale=1.0, jitter=.005, vib=0.0, shaky=0.0, tilt=1.0):
    """Additive formant voice. kf = [(ms, phone, Av, An, As)] keyframes (voiced / aspiration / sibilant amplitude),
    f0kf = [(ms, ratio)] pitch contour on `base` Hz. Formants glide between keyframes (log), the source is a glottal
    harmonic series (−6 dB/oct net) evaluated through the vocal-tract curve at every harmonic, aspiration is noise
    through the same tract (STFT), and «s» is a 3.5-7 kHz band."""
    end = kf[-1][0] / 1000 + .03
    n = int(round(end * SR))
    t = np.arange(n) / SR
    kt = np.array([k[0] for k in kf]) / 1000
    Fk = np.array([VOW[k[1]][0] for k in kf], float) * scale
    Bk = np.array([VOW[k[1]][1] for k in kf], float) * (.85 + .15 * scale)
    nas = np.array([1.0 if k[1] == "m" else 0.0 for k in kf])
    Av = np.interp(t, kt, [k[2] for k in kf])
    An = np.interp(t, kt, [k[3] for k in kf])
    As = np.interp(t, kt, [k[4] for k in kf])
    Fs = [np.exp(np.interp(t, kt, np.log(Fk[:, i]))) for i in range(4)]
    Bs = [np.interp(t, kt, Bk[:, i]) for i in range(4)]
    nw = np.interp(t, kt, nas)
    f0 = base * np.interp(t, np.array([k[0] for k in f0kf]) / 1000, [k[1] for k in f0kf])
    f0 = f0 * (1 + jitter * smooth_rand(rng, n, 28) + vib * np.sin(2 * np.pi * rng.uniform(5.2, 6.0) * t + rng.uniform(0, 6))
               + shaky * (.018 * np.sin(2 * np.pi * 6.4 * t) + .012 * smooth_rand(rng, n, 9)))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    s = np.zeros(n)
    for k in range(1, 80):
        fk = k * f0
        m = np.clip((5800 - fk) / 900, 0, 1)
        if m.max() <= 0:
            break
        g = _tract(fk, Fs, Bs) * (1 / (1 + (fk / 650) ** 2)) ** (.7 * nw)
        s += m * g * k ** -tilt * np.sin(k * ph + rng.uniform(0, 6))
    shimmer = 1 + .06 * smooth_rand(rng, n, 22)
    act = Av > .4
    s = s / (np.sqrt((s[act] ** 2).mean()) if act.any() else np.abs(s).max() + 1e-9)
    out = s * Av * shimmer
    if An.max() > 0:
        fq, ts, Z = stft(noise(rng, n), SR, nperseg=512)
        G = _tract(fq[:, None], [np.interp(ts, t, x)[None, :] for x in Fs], [np.interp(ts, t, x)[None, :] for x in Bs])
        a = istft(Z * G, SR, nperseg=512)[1][:n]
        a = np.r_[a, np.zeros(n - len(a))]
        act = An > .3
        a = a / (np.sqrt((a[act] ** 2).mean()) if act.any() else np.abs(a).max() + 1e-9)
        out = out + .7 * a * An
    if As.max() > 0:
        sib = filt(noise(rng, n), "bandpass", [3500, 7000], 4)
        out = out + .55 * sib / (np.sqrt((sib ** 2).mean()) + 1e-9) * As
    return filt(out, "lowpass", 7000)


# speakers: (base f0, formant scale, pan, shaky) — the six guests of art/Guest.tsx
SPK = {"amo": (116, 1.0, -.35, 0), "khala": (218, 1.16, .3, 0), "jiddo": (104, .96, -.12, 1.0),
       "teta": (196, 1.12, .12, .6), "walad": (282, 1.28, -.5, 0), "bint": (318, 1.34, .55, 0)}

MARHABA = [(0, "m", 0, 0, 0), (12, "m", .45, 0, 0), (50, "m", .5, 0, 0), (75, "a", 1, .03, 0), (135, "a", 1, .03, 0),
           (148, "r", .55, .02, 0), (164, "r", .6, .02, 0), (178, "A", .18, .75, 0), (222, "A", .2, .6, 0),
           (242, "a", 1, .05, 0), (292, "a", 1, .04, 0), (308, "b", .12, 0, 0), (340, "b", .07, 0, 0),
           (348, "b", .7, .3, 0), (375, "a", 1, .04, 0), (680, "a", .85, .05, 0), (860, "a", .45, .12, 0),
           (960, "a", 0, 0, 0)]
F0_MARHABA = [(0, 1.0), (75, 1.05), (242, 1.12), (300, 1.16), (400, 1.4), (560, 1.3), (800, 1.0), (960, .92)]
AWW = [(0, "a", 0, .25, 0), (50, "a", 1, .04, 0), (230, "w", 1, .04, 0), (480, "o", .85, .05, 0),
       (680, "u", .45, .1, 0), (800, "u", 0, 0, 0)]
F0_AWW = [(0, 1.32), (120, 1.4), (420, 1.15), (800, .88)]
HUM = [(0, "m", 0, 0, 0), (40, "m", .8, 0, 0), (150, "m", .55, 0, 0), (205, "m", 1, 0, 0), (430, "m", .8, 0, 0),
       (540, "m", 0, 0, 0)]
F0_HUM = [(0, 1.0), (150, 1.02), (225, 1.32), (330, 1.26), (540, .94)]
BAS = [(0, "b", 0, 0, 0), (8, "b", .5, .35, 0), (28, "a", 1, .05, 0), (105, "a", .9, .05, 0), (122, "e", .1, 0, .9),
       (215, "e", 0, 0, .5), (235, "e", 0, 0, 0)]
F0_BAS = [(0, 1.25), (60, 1.35), (120, 1.2), (235, 1.1)]


def say(rng, who, kf, f0kf, rate=1.0, pitch=1.0, **kw):
    b, sc, _, sh = SPK[who]
    kf = [(k[0] / rate,) + tuple(k[1:]) for k in kf]
    f0kf = [(k[0] / rate, k[1]) for k in f0kf]
    return voice(rng, kf, f0kf, b * pitch, sc, shaky=.6 * sh + kw.pop("shaky", 0), **kw)


def babble(rng, who, dur, laugh=False):
    """Happy chatter: random CV syllables in phrases, each with its own prosody (it is heard through a door)."""
    out = np.zeros(int((dur + .5) * SR))
    tc = rng.uniform(0, .12)
    while tc < dur - .15:
        ns = int(rng.integers(3, 7))
        kf, fk, t_ = [(0, "a", 0, 0, 0)], [(0, 1.0)], 10.0
        acc = rng.uniform(1.0, 1.3)
        for s in range(ns):
            v = rng.choice(list("aaeiou"))
            c = rng.choice(list("mrbh"))
            d = rng.uniform(120, 210)
            kf += [(t_, c, .3 if c != "h" else .1, .5 if c == "h" else .03, 0), (t_ + 35, v, 1, .03, 0), (t_ + d - 20, v, .9, .03, 0)]
            fk += [(t_ + d / 2, (acc if s == 1 else 1.0) * (1.12 - .1 * s / ns) * rng.uniform(.96, 1.06))]
            t_ += d
        kf += [(t_ + 40, "a", 0, 0, 0)]
        fk += [(t_ + 40, .9)]
        sig = say(rng, who, kf, fk)
        add(out, sig, tc, rng.uniform(.6, 1))
        tc += t_ / 1000 + rng.uniform(.12, .35)
    if laugh:  # «ha-ha-ha-ha»: breathy pulses, pitch falling
        kf, fk = [(0, "A", 0, 0, 0)], [(0, 1.5)]
        for k in range(4):
            o = k * 175
            kf += [(o + 10, "A", .1, .9, 0), (o + 45, "a", 1, .25, 0), (o + 120, "a", .7, .2, 0), (o + 160, "a", 0, .05, 0)]
            fk += [(o + 80, 1.55 - .1 * k)]
        sig = say(rng, who, kf + [(760, "a", 0, 0, 0)], fk + [(760, 1.1)])
        add(out, sig, rng.uniform(.35, .5) * dur, 1.1)
    return out


# =============================== SFX voices: f(rng, **p) -> (audio, lead s) like the kit ===============================
def chime(rng, note="F#6", pan=0.0, v=1.0):
    """One strike of the house chime: the kit doorbell's exact recipe (struck bar + a little room), one note per cue
    so DING and DONG (and the impatient double ring) each sit on their own frame."""
    s = mallet(midi(note), [(1, 1, 1), (3.0, .25, .3), (4.1, .1, .2)], d=.55, length=2.0, attack=.002)
    out = pan2(s * v, pan)
    return out + reverb(out, room_size=.5, damping=.5, wet_level=.25, dry_level=0, width=.7), 0.0


def door_rattle(rng, big=1.0):
    """The front door shakes in its frame (the frame shakes on screen): a low wooden thump + the panel's modes
    (120-650 Hz, what a phone plays) + the latch and the chain rattling."""
    t = tt(.5)
    thump = osc(72 * (1 + .5 * np.exp(-t / .012))) * env(t, .001, .07)
    panel = sum(a * np.sin(2 * np.pi * f * rng.uniform(.97, 1.03) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(122, 1, .08), (188, .8, .07), (262, .7, .05), (410, .5, .04), (655, .35, .03)])
    panel = norm(panel) * np.minimum(t / .001, 1)
    rat = np.zeros(len(t))
    for o in np.sort(rng.uniform(.004, .14, 9)):
        t_ = np.maximum(t - o, 0)
        rat = rat + rng.uniform(.3, 1) * np.exp(-o / .07) * sum(np.sin(2 * np.pi * f * t_) * np.exp(-t_ / .008)
                                                                 for f in rng.uniform(1800, 4800, 2)) * (t >= o)
    s = .5 * thump + .8 * panel + .22 * big * norm(rat)
    return pan2(s * big, 0), 0.0


def chatter(rng, dur, who=("khala", "amo", "teta", "walad", "bint", "jiddo")):
    """GUEST_CHATTER: the six guests talking happily on the landing, heard THROUGH the door (muffled: LPF 800 Hz),
    khala laughs. Swells in after the chime and dies on RECOIL (the host jumps back from the door)."""
    out = np.zeros((int((dur + .6) * SR), 2))
    for k, w in enumerate(who):
        s = babble(np.random.default_rng(SEED + 40 + k), w, dur, laugh=(w == "khala"))
        place(out, s, rng.uniform(0, .15), SPK[w][2] * .6, (1.0, .8, .7, .75, .7, .6)[k])
    out = filt(filt(out, "lowpass", 800, 2), "highpass", 140)
    t = tt(len(out) / SR)
    e = np.clip(t / .25, 0, 1) * np.clip((dur - t) / .08, 0, 1)
    return out * e[:, None], 0.0


def creak(rng, dur, r0, r1, modes, rough=.25):
    """Stick-slip friction: a pulse train whose rate glides r0 -> r1 Hz (irregular), each slip ringing `modes`."""
    n = int(dur * SR)
    out = np.zeros(n + int(.05 * SR))
    tc = 0.0
    while tc < dur:
        x = tc / dur
        r = r0 * (r1 / r0) ** x
        i = int(tc * SR)
        out[i] += rng.uniform(.5, 1)
        tc += 1 / r * (1 + rough * rng.uniform(-1, 1))
    t = tt(.04)
    ir = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) for f, a, d in modes)
    return np.convolve(out, ir)[:len(out)]


def windback(rng, dur=.32):
    """KID_LEAN: the boy winds back — a cartoon rubbery creak that rises (the anticipation)."""
    s = creak(rng, dur, 45, 140, [(720, 1, .006), (1300, .7, .004), (2100, .4, .003)])
    t = tt(len(s) / SR)
    s = norm(s) * np.clip(t / .05, 0, 1) * np.clip((dur + .02 - t) / .05, 0, 1) * (.5 + .5 * t / dur)
    return pan2(s, -.05), 0.0


def glass_squeak(rng, dur=.24):
    """KID_SMUSH: a cheek smushed on the lens — a rubber-on-glass squeal (stick-slip around 1.1-1.5 kHz, wobbling)."""
    t = tt(dur)
    f = 1080 * (1 + .25 * np.minimum(t / .06, 1) + .05 * smooth_rand(rng, len(t), 25)) * (1 - .1 * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .45 * np.sin(2 * ph + .5) + .2 * np.sin(3 * ph + 1.2)
    s = s * (.7 + .3 * np.sign(np.sin(2 * np.pi * 60 * t)))
    s = s * np.clip(t / .008, 0, 1) * np.clip((dur - t) / .04, 0, 1) * (.6 + .4 * np.abs(smooth_rand(rng, len(t), 18)))
    thud = osc(150 * (1 + .4 * np.exp(-t / .01))) * env(t, .001, .04)  # the face hits the glass
    return pan2(filt(s, "lowpass", 5000) + .6 * thud, .05), 0.0


def fog_breath(rng):
    """…and breathes on it: a soft «hhhhh» (aspiration through an «e» tract), the glass fogging."""
    s = say(rng, "walad", [(0, "e", 0, 0, 0), (60, "e", 0, 1, 0), (260, "h", 0, .7, 0), (420, "h", 0, 0, 0)],
            [(0, 1.0), (420, 1.0)])
    return pan2(filt(s, "lowpass", 4000), .05), 0.0


def gasp(rng):
    """RECOIL: the host's startled inhale «hhah!» (we are the host: centred, close) + a little body whoosh back."""
    s = voice(rng, [(0, "A", 0, 0, 0), (18, "A", 0, 1, 0), (110, "a", .05, .85, 0), (150, "w", .3, .4, 0),
                    (215, "w", 0, 0, 0)], [(0, 1.3), (215, 1.45)], 128)
    s = filt(s, "highpass", 350)
    w, _ = sfx.whoosh(rng, .26, False, (.1, -.1))
    out = pan2(s, 0)
    place(out, w, 0, 0, .35)
    return out, 0.0


def whip_pan(rng, dur, peak=.5):
    """A whip pan that PEAKS on the cut (the blur peak): airy noise sweep + a low whomp a phone still plays."""
    t = tt(dur)
    s = swept(rng, dur, 500, 5000, .6, shape=lambda x: x ** .8) * swell(t, dur, peak, a=.02, r=.06)
    whomp = osc(130 * 2 ** (-.9 * t / dur)) * swell(t, dur, peak, a=.02, r=.06)
    return pan2(s + .16 * filt(whomp, "highpass", 80), np.linspace(.65, -.65, len(t))), 0.0


def handle_grip(rng):
    """HAND_GRAB: fingers clamp the fridge's plastic handle: a dull plastic knock + a tiny creak."""
    t = tt(.15)
    knock = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, a, d in [(520, 1, .02), (1240, .6, .012), (2650, .3, .006)])
    cr = creak(rng, .07, 140, 90, [(1500, 1, .004), (2600, .5, .003)])
    out = norm(knock) * np.minimum(t / .0005, 1)
    add(out, .3 * norm(cr), .01)
    return pan2(out, .25), 0.0


def seal_strain(rng):
    """FRIDGE_YANK: the hand pulls, the door is drawn 4° ajar and the rubber seal strains (a small sticky creak)."""
    st = creak(rng, .045, 190, 120, [(420, 1, .006), (900, .5, .004)])
    return pan2(norm(st) * np.hanning(len(st)) ** .3, .2), 0.0


def fridge_yank(rng, knock=F(4)):
    """The first drawn swing (FRIDGE_YANK + one two): the seal lets go — «thwock», a rubbery suction pop, low-mid —
    the door swings (whoosh) and knocks its stop `knock` s later (the bounce + camera shake at FRIDGE_YANK + 6).
    The shelves are EMPTY: one lonely bottle tinks in the door rack."""
    out = np.zeros((int(1.2 * SR), 2))
    t = tt(.3)
    pop = osc(430 * (1 - .45 * (1 - np.exp(-t / .02)))) * env(t, .002, .035)   # «thwop»: up where a phone plays it
    low = osc(170 * (1 - .3 * (1 - np.exp(-t / .02)))) * env(t, .002, .04)
    tch = norm(filt(noise(rng, len(t)), "bandpass", [500, 3000])) * env(t, .0006, .012)
    place(out, pan2(.8 * pop + .4 * low + .7 * tch, .2), 0)
    w, _ = sfx.whoosh(rng, .26, True, (.3, .7))
    place(out, w, .01, 0, .5)
    t2 = tt(.4)
    stop = sum(a * np.sin(2 * np.pi * f * rng.uniform(.97, 1.03) * t2 + rng.uniform(0, 6)) * np.exp(-t2 / d)
               for f, a, d in [(170, 1, .06), (420, .7, .04), (930, .4, .02)])
    place(out, pan2(norm(stop) * np.minimum(t2 / .001, 1), .55), knock, 0, .7)
    for k, o in enumerate((knock + .012, knock + .07, knock + .15)):  # the ketchup bottle, alone in the rack
        t3 = tt(.2)
        tk = sum(np.sin(2 * np.pi * f * t3) * np.exp(-t3 / .03) for f in (2350 * (1 + .03 * k), 3900))
        place(out, pan2(tk, .6), o, 0, .22 * (1 - .3 * k))
    return out, 0.0


def fridge_hum(rng, dur, die):
    """The fridge compressor: a 100 Hz electric hum whose 200-800 Hz harmonics carry it on a phone, a gritty buzz and
    the fan's whir. It powers down when the bulb dies (pitch sags, a relay clunk) at `die` s."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sag = np.where(t < die, 1.0, 2 ** (-.9 * np.clip((t - die) / .12, 0, 1)))
    f0 = 100 * sag * (1 + .002 * smooth_rand(rng, n, 2))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    s = sum(a * np.sin(k * ph + rng.uniform(0, 6)) for k, a in [(1, .5), (2, 1), (3, .7), (4, .55), (5, .4), (6, .3),
                                                                     (7, .2), (8, .15)])
    s = np.tanh(1.5 * norm(s)) * (1 + .12 * smooth_rand(rng, n, 1.5))
    fan = norm(filt(noise(rng, n), "bandpass", [380, 1200])) * (.8 + .2 * np.sin(2 * np.pi * 23 * t))
    e = np.clip(t / .12, 0, 1) * np.where(t < die, 1, np.clip(1 - (t - die) / .12, 0, 1))
    out = (s + .25 * fan) * e
    i = int(die * SR)
    t2 = tt(.12)
    clunk = norm(sum(a * np.sin(2 * np.pi * f * t2) * np.exp(-t2 / d) for f, a, d in [(160, 1, .03), (380, .6, .02),
                                                                                         (900, .3, .01)]))
    out[i:i + len(t2)] += .35 * clunk[:len(out) - i]
    return pan2(out, -.15), 0.0


def fluoro(rng, segs, tail):
    """The fridge light's mains buzz while it is lit (LIGHT_FLICKER_ON/OFF windows); segs = [(on s, off s)] relative to
    the first ON. The starter «tink» on each ON and the click on each OFF are their own cues (fl_on / fl_off)."""
    n = int((tail + .2) * SR)
    t = np.arange(n) / SR
    g = np.zeros(n)
    for a, b in segs:
        g[int(a * SR):int(b * SR)] = 1
    g = uniform_filter1d(g, int(.003 * SR))
    ph = 2 * np.pi * 100 * t
    buzz = np.tanh(3 * sum(np.sin(k * ph + k * .7) / k for k in range(1, 30)))
    buzz = filt(filt(buzz, "highpass", 180), "lowpass", 3500)
    return pan2(norm(buzz) * g * (1 + .3 * smooth_rand(rng, n, 30)), .1), 0.0


def fl_on(rng):
    """LIGHT_FLICKER_ON: the starter's glassy «tink» + the arc striking."""
    t = tt(.08)
    tink = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / .012) + .5 * np.sin(2 * np.pi * 4700 * t) * np.exp(-t / .006)
    arc = norm(filt(noise(rng, len(t)), "bandpass", [1000, 5000])) * env(t, .0003, .004)
    return pan2(.9 * tink + .7 * arc, .1), 0.0


def fl_off(rng):
    """LIGHT_FLICKER_OFF: a dry little electric click as the tube drops out."""
    t = tt(.05)
    return pan2(norm(filt(noise(rng, len(t)), "bandpass", [800, 4000])) * env(t, .0003, .003), .1), 0.0


def mist(rng, dur):
    """Cold mist rolling out: a soft, slow «fff»."""
    t = tt(dur)
    s = swept(rng, dur, 1400, 500, .8) * swell(t, dur, .3, a=.08, r=.3)
    return pan2(s, np.linspace(.1, -.2, len(t))), 0.0


def moth(rng, dur):
    """A moth flutters out of the empty fridge and past the camera, L -> R: papery wing beats (~32 Hz, irregular),
    louder as it passes; a dust puff as it takes off."""
    t = tt(dur)
    wb = np.clip(np.sin(2 * np.pi * np.cumsum(32 * (1 + .25 * smooth_rand(rng, len(t), 6))) / SR), 0, 1) ** 3
    paper = norm(filt(noise(rng, len(t)), "bandpass", [1200, 4500]))
    s = paper * wb * swell(t, dur, .6, a=.05, r=.15) * (.6 + .4 * np.abs(smooth_rand(rng, len(t), 4)))
    out = pan2(s, np.linspace(-.75, .8, len(t)))
    tp = tt(.15)
    puff = norm(filt(noise(rng, len(tp)), "bandpass", [300, 2000])) * env(tp, .004, .03)
    place(out, puff, F(2), -.6, .6)
    return out, 0.0


def lemon_roll(rng, dur):
    """The lemon rolls on the glass shelf: an oblong roll (two bumps a turn), the shelf ringing faintly."""
    t = tt(dur + .1)
    out = np.zeros(len(t))
    tc, k = 0.0, 0
    while tc < dur:
        tb = tt(.06)
        bump = osc(240 * rng.uniform(.9, 1.1) * np.ones(len(tb))) * env(tb, .002, .015)
        shelf = sum(np.sin(2 * np.pi * f * tb + rng.uniform(0, 6)) * np.exp(-tb / .02) for f in (1150, 1730, 2480))
        add(out, .8 * bump + .12 * shelf, tc, .6 + .4 * tc / dur)
        tc += .055 * rng.uniform(.85, 1.15)
    rumble = norm(filt(noise(rng, len(t)), "bandpass", [150, 900])) * np.clip(t / .03, 0, 1) * np.clip((dur - t) / .02, 0, 1)
    return pan2(norm(out) + .3 * rumble, np.linspace(.4, .15, len(t))), 0.0


def egg_clink(rng):
    """LEMON_CLINK: the lemon taps the egg — a tiny hollow shell «tok» — and the egg rocks «tok-tok»."""
    out = np.zeros(int(.5 * SR))
    for o, v, s in ((0, 1, 1.0), (F(4), .45, .9), (F(7), .3, .85)):
        tk = tt(.06)
        x = sum(a * np.sin(2 * np.pi * f * s * tk + rng.uniform(0, 6)) * np.exp(-tk / d)
                for f, a, d in [(1850, 1, .012), (2900, .6, .007), (4300, .25, .004)])
        add(out, norm(x) * np.minimum(tk / .0004, 1), o, v)
    return pan2(out, .15), 0.0


def bulb_pop(rng):
    """BULB_DIES: the filament goes «tink» (a tiny glass ping) with a short electric «zt» and a puff of dark."""
    t = tt(.4)
    tink = np.sin(2 * np.pi * 4100 * t) * np.exp(-t / .05) + .5 * np.sin(2 * np.pi * 6050 * t) * np.exp(-t / .025)
    zt = np.tanh(4 * np.sin(2 * np.pi * 100 * t)) * env(t, .001, .025)
    pf = norm(filt(noise(rng, len(t)), "bandpass", [500, 3000])) * env(t, .001, .02)
    return pan2(.7 * tink + .25 * filt(zt, "highpass", 200) + .3 * pf, .15), 0.0


def clock_tick(rng, tock=False, v=1.0):
    """The wall clock: «tick» (bright) / «tock» (darker), the escapement's tiny double click."""
    t = tt(.12)
    modes = [(1450, .014, 1), (2350, .009, .7), (820, .02, .5), (3700, .005, .35)] if tock else \
        [(2300, .01, 1), (3600, .006, .7), (1250, .014, .5), (5200, .004, .25)]
    s = norm(sum(a * np.sin(2 * np.pi * f * rng.uniform(.98, 1.02) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                 for f, d, a in modes)) * np.minimum(t / .0004, 1)
    s = s + .3 * norm(filt(noise(rng, len(t)), "bandpass", [2000, 6500])) * env(t, .0002, .0012)
    s = s + .3 * np.r_[np.zeros(int(.004 * SR)), s][:len(s)]
    return pan2(s * v, -.2), 0.0


def wind_squeak(rng, dur=.18):
    """THUMB_WIND: the thumb lifts — a tiny rising rubbery wind-up squeak."""
    t = tt(dur)
    f = 620 * 2 ** (1.2 * (t / dur) ** 1.4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + .3 * np.sin(2 * ph)) * (.75 + .25 * np.sin(2 * np.pi * 38 * t))
    return pan2(s * np.clip(t / .02, 0, 1) * np.clip((dur - t) / .02, 0, 1), .1), 0.0


def thumb_press(rng):
    """THUMB_PRESS: a fat glassy TAP on the drawn «اطلب» button + a small bright «pling» (order placed) on A5, under
    the brass to come (the cymbals will land on D)."""
    out = np.zeros((int(1.2 * SR), 2))
    tp, _ = sfx.tap(rng)
    place(out, tp, 0, 0, 1.2)
    t = tt(.2)
    place(out, osc(170 * (1 + .5 * np.exp(-t / .01))) * env(t, .001, .03), 0, .05, .7)
    t2 = tt(1.0)
    f = hz("A5") * (1 - .04 * np.exp(-t2 / .008))
    pl = osc(f) * env(t2, .002, .2) + .25 * osc(2 * f) * env(t2, .002, .1) + .08 * np.sin(2 * np.pi * hz("E7") * t2) * env(t2, .001, .04)
    place(out, pl, .03, .1, .5)
    return out, 0.0


def latch(rng):
    """DOOR_UNLATCH: the handle goes down (click) and the bolt slides out (clack) 3 frames later."""
    out = np.zeros(int(.4 * SR))
    for o, fs, v in ((0, (1900, 3300, 5100), 1.0), (F(3), (1300, 2400, 3900), .8)):
        t = tt(.05)
        x = sum(np.sin(2 * np.pi * f * rng.uniform(.98, 1.02) * t + rng.uniform(0, 6)) * np.exp(-t / d)
                for f, d in zip(fs, (.012, .007, .004)))
        add(out, norm(x) * np.minimum(t / .0003, 1), o, v)
    ts = tt(.05)
    add(out, norm(filt(noise(rng, len(ts)), "bandpass", [1500, 5000])) * swell(ts, .05, .5), .015, .25)
    return pan2(out, .3), 0.0


def door_swing(rng, dur, swing=F(TWOS)):
    """DOOR_SWING: the hinge creaks from the cue (a stick-slip glide up and back down); on the first drawn swing
    (`swing` s later) the door's air pushes in and the warm hallway's room tone opens up behind it."""
    out = np.zeros((int((dur + .6) * SR), 2))
    s = creak(rng, dur * .85, 160, 420, [(620, 1, .008), (1150, .7, .006), (1900, .45, .004), (3000, .2, .003)], .15)
    t = tt(len(s) / SR)
    s = norm(s) * np.clip(t / .04, 0, 1) * np.clip((dur * .85 - t) / .08, 0, 1) * (.7 + .3 * np.sin(np.pi * t / (dur * .85)))
    place(out, s, 0, .25, .8)
    t2 = tt(dur + .5)
    air = norm(filt(noise(rng, len(t2)), "bandpass", [150, 900])) * swell(t2, dur + .5, .45, a=.1, r=.2)
    place(out, air, swing, 0, .35)
    w, _ = sfx.whoosh(rng, dur * .7, True, (.4, -.2))
    place(out, w, swing + .02, 0, .3)
    return out, 0.0


def kiss(rng, pan=0.0):
    """A cheek kiss «mwah» (the Levantine three): a wet lip smack with a small mouth resonance."""
    t = tt(.12)
    sm = norm(filt(noise(rng, len(t)), "bandpass", [600, 4000])) * env(t, .0004, .006)
    cav = osc(rng.uniform(550, 850) * (1 + .3 * np.exp(-t / .01))) * env(t, .001, .02)
    wet = norm(filt(noise(rng, len(t)), "bandpass", [2500, 6000])) * env(np.maximum(t - .004, 0), .0003, .002) * (t > .004)
    return pan2(.8 * sm + .6 * cav + .25 * wet, pan), 0.0


def bracelets(rng, pan=.3):
    """Khala's gold bracelets jingle as she waves."""
    t = tt(.6)
    s = np.zeros(len(t))
    for o, g in zip((0, .03, .07, .12, .19, .27), (1, .8, .7, .55, .4, .25)):
        t_ = np.maximum(t - o, 0)
        for f in rng.uniform(1700, 2600, 2):
            s = s + g * sum(np.sin(2 * np.pi * f * r * t_ + rng.uniform(0, 6)) * np.exp(-t_ / d)
                            for r, d in ((1, .1), (2.71, .06), (4.9, .035)) if f * r < 7000) * (t >= o)
    return pan2(filt(s, "lowpass", 7000) / 3, pan), 0.0


def crowd(rng, kf, f0kf, who=tuple(SPK), spread=.06, rates=(.92, 1.15), level=None, room=.3):
    """Several guests saying the same thing at once (a small crowd): own pitch, rate, onset and pan each."""
    out = np.zeros((int(1.8 * SR), 2))
    for k, w in enumerate(who):
        r = np.random.default_rng(int(rng.integers(1 << 30)))
        o = 0.0 if k == 0 else abs(r.normal(0, spread))
        s = say(r, w, kf, f0kf, rate=r.uniform(*rates), pitch=r.uniform(.96, 1.05))
        place(out, s, o, SPK[w][2], (level or {}).get(w, 1.0) * r.uniform(.8, 1))
    out = peq(out, 2600, 2, 1.0)
    return out + reverb(out, room_size=.35, damping=.5, wet_level=room, dry_level=0, width=.8), 0.0


def hello_crowd(rng):
    """CROWD_HELLO: «مرحبااا!» from all six (khala loudest), then the kisses and khala's bracelets."""
    out, _ = crowd(rng, MARHABA, F0_MARHABA, level={"khala": 1.25, "jiddo": .8, "teta": .8, "bint": .85})
    return out, 0.0


def surge(rng, dur):
    """SURGE: the guests lean in and the camera pushes — a soft rising push of air and clothes."""
    w, _ = sfx.whoosh(rng, dur, True, (-.3, .3))
    t = tt(dur)
    rus = norm(filt(noise(rng, len(t)), "bandpass", [900, 3500])) * (.5 + .5 * np.abs(smooth_rand(rng, len(t), 14))) * swell(t, dur, .5)
    return w + pan2(.25 * rus, 0), 0.0


def pour(rng, dur, cup=1.0, pan=0.0):
    """The dallah pours gahwa into a finjan: the thin stream's patter, the cup's cavity resonance rising as it fills,
    bubbles; the stream stops with two drips. (No delivery here: the coffee comes first.)"""
    t = tt(dur + .3)
    x = np.clip(t / dur, 0, 1)
    on = np.clip(t / .03, 0, 1) * np.clip((dur - t) / .03, 0, 1)
    stream = norm(filt(noise(rng, len(t)), "bandpass", [900, 4200])) * (.6 + .4 * np.abs(smooth_rand(rng, len(t), 40)))
    fc = 650 * cup * 2 ** (1.25 * x ** .8)
    cav = norm(tv_band(noise(rng, len(t)), fc, .16))
    s = (.35 * stream + .8 * cav) * on
    for o in np.sort(rng.uniform(.02, dur - .02, int(42 * dur))):
        tb = tt(.02)
        fb = rng.uniform(1100, 2600) * cup * (1 + .6 * x[int(o * SR)])
        add(s, osc(fb * (1 + .5 * tb / .02)) * env(tb, .001, .004), o, rng.uniform(.15, .4))
    for o in (dur + .06, dur + .17):
        tb = tt(.06)
        add(s, osc(rng.uniform(1500, 1900) * (1 + .3 * tb / .06)) * env(tb, .001, .012), o, .35)
    return pan2(filt(s, "lowpass", 6000), pan), 0.0


def eye_boing(rng, f0=300.0, pan=0.0):
    """EYES_WIDE: a comic «boing-sproing» eye pop (a spring twang that jumps up and wobbles)."""
    t = tt(.4)
    f = f0 * (1 + .55 * (1 - np.exp(-t / .018))) * (1 + .2 * np.sin(2 * np.pi * 17 * t) * np.exp(-t / .1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + .35 * np.sin(2 * ph + .4) + .15 * np.sin(3 * ph + 1)) * env(t, .002, .11)
    tw = norm(filt(noise(rng, len(t)), "bandpass", [1500, 4000])) * env(t, .0003, .003)
    return pan2(filt(s + .15 * tw, "lowpass", 5000), pan), 0.0


def cup_rattle(rng, dur, rate=12.0, pan=-.1, level=1.0):
    """A finjan rattling on its saucer (porcelain): rapid, irregular little ticks with the cup's ring."""
    out = np.zeros(int((dur + .2) * SR))
    tc = 0.0
    while tc < dur:
        tk = tt(.03)
        x = sum(a * np.sin(2 * np.pi * f * rng.uniform(.97, 1.03) * tk + rng.uniform(0, 6)) * np.exp(-tk / d)
                for f, a, d in [(2650, 1, .006), (4150, .6, .004), (1350, .5, .008), (5300, .25, .002)])
        add(out, x * np.minimum(tk / .0003, 1), tc, rng.uniform(.4, 1))
        tc += 1 / rate * rng.uniform(.6, 1.4)
    return pan2(filt(out, "lowpass", 7000) * level, pan), 0.0


def enough_voice(rng):
    """Grandpa's «بس بس!» (enough!) — shaky and old, a bit muffled under his ghutra."""
    out = np.zeros(int(.8 * SR))
    for k, o in enumerate((0, .27)):
        s = say(rng, "jiddo", BAS, F0_BAS, rate=1.0 + .1 * k, pitch=1.0 + .06 * k)
        add(out, s, o, 1 - .1 * k)
    return pan2(filt(out, "lowpass", 6000), SPK["jiddo"][2]), 0.0


def wired_rattle(rng, dur):
    """WIRED: every cup on the sofa rattles at its own (caffeinated) speed, crescendo."""
    out = np.zeros((int((dur + .3) * SR), 2))
    for k, (r, p) in enumerate(((13, -.6), (15, -.3), (11, 0), (17, .3), (14, .55), (19, .75))):
        s, _ = cup_rattle(np.random.default_rng(int(rng.integers(1 << 30))), dur, r, p, .55)
        out[:len(s)] += s
    t = tt(len(out) / SR)
    return out * np.clip(.4 + .6 * t / dur, 0, 1)[:, None], 0.0


def head_snap(rng):
    """HEAD_SNAP: six heads whip to the door at once — one short «fwip» (kept out of the 2nd clack)."""
    t = tt(.075)
    s = swept(rng, .075, 900, 3600, .5) * swell(t, .075, .35, a=.006, r=.015)
    return pan2(s, np.linspace(-.4, .4, len(t))), 0.0


def awww(rng):
    """HEARTS_POP: the guests' soft «awww» (falling) + bubbly pops as the hearts bloom in their eyes."""
    out, _ = crowd(rng, AWW, F0_AWW, rates=(.95, 1.1), level={"khala": 1.1, "amo": .8, "jiddo": .7}, room=.4)
    for k, o in enumerate((.02, .09, .15, .2, .27)):
        p, _ = sfx.pop(rng, 700 + 90 * k)
        place(out, p, o, (-.5, .4, -.2, .6, 0)[k], .22)
    return out, 0.0


def hum(rng, who=("amo",), pitch=1.0):
    """MMM: a contented «mmm!» hum (closed mouth, rising-falling)."""
    out = np.zeros((int(1.0 * SR), 2))
    for k, w in enumerate(who):
        r = np.random.default_rng(int(rng.integers(1 << 30)))
        s = say(r, w, HUM, F0_HUM, rate=r.uniform(.95, 1.1), pitch=pitch * r.uniform(.97, 1.03))
        place(out, s, .03 * k, SPK[w][2] * .7, 1 - .2 * k)
    return out, 0.0


def dig(rng, pan=0.0, host=False):
    """SPOON_DIGS: the spoon meets the plate (a ceramic clink) and drags a creamy scoop of qashta."""
    out = np.zeros((int(1.0 * SR), 2))
    c, _ = sfx.spoon_clink(rng, .75 if not host else .9, pan)
    place(out, c, 0, 0, .7)
    sc, _ = sfx.scoop(rng, .2 if not host else .26)
    place(out, sc, F(1), 0, .8 if not host else 1.0)
    su, _ = sfx.suction(rng)
    place(out, su, F(1) + (.2 if not host else .26) * .9, 0, .4)
    return out, 0.0


def heart_pop(rng, f0=760.0, pan=0.0):
    p, _ = sfx.pop(rng, f0)
    t = tt(.06)
    b = osc(f0 * 2.1 * (1 + .4 * t / .06)) * env(t, .001, .01)
    out = p.copy()
    out[:len(t)] += pan2(.3 * b, 0)
    return pan2(out.mean(1), pan), 0.0


# =============================== MUSIC ===============================
GROUPS = ("bass", "drums", "clar", "keys", "choir")       # keys = santur + xylophone (+ the caffeine buzz)
STEMS = {g: np.zeros((N, 2)) for g in GROUPS}
MUSIC_EVENTS = []  # (label, t s, dry stereo signal) of musical hits that belong to a picture cue (onset table)


def key_transients():
    """Frames of key SFX transients the music's filler notes must not flam (they step aside by 40 ms)."""
    fs = [DING, DONG, SMUSH, RECOIL, GRAB, YANK, SWING_FRIDGE, YANK + 6, *LON, *LOFF, C["LEMON_CLINK"], BULB, *TICKS, *DB2_NOTES, PRESS,
          UNLATCH, HELLO, *TCW, *EYES, ENOUGH_POP, LOGO, LOGO2, *TAW, *DIGS, *HPOPS, *TFW, *LOGO_DOTS, CTA, COMMENT_POP,
          ECG("cupLand")]
    return np.array([F(f) for f in fs])


KT = key_transients()


def clear(t, w=.04):
    return bool(np.all(np.abs(KT - t) >= w))


class Sec:
    """A music section: its own group buses (from f0 to f1 + tail), its own room, then a gate (hard cut / custom)."""

    def __init__(self, f0, f1, tail=.6):
        self.t0, self.t1 = F(f0), F(f1)
        self.n = int(round((self.t1 - self.t0 + tail) * SR))
        self.b = {g: np.zeros((self.n, 2)) for g in GROUPS}

    def put(self, g, sig, t, pan=0.0, v=1.0, label=None):
        sig = pan2(sig, pan) if sig.ndim == 1 else sig
        place(self.b[g], sig, t - self.t0, 0, v)
        if label:
            MUSIC_EVENTS.append((label, t, sig * v))

    def commit(self, room=.22, wet=.1, cut=None, gate=None, gain=1.0):
        """cut = frame of a HARD cut (3 ms fade, no tail); gate(t_abs array) -> gain curve; gain = section level."""
        tl = self.t0 + np.arange(self.n) / SR
        g = np.full(self.n, float(gain))
        if cut is not None:
            i = int(round((F(cut) - self.t0) * SR))
            f = int(.003 * SR)
            g[i - f:i] = np.linspace(1, 0, f)
            g[i:] = 0
        if gate is not None:
            g = g * gate(tl)
        i0 = int(round(self.t0 * SR))
        n = min(self.n, N - i0)
        for k, x in self.b.items():
            if wet:
                x = reverb(x, room_size=room, damping=.5, wet_level=wet, dry_level=1, width=.85)
            STEMS[k][i0:i0 + n] += (x * g[:, None])[:n]


def strum(rng, notes, spread=.008, length=1.0, soft=False):
    out = np.zeros(int((length + spread * len(notes) + .1) * SR))
    for k, nt in enumerate(notes):
        add(out, santur(rng, nt, length, 1.3, soft), k * spread, 1 - .06 * k)
    return out


def gliss(f0, f1, dur, a0, a1, shape=1.0, atk=.01, rel=.04, hold=0.0):
    """(pitch, amp) curves of a glide f0 -> f1 over dur (after `hold` s on f0)."""
    t = tt(dur + hold)
    x = np.clip((t - hold) / dur, 0, 1) ** shape
    f = f0 * (f1 / f0) ** x
    a = (a0 + (a1 - a0) * np.clip(t / (dur + hold), 0, 1)) * np.clip(t / atk, 0, 1) * np.clip((dur + hold - t) / rel, 0, 1)
    return f, a


def choir(rng, notes, dur, vowel="a", atk=.03, rel=.1, voices=2, scale=1.18, cents=None, vib=.006):
    """The guests as a choir: `voices` formant singers per note, a few cents apart. cents = [(ms, cents)]."""
    out = np.zeros(int((dur + .1) * SR))
    ck = cents or [(0, 0), (dur * 1000, 0)]
    for nt in notes:
        for v in range(voices):
            f0 = note_f(nt, rng.uniform(-7, 7))
            kf = [(0, vowel, 0, .02, 0), (atk * 1000, vowel, 1, .02, 0), (max(atk, dur - rel) * 1000, vowel, 1, .02, 0),
                  (dur * 1000, vowel, 0, 0, 0)]
            f0k = [(m, 2 ** (c / 1200)) for m, c in ck]
            s = voice(rng, kf, f0k, f0, scale * rng.uniform(.97, 1.03), jitter=.003, vib=vib)
            add(out, s, 0, 1 / (len(notes) * voices) ** .5)
    return out


def sec_peephole():
    """0-50: frame 0 is the chime alone (the hook). DONG: a low «gulp». A tiptoe vamp creeps down under the chatter,
    the clarinet winds up with the boy, a tutti stab on RECOIL and a falling «waaah» into the whip."""
    S = Sec(0, WHIP1, tail=.45)
    rng = np.random.default_rng(SEED + 1)
    t = F(DONG)
    S.put("bass", pizz(rng, "D2", .5), t, 0, 1.0, "DONG «gulp» hit (pizz D2, clarinet D3 smear, xylo D5+Eb5)")
    S.put("clar", cl_line(rng, [(0, note_f("D3"), .22, 1.0, note_f("C#3"))], atk=.006, rel=.07), t, -.1, .5)
    S.put("keys", xylo(rng, "D5") + .8 * xylo(rng, "Eb5"), t, .25, .22)
    # tiptoe: bass on the warped beats, xylophone on the off-beats, creeping down chromatically
    beats = A_BEATS[1:]
    mids = [(a + b) / 2 for a, b in zip(beats, beats[1:])]
    for f_, n_ in zip([mids[0], beats[1], mids[1], beats[2], mids[2]], ["A1", "D2", "A1", "Bb1", "A1"]):
        if clear(F(f_), .03) or f_ in beats:
            S.put("bass", pizz(rng, n_, .2), F(f_), 0, .75)
    for f_, n_ in zip(mids, ["F5", "E5", "Eb5"]):
        if clear(F(f_)):
            S.put("keys", xylo(rng, n_, .3), F(f_), .3, .16)
    # KID_LEAN: the clarinet winds up with the boy (D4 -> A4, crescendo) and gets out of the squeak's way
    f, a = gliss(note_f("D4"), note_f("A4"), F(SMUSH - LEAN - 1), .15, .7, shape=1.5)
    S.put("clar", clarinet(rng, f, a, vib=0), F(LEAN), .1, .5, "KID_LEAN clarinet wind-up (D4 -> A4)")
    # RECOIL: tutti stab + a falling «waaah» into the whip
    t = F(RECOIL)
    S.put("bass", msum(pizz(rng, "D2", .45), .6 * pizz(rng, "D3", .3)), t, 0, 1.0, "RECOIL tutti stab")
    S.put("keys", xylo(rng, "D5") + xylo(rng, "Eb5") + .7 * xylo(rng, "A5"), t, .2, .25)
    S.put("keys", strum(rng, ["D3", "A3", "Eb4"], .006, .8), t, -.2, .3)
    f, a = gliss(note_f("D5"), note_f("A3"), F(WHIP1 + 6 - RECOIL), 1.0, .25, shape=1.6, hold=.08, rel=.08)
    S.put("clar", clarinet(rng, f, a, vib=.002), t, -.05, .55)
    S.commit(room=.25, wet=.12, gain=1.25)


def sec_fridge():
    """50-84: the panic run with the whip, a santur tremolo as the hand grabs, a rip up on the yank (HOPE), and the
    «heavenly» choir that runs on the fridge light: it flickers out with it, comes back flatter and weaker, and dies
    at DEAD_BEAT (hard cut; the hum is left alone)."""
    S = Sec(WHIP1, DEAD[0], tail=.05)
    rng = np.random.default_rng(SEED + 2)
    land = T["fridge"] + 2
    run = ["D6", "C6", "Bb5", "A5", "Gb5", "F5", "Eb5", "D5"]
    for k, n_ in enumerate(run):
        S.put("keys", xylo(rng, n_, .25), F(WHIP1 + k * (land - WHIP1) / len(run)), .5 - .12 * k, .12 + .02 * k)
    S.put("keys", santur_trem(rng, ["D4", "Eb4"], F(SWING_FRIDGE - land) - .01, 15, .12, .6), F(land), -.15, .32)
    S.put("bass", pizz(rng, "D2", .25), F(land), 0, .6)
    S.put("bass", pizz(rng, "D2", .25), F(GRAB), 0, .5, "HAND_GRAB pizz heartbeat")
    # the door flies open (first drawn swing): rip up to D5 and hold it (hope) through the dark until the light comes on
    t = F(SWING_FRIDGE)
    S.put("bass", msum(pizz(rng, "D2", .4), .5 * pizz(rng, "A2", .3)), t, 0, .4,
          "FRIDGE_YANK swing (+2: first drawn swing) hit + clarinet rip (hope)")
    f, a = gliss(note_f("A4"), note_f("D5"), .09, .7, .9, shape=.6)
    tr = t + F(1.5)  # the rip answers the thwock instead of covering it
    f2 = np.r_[f, np.full(int((F(DEAD[0]) - tr - .09) * SR), note_f("D5"))]
    a2 = np.r_[a, np.linspace(.9, 1.0, len(f2) - len(f))]
    sag = flicker_cents(tr + np.arange(len(f2)) / SR)
    S.put("clar", clarinet(rng, f2 * 2 ** (sag / 1200), a2, vib=.005), tr, .05, .45)
    # LIGHT ON: the choir of angels (D major), flatter on each comeback
    t = F(LON[0])
    d = F(DEAD[0] - LON[0]) + .02
    ck = [(1000 * (F(f_) - t), flicker_cents(np.array([F(f_)]))[0]) for f_ in np.arange(LON[0], DEAD[0] + 1, .5)]
    S.put("choir", choir(rng, ["D4", "F#4", "A4", "D5"], d, "a", atk=.01, rel=.01, cents=ck), t, 0, 1.0,
          "LIGHT ON: «heavenly» choir (gated by the fridge light)")
    for k, f_ in enumerate(LON):  # santur shimmer, re-struck on every ON, flatter each time
        c = flicker_cents(np.array([F(f_)]))[0]
        S.put("keys", santur_trem(rng, ["F#5", "A5", "D6"], F(4), 18, .5 - .1 * k, .4 - .1 * k,
                                  cents=lambda _t, c=c: c, soft=False), F(f_), .2, .35 * (1 - .25 * k))
    S.commit(room=.35, wet=.18, cut=DEAD[0], gate=light_gate, gain=1.2)


def light_gate(tl):
    """The music runs on the fridge light: full on the first ON, 0 while it is off, weaker on each comeback."""
    g = np.ones(len(tl))
    lvl = {LON[0]: 1.0, LON[1]: .72, LON[2]: .5}
    on = np.zeros(len(tl))
    for k, f_ in enumerate(LON):
        off = LOFF[k] if k < len(LOFF) else DEAD[0]
        on[(tl >= F(f_)) & (tl < F(off))] = lvl[f_]
    on[tl < F(LON[0])] = 1.0  # before the light: the yank + the held rip
    return g * uniform_filter1d(on, int(.004 * SR))


def flicker_cents(ta):
    """Pitch sag of the fridge-light choir: 0 c, then -35 c, then -95 c (wilting within each comeback)."""
    c = np.zeros(len(ta))
    c[ta >= F(LON[1])] = -30 - 12 * np.clip((ta[ta >= F(LON[1])] - F(LON[1])) / F(4), 0, 1)
    c[ta >= F(LON[2])] = -80 - 25 * np.clip((ta[ta >= F(LON[2])] - F(LON[2])) / F(2), 0, 1)
    return c


def sec_clock():
    """110-168: panic in maqam saba. The ostinato's eighths ARE the clock ticks (accelerating), the doorbell double-
    rings on them, the clarinet trills on the saba quarter-tone, a sus tremolo winds up with the thumb, «اطلب» resolves
    to D major (relief), and a clarinet «phew» sighs into the whip."""
    S = Sec(T["clock"], T["door"], tail=.4)
    rng = np.random.default_rng(SEED + 3)
    bass = ["D2", "D3", "D2", "D3", "Eb2", "Eb3", "F2", "Gb2", "A2"]
    for k, (f_, n_) in enumerate(zip(C_GRID, bass)):
        S.put("bass", pizz(rng, n_, .2), F(f_), 0, .5 + .3 * k / 8, "CLOCK grid beat = first tick" if k == 0 else None)
    cell = ["D5", "Eb5", "F5", "Gb5", "F5", "Eb5", "D5", "Eb5", "F5", "Gb5", "A5", "Gb5", "F5", "Gb5", "A5", "Bb5"]
    k = 0
    for a, b in zip(C_GRID, C_GRID[1:]):
        for f_ in (a, (a + b) / 2):
            ok = all(abs(F(f_) - F(d)) >= .04 for d in DB2_NOTES) and (f_ in C_GRID or clear(F(f_)))
            if ok:
                S.put("keys", xylo(rng, cell[k % len(cell)], .25), F(f_), .3 - .6 * (k % 2), .13 + .1 * k / 16)
            k += 1
    # clarinet: a nervous trill on the saba quarter-tone (D5 / E half-flat), climbing to F5 / Gb5
    nt, tc, t_end = [], F(DB2_NOTES[-1] + 2), F(WIND)
    while tc < t_end - .03:
        x = (tc - F(DB2_NOTES[-1] + 2)) / (t_end - F(DB2_NOTES[-1] + 2))
        lo, hi = (note_f("D5"), note_f("E5", -50)) if x < .5 else (note_f("F5"), note_f("Gb5"))
        for f_ in (lo, hi):
            nt.append((tc - F(DB2_NOTES[-1] + 2), f_, .045, .45 + .45 * x))
            tc += .042
    S.put("clar", cl_line(rng, nt, glide=.008, atk=.006, rel=.02, vib=0), F(DB2_NOTES[-1] + 2), .1, .42)
    # THUMB_WIND: a sus tremolo + a rising clarinet glide (anticipation)
    S.put("keys", santur_trem(rng, ["A3", "D4", "E4"], F(PRESS - WIND) - .01, 18, .2, .7), F(WIND), -.1, .5,
          "THUMB_WIND sus tremolo")
    f, a = gliss(note_f("A4"), note_f("D5"), F(PRESS - WIND) - .02, .4, .9, shape=1.3)
    S.put("clar", clarinet(rng, f, a, vib=0), F(WIND), .05, .45)
    # THUMB_PRESS: D major, relief
    t = F(PRESS)
    S.put("bass", pizz(rng, "D2", .5), t, 0, 1.0, "THUMB_PRESS: D-major relief")
    S.put("keys", strum(rng, ["D3", "A3", "D4", "F#4", "A4", "D5"], .012, 1.2), t + .02, 0, .4)
    S.put("keys", xylo(rng, "D6", .5), t + .02, .3, .15)
    f, a = legato([(0, note_f("F#5"), .1, .9), (.1, note_f("F#5"), F(6) - .1, .7, note_f("D5"))], atk=.008, rel=.12)
    S.put("clar", clarinet(rng, f, a, vib=.004), t + F(1), .05, .45)
    S.put("bass", pizz(rng, "A1", .2), F(PRESS + 5), 0, .6)
    S.put("bass", pizz(rng, "D2", .3), F(PRESS + 8), 0, .7)
    S.commit(room=.25, wet=.12)


def sec_door():
    """168-206: a hushed tremolo under the hinge creak; on «مرحبااا!» the band hits; the surge pushes a crescendo
    (riq roll, daf, a rising clarinet) — HARD CUT on the cut to the sofa."""
    S = Sec(T["door"], SOFA, tail=.05)
    rng = np.random.default_rng(SEED + 4)
    S.put("keys", santur_trem(rng, ["A3", "E4"], F(HELLO - UNLATCH) - .02, 13, .06, .3, soft=True), F(UNLATCH), .1, .45)
    t = F(HELLO)
    S.put("drums", daf(rng, "D", 1.0), t, 0, .8, "CROWD_HELLO band hit")
    S.put("drums", claps(rng, 7, 1.0), t, .1, .4)
    S.put("bass", pizz(rng, "D2", .5), t, 0, .9)
    S.put("keys", strum(rng, ["D4", "F#4", "A4", "D5"], .006, .9), t, -.1, .4)
    S.put("drums", pan2(riq(rng, [0, .03, .07, .12, .2], .9), .2), t, 0, .5)
    # the surge: crescendo push
    t0, t1 = F(SURGE), F(SOFA)
    for k, tc in enumerate(np.arange(t0, t1, F(2.5))):
        x = (tc - t0) / (t1 - t0)
        S.put("drums", daf(rng, "T" if k % 2 == 0 else "K", .3 + .6 * x), tc, (.15, -.15)[k % 2], .7)
    r = riq(rng, list(np.arange(0, t1 - t0, .045)), .7)
    S.put("drums", pan2(r * np.linspace(.3, 1, len(r)), -.2), t0, 0, .45)
    nts = [(0, note_f(n_), F(3), .55 + .1 * k) for k, n_ in enumerate(["A4", "B4", "C#5", "D5", "E5"])]
    S.put("clar", cl_line(rng, nts, glide=.02, vib=0), t0, .05, .5, "SURGE push (clarinet run, riq roll)")
    S.put("keys", santur_trem(rng, ["D4", "F#4", "A4"], t1 - t0, 16, .2, .7), t0, -.15, .4)
    S.put("bass", pizz(rng, "A1", .3), t0, 0, .7)
    S.commit(room=.25, wet=.12, cut=SOFA, gain=2.0)


def sec_salon():
    """SOFA-SIL[0]: the polite salon waltz (3/4) whose three beats are the three pours; each finjan makes it more wired
    (clean → mordents, sharper → tremolo, sharper still → WIRED: a rising chromatic tremolo, a flutter-tongued clarinet
    and a caffeine buzz). HARD CUT on the freeze (true silence follows)."""
    S = Sec(SOFA, SIL[0], tail=.05)
    rng = np.random.default_rng(SEED + 5)
    stage = lambda f_: 0 if f_ < EYES[0] else 1 if f_ < EYES[1] else 2 if f_ < WIRED[0] else 3
    sharp = {0: 0, 1: 8, 2: 18}
    b = [POUR_S[0] + WQ * k for k in range(3)]          # the three beats = the three pours
    e = WQ / 2
    for f_, n_ in ((SOFA, "A4"), (TCW[0], "B4")):           # pickup on the title's first word
        S.put("keys", santur(rng, n_, .6, 1.0, True), F(f_), .15, .4)
    mel = [(b[0], "D5"), (b[0] + e, "F#5"), (b[1], "A5"), (b[1] + e, "F#5"), (b[2], "G5"), (b[2] + e, "E5")]
    up = {"D5": "E5", "F#5": "G5", "A5": "B5", "G5": "A5", "E5": "F#5"}
    for k, (f_, n_) in enumerate(mel):
        st, t = stage(f_), F(f_)
        lab = f"SALON beat {k // 2 + 1} = POUR_START[{k // 2}]" if k % 2 == 0 else None
        if st == 0:
            S.put("keys", santur(rng, n_, 1.0, 1.2, True), t, .15, .55, lab)
        elif st == 1:  # mordent: note, upper neighbour, note
            for j, (o, nn) in enumerate(((0, n_), (.035, up[n_]), (.07, n_))):
                S.put("keys", santur(rng, nn, .7, 1.0, True, sharp[1]), t + o, .15, (.55, .35, .45)[j], lab if j == 0 else None)
        else:
            S.put("keys", santur_trem(rng, [n_], F(e) - .01, 17, .55, .45, cents=lambda _t: sharp[2], soft=True), t, .15, .6, lab)
    # oom-pah-pah: bass on 1, soft santur double-stops on 2 and 3
    S.put("bass", pizz(rng, "D2", .45), F(b[0]), 0, .7)
    for f_ in b[1:]:
        st = stage(f_)
        if st < 2:
            S.put("keys", santur(rng, "F#4", .5, .8, True, sharp[st]) + santur(rng, "A4", .5, .8, True, sharp[st]), F(f_) + .01, -.2, .22)
        else:
            S.put("keys", santur_trem(rng, ["F#4", "A4"], F(e), 17, .3, .3, cents=lambda _t: sharp[2], soft=True), F(f_) + .01, -.2, .3)
        S.put("bass", pizz(rng, "A2", .2), F(f_ + e), 0, .45 + .15 * (st >= 1))
    # the clarinet gets nervous after the 2nd cup (a trill E4/F#4, louder)
    nt, tc, t0 = [], 0.0, F(EYES[1] + 1)
    while tc < F(WIRED[0] - EYES[1] - 1) - .03:
        x = tc / F(WIRED[0] - EYES[1])
        for f_ in (note_f("E4", sharp[2]), note_f("F#4", sharp[2])):
            nt.append((tc, f_, .05, .35 + .4 * x))
            tc += .05
    S.put("clar", cl_line(rng, nt, glide=.008, atk=.006, rel=.02, vib=0), t0, -.1, .4)
    # WIRED: every voice trembles and climbs
    t0, d = F(WIRED[0]), F(WIRED[1] - WIRED[0])
    for k in range(int(WIRED[1] - WIRED[0])):
        nn = [note_f("D5", 100 * k + 25), note_f("Eb5", 100 * k + 25)]
        S.put("keys", santur_trem(rng, nn, F(1), 24, .5 + .07 * k, .5 + .07 * k, soft=False), t0 + F(k), .15, .5,
              "WIRED: chromatic tremolo + flutter clarinet + buzz" if k == 0 else None)
    f, a = gliss(note_f("F#4", 25), note_f("C5", 25), d, .6, 1.0, shape=1.0, rel=.004)
    S.put("clar", clarinet(rng, f, a, vib=0, flutter=.85), t0, -.1, .5)
    for tc in np.arange(t0, t0 + d - .02, F(1.75)):
        S.put("bass", pizz(rng, "D2", .08), tc, 0, .6)
    tb = tt(d)
    fz = 150 * (1 + .25 * tb / d)
    ph = 2 * np.pi * np.cumsum(fz) / SR
    buzz = sum(np.sin(k_ * ph) / k_ for k_ in range(1, 40) if 150 * k_ < 5000)
    buzz = peq(peq(buzz, 900, 10, 2), 2200, 6, 2) * (.55 + .45 * np.sin(2 * np.pi * 25 * tb)) * np.clip(tb / .05, 0, 1)
    S.put("keys", filt(norm(buzz), "bandpass", [250, 4500]), t0, 0, .12)
    S.commit(room=.2, wet=.1, cut=SIL[0], gain=1.2)


def maqsum(S, rng, bars, v=1.0, claps_on=True, skip=None, label=None):
    """Maqsum (D T . T | D . T .) over `bars` = [(f0, f1)] half-bars of two beats (frames): daf, claps on the taks,
    riq on the eighths. skip(f) -> True drops a stroke."""
    pat = [("D", "T", None, "T"), ("D", None, "T", None)]
    for j, (a, b) in enumerate(bars):
        for p in range(4):
            f_ = a + (b - a) * p / 4
            k = pat[j % 2][p]
            if skip and skip(f_):
                continue
            t = F(f_)
            if k and (k == "D" or clear(t)):
                S.put("drums", daf(rng, k, (1.0 if k == "D" else .8) * v), t, (0, .12, 0, -.1)[p], .8,
                      label if (label and j == 0 and p == 0) else None)
                if k == "T" and claps_on and clear(t):
                    S.put("drums", claps(rng, 7, v), t, .05, .45)
            if clear(t, .05) and p % 2 == 1:
                S.put("drums", pan2(riq(rng, [0], .5), -.2), t, 0, .35 * v)


def hit(S, rng, t, bassn, chord, cl=None, v=1.0, daf_k="D", label=None, cl_len=.16):
    """A band hit: daf + claps + pizz + a santur strum (+ a clarinet note)."""
    S.put("drums", daf(rng, daf_k, v), t, 0, .85, label)
    S.put("drums", claps(rng, 8, v), t, .05, .4)
    S.put("bass", pizz(rng, bassn, .4), t, 0, .9 * v)
    S.put("keys", strum(rng, chord, .006, 1.0), t, -.1, .42 * v)
    if cl:
        S.put("clar", cl_line(rng, [(0, note_f(cl), cl_len, .9 * v)], atk=.006, rel=.05), t, .05, .5)


def sec_feast():
    """HEARTS-480: the warm swell after «تشك-تشك», the feast groove (quarters = spoon digs), the title stop-time, the held
    D chord, and the end-card groove (CTA = downbeat, comment pop = downbeat, BUTTON on the first dot hop)."""
    S = Sec(HEARTS, TL["DURATION"], tail=0)
    rng = np.random.default_rng(SEED + 6)
    # warm swell under the «awww» and the arrival title, a santur glissando into the whip
    S.put("keys", santur_trem(rng, ["D4", "F#4", "A4"], F(WHIP3 - TAW[1]), 15, .1, .45, soft=True), F(TAW[1]), 0, .4)
    gl = ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5", "E5", "F#5", "G5", "A5", "B5", "C#6", "D6"]
    for k, n_ in enumerate(gl):
        S.put("keys", santur(rng, n_, .7, 1.0), F(WHIP3) + k * F(FEAST - WHIP3) / len(gl), -.5 + k / len(gl), .25 + .02 * k)
    # FEAST: the payoff hit + the doorbell motif as the hospitality theme
    hit(S, rng, F(FEAST), "D2", ["D3", "A3", "D4", "F#4", "A4", "D5"], v=1.0, label="FEAST_MUSIC downbeat (whip lands)")
    S.put("drums", pan2(riq(rng, [0, .025, .05, .09], 1.0), .2), F(FEAST), 0, .5)
    # the pickup and the theme are written for a 10-frame lead-in and a 14-frame quarter; scale them to the cues
    pq = (DIGS[0] - FEAST) / 10                     # lead-in factor (whip landing -> first dig)
    fq = FQ / 14                                    # quarter factor (dig spacing)
    for k, (o, kk) in enumerate(((3.5, "T"), (6, "K"), (8.5, "T"))):
        S.put("drums", daf(rng, kk, .45 + .2 * k), F(FEAST + o * pq), (.12, -.1, .12)[k], .75)
    # groove: maqsum, quarter = dig spacing; stop-time from the first title word
    bars = [(DIGS[0] + 2 * FQ * j, DIGS[0] + 2 * FQ * (j + 1)) for j in range(2)]
    maqsum(S, rng, bars, 1.0, skip=lambda f_: f_ >= TFW[0] - 1, label="dig 1 = groove downbeat (daf D)")
    walk = [(0, "D2"), (.5, "A2"), (1, "D3"), (1.5, "F#2"), (2, "G2"), (2.5, "A2")]
    for q, n_ in walk:
        f_ = DIGS[0] + q * FQ
        if f_ < TFW[0] - 1:
            S.put("bass", pizz(rng, n_, .3), F(f_), 0, .8, "host's dig = beat 2 (bass D3 + clarinet A5)" if f_ == DIGS[1] else None)
    th = [(FEAST, "F#5", 4.0 * pq, .85), (FEAST + 4.5 * pq, "D5", 5.0 * pq, .8), (DIGS[0], "E5", 3.2 * fq, .7),
          (DIGS[0] + 3.5 * fq, "F#5", 3.2 * fq, .75), (DIGS[0] + 7 * fq, "G5", 6.5 * fq, .8), (DIGS[1], "A5", 10.5 * fq, .95),
          (DIGS[1] + 11 * fq, "B5", 2.8 * fq, .8), (DIGS[2], "A5", 3.5 * fq, .8), (DIGS[2] + 3.5 * fq, "G5", 3.3 * fq, .75),
          (DIGS[2] + 7 * fq, "F#5", 2.8 * fq, .75), (DIGS[2] + 10 * fq, "E5", TFW[0] - DIGS[2] - 10 * fq - .5, .7)]
    assert th[-1][2] >= 1.5, "the last theme note before the title stop-time needs >= 1.5 frames (move titleFinal later)"
    t0 = F(th[0][0])
    S.put("clar", cl_line(rng, [(F(f_) - t0, note_f(n_), F(d), v) for f_, n_, d, v in th], glide=.03, vib=.0055), t0, .08, .5)
    for f_ in np.arange(DIGS[0] + FQ / 4, TFW[0] - 2, FQ / 4):   # santur sparkle in the gaps (16ths, D-major arpeggio)
        if clear(F(f_), .05) and (f_ - DIGS[0]) % (FQ / 2) != 0:
            k = int(round((f_ - DIGS[0]) / (FQ / 4)))
            S.put("keys", santur(rng, ["D6", "A5", "F#5", "A5"][k % 4], .5, .8, True), F(f_), .35, .1)
    # stop-time on the title: «ضيوف · فجأة؟ · خلّيها · قشطة.» = B · C# · E · F# over IV · V · V7 · I
    st = [("G2", ["G3", "D4", "G4", "B4"], "B4", "D"), ("A2", ["A3", "E4", "A4", "C#5"], "C#5", "T"),
          ("A2", ["A3", "G4", "C#5", "E5"], "E5", "T"), ("D2", ["D3", "A3", "D4", "F#4", "A4", "D5"], None, "D")]
    for k, (f_, (bn, ch, cl, dk)) in enumerate(zip(TFW, st)):
        hit(S, rng, F(f_), bn, ch, cl, v=.55 + .07 * k if k < 3 else .7, daf_k=dk, label=f"TITLE word {k + 1} stop-time hit")
    t = F(TFW[-1])
    hold = F(CARD) - t
    S.put("drums", pan2(riq(rng, [0, .03, .06, .1, .15], 1.0), .2), t + F(1), 0, .55)
    f, a = legato([(0, note_f("F#5"), hold - .1 - F(2), 1.0)], atk=.03, rel=.3)
    S.put("clar", clarinet(rng, f, a * np.clip(1 - .45 * np.arange(len(a)) / len(a), 0, 1), vib=.006), t + F(2), .08, .52)
    S.put("choir", choir(rng, ["D4", "F#4", "A4", "D5"], hold + .05 - F(2), "a", atk=.08, rel=.3, vib=.007), t + F(2), 0, .55)
    S.put("keys", santur_trem(rng, ["D5", "A5"], hold - .15, 14, .35, .12, soft=True), t + .12, .2, .4)
    S.put("bass", pizz(rng, "D3", .4), t, 0, .5)
    for k, (o, kk) in enumerate(((-7, "T"), (-4.5, "K"), (-2, "T"))):
        S.put("drums", daf(rng, kk, .4 + .2 * k), F(CARD + o), (.12, -.1, .12)[k], .7)
    # ---------- END CARD: the groove at the end card's own tempo ----------
    ebars = EBARS
    hit(S, rng, F(CARD), "D2", ["D3", "A3", "D4", "F#4", "A4", "D5"], None, .9, label="END CARD downbeat")
    logo_break = lambda f_: LOGO_DOTS[0] - 4 <= f_ <= LOGO_DOTS[1] + 7
    maqsum(S, rng, ebars[:1], .85, skip=lambda f_: f_ == CARD or logo_break(f_))
    S.put("bass", pizz(rng, "A2", .3), F(ebars[0][0] + (ebars[0][1] - ebars[0][0]) / 2), 0, .6)
    a_, b_ = ebars[1]
    for k, p in enumerate((2.5, 3, 3.5)):          # pickup fill into the CTA, after the logo
        S.put("drums", daf(rng, "T" if k % 2 == 0 else "K", .4 + .2 * k), F(a_ + (b_ - a_) * p / 4), (.12, -.1, .12)[k], .75)
    S.put("choir", choir(rng, ["D4", "A4"], F(CTA - CARD) - .1, "a", atk=.15, rel=.3, vib=.006), F(CARD) + .1, 0, .35)
    hit(S, rng, F(CTA), "D2", ["D3", "A3", "D4", "F#4", "A4", "D5"], None, .7, label="CTA stamp = groove downbeat")
    maqsum(S, rng, ebars[2:], .9, skip=lambda f_: f_ in (CTA, COMMENT_POP))
    S.put("bass", pizz(rng, "D2", .35), F(COMMENT_POP), 0, .75, "comment pop = downbeat (bass only)")
    for j, (a_, b_) in enumerate(ebars[2:]):
        for p, n_ in ((1, "A2"), (2, "D3"), (3, "A2")):
            f_ = a_ + (b_ - a_) * p / 4
            if clear(F(f_), .03):
                S.put("bass", pizz(rng, n_, .2), F(f_), 0, .6)
    e2 = (ebars[2][1] - ebars[2][0]) / 4
    e3 = (ebars[3][1] - ebars[3][0]) / 4
    th = [(CTA, "F#5", 2 * e2, .9), (CTA + 2 * e2, "D5", e2, .8), (CTA + 3 * e2, "E5", e2, .8),
          (COMMENT_POP + e3, "G5", e3, .85), (COMMENT_POP + 2 * e3, "F#5", e3, .8), (COMMENT_POP + 3 * e3, "E5", e3 * .5, .75),
          (COMMENT_POP + 3.5 * e3, "C#5", e3 * .3, .7), (BUTTON + 2, "D5", TL["DURATION"] - BUTTON - 3, .5)]
    t0 = F(th[0][0])   # (the clarinet rests across the first dot hop: the dots' «تشك» lands alone, then D5 arrives)
    f, a = legato([(F(f_) - t0, note_f(n_), F(d), v) for f_, n_, d, v in th], glide=.03, rel=.06, atk=.03)
    a = a * np.clip(1 - np.clip((np.arange(len(a)) / SR + t0 - F(BUTTON)) / .45, 0, 1) * .6, 0, 1)
    S.put("clar", clarinet(rng, f, a, vib=.0055), t0, .08, .5)
    # BUTTON on the first dot hop: soft daf, D chord, clarinet D5 (the logo echoes ride on it)
    t = F(BUTTON)
    S.put("bass", pizz(rng, "D2", .6), t, 0, .5, "BUTTON = dot hop 1 (bass; the dots' clacks are the percussion)")
    S.put("keys", filt(strum(rng, ["D3", "A3", "D4", "F#4", "A4"], .014, 1.0, True), "lowpass", 2200), t + F(1.5), 0, .25)
    S.put("choir", choir(rng, ["D4", "F#4", "A4"], F(TL["DURATION"] - BUTTON), "a", atk=.04, rel=.2, vib=.006), t, 0, .2)
    # the end card's groove a notch up (the kit's end-card SFX are light: keep the energy to the last frame)
    S.commit(room=.28, wet=.12, gate=feast_gate)


def feast_gate(tl):
    """Section levels inside sec_feast: the feast groove +2 dB (the payoff), the title hold as is, the end card +2 dB."""
    g = np.ones(len(tl))
    g[(tl >= F(FEAST) - .02) & (tl < F(TFW[0]) - .01)] = 1.25
    g[tl >= F(CARD) - .1] = 1.25
    return uniform_filter1d(g, int(.03 * SR))


def build_music():
    for k in STEMS:
        STEMS[k][:] = 0
    MUSIC_EVENTS.clear()
    sec_peephole()
    sec_fridge()
    sec_clock()
    sec_door()
    sec_salon()
    sec_feast()
    lv = {"bass": .75, "drums": .85, "clar": .7, "keys": .85, "choir": .5}
    for k in STEMS:
        STEMS[k] *= lv[k]
    STEMS["bass"][:] = sfx.lowshelf(STEMS["bass"], 110, -3)
    STEMS["drums"][:] = sfx.lowshelf(STEMS["drums"], 100, -2)
    return sum(STEMS.values())


# =============================== SFX cue sheet ===============================
CUE_LOG = []  # (cue label, cue time s, kind, role, index into mx.cues)


def build(vo):
    mx = sfx.Mixer(DUR)

    def cue(label, f, fn, gain=1.0, duck=0.0, role="key", **p):
        t = F(f)
        mx.voice(t, fn, gain=gain, duck_db=duck, **p)
        CUE_LOG.append((label, t, fn.__name__, role, len(mx.cues) - 1))

    def vo_or(name, label, f, fn, gain=1.0, duck=0.0, role="key", **p):
        if name in vo:
            mx.sfx(F(f), pan2(vo[name]), 0, 1.0, 4.0, "vo")
            CUE_LOG.append((f"{label} (VO {name}.wav)", F(f), "vo", "key", len(mx.cues) - 1))
        else:
            cue(label, f, fn, gain, duck, role, **p)

    # ---- 1 PEEPHOLE: the chime on frame 0 IS the hook
    cue("DOORBELL_DING (F#6)", DING, chime, .62, 4, note="F#6")
    cue("DOORBELL_DONG (D6)", DONG, chime, .6, 4, note="D6")
    for k, f in enumerate(C["SHAKE"]):
        cue(f"SHAKE[{k}] door rattle", f, door_rattle, .6, 2, big=.7 + .3 * k)
    vo_or("chatter", "GUEST_CHATTER (through the door)", CHAT[0], chatter, .26, 0, "bed", dur=F(CHAT[1] - CHAT[0]))
    cue("KID_LEAN wind-back creak", LEAN, windback, .45, 3)
    cue("KID_SMUSH glass squeak", SMUSH, glass_squeak, .42, 3)
    cue("KID_SMUSH+4 breath fog", SMUSH + 4, fog_breath, .3, 0, "bed")
    cue("RECOIL gasp", RECOIL, gasp, .55, 4)
    cue("WHIP_1 (peaks on the cut)", WHIP1, whip_pan, .4, 2, "bed", dur=F(T["fridge"] + 6 - WHIP1),
        peak=(T["fridge"] - WHIP1) / (T["fridge"] + 6 - WHIP1))
    # ---- 2 FRIDGE
    cue("HAND_GRAB", GRAB, handle_grip, .62, 4)
    cue("FRIDGE_YANK seal strain (door 4° ajar)", YANK, seal_strain, .3, 1)
    cue("FRIDGE_YANK+2 thwock (first drawn swing)", SWING_FRIDGE, fridge_yank, .8, 6, knock=F(YANK + 6 - SWING_FRIDGE))
    cue("fridge hum (YANK..BULB_DIES)", YANK, fridge_hum, .2, 0, "bed", dur=F(BULB - YANK) + .3, die=F(BULB - YANK))
    segs = [(F(a - LON[0]), F((LOFF[k] if k < len(LOFF) else BULB) - LON[0])) for k, a in enumerate(LON)]
    cue("light buzz (ON windows)", LON[0], fluoro, .07, 0, "bed", segs=segs, tail=F(BULB - LON[0]))
    for k, f in enumerate(LON):
        cue(f"LIGHT_FLICKER_ON[{k}]", f, fl_on, .42, 2)
    for k, f in enumerate(LOFF):
        cue(f"LIGHT_FLICKER_OFF[{k}]", f, fl_off, .25, 0)
    cue("MIST", C["MIST"][0], mist, .12, 0, "bed", dur=F(C["MIST"][1] - C["MIST"][0]))
    cue("MOTH (L -> R)", C["MOTH"][0], moth, .22, 0, "bed", dur=F(C["MOTH"][1] - C["MOTH"][0]))
    cue("LEMON_ROLL", C["LEMON_ROLL"][0], lemon_roll, .3, 0, dur=F(C["LEMON_ROLL"][1] - C["LEMON_ROLL"][0]))
    cue("LEMON_CLINK (+ egg tok-tok)", C["LEMON_CLINK"], egg_clink, .5, 0)
    cue("BULB_DIES", BULB, bulb_pop, .42, 0)
    # ---- 3 CLOCK + PHONE
    for k, f in enumerate(TICKS):
        cue(f"CLOCK_TICKS[{k}] {'tock' if k % 2 else 'tick'}", f, clock_tick, .85, 3, tock=bool(k % 2), v=.55 + .45 * k / (len(TICKS) - 1))
    for k, f in enumerate(DB2_NOTES):
        cue(f"DOORBELL_2 ring {k + 1} ({('F#6', 'D6')[k % 2]})", f, chime, .5 - .03 * (k // 2), 3, note=("F#6", "D6")[k % 2],
            pan=(-.1, .1)[k % 2])
    cue("TILT_WHOOSH", TILT, sfx.whoosh, .14, 0, "bed", dur=F(WIND - TILT), up=False, pan=(.2, -.2))
    cue("THUMB_WIND squeak", WIND, wind_squeak, .35, 3)
    cue("THUMB_PRESS tap + pling", PRESS, thumb_press, .85, 5)
    cue("WHIP_2 (peaks on the cut)", WHIP2, whip_pan, .4, 2, "bed", dur=F(T["door"] + 5 - WHIP2),
        peak=(T["door"] - WHIP2) / (T["door"] + 5 - WHIP2))
    # ---- 4 DOOR
    cue("DOOR_UNLATCH", UNLATCH, latch, .36, 1)
    cue("DOOR_SWING creak (air +2)", SWING, door_swing, .3, 2, dur=F(T["doorSwing"][1] - T["doorSwing"][0]),
        swing=F(SWING_DOOR - SWING))
    vo_or("hello", "CROWD_HELLO «مرحبااا!»", HELLO, hello_crowd, .3, 5)
    for k, (o, p_) in enumerate(((5, -.35), (7, -.3), (9.5, -.38), (12, .4), (14, .35), (16.5, .45))):
        cue(f"kiss {k + 1}", HELLO + o, kiss, .2, 1, "bed", pan=p_)
    cue("khala's bracelets (wave)", HELLO + 2, bracelets, .2, 0, "bed", pan=SPK["khala"][2])
    cue("SURGE push", SURGE, surge, .25, 0, "bed", dur=F(SOFA - SURGE))
    # ---- 5 COFFEE + ARRIVAL
    for k, f in enumerate(TCW):
        cue(f"TITLE_COFFEE_WORDS[{k}]", f, sfx.ink_thud, .48 + .06 * k, 4, weight=.5, pitch=1.05 + .05 * k)
    for k, (a, b) in enumerate(zip(POUR_S, POUR_E)):
        cue(f"POUR_START[{k}] ({T['pours'][k]['who']})", a, pour, .7, 5, dur=F(b - a), cup=1 + .06 * k, pan=(-.35, .3, -.1)[k])
    for k, f in enumerate(EYES):
        cue(f"EYES_WIDE[{k}] boing", f, eye_boing, .45, 3 + 3 * (k == 2), f0=(290, 350, 420)[k], pan=(-.35, .3, -.1)[k])
    cue("ENOUGH_SHAKE cup rattle", ENOUGH, cup_rattle, .5, 3, dur=.42, rate=13, pan=SPK["jiddo"][2])
    cue("ENOUGH_BUBBLE_POP", ENOUGH_POP, sfx.pop, .6, 4, f0=520)
    vo_or("enough", "grandpa «بس بس!»", ENOUGH_POP + 1, enough_voice, .34, 3)
    cue("WIRED cups rattling", WIRED[0], wired_rattle, .3, 0, "bed", dur=F(WIRED[1] - WIRED[0]))
    sig, _ = sfx.sonic_logo(None, gap=LOGO_GAP, ring_v=1.0)  # THE DOORBELL this time (brand seed, spot #2's clacks)
    mx.sfx(F(LOGO), sig, 0, .95, 7, "sonic_logo")
    CUE_LOG.append(("ARRIVAL_SONIC_LOGO «تشك-تشك»", F(LOGO), "sonic_logo", "key", len(mx.cues) - 1))
    cue("HEAD_SNAP fwip", SNAP, head_snap, .14, 0, "bed")
    for k, f in enumerate(TAW):
        cue(f"TITLE_ARRIVAL_WORDS[{k}]", f, sfx.stamp, .3 + .03 * k, 2, weight=.5, pitch=1.05 + .05 * k, lift=.4,
            air=.12 if k == 0 else .6)
    vo_or("awww", "HEARTS_POP «awww» + pops", HEARTS, awww, .24, 3)   # (its swell peaks under the whip: -2 dB keeps the limiter < 3 dB)
    cue("WHIP_3 (peaks on the cut)", WHIP3, whip_pan, .3, 2, "bed", dur=F(FEAST + 5 - WHIP3), peak=(FEAST - WHIP3) / (FEAST + 5 - WHIP3))
    # ---- 6 FEAST
    for k, f in enumerate(DIGS):
        cue(f"SPOON_DIGS[{k}] {('amo', 'THE HOST', 'walad')[k]}", f, dig, .85 if k != 1 else .95, 5, pan=(.0, .05, .4)[k], host=k == 1)
    for k, f in enumerate(HPOPS):
        cue(f"HEART_POPS[{k}]", f, heart_pop, .42, 2, f0=720 + 70 * k, pan=(-.4, .3, .5, -.2)[k])
    vo_or("mmm1", "MMM[0] amo", MMM[0], hum, .6, 4, who=("amo",), pitch=1.12)
    vo_or("mmm2", "MMM[1] walad + bint", MMM[1], hum, .5, 4, who=("walad", "bint"))
    for k, f in enumerate(TFW):
        big = k == len(TFW) - 1
        cue(f"TITLE_FINAL_WORDS[{k}]" + (" (big)" if big else ""), f, sfx.ink_thud, .5 + .03 * k + (.12 if big else 0), 5,
            weight=.5 + (.35 if big else 0), pitch=1.05 + .04 * k, big=big)
    # ---- 7 END CARD: the kit package (sheet, thup, cup plop, SONIC LOGO on the logo dots, CTA stamp, pop, glints, echoes)
    n0 = len(mx.cues)
    used = sfx.endcard_sfx(mx, F(CARD), gain=1.3)
    names = ["sheet swish", "sheet thup", "cup plop", "SONIC LOGO (logo dots)", "CTA stamp", "CTA chime", "comment pop",
             "glint cup", "glint CTA", "dot hop echo 1", "dot hop echo 2"]
    for k, (t, kind, _, _) in enumerate(mx.cues[n0:]):
        CUE_LOG.append((f"END_CARD {names[k] if k < len(names) else kind}", t, kind,
                        "bed" if kind in ("paper_swish", "glint", "sparkle", "cta_chime") else "key", n0 + k))
    return mx, used


def load_vo():
    out = {}
    if VO_DIR.exists():
        for f in sorted(VO_DIR.glob("*.wav")):
            x, sr = sf.read(f, always_2d=True)
            x = x.mean(1)
            if sr != SR:
                x = resample_poly(x, SR, sr)
            x = filt(peq(x, 3000, 2, .8), "highpass", 90, 2)
            out[f.stem] = .3 * x / (np.abs(x).max() + 1e-9)
    return out


# =============================== mastering with the TRUE SILENCE enforced after the master ===============================
def silence_mask():
    g = np.ones(N)
    a, b = int(round(F(SIL[0]) * SR)), int(round(F(SIL[1]) * SR))
    f = int(.003 * SR)
    g[a - f:a] = np.linspace(1, 0, f)
    g[a:b] = 0
    return g  # (the sonic logo starts exactly at b: no fade-in, its strike is the first sample out of the silence)


def deliver(x, log):
    """sfx.deliver(), but the comic freeze is re-zeroed AFTER the master's filters + limiter (their IIR ringing would
    otherwise leave -100 dB dust in it): the window is digital zero in the WAV and survives the MP3."""
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
    grf = -gr[:len(gr) // 1600 * 1600].reshape(-1, 1600).max(1)  # per frame (+10 ms offset)
    top = np.argsort(grf)[::-1][:8]
    log("  most limited frames: " + ", ".join(f"f{int(k)} {grf[k]:.1f} dB" for k in sorted(top)))
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


SWELLS = {"whip_pan", "whoosh", "paper_swish", "chatter", "mist", "moth", "fridge_hum", "fluoro", "surge", "door_swing",
          "wired_rattle", "swish_big", "lemon_roll", "fog_breath", "windback", "pour", "hum", "awww", "hello_crowd",
          "enough_voice"}


def verify(out, mu, sx, g, mx, dec, log):
    import librosa
    mono = out.mean(1)
    lib = librosa.onset.onset_detect(y=mono.astype(np.float32), sr=SR, hop_length=128, units="time", backtrack=False)
    ph_mu = phone(mu)
    rows = []
    log("\nCUE vs ONSET (each cue measured on its own dry signal x master gain; 'mix' = nearest librosa onset of the full "
        "mix within 50 ms; s = swell/bed, measured at -30 dB)")
    log(f"  {'cue':<40} {'frame':>6} {'cue s':>7} {'onset s':>8} {'err ms':>7} | {'mix onset':>9} {'err':>5} | over music dB full / phone")
    for label, t, kind, role, idx in CUE_LOG:
        _, _, i0, sig = mx.cues[idx]
        x = np.zeros((N, 2))
        a0 = max(0, i0)
        n = min(len(sig) - (a0 - i0), N - a0)
        if n <= 0:
            continue
        x[a0:a0 + n] = sig[a0 - i0:a0 - i0 + n] * g[a0:a0 + n, None]
        if not np.abs(x).max() > 0:
            log(f"  {label:<40} {t * FPS:6.1f} {t:7.3f}   (silenced)")
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
        log(f"  {label[:40]:<40} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+7.0f}{'s' if sw else ' '}| {ms} | {rs}")
        rows.append(dict(cue=label, frame=round(t * FPS, 2), t=round(t, 4), kind=kind, role=role, onset=round(on, 4),
                         err_ms=round(1000 * (on - t), 1), swell=sw, mix_onset=None if mo != mo else round(float(mo), 4),
                         over_music_db=None if mdb < -90 else round(rel, 1), over_music_phone_db=None if mdb < -90 else round(relp, 1)))
        if kind == "sonic_logo":
            t2 = t + (LOGO_GAP if abs(t - F(LOGO)) < 1e-6 else F(LOGO_DOTS[1] - LOGO_DOTS[0]))
            on2 = onset_near(x, t2, -.03, .05)
            lab2 = "  clack 2 (arrival)" if abs(t - F(LOGO)) < 1e-6 else "  clack 2 = logo dot 2"
            log(f"  {lab2:<40} {t2 * FPS:6.1f} {t2:7.3f} {on2:8.3f} {1000 * (on2 - t2):+7.0f}")
            rows.append(dict(cue=lab2.strip(), frame=round(t2 * FPS, 2), t=round(t2, 4), onset=round(on2, 4), err_ms=round(1000 * (on2 - t2), 1)))
        if kind == "fridge_yank":
            for lab2, t2 in (("  door knocks its stop (FRIDGE_YANK+6)", F(YANK + 6)),):
                on2 = onset_near(x, t2, -.004, .04)
                log(f"  {lab2:<40} {t2 * FPS:6.1f} {t2:7.3f} {on2:8.3f} {1000 * (on2 - t2):+7.0f}")
                rows.append(dict(cue=lab2.strip(), frame=round(t2 * FPS, 2), t=round(t2, 4), onset=round(on2, 4), err_ms=round(1000 * (on2 - t2), 1)))
        if kind == "logo_echo":
            t2 = t + F(EC["logoDots"][1] - EC["logoDots"][0])
            on2 = onset_near(x, t2, -.03, .05)
            log(f"  {'  echo clack 2':<40} {t2 * FPS:6.1f} {t2:7.3f} {on2:8.3f} {1000 * (on2 - t2):+7.0f}")
    log("\nMUSIC HITS vs ONSET (each hit's own dry signal; 'mix' = nearest librosa onset of the full mix within 50 ms)")
    errs, mrows = [], []
    for label, t, sig in sorted(MUSIC_EVENTS, key=lambda e: e[1]):
        e = uniform_filter1d(np.abs(sig).max(1), int(.001 * SR))
        on = max(0, int(round(t * SR))) / SR + np.argmax(e > e.max() * 10 ** (-15 / 20)) / SR
        errs.append(1000 * (on - t))
        near = lib[np.abs(lib - on) < .05]
        mo = near[np.argmin(np.abs(near - on))] if len(near) else np.nan
        ms = f"{mo:9.3f} {1000 * (mo - on):+5.0f}" if mo == mo else f"{'—':>9} {'':>5}"
        log(f"  {label[:58]:<58} {t * FPS:6.1f} {t:7.3f} {on:8.3f} {1000 * (on - t):+6.0f} | {ms}")
        mrows.append(dict(hit=label, frame=round(t * FPS, 2), t=round(t, 4), onset=round(on, 4), err_ms=round(1000 * (on - t), 1),
                          mix_onset=None if mo != mo else round(float(mo), 4)))
    log(f"  music hits: {sum(abs(e) <= 12 for e in errs)}/{len(errs)} start within 12 ms of their frame (median {np.median(errs):+.1f} ms)")
    # hard cuts + the freeze
    pk = lambda x, a, b: 20 * np.log10(np.abs(x[int(a * SR):int(b * SR)]).max() + 1e-12)
    for f_, name in ((DEAD[0], "DEAD_BEAT (music out, hum only)"), (SOFA, "door -> salon"), (SIL[0], "WIRED -> FREEZE")):
        log(f"  hard cut f{f_} {name}: music last 60 ms {pk(mu, F(f_) - .06, F(f_)):.1f} dBFS -> first 30 ms after "
            f"{pk(mu, F(f_) + .004, F(f_) + .03):.1f} dBFS (incl. the next section's own start)")
    log(f"  DEAD_BEAT f{DEAD[0]}-f{DEAD[1]}: music {pk(mu, F(DEAD[0]) + .005, F(DEAD[1])):.1f} dBFS, full mix (hum) "
        f"{krms_db(out, F(DEAD[0]), F(DEAD[1])):.1f} dB K-RMS")
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
    cs = [(0, WHIP1, "peephole"), (WHIP1, DEAD[0], "fridge"), (DEAD[0], T["clock"], "dead beat+lemon"), (T["clock"], T["door"], "clock+phone"),
          (T["door"], SOFA, "door"), (SOFA, SIL[0], "salon"), (SIL[1], FEAST, "arrival"), (FEAST, TFW[0], "feast"),
          (TFW[0], CARD, "title+hold"), (CARD, TL["DURATION"], "end card")]
    seg = lambda x, a, b: x[int(a * SR):int(b * SR)]
    ld = lambda x: -.691 + 10 * np.log10((sfx.kweight(x) ** 2).mean(0).sum() + 1e-20)
    log("  section loudness (K-weighted RMS, LUFS-ish) full / phone: " + " | ".join(
        f"{n} {ld(seg(out, F(a), F(b))):.1f} / {ld(seg(P, F(a), F(b))):.1f}" for a, b, n in cs))
    g2 = g[:, None]
    for a, b, n in cs:
        if n in ("dead beat+lemon", "arrival"):
            continue
        sm = ld(seg(out, F(a), F(b)))
        log(f"  {n:>12} stems (dB re mix, full / phone): " + " | ".join(
            f"{k} {ld(seg(v * g2, F(a), F(b))) - sm:+.1f} / {ld(seg(phone(v * g2), F(a), F(b))) - ld(seg(P, F(a), F(b))):+.1f}"
            for k, v in STEMS.items() if np.abs(seg(v, F(a), F(b))).max() > 1e-6) +
            f" | sfx {ld(seg(sx, F(a), F(b))) - sm:+.1f} / {ld(seg(phone(sx), F(a), F(b))) - ld(seg(P, F(a), F(b))):+.1f}")
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
    for f_, lab in ((DEAD[0], "dead beat"), (T["clock"], "clock"), (SOFA, "salon"), (SIL[0], "FREEZE"), (SIL[1], "doorbell=logo"),
                    (FEAST, "feast"), (TFW[-1], "hold"), (CARD, "end card"), (BUTTON, "button")):
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
        print(s, flush=True)
        lines.append(s)

    log(f"timeline (spec.ts, kit cues.ts): {TL['DURATION']} f = {DUR:.4f} s = {N} samples | peephole beats {A_BEATS} | "
        f"clock grid {[round(x, 1) for x in C_GRID]} | doorbell 2 {DB2_NOTES} | waltz quarter {WQ} f (pours {POUR_S}) | "
        f"feast quarter {FQ} f (digs {DIGS}) | freeze {SIL} | arrival logo {LOGO} (+{LOGO_GAP} s) | end card {CARD} logo dots "
        f"{LOGO_DOTS} cta {CTA} comment pop {COMMENT_POP} hops {HOPS}")
    log("end-card bars (frames): " + " ".join(f"[{a:g}-{b:g}]" for a, b in EBARS) + f" button {BUTTON}")
    vo = load_vo()
    if vo:
        log(f"VO lines found: {sorted(vo)}")
    music = build_music()
    mx, used = build(vo)
    mx.music(music)
    mx.silence(F(SIL[0]), F(SIL[1]))
    x = mx.mix(sfx_room=.08)
    out, g, meas = deliver(x, log)
    dd = np.r_[mx.duck, np.zeros(-N % 48)].reshape(-1, 48).max(1)  # (the kit Mixer.mix() ducking curve, replayed)
    for k in range(1, len(dd)):
        dd[k] = max(dd[k], dd[k - 1] * .986)
    d = 10 ** (-uniform_filter1d(np.repeat(uniform_filter1d(dd, 4), 48), 96)[:N] / 20)
    mu = filt(filt(mx.m * d[:, None], "highpass", 32, 3), "lowpass", 15000) * g[:, None]
    sx = out - mu
    for k in STEMS:
        STEMS[k] = filt(filt(STEMS[k] * d[:, None], "highpass", 32, 3), "lowpass", 15000)  # (x g in verify)
    sf.write(OUT / "stems/music.wav", mu, SR, subtype="PCM_24")
    sf.write(OUT / "stems/sfx.wav", sx, SR, subtype="PCM_24")
    dec = decode(MP3)
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels",
                           "-of", "compact", str(MP3)], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
    log(f"MP3: {info} | decoded {len(dec)} samples (spot = {N})")
    rows, mrows, P = verify(out, mu, sx, g, mx, dec, log)
    sf.write(OUT / "phone-band.wav", P, SR, subtype="PCM_24")
    (OUT / "cues.json").write_text(json.dumps(dict(measure=meas, cues=rows, music=mrows), indent=1, ensure_ascii=False))
    (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")
    plot(out, P, OUT / "overview.png", title="SurpriseGuests soundtrack - 0-16 s (cue lanes = spec frames)")
    plot(out, P, OUT / "zoom-1-peephole-fridge.png", 0, F(T["clock"]) + .1, "zoom: chime hook → peephole → whip → fridge (flicker choir) → dead beat → bulb")
    plot(out, P, OUT / "zoom-2-clock-door.png", F(T["clock"]) - .1, F(SOFA) + .2, "zoom: clock panic (saba) → doorbell 2 → thumb → door → «مرحبااا» → surge")
    plot(out, P, OUT / "zoom-3-salon-arrival.png", F(SOFA) - .1, F(FEAST) + .4, "zoom: salon waltz (pours) → wired → FREEZE → «تشك-تشك» doorbell → awww")
    plot(out, P, OUT / "zoom-4-feast-end.png", F(FEAST) - .2, DUR, "zoom: feast groove (digs) → title stop-time → hold → end card")
    if PREVIEW_VIDEO.exists():
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(PREVIEW_VIDEO), "-i", str(WAV), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT / "preview-half.mp4")], check=True)
        pv = decode(OUT / "preview-half.mp4")
        a, b = int(2.0 * SR), int(4.0 * SR)
        xc = np.correlate(pv[a - 4096:b + 4096, 0], out[a:b, 0], "valid")
        log(f"preview: {(OUT / 'preview-half.mp4').relative_to(REPO)} (AAC audio vs master: {int(np.argmax(xc)) - 4096:+d} samples)")
        (OUT / "verify-report.txt").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
