// Geometry for hand-drawn 2D: seeded randomness, smooth curves, wobbly shapes and — the key piece — brush():
// a VARIABLE-WEIGHT ink stroke built as a filled outline (tapered ends, calligraphic nib, heavier on the shadow
// side, slight pressure jitter). All pure + deterministic (no DOM), so it can be memoised and runs anywhere.

export type Pt = [number, number];

// ---------------------------------------------------------------- randomness
/** mulberry32 — tiny deterministic PRNG. */
export const rng = (seed: number) => {
  let a = (Math.floor(seed) | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const lattice = (i: number, seed: number) => {
  let h = Math.imul(i ^ Math.imul(seed, 0x27d4eb2d), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1;
};
/** Smooth 1-D value noise in [-1, 1]. */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lattice(i, seed) * (1 - u) + lattice(i + 1, seed) * u;
};
/** Two octaves of noise1. */
export const fbm1 = (x: number, seed = 0) => 0.7 * noise1(x, seed) + 0.3 * noise1(x * 2.3 + 17.1, seed + 9);

// ---------------------------------------------------------------- curves
/** Centripetal-ish Catmull-Rom through control points → dense polyline. */
export const catmull = (pts: Pt[], closed = false, seg = 10): Pt[] => {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const get = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
};

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
/** Polyline → path through midpoints with quadratic joins (smooth, compact). */
export const smoothD = (pts: Pt[], closed = false) => {
  const n = pts.length;
  if (n < 2) return '';
  if (n < 3) return `M${f1(pts[0][0])} ${f1(pts[0][1])}L${f1(pts[1][0])} ${f1(pts[1][1])}`;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d: string;
  if (closed) {
    const m0 = mid(pts[n - 1], pts[0]);
    d = `M${f1(m0[0])} ${f1(m0[1])}`;
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`;
    }
    return d + 'Z';
  }
  d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 1; i < n - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(m[0])} ${f1(m[1])}`;
  }
  d += `L${f1(pts[n - 1][0])} ${f1(pts[n - 1][1])}`;
  return d;
};
/** Straight polyline path. */
export const polyD = (pts: Pt[], closed = false) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join('') + (closed ? 'Z' : '');

/** Closed smooth shape through control points. */
export const shapeD = (ctrl: Pt[], seg = 8) => smoothD(catmull(ctrl, true, seg), true);
/** Open smooth curve through control points. */
export const curveD = (ctrl: Pt[], seg = 10) => smoothD(catmull(ctrl, false, seg), false);

// ---------------------------------------------------------------- shapes
export const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 64, a0 = 0, a1 = Math.PI * 2, rot = 0): Pt[] => {
  const out: Pt[] = [];
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const cnt = full ? n : n + 1;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < cnt; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
};

/** Point-in-polygon (even-odd). */
export const pointInPoly = (pts: Pt[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Visible outline of a stack of closed shapes drawn back → front: the union silhouette (star-shaped around `c`) and the
 * crease runs (parts of a shape's outline that lie over shapes behind it and are not covered by shapes in front). */
export const stackOutline = (shapes: Pt[][], c: Pt, step = 3) => {
  const dense = shapes.map((s) => resample(s, step, true));
  const sil: Pt[] = [];
  const creases: Pt[][] = [];
  dense.forEach((pts, i) => {
    const flags = pts.map(([x, y]) => {
      const covered = shapes.some((s, j) => j > i && pointInPoly(s, x, y));
      const inOther = shapes.some((s, j) => j !== i && pointInPoly(s, x, y));
      if (!inOther) sil.push([x, y]);
      return !covered && inOther;
    });
    // contiguous runs (with wrap-around)
    const n = pts.length;
    const startIdx = flags.findIndex((f) => !f);
    if (startIdx < 0) return;
    let run: Pt[] = [];
    for (let k = 1; k <= n; k++) {
      const idx = (startIdx + k) % n;
      if (flags[idx]) run.push(pts[idx]);
      else if (run.length) {
        creases.push(run);
        run = [];
      }
    }
    if (run.length) creases.push(run);
  });
  sil.sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
  return {silhouette: sil, creases: creases.filter((r) => r.length >= 5)};
};

/** A hand-drawn blob: an ellipse whose radius wobbles with smooth noise (amp = fraction of radius). */
export const blobPts = (cx: number, cy: number, rx: number, ry: number, amp = 0.06, seed = 1, n = 48, lobes = 3, rot = 0): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * (0.65 * noise1((a / (Math.PI * 2)) * lobes * 2 + 0.31, seed) + 0.35 * noise1((a / (Math.PI * 2)) * lobes * 5 + 3.7, seed + 3));
    // make the noise periodic: blend with the value at a - 2π
    const k2 = 1 + amp * (0.65 * noise1((a / (Math.PI * 2) - 1) * lobes * 2 + 0.31, seed) + 0.35 * noise1((a / (Math.PI * 2) - 1) * lobes * 5 + 3.7, seed + 3));
    const w = i / n;
    const kk = k * (1 - w) + k2 * w;
    const x = rx * kk * Math.cos(a);
    const y = ry * kk * Math.sin(a);
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
};

/** Rounded polygon (corner radius r) as control points for a smooth closed shape. */
export const roundedPoly = (pts: Pt[], r: number, perCorner = 4): Pt[] => {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const d0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(r, d0 / 2, d2 / 2);
    const a: Pt = [p1[0] + ((p0[0] - p1[0]) / d0) * rr, p1[1] + ((p0[1] - p1[1]) / d0) * rr];
    const b: Pt = [p1[0] + ((p2[0] - p1[0]) / d2) * rr, p1[1] + ((p2[1] - p1[1]) / d2) * rr];
    for (let k = 0; k <= perCorner; k++) {
      const t = k / perCorner;
      // quadratic bezier a → p1 → b
      out.push([
        (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0],
        (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1],
      ]);
    }
  }
  return out;
};

export const transformPts = (pts: Pt[], tx: number, ty: number, rot = 0, sx = 1, sy = sx): Pt[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return pts.map(([x, y]) => [tx + x * sx * c - y * sy * s, ty + x * sx * s + y * sy * c]);
};

export const signedArea = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

/** Resample a polyline at a fixed arc-length step. */
export const resample = (pts: Pt[], step: number, closed: boolean): Pt[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Pt[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = step - carry;
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
      t += step;
    }
    carry = L - (t - step);
  }
  if (!closed) {
    const last = src[src.length - 1];
    const prev = out[out.length - 1];
    if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > step * 0.3) out.push(last);
    else out[out.length - 1] = last;
  } else if (out.length > 1) {
    const first = out[0];
    const lastP = out[out.length - 1];
    if (Math.hypot(first[0] - lastP[0], first[1] - lastP[1]) < step * 0.5) out.pop();
  }
  return out;
};

// ---------------------------------------------------------------- the brush
export type BrushOpts = {
  /** nominal width (art units) */
  w: number;
  closed?: boolean;
  /** control points are already a dense polyline (skip Catmull-Rom) */
  dense?: boolean;
  /** taper lengths as fractions of the stroke (open strokes), default [0.18, 0.22] */
  taper?: [number, number];
  /** minimum width at the tips as a fraction of w */
  tip?: number;
  /** calligraphic nib: angle (rad) and amount 0..1 (0 = round pen) */
  nibAngle?: number;
  nib?: number;
  /** light direction: the side facing AWAY from it gets heavier (closed shapes) — unit vector, amount */
  shadowDir?: Pt;
  shadow?: number;
  /** pressure wobble amount (fraction of w) and seed */
  jitter?: number;
  /** wavelength of the pressure wobble in art units (default 70) */
  jitterLen?: number;
  seed?: number;
  /** closed strokes: start point (0..1 around), overshoot past the start (fraction) */
  start?: number;
  overshoot?: number;
  /** resample step in art units (smaller = smoother, heavier) */
  step?: number;
};

/**
 * Variable-weight ink stroke as a FILLED path (fill it with the ink colour, no stroke).
 * Open strokes taper at both ends; closed strokes start at `start`, run once round plus a small overshoot, with a
 * pen-lift taper at the joint (the hand-inked tell). Heavier on the side facing away from the light.
 */
export const brush = (ctrl: Pt[], o: BrushOpts): string => {
  const closed = !!o.closed;
  const w = o.w;
  const seed = o.seed ?? 7;
  const step = o.step ?? Math.max(1.6, Math.min(5, w * 0.6));
  let line = o.dense ? ctrl.slice() : catmull(ctrl, closed, 12);
  line = resample(line, step, closed);
  if (line.length < 2) return '';
  const orient = closed ? Math.sign(signedArea(line)) || 1 : 1;

  if (closed) {
    const n = line.length;
    const s0 = Math.floor((((o.start ?? 0.12) % 1) + 1) % 1 * n);
    const extra = Math.max(2, Math.round((o.overshoot ?? 0.035) * n));
    const rot: Pt[] = [];
    for (let i = 0; i <= n + extra; i++) rot.push(line[(s0 + i) % n]);
    line = rot;
  }
  const n = line.length;
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const L = cum[n - 1] || 1;
  const [ta, tb] = o.taper ?? (closed ? [0.03, 0.05] : [0.18, 0.22]);
  const tip = o.tip ?? (closed ? 0.25 : 0.06);
  const nib = o.nib ?? 0.35;
  const nibA = o.nibAngle ?? -Math.PI / 4;
  const sd = o.shadowDir ?? [0.6, 0.8];
  const shadow = o.shadow ?? (closed ? 0.55 : 0);
  const jitter = o.jitter ?? 0.14;

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // outward normal for closed shapes (orientation-corrected); arbitrary side for open strokes
    const nx = -ty * orient;
    const ny = tx * orient;
    const t = cum[i] / L;
    const ramp = (x: number, len: number) => (len <= 0 ? 1 : Math.min(1, Math.max(0, x / len)) ** 0.65);
    const taper = tip + (1 - tip) * Math.min(ramp(t, ta), ramp(1 - t, tb));
    const ang = Math.atan2(ty, tx);
    const nibF = 1 - nib + nib * Math.abs(Math.sin(ang - nibA));
    const shadeF = 1 + shadow * (nx * sd[0] + ny * sd[1]) * (closed ? 1 : 0);
    const jit = 1 + jitter * fbm1(cum[i] / (o.jitterLen ?? 70), seed);
    const hw = (w / 2) * taper * nibF * Math.max(0.35, shadeF) * jit;
    // heavier side: push the outline outward on the shadow side (the line grows outside the shape)
    const off = closed ? hw * 0.25 * Math.max(0, shadeF - 1) : 0;
    left.push([line[i][0] + nx * (hw + off), line[i][1] + ny * (hw + off)]);
    right.push([line[i][0] - nx * (hw - off), line[i][1] - ny * (hw - off)]);
  }
  const outline = [...left, ...right.reverse()];
  return smoothD(outline, true);
};

/** Convenience: brush around a closed shape given its control points. */
export const inkAround = (ctrl: Pt[], w: number, extra: Partial<BrushOpts> = {}) => brush(ctrl, {w, closed: true, ...extra});
/** Convenience: brush along an open curve. */
export const inkAlong = (ctrl: Pt[], w: number, extra: Partial<BrushOpts> = {}) => brush(ctrl, {w, closed: false, ...extra});
