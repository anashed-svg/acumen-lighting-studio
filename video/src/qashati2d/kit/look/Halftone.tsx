// Halftone shading: true AM halftone — a rotated grid of dots whose RADIUS follows a tone field (0..1). Use it
// instead of smooth gradients for shadows, form shading and cast shadows (print look). Pure SVG circles,
// memoised (the dot list only depends on the primitive props), clipped to a shape by the caller.
//
//   <Halftone box={[x, y, w, h]} cell={9} angle={22} tone={[{t: 'lin', x0, y0, x1, y1, a: 0, b: 1}]} fill={C.creamDeep}
//             clipPath="url(#domeClip)" />
//
// Tone descriptors (multiplied together, then clamped):
//   {t:'lin',  x0,y0,x1,y1, a,b}       tone a at p0 → b at p1 (clamped beyond)
//   {t:'rad',  cx,cy, r0,r1, a,b}      tone a at r ≤ r0 → b at r ≥ r1 (rx/ry scale: sx, sy optional)
//   {t:'noise', amp, freq, seed}       1 ± amp·noise (breaks up the regularity like real ink pickup)
import React, {useMemo} from 'react';
import {noise1} from '../geom';

export type Tone =
  | {t: 'lin'; x0: number; y0: number; x1: number; y1: number; a: number; b: number; pow?: number}
  | {t: 'rad'; cx: number; cy: number; r0: number; r1: number; a: number; b: number; sx?: number; sy?: number; pow?: number}
  | {t: 'noise'; amp: number; freq?: number; seed?: number}
  | {t: 'const'; v: number};

const toneAt = (tones: Tone[], x: number, y: number) => {
  let v = 1;
  for (const t of tones) {
    if (t.t === 'const') v *= t.v;
    else if (t.t === 'lin') {
      const dx = t.x1 - t.x0;
      const dy = t.y1 - t.y0;
      const u = Math.min(1, Math.max(0, ((x - t.x0) * dx + (y - t.y0) * dy) / (dx * dx + dy * dy || 1)));
      v *= t.a + (t.b - t.a) * u ** (t.pow ?? 1);
    } else if (t.t === 'rad') {
      const r = Math.hypot((x - t.cx) / (t.sx ?? 1), (y - t.cy) / (t.sy ?? 1));
      const u = Math.min(1, Math.max(0, (r - t.r0) / (t.r1 - t.r0 || 1)));
      v *= t.a + (t.b - t.a) * u ** (t.pow ?? 1);
    } else {
      const f = t.freq ?? 0.02;
      v *= 1 + t.amp * (noise1(x * f + 3.1, t.seed ?? 5) * 0.6 + noise1(y * f + 7.7, (t.seed ?? 5) + 1) * 0.4);
    }
  }
  return Math.min(1, Math.max(0, v));
};

export type HalftoneDot = [number, number, number]; // cx, cy, r

export const halftoneDots = (box: [number, number, number, number], cell: number, angleDeg: number, tones: Tone[], maxR = 0.62, minTone = 0.04): HalftoneDot[] => {
  const [bx, by, bw, bh] = box;
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const R = Math.hypot(bw, bh) / 2 + cell;
  const n = Math.ceil(R / cell);
  const out: HalftoneDot[] = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const u = i * cell;
      const v = j * cell;
      const x = cx + u * c - v * s;
      const y = cy + u * s + v * c;
      if (x < bx - cell || x > bx + bw + cell || y < by - cell || y > by + bh + cell) continue;
      const t = toneAt(tones, x, y);
      if (t < minTone) continue;
      // area-proportional: r ∝ sqrt(tone); dots merge at full tone (maxR > 0.5)
      out.push([x, y, cell * maxR * Math.sqrt(t)]);
    }
  }
  return out;
};

export const Halftone: React.FC<{
  box: [number, number, number, number];
  cell?: number;
  angle?: number;
  tone: Tone[];
  fill: string;
  opacity?: number;
  clipPath?: string;
  maxR?: number;
  minTone?: number;
}> = ({box, cell = 9, angle = 22, tone, fill, opacity = 1, clipPath, maxR = 0.62, minTone = 0.04}) => {
  const key = JSON.stringify([box, cell, angle, tone, maxR, minTone]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dots = useMemo(() => halftoneDots(box, cell, angle, tone, maxR, minTone), [key]);
  // one path with many circle subpaths is far cheaper than thousands of <circle> nodes
  const d = useMemo(
    () =>
      dots
        .map(([x, y, r]) => {
          const rr = Math.round(r * 10) / 10;
          return `M${(x - rr).toFixed(1)} ${y.toFixed(1)}a${rr} ${rr} 0 1 0 ${(2 * rr).toFixed(1)} 0a${rr} ${rr} 0 1 0 ${(-2 * rr).toFixed(1)} 0`;
        })
        .join(''),
    [dots],
  );
  return <path d={d} fill={fill} opacity={opacity} clipPath={clipPath} />;
};
