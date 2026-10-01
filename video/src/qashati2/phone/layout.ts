// Phone story — where things sit on the glass (1080x1920 design space) and the paths the cream takes.
//
// Zoning (keeps every punchline readable): the TOP band (y ≈ 230–680) is the reading window where each
// screen puts its punchline (41°, the ETA, the boss's message, «مين أكل…», the evidence photo, the order
// banner). Stamp 0 — the hook — sits in the middle band right under the temperature, big. Every later
// stamp piles up in the BOTTOM band (y ≈ 990–1500) or in the free left strip between the order banner
// (bottom y 538) and stamp 0, beside/below the punchline and never on it (the order banner stays clear).
//
// Erase carriers: stamp 0 is washed by the hero bead (both logo dots merged); the bead runs on through
// the «مش» of stamps 1 and 4 and off the bottom of the glass; every other stamp is hit by a cream splat
// (thrown onto the glass like the stamps were slammed onto it), which slides down dragging «مش» with it.
import {T} from '../spec';

// Lalezar advance widths in em, measured with HarfBuzz (Pillow/raqm).
export const STAMP_EM = {mish: 1.579, qashta: 2.06, space: 0.15, top: 0.656, bottom: 0.248};

// Base stamp (scale 1): 100 px Lalezar. Each slot scales it.
export const STAMP_SIZE = 100;
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
  const base = STAMP_SIZE * ((STAMP_EM.top - STAMP_EM.bottom) / 2); // text baseline (y, local)
  const glyphTop = base - STAMP_EM.top * STAMP_SIZE;
  const glyphBottom = base + STAMP_EM.bottom * STAMP_SIZE;
  return {wm, wq, textW, width, height, mishCx, qashtaCx, widthAfter, base, glyphTop, glyphBottom};
})();

export type StampSlot = {x: number; y: number; rot: number; s: number};

// index = stamp index: 0..3 = the four screens (weather, maps, boss, family), 4..8 = the burst.
export const STAMPS: StampSlot[] = [
  {x: 540, y: 830, rot: -3, s: 1.7}, // hook: ~855 px wide, 170 px glyphs, right under «41°»
  {x: 660, y: 1150, rot: 6, s: 0.88}, // maps: on the red route, below the ETA card
  {x: 292, y: 1285, rot: -7, s: 0.84}, // boss
  {x: 250, y: 1428, rot: 3, s: 0.76}, // family: lands BESIDE the evidence photo (bubble x ≥ 449 at 110), never on it
  // burst: starts bottom-right (the photo has scrolled away by then), climbs to the free strip under the banner
  {x: 740, y: 1405, rot: 6, s: 0.56}, // in the bead's path (it runs on from stamp 1)
  {x: 628, y: 1288, rot: 5, s: 0.46},
  {x: 212, y: 1130, rot: -11, s: 0.56}, // clear of the hook's ink blot at (252, 1076)
  {x: 180, y: 614, rot: -7, s: 0.48}, // 7 + 8: under the order banner (y ≥ 538), left of the photo bubble
  {x: 425, y: 606, rot: 8, s: 0.48},
];
export const N_STAMPS = STAMPS.length;
export const BURST = [4, 5, 6, 7, 8];

const rad = (d: number) => (d * Math.PI) / 180;

// stamp-local (scale-1, unrotated, relative to the centre) -> design space
export const stampToDesign = (i: number, lx: number, ly: number) => {
  const s = STAMPS[i];
  const c = Math.cos(rad(s.rot));
  const n = Math.sin(rad(s.rot));
  return {x: s.x + s.s * (lx * c - ly * n), y: s.y + s.s * (lx * n + ly * c)};
};
// design space -> stamp-local
export const designToStamp = (i: number, x: number, y: number) => {
  const s = STAMPS[i];
  const c = Math.cos(rad(s.rot));
  const n = Math.sin(rad(s.rot));
  const dx = (x - s.x) / s.s;
  const dy = (y - s.y) / s.s;
  return {x: dx * c + dy * n, y: -dx * n + dy * c};
};

// Screen position of the centre of a stamp's «مش».
export const mishPoint = (i: number) => stampToDesign(i, stampMetrics.mishCx, 6);

// ---------------------------------------------------------------- monotone cubic (Fritsch–Carlson)
export const monotone = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};

// ---------------------------------------------------------------- the hero bead
// Both logo dots land on the top edge of stamp 0 above its «مش», merge into one big bead, which then
// breaks free at T.erase[0], slides down through «مش» (18 frames), runs on through stamp 1's «مش» at
// T.erase[1] and comes to rest as a hanging drop.
export const DOT_R = 84; // landed dot radius
export const BEAD_R = 118; // merged bead radius (two dots' worth of cream)

const M0 = mishPoint(0);
const M1 = mishPoint(1);
export const DOT_LAND = [
  {x: M0.x + 40, y: M0.y - 186},
  {x: M0.x - 38, y: M0.y - 196},
];

// (after stamp 1 the bead runs on through burst stamp 4, which sits right below it on the right)
const M3 = mishPoint(4);
const E0 = T.erase[0];
const E1 = T.erase[1];
const E3 = T.erase[4];
const beadKeys: {f: number; x: number; y: number; r: number}[] = [
  {f: T.dropLand[1] + 4, x: M0.x + 1, y: M0.y - 200, r: BEAD_R * 0.97}, // merged, gathering
  {f: E0, x: M0.x + 1, y: M0.y - 186, r: BEAD_R}, // breaks free
  {f: E0 + 6, x: M0.x + 3, y: M0.y - 112, r: BEAD_R * 0.98},
  {f: E0 + 12, x: M0.x + 5, y: M0.y + 2, r: BEAD_R * 0.93},
  {f: E0 + 18, x: M0.x + 8, y: M0.y + 140, r: BEAD_R * 0.84},
  {f: E1 - 5, x: M1.x - 4, y: M1.y - 150, r: BEAD_R * 0.76}, // clings under stamp 0 for a moment
  {f: E1, x: M1.x - 1, y: M1.y - 20, r: BEAD_R * 0.72},
  {f: E1 + 4, x: M1.x + 4, y: M1.y + 66, r: BEAD_R * 0.66},
  {f: E3 - 3, x: M3.x - 6, y: M3.y - 92, r: BEAD_R * 0.6},
  {f: E3, x: M3.x - 2, y: M3.y - 10, r: BEAD_R * 0.58},
  {f: E3 + 4, x: M3.x, y: M3.y + 70, r: BEAD_R * 0.55},
  {f: E3 + 22, x: M3.x + 4, y: 2080, r: BEAD_R * 0.5}, // runs off the bottom of the glass
];
const bx = monotone(beadKeys.map((k) => k.f), beadKeys.map((k) => k.x));
const by = monotone(beadKeys.map((k) => k.f), beadKeys.map((k) => k.y));
const br = monotone(beadKeys.map((k) => k.f), beadKeys.map((k) => k.r));
export const BEAD_FROM = beadKeys[0].f;
export const beadAt = (f: number) => ({x: bx(f), y: by(f), r: br(f)});

// ---------------------------------------------------------------- domino splats
// The bead washes stamps 0, 1 and 4 (they sit in its path). Every other stamp gets a cream splat thrown
// onto its «مش» (impact one frame before T.erase[i]), which slides down, dragging the ink with it.
export const BEAD_IDX = [0, 1, 4];
export const SPLAT_IDX = [2, 3, 5, 6, 7, 8];
export const splatR = (i: number) => Math.max(34, 0.5 * stampMetrics.wm * STAMPS[i].s + 6);
export const splatImpact = (i: number) => T.erase[i] - 1;
export const splatAt = (i: number, f: number) => {
  const p = mishPoint(i);
  const r = splatR(i);
  const k = f - splatImpact(i);
  // lands a touch above the word's centre, sits for a beat, then slides down, easing out
  const slide = k <= 1 ? 0 : 1 - Math.exp(-(k - 1) / 5);
  const dist = r * 1.7 + 30 * STAMPS[i].s;
  return {x: p.x + slide * 4, y: p.y - r * 0.55 + slide * dist, r: r * (1 - 0.22 * slide)};
};

// First frame the carrier of stamp i exists (the bead appears whole, a splat on impact).
export const carrierStart = (i: number) => (BEAD_IDX.includes(i) ? BEAD_FROM : splatImpact(i));

// The carrier (bead or splat) that washes stamp i, in design space, or null before it exists.
export const carrierAt = (i: number, f: number) => {
  if (BEAD_IDX.includes(i)) return f >= BEAD_FROM ? beadAt(f) : null;
  return f >= splatImpact(i) ? splatAt(i, f) : null;
};
