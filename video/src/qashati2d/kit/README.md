# «Qashati 2D» kit — the shared hand-made world of the 2D series

Three spots (`../qaf`, `../spoon`, `../guests`) share this kit so the series reads as ONE crafted world.
Client ask: «ساويلي فيدوهات تانية بس مو 3d فيها ساويها 2d بس» — 2D only. Spot #1 (flat vector) was rejected as a
template, so this 2D is **hand-made, printed-looking and premium**: paper, riso misregistration, halftone shading,
variable-weight teal ink that boils on twos, props animated on twos with squash & stretch, smooth cameras.

```ts
import {HeroCup2D, FamilyPlate2D, Hand2D, HAND_PRESETS, SpeechBubble, InkTitle, EndCard2D, ENDCARD_DURATION,
        PaperGrain, Riso, C, FONT, onTwos, jiggle, SAFE} from '../kit/lib';
```
(`kit/lib.ts` is the barrel; `kit/index.ts` is only the kit's own Remotion entry for the style frames.)

Style frames: `npx remotion studio src/qashati2d/kit/index.ts` → **Kit2DStyleFrames** (510 frames, pages below), or
`bash src/qashati2d/kit/tools/stills.sh <outdir> Kit2DStyleFrames <frame…>` (one bundle, full-size PNGs, 360-px copies,
contact sheets). Rendered set: `out/qashati2d/kit/` (`style-*.png`, `sheet-*.jpg`).

| page | frames | shows |
|---|---|---|
| cup | 0–59 | HeroCup2D, honey drizzling in, glint |
| states | 60–119 | chili variant + heat + Flame2D · spoon dipping · spoon lifted (strand necks & snaps) · squash/wobble + CreamDrop2D |
| plate | 120–179 | FamilyPlate2D scoopsTaken 0 → 8 (last frames: the lonely drop) |
| type | 180–239 | `<Riso>` · InkTitle word-by-word press · SpeechBubble (RTL, Arabizi line, shout, thought) |
| hands | 240–299 | Hand2D close-ups (240–269) · the 7 presets around the plate (270–299) |
| endA | 300–404 | EndCard2D over a red scene (qaf-style: no headline) |
| endB | 405–509 | EndCard2D with a headline (spoon-style) |

---

## Conventions (all spots)

- **Stage** (`stage.ts`): 1080×1920, 30 fps. Key text inside `SAFE` = x 60–960, y 220–1400; CTAs end ≤ ~1400; keep the
  bottom 35 % (y > 1248, `CAPTION_ZONE_TOP`) free of anything important if possible.
- **On twos** (`time.ts`): characters, props, bubbles, titles step every 2 frames → feed them `onTwos(frame)`
  (or `useOnTwos()`); the **camera moves on ones** (smooth) — the stop-motion feel comes from that contrast.
  Never the default scale-pop: use `popOnTwos` (smear → stretch → squash → settle), `anticipate`, `jiggle`,
  `stretchFromVelocity`, or your own keys.
- **Boil**: every drawing component boils its ink by itself (seed = `Math.floor(frame/2)` + a per-layer offset), and line
  and colour boil independently (cel / riso look). `boil={0}` freezes a drawing. Your own SVG art: `useBoil({scale})`.
- **Determinism**: everything is a pure function of props + frame; geometry is seeded (`rng`, `noise1`) and cached.
- **Arabic**: always whole words/lines (never per letter: joining breaks); `direction: rtl`; Western digits;
  SpeechBubble lays out Latin/Arabizi lines LTR automatically (`isRtl`).
- **Copy rules**: no «يا قشطة», no "authentic/best/fresh daily", no flags/politics, Talabat/Kinder/Nutella as text only,
  no real app UI, no delivery-time claims. CTA truth: **Talabat first**; the brand app is only confirmed on Google Play.
- **Order of layers in a scene**: background → camera layers (art) → type → `<PaperGrain/>` LAST (over everything).
  Wrap a whole scene in `<Riso>` for misregistration (optional; it rasterises the subtree — costs render time).

## Palette + fonts

`palette.ts` → `C` (from CONCEPTS-2D): turquoise `#01E8D5`, **teal ink `#053F3B`** (outlines + text), cream `#FFF7E8`,
paper `#F3E6CC`, honey `#F4AE22`, strawberry `#F0364F`, mango `#FFA41B`, kiwi `#7CC242`, chili `#E5303A` — each with
`…Deep/…Shade/…Light` companions for cel shading and halftone (no smooth gradients), plus steel, pistachio, flame,
5 skin tones (+ shades) and henna.
`fonts.ts` → `FONT.title` Lalezar (punchy headlines, stamps, CTA) · `FONT.friendly` Baloo Bhaijaan 2 800 (bubbles) ·
`FONT.ui` IBM Plex Sans Arabic 400–700 (info lines) · `FONT.latin` Poppins 500. Emoji fall back to Noto Color Emoji.
`FONT_WEIGHT[key]` is the weight each family exists in.

## Look layer (`look/`)

| component | what | key props |
|---|---|---|
| `<PaperGrain/>` | multiply grain + fibres + specks (pre-rendered by `tools/make_textures.py` → `public/qashati2d/textures/`), light fibres screened on dark ink, soft print vignette; the sheet shifts on twos (re-photographed) | `strength` 1, `fibres` .8, `vignette` .35, `still` |
| `<Riso>` | ink-plate misregistration: dark pixels (lines, text) lifted off, a hair of paper left ONLY in the gap the shifted plate uncovers (not through grain voids — that read as snow on textured type), ink re-printed 1–2 px off (jitters on twos) | `amount` 1.6, `jitter` .5, `gap` paper colour |
| `<Halftone/>` | true AM halftone (dot radius ∝ √tone) from tone descriptors `{t:'lin'|'rad'|'noise'|'const'}`, clipped by the caller | `box`, `cell`, `angle`, `tone`, `fill`, `clipPath`, `maxR` |
| `useBoil()` / `<Boil>` / `<BoilDefs>` | feTurbulence → feDisplacementMap, seed on twos | `scale` (px), `freq`, `offset`, `cycle`, `frame` |
| `<Ink>` / `brush()` | variable-weight ink stroke as a filled path: tapered ends, calligraphic nib, heavier on the shadow side, pressure jitter, closed strokes with a pen-lift overlap | `pts`, `w`, `closed`, `o: BrushOpts` |
| `<InkTextureFilter>` | printed-ink texture for HTML type (rough edge, grain voids, pinholes, bleed) | `seed` (pass one that changes on twos) |

`geom.ts` also has `catmull`, `smoothD`, `shapeD`, `blobPts`, `ellipsePts`, `roundedPoly`, `stackOutline` (union
silhouette + crease runs of stacked shapes — how the qashta dome is inked), `pointInPoly`, `rng`, `noise1`, `fbm1`.

## Art (`art/`)

### `<HeroCup2D/>` — the product (same cup in every spot and on the end card)
Clear tapered cup, turquoise Q sticker, strawberry / kiwi / mango cut faces pressed on the wall (juicy, glossy, seeds),
thick ivory qashta bands with halftone cylinder shading, a heaped qashta dome of overlapping lobes (one heavy
silhouette, light broken creases; each lobe cel-shaded — a shade crescent, a cool turquoise bounce light on the shadow
side, white speculars), a poured-honey drizzle drawn as a LIQUID (`art/Honey.tsx`: width breathes thin↔fat, puddles in
the valleys, amber rim / golden body / pale caustic on the shadow side / broken white speculars on the lit side / ink
only on the shadow edge; a rounded head while it pours, a hanging bead on the lip when done), angular pistachio crumbs (some purple-skinned), kiwi / strawberry / mango garnish, halftone cast shadow.
Art space 600×1000, base contact point (300, 930); at `scale` 1 the rim is ≈ 464 px wide.

| prop | |
|---|---|
| `x`, `y` | parent px of the BASE contact point (squash/tilt are anchored there) |
| `scale` | 1 → rim ≈ 464 px |
| `variant` | `'qashta'` \| `'chili'` (red sauce, flakes, seeds, bubbles, chili-oil drizzle, a pepper on top) |
| `honeyProgress` | 0..1 drizzle drawn along its path (pools appear as it passes, bead at the end) |
| `spoon`, `spoonT` | `'none'` \| `'dipping'` (anticipation lift, then into the cream, collar) \| `'lifted'` (heaped spoon rises, stretchy strand necks and snaps at 0.72, crater + spring-back peak) |
| `squash`, `wobble`, `tilt` | + squash / − stretch (base-anchored), dome sway −1..1, degrees |
| `heat` | chili: boiling heat wiggles 0..1 |
| `glint` | 0..1 star glint on the dome |
| `shadow`, `boil`, `toppings`, `frame` | halftone shadow colour/false, boil multiplier, hide toppings, frame override |

Anchors: `CUP_ANCHORS` (`domeTop`, `spoonEntry`, `sticker`, `rimLeft/Right`, `flames[3]`) → `cupPoint(p, x, y, scale)`
gives parent px (e.g. to sit `<Flame2D>`s on the chili dome or aim a hand).

### `<FamilyPlate2D/>` — top-down sharing plate
Rings of fruit on a qashta field, a central qashta mound, a poured-honey drizzle (Honey.tsx), crumbs, turquoise Q
sticker on the rim, on a ROUND engraved brass tray — the Levantine صينية (`tray` true/`'brass'` | `'turquoise'` enamel |
false). (It used to be a turquoise rounded square: with the white plate inside it read as an APP ICON at phone size.)
**`scoopsTaken` 0..8**: bites 1–7 each dig 3 spoon-bowl ovals from the rim inwards (fractional = digging in, outer
first) and together clear the whole ring; bite 8 takes what is left of the centre mound. Each scoop edge is inked on the
food side (heavier on the shaded upper-left wall) with a lit lip on the lower-right wall, and the remaining food casts a
shadow into the bites. Under the food: broken cream film, teardrop drag marks (different per bite), one long wipe
around the plate, honey streaks, crumbs — messy, not radial. **One glossy cream dollop** appears only once bite 8 has
started (it is the punchline — `drop` forces it), `dropShape` `'dollop'` | `'dot'` (logo-dot shape), `dropWobble` 0..1.
`rotate` for a slow drift. **7 hands → 8 bites:** map hand n (1..7) to `scoopsTaken = n * 8 / 7`, or let hand 7 take
bites 7 and 8 (two dips).
Aim hands at `PLATE_SCOOPS[i]` (`x, y, angle` = direction the hand comes from) via `plateScoopPoint(i, x, y, scale)`.

### `<Hand2D/>` — a re-skinnable spoon hand (top-down)
Back of a right hand, fingers curled under the spoon handle, thumb along it; spoon bowl at the local origin.
Props: `x, y` (bowl centre), `angle` (0 = arm from the bottom; for an arm reaching in from direction d use
`armAngle(d)` = d − 90), `scale`, `skin` 0..4, `sleeve {color, shade, cuff, pattern: none|stripes|dots|spikes|knit|sheen,
patternColor, embroidery}`, `accessories: watch|bracelets|misbaha|henna|ring`, `spoon`, `load` (qashta on the spoon),
`grip` 0..1 (animate on twos for the scoop squeeze), `left` (mirror). The sleeve runs ≈ 3000 units, so at any
scale/angle the arm LEAVES the frame (never a stump floating on the table) — keep the hand's bowl inside the frame and
let the arm run out of it.
`HAND_PRESETS`: `kandura` · `abaya` (henna + ring, gold-thread cuff) · `kid` (dino sleeve with spikes) · `grandpa`
(thobe + misbaha) · `uncle` (striped shirt + watch) · `aunt` (knit + bracelets) · `teen` (hoodie).

### Small props
- `<Spoon2D/>` / `<SpoonArt/>`: steel teaspoon (or `palette="turquoise"`), `load` (a dollop with a curl), `coat`,
  **`melt` 0..1** (handle droops, bowl sags, drips — the qaf heat gag), `sweat` 0..1 (drops flick off on twos).
- `<Flame2D/>` / `<FlameArt/>`: red→orange→yellow flame, inked, tongues redrawn on twos, two embers flicking off; every
  `seed` has its own silhouette (tongue heights, lean, width) — give each flame a different seed (`h`, `seed`, `intensity`).
- `<HoneyDrizzle pts progress hw pools bead colors/>` (inside an SVG) / `honeyPaths()` + `<HoneyLayers/>`: the honey
  (or `HONEY_COLORS.chiliOil`) liquid on its own — pour it over anything (a spoon, the plate, a title).
- `<CreamDrop2D/>` / `<CreamDropArt/>`: a qashta drop shaped exactly like a logo dot (`which` 0|1), `stretch` while
  falling, `squash` on landing.
- `<Sticker/>`, `<QMark/>` (white Q + dots from logoPaths), `<FruitPiece kind/>`, `<Crumbs/>`, `<Glint/>`, `<Dollop/>`.

## Type (`type/`)

- **`<SpeechBubble/>`**: hand-drawn wobbly bubble (never a UI pill), boiling ink, curved tail to `tail: [x, y]`,
  `text` (lines on `\n`, RTL; Latin lines auto LTR) + optional `sub` (Poppins, for Arabizi like "bas wa7de"),
  `shape` round|cloud (scalloped THOUGHT bubble with two trailing puffs instead of a tail)|burst (shout), pops on twos
  from the tail (`start`), optional `exit`; `x, y` = bubble centre. It measures its text after the font loads
  (`useTextWidths`, under delayRender) so the bubble always fits — so a long one-liner makes a long ribbon: break it
  with `balanceLines(text)` (two balanced lines at a word gap, trailing emoji kept with its word).
- **`<InkTitle/>`**: big headline, word by word (first word on the right), each word PRESSED on twos (approach → wide
  wet impact → settle), ink texture reseeded every drawing, specks flung above/below, optional riso `plate` colour,
  `highlight` per word index, `exit`. Impact frame of word i = `start + i*stagger + 2` (put the ink thud there).

## End card (`endcard/`)

`<EndCard2D comment="…" headline?="…" />` in `<Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}>` (105 f
= 3.5 s). A turquoise paper sheet slides up over the previous scene (`enter="paper"`, render the last scene under it;
`"cut"` = opaque), the HeroCup2D drops in and lands, the **teal** logo (7:1 on turquoise — never white) lands its two
dots = **the sonic logo**, "The Sweet Happiness", the CTA lands as a printed stamp «اطلبها من طلبات», then
«أو من تطبيق قشاطي الشام» and «ندّ الحمر · دبي», then the per-spot comment prompt pops as the cup's speech bubble (at
the top RIGHT, two balanced lines, its tail on the cup's dome; with a `headline` it moves under the info lines as one
line and its tail points down to the comments). The logo reveal is drawn ON TWOS (`LogoReveal2D`: the Q presses in like
a stamp, the dots fall and splat at +8/+14 = the sonic logo, wordmark wiped R→L in steps), then `LivingLogo2D`. The
caption zone (y > 1440) gets a teal halftone that deepens to the bottom: it grounds the card and gives the platform's
white caption text a darker bed — keep anything of yours out of it. Loop life: the cup
breathes and sways, ink boils, a glint crosses the cup and the CTA, the CTA re-presses, the logo dots hop.
Props: `comment`, `headline`, `enter`, `cup` (HeroCup2D overrides, e.g. `{variant:'chili'}`), `copy`, `grain`.

**Cues (relative frames, `endcard/cues.ts` → `EC`)**: sheet 0 · sheetIn 8 · headline 4 (+2 per word impact) ·
cupLand 14 · logoStart 12 · **logoDots [20, 26] = sonicLogo 20** · tagline 38 · cta 46 (impact; approach 44) · sub 54 ·
location 58 · comment 66 (pop sound at +2) · glintCup 76 · glintCta 84 · dotHops [92, 98] · end 105.

## Audio (`audio/sfx.py`)

```python
import sys; from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "kit/audio")); import sfx
T = sfx.ts_eval("import {T} from './src/qashati2d/<spot>/spec'; console.log(JSON.stringify(T));")
mx = sfx.Mixer(DUR)
mx.voice(t, sfx.ink_thud, gain=.6, duck_db=5)          # any voice, own seed per cue
sfx.endcard_sfx(mx, sfx.fr(T["endCard"]))               # the whole end-card package, locked to cues.ts
mx.silence(t0, t1)                                       # a TRUE silence for comic beats (digital zero)
sfx.deliver(mx.mix(), DUR, OUT_WAV, OUT_MP3)             # −14 LUFS, MP3 TP ≤ −1.2, exact length, last sample 0
```
- **Sonic logo «تشك-تشك»**: `sonic_logo(None, gap, ring_v)` / `logo_echo(None, gap)` / `clink()` — ported verbatim
  from spot #2 with the same fixed seed; `python3 kit/audio/demo_sfx.py --check` proves it is sample-identical.
  On the end card the two clacks ARE the logo's two dots (gap = 6 frames = 0.2 s).
- Foley: `ink_thud` (+`big`), `stamp`, `paper_swish`, `paper_flip`, `paper_thup`, `cup_plop`, `pop`, `plink`, `splat`,
  `spoon_clink` (ceramic), `spoon_plastic`, `scoop`, `suction`, `stretch`, `snap`, `curd`, `whoosh`, `swish`,
  `swish_big`, `whip`, `flame_whoosh`, `fire_loop`, `sizzle`, `crickets`, `doorbell`, `order_ping`, `sparkle`, `glint`,
  `chime`, `cta_chime`, `sweat_drip`, `tap`, `blip`, `bloop`; DSP: `ks` (Karplus-Strong), `mallet`, `jingles`, `reverb`,
  `peq`, `lowshelf`, `tv_band`, `swept`, `swell`, `pan2`, `place`.
- Mastering: `master()` (filters, exact length, −14 LUFS under a 4×-oversampled TP limiter, cos² fade to digital zero),
  `deliver()` (WAV 24-bit + MP3 192k with the encoder's level shift corrected, ceiling lowered until the MP3 TP ≤ −1.2),
  `ebur128()`, `silence_ranges()` (verify comic dead stops survive).
- Outputs per spot: `public/qashati2d/audio/<spot>.mp3` (for Remotion) + `out/qashati2d/<spot>.wav` (master, mux this).
- Demo: `out/qashati2d/kit/audio/sfx-demo.wav` (every voice, cue sheet `.txt`), `endcard-demo.wav/.mp3`, and
  `out/qashati2d/kit/endcard-A-sound.mp4` (end card page + its sound, delivery encode).

## Delivery encode
Remotion renders full-range BT.601 → convert to BT.709 limited and mux the master WAV (spot #2's lesson):
`bash src/qashati2/deliver.sh render.mp4 master.wav out.mp4` (same command works for the 2D spots).

## Performance
No GPU: ~2.5–3 s per 1080×1920 frame per worker for a full end card (≈1 s/frame wall at --concurrency=3; measured: 105 f in 99 s). Render
with `nice -n 10 … --concurrency=3`. `<Riso>` over a whole scene and many simultaneous HeroCups cost the most.
