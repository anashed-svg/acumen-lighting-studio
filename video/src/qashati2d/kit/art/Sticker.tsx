// The turquoise round sticker with the white Q (and its two drop-dots) — on the cup, the plate rim, the tray.
// Drawn around (0,0), radius r. `squeezeX` < 1 fakes the wrap around a cylinder (cup wall).
import React from 'react';
import {qashatiLogo as L} from '../../../qashati/logoPaths';
import {blobPts, brush, ellipsePts, shapeD} from '../geom';
import {C, INK} from '../palette';

// Q + dots bounding box in logo units (measured from logoPaths: dots y 1.5–326, Q x 531.8–1519.4, y 368–1521)
const QB = {x0: 531.8, x1: 1519.4, y0: 1.5, y1: 1521};
const QCX = (QB.x0 + QB.x1) / 2;
const QCY = (QB.y0 + QB.y1) / 2;

export const QMark: React.FC<{h: number; color?: string; dots?: boolean; dotColor?: string}> = ({h, color = C.white, dots = true, dotColor}) => {
  const k = h / (QB.y1 - QB.y0);
  return (
    <g transform={`scale(${k}) translate(${-QCX} ${-QCY})`}>
      {L.q.map((d, i) => (
        <path key={`q${i}`} d={d} fill={color} />
      ))}
      {dots
        ? L.dots.map((d, i) => (
            <path key={`d${i}`} d={d} fill={dotColor ?? color} />
          ))
        : null}
    </g>
  );
};

export const Sticker: React.FC<{r: number; squeezeX?: number; ink?: boolean; seed?: number; gloss?: boolean}> = ({r, squeezeX = 1, ink = true, seed = 5, gloss = true}) => {
  const outer = blobPts(0, 0, r, r, 0.012, seed, 48, 2);
  return (
    <g transform={`scale(${squeezeX} 1)`}>
      {/* sticker shadow on the surface (a hair below-right) */}
      <path d={shapeD(outer)} fill={INK} opacity={0.18} transform={`translate(${r * 0.04} ${r * 0.06})`} />
      <path d={shapeD(outer)} fill={C.turquoise} />
      {/* a deeper ring just inside the edge: printed border */}
      <path d={shapeD(ellipsePts(0, 0, r * 0.86, r * 0.86, 48))} fill="none" stroke={C.white} strokeWidth={r * 0.035} opacity={0.95} />
      <QMark h={r * 1.32} />
      {gloss ? (
        <>
          <path
            d={brush(ellipsePts(0, 0, r * 0.72, r * 0.72, 18, Math.PI * 1.08, Math.PI * 1.42), {w: r * 0.11, taper: [0.4, 0.4], tip: 0.05})}
            fill={C.white}
            opacity={0.55}
          />
          <path d={`M${r * 0.5} ${-r * 0.55}a${r * 0.05} ${r * 0.05} 0 1 0 ${r * 0.1} 0a${r * 0.05} ${r * 0.05} 0 1 0 ${-r * 0.1} 0`} fill={C.white} opacity={0.7} />
        </>
      ) : null}
      {ink ? <path d={brush(outer, {w: Math.max(2, r * 0.045), closed: true, seed, start: 0.85})} fill={INK} /> : null}
    </g>
  );
};
