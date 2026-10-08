// <FlameArt>/<Flame2D> — a hand-drawn flame (red → orange → yellow, teal ink) that flickers ON TWOS: every 2 frames the
// tongues are redrawn (noise seeded by the drawing number). For the qaf spot's «شطة» heat gag (letters catching fire,
// flames on the chili cup — see HeroCup2D CUP_ANCHORS.flames).
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {brush, catmull, noise1, Pt, smoothD} from '../geom';
import {C, INK} from '../palette';

const OUTER: Pt[] = [
  [-0.3, 0.02], [-0.36, -0.22], [-0.25, -0.46], [-0.3, -0.7], [-0.1, -0.56], [0, -1], [0.1, -0.6], [0.26, -0.8], [0.31, -0.46],
  [0.35, -0.2], [0.26, 0.04], [0, 0.1],
];

// each flame (seed) gets its own silhouette: tongue heights, a lean and a width — never the same stamp twice
const TONGUES = [3, 5, 7];
const flamePts = (h: number, k: number, seed: number, scaleW = 1, scaleH = 1, intensity = 1): Pt[] => {
  const shape = Math.floor(seed);
  const lean = 0.14 * noise1(shape * 3.1 + 0.5, 77);
  const wide = 1 + 0.16 * noise1(shape * 1.7 + 0.2, 78);
  return OUTER.map(([x, y], i) => {
    const tip = Math.min(1, -y * 1.1); // tips move more than the base
    const tongue = TONGUES.includes(i) ? 1 + 0.32 * noise1(shape * 2.3 + i * 0.9, 79) : 1;
    const ax = noise1(k * 0.83 + i * 1.7, seed) * 0.12 * tip * intensity;
    const ay = noise1(k * 0.71 + i * 2.3, seed + 5) * 0.16 * tip * intensity;
    const yy = y * tongue * scaleH * (1 + 0.1 * noise1(k * 0.5, seed + 9));
    return [(x * scaleW * wide + ax - lean * yy) * h, (yy + ay) * h] as Pt;
  });
};

export const FlameArt: React.FC<{h: number; seed?: number; frame?: number; intensity?: number; ink?: boolean}> = ({h, seed = 1, frame, intensity = 1, ink = true}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const k = Math.floor(f / 2) + seed * 13;
  const outer = flamePts(h, k, seed, 1, 1, intensity);
  const mid = flamePts(h * 0.72, k + 3, seed + 1, 0.92, 0.95, intensity).map(([x, y]) => [x, y + h * 0.02] as Pt);
  const core = flamePts(h * 0.42, k + 6, seed + 2, 0.9, 0.85, intensity).map(([x, y]) => [x, y + h * 0.02] as Pt);
  const d = (p: Pt[]) => smoothD(catmull(p, true, 6), true);
  return (
    <g>
      <path d={d(outer)} fill={C.chili} />
      <path d={d(mid)} fill={C.flameOrange} />
      <path d={d(core)} fill={C.flameYellow} />
      <path d={brush(core.map(([x, y]) => [x * 0.4 - h * 0.03, y * 0.6 - h * 0.05] as Pt).slice(3, 7), {w: h * 0.03, taper: [0.4, 0.4]})} fill={C.white} opacity={0.8} />
      {ink ? <path d={brush(outer, {w: Math.max(2.5, h * 0.035), closed: true, start: 0.95, seed: seed + (k % 5)})} fill={INK} /> : null}
      {/* two embers flicked off the top, redrawn on twos, rising and fading through a 6-drawing cycle */}
      {[0, 1].map((e) => {
        const ph = (k + e * 3) % 6;
        const ex = h * (0.18 * noise1(Math.floor((k + e * 3) / 6) * 1.3, seed + 20 + e) + (e ? 0.12 : -0.1));
        const ey = -h * (1.02 + ph * 0.07);
        const er = h * 0.035 * (1 - ph / 7);
        return er > 0.5 ? (
          <path
            key={e}
            d={`M${ex} ${ey - er * 2.2}C${ex + er} ${ey - er} ${ex + er} ${ey + er} ${ex} ${ey + er}C${ex - er} ${ey + er} ${ex - er} ${ey - er} ${ex} ${ey - er * 2.2}Z`}
            fill={e ? C.flameYellow : C.flameOrange}
            stroke={INK}
            strokeWidth={Math.max(1.2, h * 0.012)}
          />
        ) : null;
      })}
    </g>
  );
};

/** Stand-alone flame: base centre at (x, y) parent px, height h px. */
export const Flame2D: React.FC<{x: number; y: number; h: number; seed?: number; intensity?: number; rotate?: number; style?: React.CSSProperties}> = ({
  x,
  y,
  h,
  seed = 1,
  intensity = 1,
  rotate = 0,
  style,
}) => (
  <svg width={h * 1.2} height={h * 1.3} viewBox={`${-h * 0.6} ${-h * 1.15} ${h * 1.2} ${h * 1.3}`} style={{position: 'absolute', left: x - h * 0.6, top: y - h * 1.15, overflow: 'visible', ...style}}>
    <g transform={`rotate(${rotate})`}>
      <FlameArt h={h} seed={seed} intensity={intensity} />
    </g>
  </svg>
);
