// Drawing helpers for the «ضيوف فجأة» spot (pure geometry, no React). Everything is in art units (≈ px at scale 1).
import {catmull, Pt, rng} from '../../kit/lib';

export const mir = (p: Pt[]): Pt[] => p.map(([x, y]) => [-x, y] as Pt);
/** A symmetric closed shape from its RIGHT half (top centre → down the right side → bottom centre). */
export const sym = (half: Pt[]): Pt[] => [...half, ...mir(half).reverse().slice(1, -1)];
export const tr = (p: Pt[], dx: number, dy: number, s = 1, sy = s): Pt[] => p.map(([x, y]) => [dx + x * s, dy + y * sy] as Pt);
export const rot = (p: Pt[], deg: number, cx = 0, cy = 0): Pt[] => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return p.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as Pt);
};
export const shrink = (pts: Pt[], k: number, dx = 0, dy = 0): Pt[] => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy] as Pt);
};

/** A tapered tube (limb, sleeve, finger) along a curve, with round caps → closed outline points. */
export const tube = (ctrl: Pt[], w0: number, w1: number, capStart = true, capEnd = true, seg = 8): Pt[] => {
  const line = ctrl.length >= 3 ? catmull(ctrl, false, seg) : ctrl.slice();
  const n = line.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const T: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    T.push([tx, ty]);
    const w = (w0 + ((w1 - w0) * i) / Math.max(1, n - 1)) / 2;
    L.push([line[i][0] - ty * w, line[i][1] + tx * w]);
    R.push([line[i][0] + ty * w, line[i][1] - tx * w]);
  }
  const cap = (c: Pt, t: Pt, w: number, end: boolean): Pt[] => {
    const out: Pt[] = [];
    const nx = -t[1];
    const ny = t[0];
    for (let k = 1; k < 8; k++) {
      const th = (k / 8) * Math.PI;
      if (end) out.push([c[0] + w * (nx * Math.cos(th) + t[0] * Math.sin(th)), c[1] + w * (ny * Math.cos(th) + t[1] * Math.sin(th))]);
      else out.push([c[0] + w * (-nx * Math.cos(th) - t[0] * Math.sin(th)), c[1] + w * (-ny * Math.cos(th) - t[1] * Math.sin(th))]);
    }
    return out;
  };
  return [
    ...L,
    ...(capEnd ? cap(line[n - 1], T[n - 1], w1 / 2, true) : []),
    ...R.reverse(),
    ...(capStart ? cap(line[0], T[0], w0 / 2, false) : []),
  ];
};

/** A stadium (finger) from a base point, pointing at `deg` (0 = up), length and width. */
export const capsule = (x: number, y: number, deg: number, len: number, w: number, w1 = w): Pt[] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return tube([[x, y], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5], [x + Math.cos(a) * len, y + Math.sin(a) * len]], w, w1, true, true, 4);
};

/** A heart (point down), centred at (x, y), half-width r. */
export const heartPts = (x: number, y: number, r: number, n = 40): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    out.push([x + (hx / 16) * r, y + (hy / 16) * r + r * 0.1]);
  }
  return out;
};

/** Seeded scatter of points inside a box (for fabric patterns, freckles, crumbs). */
export const scatter = (n: number, seed: number, box: [number, number, number, number]): Pt[] => {
  const r = rng(seed);
  return Array.from({length: n}, () => [box[0] + r() * box[2], box[1] + r() * box[3]] as Pt);
};

export const dotD = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
