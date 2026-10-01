# «مش قشطة» — production spec (Qashati Alsham spot #2)

Research and concept: `brands/qashati-alsham/RESEARCH.md`, `brands/qashati-alsham/CONCEPTS.md` (concept A).
Timing, copy, colours: **`spec.ts` is the single source of truth** — never hard-code frames or copy elsewhere.

## The idea in one line
Everything in a Dubai day is «مش قشطة» (not qashta = not all good) — until the order arrives: two qashta
drops (the two dots of the logo's ق) fall on the phone glass and **wash the word «مش» off every stamp**,
so they all read «قشطة». Then the real hero: the cup. «خلّيها قشطة.» ("keep it qashta / make it all good").

"قشطة" is Egyptian/pan-Arab slang for "all good", and the product's name. The brand promise printed on their
cups is "The Sweet Happiness". Their own site talks about memories of old Damascus → our sonic logo is the
brass cymbal clink of the Damascene liquorice-juice seller («تشك-تشك»), not visual clichés.

## Why the first spot failed (don't repeat)
Ingredient-explainer infographic, flat stock-icon vector, default scale-pop easing, locked symmetric camera,
no gloss/viscosity, no human truth, no humour. Everyone in the category shows honey drizzle + toppings.

## Craft rules
- **Screen-life must feel like a real phone screen recording**, not a vector illustration: real UI density,
  status bar (clock per screen from spec, battery draining 31% → 12%, signal), realistic typography sizes,
  subtle blur/shadows, native-feeling transitions (swipe/slide), a thumb-tap ripple before each app switch,
  notification banner behaviour. Generic UI only — **no Apple/Google/WhatsApp logos, names or exact designs**
  (inspired-by, not copies). Arabic UI, RTL, IBM Plex Sans Arabic. Emoji via system Noto Color Emoji.
- **Stamps:** Lalezar, rubber-stamp look (double rounded border, ink texture via SVG feTurbulence/feDisplacement,
  slight rotation −9°…+9°, ink bleed), slam in with overshoot + screen shake + a few ink specks.
  They **stay on the glass** as the screens change underneath, piling up (4 by 4.8 s), so the chaos builds.
- **The twist (Act 2)** is the money shot: glossy cream drops (cream #FFF7E8 with specular highlight and a
  refraction-ish darker rim) hit the glass with a small splash, then run down in wobbly paths across the stamps.
  Where a drop passes, «مش» melts away (dissolve + drip) and the stamp turns turquoise and reads «قشطة»,
  with a happy little bounce. Must read instantly at phone size, sound off.
- **Product (Act 3):** 3D hero shot of the cup rendered in Blender — soft, tactile, appetising (subsurface
  qashta, glossy honey, translucent fruit, clear cup with turquoise sticker + white Q). Turquoise seamless set.
  Two cream drops land on the dome (logo motif). Camera slow push-in. Not a diagram — a craveable object.
- **Type:** «خلّيها قشطة.» in Baloo Bhaijaan 2 800, teal on turquoise or white on turquoise, big.
- Sound-off must still work; sound-on must be delightful (stamps thud, chaos builds, dead stop, cymbal).
- Keep key text inside SAFE (spec.ts). Arabic never animated letter-by-letter (breaks joining).

## Components & interfaces
| Part | Files | Output |
|---|---|---|
| Phone story (Acts 1–2) | `video/src/qashati2/phone/*.tsx`, exports `PhoneStory` (renders frames 0 → T.cupShot incl. the flood transition) | own test entry `video/src/qashati2/phone/index.ts`, comp `PhoneStoryTest` |
| 3D cup shot | `motion/qashati/cup3d.py`, `motion/qashati/render_cup.sh` | `video/public/qashati2/cup-shot.mp4` (1080x1920, 30 fps, exactly 120 frames = 4 s, bt709) + `cup-packshot.png` (transparent, for the end card) |
| Sound | `video/src/qashati2/audio/make_sound.py` (reads spec.ts, phone/timeline.ts, endcard/layout.ts at run time — re-run after picture lock) | `video/public/qashati2/audio/mish-qashta.mp3` + master `out/qashati2/mish-qashta.wav` (17.0 s, −14 LUFS, TP ≤ −1) |
| Assembly, title stamp, end card | `video/src/qashati2/MishQashta.tsx`, `endcard/**`, `compositions.tsx`, `index.ts` | comp `MishQashta` |

Render + deliver (v2):
```bash
python3 video/src/qashati2/audio/make_sound.py                 # after any timing change
cd video && npx remotion render src/qashati2/index.ts MishQashta out/qashati2/render.mp4 --crf=14
bash src/qashati2/deliver.sh out/qashati2/render.mp4 out/qashati2/mish-qashta.wav out/qashati2/mish-qashta-v2.mp4
```
`deliver.sh` converts Remotion's full-range BT.601 output to BT.709 limited (v1 shifted the turquoise to cyan) and muxes
the WAV master (Remotion's own AAC carries a ~43 ms priming lag). Never post the raw render.

v2 changes come from the 4-lens review panel on v1 (`out/qashati2/review-panel/panel.json`): hook stamp on frame 0,
accelerating Act 1 + burst, true silence before the order, hero erase with push-in + hold, spoon scoop and merged drops in
the 3D shot, «خلّيها قشطة.» as a stamp, end card with packshot + teal logo + Talabat-first CTA + comment prompt.
