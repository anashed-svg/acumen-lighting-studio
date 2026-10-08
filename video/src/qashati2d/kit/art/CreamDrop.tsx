// <CreamDropArt>/<CreamDrop2D> — a qashta drop shaped EXACTLY like one of the logo's ق dots (logoPaths dots[0|1]):
// glossy, inked, with squash & stretch for the fall and the landing. The brand's "two drops" motif.
//   stretch > 0 while falling (taller/thinner), squash > 0 on landing (wider/flatter), anchored at the drop's base.
import React from 'react';
import {qashatiLogo as L} from '../../../qashati/logoPaths';
import {brush, ellipsePts} from '../geom';
import {C, INK} from '../palette';

// dot bounding boxes in logo units (from logoPaths)
const DOTS = [
  {x0: 751, y0: 21.9, x1: 938, y1: 326.4},
  {x0: 975.5, y0: 1.5, x1: 1165, y1: 307.6},
];

/** Drawn around the drop's BASE centre (0,0), height h. */
export const CreamDropArt: React.FC<{h: number; which?: 0 | 1; color?: string; squash?: number; stretch?: number; rot?: number; ink?: boolean}> = ({
  h,
  which = 0,
  color = C.cream,
  squash = 0,
  stretch = 0,
  rot = 0,
  ink = true,
}) => {
  const b = DOTS[which];
  const k = h / (b.y1 - b.y0);
  const cx = (b.x0 + b.x1) / 2;
  const sx = (1 + 0.5 * squash) / Math.sqrt(1 + stretch);
  const sy = (1 - 0.45 * squash) * (1 + stretch);
  const w = (b.x1 - b.x0) * k;
  const hi = ellipsePts(-w * 0.12, -h * 0.68, w * 0.22, h * 0.2, 10, Math.PI * 1.05, Math.PI * 1.6);
  return (
    <g transform={`rotate(${rot}) scale(${sx} ${sy})`}>
      <g transform={`scale(${k}) translate(${-cx} ${-b.y1})`}>
        <path d={L.dots[which]} fill={color === C.cream ? C.creamShade : color} />
        <path d={L.dots[which]} fill={color} transform={`translate(${cx} ${b.y1}) scale(0.9) translate(${-cx - 8} ${-b.y1 - 12})`} />
        {ink ? <path d={L.dots[which]} fill="none" stroke={INK} strokeWidth={(h * 0.04) / k} strokeLinejoin="round" /> : null}
      </g>
      <path d={brush(hi, {w: w * 0.13, taper: [0.35, 0.45], tip: 0.05, dense: true})} fill={C.white} opacity={0.95} />
      <circle cx={w * 0.12} cy={-h * 0.36} r={w * 0.05} fill={C.white} opacity={0.9} />
    </g>
  );
};

export const CreamDrop2D: React.FC<React.ComponentProps<typeof CreamDropArt> & {x: number; y: number; style?: React.CSSProperties}> = ({x, y, style, ...p}) => {
  const h = p.h;
  return (
    <svg width={h * 2} height={h * 2.4} viewBox={`${-h} ${-h * 2} ${h * 2} ${h * 2.4}`} style={{position: 'absolute', left: x - h, top: y - h * 2, overflow: 'visible', ...style}}>
      <CreamDropArt {...p} />
    </svg>
  );
};
