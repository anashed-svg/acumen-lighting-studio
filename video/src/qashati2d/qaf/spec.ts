// «الفرق بالـ ق» — Qashati Alsham 2D spot #1 of the 2D series (script 1 in brands/qashati-alsham/CONCEPTS-2D.md).
// Single source of truth for the frame timeline, the layout, the copy and the SOUND CUE LIST. Pure data (no React):
// the sound script reads it through esbuild (kit/audio/sfx.py ts_eval), so move a cue here and the sound follows.
//
// The idea: «قشطة» without its «ق» is «شطة» (chili). A drawn finger flicks the ق off the word → the world turns to
// chili (red, the letters catch fire, the cup fills red-hot, the hopeful spoon sweats and melts) → the ق comes back
// like a boomerang, its two dots fall as two drops of qashta (the logo's drops) → a turquoise wave with a cream crest
// washes the red away → «الفرق كلّو بحرف.» becomes «الفرق كلّو بالـ ق.» (the ق hops), the spoon finally dives in →
// end card «إنت فريق قشطة ولا فريق شطة؟ 👇».
//
// 30 fps, 1080×1920, 375 frames (12.5 s). Drawings step ON TWOS; the camera moves on ones.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 375; // 12.5 s
export const ENDCARD_AT = 270; // 9.0 s — EndCard2D (105 f) runs 270 → 375

// ------------------------------------------------------------------------------------------------ frame timeline
export const T = {
  // ACT 1 — the flick (frame 0 is the thumbnail: the finger already cocked under the ق, the ق's drops shiver)
  windup: 4, // the finger pulls back (anticipation) 4 → 9, trembling harder
  flick: 10, // RELEASE: smear drawing, the nail hits the ق (impact star on the ق)
  qafGone: 20, // the ق (with its two drops) is out of frame, spinning, up and to the right
  heal: 18, // the orphaned ش re-shapes medial → initial: «‍شطة» becomes a clean «شطة» (tiny ink tick)
  handOut: [14, 26] as const, // the hand goes loose and withdraws (down-right, out of frame)
  camPullback: [12, 24] as const, // camera eases out from the tight hook to the medium shot (reveals cup + spoon)
  holdBeat: [20, 30] as const, // STILLNESS: «شطة» just sits there; the camera has settled. (true silence)

  // ACT 2 — the شطة world
  bloom: 30, // red ink bursts out of the word and floods the frame (30 → 42)
  bloomFull: 42,
  ignite: [34, 38, 42] as const, // flames catch on ش, ط, ة (reading order, right → left)
  cupFill: [44, 58] as const, // the cup fills with red-hot chili from the bottom up (the level tops the dome at 58)
  cupFlames: [58, 62] as const, // flames catch on the chili dome (left, right; the centre one at 66)
  cupFlame3: 66,
  camSpoon: [58, 74] as const, // the camera pushes in on the spoon (reaction close-up) and holds to 94
  spoonGasp: 62, // the hopeful spoon recoils (jolts up, stretch) — it has seen what is in the cup
  sweat: 64, // sweat drops start flicking off the spoon (drip sounds on SWEAT_DRIPS)
  sweatDrips: [68, 76, 84, 92] as const,
  bubble: 68, // «شطة؟؟ 🥵» burst bubble from the spoon (smear frame; its overshoot = +2)
  bubbleOut: 94,
  melt: [72, 96] as const, // the spoon droops and melts (melt 0 → 0.75), drips grow
  camBack: [94, 104] as const, // the camera whips back out to the medium shot

  // ACT 3 — the ق comes back
  whistle: 98, // a small spinning ق enters top-left: the boomerang whistle starts…
  qafSlam: 112, // …and it SLAMS back into its place (dotless). Screen shake 112–118. The ش re-joins it.
  flamesOut: 113, // the word's flames are blown out → smoke puffs
  dotLand: [120, 126] as const, // its two dots fall back as two DROPS OF QASHTA and splat onto the ق (6 f apart)
  wave: 128, // a turquoise wave with a cream crest bursts out of the ق and washes the red away (128 → 150)
  waveEnd: 150,
  waveOverCup: 136, // the crest crosses the cup → chili becomes qashta, the cup's flames go out
  cupFlamesOut: 136,
  spoonBoing: 142, // the spoon springs back into shape (boing, jiggle) …
  spoonGlint: 148, // … and gleams
  honey: [144, 168] as const, // honey pours over the dome again
  wordHop: 152, // «قشطة» is back: the ق's two drops hop for joy

  // ACT 4 — the line
  wordOut: 158, // the big word lifts off the paper (un-press, 3 drawings) to make room for the line
  title1: 166, // «الفرق» → impact +2 (168); «كلّو» 170 → 172; «بحرف.» 174 → 176 (ink thud on each impact)
  titleStagger: 4,
  strike: [190, 196] as const, // a hand-drawn red ink scribble strikes through «بحرف.» (scratch 190–196)
  swapOut: 196, // «بحرف.» un-presses …
  title3: 200, // … «بالـ» presses (impact 202), then «ق.» (impact 208 — the BIG one, the brand letter)
  title3Qaf: 206,
  qafHops: [220, 236] as const, // the title's ق hops (crouch at −11, airborne 8 f, lands ON the hop frame) — «والـ ق بتنطّ»
  spoonDive: [180, 202] as const, // spoon dives into the cup (anticipation lift, then in — "schlup" at 200)
  spoonLift: [206, 250] as const, // heaped spoon rises, the qashta strand stretches (212…) and snaps (238)
  strandSnap: 238,
  cupGlint: 252, // a glint crosses the dome — then the end card

  endCard: ENDCARD_AT,
  end: DURATION,
} as const;

// ------------------------------------------------------------------------------------------------ copy
export const COPY = {
  word: 'قشطة', // the big word (its ق's dots are the logo's two cream drops)
  wordWithout: 'شطة',
  bubble: 'شطة؟؟ 🥵',
  title1: 'الفرق كلّو',
  title2: 'بحرف.',
  title3: 'بالـ ق.',
  // end card: CTA copy is the kit's (Talabat first); this spot's comment prompt:
  comment: 'إنت فريق قشطة ولا فريق شطة؟ 👇',
} as const;

// ------------------------------------------------------------------------------------------------ layout (world px)
// The world is drawn at camera zoom 1 = the 1080×1920 frame. CAM keys (on ones) frame it.
export const L = {
  word: {cx: 520, baseline: 560, k: 0.34}, // «قشطة» 2060 u wide → ≈ 700 px; the ق is the rightmost ≈ 122 px
  cup: {x: 432, base: 1650, scale: 0.84},
  // the line, screen px (safe zone), two lines, left of centre (the lifted spoon rises on the right)
  title: {cx: 420, y1: 392, y2: 600, k1: 0.22, k2: 0.25},
} as const;

// camera keys: frame → {zoom, cx, cy (world point at the frame centre), rot (deg)} — interpolated smoothly (on ones)
export const CAM = [
  {f: 0, zoom: 1.24, cx: 548, cy: 760, rot: -1.6}, // hook: tight on the word + the cocked hand
  {f: 9, zoom: 1.27, cx: 552, cy: 752, rot: -1.8}, // creep in with the wind-up (tension)
  {f: 12, zoom: 1.27, cx: 552, cy: 752, rot: -1.8},
  {f: 24, zoom: 1.02, cx: 540, cy: 975, rot: 0.6}, // medium: word + cup + spoon — settled for the hold beat
  {f: 58, zoom: 1.04, cx: 545, cy: 975, rot: 0.3},
  {f: 74, zoom: 1.5, cx: 600, cy: 800, rot: -1.2}, // reaction close-up: the spoon (word still burning above)
  {f: 94, zoom: 1.56, cx: 598, cy: 792, rot: -1.6},
  {f: 104, zoom: 1.0, cx: 545, cy: 930, rot: 0.4}, // whip back out for the boomerang
  {f: 112, zoom: 1.07, cx: 565, cy: 880, rot: -0.5}, // lean in on the slam
  {f: 130, zoom: 1.03, cx: 545, cy: 930, rot: 0.3},
  {f: 160, zoom: 1.02, cx: 515, cy: 975, rot: 0},
  {f: 180, zoom: 1.02, cx: 500, cy: 985, rot: -0.4}, // the line + the cup (cup right of centre, spoon rising right)
  {f: 270, zoom: 1.05, cx: 500, cy: 990, rot: -0.6},
  {f: 375, zoom: 1.06, cx: 500, cy: 990, rot: -0.6}] as const;

// ------------------------------------------------------------------------------------------------ SOUND CUE LIST
// Every visual hit, in GLOBAL frames (÷30 = seconds). Names are what the sound designer should look for.
// 'silence' ranges must be TRUE digital silence (Mixer.silence). End-card cues: sfx.endcard_sfx(mx, fr(T.endCard)).
export const CUES = {
  FLICK_TENSION: [0, 9], // finger strains (tiny creak / held-breath tick on 4, 6, 8)
  FLICK_SNAP: T.flick, // «طقّ» — the finger snap + the hit on the ق (sharp, dry)
  QAF_WHOOSH: [T.flick + 1, T.qafGone], // the ق spins away up-right (spinning whoosh, doppler away)
  SHIN_HEAL_TICK: T.heal, // the ش re-shapes (tiny ink tick, very quiet)
  HAND_OUT_SWISH: T.handOut[0],
  SILENCE_BEAT: [T.holdBeat[0] + 1, T.holdBeat[1]], // TRUE SILENCE: «شطة» just sits there (comic air)
  BLOOM_WHOOMP: T.bloom, // red floods the frame (low whoomp + ink splash)
  IGNITE: T.ignite, // three flame whooshes on the letters (ش, ط, ة)
  FIRE_LOOP: [T.ignite[0], T.flamesOut], // crackle bed under the شطة world
  CUP_FILL_GLUG: T.cupFill, // chili pours up the cup (thick glug, bubbling)
  CUP_FLAMES: [...T.cupFlames, T.cupFlame3], // three smaller flame whooshes on the dome
  SPOON_GASP: T.spoonGasp, // the spoon jolts (cartoon gasp / spring "boink" up)
  CAM_PUSH_SPOON: T.camSpoon[0], // soft air move into the close-up
  SWEAT_DRIPS: T.sweatDrips, // sweat drops (sweat_drip)
  BUBBLE_POP: T.bubble + 2, // «شطة؟؟ 🥵» bubble (pop on its overshoot)
  MELT_DROOP: T.melt, // the spoon droops (descending rubbery stretch)
  BUBBLE_OUT: T.bubbleOut,
  CAM_WHIP_BACK: T.camBack[0], // quick whoosh out of the close-up
  BOOMERANG_WHISTLE: [T.whistle, T.qafSlam], // rising spinning whistle, closes in
  QAF_SLAM: T.qafSlam, // BIG ink thud + shake (the letter is back)
  FLAMES_OUT_PUFF: T.flamesOut, // the word's flames blown out (puff ×3, smoke)
  DOT_LAND: T.dotLand, // the two drops land on the ق: a pair of wet plinks/splats 6 f apart — the «تشك-تشك» rhythm
  // (suggestion: the sonic-logo clack pair could double here, quieter than on the end card)
  WAVE_SWOOSH: [T.wave, T.waveEnd], // creamy turquoise wave bursts out and sweeps the frame (big wet swoosh + sparkle tail)
  WAVE_OVER_CUP: T.waveOverCup, // chili → qashta on the cup (wet wipe)
  CUP_FLAMES_OUT: T.cupFlamesOut, // small puffs
  SPOON_BOING: T.spoonBoing, // the spoon springs back (boing)
  SPOON_GLINT: T.spoonGlint, // glint
  HONEY_POUR: T.honey, // soft honey pour (viscous)
  WORD_HOP: T.wordHop, // the ق's drops hop (two tiny blips)
  WORD_LIFT: T.wordOut, // the big word lifts off the paper (soft paper peel)
  TITLE_THUDS: [T.title1 + 2, T.title1 + T.titleStagger + 2, T.title1 + 2 * T.titleStagger + 2], // «الفرق» «كلّو» «بحرف.»
  STRIKE_SCRATCH: T.strike, // ink scribble through «بحرف.»
  SWAP_OUT: T.swapOut, // «بحرف.» un-presses (paper flick)
  TITLE3_THUD: T.title3 + 2, // «بالـ»
  QAF_THUD: T.title3Qaf + 2, // «ق.» — the brand letter lands (bigger thud + sparkle)
  SPOON_DIVE: T.spoonDive[1] - 2, // "schlup" into the qashta
  STRAND_STRETCH: [T.spoonLift[0] + 6, T.strandSnap], // gooey stretch …
  STRAND_SNAP: T.strandSnap, // … and snap
  QAF_HOPS: T.qafHops, // the title's ق lands its hops (boing take-off at hop − 8, land at hop; its drops land +2/+4)
  CUP_GLINT: T.cupGlint, // a glint on the dome (sparkle) — then the end-card sheet
  END_CARD: T.endCard, // sfx.endcard_sfx(mx, fr(T.endCard)): sheet 270 · cup lands 284 · LOGO DOTS = SONIC LOGO 290 / 296 ·
  //                     CTA 316 · sub 324 · location 328 · comment 336 (pop 338) · glints 346 / 354 · dot hops 362 / 368
} as const;
