// Phone story — where things sit on the glass (1080x1920 design space).
// The four stamps zig-zag down the screen in two columns so each cream drop can run straight
// down one column and pass exactly through the «مش» half of two stamps (and nothing else):
//   drop 0 (left column):  stamp 0 (weather) then stamp 2 (boss)
//   drop 1 (right column): stamp 1 (maps)    then stamp 3 (family)
// Stamp i's «مش» melts at T.erase[i], so the drop heads are timed to reach them then.
import {T} from '../spec';

// Lalezar advance widths in em, measured with HarfBuzz (Pillow/raqm) — see stampMetrics below.
export const STAMP_EM = {mish: 1.579, qashta: 2.06, space: 0.15, top: 0.656, bottom: 0.248};

export const STAMP_SIZE = 100; // px, Lalezar
export const STAMP_PAD_X = 46;
export const STAMP_PAD_Y = 38;
export const STAMP_GAP = STAMP_EM.space * STAMP_SIZE + 6;

export const stampMetrics = (() => {
  const wm = STAMP_EM.mish * STAMP_SIZE;
  const wq = STAMP_EM.qashta * STAMP_SIZE;
  const textW = wq + STAMP_GAP + wm;
  const width = textW + STAMP_PAD_X * 2;
  const textH = (STAMP_EM.top + STAMP_EM.bottom) * STAMP_SIZE;
  const height = textH + STAMP_PAD_Y * 2;
  // x of word centres relative to the stamp centre (RTL: «مش» on the right)
  const mishCx = width / 2 - STAMP_PAD_X - wm / 2;
  const qashtaCx = -width / 2 + STAMP_PAD_X + wq / 2;
  // after «مش» is gone the stamp hugs «قشطة»
  const widthAfter = wq + STAMP_PAD_X * 2;
  return {wm, wq, textW, width, height, mishCx, qashtaCx, widthAfter};
})();

export type StampSlot = {x: number; y: number; rot: number; drop: 0 | 1};

// index = screen index (weather, maps, boss, family)
export const STAMPS: StampSlot[] = [
  {x: 300, y: 760, rot: -7, drop: 0},
  {x: 722, y: 548, rot: 8, drop: 1},
  {x: 300, y: 1296, rot: 5, drop: 0},
  {x: 722, y: 1058, rot: -6, drop: 1},
];

const rad = (d: number) => (d * Math.PI) / 180;

// Screen position of the centre of a stamp's «مش».
export const mishPoint = (i: number) => {
  const s = STAMPS[i];
  const dx = stampMetrics.mishCx;
  const dy = 6; // the ش bowl sits a touch low
  return {
    x: s.x + dx * Math.cos(rad(s.rot)) - dy * Math.sin(rad(s.rot)),
    y: s.y + dx * Math.sin(rad(s.rot)) + dy * Math.cos(rad(s.rot)),
  };
};

// Where each drop hits the glass, and the (frame, point) waypoints its head runs through.
export const DROP_LAND = [
  {x: mishPoint(0).x - 6, y: 452},
  {x: mishPoint(1).x + 6, y: 316},
];

export type Waypoint = {f: number; x: number; y: number};

export const dropWaypoints = (d: 0 | 1): Waypoint[] => {
  const land = T.dropLand[d];
  const L = DROP_LAND[d];
  const [a, b] = d === 0 ? [0, 2] : [1, 3];
  const A = mishPoint(a);
  const B = mishPoint(b);
  const last = d === 0 ? {f: T.erase[b] + 22, x: B.x + 4, y: 2080} : {f: T.flood + 14, x: B.x - 4, y: 1720};
  // The head hits the word a few frames before T.erase, hesitates on the ink, and has slid past by
  // T.erase — so the melt itself happens in plain view beside the thin trail, not under the head.
  return [
    {f: land, x: L.x, y: L.y},
    {f: land + 6, x: L.x + 1, y: L.y + 14}, // clings to the glass for a moment
    {f: T.erase[a] - 5, x: A.x, y: A.y - 30},
    {f: T.erase[a] - 1, x: A.x + 2, y: A.y + 34},
    {f: T.erase[a] + 2, x: A.x + 3, y: A.y + 120},
    {f: T.erase[b] - 5, x: B.x, y: B.y - 30},
    {f: T.erase[b] - 1, x: B.x - 2, y: B.y + 36},
    {f: T.erase[b] + 2, x: B.x - 3, y: B.y + 124},
    last,
  ];
};
