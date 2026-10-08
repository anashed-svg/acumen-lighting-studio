// «الفرق بالـ ق» — Qashati Alsham, 2D series spot 1 (script 1 in brands/qashati-alsham/CONCEPTS-2D.md).
// Single source of truth for the frame timeline, the layout, the copy and the SOUND CUE LIST. Pure data (no React):
// the sound script reads it through esbuild (kit/audio/sfx.py ts_eval), so move a cue here and the sound follows.
//
// The idea: «قشطة» without its «ق» is «شطة» (chili). Cast: the big word (its ق wears the logo's two cream drops as
// its dots), the narrator's hand, the hero cup, and a hopeful steel SPOON with a face who just wants dessert.
//   ACT 1  frame 0 is the thumbnail: the finger is cocked under the ق, the drops shiver, the spoon looks up, worried.
//          FLICK — the ق spins off up-left; «شطة» is left. The spoon looks at it… then at US. (true silence)
//   ACT 2  red ink blooms out of the word, the letters catch fire, the cup fills red-hot, flames on the dome; push in
//          on the spoon: gulp → 🥵 «شطة؟؟» → it melts.
//   ACT 3  the ق boomerangs back and SLAMS into place, its two drops are flung up and land «تشك-تشك»; a turquoise
//          wave with a cream crest washes the red away; the cup is qashta again, the spoon boings back to shape.
//   ACT 4  «الفرق كلّو بحرف.» → scribbled out → «الفرق كلّو بالـ ق.» (the ق hops); the spoon dives into the cup and
//          somersaults back with a heaped spoonful (strand stretches, snaps) → end card «إنت فريق قشطة ولا فريق شطة؟ 👇».
//
// 30 fps, 1080×1920, 375 frames (12.5 s). Drawings step ON TWOS (all drawing cues are on even frames); the camera
// moves on ones.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 375; // 12.5 s
export const ENDCARD_AT = 270; // 9.0 s — EndCard2D (105 f) runs 270 → 375

// ------------------------------------------------------------------------------------------------ frame timeline
export const T = {
  // ACT 1 — the flick
  windup: 4, // the hand pulls back into the STRAIN drawing (4 → 10): tighter curl, tension ticks, trembling harder
  flick: 10, // RELEASE: smear drawing (10), follow-through (12–14); the nail hits the ق: impact star
  qafGone: 20, // the spinning ق (with its drops) has left the frame, top left
  heal: 20, // the orphaned ش re-shapes medial → initial: «ـشطة» becomes a clean «شطة» (a tiny ink tick)
  handOut: [16, 28] as const, // the hand goes loose and withdraws down-right, out of frame
  spoonFlinch: 10, // the spoon flinches on the snap (squash), eyes follow the flying ق
  spoonLookWord: 20, // … looks at what is left: «شطة»
  holdBeat: [26, 40] as const, // STILLNESS — the spoon turns its eyes to camera (deadpan); blink at 34. TRUE SILENCE
  spoonDeadpan: 26,
  spoonBlink: 34,

  // ACT 2 — the شطة world
  bloom: 40, // red ink bursts out of the word and floods the frame (40 → 52)
  bloomFull: 52,
  spoonTake: 42, // the spoon's TAKE: squash at 40, stretched with huge eyes at 42 («!»)
  ignite: [44, 48, 52] as const, // flames catch on ش, ط, ة (reading order, right → left)
  cupFill: [54, 68] as const, // the cup fills with red-hot chili from the bottom up
  spoonGulp: 62, // the spoon gulps (looks at the cup)
  cupFlames: [68, 72, 76] as const, // flames catch on the chili dome (left, centre, right)
  camSpoon: [62, 80] as const, // the camera pushes in on the spoon + the burning dome (holds, creeping, to 98)
  spoonHot: 70, // 🥵 face: screwed-shut eyes, tongue out, flushed; sweat starts
  sweatDrips: [72, 80, 88, 96] as const,
  bubble: 74, // «شطة؟؟ 🥵» burst bubble from the spoon (its overshoot = +2)
  bubbleOut: 100,
  melt: [80, 100] as const, // the spoon droops and melts (0 → 0.6), drips grow
  camBack: [98, 108] as const, // the camera whips back out (the whole frame, for the boomerang)

  // ACT 3 — the ق comes back
  whistle: 104, // the spinning ق re-enters (left), loops over the top: boomerang whistle 104 → 118
  spoonLookUp: 106, // the melted spoon's eyes follow it
  qafSlam: 118, // it SLAMS back into its place. Screen shake 118–132. The ش re-joins it (medial again).
  flamesOut: 120, // the word's flames are blown out → smoke puffs (120, 122, 124)
  dropsFlung: 118, // the slam bounces its two cream drops up off the ق (a short hop, the dotless ق below)…
  dotLand: [124, 130] as const, // …and they land back as its dots: two wet splats 6 f apart = «تشك-تشك»
  wave: 134, // a turquoise wave with a cream crest bursts out of the ق and washes the red away (134 → 156)
  waveEnd: 156,
  waveOverCup: 142, // the crest crosses the cup → chili becomes qashta, the cup's flames go out
  cupFlamesOut: 142,
  spoonBoing: 146, // the crest reaches the spoon: it springs back into shape (boing, jiggle), sparkly-eyed grin
  spoonGlint: 152,
  honey: [148, 170] as const, // honey pours over the dome again
  wordHop: 158, // «قشطة» is back: the ق's two drops hop for joy (158, 162)

  // ACT 4 — the line + the payoff
  wordOut: 164, // the big word lifts off the paper (3 drawings) to make room for the line
  title1: 170, // «الفرق» → impact +2 (172); «كلّو» 174 → 176; «بحرف.» 178 → 180 (ink thud on each impact)
  titleStagger: 4,
  strike: [188, 194] as const, // a red ink scribble strikes through «بحرف.» (scratch 188–194), then it HOLDS struck out
  swapOut: 202, // «بحرف.» (still crossed out) un-presses …
  title3: 204, // … «بالـ» presses (impact 206), then «ق.» (impact 212 — the BIG one, the brand letter)
  title3Qaf: 210,
  spoonCrouch: 214, // the spoon crouches (anticipation) …
  spoonJump: 218, // … springs (218 → 226, a head-first lunge that tips it forward on twos) …
  spoonDive: 228, // … and dives head-first into the side of the dome: «schlup» (collar splash)
  spoonNom: [230, 240] as const, // only its handle sticks out, wiggling (nom-nom: 230, 234, 238)
  spoonPull: [240, 254] as const, // it pulls out with a heaped spoonful, the qashta strand stretches …
  strandSnap: 254, // … and snaps
  spoonFlip: [256, 258] as const, // it springs back upright to its spot …
  spoonLand: 258, // … lands (squash) with the heap on its head, blissful
  qafHops: [224, 260] as const, // the title's ق hops (crouch −11, airborne 8 f, lands ON the hop frame), drops +2/+4
  cupGlint: 262, // a glint crosses the dome — then the end-card sheet

  // END CARD — the spoon comes along (drawn over the kit's EndCard2D, in screen px; it fills the beat where the sheet is
  // in but nothing has landed yet, and keeps the hero on the last image)
  ecSpoonHop: 274, // it hops in from the right (on twos) …
  ecSpoonLand: 282, // … lands upright beside the empty spot (squash) — the kit's cup then plops down next to it (284)
  ecSpoonLean: 288, // jolted by the cup, it leans on it, blissful, the spoonful still on its head (288 → 290)
  ecSpoonLook: 338, // when the comment bubble pops it turns to us: «فريق قشطة ولا فريق شطة؟»

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
// The world is drawn at camera zoom 1 = the 1080×1920 frame; CAM keys (on ones) frame it. The title is screen space.
export const L = {
  word: {cx: 500, baseline: 610, k: 0.4}, // «قشطة» 2060 u → ≈ 824 px (x 88–912); its ق is the rightmost ≈ 125 px
  cup: {x: 670, base: 1712, scale: 0.84}, // dome top ≈ y 1010, rim ≈ x 475–865
  spoon: {x: 150, base: 1712, scale: 1.35, lean: 3}, // the spoon character's foot; its head ≈ (187, 1010)
  hand: {nail: [902, 614] as [number, number], rot: 55, scale: 1.0}, // the loaded nail, just under the ق's loop
  // the line (screen px, inside SAFE): two lines, the second bigger; set right of centre so the spoon (far left,
  // with its heaped spoonful) never touches it (y1 398: the shadda/alef tops sit at ≈ y 224, under the top UI band)
  title: {cx: 580, y1: 398, y2: 668, k1: 0.24, k2: 0.33},
  // the spoon on the end card (screen px): foot just right of the kit cup's base (cup x 300, base 1066, scale 0.88),
  // leaning on its right flank so its face sits between the cup and the logo (logo x ≥ 584), clear of the CTA (y ≥ 1095)
  ecSpoon: {x: 568, base: 1066, scale: 0.85, lean: -16},
} as const;

// camera keys: frame → {zoom, cx, cy (world point at the frame centre), rot (deg)} — interpolated smoothly (on ones)
export const CAM = [
  {f: 0, zoom: 1.04, cx: 548, cy: 915, rot: -1.2}, // hook: word + cocked hand + worried spoon + the cup's dome
  {f: 9, zoom: 1.06, cx: 552, cy: 900, rot: -1.5}, // creep in with the wind-up (tension)
  {f: 12, zoom: 1.06, cx: 552, cy: 900, rot: -1.5},
  {f: 26, zoom: 1.0, cx: 540, cy: 1000, rot: 0.4}, // wide: the whole stage, settled for the hold beat …
  {f: 40, zoom: 1.07, cx: 490, cy: 1010, rot: 0.2}, // … a slow creep in on the spoon's deadpan look (the comic hold)
  {f: 62, zoom: 1.03, cx: 535, cy: 1010, rot: 0.2},
  {f: 80, zoom: 1.45, cx: 430, cy: 1288, rot: -1.0}, // reaction shot: the spoon's face (left) + the burning cup (right)
  {f: 98, zoom: 1.5, cx: 428, cy: 1276, rot: -1.5},
  {f: 108, zoom: 1.0, cx: 540, cy: 965, rot: 0.3}, // whip back out for the boomerang (the top of the frame)
  {f: 118, zoom: 1.06, cx: 600, cy: 880, rot: -0.6}, // lean in on the slam
  {f: 134, zoom: 1.03, cx: 560, cy: 930, rot: 0.3},
  {f: 160, zoom: 1.0, cx: 540, cy: 1030, rot: 0}, // the stage drops a little: room for the line at the top
  {f: 212, zoom: 1.0, cx: 540, cy: 1040, rot: -0.2},
  {f: 240, zoom: 1.08, cx: 515, cy: 1082, rot: -0.6}, // push towards the cup for the spoonful (appetite) — framed so
  {f: 270, zoom: 1.1, cx: 508, cy: 1090, rot: -0.8}, //   the blissful spoon + its heap stay inside the frame (left)
  {f: 375, zoom: 1.11, cx: 508, cy: 1092, rot: -0.8},
] as const;

// ------------------------------------------------------------------------------------------------ SOUND CUE LIST
// Every visual hit, in GLOBAL frames (÷30 = seconds). [a, b] = a sound that spans a → b. Names are what the sound
// designer should look for. SILENCE ranges must be TRUE digital silence (Mixer.silence). End-card cues: one call,
// sfx.endcard_sfx(mx, fr(T.endCard)) (kit/endcard/cues.ts, relative to 270).
export const CUES = {
  // ACT 1
  ROOM_TONE: [0, T.flick], // a breath of paper/room tone under the hook (very low), nothing musical yet
  FINGER_STRAIN: [T.windup, T.flick], // knuckle creak + tension ticks on 4, 6, 8 (rising)
  DROPS_SHIVER: [0, T.flick], // tiny wet jitters (the ق's drops shiver on twos), barely audible
  FLICK_SNAP: T.flick, // «طقّ» — finger snap + the nail hitting the ق (sharp, dry, the loudest thing so far)
  QAF_SPIN_AWAY: [T.flick + 1, T.qafGone], // spinning whoosh flying away up-left (doppler down, pans left)
  SPOON_FLINCH: T.spoonFlinch, // tiny metal "tink" squeak as the spoon flinches
  HAND_OUT_SWISH: T.handOut[0], // sleeve swish as the hand withdraws
  SHIN_HEAL_TICK: T.heal, // the ش re-shapes: a tiny ink tick (very quiet)
  SILENCE_BEAT: [T.holdBeat[0], T.holdBeat[1] - 1], // TRUE SILENCE 26–39: the spoon looks at camera (comic air)
  SPOON_BLINK: T.spoonBlink, // optional: a single dry "blink" click INSIDE the silence (if used, ≤ −30 dBFS)
  // ACT 2
  BLOOM_WHOOMP: T.bloom, // red floods the frame: low whoomp + ink splash (the silence breaks here)
  SPOON_TAKE: T.spoonTake, // cartoon "take": spring boing-up + metallic «!» ting
  IGNITE: T.ignite, // three flame whooshes on the letters ش, ط, ة
  FIRE_LOOP: [T.ignite[0], T.flamesOut], // crackle bed under the شطة world
  CUP_FILL_GLUG: T.cupFill, // chili rises in the cup: thick glug + bubbling
  SPOON_GULP: T.spoonGulp, // cartoon gulp
  CUP_FLAMES: T.cupFlames, // three smaller flame whooshes on the dome
  CAM_PUSH_SPOON: T.camSpoon[0], // soft air move into the close-up
  SPOON_PANT: [T.spoonHot, T.melt[0]], // 🥵 panting «ha-ha-ha» (cartoon, on twos), sizzle on the spoon
  SWEAT_DRIPS: T.sweatDrips, // sweat drops hitting the table
  BUBBLE_POP: T.bubble + 2, // «شطة؟؟ 🥵» burst bubble (pop on its overshoot)
  MELT_DROOP: T.melt, // the spoon droops: descending rubbery stretch + drips
  BUBBLE_OUT: T.bubbleOut, // bubble shrinks away
  CAM_WHIP_BACK: T.camBack[0], // quick whoosh out of the close-up
  // ACT 3
  BOOMERANG_WHISTLE: [T.whistle, T.qafSlam], // rising spinning whistle, panning left → right, closing in
  QAF_SLAM: T.qafSlam, // BIG ink thud + shake (the letter is back)
  DROPS_FLUNG: T.dropsFlung + 1, // the drops pop up off it (a light upward "bloop")
  FLAMES_OUT_PUFF: [T.flamesOut, T.flamesOut + 2, T.flamesOut + 4], // the word's flames blown out (puff ×3) — fire loop ends
  DOT_LAND: T.dotLand, // the two drops land on the ق: wet splats 6 f apart — a quieter «تشك-تشك» (sonic-logo echo)
  WAVE_SWOOSH: [T.wave, T.waveEnd], // creamy turquoise wave sweeps the frame (big wet swoosh + sparkle tail)
  WAVE_OVER_CUP: T.waveOverCup, // chili → qashta on the cup (wet wipe)
  CUP_FLAMES_OUT: T.cupFlamesOut, // small puffs ×3 (142, 144, 146)
  SPOON_BOING: T.spoonBoing, // the spoon springs back into shape (boing)
  SPOON_GLINT: T.spoonGlint, // glint
  HONEY_POUR: T.honey, // soft viscous honey pour
  WORD_HOP: [T.wordHop, T.wordHop + 4], // the ق's drops hop (two tiny blips)
  // ACT 4
  WORD_LIFT: T.wordOut, // the big word lifts off the paper (soft paper peel)
  TITLE_THUDS: [T.title1 + 2, T.title1 + T.titleStagger + 2, T.title1 + 2 * T.titleStagger + 2], // «الفرق» «كلّو» «بحرف.» = 172, 176, 180
  STRIKE_SCRATCH: T.strike, // red ink scribble through «بحرف.» (pen scratch 188–194; the last slash on 194)
  SWAP_OUT: T.swapOut, // «بحرف.» un-presses (paper flick)
  TITLE3_THUD: T.title3 + 2, // «بالـ» = 206
  QAF_THUD: T.title3Qaf + 2, // «ق.» = 212 — the brand letter lands (bigger thud + sparkle)
  SPOON_CROUCH: T.spoonCrouch, // spring compress (creak)
  SPOON_JUMP: T.spoonJump, // boing take-off + lunge whoosh (218 → 226)
  SPOON_DIVE: T.spoonDive, // «schlup» into the qashta (thick, creamy)
  SPOON_NOM: [T.spoonNom[0], T.spoonNom[0] + 4, T.spoonNom[0] + 8], // nom-nom wiggles (230, 234, 238), muffled
  STRAND_STRETCH: [T.spoonPull[0], T.strandSnap], // gooey suction + stretch …
  STRAND_SNAP: T.strandSnap, // … and snap
  SPOON_FLIP: T.spoonFlip[0], // somersault whoosh
  SPOON_LAND: T.spoonLand, // light landing tink + a contented «mmm» (instrument, not voice)
  QAF_HOPS: T.qafHops, // the title's ق lands its hops (take-off at hop − 8, land at hop; its drops +2/+4)
  CUP_GLINT: T.cupGlint, // sparkle on the dome — then the end-card sheet
  EC_SPOON_HOP: [T.ecSpoonHop, T.ecSpoonLand], // the spoon hops onto the end card (light whoosh, panned right → centre)
  EC_SPOON_LAND: T.ecSpoonLand, // small steel tink (soft: the kit's cup plop follows at 284, the sonic logo at 290)
  END_CARD: T.endCard, // sfx.endcard_sfx(mx, fr(T.endCard)): sheet 270 · cup lands 284 · LOGO DOTS = SONIC LOGO 290 / 296 ·
  //                     tagline 308 · CTA 316 · sub 324 · location 328 · comment 336 (pop 338) · glints 346 / 354 ·
  //                     dot hops 362 / 368 · end 375
} as const;
