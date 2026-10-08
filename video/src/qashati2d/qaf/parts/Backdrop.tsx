// The two worlds' paper backdrops (drawn big, in their own parallax plane):
//   <QashtaPaper/> turquoise sheet, a deeper-turquoise halftone print vignette, and a loose wallpaper of the brand's
//                  two drops (the logo's ق dots) printed tone-on-tone — the world is "made of" the brand.
//   <ChiliPaper/>  chili-red sheet, dark-red halftone, scattered chili flakes and seeds (tone-on-tone).
// Static geometry is memoised; the pattern "re-photographs" on twos (a 1-px jitter) like the paper grain.
import React, {useMemo} from 'react';
import {qashatiLogo as LOGO} from '../../../qashati/logoPaths';
import {blobPts, brush, C, ellipsePts, Halftone, Pt, rng, shapeD} from '../../kit/lib';

const BOX = {x: -700, y: -900, w: 2480, h: 3900};

type Item = {x: number; y: number; s: number; r: number; k: number};
const scatter = (seed: number, cell: number, sMin: number, sMax: number): Item[] => {
  const r = rng(seed);
  const out: Item[] = [];
  for (let gy = BOX.y; gy < BOX.y + BOX.h; gy += cell) {
    const row = Math.round((gy - BOX.y) / cell);
    for (let gx = BOX.x + (row % 2) * cell * 0.5; gx < BOX.x + BOX.w; gx += cell) {
      if (r() < 0.18) continue;
      out.push({x: gx + (r() - 0.5) * cell * 0.7, y: gy + (r() - 0.5) * cell * 0.7, s: sMin + r() * (sMax - sMin), r: (r() - 0.5) * 150, k: Math.floor(r() * 3)});
    }
  }
  return out;
};

// logo dots: bbox in logo units (see kit CreamDrop)
const DOT_BOX = {x0: 751, y0: 1.5, x1: 1165, y1: 326.4};

export const QashtaPaper: React.FC<{frame: number}> = ({frame}) => {
  const items = useMemo(() => scatter(11, 190, 0.5, 0.8), []);
  const j = rng(Math.floor(frame / 2) * 7 + 3);
  const jx = (j() - 0.5) * 1.6;
  const jy = (j() - 0.5) * 1.6;
  const k = 70 / (DOT_BOX.y1 - DOT_BOX.y0);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <g id="qafDropPair">
          <g transform={`scale(${k}) translate(${-(DOT_BOX.x0 + DOT_BOX.x1) / 2} ${-(DOT_BOX.y0 + DOT_BOX.y1) / 2})`}>
            <path d={LOGO.dots[0]} />
            <path d={LOGO.dots[1]} />
          </g>
        </g>
      </defs>
      <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} fill={C.turquoise} />
      <Halftone
        box={[BOX.x, BOX.y, BOX.w, BOX.h]}
        cell={15}
        angle={18}
        fill={C.turquoiseShade}
        tone={[{t: 'rad', cx: 540, cy: 900, r0: 520, r1: 1500, a: 0, b: 1, sx: 1, sy: 1.3}, {t: 'noise', amp: 0.25, freq: 0.004, seed: 4}]}
      />
      <g transform={`translate(${jx} ${jy})`} fill={C.turquoiseLight} opacity={0.34}>
        {items.map((it, i) => (
          <use key={i} href="#qafDropPair" transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.r.toFixed(1)}) scale(${it.s.toFixed(2)})`} />
        ))}
      </g>
    </svg>
  );
};

const flakeShapes = (() => {
  const r = rng(77);
  return [0, 1, 2].map((i) => {
    const n = 5 + i;
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = 9 + r() * 9;
      pts.push([Math.cos(a) * rr * (1.4 - 0.3 * i), Math.sin(a) * rr * 0.7]);
    }
    return shapeD(pts, 3);
  });
})();

// a deeper crimson than the chili cup (#E5303A), so the red-hot cup still pops off the red world
const CHILI_BG = '#C01E2B';
const CHILI_HT = '#86101B';

export const ChiliPaper: React.FC<{frame: number}> = ({frame}) => {
  const items = useMemo(() => scatter(23, 120, 0.8, 1.6), []);
  const j = rng(Math.floor(frame / 2) * 7 + 9);
  const jx = (j() - 0.5) * 1.6;
  const jy = (j() - 0.5) * 1.6;
  const seed = useMemo(() => shapeD(ellipsePts(0, 0, 7, 4.5, 10)), []);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        {flakeShapes.map((d, i) => (
          <path key={i} id={`qafFlake${i}`} d={d} />
        ))}
        <path id="qafSeed" d={seed} />
      </defs>
      <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} fill={CHILI_BG} />
      <Halftone
        box={[BOX.x, BOX.y, BOX.w, BOX.h]}
        cell={13}
        angle={22}
        fill={CHILI_HT}
        opacity={0.6}
        tone={[{t: 'rad', cx: 540, cy: 900, r0: 380, r1: 1400, a: 0.05, b: 1, sx: 1, sy: 1.25}, {t: 'noise', amp: 0.3, freq: 0.005, seed: 6}]}
      />
      <g transform={`translate(${jx} ${jy})`}>
        {items.map((it, i) =>
          it.k === 2 ? (
            <use key={i} href="#qafSeed" fill="#E8735E" opacity={0.6} transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${(it.r * 2).toFixed(1)}) scale(${it.s.toFixed(2)})`} />
          ) : (
            <use key={i} href={`#qafFlake${it.k}`} fill={CHILI_HT} opacity={0.7} transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${(it.r * 3).toFixed(1)}) scale(${it.s.toFixed(2)})`} />
          ),
        )}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ bloom / wave shapes
/** the boiling edge of a spreading ink region (world px) — redrawn on twos */
export const spreadPts = (c: Pt, r: number, frame: number, seed: number, amp = 0.09): Pt[] =>
  blobPts(c[0], c[1], r, r, amp, seed + (Math.floor(frame / 2) % 3) * 17, 84, 5);

export const ptsToPath = (pts: Pt[]) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;

/** the red bloom's edge: a dark ink line with a hot inner band (drawn in the world, under the props) */
export const BloomEdge: React.FC<{pts: Pt[]; w: number}> = ({pts, w}) => (
  <g>
    <path d={brush(pts, {w: w * 2.6, closed: true, dense: true, seed: 5, jitter: 0.4, jitterLen: 40})} fill={C.chiliHot} opacity={0.85} />
    <path d={brush(pts, {w, closed: true, dense: true, seed: 6, jitter: 0.5, jitterLen: 30})} fill={C.chiliDeep} />
  </g>
);

/** the qashta wave's FRONT (world px): not an iris circle — a lumpy liquid wash racing out of the ق, with a few
 *  tongues that run ahead (a breaking, splashing edge). Periodic by construction (integer harmonics) and redrawn on
 *  twos (the small ripples change phase each drawing). Shared by the red clip and the crest so they always match. */
const TONGUES: {a: number; g: number; p: number}[] = [
  {a: -2.75, g: 1.0, p: 18},
  {a: -1.95, g: 0.7, p: 26},
  {a: -1.2, g: 0.85, p: 20},
  {a: -0.35, g: 0.6, p: 28},
  {a: 0.55, g: 1.0, p: 16},
  {a: 1.35, g: 0.75, p: 24},
  {a: 2.05, g: 0.95, p: 18},
  {a: 2.8, g: 0.65, p: 26},
];
export const wavePts = (c: Pt, r: number, frame: number, n = 160): Pt[] => {
  const f2 = Math.floor(frame / 2);
  const ph = (f2 % 3) * 2.1;
  // tongues lead the front by up to ~15% of the radius (capped), the slow lobes give it a hand-cut, uneven belly
  const lead = Math.min(0.15 * r, 210);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI;
    let k = 0.045 * Math.sin(3 * a + 0.7) + 0.03 * Math.sin(5 * a + 2.1) + 0.012 * Math.sin(11 * a + ph) + 0.008 * Math.sin(19 * a - ph * 1.3);
    let t = 0;
    for (const T of TONGUES) t += T.g * Math.max(0, Math.cos(a - T.a)) ** T.p;
    const rr = Math.max(0, r * (1 + k) + lead * Math.min(1.2, t));
    out.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]);
  }
  return out;
};

/** the wave's crest: a thick band of glossy qashta riding the turquoise front, inked, with foam beads and a few
 *  droplets flung off the tongue tips */
export const WaveCrest: React.FC<{c: Pt; r: number; frame: number; w: number}> = ({c, r, frame, w}) => {
  const f2 = Math.floor(frame / 2);
  const band = (d: number) => wavePts(c, r - w * d, frame);
  const outer = band(0);
  const mid = band(0.45);
  const inner = band(0.9);
  const rr = rng(300 + f2);
  const beads = outer
    .filter((_, i) => i % 4 === f2 % 4)
    .map(([x, y]) => {
      const dx = x - c[0];
      const dy = y - c[1];
      const L = Math.hypot(dx, dy) || 1;
      const off = w * (0.15 + rr() * 0.3);
      return {x: x + (dx / L) * off, y: y + (dy / L) * off, r: w * (0.1 + rr() * 0.12)};
    });
  // droplets thrown ahead of each tongue (they lead the front by 0.4–1.1 w, on twos)
  const lead = Math.min(0.15 * r, 210);
  const flung = TONGUES.flatMap((T, j) => {
    const rj = rng(700 + j * 13 + (f2 % 3));
    return [0, 1].map((m) => {
      const a = T.a + (rj() - 0.5) * 0.12;
      const d = r + lead * T.g * 0.95 + w * (0.5 + 0.7 * rj() + m * 0.6);
      return {x: c[0] + d * Math.cos(a), y: c[1] + d * Math.sin(a), r: w * (0.16 - m * 0.05) * (0.8 + 0.4 * rj())};
    });
  });
  return (
    <g>
      {/* turquoise light just behind the crest (the wet front) */}
      <path d={ptsToPath(outer) + ptsToPath(inner.slice().reverse())} fill={C.turquoiseLight} fillRule="evenodd" opacity={0.9} />
      <path d={brush(mid, {w: w * 0.8, closed: true, dense: true, seed: 42, jitter: 0.35, jitterLen: 60})} fill={C.cream} />
      <path d={brush(band(0.62), {w: w * 0.2, closed: true, dense: true, seed: 43, jitter: 0.6, jitterLen: 35})} fill={C.creamShade} />
      <path d={brush(band(0.3), {w: w * 0.14, closed: true, dense: true, seed: 44, jitter: 0.9, jitterLen: 25})} fill={C.white} />
      <path d={brush(band(0.04), {w: w * 0.16, closed: true, dense: true, seed: 45, jitter: 0.5, jitterLen: 40})} fill={C.teal} />
      {[...beads, ...flung].map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={C.cream} stroke={C.teal} strokeWidth={Math.max(2, w * 0.05)} />
          <circle cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.3} r={b.r * 0.3} fill={C.white} />
        </g>
      ))}
    </g>
  );
};
