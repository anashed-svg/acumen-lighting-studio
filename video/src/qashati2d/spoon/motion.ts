// Hand choreography (pure functions of the frame). Every pose is evaluated ON TWOS (the drawings), the camera
// is not involved here. A pose = distance along the arm direction from the target (`off`, + = back towards the
// eater), a sideways offset (`lat`), the height above the table (`h`, = closer to the camera: bigger + longer
// shadow), a wrist rotation (`rot`), spoon `load`, `grip`, and a smear stretch from the speed.
import {onTwos, PLATE_SCOOPS, Pt} from '../kit/lib';
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
  /** smear stretch along the motion (1 = none) and the motion direction */
  smear: number;
  vel: Pt;
};

const OFF = 1150;

const build = (target: Pt, dirDeg: number, keys: Key[], f: number, extra?: (f2: number) => Partial<Pose>): Pose => {
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
  return {...pose, ...(extra ? extra(f2) : {})};
};

/** keys of a family member's turn (relative to its dig D) */
const turnKeys = (b: HandBeat, i: number): Key[] => {
  const D = b.dig;
  const arrive = b.id === 'kandura' ? -6 : D - 8;
  const side = i % 2 ? 1 : -1;
  return [
    {f: b.enter, off: OFF, h: 180, lat: 0, rot: 10 * side},
    {f: arrive - 2, off: -40, h: 160, lat: 30 * side, rot: -4 * side, e: 'out'}, // swings in, a hair past
    {f: arrive, off: 10, h: 150, lat: 8 * side, rot: 0, e: 'io'},
    {f: D - 4, off: 46, h: 196, lat: 0, rot: 4 * side, e: 'io'}, // anticipation: lift & draw back
    {f: D - 2, off: 34, h: 96, lat: 0, rot: 2 * side, e: 'in'}, // dive
    {f: D, off: 0, h: 4, lat: 0, rot: -6 * side, e: 'in'}, // IMPACT
    {f: D + 2, off: -30, h: 0, lat: -6 * side, rot: -10 * side, e: 'out'}, // drags into the cream
    {f: D + 4, off: -44, h: 4, lat: -10 * side, rot: -6 * side, e: 'io'},
    {f: D + 6, off: -18, h: 50, lat: 0, rot: 4 * side, e: 'io'}, // scoops out
    {f: D + 8, off: 70, h: 165, lat: 10 * side, rot: 8 * side, e: 'out'}, // lifts the heap
    {f: b.gone, off: OFF + 80, h: 190, lat: 40 * side, rot: 14 * side, e: 'in'}, // off with it
  ];
};

export const handPose = (i: number, f: number): Pose => {
  const b = HANDS[i];
  const keys = turnKeys(b, i);
  return build(biteTarget(b), biteDir(b), keys, f, (f2) => ({
    load: f2 < b.dig + 2 ? 0 : Math.min(1.25, ((f2 - b.dig - 2) / 4) * 1.25),
    grip: f2 >= b.dig - 2 && f2 < b.dig + 6 ? 1 : 0,
  }));
};

// ------------------------------------------------------------------------------------------------ the owner
export const OWNER_DIR = 92; // from the bottom edge: the viewer's own seat
const OWNER_TARGET: Pt = [DROP_WORLD[0] - 6, DROP_WORLD[1] + 190];
const ownerKeys: Key[] = [
  {f: T.ownerEnter, off: OFF, h: 200, lat: -30, rot: 8},
  {f: T.ownerStop - 6, off: 40, h: 170, lat: 10, rot: -2, e: 'out'}, // eager
  {f: T.ownerStop - 4, off: -30, h: 160, lat: 4, rot: -5, e: 'out'}, // overshoots — sees it — brakes
  {f: T.ownerStop, off: 0, h: 150, lat: 0, rot: 0, e: 'io'}, // STOP
  {f: T.ownerCreep, off: 0, h: 150, lat: 0, rot: 0, e: 'lin'}, // frozen (tremble is added on top)
  {f: T.snatchGrab, off: -96, h: 110, lat: 2, rot: -2, e: 'in'}, // the creep towards the drop …
  {f: T.ownerSlump, off: -96, h: 110, lat: 2, rot: -2, e: 'lin'}, // … frozen by the snatch
  {f: T.ownerSlump + 14, off: -40, h: 30, lat: -6, rot: 10, e: 'out'}, // slumps onto the table
  {f: T.end, off: -30, h: 26, lat: -6, rot: 11, e: 'io'},
];
export const ownerPose = (f: number): Pose =>
  build(OWNER_TARGET, OWNER_DIR, ownerKeys, f, (f2) => {
    // the tremble while frozen over the empty plate (on twos, tiny)
    const tremble = f2 > T.ownerStop + 4 && f2 < T.snatchGrab ? Math.sin(f2 * 1.9) * 1.6 : 0;
    return {angle: OWNER_DIR - 90 + sample(ownerKeys, f2).rot + tremble, load: 0, grip: f2 > T.ownerStop && f2 < T.ownerSlump ? 0.6 : 0};
  });
export const ownerVisible = (f: number) => f >= T.ownerEnter;

// ------------------------------------------------------------------------------------------------ the snatcher
export const SNATCH_DIR = -10; // from the right
const snatchKeys: Key[] = [
  {f: T.snatchEnter, off: OFF, h: 150, lat: -40, rot: 14},
  {f: T.snatchGrab - 2, off: 120, h: 70, lat: -10, rot: 6, e: 'in'},
  {f: T.snatchGrab, off: 0, h: 6, lat: 0, rot: -4, e: 'out'}, // GRAB
  {f: T.snatchGrab + 2, off: 30, h: 60, lat: 10, rot: -12, e: 'out'},
  {f: T.snatchGone, off: OFF + 120, h: 220, lat: 70, rot: -20, e: 'in'},
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
