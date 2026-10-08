// Hand choreography (pure functions of the frame). Every pose is evaluated ON TWOS (the drawings), the camera
// is not involved here. A pose = distance along the arm direction from the target (`off`, + = back towards the
// eater), a sideways offset (`lat`), the height above the table (`h`, = closer to the camera: bigger + longer
// shadow), a wrist rotation (`rot`), spoon `load`, `grip`, and a smear stretch from the speed.
import {jiggle, onTwos, PLATE_SCOOPS, Pt} from '../kit/lib';
import {HANDS, HandBeat, PLATE, T} from './spec';


type Ease = 'io' | 'in' | 'out' | 'lin' | 'back';
type Key = {f: number; off: number; h: number; lat?: number; rot?: number; e?: Ease};

const E = {
  io: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - (1 - t) ** 3,
  lin: (t: number) => t,
  back: (t: number) => {
    const s = 1.7;
    const x = t - 1;
    return 1 + (s + 1) * x * x * x + s * x * x;
  },
};

const sample = (keys: Key[], f: number) => {
  if (f <= keys[0].f) return {off: keys[0].off, h: keys[0].h, lat: keys[0].lat ?? 0, rot: keys[0].rot ?? 0};
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f <= b.f) {
      const t = E[b.e ?? 'io'](Math.min(1, Math.max(0, (f - a.f) / Math.max(1e-6, b.f - a.f))));
      const l = (x?: number, y?: number) => (x ?? 0) + ((y ?? 0) - (x ?? 0)) * t;
      return {off: a.off + (b.off - a.off) * t, h: a.h + (b.h - a.h) * t, lat: l(a.lat, b.lat), rot: l(a.rot, b.rot)};
    }
  }
  const z = keys[keys.length - 1];
  return {off: z.off, h: z.h, lat: z.lat ?? 0, rot: z.rot ?? 0};
};

// ------------------------------------------------------------------------------------------------ plate geometry
const rotP = (p: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};
/** world point of plate art coords (1000×1000 art space, centre 500,500), honouring PLATE.rotate */
export const plateWorld = (ax: number, ay: number): Pt => {
  const [dx, dy] = rotP([(ax - 500) * PLATE.scale, (ay - 500) * PLATE.scale], PLATE.rotate);
  return [PLATE.x + dx, PLATE.y + dy];
};
/** the last cream drop (FamilyPlate2D draws it at art (506, 550)) */
export const DROP_WORLD = plateWorld(506, 550);

export const biteTarget = (b: HandBeat): Pt => plateWorld(PLATE_SCOOPS[b.bite].x, PLATE_SCOOPS[b.bite].y);
/** the arm's direction (deg, screen convention 0 = right, 90 = down) for a beat */
export const biteDir = (b: HandBeat) => b.arm;

export type Pose = {
  visible: boolean;
  /** bowl position (world px) */
  x: number;
  y: number;
  h: number;
  /** arm direction (deg) */
  dir: number;
  /** FamilyHand angle */
  angle: number;
  load: number;
  grip: number;
  heapWobble?: number;
  /** smear stretch along the motion (1 = none) and the motion direction */
  smear: number;
  vel: Pt;
};

const OFF = 1150;

const build = (target: Pt, dirDeg: number, keys: Key[], f: number, extra?: (f2: number, base: Pose) => Partial<Pose>): Pose => {
  const f2 = onTwos(f);
  const s = sample(keys, f2);
  const s2 = sample(keys, f2 + 2);
  const a = (dirDeg * Math.PI) / 180;
  const u: Pt = [Math.cos(a), Math.sin(a)];
  const n: Pt = [-u[1], u[0]];
  const x = target[0] + u[0] * s.off + n[0] * s.lat;
  const y = target[1] + u[1] * s.off + n[1] * s.lat;
  const vx = u[0] * (s2.off - s.off) + n[0] * (s2.lat - s.lat);
  const vy = u[1] * (s2.off - s.off) + n[1] * (s2.lat - s.lat);
  const sp = Math.hypot(vx, vy) / 2; // px per frame
  const L = Math.hypot(vx, vy) || 1;
  const pose: Pose = {
    visible: f2 >= keys[0].f && f2 <= keys[keys.length - 1].f,
    x,
    y,
    h: s.h,
    dir: dirDeg,
    angle: dirDeg - 90 + s.rot,
    load: 0,
    grip: 0,
    smear: 1 + Math.min(0.42, Math.max(0, sp - 22) / 260),
    vel: [vx / L, vy / L],
  };
  return {...pose, ...(extra ? extra(f2, pose) : {})};
};

/** keys of a family member's turn (relative to its dig D). Same choreography, different temperaments:
 *  kandura calm and dignified · abaya a graceful sweep · kid zips in late and overshoots · grandpa slow and shaky
 *  ("just a taste") · uncle a big confident wind-up · aunt dainty · teen a lazy hover, eyes on his phone */
const turnKeys = (b: HandBeat, i: number): Key[] => {
  const D = b.dig;
  const T0: Record<string, {arrive: number; past: number; lift: number; latPast: number}> = {
    kandura: {arrive: -8, past: -40, lift: 200, latPast: 30},
    abaya: {arrive: D - 10, past: -46, lift: 196, latPast: 52},
    kid: {arrive: D - 6, past: -86, lift: 214, latPast: 20},
    grandpa: {arrive: D - 14, past: -20, lift: 184, latPast: 14},
    uncle: {arrive: D - 10, past: -52, lift: 246, latPast: 36},
    aunt: {arrive: D - 10, past: -36, lift: 190, latPast: 40},
    teen: {arrive: D - 18, past: -30, lift: 196, latPast: 24},
  };
  const t = T0[b.id];
  const arrive = t.arrive;
  const side = i % 2 ? 1 : -1;
  const keys: Key[] = [
    {f: b.enter, off: OFF, h: 180, lat: 0, rot: 10 * side},
    {f: arrive - 2, off: t.past, h: 160, lat: t.latPast * side, rot: -4 * side, e: 'out'}, // swings in, a hair past
    {f: arrive, off: 10, h: 150, lat: 8 * side, rot: 0, e: 'io'},
  ];
  if (b.id === 'teen') keys.push({f: D - 8, off: 24, h: 168, lat: -12, rot: 6, e: 'io'}); // a lazy hover (eyes on the phone)
  keys.push(
    {f: D - 4, off: 50, h: t.lift, lat: 0, rot: 5 * side, e: 'io'}, // anticipation: lift & draw back
    {f: D - 2, off: 34, h: 96, lat: 0, rot: 2 * side, e: 'in'}, // dive
    {f: D, off: 0, h: 4, lat: 0, rot: -6 * side, e: 'in'}, // IMPACT
    {f: D + 2, off: -36, h: 0, lat: -6 * side, rot: -10 * side, e: 'out'}, // drags into the cream
    {f: D + 4, off: -52, h: 4, lat: -10 * side, rot: -6 * side, e: 'io'},
    {f: D + 6, off: -22, h: 50, lat: 0, rot: 4 * side, e: 'io'}, // scoops out — the heap comes with it
    {f: D + 8, off: 70, h: 165, lat: 10 * side, rot: 8 * side, e: 'out'}, // lifts the heap (a beat of pride)
    {f: b.gone, off: OFF + 80, h: 190, lat: 40 * side, rot: 14 * side, e: 'in'}, // off with it
  );
  return keys;
};

export const handPose = (i: number, f: number): Pose => {
  const b = HANDS[i];
  const keys = turnKeys(b, i);
  return build(biteTarget(b), biteDir(b), keys, f, (f2, base) => ({
    // grandpa's hand shakes while it hovers (on twos, across the arm) — "just a taste"
    ...(b.id === 'grandpa' && f2 > b.enter + 10 && f2 < b.dig - 2
      ? (() => {
          const a = (b.arm * Math.PI) / 180;
          const k = 5 * Math.sin(f2 * 2.4);
          return {x: base.x - Math.sin(a) * k, y: base.y + Math.cos(a) * k};
        })()
      : {}),
    // the heap grows while the spoon drags through the cream (impact → +6), on twos
    load: f2 < b.dig ? 0 : Math.min(1, (f2 - b.dig + 2) / 8),
    grip: f2 >= b.dig - 2 && f2 < b.dig + 6 ? 1 : 0,
    // the heap's jelly: squashes when the spoon jerks up (+6), stretches as the hand whips off
    heapWobble: f2 >= b.dig + 6 ? jiggle(f2, b.dig + 6, 1, 1.1, 0.22) : 0,
  }));
};

// ------------------------------------------------------------------------------------------------ the owner
export const OWNER_DIR = 98; // from the bottom edge (the viewer's own seat), a touch from the left
const ownerU: Pt = [Math.cos((OWNER_DIR * Math.PI) / 180), Math.sin((OWNER_DIR * Math.PI) / 180)];
/** the owner's spoon stops this far (world px, along his arm) from the drop … and creeps to CREEP_END */
const OWNER_GAP = 200;
const OWNER_TARGET: Pt = [DROP_WORLD[0] + ownerU[0] * OWNER_GAP, DROP_WORLD[1] + ownerU[1] * OWNER_GAP];
const ownerKeys: Key[] = [
  {f: T.ownerEnter, off: OFF, h: 210, lat: -30, rot: 8},
  {f: T.ownerStop - 6, off: 60, h: 180, lat: 10, rot: -2, e: 'out'}, // eager, happy
  {f: T.ownerStop - 4, off: -34, h: 164, lat: 4, rot: -5, e: 'out'}, // overshoots — sees it — brakes
  {f: T.ownerStop - 2, off: 8, h: 154, lat: 0, rot: 2, e: 'io'},
  {f: T.ownerStop, off: 0, h: 150, lat: 0, rot: 0, e: 'io'}, // STOP. (held: the stillness IS the joke)
  {f: T.ownerCreep, off: 0, h: 150, lat: 0, rot: 0, e: 'lin'},
  {f: T.snatchGrab - 2, off: -104, h: 112, lat: 2, rot: -2, e: 'in'}, // the creep towards the drop …
  {f: T.ownerSlump, off: -104, h: 112, lat: 2, rot: -2, e: 'lin'}, // … frozen by the snatch
  {f: T.ownerSlump + 4, off: -96, h: 124, lat: 0, rot: 3, e: 'out'}, // a little recoil
  {f: T.ownerSlump + 14, off: -40, h: 24, lat: -6, rot: 12, e: 'in'}, // slumps onto the table
  {f: T.ownerSlump + 18, off: -38, h: 30, lat: -6, rot: 11, e: 'out'}, // (a tiny bounce: the spoon clinks)
  {f: T.end, off: -30, h: 26, lat: -6, rot: 11, e: 'io'},
];
export const ownerPose = (f: number): Pose =>
  build(OWNER_TARGET, OWNER_DIR, ownerKeys, f, (f2) => {
    // a tremble while frozen over the empty plate (on twos, tiny)
    const tremble = f2 > T.ownerStop + 6 && f2 < T.snatchGrab ? Math.sin(f2 * 1.9) * 1.4 : 0;
    return {angle: OWNER_DIR - 90 + sample(ownerKeys, f2).rot + tremble, load: 0, grip: f2 > T.ownerStop && f2 < T.ownerSlump ? 0.6 : 0};
  });
export const ownerVisible = (f: number) => f >= T.ownerEnter;

// ------------------------------------------------------------------------------------------------ the snatcher
// the same dino-sleeve kid, this time from the TOP LEFT — the only arm in the film that comes from the top (a
// surprise direction); the long diagonal keeps the spiky green sleeve in frame even in the push-in
export const SNATCH_DIR = -124;
const snatchKeys: Key[] = [
  {f: T.snatchEnter, off: OFF, h: 160, lat: -50, rot: 16},
  {f: T.snatchGrab - 2, off: 150, h: 70, lat: -10, rot: 6, e: 'in'},
  {f: T.snatchGrab, off: 0, h: 6, lat: 0, rot: -4, e: 'out'}, // GRAB
  {f: T.snatchGrab + 2, off: 36, h: 60, lat: 12, rot: -12, e: 'out'},
  {f: T.snatchGrab + 4, off: 120, h: 110, lat: 30, rot: -16, e: 'in'},
  {f: T.snatchGone, off: OFF + 140, h: 230, lat: 80, rot: -22, e: 'in'},
];
export const snatchPose = (f: number): Pose =>
  build(DROP_WORLD, SNATCH_DIR, snatchKeys, f, (f2) => ({load: f2 >= T.snatchGrab ? 0.9 : 0, grip: f2 >= T.snatchGrab - 2 && f2 < T.snatchGrab + 4 ? 1 : 0}));

// ------------------------------------------------------------------------------------------------ plate state
/** scoopsTaken on the plate: hand i digs bite i between dig and dig+6 (7 hands → 8 bites) */
export const plateTaken = (f: number) => {
  const f2 = onTwos(f);
  let taken = 0;
  HANDS.forEach((b, i) => {
    if (f2 >= b.dig) {
      const p = Math.min(1, (f2 - b.dig) / 6);
      taken = ((i + E.out(p)) * 8) / 7;
    }
  });
  return Math.min(8, taken);
};
export const counterFlips = [...HANDS.map((h) => h.dig + T.flipDelay), T.snatchFlip];
