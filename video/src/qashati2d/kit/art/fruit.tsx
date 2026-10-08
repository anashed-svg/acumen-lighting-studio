// Hand-inked fruit for the 2D series. Every piece: cel-shaded (a darker crescent on the shadow side, never a smooth
// gradient), juicy drawn highlights (a tapered white gloss stroke + glints), and a variable-weight teal ink outline.
// Pieces are drawn around (0,0) at nominal size `s` (art units). Geometry is cached per (kind, s, seed).
//
//   <g transform="translate(x y) rotate(r)"><FruitPiece kind="strawberryCut" s={80} seed={3}/></g>
import React from 'react';
import {blobPts, brush, catmull, ellipsePts, noise1, polyD, Pt, rng, roundedPoly, shapeD, smoothD, transformPts} from '../geom';
import {C, INK} from '../palette';

export type FruitKind = 'strawberryCut' | 'strawberry' | 'kiwi' | 'kiwiHalf' | 'mango' | 'chiliPepper' | 'chiliFlake';

type Geo = {layers: {d: string; fill: string; opacity?: number}[]};
const cache = new Map<string, Geo>();

const sc = (pts: Pt[], s: number, ox = 0, oy = 0): Pt[] => pts.map(([x, y]) => [ox + x * s, oy + y * s]);
const shrinkShift = (pts: Pt[], k: number, dx: number, dy: number): Pt[] => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy]);
};
/** A tapered gloss stroke (white) along control points. */
const gloss = (pts: Pt[], w: number, seed: number) => brush(pts, {w, taper: [0.35, 0.45], tip: 0.05, nib: 0.2, jitter: 0.1, seed});
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

// ------------------------------------------------------------------------------------------------ strawberry (cut)
const strawberryCut = (s: number, seed: number): Geo => {
  const base: Pt[] = [
    [0, -0.46], [0.24, -0.5], [0.46, -0.36], [0.5, -0.06], [0.36, 0.26], [0.12, 0.5], [0, 0.54], [-0.12, 0.5],
    [-0.36, 0.26], [-0.5, -0.06], [-0.46, -0.36], [-0.24, -0.5],
  ];
  const r = rng(seed);
  const outline = sc(base.map(([x, y]) => [x * (1 + (r() - 0.5) * 0.08), y * (1 + (r() - 0.5) * 0.06)] as Pt), s);
  const dense = catmull(outline, true, 8);
  const shade = shrinkShift(dense, 1, 0, 0);
  const lit = shrinkShift(dense, 0.88, -0.035 * s, -0.04 * s);
  const mid = shrinkShift(dense, 0.64, -0.01 * s, -0.035 * s);
  const core = blobPts(-0.01 * s, -0.06 * s, 0.17 * s, 0.27 * s, 0.12, seed + 4, 28, 2);
  const layers: Geo['layers'] = [
    {d: smoothD(shade, true), fill: C.strawberryDeep},
    {d: smoothD(lit, true), fill: C.strawberry},
    {d: smoothD(mid, true), fill: C.strawberryMid},
    {d: shapeD(core), fill: C.strawberryCore},
  ];
  // vascular streaks from the core out to the flesh
  let streaks = '';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + ((i - 4) / 4.5) * Math.PI * 0.95 + (r() - 0.5) * 0.25;
    const r0 = 0.18 * s;
    const r1 = (0.36 + r() * 0.06) * s;
    const c: Pt = [-0.01 * s, -0.04 * s];
    const bend = (r() - 0.5) * 0.25;
    streaks += brush(
      [
        [c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0 * 1.35],
        [c[0] + Math.cos(a + bend) * (r0 + r1) / 2, c[1] + Math.sin(a + bend) * ((r0 + r1) / 2) * 1.2],
        [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1 * 1.15],
      ],
      {w: 0.045 * s, taper: [0.2, 0.6], tip: 0.1, jitter: 0.2, seed: seed + i},
    );
  }
  layers.push({d: streaks, fill: C.strawberryCore, opacity: 0.85});
  // seeds on the rim (cut-through seeds show as tiny pale dots at the edge)
  let seeds = '';
  for (let i = 0; i < 9; i++) {
    const p = dense[Math.floor((i / 9 + r() * 0.05) * dense.length) % dense.length];
    seeds += dot(p[0] * 0.9, p[1] * 0.9, 0.022 * s);
  }
  layers.push({d: seeds, fill: '#FFE7A6'});
  // gloss
  layers.push({d: gloss([[-0.36 * s, -0.12 * s], [-0.3 * s, -0.32 * s], [-0.12 * s, -0.42 * s]], 0.085 * s, seed + 30), fill: C.white, opacity: 0.92});
  layers.push({d: dot(0.2 * s, -0.36 * s, 0.035 * s) + dot(0.28 * s, -0.3 * s, 0.018 * s), fill: C.white, opacity: 0.95});
  layers.push({d: brush(outline, {w: 0.06 * s, closed: true, seed, start: 0.3}), fill: INK});
  return {layers};
};

// ------------------------------------------------------------------------------------------------ strawberry (whole, garnish)
const strawberryWhole = (s: number, seed: number): Geo => {
  const base: Pt[] = [
    [0, -0.36], [0.3, -0.44], [0.5, -0.24], [0.46, 0.08], [0.28, 0.36], [0.06, 0.56], [-0.08, 0.54], [-0.32, 0.32],
    [-0.5, 0.02], [-0.48, -0.28], [-0.26, -0.44],
  ];
  const r = rng(seed);
  const outline = sc(base, s);
  const dense = catmull(outline, true, 8);
  const layers: Geo['layers'] = [
    {d: smoothD(dense, true), fill: C.strawberryDeep},
    {d: smoothD(shrinkShift(dense, 0.86, -0.05 * s, -0.04 * s), true), fill: C.strawberry},
  ];
  // seed pits: small yellow tear drops in a loose diamond grid, each with a darker pit
  let pits = '';
  let seedsD = '';
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 4; j++) {
      const x = (i * 0.14 + (j % 2) * 0.07 + (r() - 0.5) * 0.03) * s;
      const y = (j * 0.12 - 0.05 + (r() - 0.5) * 0.03) * s;
      const inside = Math.abs(x / s) < 0.42 - Math.max(0, y / s) * 0.55 && y / s > -0.36 && y / s < 0.45;
      if (!inside) continue;
      pits += dot(x, y, 0.03 * s);
      seedsD += `M${x} ${y - 0.025 * s}q${0.018 * s} ${0.02 * s} 0 ${0.045 * s}q${-0.018 * s} ${-0.02 * s} 0 ${-0.045 * s}Z`;
    }
  layers.push({d: pits, fill: C.strawberryDeep, opacity: 0.75});
  layers.push({d: seedsD, fill: '#FFE07A'});
  // calyx
  let calyx = '';
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k / 4) * Math.PI;
    const tip: Pt = [Math.cos(a) * 0.36 * s, -0.42 * s + Math.sin(a) * 0.14 * s - 0.04 * s];
    calyx += shapeD([[-0.05 * s, -0.42 * s], [tip[0] * 0.6, tip[1] - 0.04 * s], tip, [tip[0] * 0.5 + 0.03 * s, tip[1] + 0.03 * s], [0.05 * s, -0.4 * s]]);
  }
  layers.push({d: calyx, fill: C.kiwiDeep});
  layers.push({d: shapeD([[-0.03 * s, -0.42 * s], [-0.02 * s, -0.6 * s], [0.03 * s, -0.62 * s], [0.03 * s, -0.42 * s]]), fill: C.kiwiDeep});
  layers.push({d: gloss([[-0.38 * s, 0.0], [-0.34 * s, -0.22 * s], [-0.18 * s, -0.33 * s]], 0.09 * s, seed + 31), fill: C.white, opacity: 0.9});
  layers.push({d: dot(-0.12 * s, 0.12 * s, 0.03 * s), fill: C.white, opacity: 0.9});
  layers.push({d: brush(outline, {w: 0.065 * s, closed: true, seed, start: 0.2}), fill: INK});
  layers.push({d: brush([[-0.3 * s, -0.42 * s], [0, -0.45 * s], [0.3 * s, -0.42 * s]], {w: 0.035 * s, seed: seed + 2}), fill: INK});
  return {layers};
};

// ------------------------------------------------------------------------------------------------ kiwi slice
const kiwi = (s: number, seed: number, half = false): Geo => {
  const r = rng(seed);
  const rx = 0.5 * s;
  const ry = 0.46 * s;
  const a0 = half ? Math.PI : 0;
  const a1 = half ? Math.PI * 2 : Math.PI * 2;
  const out = half
    ? [...ellipsePts(0, 0, rx, ry, 40, a0, a1), [rx * 0.98, 0.04 * s] as Pt, [-rx * 0.98, 0.04 * s] as Pt]
    : blobPts(0, 0, rx, ry, 0.03, seed, 48, 3);
  const clipHalf = (pts: Pt[]) => (half ? pts.map(([x, y]) => [x, Math.min(y, 0.02 * s)] as Pt) : pts);
  const layers: Geo['layers'] = [
    {d: smoothD(out, true), fill: C.kiwiSkin},
    {d: smoothD(clipHalf(shrinkShift(out, 0.93, 0, 0)), true), fill: C.kiwiDeep},
    {d: smoothD(clipHalf(shrinkShift(out, 0.86, -0.03 * s, -0.03 * s)), true), fill: C.kiwi},
  ];
  // light rays
  let rays = '';
  const nr = 22;
  for (let i = 0; i < nr; i++) {
    const a = half ? Math.PI + ((i + 0.5) / nr) * Math.PI : (i / nr) * Math.PI * 2 + r() * 0.1;
    if (half && (a < Math.PI + 0.08 || a > Math.PI * 2 - 0.08)) continue;
    const r0 = 0.2;
    const r1 = 0.36 + r() * 0.06;
    rays += brush(
      [
        [Math.cos(a) * r0 * s, Math.sin(a) * r0 * s * 0.92],
        [Math.cos(a) * r1 * s, Math.sin(a) * r1 * s * 0.92],
      ],
      {w: 0.05 * s, taper: [0.1, 0.7], tip: 0.1, seed: seed + i, jitter: 0.2},
    );
  }
  layers.push({d: rays, fill: C.kiwiLight, opacity: 0.85});
  // core
  const core = half ? ellipsePts(0, 0.02 * s, 0.17 * s, 0.11 * s, 20, Math.PI, Math.PI * 2) : blobPts(0, 0, 0.16 * s, 0.12 * s, 0.1, seed + 3, 24, 2);
  layers.push({d: half ? smoothD([...core, [0.17 * s, 0.02 * s]], true) : shapeD(core), fill: C.kiwiCore});
  // seed ring
  let seeds = '';
  const ns = half ? 11 : 20;
  for (let i = 0; i < ns; i++) {
    const a = half ? Math.PI + ((i + 0.5) / ns) * Math.PI : (i / ns) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const rr = (0.24 + (r() - 0.5) * 0.03) * s;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr * 0.9;
    const L = 0.05 * s;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    seeds += `M${x - ux * L} ${y - uy * L}Q${x - uy * L * 0.6} ${y + ux * L * 0.6} ${x + ux * L} ${y + uy * L}Q${x + uy * L * 0.6} ${y - ux * L * 0.6} ${x - ux * L} ${y - uy * L}Z`;
  }
  layers.push({d: seeds, fill: C.seed});
  layers.push({d: gloss([[-0.32 * s, -0.12 * s], [-0.26 * s, -0.28 * s], [-0.1 * s, -0.36 * s]], 0.07 * s, seed + 40), fill: C.white, opacity: 0.85});
  layers.push({d: dot(0.22 * s, -0.24 * s, 0.025 * s), fill: C.white, opacity: 0.9});
  layers.push({d: brush(out, {w: 0.05 * s, closed: true, seed, start: 0.6}), fill: INK});
  return {layers};
};

// ------------------------------------------------------------------------------------------------ mango cube
const mango = (s: number, seed: number): Geo => {
  const r = rng(seed);
  const j = (v: number) => v + (r() - 0.5) * 0.06;
  const front: Pt[] = [[j(-0.42), j(-0.22)], [j(0.3), j(-0.24)], [j(0.33), j(0.44)], [j(-0.4), j(0.42)]];
  const top: Pt[] = [front[0], [j(-0.2), j(-0.46)], [j(0.5), j(-0.46)], front[1]];
  const side: Pt[] = [front[1], top[2], [j(0.5), j(0.22)], front[2]];
  const R = 0.12 * s;
  const fr = roundedPoly(sc(front, s), R, 4);
  const tp = roundedPoly(sc(top, s), R * 0.7, 3);
  const sd = roundedPoly(sc(side, s), R * 0.7, 3);
  const all = roundedPoly(sc([front[0], top[1], top[2], side[2], front[2], front[3]], s), R, 4);
  const layers: Geo['layers'] = [
    {d: shapeD(all, 3), fill: C.mangoDeep},
    {d: shapeD(fr, 3), fill: C.mango},
    {d: shapeD(tp, 3), fill: C.mangoLight},
    {d: shapeD(sd, 3), fill: C.mangoDeep},
  ];
  // fibres
  let fib = '';
  for (let i = 0; i < 3; i++) {
    const y = (-0.1 + i * 0.16 + (r() - 0.5) * 0.05) * s;
    fib += brush([[-0.3 * s, y], [0, y + 0.03 * s], [0.22 * s, y - 0.01 * s]], {w: 0.025 * s, taper: [0.3, 0.3], seed: seed + i});
  }
  layers.push({d: fib, fill: C.mangoDeep, opacity: 0.45});
  // juicy gloss
  layers.push({d: gloss([[-0.3 * s, -0.3 * s], [0.0, -0.38 * s], [0.28 * s, -0.38 * s]], 0.08 * s, seed + 41), fill: C.white, opacity: 0.9});
  layers.push({d: gloss([[-0.32 * s, 0.25 * s], [-0.33 * s, 0.0], [-0.28 * s, -0.12 * s]], 0.06 * s, seed + 42), fill: C.white, opacity: 0.7});
  layers.push({d: dot(0.18 * s, 0.05 * s, 0.03 * s), fill: C.white, opacity: 0.85});
  layers.push({d: brush(all, {w: 0.06 * s, closed: true, seed, start: 0.1}), fill: INK});
  layers.push({d: brush(sc([front[0], front[1], front[2]], s), {w: 0.03 * s, seed: seed + 5, taper: [0.15, 0.3]}), fill: INK, opacity: 0.8});
  return {layers};
};

// ------------------------------------------------------------------------------------------------ chili pepper (garnish)
const chiliPepper = (s: number, seed: number): Geo => {
  const spine: Pt[] = [[-0.5, -0.1], [-0.2, -0.16], [0.15, -0.05], [0.38, 0.15], [0.5, 0.42]];
  const r = rng(seed);
  const widths = [0.17, 0.16, 0.13, 0.08, 0.01];
  const dense = catmull(sc(spine, s), false, 10);
  const L = dense.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < L; i++) {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(L - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    const u = i / (L - 1);
    const k = Math.min(widths.length - 2, Math.floor(u * (widths.length - 1)));
    const f = u * (widths.length - 1) - k;
    const w = (widths[k] * (1 - f) + widths[k + 1] * f) * s * (1 + 0.05 * noise1(u * 5, seed));
    left.push([dense[i][0] - (ty / tl) * w, dense[i][1] + (tx / tl) * w]);
    right.push([dense[i][0] + (ty / tl) * w, dense[i][1] - (tx / tl) * w]);
  }
  const body = [...left, ...right.reverse()];
  void r;
  const layers: Geo['layers'] = [
    {d: smoothD(body, true), fill: C.chiliDeep},
    {d: smoothD(shrinkShift(body, 0.84, -0.01 * s, -0.04 * s), true), fill: C.chili},
    {d: shapeD(sc([[-0.62, -0.12], [-0.5, -0.24], [-0.4, -0.2], [-0.42, -0.04], [-0.55, 0.0]], s)), fill: C.kiwiDeep},
    {d: brush(sc([[-0.6, -0.16], [-0.72, -0.28], [-0.76, -0.4]], s), {w: 0.06 * s, taper: [0.05, 0.5]}), fill: C.kiwiDeep},
    {d: gloss(sc([[-0.3, -0.2], [0.0, -0.17], [0.25, -0.04]], s), 0.06 * s, seed + 50), fill: C.white, opacity: 0.9},
    {d: dot(0.36 * s, 0.12 * s, 0.025 * s), fill: C.white, opacity: 0.9},
    {d: brush(body, {w: 0.05 * s, closed: true, seed, start: 0.2}), fill: INK},
  ];
  return {layers};
};

const chiliFlake = (s: number, seed: number): Geo => {
  const pts = blobPts(0, 0, 0.5 * s, 0.32 * s, 0.35, seed, 10, 2, rng(seed)() * 3);
  return {layers: [{d: shapeD(pts, 4), fill: C.chiliDeep}, {d: shapeD(shrinkShift(pts, 0.55, -0.08 * s, -0.06 * s), 4), fill: C.chili}]};
};

const build = (kind: FruitKind, s: number, seed: number): Geo => {
  switch (kind) {
    case 'strawberryCut':
      return strawberryCut(s, seed);
    case 'strawberry':
      return strawberryWhole(s, seed);
    case 'kiwi':
      return kiwi(s, seed);
    case 'kiwiHalf':
      return kiwi(s, seed, true);
    case 'mango':
      return mango(s, seed);
    case 'chiliPepper':
      return chiliPepper(s, seed);
    case 'chiliFlake':
      return chiliFlake(s, seed);
  }
};

export const fruitGeo = (kind: FruitKind, s: number, seed: number) => {
  const k = `${kind}|${s.toFixed(2)}|${seed}`;
  let g = cache.get(k);
  if (!g) {
    g = build(kind, s, seed);
    cache.set(k, g);
  }
  return g;
};

export const FruitPiece: React.FC<{kind: FruitKind; s: number; seed?: number; transform?: string}> = ({kind, s, seed = 1, transform}) => {
  const g = fruitGeo(kind, s, seed);
  return (
    <g transform={transform}>
      {g.layers.map((l, i) => (
        <path key={i} d={l.d} fill={l.fill} opacity={l.opacity} />
      ))}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ pistachio crumbs
export type Crumb = {x: number; y: number; s: number; rot: number; tone: number; seed: number};
/** Scatter crumbs inside a predicate region (deterministic). */
export const scatterCrumbs = (n: number, seed: number, box: [number, number, number, number], inside: (x: number, y: number) => boolean, sMin = 5, sMax = 12): Crumb[] => {
  const r = rng(seed);
  const out: Crumb[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const x = box[0] + r() * box[2];
    const y = box[1] + r() * box[3];
    if (!inside(x, y)) continue;
    out.push({x, y, s: sMin + (sMax - sMin) * r() ** 1.5, rot: r() * Math.PI, tone: r(), seed: Math.floor(r() * 1e6)});
  }
  return out;
};
const crumbCache = new Map<string, {d: string; facet: string}>();
const crumbGeo = (c: Crumb) => {
  const k = `${c.seed}|${c.s.toFixed(1)}`;
  let g = crumbCache.get(k);
  if (!g) {
    // chopped-nut shards: irregular (random facet angles and depths — never a regular gem), a light broken facet
    const r = rng(c.seed);
    const n = 4 + (c.seed % 3);
    const angs = Array.from({length: n}, (_, i) => ((i + 0.15 + r() * 0.7) / n) * Math.PI * 2).sort((a, b) => a - b);
    const ax = c.s * (0.42 + r() * 0.22);
    const ay = c.s * (0.26 + r() * 0.14);
    const pts: Pt[] = angs.map((a) => {
      const k = 0.62 + r() * 0.42;
      return [Math.cos(a) * ax * k, Math.sin(a) * ay * k] as Pt;
    });
    const fi = Math.floor(r() * n);
    const facetPts: Pt[] = [pts[fi], pts[(fi + 1) % n], [pts[fi][0] * 0.2 - c.s * 0.04, pts[fi][1] * 0.2 - c.s * 0.05]];
    g = {d: polyD(pts, true), facet: polyD(facetPts, true)};
    crumbCache.set(k, g);
  }
  return g;
};
/** Pistachio crumbs (greens with a few purple-skinned ones), or chili flakes with `palette="chili"`. */
export const Crumbs: React.FC<{crumbs: Crumb[]; palette?: 'pistachio' | 'chili'}> = ({crumbs, palette = 'pistachio'}) => (
  <g>
    {crumbs.map((c, i) => {
      const g = crumbGeo(c);
      const [fill, facet, edge] =
        palette === 'chili'
          ? c.tone < 0.75
            ? [C.chiliDeep, C.chili, '#5A0810']
            : ['#F6D27A', '#FFF0B8', '#B8862A'] // a chili seed
          : c.tone < 0.22
            ? [C.pistachioSkin, '#C27C8C', '#4A1E2B']
            : c.tone < 0.6
              ? [C.pistachio, C.pistachioLight, C.pistachioDeep]
              : [C.pistachioDeep, C.pistachio, '#2F4E12'];
      return (
        <g key={i} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${((c.rot * 180) / Math.PI).toFixed(0)})`}>
          <path d={g.d} fill={fill} stroke={edge} strokeWidth={Math.max(0.9, c.s * 0.12)} strokeLinejoin="round" />
          <path d={g.facet} fill={facet} opacity={0.9} />
        </g>
      );
    })}
  </g>
);


