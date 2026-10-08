// <HeroCup2D/> — THE product illustration of the 2D series: Qashati Alsham's clear tapered cup with the turquoise
// Q sticker, layered fruit (strawberry, mango, kiwi — cut faces pressed on the wall, juicy, glossy) and thick ivory
// qashta bands, a glossy heaped qashta dome (overlapping lobes, each cel-shaded with halftone and a drawn specular),
// a wide translucent honey drizzle that pools, and pistachio crumbs.
// Variant 'chili': the same cup filled with red-hot chili sauce (glossy, flakes, seeds, bubbles, chili-oil drizzle,
// a pepper on top) — flames-ready (CUP_ANCHORS.flames) and with optional heat wiggles.
//
// Art space: 600 × 1000 units; the cup's base contact point is (300, 930). Position it with x/y = where that base
// point lands in the parent (px) and `scale` (1 → the rim is ≈ 464 px wide).
// Everything that moves is a prop (pure function of props + frame for the boil):
//   honeyProgress 0..1 · spoon 'none'|'dipping'|'lifted' + spoonT 0..1 · squash · wobble · tilt · heat · glint
import React, {useId, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, catmull, ellipsePts, fbm1, noise1, pointInPoly, Pt, rng, shapeD, smoothD, stackOutline} from '../geom';
import {useBoil} from '../look/Boil';
import {Halftone, Tone} from '../look/Halftone';
import {C, INK} from '../palette';
import {Crumb, Crumbs, FruitKind, FruitPiece} from './fruit';
import {HONEY_COLORS, HoneyLayers, honeyPaths} from './Honey';
import {SpoonArt} from './Spoon2D';
import {Sticker} from './Sticker';

// ------------------------------------------------------------------------------------------------ cup geometry
export const CUP = {
  cx: 300,
  baseY: 930,
  rimY: 330,
  rimHW: 232,
  rimRY: 28,
  botY: 900,
  botHW: 172,
  botRY: 20,
  artW: 600,
  artH: 1000,
} as const;
const {cx: CX, rimY: RIM_Y, rimHW: RIM_HW, rimRY: RIM_RY, botY: BOT_Y, botHW: BOT_HW, botRY: BOT_RY} = CUP;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const cupHW = (y: number) => lerp(RIM_HW, BOT_HW, (y - RIM_Y) / (BOT_Y - RIM_Y));
const cupRY = (y: number) => lerp(RIM_RY, BOT_RY, (y - RIM_Y) / (BOT_Y - RIM_Y));

/** Named points in art units. Use cupPoint() to map them to parent px. */
export const CUP_ANCHORS = {
  base: [300, 930] as Pt,
  domeTop: [302, 96] as Pt,
  spoonEntry: [334, 198] as Pt,
  sticker: [300, 800] as Pt,
  rimLeft: [68, 330] as Pt,
  rimRight: [532, 330] as Pt,
  /** where flames / steam sit for the chili variant (left → right on the dome) */
  flames: [[164, 190], [302, 104], [438, 176]] as Pt[],
};
/** Map an art-space point to parent px for a cup drawn at (x, y, scale) (ignores squash/tilt). */
export const cupPoint = (p: Pt, x: number, y: number, scale = 1): Pt => [x + (p[0] - CUP.cx) * scale, y + (p[1] - CUP.baseY) * scale];

const backArc = (y0: number, extra = 0, n = 28): Pt[] => ellipsePts(CX, y0, cupHW(y0) + extra, cupRY(y0), n, 0, -Math.PI);

/** Outer body silhouette (rim back arc on top). */
const bodyPts = (): Pt[] => {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const y = lerp(RIM_Y, BOT_Y, i / 10);
    left.push([CX - cupHW(y), y]);
    right.push([CX + cupHW(y), y]);
  }
  const bottom = ellipsePts(CX, BOT_Y, BOT_HW, BOT_RY + 6, 30, Math.PI, 0);
  return [...left.slice(0, -1), ...bottom, ...right.slice(0, -1).reverse(), ...backArc(RIM_Y).slice(1, -1)];
};

/** A wavy band boundary across the cup at height y0 (front half of the ellipse, slightly irregular). */
const boundary = (y0: number, seed: number, amp = 7): Pt[] => {
  const out: Pt[] = [];
  const hw = cupHW(y0) + 40;
  const ry = cupRY(y0);
  for (let i = 0; i <= 30; i++) {
    const x = CX - hw + (2 * hw * i) / 30;
    const u = (x - CX) / (hw - 40);
    out.push([x, y0 + ry * 0.9 * Math.sqrt(Math.max(0, 1 - Math.min(1, u * u))) + amp * fbm1(x / 55, seed)]);
  }
  return out;
};
const bandShape = (top: Pt[], bottom: Pt[]): Pt[] => [...top, ...bottom.slice().reverse()];

// ------------------------------------------------------------------------------------------------ dome geometry
// The dome is a heap of overlapping lobes drawn back → front; each lobe has its own outline, so where a front lobe
// overlaps a back one, its outline becomes a crease (how illustrators draw whipped/clotted cream).
type Lobe = {cx: number; cy: number; rx: number; ry: number; seed: number};
const LOBES: Lobe[] = [
  {cx: 302, cy: 184, rx: 112, ry: 98, seed: 2}, // back / crown
  {cx: 300, cy: 108, rx: 50, ry: 36, seed: 6}, // the little peak on the crown
  {cx: 166, cy: 262, rx: 118, ry: 88, seed: 3}, // left
  {cx: 436, cy: 254, rx: 114, ry: 90, seed: 4}, // right
  {cx: 300, cy: 300, rx: 150, ry: 54, seed: 5}, // front ledge (low and wide: it reads as a fold, not a ball)
];
const DOME_BASE = {cx: 300, cy: 320, rx: 240, ry: 52};
/** y of the dome's bottom edge (on the rim front arc, plus two slumps over the lip). */
export const domeEdgeY = (x: number) => {
  const u = (x - CX) / 252;
  const y = RIM_Y + 2 + (RIM_RY + 1) * Math.sqrt(Math.max(0, 1 - u * u));
  return y + 13 * Math.exp(-(((x - 176) / 24) ** 2)) + 9 * Math.exp(-(((x - 452) / 18) ** 2));
};
const baseLobePts = (): Pt[] => {
  const top = ellipsePts(DOME_BASE.cx, DOME_BASE.cy, DOME_BASE.rx, DOME_BASE.ry, 36, Math.PI, Math.PI * 2);
  const bottom: Pt[] = [];
  for (let i = 1; i < 30; i++) {
    const x = CX + DOME_BASE.rx - (2 * DOME_BASE.rx * i) / 30;
    bottom.push([x, domeEdgeY(x)]);
  }
  return [...top, ...bottom];
};
const lobePts = (l: Lobe) => blobPts(l.cx, l.cy, l.rx, l.ry, 0.06, l.seed, 44, 2);


// honey: one drizzle — over the left lobe, the crown, the right lobe, back across the front lobe, a bead on the lip
const HONEY_CTRL: Pt[] = [
  [74, 300], [108, 246], [158, 206], [214, 214], [252, 172], [306, 136], [362, 152], [400, 196], [452, 184], [506, 210],
  [526, 256], [494, 294], [430, 292], [372, 266], [314, 258], [258, 280], [196, 302], [138, 322], [100, 344], [142, 362],
  [184, 360],
];
const HONEY_POOLS: {at: Pt; r: number}[] = [
  {at: [214, 214], r: 22},
  {at: [508, 226], r: 24},
  {at: [314, 258], r: 26},
  {at: [118, 336], r: 20},
];

// ------------------------------------------------------------------------------------------------ static art (cached)
type Piece = {kind: FruitKind; x: number; y: number; s: number; rot: number; seed: number};
type LobeArt = {d: string; lit: string; bounce: string; ink: string; hi: string; dots: string; curd: string; tone: Tone[]; box: [number, number, number, number]};
type StaticArt = {
  bodyInk: string;
  interior: string;
  bands: {d: string; fill: string}[];
  creamBands: string;
  bandEdges: string;
  pieces: Piece[];
  intruders: Piece[];
  creamTex: string;
  plastic: {haze: string; glossL: string; glossL2: string; glossR: string; base: string; baseLine: string};
  rimLip: string;
  rimInk: string;
  rimInner: string;
  domeUnion: string[];
  domeInk: string;
  domeCreases: string;
  domeOutline: Pt[];
  base: LobeArt;
  lobes: LobeArt[];
  honeyLine: Pt[];
  honeyLen: number[];
  honeyPools: {s: number; r: number}[];
  crumbs: Crumb[];
  bubbles: Pt[];
};
const artCache = new Map<string, StaticArt>();

const packFruit = (yTop: number, yBot: number, seed: number, chili: boolean): Piece[] => {
  const r = rng(seed);
  const out: Piece[] = [];
  const kinds: FruitKind[] = chili ? ['chiliFlake'] : ['strawberryCut', 'kiwi', 'mango'];
  let row = 0;
  for (let y = yBot - 26; y > yTop + 4; y -= chili ? 30 : 54) {
    const hw = cupHW(y);
    const step = chili ? 44 : 74;
    for (let x = CX - hw - 16 + (row % 2) * step * 0.5; x < CX + hw + 16; x += step) {
      const k = chili ? kinds[0] : kinds[(Math.floor(r() * 3) + row) % 3];
      out.push({
        kind: k,
        x: x + (r() - 0.5) * 18,
        y: y + (r() - 0.5) * 14,
        s: chili ? 14 + r() * 14 : 78 + r() * 22,
        rot: (r() - 0.5) * 70,
        seed: Math.floor(r() * 1e5),
      });
    }
    row++;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const dotD = (x: number, y: number, rr: number) => `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`;

const lobeArt = (pts: Pt[], l: {cx: number; cy: number; rx: number; ry: number; seed: number}, isBase = false): LobeArt => {
  const a0 = isBase ? 1.12 : 1.08;
  const hiArc = ellipsePts(l.cx, l.cy, l.rx * 0.8, l.ry * (isBase ? 0.55 : 0.76), 10, Math.PI * a0, Math.PI * (isBase ? 1.38 : 1.42));
  const hl = (p: number) => [l.cx + Math.cos(Math.PI * 1.32) * l.rx * p, l.cy + Math.sin(Math.PI * 1.32) * l.ry * p] as Pt;
  const r = rng(l.seed * 31);
  let curd = '';
  for (let i = 0; i < (isBase ? 4 : 3); i++) {
    const a = Math.PI * (0.05 + r() * 0.5) - (isBase ? Math.PI * 0.9 + r() * 1.2 : 0);
    const rr = 0.45 + r() * 0.35;
    const cx = l.cx + Math.cos(a) * l.rx * rr;
    const cy = l.cy + Math.sin(a) * l.ry * rr * (isBase ? 0.5 : 1);
    const L = 10 + r() * 10;
    curd += brush([[cx - L, cy], [cx, cy - 3 - r() * 3], [cx + L, cy - 1]], {w: 2.6, taper: [0.4, 0.4], seed: l.seed + i});
  }
  const [hx, hy] = hl(0.5);
  // cel shading: the lobe is filled with the shade tone, the lit part (the lobe nudged towards the light and a
  // touch smaller) in cream — a clean crescent of shade on the lower right, so the white speculars read on top
  const litPts = pts.map(([x, y]) => [l.cx + (x - l.cx) * 0.9 - l.rx * 0.1, l.cy + (y - l.cy) * (isBase ? 0.8 : 0.88) - l.ry * (isBase ? 0.22 : 0.14)] as Pt);
  return {
    d: smoothD(pts, true),
    lit: smoothD(litPts, true),
    // cool bounce light from the turquoise world on the shadow side (makes the cream read wet and glossy)
    bounce: brush(ellipsePts(l.cx + l.rx * 0.02, l.cy + l.ry * 0.02, l.rx * 0.84, l.ry * (isBase ? 0.6 : 0.82), 14, -Math.PI * 0.18, Math.PI * 0.5), {w: isBase ? 6 : 8, taper: [0.4, 0.4], tip: 0.05, dense: false, seed: l.seed + 11}),
    ink: brush(pts, {w: isBase ? 7.5 : 6.5, closed: true, dense: true, start: isBase ? 0.62 : 0.86, seed: l.seed, shadow: 0.65}),
    hi: brush(hiArc, {w: isBase ? 9 : 13, taper: [0.35, 0.45], tip: 0.04, nib: 0.15, dense: false, seed: l.seed + 7}),
    dots: dotD(hx + l.rx * 0.22, hy - l.ry * 0.12, isBase ? 2.6 : 4) + dotD(hx - l.rx * 0.05, hy + l.ry * 0.22, 2.4),
    curd,
    tone: isBase
      ? [{t: 'lin', x0: 300, y0: 300, x1: 300, y1: 366, a: 0, b: 0.8}, {t: 'lin', x0: 120, y0: 300, x1: 520, y1: 330, a: 0.5, b: 1}, {t: 'noise', amp: 0.3, freq: 0.04, seed: l.seed}]
      : [
          {t: 'rad', cx: l.cx - l.rx * 0.4, cy: l.cy - l.ry * 0.5, r0: l.rx * 0.95, r1: l.rx * 1.7, a: 0, b: 0.85, sx: 1, sy: l.ry / l.rx, pow: 1.2},
          {t: 'lin', x0: l.cx, y0: l.cy, x1: l.cx, y1: l.cy + l.ry, a: 0.55, b: 1},
          {t: 'noise', amp: 0.3, freq: 0.04, seed: l.seed},
        ],
    box: [l.cx - l.rx - 10, l.cy - l.ry - 10, 2 * l.rx + 20, 2 * l.ry + 20],
  };
};

const buildArt = (variant: 'qashta' | 'chili'): StaticArt => {
  const chili = variant === 'chili';
  const body = bodyPts();
  const inner = body.map(([x, y]) => [CX + (x - CX) * 0.985, y] as Pt);
  // bands (bottom → top): fruit A 905–735, qashta B 735–590, fruit C 590–452, qashta D 452–rim
  const bA = boundary(735, 3, 8);
  const bB = boundary(590, 5, 9);
  const bC = boundary(452, 7, 8);
  const bottomFar: Pt[] = [[CX - 300, 990], [CX + 300, 990]];
  const topFar: Pt[] = [[CX - 300, 250], [CX + 300, 250]];
  const juice = chili ? C.chiliDeep : '#F48E7A';
  const cream = chili ? C.chili : C.cream;
  const bands = [
    {d: smoothD(bandShape(bA, bottomFar), true), fill: juice},
    {d: smoothD(bandShape(bC, bB), true), fill: juice},
    {d: smoothD(bandShape(bB, bA), true), fill: cream},
    {d: smoothD(bandShape(topFar, bC), true), fill: chili ? C.chiliHot : cream},
  ];
  const bandEdges =
    brush(bA.slice(4, 27), {w: 3, taper: [0.1, 0.1], dense: false, seed: 51}) +
    brush(bB.slice(4, 27), {w: 3, taper: [0.1, 0.1], dense: false, seed: 52}) +
    brush(bC.slice(4, 27), {w: 3, taper: [0.1, 0.1], dense: false, seed: 53});
  const pieces = [...packFruit(735, 905, 11, chili), ...packFruit(452, 590, 17, chili)];
  const intruders: Piece[] = chili
    ? []
    : [
        {kind: 'strawberryCut', x: 150, y: 596, s: 86, rot: -14, seed: 901},
        {kind: 'kiwi', x: 404, y: 602, s: 82, rot: 8, seed: 902},
        {kind: 'mango', x: 266, y: 744, s: 72, rot: 12, seed: 903},
        {kind: 'strawberryCut', x: 470, y: 742, s: 78, rot: 20, seed: 904},
        {kind: 'mango', x: 214, y: 456, s: 66, rot: -20, seed: 905},
        {kind: 'strawberryCut', x: 384, y: 458, s: 72, rot: 160, seed: 906},
      ];
  let creamTex = '';
  const marks: Pt[][] = [
    [[150, 660], [196, 652], [240, 662]],
    [[330, 676], [372, 668], [408, 676]],
    [[120, 392], [160, 386], [190, 394]],
    [[360, 404], [404, 396], [440, 404]],
  ];
  marks.forEach((m, i) => (creamTex += brush(m, {w: 3.2, taper: [0.3, 0.5], seed: 60 + i})));

  // plastic
  const hazeL: Pt[] = [];
  const hazeR: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const y = lerp(RIM_Y + 26, BOT_Y - 4, i / 10);
    hazeL.push([CX - cupHW(y) + 2, y]);
    hazeR.push([CX + cupHW(y) - 2, y]);
  }
  const haze = brush(hazeL, {w: 20, taper: [0.05, 0.08], tip: 0.4, nib: 0, jitter: 0.1, seed: 3}) + brush(hazeR, {w: 16, taper: [0.05, 0.08], tip: 0.4, nib: 0, jitter: 0.1, seed: 4});
  const gL = (k: number, y0: number, y1: number): Pt[] => [0, 0.5, 1].map((t) => [CX - cupHW(lerp(y0, y1, t)) * k, lerp(y0, y1, t)] as Pt);
  const gR = (k: number, y0: number, y1: number): Pt[] => [0, 0.5, 1].map((t) => [CX + cupHW(lerp(y0, y1, t)) * k, lerp(y0, y1, t)] as Pt);
  const plastic = {
    haze,
    glossL: brush(gL(0.8, 390, 870), {w: 18, taper: [0.25, 0.3], nib: 0, jitter: 0.25, seed: 5}),
    glossL2: brush(gL(0.67, 430, 820), {w: 4.5, taper: [0.3, 0.3], nib: 0, jitter: 0.2, seed: 6}),
    glossR: brush(gR(0.85, 440, 840), {w: 8, taper: [0.3, 0.3], nib: 0, jitter: 0.2, seed: 7}),
    base: smoothD([...ellipsePts(CX, BOT_Y - 12, BOT_HW - 4, BOT_RY - 2, 24, Math.PI, 0), ...ellipsePts(CX, BOT_Y + 2, BOT_HW + 2, BOT_RY + 4, 24, 0, Math.PI)], true),
    baseLine: brush(ellipsePts(CX, BOT_Y - 12, BOT_HW - 6, BOT_RY - 2, 24, Math.PI * 0.95, Math.PI * 0.05), {w: 3, taper: [0.2, 0.2], seed: 8}),
  };
  const lipOuter = ellipsePts(CX, RIM_Y, RIM_HW + 6, RIM_RY + 5, 40, Math.PI, 0);
  const lipInner = ellipsePts(CX, RIM_Y - 1, RIM_HW - 3, RIM_RY - 3, 40, 0, Math.PI);
  const rimLip = smoothD([...lipOuter, ...lipInner], true);
  const rimInk = brush(ellipsePts(CX, RIM_Y, RIM_HW + 6, RIM_RY + 5, 40, Math.PI * 1.02, -Math.PI * 0.02), {w: 6.5, taper: [0.06, 0.06], tip: 0.3, seed: 9});
  const rimInner = brush(ellipsePts(CX, RIM_Y + 1, RIM_HW - 4, RIM_RY - 2, 40, Math.PI * 0.97, Math.PI * 0.03), {w: 2.6, taper: [0.15, 0.15], seed: 10});

  // dome
  const basePts = baseLobePts();
  const lobePtsAll = LOBES.map(lobePts);
  const base = lobeArt(basePts, {...DOME_BASE, seed: 1}, true);
  const lobes = LOBES.map((l, i) => lobeArt(lobePtsAll[i], l));
  // ink: one heavy silhouette around the whole heap + light, broken crease strokes where lobes overlap
  const stack = stackOutline([basePts, ...lobePtsAll], [300, 270], 3);
  const domeInk = brush(stack.silhouette, {w: 8, closed: true, dense: true, start: 0.55, seed: 21, shadow: 0.6, step: 3});
  const domeCreases = stack.creases
    .map((run, i) => brush(run, {w: 4.6, dense: true, taper: [0.28, 0.36], tip: 0.04, nib: 0.3, seed: 120 + i, step: 3}))
    .join('');
  // outline of the union (for crumb placement): sample the top envelope
  const inDome = (x: number, y: number) => pointInPoly(basePts, x, y) || lobePtsAll.some((p) => pointInPoly(p, x, y));

  const honeyLine = catmull(HONEY_CTRL, false, 12);
  const honeyLen = [0];
  for (let i = 1; i < honeyLine.length; i++) honeyLen.push(honeyLen[i - 1] + Math.hypot(honeyLine[i][0] - honeyLine[i - 1][0], honeyLine[i][1] - honeyLine[i - 1][1]));
  // puddles: where the drizzle crosses a valley it slows and spreads (arc-length positions on the line)
  const honeyPools = HONEY_POOLS.map((p) => {
    let best = 0;
    let bd = 1e9;
    honeyLine.forEach((q, i) => {
      const d = Math.hypot(q[0] - p.at[0], q[1] - p.at[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return {s: honeyLen[best], r: p.r * 0.7};
  });

  // crumbs: mostly along the honey (they stick to it), a few loose
  const r = rng(chili ? 71 : 70);
  const crumbs: Crumb[] = [];
  let guard = 0;
  while (crumbs.length < (chili ? 36 : 40) && guard++ < 4000) {
    let x: number;
    let y: number;
    if (r() < 0.7) {
      const p = honeyLine[Math.floor(r() * (honeyLine.length - 30))];
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 26;
      x = p[0] + Math.cos(a) * d;
      y = p[1] + Math.sin(a) * d;
    } else {
      x = 70 + r() * 460;
      y = 110 + r() * 230;
    }
    if (!inDome(x, y) || y > domeEdgeY(x) - 20) continue;
    crumbs.push({x, y, s: (chili ? 8 : 8) + r() ** 1.4 * (chili ? 9 : 11), rot: r() * Math.PI, tone: r(), seed: Math.floor(r() * 1e6)});
  }
  const bubbles: Pt[] = [];
  if (chili) {
    const rb = rng(99);
    for (let i = 0; i < 26; i++) bubbles.push([CX + (rb() - 0.5) * 380, 380 + rb() * 500]);
  }
  return {
    bodyInk: brush(body, {w: 7.5, closed: true, dense: true, start: 0.92, overshoot: 0.03, seed: 2, shadow: 0.7}),
    interior: smoothD(inner, true),
    bands,
    creamBands: bands[2].d + bands[3].d,
    bandEdges,
    pieces,
    intruders,
    creamTex,
    plastic,
    rimLip,
    rimInk,
    rimInner,
    domeUnion: [base.d, ...lobes.map((l) => l.d)],
    domeInk,
    domeCreases,
    domeOutline: basePts,
    base,
    lobes,
    honeyLine,
    honeyLen,
    honeyPools,
    crumbs,
    bubbles,
  };
};
const getArt = (v: 'qashta' | 'chili') => {
  let a = artCache.get(v);
  if (!a) {
    a = buildArt(v);
    artCache.set(v, a);
  }
  return a;
};

// cut a dense polyline between two fractions of its length
const subLine = (pts: Pt[], cum: number[], f0: number, f1: number): Pt[] => {
  const L = cum[cum.length - 1];
  const a = L * Math.max(0, f0);
  const b = L * Math.min(1, f1);
  const out: Pt[] = [];
  const at = (s: number): Pt => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
  };
  out.push(at(a));
  for (let i = 0; i < pts.length; i++) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
  out.push(at(b));
  return out;
};

// ------------------------------------------------------------------------------------------------ component
export type HeroCupProps = {
  /** parent px of the cup's base contact point */
  x: number;
  y: number;
  /** 1 → rim ≈ 464 px wide (art units = px) */
  scale?: number;
  variant?: 'qashta' | 'chili';
  /** honey (chili: chili-oil) drizzle 0..1, drawn along its path; 1 = full drizzle + the bead on the lip */
  honeyProgress?: number;
  spoon?: 'none' | 'dipping' | 'lifted';
  /** progress inside the spoon state (dipping: above → buried; lifted: buried → up, strand stretches & snaps at ~0.72) */
  spoonT?: number;
  /** + squash (wider/shorter), − stretch; anchored at the base */
  squash?: number;
  /** dome sway −1..1 (jelly) */
  wobble?: number;
  /** degrees, rotation around the base point */
  tilt?: number;
  /** chili: heat wiggles above the dome 0..1 */
  heat?: number;
  /** 0..1: a star glint on the dome (peak at 0.5) */
  glint?: number;
  /** ground shadow (halftone) colour, or false */
  shadow?: string | false;
  /** boil multiplier (0 = a frozen drawing) */
  boil?: number;
  /** hide toppings (honey, crumbs, garnish) e.g. while building the cup */
  toppings?: boolean;
  frame?: number;
  style?: React.CSSProperties;
};

export const HeroCup2D: React.FC<HeroCupProps> = ({
  x,
  y,
  scale = 1,
  variant = 'qashta',
  honeyProgress = 1,
  spoon = 'none',
  spoonT = 0,
  squash = 0,
  wobble = 0,
  tilt = 0,
  heat = 0,
  glint = 0,
  shadow = 'rgba(5,63,59,0.42)',
  boil = 1,
  toppings = true,
  frame,
  style,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const chili = variant === 'chili';
  const A = getArt(variant);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clipId = `cupin${uid}`;
  const creamClip = `crm${uid}`;
  const domeClip = `dome${uid}`;
  const spoonMask = `spm${uid}`;
  const bContents = useBoil({scale: 2.2 * boil, offset: 1, frame: f, freq: 0.02});
  const bCupInk = useBoil({scale: 3.2 * boil, offset: 2, frame: f, freq: 0.024});
  const bDome = useBoil({scale: 2.4 * boil, offset: 3, frame: f, freq: 0.02});
  const bTop = useBoil({scale: 2.8 * boil, offset: 5, frame: f, freq: 0.024});

  // honey: a drawn liquid (see Honey.tsx) — breathing width, puddles in the valleys, a rounded head while it pours,
  // a hanging bead on the lip once it has arrived
  const hp = Math.max(0, Math.min(1, honeyProgress));
  const honey = useMemo(() => {
    if (hp <= 0.001) return null;
    const line = subLine(A.honeyLine, A.honeyLen, 0, hp);
    if (line.length < 3) return null;
    const cut = A.honeyLen[A.honeyLen.length - 1] * hp;
    return honeyPaths(
      line,
      {
        hw: 14,
        minK: 0.48,
        maxK: 1.45,
        wave: 130,
        seed: chili ? 47 : 41,
        pools: A.honeyPools.filter((q) => q.s < cut - 6),
        taperIn: 46,
        end: hp < 0.999 ? 'head' : 'bead',
        bead: 11,
      },
      true,
    );
  }, [A, hp, chili]);

  // spoon placement
  const E = CUP_ANCHORS.spoonEntry;
  const ang = 28;
  const u: Pt = [Math.sin((ang * Math.PI) / 180), -Math.cos((ang * Math.PI) / 180)]; // bowl → handle
  const st = Math.max(0, Math.min(1, spoonT));
  let depth = -999;
  let load = 0;
  let coat = 0;
  if (spoon === 'dipping') {
    const e = st < 0.2 ? -0.06 * Math.sin((st / 0.2) * Math.PI) : (st - 0.2) / 0.8; // a little lift (anticipation), then in
    depth = -240 + 300 * (e < 0 ? e : e ** 1.6);
  } else if (spoon === 'lifted') {
    const e = st < 0.08 ? 0 : (st - 0.08) / 0.92;
    depth = 52 - 300 * (1 - (1 - e) ** 2.2);
    load = 1;
    coat = 0.6;
  }
  const bowl: Pt = [E[0] - u[0] * depth, E[1] - u[1] * depth];
  const inCream = spoon !== 'none' && depth > -60;
  const crater: Pt = [E[0] - 14, E[1] + 16];
  let strand: string | null = null;
  let strandHi: string | null = null;
  let stub: string | null = null;
  let peak = 0;
  if (spoon === 'lifted') {
    const bowlBottom: Pt = [bowl[0] - u[0] * 46, bowl[1] - u[1] * 46];
    const SNAP = 0.72;
    if (st < SNAP) {
      const k = st / SNAP;
      const n = 22;
      const left: Pt[] = [];
      const right: Pt[] = [];
      const dx = bowlBottom[0] - crater[0];
      const dy = bowlBottom[1] - crater[1];
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const sag = Math.sin(Math.PI * t) * 14 * k;
        const px = crater[0] + dx * t + nx * sag;
        const py = crater[1] + dy * t + ny * sag;
        const wMid = 40 * Math.max(0.1, 1 - k * 1.0) ** 1.25;
        const w = lerp(t < 0.5 ? 50 : 34, wMid, Math.sin(Math.PI * t) ** 1.4) / 2;
        left.push([px + nx * w, py + ny * w]);
        right.push([px - nx * w, py - ny * w]);
      }
      strand = smoothD([...left, ...right.reverse()], true);
      strandHi = brush(
        left.filter((_, i) => i > 2 && i < n - 2).map(([px, py], i) => [px - nx * 5 * (1 - k * 0.6) + 0 * i, py - ny * 5 * (1 - k * 0.6)] as Pt),
        {w: 4.5 * (1 - k * 0.5), taper: [0.3, 0.3], tip: 0.05, dense: true, seed: 140},
      );
    } else {
      const k = (st - SNAP) / (1 - SNAP);
      const dl = 40 * (1 - k) ** 2 + 6;
      stub = shapeD([
        [bowlBottom[0] - 12, bowlBottom[1] - 6],
        [bowlBottom[0] + 12, bowlBottom[1] - 6],
        [bowlBottom[0] + 5, bowlBottom[1] + dl * 0.7],
        [bowlBottom[0], bowlBottom[1] + dl],
        [bowlBottom[0] - 5, bowlBottom[1] + dl * 0.7],
      ]);
      peak = 34 * Math.exp(-k * 4) * Math.cos(k * 9);
    }
  }

  const sx = 1 + 0.45 * squash;
  const sy = 1 - squash;
  const wob = wobble * 7;
  const S = scale;
  const collar = useMemo(() => {
    const c = blobPts(E[0] - 6, E[1] + 4, 34, 13, 0.12, 5, 20, 2, Math.PI / 4.2);
    return {d: shapeD(c), ink: brush(c, {w: 4, closed: true, start: 0.6, seed: 7})};
  }, [E]);

  const glintS = glint > 0 && glint < 1 ? Math.sin(Math.PI * glint) : 0;
  const domeFill = chili ? C.chili : C.cream;
  const domeShade = chili ? C.chiliDeep : '#E4C690';
  const domeMid = chili ? '#C4202C' : '#F3DFBC';
  const lobeLayer = (l: LobeArt, i: number) => (
    <g key={i}>
      <path d={l.d} fill={domeMid} />
      <clipPath id={`${domeClip}l${i}`}>
        <path d={l.d} />
      </clipPath>
      <path d={l.lit} fill={domeFill} clipPath={`url(#${domeClip}l${i})`} />
      <Halftone box={l.box} cell={7} angle={30} fill={domeShade} opacity={chili ? 0.75 : 0.8} tone={l.tone} clipPath={`url(#${domeClip}l${i})`} maxR={0.6} />
      <path d={l.bounce} fill={chili ? C.chiliHot : C.turquoiseLight} opacity={chili ? 0.6 : 0.7} clipPath={`url(#${domeClip}l${i})`} />
      <path d={l.curd} fill={chili ? C.chiliDeep : C.creamDeep} opacity={0.7} />
      <path d={l.hi} fill={C.white} opacity={0.96} />
      <path d={l.dots} fill={C.white} />
    </g>
  );

  return (
    <svg
      width={CUP.artW * S}
      height={CUP.artH * S}
      viewBox={`0 0 ${CUP.artW} ${CUP.artH}`}
      style={{position: 'absolute', left: x - CUP.cx * S, top: y - CUP.baseY * S, overflow: 'visible', ...style}}
    >
      <defs>
        {bContents.def}
        {bCupInk.def}
        {bDome.def}
        {bTop.def}
        <clipPath id={clipId}>
          <path d={A.interior} />
        </clipPath>
        <clipPath id={creamClip}>
          <path d={A.creamBands} />
        </clipPath>
        <clipPath id={domeClip}>
          {A.domeUnion.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <mask id={spoonMask} maskUnits="userSpaceOnUse" x={-400} y={-600} width={1400} height={2000}>
          <rect x={-400} y={-600} width={1400} height={2000} fill="#fff" />
          {/* hide what is inside the dome past the entry point, along the spoon axis */}
          <g clipPath={`url(#${domeClip})`}>
            <path
              d={`M${E[0] + u[1] * 600} ${E[1] - u[0] * 600} L${E[0] - u[1] * 600} ${E[1] + u[0] * 600} L${E[0] - u[1] * 600 - u[0] * 600} ${E[1] + u[0] * 600 - u[1] * 600} L${E[0] + u[1] * 600 - u[0] * 600} ${E[1] - u[0] * 600 - u[1] * 600}Z`}
              fill="#000"
            />
          </g>
        </mask>
      </defs>
      <g transform={`rotate(${tilt} ${CUP.cx} ${CUP.baseY}) translate(${CUP.cx} ${CUP.baseY}) scale(${sx} ${sy}) translate(${-CUP.cx} ${-CUP.baseY})`}>
        {shadow ? (
          <Halftone
            box={[40, 880, 560, 100]}
            cell={8}
            angle={20}
            fill={shadow}
            tone={[{t: 'rad', cx: 330, cy: 932, r0: 120, r1: 280, a: 1, b: 0, sx: 1, sy: 0.16, pow: 0.8}]}
          />
        ) : null}

        {/* contents through the clear wall */}
        <g filter={bContents.url}>
          <g clipPath={`url(#${clipId})`}>
            <path d={A.bands[0].d} fill={A.bands[0].fill} />
            <path d={A.bands[1].d} fill={A.bands[1].fill} />
            {chili ? <ChiliSwirls /> : null}
            {A.pieces.map((p, i) => (
              <FruitPiece key={i} kind={p.kind} s={p.s} seed={p.seed} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)})`} />
            ))}
            <path d={A.bands[2].d} fill={A.bands[2].fill} />
            <path d={A.bands[3].d} fill={A.bands[3].fill} />
            {/* cylindrical shading on the qashta bands: halftone towards both walls (more on the shadow side) */}
            <Halftone
              box={[60, 330, 480, 420]}
              cell={7}
              angle={30}
              fill={chili ? C.chiliDeep : '#EFDDB9'}
              tone={[{t: 'rad', cx: 262, cy: 600, r0: 165, r1: 262, a: 0, b: 0.9, sx: 1, sy: 9}, {t: 'noise', amp: 0.3, freq: 0.04, seed: 8}]}
              clipPath={`url(#${creamClip})`}
            />
            <path d={A.creamTex} fill={chili ? C.chiliDeep : C.creamDeep} opacity={0.85} />
            <path d={A.bandEdges} fill={INK} opacity={0.55} />
            {A.intruders.map((p, i) => (
              <FruitPiece key={`in${i}`} kind={p.kind} s={p.s} seed={p.seed} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`} />
            ))}
            {chili ? <Bubbles pts={A.bubbles} /> : null}
            <path d={A.plastic.haze} fill={C.white} opacity={0.22} />
            <path d={A.plastic.base} fill={C.white} opacity={0.38} />
          </g>
          <g transform={`translate(${CUP_ANCHORS.sticker[0]} ${CUP_ANCHORS.sticker[1]})`}>
            <Sticker r={82} squeezeX={0.94} seed={9} />
          </g>
          <path d={A.plastic.glossL} fill={C.white} opacity={0.6} />
          <path d={A.plastic.glossL2} fill={C.white} opacity={0.9} />
          <path d={A.plastic.glossR} fill={C.white} opacity={0.55} />
        </g>
        <g filter={bCupInk.url}>
          <path d={A.bodyInk} fill={INK} />
          <path d={A.plastic.baseLine} fill={INK} opacity={0.7} />
          <path d={A.rimLip} fill={C.white} opacity={0.55} />
          <path d={A.rimInner} fill={INK} opacity={0.75} />
          <path d={A.rimInk} fill={INK} />
        </g>

        {/* the dome (sways with `wobble` about the rim) */}
        <g transform={`translate(${CUP.cx} ${RIM_Y + 20}) skewX(${wob}) translate(${-CUP.cx} ${-(RIM_Y + 20)})`}>
          <g filter={bDome.url}>
            {lobeLayer(A.base, 9)}
            {A.lobes.map(lobeLayer)}
            <path d={A.domeCreases} fill={INK} opacity={0.9} />
            <path d={A.domeInk} fill={INK} />
            {spoon === 'lifted' ? <Crater cx={crater[0]} cy={crater[1]} chili={chili} peak={peak} /> : null}
          </g>

          {toppings ? (
            <g filter={bTop.url}>
              {honey ? <HoneyLayers p={honey} colors={chili ? HONEY_COLORS.chiliOil : HONEY_COLORS.honey} shadowOffset={[4, 8]} /> : null}
              <Crumbs crumbs={A.crumbs} palette={chili ? 'chili' : 'pistachio'} />
              {chili ? (
                <FruitPiece kind="chiliPepper" s={176} seed={7} transform="translate(320 112) rotate(-16)" />
              ) : (
                <>
                  <FruitPiece kind="kiwiHalf" s={108} seed={3} transform="translate(156 190) rotate(-14)" />
                  <FruitPiece kind="mango" s={58} seed={8} transform="translate(240 126) rotate(-10)" />
                  <FruitPiece kind="strawberry" s={100} seed={5} transform="translate(462 166) rotate(22)" />
                </>
              )}
            </g>
          ) : null}
          {glintS > 0 ? <Glint x={250} y={150} s={glintS} /> : null}
        </g>

        {spoon !== 'none' ? (
          <g>
            {strand ? <path d={strand} fill={chili ? C.chili : C.cream} stroke={INK} strokeWidth={4} /> : null}
            {strandHi ? <path d={strandHi} fill={C.white} opacity={0.95} /> : null}
            {stub ? <path d={stub} fill={chili ? C.chili : C.cream} stroke={INK} strokeWidth={3} /> : null}
            <g mask={inCream && spoon === 'dipping' ? `url(#${spoonMask})` : undefined}>
              <g transform={`translate(${bowl[0]} ${bowl[1]}) rotate(${ang})`}>
                <SpoonArt load={load} coat={coat} frame={f} boil={boil} />
              </g>
            </g>
            {spoon === 'dipping' && depth > -8 ? (
              <g>
                <path d={collar.d} fill={chili ? C.chili : C.cream} />
                <path d={collar.ink} fill={INK} />
              </g>
            ) : null}
          </g>
        ) : null}

        {chili && heat > 0 ? <Heat frame={f} amount={heat} /> : null}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ small parts
const Crater: React.FC<{cx: number; cy: number; chili: boolean; peak: number}> = ({cx, cy, chili, peak}) => {
  const rim = blobPts(cx, cy, 52, 22, 0.1, 31, 24, 2, -0.2);
  const hole = blobPts(cx + 2, cy + 3, 40, 15, 0.12, 32, 20, 2, -0.2);
  return (
    <g>
      <path d={shapeD(rim)} fill={chili ? C.chiliHot : C.white} opacity={0.9} />
      <path d={shapeD(hole)} fill={chili ? C.chiliDeep : C.creamDeep} />
      <path d={brush(hole, {w: 3.2, closed: true, start: 0.5, seed: 33})} fill={INK} opacity={0.85} />
      {Math.abs(peak) > 1 ? (
        <path
          d={shapeD([[cx - 14, cy + 6], [cx - 4, cy + 4 - peak * 0.6], [cx, cy + 2 - peak], [cx + 5, cy + 4 - peak * 0.6], [cx + 14, cy + 6]])}
          fill={chili ? C.chili : C.cream}
          stroke={INK}
          strokeWidth={2.5}
        />
      ) : null}
    </g>
  );
};

const ChiliSwirls: React.FC = () => {
  const d = useMemo(() => {
    let s = '';
    const r = rng(55);
    for (let i = 0; i < 14; i++) {
      const y = 380 + i * 38 + r() * 10;
      const x0 = 70 + r() * 60;
      const pts: Pt[] = [];
      for (let k = 0; k <= 6; k++) pts.push([x0 + k * 65, y + 12 * Math.sin(k * 1.3 + i) + r() * 6]);
      s += brush(pts, {w: 5 + r() * 5, taper: [0.2, 0.3], seed: 60 + i});
    }
    return s;
  }, []);
  return <path d={d} fill={C.chiliHot} opacity={0.75} />;
};

const Bubbles: React.FC<{pts: Pt[]}> = ({pts}) => (
  <g>
    {pts.map(([x, y], i) => {
      const r = 4 + (i % 4) * 2.5;
      return (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.9} fill="none" stroke="#FFC2B0" strokeWidth={1.8} opacity={0.85} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill={C.white} opacity={0.9} />
        </g>
      );
    })}
  </g>
);

/** A 4-point star glint with an ink edge (s = 0..1 size). Use inside any svg. */
export const Glint: React.FC<{x: number; y: number; s: number; color?: string}> = ({x, y, s, color = C.white}) => (
  <path
    transform={`translate(${x} ${y}) scale(${s}) rotate(${s * 25})`}
    d="M0 -30 C2.5 -8 8 -2.5 30 0 C8 2.5 2.5 8 0 30 C-2.5 8 -8 2.5 -30 0 C-8 -2.5 -2.5 -8 0 -30 Z"
    fill={color}
    stroke={INK}
    strokeWidth={2.4 / Math.max(0.3, s)}
  />
);

const Heat: React.FC<{frame: number; amount: number}> = ({frame, amount}) => {
  const k = Math.floor(frame / 2);
  const lines = [0, 1, 2].map((i) => {
    const x0 = 200 + i * 100;
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) {
      const yy = 70 - j * 26 - ((k * 6) % 26);
      pts.push([x0 + 12 * Math.sin(j * 1.4 + k * 0.9 + i * 2) + 4 * noise1(j + k * 0.5, i), yy]);
    }
    return brush(pts, {w: 6, taper: [0.4, 0.4], seed: 90 + i + (k % 3)});
  });
  return <path d={lines.join('')} fill={INK} opacity={0.75 * amount} />;
};
