// «ملعقة وحدة بس» — Qashati 2D spot #2 (script 2 in brands/qashati-alsham/CONCEPTS-2D.md).
// SINGLE SOURCE OF TRUTH for timing, copy, layout and the sound cue list. Pure data (no React/Remotion imports):
// the sound script reads it through esbuild (kit/audio/sfx.py → ts_eval):
//   T    = sfx.ts_eval("import {T} from './src/qashati2d/spoon/spec'; console.log(JSON.stringify(T));")
//   CUES = sfx.ts_eval("import {CUES} from './src/qashati2d/spoon/spec'; console.log(JSON.stringify(CUES));")
//
// 30 fps · 1080×1920 · 461 frames (15.37 s). Characters/props move ON TWOS, the camera moves on ones.
//
// THE STORY (sound-off): top-down on a family qashati plate on a brass tray. Frame 0 already says it: a white-kandura
// hand hovers its spoon over the full plate, «بس ملعقة وحدة ☝️», a taped counter «ملعقة 0».
// Six more hands follow, faster and faster, each swearing it's «just one spoon» in its own dialect — and each "one
// spoon" leaves with a bigger, more absurd HEAP (the visual gag under the words). The counter climbs to 7 (red).
// The one who ordered the plate (arm from the bottom = the viewer's seat) arrives happy with a clean spoon… the plate
// is empty but for ONE cream drop shaped like the logo's dot. The music dies. TRUE SILENCE, then crickets; a halftone
// spotlight closes in on the lonely drop. His spoon creeps towards it… and the dino-sleeve kid snatches it (counter 8).
// «وأنا؟ 🥲». A paper note slaps on the table: «بالبيت؟ ما في شي اسمو ملعقة وحدة.» → end card
// «اطلبوا لكل واحد كاسة 😌» + «منشن يلي ببيتكن بيقول ملعقة وحدة 👇».

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 461; // 15.37 s

// ------------------------------------------------------------------------------------------------ world + camera
// World units = screen px at the rest camera (cam at (540, 960), zoom 1). The table/plate lives at height 0, hands
// float above it (h ≈ 0…260 units) → they are magnified and move more under camera pans (dolly parallax):
//   k(h) = CAM_HC / (CAM_HC / zoom − h)   (CAM_HC large = a long lens: gentle magnification, still parallax)
export const CAM_HC = 1800;
/** the plate is turned so its 7 rim bites alternate left / bottom / right (kit PLATE_SCOOPS order) */
export const PLATE = {x: 540, y: 830, scale: 0.8, rotate: -20};
export const HAND_SCALE = 1.05;

// ------------------------------------------------------------------------------------------------ the family
export type HandId = 'kandura' | 'abaya' | 'kid' | 'grandpa' | 'uncle' | 'aunt' | 'teen';
export type Garnish = 'strawberry' | 'mango' | 'kiwi' | 'drop' | 'none';
export type HandBeat = {
  id: HandId;
  /** bite index on the plate (kit PLATE_SCOOPS order) — hand n brings scoopsTaken to (n+1)·8/7 */
  bite: number;
  /** where the arm comes from (deg, 0 = right, 90 = down). The family reaches in from the bottom left / bottom
   *  right (their sleeves — kandura, abaya, dino, misbaha, watch, bracelets, hoodie — stay in frame and tell who is
   *  who); the top band (counter + bubbles) stays clean. Only the snatch at the end breaks the rule: from the TOP. */
  arm: number;
  /** frames: enter (off-screen) · dig (spoon IMPACT on the plate) · gone (fully off-screen) */
  enter: number;
  dig: number;
  gone: number;
  /** size of the heap this "one spoon" carries away (1 = a heaped spoon … 2 = absurd) — the gag escalates */
  heap: number;
  garnish: Garnish;
  bubble: {
    text: string;
    start: number;
    exit: number;
    /** bubble centre (screen px). Two columns under the counter: LEFT (x≈300, speakers reaching from the bottom
     *  left) and RIGHT (x≈770, from the bottom right). Consecutive speakers alternate columns, so two bubbles alive
     *  at once never touch, and their short tails (pointing down at the speaker) never cross the other column */
    x: number;
    y: number;
    shape?: 'round' | 'cloud' | 'burst';
    font?: 'friendly' | 'latin' | 'title';
    fontSize?: number;
    rotate?: number;
    fill?: string;
  };
};

// Dig intervals 32 · 28 · 26 · 24 · 22 · 24 frames — the family speeds up (paper stop-motion, on twos); the teen is
// the only one who slows the rhythm down: he's typing.
// Dialect copy: Emirati (kandura «ملعقة», abaya «خاشوقة» — the Gulf word), a Dubai kid in English, Levantine grandpa «دوقة» (a taste), Egyptian uncle
// «معلقة واحدة بس», Shami aunt «بس معلقة وحدة يا تقبرني», Levantine teen in Arabizi «bas wa7de».
export const HANDS: HandBeat[] = [
  {
    id: 'kandura', bite: 0, arm: 122, enter: -30, dig: 14, gone: 40, heap: 1.0, garnish: 'strawberry',
    bubble: {text: 'بس ملعقة\nوحدة ☝️', start: -12, exit: 32, x: 300, y: 520, fontSize: 72, rotate: -2.5},
  },
  {
    id: 'abaya', bite: 1, arm: 98, enter: 22, dig: 46, gone: 68, heap: 1.25, garnish: 'mango',
    // «خاشوقة» = the Gulf word for a spoon: the Emirati mum gets her OWN word (dialect mix, and comment bait)
    bubble: {text: 'خاشوقة وحدة\nبس والله', start: 34, exit: 86, x: 300, y: 540, fontSize: 62, rotate: 2},
  },
  {
    id: 'kid', bite: 2, arm: 62, enter: 52, dig: 74, gone: 92, heap: 1.45, garnish: 'kiwi',
    bubble: {text: 'One\nspoon!', start: 60, exit: 110, x: 772, y: 530, shape: 'burst', font: 'latin', fontSize: 64, rotate: -4, fill: '#FFD877'},
  },
  {
    id: 'grandpa', bite: 3, arm: 116, enter: 76, dig: 100, gone: 118, heap: 1.4, garnish: 'strawberry',
    bubble: {text: 'بس دوقة', start: 88, exit: 132, x: 296, y: 548, fontSize: 74, rotate: -3},
  },
  {
    id: 'uncle', bite: 4, arm: 56, enter: 100, dig: 124, gone: 142, heap: 1.75, garnish: 'mango',
    bubble: {text: 'معلقة\nواحدة بس', start: 110, exit: 154, x: 770, y: 532, fontSize: 64, rotate: 2.5},
  },
  {
    id: 'aunt', bite: 5, arm: 112, enter: 122, dig: 146, gone: 164, heap: 2.0, garnish: 'kiwi',
    bubble: {text: 'بس معلقة وحدة\nيا تقبرني 🤏', start: 134, exit: 190, x: 304, y: 556, fontSize: 56, rotate: -2},
  },
  {
    id: 'teen', bite: 6, arm: 60, enter: 142, dig: 170, gone: 190, heap: 2.3, garnish: 'strawberry',
    bubble: {text: 'bas wa7de', start: 156, exit: 202, x: 762, y: 520, font: 'latin', fontSize: 60, rotate: 3},
  },
];

// ------------------------------------------------------------------------------------------------ timeline
export const T = {
  // 0.0 s — HOOK: frame 0 already shows the full plate, the kandura hand poised over it, its bubble, the counter at 0
  hook: 0,
  hands: HANDS.map((h) => ({id: h.id, enter: h.enter, dig: h.dig, gone: h.gone, bubble: h.bubble.start, bubbleExit: h.bubble.exit})),
  /** the counter flips this many frames after each dig impact */
  flipDelay: 4,
  // the owner (arm from the bottom: the viewer's seat) — happy, eager, a clean spoon
  ownerEnter: 184,
  ownerThought: 192, // cloud «😋» (left column, once the aunt's bubble has gone)
  ownerStop: 206, // screeches to a halt over the EMPTY plate → the music dies here
  silenceEnd: 218, // TRUE SILENCE ownerStop → silenceEnd (digital zero), then crickets
  spotIn: 214, // a halftone spotlight closes in on the lonely drop (on twos) …
  spotSet: 240, // … and holds
  dropGlint: 226, // a tiny glint on the drop (the eye goes there)
  dropWobbles: [230, 244], // the drop shivers alone (jelly), twice
  ownerDots: 222, // cloud «…»
  ownerDotsOut: 248,
  ownerCreep: 236, // the clean spoon creeps towards the lonely drop … (tension)
  // TOPPER: the dino-sleeve kid zips in from the TOP LEFT (the only arm from the top) and snatches the last drop
  snatchEnter: 248,
  snatchGrab: 254, // spoon hits the drop (IMPACT) — the drop leaves the plate, the spotlight blows open
  snatchGone: 264,
  snatchFlip: 256, // counter → 8 (red, shakes)
  ownerSlump: 264, // the owner's spoon sinks onto the table
  ownerLine: 268, // bubble «وأنا؟ 🥲»
  ownerLineOut: 336,
  counterOut: 280, // the counter shrinks away (room for the moral)
  note: 286, // a paper note slaps onto the table (paper thup) …
  title: 290, // … «بالبيت؟ / ما في شي اسمو / ملعقة وحدة.» word i impacts at title + i*titleStagger + 2
  titleStagger: 4,
  endCard: 356, // 11.87 s — the kit end card (art/EndCardSpoon = EndCard2D, headline without ink specks), 105 frames
  end: DURATION,
};

/** camera keys (frame, world centre x/y, zoom, rotation deg) — eased in-out between keys; a repeated key = a hold */
export const CAM_KEYS = [
  {f: 0, x: 524, y: 746, z: 1.06, rot: -3.2},
  {f: 40, x: 528, y: 742, z: 1.03, rot: -2.2},
  {f: 190, x: 536, y: 724, z: 0.95, rot: 2.4}, // slow pull-back + turn while the family piles in
  {f: 200, x: 546, y: 748, z: 0.99, rot: 2.2}, // the owner's arrival (a small catch-up)
  {f: T.ownerStop + 6, x: 546, y: 748, z: 0.99, rot: 2.2}, // DEAD STOP — the camera stops too
  {f: 250, x: 516, y: 836, z: 1.36, rot: 1.0}, // creeping push-in on the lonely drop (crickets); drop right of centre
  {f: 260, x: 514, y: 834, z: 1.37, rot: 0.9},
  {f: 300, x: 544, y: 742, z: 0.94, rot: -1.6}, // pull back up: the empty plate, the sad spoon, the note on top
  {f: 356, x: 543, y: 740, z: 0.97, rot: -2.2},
  {f: DURATION, x: 543, y: 740, z: 0.99, rot: -2.4},
];

// ------------------------------------------------------------------------------------------------ copy
export const COPY = {
  counterLabel: 'ملعقة',
  ownerThought: '😋',
  ownerDots: '…',
  ownerLine: 'وأنا؟ 🥲',
  title: 'بالبيت؟\nما في شي اسمو\nملعقة وحدة.',
  endHeadline: 'اطلبوا لكل واحد كاسة 😌',
  endComment: 'منشن يلي ببيتكن بيقول ملعقة وحدة 👇',
};

/** screen layout of the overlays (px) — all key text inside x 60–960, y 220–1400 */
export const LAYOUT = {
  counter: {x: 528, y: 300, rot: -3},
  ownerThought: {x: 300, y: 600},
  ownerDots: {x: 806, y: 820},
  ownerLine: {x: 690, y: 1150, fontSize: 96}, // big enough that 🥲's tear still reads at 360 px
  note: {x: 526, y: 472, w: 860, h: 470, rot: -2.2},
  title: {x: 524, y: 474, fontSize: 112},
};

// ------------------------------------------------------------------------------------------------ CUE LIST
// Every audible event in frames (global, 30 fps). The sound designer: mirror these in
// src/qashati2d/spoon/audio/make_sound.py through ts_eval (never hard-code seconds).
const flip = (h: HandBeat) => h.dig + T.flipDelay;
export const CUES = {
  /** music: a playful home groove (darbuka + oud/qanun plucks) that tightens as the hands speed up; it STOPS DEAD
   *  at MUSIC_STOP (no tail, no reverb) */
  MUSIC_START: 0,
  MUSIC_STOP: T.ownerStop,
  /** per hand (same order as HANDS): arm swish in, bubble pop (+2 = its overshoot drawing), spoon IMPACT on the
   *  plate (ceramic clink), wet scoop/slurp (+2), counter flip (paper flip + tick), arm swish out (+8 after the dig).
   *  The heaps grow: give SCOOP_SLURP more weight per hand (HANDS[i].heap). BUBBLE_POP[0] = frame 0: the kandura's
   *  bubble is already on screen on the first frame (the hook) — a soft pop/voice right on frame 0 is the audio hook. */
  HAND_ENTER: HANDS.map((h) => Math.max(0, h.enter)),
  BUBBLE_POP: HANDS.map((h) => Math.max(0, h.bubble.start + 2)),
  SPOON_DIG: HANDS.map((h) => h.dig),
  SCOOP_SLURP: HANDS.map((h) => h.dig + 2),
  COUNTER_FLIP: HANDS.map(flip),
  HAND_EXIT: HANDS.map((h) => h.dig + 8),
  /** character foley (sleeve props): grandpa's misbaha beads rattle while his hand shakes over the plate; the aunt's
   *  bracelets jingle on her dig; the abaya's ring ticks the spoon handle on her dig */
  MISBAHA_RATTLE: [HANDS[3].enter + 10, HANDS[3].dig - 2] as const,
  BRACELET_JINGLE: HANDS[5].dig,
  RING_TICK: HANDS[1].dig - 2,
  /** the teen's phone: two soft key taps while he hovers (he's typing) */
  TEEN_TAPS: [HANDS[6].dig - 12, HANDS[6].dig - 8],
  /** voices (optional, recorded on a phone by real people in their dialects — lines = HANDS[i].bubble.text) */
  VOICE_LINE: HANDS.map((h) => Math.max(0, h.bubble.start)),
  /** the owner */
  OWNER_ENTER: T.ownerEnter, // eager swish + a happy hum «mmm»
  OWNER_THOUGHT_POP: T.ownerThought + 2,
  OWNER_STOP: T.ownerStop, // a short spoon "skid", then MUSIC_STOP on the same frame
  TRUE_SILENCE: [T.ownerStop + 2, T.silenceEnd] as const, // digital zero (mx.silence)
  CRICKETS: [T.silenceEnd, T.snatchEnter] as const, // dry, lonely, mono
  SPOTLIGHT_IN: T.spotIn, // a very soft theatre-light "clunk" (optional, low)
  DROP_GLINT: T.dropGlint, // a tiny glint «ting»
  DROP_WOBBLE: T.dropWobbles, // two tiny jelly wobbles of the last drop (soft blips)
  OWNER_DOTS_POP: T.ownerDots + 2,
  OWNER_CREEP: T.ownerCreep, // a thin rising tension string under the crickets, cut at SNATCH_WHOOSH
  /** the snatch */
  SNATCH_WHOOSH: T.snatchEnter,
  SNATCH_GRAB: T.snatchGrab, // spoon clink + slurp; crickets stop here
  SPOTLIGHT_OUT: T.snatchGrab, // (same frame) the spotlight blows open
  SNATCH_FLIP: T.snatchFlip, // counter flip 8 (heavier, a "ding" of doom)
  SNATCH_EXIT: T.snatchGrab + 2,
  OWNER_SLUMP: T.ownerSlump, // sad oud bend (short) + the spoon's soft clink on the table at OWNER_SLUMP + 12
  OWNER_LINE_POP: T.ownerLine + 2,
  COUNTER_OUT: T.counterOut,
  NOTE_SLAP: T.note + 2, // paper thup (the note lands on the table on its 2nd drawing)
  /** the moral, InkTitle word impacts (ink thud on each; 7 words) */
  TITLE_WORDS: [0, 1, 2, 3, 4, 5, 6].map((i) => T.title + i * T.titleStagger + 2),
  /** end card: call sfx.endcard_sfx(mx, sfx.fr(T.endCard)) — it plays the sheet swish, cup plop, the SONIC LOGO on
   *  the logo's two dots (T.endCard + 20 and + 26), the CTA stamp, the comment pop and the dot hops (kit/endcard/cues.ts).
   *  The headline «اطلبوا لكل واحد كاسة 😌» words impact at T.endCard + EC.headline + 2 + i*4 (i = 0..3, + emoji). */
  END_CARD: T.endCard,
  END: DURATION,
};
