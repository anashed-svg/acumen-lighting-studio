// <HeapArt/> — the gag under the words: every "just one spoon" leaves with a HEAP. Top-down, a mound of qashta lobes
// (one inked union silhouette with light creases — the kit's dome language), cel-shaded with the light from the upper
// left (shade crescent + halftone on the lower right, a cool turquoise bounce light on the shadow rim, broken white
// speculars on the lit side), fruit pieces riding on it, a honey streak, pistachio crumbs, and a soft cast shadow.
// `size` 1 = a generous heaped spoon … 2+ = absurd (wider than two spoon bowls). Drawn around (0,0) = the heap's
// centre, in SCREEN orientation (the caller counter-rotates it so the light stays upper-left whatever the arm angle).
// Geometry is built once per (size, seed); `grow` 0..1 scales it in while the spoon scoops (on twos, by the caller).
import React, {useId, useMemo} from 'react';
import {HoneyLayers, honeyPaths} from '../../kit/art/Honey';
import {blobPts, brush, C, Crumbs, ellipsePts, FruitKind, FruitPiece, Halftone, INK, Pt, rng, scatterCrumbs, smoothD, stackOutline, useBoil} from '../../kit/lib';

type HeapGeo = {
  R: number;
  sil: string;
  silPts: Pt[];
  lobes: string[];
  lobesLit: string[];
  ink: string;
  creases: string;
  bounce: string;
  spec: string;
  fruit: {kind: FruitKind; s: number; seed: number; x: number; y: number; rot: number}[];
  honey: ReturnType<typeof honeyPaths>;
  crumbs: ReturnType<typeof scatterCrumbs>;
};

const cache = new Map<string, HeapGeo>();

const buildHeap = (size: number, seed: number, first: FruitKind): HeapGeo => {
  const r = rng(seed * 13 + 7);
  const R = 56 * size;
  const base = blobPts(0, 0, R, R * 0.9, 0.12, seed, 40, 4, r() * Math.PI);
  // lobes, back → front: a ring of dollops, then the peak (towards the light, upper left)
  const n = 3 + Math.round(size * 1.6);
  const lobes: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const d = R * (0.32 + r() * 0.2);
    const rr = R * (0.42 + r() * 0.16);
    lobes.push(blobPts(Math.cos(a) * d, Math.sin(a) * d * 0.92, rr, rr * (0.86 + r() * 0.1), 0.1, seed + 10 + i, 26, 3, r() * 3));
  }
  lobes.push(blobPts(-R * 0.1, -R * 0.14, R * 0.46, R * 0.4, 0.12, seed + 40, 28, 3, 0.4));
  const stack = stackOutline([base, ...lobes], [0, 0], 3);
  const silPts = stack.silhouette;
  const lit = (pts: Pt[]) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return smoothD(pts.map(([x, y]) => [cx + (x - cx) * 0.84 - R * 0.05, cy + (y - cy) * 0.84 - R * 0.06] as Pt), true);
  };
  // the cool bounce light on the lower-right rim (only the silhouette points facing away from the light)
  const rim = silPts.filter(([x, y]) => x * 0.6 + y * 0.8 > R * 0.55);
  rim.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const bounce = rim.length > 4 ? brush(rim.map(([x, y]) => [x * 0.93, y * 0.93] as Pt), {w: 5 + size * 1.5, taper: [0.35, 0.35], tip: 0.05, dense: true, seed: seed + 3}) : '';
  // broken speculars on the lit (upper-left) side of the peak + one lobe
  const pk = lobes[lobes.length - 1];
  const pcx = pk.reduce((s, p) => s + p[0], 0) / pk.length;
  const pcy = pk.reduce((s, p) => s + p[1], 0) / pk.length;
  const spec =
    brush(ellipsePts(pcx - R * 0.06, pcy - R * 0.04, R * 0.3, R * 0.24, 10, Math.PI * 1.08, Math.PI * 1.42), {w: 4 + size * 2.4, taper: [0.4, 0.5], tip: 0.05, dense: true, seed: seed + 4}) +
    brush(ellipsePts(pcx - R * 0.06, pcy - R * 0.04, R * 0.3, R * 0.24, 6, Math.PI * 1.5, Math.PI * 1.62), {w: 3 + size * 1.6, taper: [0.4, 0.4], tip: 0.1, dense: true, seed: seed + 5}) +
    brush(ellipsePts(-R * 0.42, R * 0.18, R * 0.22, R * 0.16, 8, Math.PI * 1.1, Math.PI * 1.45), {w: 3 + size * 1.4, taper: [0.4, 0.5], tip: 0.05, dense: true, seed: seed + 6});
  // fruit riding on the heap (more on a bigger heap); the hand's own garnish first, on top of the peak
  const kinds: FruitKind[] = [first, 'strawberryCut', 'mango', 'kiwi', 'strawberryCut', 'mango'];
  const nf = Math.min(kinds.length, 1 + Math.floor(size * 1.7));
  const fruit = Array.from({length: nf}).map((_, i) => {
    const a = i === 0 ? -2.2 : (i / nf) * Math.PI * 2 + r() * 0.8;
    const d = i === 0 ? R * 0.18 : R * (0.35 + r() * 0.25);
    const kind = kinds[i];
    return {kind, s: kind === 'mango' ? 34 + r() * 6 : 40 + r() * 8, seed: seed * 3 + i, x: Math.cos(a) * d, y: Math.sin(a) * d, rot: r() * 360};
  });
  // a honey streak across the top, pooling in a valley
  const hy = -R * 0.05;
  const honey = honeyPaths(
    [
      [-R * 0.85, hy + R * 0.2],
      [-R * 0.4, hy - R * 0.12],
      [0, hy + R * 0.08],
      [R * 0.42, hy - R * 0.2],
      [R * 0.7, hy + R * 0.05],
    ],
    {hw: 5 + 3 * Math.sqrt(size), seed: seed + 8, pools: [{s: R * 0.95, r: 4 + size * 2}], end: 'bead', bead: 6 + size * 2, taperIn: R * 0.2},
  );
  const crumbs = scatterCrumbs(Math.round(5 + 6 * size), seed + 9, [-R, -R, 2 * R, 2 * R], (x, y) => x * x + y * y < (R * 0.78) ** 2, 5, 10);
  return {
    R,
    sil: smoothD(silPts, true),
    silPts,
    lobes: [smoothD(base, true), ...lobes.map((l) => smoothD(l, true))],
    lobesLit: [lit(base), ...lobes.map(lit)],
    ink: brush(silPts, {w: 4.6 + size * 0.8, closed: true, dense: true, start: 0.2, seed: seed + 1, shadow: 0.65}),
    creases: stack.creases.map((run, i) => brush(run, {w: 2.4 + size * 0.4, taper: [0.3, 0.45], tip: 0.1, dense: true, seed: seed + 20 + i})).join(''),
    bounce,
    spec,
    fruit,
    honey,
    crumbs,
  };
};

export const heapGeo = (size: number, seed: number, first: FruitKind) => {
  const key = `${size.toFixed(2)}|${seed}|${first}`;
  let g = cache.get(key);
  if (!g) {
    g = buildHeap(size, seed, first);
    cache.set(key, g);
  }
  return g;
};

export const HeapArt: React.FC<{size: number; seed: number; first?: FruitKind; grow?: number; frame: number; silhouette?: string; wobble?: number}> = ({
  size,
  seed,
  first = 'strawberryCut',
  grow = 1,
  frame,
  silhouette,
  wobble = 0,
}) => {
  const g = heapGeo(size, seed, first);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const b = useBoil({scale: 2.6, offset: 70 + seed, frame, freq: 0.03});
  if (grow <= 0.01) return null;
  // grow from the spoon bowl (a little lag on the peak = viscous) + a jelly wobble when the hand jerks
  const t = `scale(${grow * (1 + 0.05 * wobble)} ${grow * (1 - 0.05 * wobble)})`;
  if (silhouette) return <path d={g.sil} fill={silhouette} transform={t} />;
  const R = g.R;
  return (
    <g transform={t}>
      <defs>
        {b.def}
        <clipPath id={`hp${uid}`}>
          <path d={g.sil} />
        </clipPath>
      </defs>
      {/* contact shadow on the spoon/hand below */}
      <path d={g.sil} fill={INK} opacity={0.22} transform={`translate(${6 + size * 4} ${9 + size * 5})`} />
      <g filter={b.url}>
        <path d={g.sil} fill={C.creamDeep} />
        {g.lobes.map((d, i) => (
          <path key={i} d={d} fill={C.creamShade} />
        ))}
        {g.lobesLit.map((d, i) => (
          <path key={i} d={d} fill={C.cream} />
        ))}
        <Halftone
          box={[-R * 1.1, -R * 1.1, R * 2.2, R * 2.2]}
          cell={6}
          angle={30}
          fill={C.creamDeep}
          opacity={0.9}
          tone={[{t: 'lin', x0: -R * 0.3, y0: -R * 0.3, x1: R * 0.9, y1: R * 0.9, a: 0, b: 1, pow: 1.6}]}
          clipPath={`url(#hp${uid})`}
        />
        <path d={g.bounce} fill={C.turquoiseLight} opacity={0.75} />
        {/* (review: full-strength creases radiating from the centre read as dumpling pleats — keep them soft) */}
        <path d={g.creases} fill={INK} opacity={0.42} />
        <path d={g.spec} fill={C.white} opacity={0.95} />
        <path d={g.ink} fill={INK} />
        {g.fruit.map((p, i) => (
          <FruitPiece key={i} kind={p.kind} s={p.s} seed={p.seed} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)})`} />
        ))}
        {g.honey ? <HoneyLayers p={g.honey} shadowOffset={[3, 5]} /> : null}
        <Crumbs crumbs={g.crumbs} />
      </g>
    </g>
  );
};
