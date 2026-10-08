// <FamilyPlate2D/> — top-down: a big round sharing plate of qashati (rings of strawberry / kiwi / mango, a qashta
// field and a central qashta mound, a poured-honey drizzle, pistachio crumbs) on a ROUND engraved brass tray (the
// Levantine صينية — `tray="turquoise"` for an enamel one, `tray={false}` for none), Q sticker on the rim.
// (The tray used to be a turquoise rounded square: with the white plate in it, it read as an APP ICON at phone size.)
//   scoopsTaken 0..8 — spoon bites eat the plate from the rim inwards, one per spoon (fractional = the bite digging in).
//   At 8 the plate is empty: spoon-drag smears of cream and honey… and ONE cream drop left in the middle.
// Art space: 1000 × 1000, centre (500, 500). Position with x/y (centre, parent px) and `scale` (1 → 1000 px wide).
// Aim hands/spoons at PLATE_SCOOPS[i] (plateScoopPoint maps it to parent px).
import React, {useId, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, ellipsePts, Pt, rng, shapeD, smoothD, stackOutline} from '../geom';
import {useBoil} from '../look/Boil';
import {Halftone} from '../look/Halftone';
import {C, INK} from '../palette';
import {easeOutCubic} from '../time';
import {CreamDropArt} from './CreamDrop';
import {Crumb, Crumbs, FruitKind, FruitPiece} from './fruit';
import {HoneyLayers, HoneyPaths, honeyPaths} from './Honey';
import {Sticker} from './Sticker';

const PC = 500;
const R_PLATE = 440;
const R_WELL = 352;
// the tray: a round صينية with a raised, engraved rim band (visible around the plate: r 440 → 500)
const TRAY_R = 500;
const TRAY_INNER = 462;
const TRAY_COLORS = {
  brass: {deep: '#9C6A1A', base: '#D6A23F', light: '#F3D27A', engrave: '#7E5212', shadow: 'rgba(5,63,59,0.3)'},
  turquoise: {deep: C.turquoiseDeep, base: C.turquoise, light: C.turquoiseLight, engrave: '#008F84', shadow: 'rgba(5,63,59,0.3)'},
} as const;

// A bite = a chain of spoon scallops from the rim inwards (the hand comes from outside, at `angle`). Bites always
// connect to the rim or to food already gone, so the plate is eaten like a cake — never floating holes.
export type PlateScoop = {
  /** where to aim the spoon (the middle scallop) */
  x: number;
  y: number;
  /** direction (deg) from the plate centre outwards: where the hand comes from */
  angle: number;
  /** scallops (circles) in bite order: outer first */
  cuts: {x: number; y: number; r: number}[];
};
// 7 rim bites in a lively (not clockwise) order, then the centre (the last spoon, revealing the drop)
const RING_ORDER = [0, 4, 2, 6, 1, 5, 3];
const polar = (a: number, r: number) => ({x: PC + Math.cos((a * Math.PI) / 180) * r, y: PC + Math.sin((a * Math.PI) / 180) * r});
export const PLATE_SCOOPS: PlateScoop[] = [
  ...RING_ORDER.map((k, i) => {
    const a = -100 + k * (360 / 7) + ((i * 37) % 11) - 5;
    const cuts = [
      {...polar(a, 334), r: 150},
      {...polar(a + 4, 240), r: 118},
      {...polar(a - 3, 168), r: 92},
    ];
    return {...polar(a, 236), angle: a, cuts};
  }),
  {x: PC, y: PC + 10, angle: 90, cuts: [{x: PC + 20, y: PC + 40, r: 118}, {x: PC - 10, y: PC - 20, r: 130}]},
];
/** Parent px of scoop i for a plate drawn at (x, y, scale) (ignores `rotate`). */
export const plateScoopPoint = (i: number, x: number, y: number, scale = 1): Pt => [x + (PLATE_SCOOPS[i].x - PC) * scale, y + (PLATE_SCOOPS[i].y - PC) * scale];

type Piece = {kind: FruitKind; x: number; y: number; s: number; rot: number; seed: number};
type PlateArt = {
  plate: string;
  plateInk: string;
  wellInk: string;
  rimHi: string;
  field: string;
  pieces: Piece[];
  mound: string[];
  moundInk: string;
  moundCreases: string;
  moundHi: string;
  honey: HoneyPaths | null;
  crumbs: Crumb[];
  cuts: {pts: Pt[]; d: string; lip: string; ink: string}[][];
  leftovers: Crumb[];
  residue: string;
  smears: string;
  smearShade: string;
  smearHi: string;
  honeySmears: HoneyPaths[];
  tray: {disk: string; inner: string; ink: string; innerInk: string; engrave: string; dots: string; hi: string};
};
let cached: PlateArt | null = null;

const dotD = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${(2 * r).toFixed(1)} 0a${r} ${r} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

const build = (): PlateArt => {
  const r = rng(808);
  const plateP = blobPts(PC, PC, R_PLATE, R_PLATE, 0.006, 3, 90, 2);
  const wellP = blobPts(PC, PC, R_WELL + 6, R_WELL + 6, 0.006, 4, 80, 2);
  const fieldP = blobPts(PC, PC, R_WELL, R_WELL, 0.018, 5, 80, 3);
  // fruit: outer ring, inner ring, a few loose pieces
  const pieces: Piece[] = [];
  const kinds: FruitKind[] = ['strawberryCut', 'kiwi', 'mango'];
  const ring = (n: number, rad: number, s: number, off: number) => {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.12;
      const rr = rad + (r() - 0.5) * 18;
      pieces.push({kind: kinds[(i + Math.floor(off * 3)) % 3], x: PC + Math.cos(a) * rr, y: PC + Math.sin(a) * rr, s: s * (0.9 + r() * 0.22), rot: (a * 180) / Math.PI + 90 + (r() - 0.5) * 40, seed: Math.floor(r() * 1e5)});
    }
  };
  ring(20, 282, 100, 0.1);
  ring(13, 182, 88, 0.45);
  // mound (top-down: overlapping lobes around the centre)
  const lobes: Pt[][] = [
    blobPts(PC, PC + 4, 150, 140, 0.05, 11, 40, 3),
    blobPts(PC - 60, PC - 46, 86, 80, 0.06, 12, 30, 2),
    blobPts(PC + 66, PC - 34, 82, 78, 0.06, 13, 30, 2),
    blobPts(PC + 8, PC + 62, 90, 74, 0.06, 14, 30, 2),
    blobPts(PC - 8, PC - 8, 62, 58, 0.06, 15, 30, 2),
  ];
  const stack = stackOutline(lobes, [PC, PC], 3);
  // honey: a loose hand-poured drizzle (loops of different sizes, not a perfect spiral) — a drawn liquid (Honey.tsx)
  const honeyCtrl = ([
    [-262, -110], [-170, -214], [-30, -190], [110, -232], [238, -120], [214, 22], [70, -40], [-70, 30], [-226, 70], [-214, 196],
    [-70, 240], [80, 170], [232, 206], [282, 90],
  ] as Pt[]).map(([dx, dy]) => [PC + dx, PC + dy] as Pt);
  const honey = honeyPaths(honeyCtrl, {hw: 13, minK: 0.45, maxK: 1.45, wave: 150, seed: 52, taperIn: 60, end: 'taper', pools: [{s: 520, r: 12}, {s: 1180, r: 14}, {s: 1900, r: 10}]});
  // crumbs over the whole plate
  const crumbs: Crumb[] = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 330;
    crumbs.push({x: PC + Math.cos(a) * rr, y: PC + Math.sin(a) * rr, s: 9 + r() ** 1.4 * 12, rot: r() * Math.PI, tone: r(), seed: Math.floor(r() * 1e6)});
  }
  // the scoops: spoon-bowl ovals (long along the pull direction). On the food side of each cut: an ink edge heavier
  // on the upper-left wall (the one in shade) and a lit lip on the lower-right wall (it faces the light).
  const cuts = PLATE_SCOOPS.map((g, i) =>
    g.cuts.map((c, k) => {
      const rot = (g.angle * Math.PI) / 180;
      const pts = blobPts(c.x, c.y, c.r * 1.12, c.r, 0.07, 200 + i * 5 + k, 36, 3, rot);
      // keep only the lower-right part of the oval for the lit lip
      const lit = blobPts(c.x, c.y, c.r * 1.12 + 4, c.r + 4, 0.07, 200 + i * 5 + k, 36, 3, rot).filter(([x, y]) => (x - c.x) * 0.6 + (y - c.y) * 0.8 > c.r * 0.25);
      return {
        pts,
        d: smoothD(pts, true),
        lip: lit.length > 4 ? brush(lit, {w: 12, taper: [0.3, 0.3], tip: 0.05, dense: true, seed: 70 + i * 5 + k, step: 4}) : '',
        ink: brush(pts, {w: 9, closed: true, start: 0.15, seed: 80 + i * 5 + k, shadow: 0.85, shadowDir: [-0.6, -0.8], step: 4}),
      };
    }),
  );
  // bits left behind on the plate: crumbs and a few seeds
  const leftovers: Crumb[] = [];
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const rr = 90 + Math.sqrt(r()) * 240;
    leftovers.push({x: PC + Math.cos(a) * rr, y: PC + Math.sin(a) * rr, s: 6 + r() * 8, rot: r() * Math.PI, tone: r(), seed: Math.floor(r() * 1e6)});
  }
  // what the spoons leave: a thin cream film where each bite was (residue), then the drag marks — teardrops that
  // start fat where the spoon went in and thin out towards the person pulling it back, each one bent its own way
  let residue = '';
  let smears = '';
  let smearShade = '';
  let smearHi = '';
  const honeySmears: HoneyPaths[] = [];
  PLATE_SCOOPS.forEach((g, i) => {
    if (i === PLATE_SCOOPS.length - 1) return; // the centre stays clean around the last drop
    const a0 = (g.angle * Math.PI) / 180;
    const mid = g.cuts[1];
    // broken patches of film (not a pillow per bite, and not the same for every bite — eaters are messy in
    // different ways: some bites leave nothing, some a big skid)
    const inn = g.cuts[2];
    const mess = [1, 0.4, 1.25, 0, 0.8, 1.1, 0.55][i % 7];
    if (mess > 0) {
      const da = (r() - 0.5) * 0.9;
      residue += shapeD(blobPts(inn.x, inn.y, inn.r * 0.75 * mess, inn.r * 0.5 * mess, 0.35, 600 + i, 18, 3, a0 + 0.3 + da), 4);
      if (mess > 0.7) residue += shapeD(blobPts(mid.x + Math.cos(a0 + da) * 40, mid.y + Math.sin(a0 + da) * 40, mid.r * 0.7 * mess, mid.r * 0.34, 0.4, 650 + i, 18, 4, a0 - 0.2 + da), 4);
    }
    const n = 1 + (i % 3 === 0 ? 1 : 0) + (r() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = a0 + (r() - 0.5) * 0.55;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const vx = -uy;
      const vy = ux;
      const r0 = 120 + r() * 70; // where the spoon went in (fat end)
      const r1 = r0 + 90 + r() * 110; // where it left (thin end)
      const off = (r() - 0.5) * 70;
      const bend = (r() - 0.5) * 70;
      const pts: Pt[] = [
        [PC + ux * r0 + vx * off, PC + uy * r0 + vy * off],
        [PC + ux * (r0 * 0.55 + r1 * 0.45) + vx * (off + bend), PC + uy * (r0 * 0.55 + r1 * 0.45) + vy * (off + bend)],
        [PC + ux * r1 + vx * (off + bend * 0.3), PC + uy * r1 + vy * (off + bend * 0.3)],
      ];
      const w = 24 + r() * 22;
      const o = {w, taper: [0.06, 0.85] as [number, number], tip: 0.06, jitter: 0.55, jitterLen: 26, nib: 0.45, seed: 300 + i * 3 + k};
      smears += brush(pts, o);
      smearShade += brush(pts.map(([x, y]) => [x + 3, y + 5] as Pt), o);
      smearHi += brush(pts.slice(0, 2).map(([x, y]) => [x - vx * w * 0.18 - 2, y - vy * w * 0.18 - 3] as Pt), {w: Math.max(3, w * 0.16), taper: [0.3, 0.6], tip: 0.05, seed: 400 + i * 3 + k});
    }
    if (i % 3 === 1) {
      const a = a0 + 0.35;
      const hp = honeyPaths(
        [0, 1, 2, 3].map((t) => [PC + Math.cos(a + t * 0.12) * (150 + t * 50), PC + Math.sin(a + t * 0.12) * (150 + t * 50)] as Pt),
        {hw: 4.5, minK: 0.4, maxK: 1.4, wave: 60, seed: 500 + i, taperIn: 30, end: 'taper'},
      );
      if (hp) honeySmears.push(hp);
    }
  });
  // someone scraped AROUND the plate (breaks the radial symmetry of the bites): a long curved wipe + a short one
  const wipe = (r0: number, a0: number, a1: number, w: number, seed: number) => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = a0 + ((a1 - a0) * k) / 8;
      const rr = r0 + 18 * Math.sin(k * 0.9) + k * 3;
      pts.push([PC + Math.cos(a) * rr, PC + Math.sin(a) * rr]);
    }
    const o = {w, taper: [0.05, 0.9] as [number, number], tip: 0.05, jitter: 0.6, jitterLen: 40, nib: 0.4, seed};
    smears += brush(pts, o);
    smearShade += brush(pts.map(([x, y]) => [x + 3, y + 5] as Pt), o);
    smearHi += brush(pts.slice(0, 4).map(([x, y]) => [x - 3, y - 4] as Pt), {w: w * 0.16, taper: [0.3, 0.6], tip: 0.05, seed: seed + 1});
  };
  wipe(250, 3.6, 4.85, 30, 900);
  wipe(205, 0.55, 1.25, 20, 910);
  // the tray: engraved rim band (petals + dots), a specular on the upper left
  const trayP = blobPts(PC, PC, TRAY_R, TRAY_R, 0.004, 9, 100, 2);
  const innerP = blobPts(PC, PC, TRAY_INNER, TRAY_INNER, 0.004, 10, 90, 2);
  let engrave = '';
  let dots = '';
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const p = (rad: number, da: number): Pt => [PC + Math.cos(a + da) * rad, PC + Math.sin(a + da) * rad];
    engrave += brush([p(489, -0.055), p(472, -0.03), p(468, 0), p(472, 0.03), p(489, 0.055)], {w: 2.6, taper: [0.25, 0.25], tip: 0.2, seed: 700 + k});
    dots += dotD(...p(483, 0.0785), 2.6);
  }
  return {
    plate: shapeD(plateP),
    plateInk: brush(plateP, {w: 11, closed: true, start: 0.6, seed: 21, shadow: 0.7, step: 4}),
    wellInk: brush(wellP, {w: 4.5, closed: true, start: 0.3, seed: 22, shadow: -0.5, step: 4}),
    rimHi: brush(ellipsePts(PC, PC, R_PLATE - 40, R_PLATE - 40, 30, Math.PI * 1.05, Math.PI * 1.5), {w: 16, taper: [0.35, 0.4], tip: 0.05, dense: true, seed: 23}),
    field: shapeD(fieldP),
    pieces,
    mound: lobes.map((l) => smoothD(l, true)),
    moundInk: brush(stack.silhouette, {w: 7, closed: true, dense: true, start: 0.2, seed: 31, shadow: 0.6, step: 3}),
    moundCreases: stack.creases.map((c, i) => brush(c, {w: 4.2, dense: true, taper: [0.3, 0.35], tip: 0.04, seed: 40 + i, step: 3})).join(''),
    moundHi:
      brush(ellipsePts(PC - 60, PC - 46, 60, 56, 10, Math.PI * 1.05, Math.PI * 1.45), {w: 13, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 33}) +
      brush(ellipsePts(PC + 66, PC - 34, 56, 52, 10, Math.PI * 1.05, Math.PI * 1.45), {w: 11, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 34}) +
      brush(ellipsePts(PC + 8, PC + 62, 60, 50, 10, Math.PI * 1.05, Math.PI * 1.4), {w: 10, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 36}) +
      brush(ellipsePts(PC - 8, PC - 8, 42, 40, 10, Math.PI * 1.05, Math.PI * 1.45), {w: 9, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 35}),
    honey,
    crumbs,
    cuts,
    leftovers,
    residue,
    smears,
    smearShade,
    smearHi,
    honeySmears,
    tray: {
      disk: shapeD(trayP, 4),
      inner: shapeD(innerP, 4),
      ink: brush(trayP, {w: 10, closed: true, start: 0.4, seed: 5, shadow: 0.7, step: 4}),
      innerInk: brush(innerP, {w: 3.4, closed: true, start: 0.7, seed: 6, shadow: -0.6, step: 4}),
      engrave,
      dots,
      hi:
        brush(ellipsePts(PC, PC, 481, 481, 20, Math.PI * 1.08, Math.PI * 1.42), {w: 9, taper: [0.35, 0.4], tip: 0.05, dense: true, seed: 24}) +
        brush(ellipsePts(PC, PC, 481, 481, 8, Math.PI * 0.08, Math.PI * 0.2), {w: 5, taper: [0.35, 0.4], tip: 0.05, dense: true, seed: 25}),
    },
  };
};
const getArt = () => (cached ??= build());

export type FamilyPlateProps = {
  /** parent px of the plate centre */
  x: number;
  y: number;
  /** 1 → plate ≈ 880 px across, tray ≈ 1000 px (art 1000 units) */
  scale?: number;
  /** 0..8 (fractional = the current bite digging in). 7 rim bites clear the ring, the 8th takes the centre mound */
  scoopsTaken?: number;
  /** round tray under the plate: true / 'brass' (engraved brass صينية), 'turquoise' (enamel), false = none */
  tray?: boolean | 'brass' | 'turquoise';
  /** rotate the whole plate (deg) — e.g. a slow drift under a top-down camera */
  rotate?: number;
  /** show the last cream drop (default: once the 8th, centre bite has started — never a spoiler before) */
  drop?: boolean;
  /** 0..1 jiggle of the drop (spots: a lonely wobble) */
  dropWobble?: number;
  /** the last drop: a glossy dollop (default) or the logo-dot shape */
  dropShape?: 'dollop' | 'dot';
  boil?: number;
  frame?: number;
  shadow?: string | false;
  style?: React.CSSProperties;
};

export const FamilyPlate2D: React.FC<FamilyPlateProps> = ({
  x,
  y,
  scale = 1,
  scoopsTaken = 0,
  tray = true,
  rotate = 0,
  drop,
  dropWobble = 0,
  dropShape = 'dollop',
  boil = 1,
  frame,
  shadow = 'rgba(5,63,59,0.4)',
  style,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const A = getArt();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `pm${uid}`;
  const plateClip = `pc${uid}`;
  const moundClip = `pmc${uid}`;
  const bPlate = useBoil({scale: 3 * boil, offset: 11, frame: f, freq: 0.016});
  const bFood = useBoil({scale: 2.6 * boil, offset: 12, frame: f, freq: 0.02});
  const S = scale;
  const N = PLATE_SCOOPS.length;
  const taken = Math.max(0, Math.min(N, scoopsTaken));
  // bite i progresses with (taken - i): its scallops dig in one after another (outer → inner), each grows from the
  // point where the spoon enters (the side towards the rim) — a scoop, not a pop
  const cutT = (i: number, k: number) => {
    const n = PLATE_SCOOPS[i].cuts.length;
    const t = Math.max(0, Math.min(1, taken - i));
    return easeOutCubic(Math.max(0, Math.min(1, t * n - k)));
  };
  const cutTransform = (i: number, k: number) => {
    const g = PLATE_SCOOPS[i];
    const c = g.cuts[k];
    const a = (g.angle * Math.PI) / 180;
    const ox = c.x + Math.cos(a) * c.r * 0.7;
    const oy = c.y + Math.sin(a) * c.r * 0.7;
    const sc = 0.15 + 0.85 * cutT(i, k);
    return `translate(${ox} ${oy}) scale(${sc}) translate(${-ox} ${-oy})`;
  };
  const visibleCuts: [number, number][] = [];
  PLATE_SCOOPS.forEach((g, i) => g.cuts.forEach((_, k) => cutT(i, k) > 0.001 && visibleCuts.push([i, k])));
  const empty = taken >= N - 0.001;
  const showDrop = drop ?? taken > N - 1;
  const dw = dropWobble;
  const trayKind = tray === true ? 'brass' : tray;
  const TC = trayKind ? TRAY_COLORS[trayKind] : null;
  // the food (masked by the bites) — drawn twice: once as the cast shadow on the plate, once for real
  const foodSilhouette = (
    <>
      <path d={A.field} />
      {A.mound.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </>
  );
  return (
    <svg width={1000 * S} height={1000 * S} viewBox="0 0 1000 1000" style={{position: 'absolute', left: x - PC * S, top: y - PC * S, overflow: 'visible', ...style}}>
      <defs>
        {bPlate.def}
        {bFood.def}
        <clipPath id={plateClip}>
          <path d={A.field} />
        </clipPath>
        <clipPath id={`${plateClip}o`}>
          <path d={A.plate} />
        </clipPath>
        <clipPath id={moundClip}>
          {A.mound.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <clipPath id={`${plateClip}t`}>
          <path d={A.tray.disk} />
        </clipPath>

        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={1000} height={1000}>
          <rect x={0} y={0} width={1000} height={1000} fill="#fff" />
          {visibleCuts.map(([i, k]) => (
            <path key={`${i}-${k}`} d={A.cuts[i][k].d} fill="#000" transform={cutTransform(i, k)} />
          ))}
        </mask>
      </defs>
      <g transform={`rotate(${rotate} ${PC} ${PC})`}>
        {/* the round tray (صينية) + its cast shadow */}
        {TC ? (
          <g filter={bPlate.url}>
            <path d={A.tray.disk} fill={INK} opacity={0.26} transform="translate(22 30)" />
            <path d={A.tray.disk} fill={TC.deep} />
            <path d={A.tray.disk} fill={TC.base} transform={`translate(${PC} ${PC}) scale(0.975) translate(${-PC - 5} ${-PC - 7})`} />
            <Halftone box={[0, 0, 1000, 1000]} cell={9} angle={25} fill={TC.deep} opacity={0.75} tone={[{t: 'lin', x0: 260, y0: 200, x1: 800, y1: 860, a: 0, b: 1, pow: 1.4}]} clipPath={`url(#${plateClip}t)`} />
            <path d={A.tray.inner} fill={TC.base} opacity={0.55} />
            <path d={A.tray.engrave} fill={TC.engrave} opacity={0.85} />
            <path d={A.tray.dots} fill={TC.engrave} opacity={0.85} />
            <path d={A.tray.hi} fill={TC.light} opacity={0.95} />
            <path d={A.tray.innerInk} fill={INK} opacity={0.55} />
            <path d={A.tray.ink} fill={INK} />
          </g>
        ) : null}
        {shadow ? (
          <Halftone box={[60, 80, 900, 900]} cell={9} angle={25} fill={shadow} tone={[{t: 'rad', cx: PC + 30, cy: PC + 38, r0: 420, r1: 466, a: 1, b: 0}]} />
        ) : null}

        {/* the plate */}
        <g filter={bPlate.url}>
          <path d={A.plate} fill={C.white} />
          <Halftone box={[40, 40, 920, 920]} cell={8} angle={30} fill="#D3E0DE" tone={[{t: 'rad', cx: PC - 90, cy: PC - 110, r0: 380, r1: 520, a: 0, b: 1}]} clipPath={`url(#${plateClip}o)`} />
          <path d={A.rimHi} fill={C.white} />
          {/* the well floor (seen once the food is gone): a little cream film, drag marks, honey streaks, crumbs */}
          <path d={A.field} fill="#F4F7F4" />
          <Halftone box={[140, 140, 720, 720]} cell={7} angle={30} fill="#CFDDD9" tone={[{t: 'rad', cx: PC - 60, cy: PC - 70, r0: 250, r1: 370, a: 0, b: 1}]} clipPath={`url(#${plateClip})`} />
          <g clipPath={`url(#${plateClip})`}>
            <path d={A.residue} fill={C.creamShade} opacity={0.3} transform="translate(3 5)" />
            <path d={A.residue} fill={C.cream} opacity={0.55} />
            <path d={A.smearShade} fill={C.creamDeep} opacity={0.5} />
            <path d={A.smears} fill={C.cream} />
            <path d={A.smearHi} fill={C.white} />
            {A.honeySmears.map((hp, i) => (
              <HoneyLayers key={i} p={hp} shadowOffset={[2, 3]} />
            ))}
            <Crumbs crumbs={A.leftovers} />
          </g>
          <path d={A.wellInk} fill={INK} opacity={0.7} />
          <path d={A.plateInk} fill={INK} />
          <g transform={`translate(${PC + Math.cos(-0.8) * 398} ${PC + Math.sin(-0.8) * 398}) rotate(18)`}>
            <Sticker r={40} seed={4} />
          </g>
        </g>

        {/* the last drop: only once the centre bite has started (it is the punchline — never a spoiler) */}
        {showDrop ? (
          <g transform={`translate(${PC + 6} ${PC + 50}) rotate(${-10 + 7 * dw}) scale(${1 + 0.1 * dw} ${1 - 0.08 * dw})`}>
            <Halftone box={[-80, -70, 180, 160]} cell={6} angle={20} fill={INK} opacity={0.4} tone={[{t: 'rad', cx: 16, cy: 18, r0: 50, r1: 80, a: 1, b: 0}]} />
            {dropShape === 'dot' ? <CreamDropArt h={104} which={0} squash={0.2} /> : <Dollop r={62} />}
          </g>
        ) : null}

        {/* the food, eaten bite by bite */}
        {!empty ? (
          <>
            {/* its cast shadow into the bites (the upper-left wall of each scoop throws shade on the plate) */}
            <g transform="translate(9 13)" opacity={0.2} clipPath={`url(#${plateClip})`}>
              <g mask={`url(#${maskId})`} fill={INK}>
                {foodSilhouette}
              </g>
            </g>
            <g mask={`url(#${maskId})`}>
              <g filter={bFood.url}>
                <path d={A.field} fill={C.cream} />
                <Halftone box={[140, 140, 720, 720]} cell={7} angle={30} fill="#EDD8AE" tone={[{t: 'rad', cx: PC - 60, cy: PC - 70, r0: 250, r1: 380, a: 0, b: 1}]} clipPath={`url(#${plateClip})`} />
                {A.pieces.map((p, i) => (
                  <FruitPiece key={i} kind={p.kind} s={p.s} seed={p.seed} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)})`} />
                ))}
                {A.mound.map((d, i) => (
                  <path key={i} d={d} fill={C.cream} />
                ))}
                <Halftone box={[340, 340, 320, 320]} cell={7} angle={30} fill="#E8CF9E" tone={[{t: 'rad', cx: PC - 50, cy: PC - 50, r0: 70, r1: 190, a: 0, b: 1}]} clipPath={`url(#${moundClip})`} />
                <path d={A.moundHi} fill={C.white} />
                <path d={A.moundCreases} fill={INK} opacity={0.85} />
                <path d={A.moundInk} fill={INK} />
                {A.honey ? <HoneyLayers p={A.honey} shadowOffset={[4, 7]} /> : null}
                <Crumbs crumbs={A.crumbs} />
                <FruitPiece kind="strawberry" s={96} seed={21} transform={`translate(${PC + 18} ${PC - 30}) rotate(-24)`} />
                {/* the scoop edges, on the food that is left: ink (heavier on the shaded upper-left wall) + lit lip */}
                <g clipPath={`url(#${plateClip})`}>
                  {visibleCuts.map(([i, k]) => (
                    <g key={`${i}-${k}`} transform={cutTransform(i, k)}>
                      <path d={A.cuts[i][k].lip} fill={C.white} opacity={0.9} />
                      <path d={A.cuts[i][k].ink} fill={INK} />
                    </g>
                  ))}
                </g>
              </g>
            </g>
          </>
        ) : null}
      </g>
    </svg>
  );
};


/** A single glossy qashta dollop seen from above (round, a soft swirl to a little peak). Around (0,0), radius r. */
export const Dollop: React.FC<{r: number}> = ({r}) => {
  const g = useMemo(() => {
    const body = blobPts(0, 0, r, r * 0.92, 0.11, 61, 36, 3);
    const swirl: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = 0.6 + t * Math.PI * 2.1;
      const rr = r * (0.78 - 0.62 * t);
      swirl.push([Math.cos(a) * rr - r * 0.05 * t, Math.sin(a) * rr - r * 0.08 * t]);
    }
    return {
      body: shapeD(body),
      ink: brush(body, {w: Math.max(3, r * 0.075), closed: true, start: 0.3, seed: 62, shadow: 0.8}),
      bounce: brush(ellipsePts(r * 0.02, r * 0.04, r * 0.82, r * 0.78, 12, -Math.PI * 0.15, Math.PI * 0.55), {w: r * 0.09, taper: [0.4, 0.4], tip: 0.05, dense: false, seed: 65}),
      swirl: brush(swirl, {w: r * 0.08, taper: [0.2, 0.5], tip: 0.05, dense: true, seed: 63}),
      hi: brush(ellipsePts(-r * 0.1, -r * 0.12, r * 0.62, r * 0.58, 10, Math.PI * 1.05, Math.PI * 1.45), {w: r * 0.2, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 64}),
    };
  }, [r]);
  return (
    <g>
      <path d={g.body} fill={C.creamDeep} />
      <path d={g.body} fill={C.cream} transform={`translate(${-r * 0.08} ${-r * 0.1}) scale(0.9)`} />
      <path d={g.bounce} fill={C.turquoiseLight} opacity={0.6} />
      <path d={g.swirl} fill={C.creamDeep} opacity={0.9} />
      <path d={g.hi} fill={C.white} />
      <circle cx={r * 0.3} cy={-r * 0.36} r={r * 0.08} fill={C.white} />
      <path d={g.ink} fill={INK} />
    </g>
  );
};
