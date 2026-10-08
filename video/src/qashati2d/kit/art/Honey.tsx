// Honey (and chili oil) as a drawn LIQUID, not a tube: a ribbon whose width breathes along its length (thin threads,
// fat slow stretches, puddles where it collects), cel-painted like translucent amber —
//   deep-amber rim · golden body · a pale "light-through" caustic on the side AWAY from the light ·
//   broken white speculars on the lit side · a teal ink line only on the shadow edge (liquids aren't outlined all round)
// plus a warm cast shadow on whatever it sits on. A pour in progress ends in a rounded head (a bulb), a finished one
// in a hanging bead. Pure geometry (cached by the callers) + a <HoneyDrizzle/> component for spots.
//
//   <svg …><HoneyDrizzle pts={myControlPoints} progress={p} hw={12} /></svg>   (inside any SVG, art units)
import React, {useMemo} from 'react';
import {brush, catmull, fbm1, noise1, Pt, smoothD} from '../geom';
import {C, INK} from '../palette';

export type HoneyColors = {rim: string; body: string; glow: string; spec: string; shadow: string; ink: string};
export const HONEY_COLORS: Record<'honey' | 'chiliOil', HoneyColors> = {
  honey: {rim: '#BF6A04', body: '#F5A214', glow: '#FFD870', spec: C.white, shadow: '#B9772A', ink: INK},
  chiliOil: {rim: '#B3260C', body: '#FF6A24', glow: '#FFC27A', spec: '#FFF4EC', shadow: '#7E0E0A', ink: INK},
};

export type HoneyOpts = {
  /** nominal half-width (art units) */
  hw: number;
  /** width range as multipliers of hw (thin threads … fat stretches) */
  minK?: number;
  maxK?: number;
  /** wavelength of the width breathing (art units) */
  wave?: number;
  seed?: number;
  /** puddles: arc-length position (art units from the start) + extra half-width */
  pools?: {s: number; r: number}[];
  /** taper length at the start (art units) */
  taperIn?: number;
  /** 'head' = a pour in progress (rounded bulb), 'bead' = finished, hanging bead of size `bead`, 'taper' = thins out */
  end?: 'head' | 'bead' | 'taper';
  bead?: number;
  /** light direction (unit, pointing FROM the light) */
  light?: Pt;
};

export type HoneyPaths = {shadow: string; rim: string; body: string; glow: string; spec: string; dots: string; ink: string};

const arcLen = (pts: Pt[]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
};
const dotD = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

/** Closed outline of a variable-width ribbon (with round caps) around a dense polyline, offset along the normal. */
const ribbon = (line: Pt[], hw: number[], k: number, off: number[], capEnd = true): Pt[] => {
  const n = line.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const N: Pt[] = [];
  const T: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = -ty;
    const ny = tx;
    const h = hw[i] * k;
    const c: Pt = [line[i][0] + nx * off[i], line[i][1] + ny * off[i]];
    L.push([c[0] + nx * h, c[1] + ny * h]);
    R.push([c[0] - nx * h, c[1] - ny * h]);
    N.push([nx, ny]);
    T.push([tx, ty]);
  }
  const cap = (i: number, dir: 1 | -1): Pt[] => {
    const h = hw[i] * k;
    const c: Pt = [line[i][0] + N[i][0] * off[i], line[i][1] + N[i][1] * off[i]];
    const out: Pt[] = [];
    for (let j = 1; j < 8; j++) {
      const th = (j / 8) * Math.PI;
      const nx = dir * N[i][0] * Math.cos(th) + dir * T[i][0] * Math.sin(th);
      const ny = dir * N[i][1] * Math.cos(th) + dir * T[i][1] * Math.sin(th);
      out.push([c[0] + nx * h, c[1] + ny * h]);
    }
    return out;
  };
  return [...L, ...(capEnd ? cap(n - 1, 1) : []), ...R.reverse(), ...cap(0, -1)];
};

/** Paths for a honey ribbon along `ctrl` (control points → Catmull-Rom, or a dense line with `dense`). */
export const honeyPaths = (ctrl: Pt[], o: HoneyOpts, dense = false): HoneyPaths | null => {
  const line = dense ? ctrl : catmull(ctrl, false, 10);
  if (line.length < 3) return null;
  const cum = arcLen(line);
  const Ltot = cum[cum.length - 1];
  if (Ltot < 4) return null;
  const seed = o.seed ?? 41;
  const minK = o.minK ?? 0.5;
  const maxK = o.maxK ?? 1.35;
  const wave = o.wave ?? 150;
  const taperIn = o.taperIn ?? o.hw * 5;
  const end = o.end ?? 'taper';
  const [lx, ly] = o.light ?? [0.6, 0.8]; // light comes from the upper left → travels down-right
  const hw = cum.map((s) => {
    const breathe = minK + (maxK - minK) * (0.5 + 0.5 * fbm1(s / wave + 0.37, seed));
    let h = o.hw * breathe;
    for (const p of o.pools ?? []) h += p.r * Math.exp(-(((s - p.s) / Math.max(8, p.r * 1.7)) ** 2));
    const tin = Math.min(1, s / taperIn) ** 0.6;
    h *= 0.28 + 0.72 * tin;
    const toEnd = Ltot - s;
    if (end === 'head') h *= 1 + 0.32 * Math.exp(-((toEnd / (o.hw * 2.2)) ** 2));
    if (end === 'taper') h *= 0.3 + 0.7 * Math.min(1, toEnd / (o.hw * 5)) ** 0.6;
    if (end === 'bead') h *= 0.55 + 0.45 * Math.min(1, toEnd / (o.hw * 3));
    return h;
  });
  const zero = cum.map(() => 0);
  // which side is lit, per point (continuous): + = the left normal faces the light
  const lit = line.map((_, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    return Math.max(-1, Math.min(1, -(nx * lx + ny * ly) * 2.4));
  });
  const outline = (k: number, off: number[]) => smoothD(ribbon(line, hw, k, off, end !== 'taper'), true);
  // a hanging bead at the end (finished drizzle)
  let beadD = '';
  let beadGlow = '';
  let beadSpec = '';
  let beadInk = '';
  if (end === 'bead' && (o.bead ?? 0) > 0.5) {
    const br = o.bead!;
    const p = line[line.length - 1];
    const cx = p[0] + br * 0.15;
    const cy = p[1] + br * 1.25;
    const neck = hw[hw.length - 1] * 0.8;
    const drop: Pt[] = [];
    for (let j = 0; j <= 20; j++) {
      const th = Math.PI * 1.5 + (j / 20) * Math.PI * 2;
      // a teardrop: round bottom, pinched towards the neck
      const pinch = 1 - 0.55 * Math.max(0, -Math.sin(th)) ** 3;
      drop.push([cx + Math.cos(th) * br * pinch, cy + Math.sin(th) * br * (Math.sin(th) < 0 ? 1.15 : 1)]);
    }
    beadD = smoothD([[p[0] - neck, p[1]], ...drop.slice(2, 19), [p[0] + neck, p[1]]], true);
    beadGlow = dotD(cx + br * 0.22, cy + br * 0.3, br * 0.42);
    beadSpec = dotD(cx - br * 0.38, cy - br * 0.25, br * 0.24) + dotD(cx - br * 0.1, cy - br * 0.62, br * 0.1);
    beadInk = brush(drop.slice(6, 16), {w: 3.2, taper: [0.3, 0.3], dense: false, seed: seed + 9});
  }
  // speculars: broken white strokes on the lit side, only where the side is clearly lit (no flip-flop)
  const specRuns: Pt[][] = [];
  const inkRuns: Pt[][] = [];
  let run: Pt[] = [];
  let inkRun: Pt[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / tl;
    const ny = (b[0] - a[0]) / tl;
    const sg = lit[i] >= 0 ? 1 : -1;
    const gate = Math.abs(lit[i]) > 0.55 && noise1(cum[i] / 42 + 3.1, seed + 5) > -0.15 && cum[i] > taperIn * 0.6 && cum[i] < Ltot - o.hw * 1.2;
    // (a run also breaks where its offset point jumps — tight turns where the offset crosses the ribbon)
    const sp: Pt = [line[i][0] + nx * hw[i] * 0.5 * sg, line[i][1] + ny * hw[i] * 0.5 * sg];
    const jumpS = run.length > 0 && Math.hypot(sp[0] - run[run.length - 1][0], sp[1] - run[run.length - 1][1]) > 9;
    if (gate && !jumpS) run.push(sp);
    else if (run.length) {
      if (run.length > 3) specRuns.push(run);
      run = gate ? [sp] : [];
    }
    const inkGate = Math.abs(lit[i]) > 0.35 && noise1(cum[i] / 70 + 9.7, seed + 7) > -0.35;
    const ip: Pt = [line[i][0] - nx * hw[i] * 0.98 * sg, line[i][1] - ny * hw[i] * 0.98 * sg];
    const jumpI = inkRun.length > 0 && Math.hypot(ip[0] - inkRun[inkRun.length - 1][0], ip[1] - inkRun[inkRun.length - 1][1]) > 9;
    if (inkGate && !jumpI) inkRun.push(ip);
    else if (inkRun.length) {
      if (inkRun.length > 3) inkRuns.push(inkRun);
      inkRun = inkGate ? [ip] : [];
    }
  }
  if (run.length > 3) specRuns.push(run);
  if (inkRun.length > 3) inkRuns.push(inkRun);
  const avgHw = hw.reduce((s, v) => s + v, 0) / hw.length;
  const spec = specRuns.map((r, i) => brush(r, {w: Math.max(2.2, avgHw * 0.42), taper: [0.35, 0.45], tip: 0.05, nib: 0.2, dense: true, seed: seed + 20 + i, step: 2.5})).join('') + beadSpec;
  const ink = inkRuns.map((r, i) => brush(r, {w: Math.max(2.4, o.hw * 0.3), taper: [0.25, 0.3], tip: 0.1, dense: true, seed: seed + 40 + i, step: 2.5})).join('') + beadInk;
  // spec dots: on the fattest stretches (puddles), lit side
  let dots = '';
  (o.pools ?? []).forEach((p, i) => {
    if (p.s > Ltot - 4) return;
    let j = 0;
    while (j < cum.length - 1 && cum[j] < p.s) j++;
    const a = line[Math.max(0, j - 1)];
    const b = line[Math.min(line.length - 1, j + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / tl;
    const ny = (b[0] - a[0]) / tl;
    const sg = lit[j] >= 0 ? 1 : -1;
    dots += dotD(line[j][0] + nx * hw[j] * 0.42 * sg + (i % 2 ? 6 : -4), line[j][1] + ny * hw[j] * 0.42 * sg, Math.max(2, hw[j] * 0.13));
  });
  // the caustic sits on the shadow side
  const glowOff = hw.map((h, i) => -h * 0.32 * lit[i]);
  return {
    shadow: outline(1, zero),
    rim: outline(1, zero) + beadD,
    body: outline(0.8, hw.map((h, i) => h * 0.12 * lit[i])) + beadD,
    glow: outline(0.3, glowOff) + beadGlow,
    spec,
    dots,
    ink,
  };
};

/** Draw honey paths (inside an SVG). `shadowOffset` = the cast shadow on the surface underneath. */
export const HoneyLayers: React.FC<{p: HoneyPaths; colors?: HoneyColors; shadowOffset?: Pt; opacity?: number}> = ({p, colors = HONEY_COLORS.honey, shadowOffset = [5, 8], opacity = 1}) => (
  <g opacity={opacity}>
    <path d={p.shadow} fill={colors.shadow} opacity={0.3} transform={`translate(${shadowOffset[0]} ${shadowOffset[1]})`} />
    <path d={p.rim} fill={colors.rim} />
    <path d={p.body} fill={colors.body} />
    <path d={p.glow} fill={colors.glow} opacity={0.85} />
    <path d={p.ink} fill={colors.ink} opacity={0.85} />
    <path d={p.spec + p.dots} fill={colors.spec} opacity={0.96} />
  </g>
);

/**
 * A honey drizzle along control points, drawn up to `progress` (0..1) — a pour in progress has a rounded head,
 * a finished one ends in a hanging bead (`bead` size) or thins out. Art units = the parent SVG's units.
 */
export const HoneyDrizzle: React.FC<{
  pts: Pt[];
  progress?: number;
  hw?: number;
  seed?: number;
  pools?: {at: number; r: number}[];
  bead?: number;
  colors?: HoneyColors;
  shadowOffset?: Pt;
}> = ({pts, progress = 1, hw = 12, seed = 41, pools = [], bead = 0, colors, shadowOffset}) => {
  const line = useMemo(() => catmull(pts, false, 10), [pts]);
  const cum = useMemo(() => arcLen(line), [line]);
  const total = cum[cum.length - 1];
  const p = Math.max(0, Math.min(1, progress));
  const paths = useMemo(() => {
    if (p <= 0.002) return null;
    const cut = total * p;
    const sub: Pt[] = [];
    for (let i = 0; i < line.length; i++) {
      if (cum[i] <= cut) sub.push(line[i]);
      else {
        const t = (cut - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        sub.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]);
        break;
      }
    }
    return honeyPaths(sub, {hw, seed, pools: pools.map((q) => ({s: q.at * total, r: q.r})).filter((q) => q.s < cut), end: p < 1 ? 'head' : bead > 0 ? 'bead' : 'taper', bead}, true);
  }, [line, cum, total, p, hw, seed, pools, bead]);
  return paths ? <HoneyLayers p={paths} colors={colors} shadowOffset={shadowOffset} /> : null;
};
