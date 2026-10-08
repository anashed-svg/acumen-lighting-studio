// «ضيوف فجأة» — Qashati 2D spot #3 (script 3 in brands/qashati-alsham/CONCEPTS-2D.md), an episode of «خلّيها قشطة».
// SINGLE SOURCE OF TRUTH for timing, copy, layout and the sound cue list. Pure data (no React/Remotion imports), so the
// sound script can read it through esbuild (kit/audio/sfx.py → ts_eval):
//   T    = sfx.ts_eval("import {T} from './src/qashati2d/guests/spec'; console.log(JSON.stringify(T));")
//   CUES = sfx.ts_eval("import {CUES} from './src/qashati2d/guests/spec'; console.log(JSON.stringify(CUES));")
//
// 30 fps · 1080×1920 · 480 frames (16.0 s). Characters/props move ON TWOS, cameras move on ones.
//
// THE STORY (sound-off, the host's POV — we only ever see the host's striped pyjama sleeve):
//  1 PEEPHOLE (0.0 s)  Frame 0 already says it: «ضيوف فجأة 😳» over a fisheye peephole crammed with SIX grinning,
//                      waving guests; «دينغ…» / «دونغ!» and the frame shakes. The boy leans in and SMUSHES his face on
//                      the lens (fogs it). The host jumps back.
//  2 FRIDGE (1.9 s)    Whip to the kitchen: the fridge is yanked open… a moth flutters out; a cobweb, a lemon, ONE egg in
//                      a six-egg carton, a nearly empty ketchup bottle. The light flickers, cold mist rolls out, a dead
//                      beat; the lemon rolls and clinks the egg; the bulb dies.
//  3 CLOCK+PHONE (3.7) Tick… tick… (accelerating), «دينغ دونغ!!» again. Tilt down to the phone in the host's hand: a drawn
//                      order screen «صحون قشاطي للعيلة» — the thumb winds up and presses «اطلب».
//  4 DOOR (5.7 s)      The door swings open: the six guests in the doorway, «مرحبااا! 👋».
//  5 COFFEE (6.9 s)    «ضيّفناهن قهوة…» — the host's hand pours gahwa from a dallah into finjan after finjan; with each
//                      cup the guests' eyes get wider; grandpa shakes his cup «بس بس!» (enough) and gets a refill anyway;
//                      the whole sofa vibrates on caffeine… FREEZES (0.4 s of digital silence). «تشك-تشك!» — the brand's brass cymbals are the doorbell this
//                      time: six heads snap to the door, eyes turn to hearts, «…ووصلت القشاطي 🛵».
//  6 FEAST (9.7 s)     The coffee table: a big qashati sharing plate on the brass tray, a hero cup for the kids, spoons
//                      going in, hearts, «mmm». «ضيوف فجأة؟ خلّيها قشطة.»
//  7 END CARD (12.5 s) Kit EndCard2D: «اطلبها من طلبات» · «أو من تطبيق قشاطي الشام» · «ندّ الحمر · دبي»,
//                      comment prompt «شو أكتر شي بتضيّفوه للضيوف؟ 👇».
// No delivery-time claim anywhere: the coffee comes first, like in every Arab home.

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 480; // 16.0 s

// ------------------------------------------------------------------------------------------------ timeline
export const T = {
  // 1 — PEEPHOLE (the hook: everything readable on frame 0)
  hook: 0,
  ding: 0, // «دينغ…» lettering + shake (on screen from frame 0)
  dong: 12, // «دونغ!» lettering + bigger shake
  titleHook: -12, // InkTitle start (virtual): all words are already pressed on frame 0; it re-jolts on `dong`
  titleHookOut: 40,
  kidLean: 24, // the boy winds back (anticipation) …
  kidSmush: 34, // … and SMUSHES his face on the lens (squeak), fog blooms
  recoil: 44, // the host jumps back: the peephole shrinks into the door
  whip1: 50, // whip pan to the kitchen (50 → 58)
  // 2 — FRIDGE
  fridge: 56, // shot start (whip lands at 60)
  handGrab: 62,
  fridgeYank: 66, // the door swings open (anticipation 62–66), bounces at 72
  lightOn: [70, 76, 82] as readonly number[], // flicker on (buzz) …
  lightOff: [74, 80] as readonly number[], // … and off
  mist: 70, // cold mist rolls out (70 → 100)
  moth: 72, // a moth flutters out of the empty fridge (72 → 98)
  deadBeat: [84, 94] as const, // nothing moves (fridge hum only)
  lemonRoll: 94, // the lemon starts rolling …
  lemonClink: 102, // … and clinks the egg (the egg wobbles)
  bulbDies: 106, // the bulb pops: dark
  // 3 — CLOCK + PHONE
  clock: 110, // hard cut on the first tick
  ticks: [110, 116, 121, 126, 130, 134, 138] as readonly number[], // accelerating
  ding2: 118, // «دينغ دونغ!!» again (shake)
  tilt: [128, 146] as const, // camera tilts down to the phone
  thumbWind: 146, // the thumb lifts (anticipation) …
  thumbPress: 152, // … and PRESSES «اطلب» (button squash + burst)
  phoneOut: 162, // whip to the door (162 → 170)
  // 4 — DOOR
  door: 168,
  doorUnlatch: 172, // handle click
  doorSwing: [174, 184] as const, // the door swings open (anticipation 172–174)
  hello: 184, // «مرحبااا! 👋» bubble pops
  helloOut: 204,
  surge: 194, // the guests lean in, the camera pushes
  // 5 — COFFEE + ARRIVAL
  sofa: 206,
  titleCoffee: 208, // «ضيّفناهن قهوة…» word i impacts at titleCoffee + i*titleStagger + 2
  pours: [
    {who: 'amo', start: 214, end: 224, wide: 224},
    {who: 'khala', start: 228, end: 238, wide: 238},
    {who: 'jiddo', start: 242, end: 252, wide: 252},
  ] as const,
  enoughShake: 240, // grandpa shakes his finjan («enough») + «بس بس!» — he gets poured anyway
  enoughOut: 254,
  wired: 252, // the whole sofa vibrates (252 → 258) …
  beat: 258, // … then FREEZES: 12 frames (0.4 s) of total stillness + digital silence (eyes wide, nobody breathes)
  titleCoffeeOut: 270, // «ضيّفناهن قهوة...» hangs over the freeze and leaves ON the cymbals
  arrivalDing: 270, // «تشك-تشك!» — the brand cymbals ARE the doorbell (sonic logo)
  headSnap: 272, // six heads whip to the door (smear drawing at 272)
  hearts: 278, // eyes turn to hearts
  titleArrival: 274, // «…ووصلت القشاطي 🛵» (words 276/280/284) — a SCREEN title: it rides over the whip into the feast
  arrivalOut: 318, // … and leaves there (fully readable 284 → 318, ~1.1 s; first word from 276)
  // 6 — FEAST
  feast: 292, // whip lands on the table (whip 286 → 292)
  spoonDigs: [300, 312, 324] as readonly number[], // spoons go into the plate: amo (top), THE HOST (bottom), the dino kid (right)
  heartPops: [304, 314, 324, 338] as readonly number[],
  titleFinal: 334, // «ضيوف فجأة؟ / خلّيها قشطة.» word i impacts at titleFinal + i*titleStagger + 2
  titleStagger: 4,
  // 7 — END CARD
  endCard: 375, // 12.5 s — kit EndCard2D (105 frames), the feast stays underneath while the paper slides up
  end: DURATION,
};

// ------------------------------------------------------------------------------------------------ copy
export const COPY = {
  hookTitle: 'ضيوف فجأة 😳',
  ding: 'دينغ...',
  dong: 'دونغ!',
  ding2: 'دينغ دونغ!!',
  enough: 'بس بس!',
  phoneTitle: 'صحون قشاطي\nللعيلة',
  phoneButton: 'اطلب',
  hello: 'مرحبااا! 👋',
  coffeeTitle: 'ضيّفناهن قهوة...',
  arrivalSfx: 'تشك-تشك!',
  arrivalTitle: '...ووصلت القشاطي 🛵',
  finalTitle: 'ضيوف فجأة؟\nخلّيها قشطة.',
  endComment: 'شو أكتر شي بتضيّفوه للضيوف؟ 👇',
};

// ------------------------------------------------------------------------------------------------ layout (screen px)
// Key text inside x 60–960, y 220–1400 (TikTok/Reels chrome); nothing important below y 1248 when avoidable.
export const LAYOUT = {
  hookTitle: {x: 510, y: 312, size: 150},
  lens: {x: 530, y: 905, r: 455},
  ding: {x: 790, y: 1290, rot: -9, size: 100}, // right edge of the word ≤ x 940: clear of the TikTok/Reels action rail
  dong: {x: 196, y: 540, rot: -8, size: 124},
  ding2: {x: 300, y: 380, rot: -6, size: 96},
  phone: {x: 560, y: 980, w: 470, h: 900, rot: -6},
  hello: {x: 640, y: 420},
  coffeeTitle: {x: 510, y: 330, size: 128},
  arrivalSfx: {x: 750, y: 560, rot: 8, size: 100},
  arrivalTitle: {x: 500, y: 330, size: 116},
  finalTitle: {x: 510, y: 345, size: 112},
};

// ------------------------------------------------------------------------------------------------ CUE LIST
// Every audible event in GLOBAL frames (30 fps). Sound designer: mirror these in
// src/qashati2d/guests/audio/make_sound.py through ts_eval — never hard-code seconds.
const titleWords = (start: number, n: number) => Array.from({length: n}, (_, i) => start + i * T.titleStagger + 2);
export const CUES = {
  /** music: a cheeky home groove (darbuka + oud) that starts on the doorbell, PANICS (tempo up, pizzicato) through
   *  the fridge + clock, drops to a polite "salon" oud under the coffee (it gets jittery with each cup), STOPS for the
   *  arrival cymbals, then a warm full groove for the feast that resolves into the end card */
  MUSIC_START: 0,
  /** 1 — peephole */
  DOORBELL_DING: T.ding, // two-tone house chime, note 1 (sfx.doorbell — its gap 0.42 s ≈ 12.6 f: note 2 lands on DONG)
  DOORBELL_DONG: T.dong,
  SHAKE: [T.ding, T.dong] as const, // a low door-rattle thump under each chime note
  GUEST_CHATTER: [2, 44] as const, // muffled happy chatter + "yoo-hoo" through the door (muted, LPF)
  KID_LEAN: T.kidLean, // a little cartoon "wind-back" creak
  KID_SMUSH: T.kidSmush, // rubber-on-glass SQUEAK + a breath fog «hhhh» (+4)
  RECOIL: T.recoil, // the host's startled gasp/whoosh back
  WHIP_1: T.whip1, // whip pan (swish_big) 50 → 58
  /** 2 — fridge */
  HAND_GRAB: T.handGrab, // plastic handle grip
  FRIDGE_YANK: T.fridgeYank, // seal "thwock" + door swing whoosh, bounce knock at +6
  LIGHT_FLICKER_ON: T.lightOn, // fluorescent buzz-tick on each
  LIGHT_FLICKER_OFF: T.lightOff,
  MIST: [T.mist, T.mist + 30] as const, // a soft cold "fff" breath
  MOTH: [T.moth, T.deadBeat[0]] as const, // a tiny papery wing-flutter that passes the camera (L → R), a dust puff at +2; gone before the dead beat
  DEAD_BEAT: T.deadBeat, // music OUT; fridge hum only (no silence trick here — the hum IS the joke)
  LEMON_ROLL: [T.lemonRoll, T.lemonClink] as const, // a lemon rolling on a glass shelf
  LEMON_CLINK: T.lemonClink, // tiny clink on the egg + egg wobble "tok-tok"
  BULB_DIES: T.bulbDies, // filament "tink" + dark (music back in, faster, at T.clock)
  /** 3 — clock + phone */
  CLOCK_TICKS: T.ticks, // tick-tock, louder and faster each time (cut lands on the first)
  DOORBELL_2: T.ding2, // the chime again, double-rung (impatient): ding-dong-ding-dong
  TILT_WHOOSH: T.tilt[0],
  THUMB_WIND: T.thumbWind, // a tiny rising "wind-up" squeak
  THUMB_PRESS: T.thumbPress, // a fat glassy TAP + a little bell/sparkle (order placed)
  WHIP_2: T.phoneOut, // whip to the door
  /** 4 — door */
  DOOR_UNLATCH: T.doorUnlatch, // latch click
  DOOR_SWING: T.doorSwing[0], // creak + whoosh, warm hallway air
  CROWD_HELLO: T.hello, // the guests' happy «مرحبااا!» (a small crowd, real voices if possible) + kisses smack-smack
  SURGE: T.surge,
  /** 5 — coffee + arrival */
  TITLE_COFFEE_WORDS: titleWords(T.titleCoffee, 2), // ink thud per word
  POUR_START: T.pours.map((p) => p.start), // dallah pour: a thin liquid stream into a small cup (each ~0.33 s)
  POUR_END: T.pours.map((p) => p.end),
  EYES_WIDE: T.pours.map((p) => p.wide), // a comic "boing-sproing" eye pop, rising in pitch per guest
  ENOUGH_SHAKE: T.enoughShake, // grandpa's cup rattles (porcelain tick-tick-tick) — ignored
  ENOUGH_BUBBLE_POP: T.enoughShake + 2, // «بس بس!» bubble pop (optional grandpa voice)
  WIRED: [T.wired, T.beat] as const, // every cup rattling + a buzzy jitter under the salon oud
  TRUE_SILENCE: [T.beat, T.arrivalDing] as const, // digital zero (mx.silence): the comic beat before the cymbals
  ARRIVAL_SONIC_LOGO: T.arrivalDing, // «تشك-تشك» = the doorbell: sfx.sonic_logo — music STOPS dead on it
  HEAD_SNAP: T.headSnap, // six whip-swishes at once (one big "fwip")
  HEARTS_POP: T.hearts, // a soft "awww" bloom + bubbly pops
  TITLE_ARRIVAL_WORDS: titleWords(T.titleArrival, 3),
  /** 6 — feast */
  WHIP_3: T.feast - 6,
  FEAST_MUSIC: T.feast, // warm, full groove (the payoff)
  SPOON_DIGS: T.spoonDigs, // spoon into qashta: soft creamy scoop (sfx.scoop) + clink on the plate
  HEART_POPS: T.heartPops, // little bubble pops as hearts float up
  MMM: [T.feast + 14, T.feast + 40] as const, // happy «mmm» murmurs (voices)
  TITLE_FINAL_WORDS: titleWords(T.titleFinal, 4), // ink thud on each word; the 4th («قشطة.») gets the big one
  /** 7 — end card: call sfx.endcard_sfx(mx, sfx.fr(T.endCard)). Paper swish at T.endCard, cup plop +14, the SONIC
   *  LOGO on the logo's two dots (T.endCard + 20 and + 26), CTA stamp +46, comment pop +68, dot hops +92/+98. */
  END_CARD: T.endCard,
  END: DURATION,
};
