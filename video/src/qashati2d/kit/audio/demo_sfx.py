#!/usr/bin/env python3
"""Check + audition the shared audio kit.

    nice -n 10 python3 video/src/qashati2d/kit/audio/demo_sfx.py            # all of it
      1. --check: the ported sonic logo is SAMPLE-IDENTICAL to spot #2's (imports video/src/qashati2/audio/make_sound.py)
      2. out/qashati2d/kit/audio/sfx-demo.wav      every foley voice in a row (cue sheet: sfx-demo.txt)
      3. out/qashati2d/kit/audio/endcard-demo.wav  the end-card package alone, mastered with deliver() (+ .mp3),
                                                    to mux under a render of Kit2DStyleFrames' end-card page
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfx  # noqa: E402

OUT = sfx.VIDEO / "out/qashati2d/kit/audio"


def check_sonic_logo():
    path = sfx.VIDEO / "src/qashati2/audio/make_sound.py"
    spec = importlib.util.spec_from_file_location("q2sound", path)
    q2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(q2)  # (evaluates spot #2's timeline with esbuild; does not render anything)
    ok = True
    for gap, ring in ((.15, 1.0), (.2, 1.3), (.2, 0.0)):
        a, _ = q2.sonic_logo(None, gap=gap, ring_v=ring)
        b, _ = sfx.sonic_logo(None, gap=gap, ring_v=ring)
        same = a.shape == b.shape and np.array_equal(a, b)
        ok &= same
        print(f"sonic_logo(gap={gap}, ring_v={ring}): {'IDENTICAL' if same else 'DIFFERENT'} {a.shape} max|diff| "
              f"{np.abs(a - b).max() if a.shape == b.shape else 'shape'}")
    rng1, rng2 = np.random.default_rng(7), np.random.default_rng(7)
    c1, c2 = q2.clink(rng1, q2.hz("D6")), sfx.clink(rng2, sfx.hz("D6"))
    print(f"clink(D6): {'IDENTICAL' if np.array_equal(c1, c2) else 'DIFFERENT'}")
    ok &= np.array_equal(c1, c2)
    for name in ("stamp", "plink", "scoop", "pop"):
        r1, r2 = np.random.default_rng(3), np.random.default_rng(3)
        args = {"stamp": {}, "plink": {"note": "A5"}, "scoop": {"dur": .5}, "pop": {}}[name]
        x1, _ = getattr(q2, name)(r1, **args)
        x2, _ = getattr(sfx, name)(r2, **args)
        print(f"{name}: {'IDENTICAL' if np.array_equal(x1, x2) else 'DIFFERENT'}")
        ok &= np.array_equal(x1, x2)
    return ok


def demo_reel():
    voices = [
        ("sonic_logo (end-card gap 0.2 s, ring 1.3)", lambda r: sfx.sonic_logo(None, gap=.2, ring_v=1.3), .68),
        ("logo_echo", lambda r: sfx.logo_echo(None, gap=.2), .6),
        ("ink_thud", lambda r: sfx.ink_thud(r), .6),
        ("ink_thud big", lambda r: sfx.ink_thud(r, big=True, weight=1.2), .8),
        ("paper_swish", lambda r: sfx.paper_swish(r), .6),
        ("paper_flip", lambda r: sfx.paper_flip(r), .6),
        ("paper_thup", lambda r: sfx.paper_thup(r), .6),
        ("cup_plop", lambda r: sfx.cup_plop(r), .6),
        ("pop", lambda r: sfx.pop(r), .7),
        ("plink A5", lambda r: sfx.plink(r, "A5", big=True), .4),
        ("splat", lambda r: sfx.splat(r), .7),
        ("spoon_clink (ceramic)", lambda r: sfx.spoon_clink(r), .45),
        ("spoon_plastic", lambda r: sfx.spoon_plastic(r), .6),
        ("scoop", lambda r: sfx.scoop(r, .5), .7),
        ("suction", lambda r: sfx.suction(r), .5),
        ("stretch", lambda r: sfx.stretch(r, .5), .45),
        ("snap", lambda r: sfx.snap(r), .6),
        ("whoosh up", lambda r: sfx.whoosh(r), .6),
        ("swish_big", lambda r: sfx.swish_big(r), .7),
        ("whip", lambda r: sfx.whip(r, .3), .55),
        ("flame_whoosh", lambda r: sfx.flame_whoosh(r), .7),
        ("fire_loop 1.2 s", lambda r: sfx.fire_loop(r, 1.2), .4),
        ("sizzle 1 s", lambda r: sfx.sizzle(r, 1.0), .38),
        ("doorbell", lambda r: sfx.doorbell(r), .45),
        ("crickets 2 s", lambda r: sfx.crickets(r, 2.0), .5),
        ("sparkle", lambda r: sfx.sparkle(r), .2),
        ("glint", lambda r: sfx.glint(r), .3),
        ("cta_chime", lambda r: sfx.cta_chime(r), .15),
        ("order_ping", lambda r: sfx.order_ping(r), .3),
        ("sweat_drip", lambda r: sfx.sweat_drip(r), .5),
    ]
    t = .3
    parts, lines = [], []
    for name, fn, g in voices:
        sig, lead = fn(np.random.default_rng(sfx.BRAND_SEED + len(lines)))
        sig = sfx.pan2(sig) if sig.ndim == 1 else sig
        parts.append((t + lead, sig * g))
        lines.append(f"{t:7.2f} s  {name}")
        t += len(sig) / sfx.SR + .45
    buf = np.zeros((int((t + .5) * sfx.SR), 2))
    for t0, sig in parts:
        sfx.place(buf, sig, t0 - 0)
    OUT.mkdir(parents=True, exist_ok=True)
    out, _ = sfx.master(buf, len(buf) / sfx.SR, fade_out=.2)
    sf.write(OUT / "sfx-demo.wav", out, sfx.SR, subtype="PCM_24")
    (OUT / "sfx-demo.txt").write_text("\n".join(lines) + "\n")
    print(f"{OUT / 'sfx-demo.wav'}: {len(voices)} voices, {len(out) / sfx.SR:.1f} s")


def endcard_demo():
    cues = sfx.endcard_cues()
    dur = cues["ENDCARD_DURATION"] / sfx.FPS
    mx = sfx.Mixer(dur)
    used = sfx.endcard_sfx(mx, 0.0, cues["EC"])
    x = mx.mix()
    res = sfx.deliver(x, dur, OUT / "endcard-demo.wav", OUT / "endcard-demo.mp3", fade_out=.25)
    print("end-card cue times (s):", {k: (round(v, 3) if not isinstance(v, list) else [round(a, 3) for a in v]) for k, v in used.items()})
    return res


if __name__ == "__main__":
    ok = check_sonic_logo()
    print("PORT CHECK:", "PASS" if ok else "FAIL")
    if "--check" in sys.argv:
        sys.exit(0 if ok else 1)
    demo_reel()
    endcard_demo()
