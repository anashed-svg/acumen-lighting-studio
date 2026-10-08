// «ملعقة وحدة بس» — Qashati 2D spot #2 (script 2 in brands/qashati-alsham/CONCEPTS-2D.md).
// SINGLE SOURCE OF TRUTH for timing, copy, layout and the sound cue list. Pure data (no React/Remotion imports):
// the sound script reads it through esbuild (kit/audio/sfx.py → ts_eval):
//   T    = sfx.ts_eval("import {T} from './src/qashati2d/spoon/spec'; console.log(JSON.stringify(T));")
//   CUES = sfx.ts_eval("import {CUES} from './src/qashati2d/spoon/spec'; console.log(JSON.stringify(CUES));")
//
// 30 fps · 1080×1920 · 465 frames (15.5 s). Characters/props move ON TWOS, the camera moves on ones.
//
// THE STORY (sound-off): top-down on a family qashati plate. A white-kandura hand: «بس ملعقة وحدة ☝️», counter
// «ملعقة 0 → 1». Six more hands follow, faster and faster, each swearing it's «just one spoon» in its own dialect;
// the counter climbs to 7 and the plate empties. The one who ordered it (arm from the bottom = the viewer's seat)
// arrives happy with a clean spoon… the plate is empty but for ONE cream drop shaped like the logo's dot. The music
// dies. True silence, then crickets, the camera creeps in on the drop. The owner's spoon finally creeps towards it —
// and the dino-sleeve kid snatches it (counter 8). «وأنا؟ 🥲». Moral: «بالبيت؟ ما في شي اسمو ملعقة وحدة.» →
// end card «اطلبوا لكل واحد كاسة 😌» + «منشن يلي ببيتكن بيقول ملعقة وحدة 👇».

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 465; // 15.5 s

// ------------------------------------------------------------------------------------------------ world + camera
// World units = screen px at the rest camera (cam at (540, 960), zoom 1). The table/plate lives at height 0, hands
// float above it (h ≈ 0…260 units) → they are magnified and move more under camera pans (dolly parallax):
//   k(h) = CAM_HC / (CAM_HC / zoom − h)   (CAM_HC large = a long lens: gentle magnification, still parallax)
export const CAM_HC = 1800;
export const PLATE = {x: 540, y: 830, scale: 0.8, rotate: -75};
export const HAND_SCALE = 1.05;

/** camera keys (frame, world centre x/y, zoom, rotation deg) — eased in-out between keys; a repeated key = a hold */
export const CAM_KEYS = [
  {f: 0, x: 532, y: 742, z: 1.06, rot: -3.2},
  {f: 44, x: 534, y: 740, z: 1.03, rot: -2.2},
  {f: 196, x: 540, y: 728, z: 0.95, rot: 2.4}, // slow pull-back + turn while the family piles in
  {f: 212, x: 548, y: 748, z: 0.99, rot: 2.2}, // the owner's arrival (a small catch-up)
  {f: 222, x: 548, y: 748, z: 0.99, rot: 2.2}, // DEAD STOP — the camera stops too
  {f: 258, x: 580, y: 880, z: 1.45, rot: 1.2}, // creeping push-in on the lonely drop (crickets)
  {f: 266, x: 582, y: 878, z: 1.47, rot: 1.0},
  {f: 296, x: 548, y: 700, z: 0.96, rot: -1.5}, // pull back up: the empty plate, the sad spoon, room for the moral
  {f: 360, x: 546, y: 698, z: 0.99, rot: -2.2},
  {f: DURATION, x: 546, y: 698, z: 1.0, rot: -2.4},
];

// ------------------------------------------------------------------------------------------------ the family
export type HandId = 'kandura' | 'abaya' | 'kid' | 'grandpa' | 'uncle' | 'aunt' | 'teen';
export type Garnish = 'strawberry' | 'mango' | 'kiwi' | 'drop' | 'none';
export type HandBeat = {
  id: HandId;
  /** bite index on the plate (kit PLATE_SCOOPS order) — hand n brings scoopsTaken to (n+1)·8/7 */
  bite: number;
  /** where the arm comes from (deg, 0 = right, 90 = down) — people lean in, so it needn't be radial to the bite.
   *  Most arms come from the sides and the bottom: the top band belongs to the counter and the bubbles. */
  arm: number;
  /** frames: enter (off-screen) · dig (spoon IMPACT on the plate) · gone (fully off-screen) */
  enter: number;
  dig: number;
  gone: number;
  garnish: Garnish;
  bubble: {
    text: string;
    sub?: string;
    start: number;
    exit: number;
    /** bubble centre (screen px) */
    x: number;
    y: number;
    shape?: 'round' | 'cloud' | 'burst';
    font?: 'friendly' | 'latin' | 'title';
    fontSize?: number;
    rotate?: number;
    fill?: string;
    /** max tail length (px from the bubble centre) */
    tailMax?: number;
  };
};

// Dig intervals 40 · 30 · 26 · 24 · 22 · 20 frames — the family speeds up (paper stop-motion, on twos).
// Copy checked for dialect: Emirati (kandura, abaya), Dubai kid in English, Levantine grandpa «دوقة», Egyptian uncle
// «معلقة واحدة بس», Shami aunt «بس معلقة وحدة يا تقبرني», Levantine teen in Arabizi «bas wa7de».
export const HANDS: HandBeat[] = [
  {
    id: 'kandura', bite: 0, arm: 128, enter: -30, dig: 16, gone: 40, garnish: 'strawberry',
    bubble: {text: 'بس ملعقة وحدة ☝️', start: -12, exit: 50, x: 372, y: 470, fontSize: 64, rotate: -2},
  },
  {
    id: 'abaya', bite: 1, arm: 58, enter: 30, dig: 56, gone: 76, garnish: 'mango',
    bubble: {text: 'ملعقة وحدة بس والله', start: 38, exit: 90, x: 640, y: 628, fontSize: 58, rotate: 2},
  },
  {
    id: 'kid', bite: 2, arm: -46, enter: 62, dig: 86, gone: 102, garnish: 'kiwi',
    bubble: {text: 'One spoon!', start: 68, exit: 116, x: 700, y: 466, shape: 'burst', font: 'latin', fontSize: 60, rotate: -4, fill: '#FFD877'},
  },
  {
    id: 'grandpa', bite: 3, arm: 104, enter: 90, dig: 112, gone: 128, garnish: 'strawberry',
    bubble: {text: 'بس دوقة', start: 94, exit: 140, x: 380, y: 628, fontSize: 64, rotate: -3},
  },
  {
    id: 'uncle', bite: 4, arm: 176, enter: 116, dig: 136, gone: 150, garnish: 'mango',
    bubble: {text: 'معلقة واحدة بس', start: 120, exit: 164, x: 400, y: 470, fontSize: 60, rotate: 2.5},
  },
  {
    id: 'aunt', bite: 5, arm: 84, enter: 140, dig: 158, gone: 172, garnish: 'kiwi',
    bubble: {text: 'بس معلقة وحدة\nيا تقبرني 🤏', start: 142, exit: 188, x: 640, y: 650, fontSize: 56, rotate: -2},
  },
  {
    id: 'teen', bite: 6, arm: 24, enter: 160, dig: 178, gone: 192, garnish: 'strawberry',
    bubble: {text: 'bas wa7de', start: 162, exit: 206, x: 720, y: 470, font: 'latin', fontSize: 58, rotate: 3},
  },
];

// ------------------------------------------------------------------------------------------------ timeline
export const T = {
  // 0.0 s — HOOK: frame 0 already shows the plate, the kandura hand over it, its bubble and the counter at 0
  hook: 0,
  hands: HANDS.map((h) => ({id: h.id, enter: h.enter, dig: h.dig, gone: h.gone, bubble: h.bubble.start, bubbleExit: h.bubble.exit})),
  /** the counter flips this many frames after each dig impact */
  flipDelay: 4,
  // the owner (arm from the bottom: the viewer's seat) — happy, eager, a clean spoon
  ownerEnter: 196,
  ownerThought: 200, // cloud «😋»
  ownerStop: 212, // screeches to a halt over the EMPTY plate → the music dies here
  ownerThoughtOut: 214,
  silenceEnd: 224, // TRUE SILENCE ownerStop → silenceEnd (digital zero), then crickets
  ownerDots: 228, // cloud «…»
  ownerDotsOut: 254,
  ownerCreep: 242, // the clean spoon creeps towards the lonely drop … (tension)
  // TOPPER: the dino-sleeve kid zips in from the right and snatches the last drop
  snatchEnter: 254,
  snatchGrab: 258, // spoon hits the drop (IMPACT) — the drop leaves the plate
  snatchGone: 266,
  snatchFlip: 260, // counter → 8 (red)
  ownerSlump: 266, // the owner's spoon sinks
  ownerLine: 274, // bubble «وأنا؟ 🥲»
  counterOut: 284, // the counter shrinks away (room for the moral)
  title: 290, // «بالبيت؟ / ما في شي اسمو / ملعقة وحدة.» word i impacts at title + i*titleStagger + 2
  titleStagger: 4,
  endCard: 360, // 12.0 s — EndCard2D (paper sheet over the last scene), 105 frames
  end: DURATION,
};

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

/** screen layout of the overlays (px) */
export const LAYOUT = {
  counter: {x: 520, y: 300, rot: -3},
  ownerThought: {x: 760, y: 560},
  ownerLine: {x: 720, y: 560},
  title: {x: 516, y: 430, fontSize: 124},
};

// ------------------------------------------------------------------------------------------------ CUE LIST
// Every audible event in frames (global, 30 fps). The sound designer: mirror these in
// src/qashati2d/spoon/audio/make_sound.py through ts_eval (never hard-code seconds).
const flip = (h: HandBeat) => h.dig + T.flipDelay;
export const CUES = {
  /** music: a playful home groove (darbuka + oud/qanun plucks) that tightens as the hands speed up; it STOPS DEAD
   *  at MUSIC_STOP (no tail) */
  MUSIC_START: 0,
  MUSIC_STOP: T.ownerStop,
  /** per hand (same order as HANDS): arm swish in, bubble pop (+2 = its overshoot drawing), spoon IMPACT on the
   *  plate (ceramic clink + wet scoop), counter flip (paper flip + tick), arm swish out (starts 8 f after the dig) */
  HAND_ENTER: HANDS.map((h) => Math.max(0, h.enter)),
  BUBBLE_POP: HANDS.map((h) => Math.max(0, h.bubble.start + 2)),
  SPOON_DIG: HANDS.map((h) => h.dig),
  SCOOP_SLURP: HANDS.map((h) => h.dig + 2),
  COUNTER_FLIP: HANDS.map(flip),
  HAND_EXIT: HANDS.map((h) => h.dig + 8),
  /** voices (optional, recorded on a phone by real people in their dialects — lines = HANDS[i].bubble.text) */
  VOICE_LINE: HANDS.map((h) => Math.max(0, h.bubble.start)),
  /** the owner */
  OWNER_ENTER: T.ownerEnter, // eager swish + a happy hum
  OWNER_THOUGHT_POP: T.ownerThought + 2,
  OWNER_STOP: T.ownerStop, // a short spoon "screech"/skid, then MUSIC_STOP on the same frame
  TRUE_SILENCE: [T.ownerStop + 2, T.silenceEnd] as const, // digital zero (mx.silence)
  CRICKETS: [T.silenceEnd, T.snatchEnter] as const, // dry, lonely, mono
  OWNER_DOTS_POP: T.ownerDots + 2,
  DROP_WOBBLE: [T.silenceEnd + 6, T.silenceEnd + 22] as const, // two tiny jelly wobbles of the last drop (soft blips)
  OWNER_CREEP: T.ownerCreep, // a thin rising tension string under the crickets
  /** the snatch */
  SNATCH_WHOOSH: T.snatchEnter,
  SNATCH_GRAB: T.snatchGrab, // spoon clink + slurp
  SNATCH_FLIP: T.snatchFlip, // counter flip 8 (heavier, a "ding" of doom)
  SNATCH_EXIT: T.snatchGrab + 2,
  OWNER_SLUMP: T.ownerSlump, // sad trombone-ish oud bend (short)
  OWNER_LINE_POP: T.ownerLine + 2,
  COUNTER_OUT: T.counterOut,
  /** the moral, InkTitle word impacts (ink thud on each) */
  TITLE_WORDS: [0, 1, 2, 3, 4, 5, 6].map((i) => T.title + i * T.titleStagger + 2),
  /** end card: call sfx.endcard_sfx(mx, sfx.fr(T.endCard)) — it plays the sheet swish, cup plop, the SONIC LOGO on
   *  the logo's two dots, the CTA stamp, the comment pop and the dot hops (kit/endcard/cues.ts). The headline
   *  «اطلبوا لكل واحد كاسة 😌» words impact at T.endCard + EC.headline + 2 + i*4 (i = 0..3, + emoji). */
  END_CARD: T.endCard,
  END: DURATION,
};
