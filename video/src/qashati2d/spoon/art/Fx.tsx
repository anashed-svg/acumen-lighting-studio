// Small drawn effects for the spot, all ON TWOS and inked like the rest of the kit:
//   <DigSplash/>  — cream specks + a pistachio crumb + a strawberry bit flicked off the plate when a spoon digs in
//   <SpeedLines/> — brush speed lines trailing a fast hand (the snatch, the eager owner)
import React from 'react';
import {blobPts, brush, C, INK, Pt, rng, shapeD} from '../../kit/lib';

/** world px, drawn inside a camera layer. `at` = impact frame, `dir` = unit vector of the arm (outwards). */
export const DigSplash: React.FC<{x: number; y: number; at: number; frame: number; dir: Pt; seed: number; scale?: number}> = ({x, y, at, frame, dir, seed, scale = 1}) => {
  const k = Math.floor((frame - at) / 2); // drawing index
  if (k < 0 || k > 4) return null;
  const r = rng(seed);
  const parts = Array.from({length: 7}).map((_, i) => {
    // mostly flicked back towards the eater (the spoon pulls) and sideways
    const side = (r() - 0.5) * 2.4;
    const a = Math.atan2(dir[1], dir[0]) + side;
    const sp = (36 + r() * 46) * scale;
    const kind = i < 5 ? 'cream' : i === 5 ? 'crumb' : 'berry';
    return {a, sp, kind, s: (kind === 'cream' ? 7 + r() * 9 : 9) * scale, seed: seed * 7 + i};
  });
  const t = (k + 1) / 5;
  return (
    <svg width={0} height={0} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {parts.map((p, i) => {
        const d = p.sp * (1 - (1 - t) ** 2) * 2.2;
        const px = Math.cos(p.a) * d;
        const py = Math.sin(p.a) * d - 18 * Math.sin(t * Math.PI) * scale; // a little arc (towards the camera)
        const s = p.s * (1 - t * 0.55);
        const fill = p.kind === 'cream' ? C.cream : p.kind === 'crumb' ? C.pistachio : C.strawberry;
        const pts = blobPts(px, py, s, s * 0.8, 0.25, p.seed + k, 10, 2, p.a);
        return (
          <g key={i}>
            <path d={shapeD(pts, 4)} fill={fill} />
            <path d={brush(pts, {w: Math.max(2, s * 0.28), closed: true, seed: p.seed, start: 0.5})} fill={INK} />
          </g>
        );
      })}
      {k < 2 ? (
        // the impact "spat": a short ink burst ring of ticks around the bowl
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = Math.atan2(dir[1], dir[0]) + Math.PI + (i - 2) * 0.55;
            const r0 = (44 + k * 14) * scale;
            const r1 = r0 + (22 - k * 6) * scale;
            return <path key={i} d={brush([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], {w: 6 * scale, taper: [0.2, 0.6], tip: 0.1, seed: seed + i})} fill={INK} />;
          })}
        </g>
      ) : null}
    </svg>
  );
};

/** brush speed lines behind a moving point: `dir` = unit vector of motion; lines trail opposite to it */
export const SpeedLines: React.FC<{x: number; y: number; dir: Pt; len: number; spread: number; n?: number; frame: number; seed: number; color?: string}> = ({
  x,
  y,
  dir,
  len,
  spread,
  n = 4,
  frame,
  seed,
  color = INK,
}) => {
  const r = rng(seed + Math.floor(frame / 2) * 5);
  const nx = -dir[1];
  const ny = dir[0];
  return (
    <svg width={0} height={0} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {Array.from({length: n}).map((_, i) => {
        const o = (i / Math.max(1, n - 1) - 0.5) * 2 * spread + (r() - 0.5) * 12;
        const l = len * (0.55 + r() * 0.45);
        const s0 = 30 + r() * 30;
        const a: Pt = [-dir[0] * s0 + nx * o, -dir[1] * s0 + ny * o];
        const b: Pt = [-dir[0] * (s0 + l) + nx * o, -dir[1] * (s0 + l) + ny * o];
        const m: Pt = [(a[0] + b[0]) / 2 + nx * 4, (a[1] + b[1]) / 2 + ny * 4];
        return <path key={i} d={brush([a, m, b], {w: 7 + r() * 4, taper: [0.15, 0.85], tip: 0.05, seed: seed + i})} fill={color} opacity={0.9} />;
      })}
    </svg>
  );
};
