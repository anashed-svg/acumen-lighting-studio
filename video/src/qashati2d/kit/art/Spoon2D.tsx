// A steel teaspoon, hand-inked. Local coords: the BOWL centre is (0,0), the handle runs up (−y) to ≈ −330.
// <SpoonArt> is an SVG group (embed it in any svg); <Spoon2D> is a positioned stand-alone svg.
//   load  0..1  heaped qashta in the bowl (with a honey bead + a pistachio crumb)
//   melt  0..1  the spoon droops and drips (the qaf spot's heat gag) — handle bends, bowl sags, drips form
//   sweat 0..1  drawn sweat drops flicking off (on twos)
//   palette 'steel' | 'turquoise' (a brand plastic spoon)
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, catmull, ellipsePts, Pt, rng, shapeD, smoothD} from '../geom';
import {useBoil} from '../look/Boil';
import {C, INK} from '../palette';

export const SPOON_LEN = 330;

type SpoonGeo = {handle: string; handleInk: string; bowl: string; bowlInk: string; inner: string; spec: string; spec2: string; drips: string};

const spoonGeo = (melt: number): SpoonGeo => {
  // spine from the bowl (t=0) to the handle end (t=1); melt bends it sideways and lets it sag
  const N = 16;
  const spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = -46 - t * (SPOON_LEN - 46);
    const x = melt * (70 * (1 - t) ** 2 - 20 * t);
    spine.push([x, y + melt * 40 * (1 - t) ** 1.5]);
  }
  const width = (t: number) => (t < 0.12 ? 9 + (1 - t / 0.12) * 8 : 9 + 13 * ((t - 0.12) / 0.88) ** 1.4);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(N, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    const w = width(i / N) / 2;
    left.push([spine[i][0] - (ty / tl) * w, spine[i][1] + (tx / tl) * w]);
    right.push([spine[i][0] + (ty / tl) * w, spine[i][1] - (tx / tl) * w]);
  }
  const end = spine[N];
  const cap = ellipsePts(end[0], end[1], 12, 12, 10, Math.PI * 0.05, Math.PI * 0.95).map(([x, y]) => [x, 2 * end[1] - y] as Pt);
  const handlePts = [...left, ...cap.reverse(), ...right.reverse()];
  // the bowl sags with melt
  const sag = melt * 0.35;
  const bowlPts: Pt[] = ellipsePts(0, 0, 38, 52, 40).map(([x, y]) => [x * (1 - sag * 0.2) + melt * 10 * (y / 52), y * (1 + (y > 0 ? 0.12 + sag : 0))] as Pt);
  const inner = ellipsePts(-3, -6, 27, 38, 30).map(([x, y]) => [x * (1 - sag * 0.2), y * (1 + (y > 0 ? sag : 0))] as Pt);
  let drips = '';
  if (melt > 0.25) {
    const k = (melt - 0.25) / 0.75;
    for (const [dx, len] of [[-12, 34], [10, 52], [24, 22]] as const) {
      const L = len * k;
      const yb = 52 * (1 + 0.12 + sag) - 4;
      drips += shapeD([[dx - 6, yb - 6], [dx + 6, yb - 6], [dx + 4, yb + L * 0.6], [dx + 7, yb + L], [dx, yb + L + 8], [dx - 7, yb + L], [dx - 4, yb + L * 0.6]], 6);
    }
  }
  return {
    handle: smoothD(handlePts, true),
    handleInk: brush(handlePts, {w: 4.2, closed: true, dense: true, start: 0.5, seed: 11}),
    bowl: shapeD(bowlPts),
    bowlInk: brush(bowlPts, {w: 5, closed: true, dense: true, start: 0.15, seed: 12}),
    inner: shapeD(inner),
    spec: brush(
      spine.slice(3, 14).map(([x, y]) => [x - 3, y] as Pt),
      {w: 4, taper: [0.3, 0.4], dense: false, seed: 13},
    ),
    spec2: brush(catmull([[-22, 10], [-24, -14], [-12, -34]], false, 6), {w: 6, taper: [0.3, 0.5], dense: true, seed: 14}),
    drips,
  };
};

export const SpoonArt: React.FC<{
  load?: number;
  melt?: number;
  sweat?: number;
  palette?: 'steel' | 'turquoise';
  /** coat of cream on the bowl after a dip (0..1) */
  coat?: number;
  frame?: number;
  boil?: number;
}> = ({load = 0, melt = 0, sweat = 0, palette = 'steel', coat = 0, frame, boil = 1}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const mq = Math.round(melt * 20) / 20;
  const g = useMemo(() => spoonGeo(mq), [mq]);
  const b = useBoil({scale: 2.4 * boil, offset: 41, frame: f, freq: 0.03});
  const [base, shade, deep] = palette === 'steel' ? [C.steel, C.steelShade, C.steelDeep] : [C.turquoise, C.turquoiseShade, C.turquoiseDeep];
  // a heaped scoop with a soft peak that curls over (a dollop, never a ball)
  const heap: Pt[] | null =
    load > 0.01
      ? (() => {
          const k = Math.sqrt(load);
          const ctrl: Pt[] = [
            [-40 * k, 8], [-38 * k, -14 * load], [-22 * k, -30 * load], [-4, -40 * load], [8, -54 * load], [22, -50 * load],
            [14, -40 * load], [30 * k, -30 * load], [40 * k, -10 * load], [36 * k, 8],
          ];
          return catmull(ctrl, true, 6);
        })()
      : null;
  const r = rng(Math.floor(f / 2) * 3 + 5);
  return (
    <g>
      <defs>{b.def}</defs>
      <g filter={b.url}>
        <path d={g.handle} fill={shade} />
        <path d={g.handle} fill={base} transform="translate(-2.5 -1) scale(0.985 1)" />
        <path d={g.spec} fill={C.white} opacity={0.9} />
        <path d={g.handleInk} fill={INK} />
        <path d={g.bowl} fill={deep} />
        <path d={g.bowl} fill={base} transform="translate(-3 -3) scale(0.93)" />
        <path d={g.inner} fill={shade} />
        <path d={g.spec2} fill={C.white} opacity={0.95} />
        {coat > 0 ? <path d={g.inner} fill={C.cream} opacity={Math.min(1, coat)} transform="scale(0.9) translate(0 6)" /> : null}
        {g.drips ? <path d={g.drips} fill={base} stroke={INK} strokeWidth={3} /> : null}
        <path d={g.bowlInk} fill={INK} />
        {heap ? (
          <g>
            <path d={shapeD(heap)} fill={C.creamShade} />
            <path d={shapeD(heap)} fill={C.cream} transform={`translate(-3 ${-4 + (-10 - 16 * load) * 0.08}) scale(0.92)`} />
            <path d={brush(heap, {w: 4, closed: true, dense: true, start: 0.6, seed: 15})} fill={INK} />
            <path d={brush([[-6, -26 * load], [6, -36 * load], [16, -44 * load]], {w: 2.6, taper: [0.3, 0.6], seed: 17})} fill={INK} opacity={0.7} />
            <path
              d={brush([[-24 * Math.sqrt(load), -14 - 22 * load], [-10, -18 - 34 * load], [8, -16 - 36 * load]], {w: 6, taper: [0.3, 0.5], seed: 16})}
              fill={C.white}
              opacity={0.95}
            />
            <path d={shapeD(blobPts(12, -14 - 26 * load, 9, 6, 0.1, 9, 12, 2))} fill={C.honey} stroke={C.honeyDeep} strokeWidth={1.5} />
            <path d={shapeD(blobPts(-14, -8 - 28 * load, 5, 4, 0.3, 19, 8, 2))} fill={C.pistachio} stroke={C.pistachioDeep} strokeWidth={1} />
          </g>
        ) : null}
      </g>
      {sweat > 0
        ? [0, 1, 2].map((i) => {
            const ph = ((Math.floor(f / 2) * 2 + i * 9) % 24) / 24;
            const x = (i - 1) * 46 + (r() - 0.5) * 6;
            const y = -120 - i * 50 + ph * 60;
            const sx = i === 1 ? 0 : (i - 1) * 30 * ph;
            return (
              <path
                key={i}
                d={shapeD([[x + sx, y - 14], [x + sx + 7, y + 2], [x + sx, y + 9], [x + sx - 7, y + 2]], 6)}
                fill="#BFF4FF"
                stroke={INK}
                strokeWidth={2.5}
                opacity={sweat * (1 - ph * 0.6)}
              />
            );
          })
        : null}
    </g>
  );
};

/** Stand-alone spoon: bowl centre at (x, y) parent px, rotated `angle` degrees (0 = handle straight up). */
export const Spoon2D: React.FC<React.ComponentProps<typeof SpoonArt> & {x: number; y: number; angle?: number; scale?: number; style?: React.CSSProperties}> = ({
  x,
  y,
  angle = 0,
  scale = 1,
  style,
  ...p
}) => {
  const S = 420;
  return (
    <svg width={S * 2 * scale} height={S * 2 * scale} viewBox={`${-S} ${-S} ${2 * S} ${2 * S}`} style={{position: 'absolute', left: x - S * scale, top: y - S * scale, overflow: 'visible', ...style}}>
      <g transform={`rotate(${angle})`}>
        <SpoonArt {...p} />
      </g>
    </svg>
  );
};
