// The brand logo on the 2D end card: an ON-TWOS reveal (LogoReveal2D below — its two dots fall and land = the sonic
// logo's two clacks), in TEAL on turquoise (legible: ~7:1, the v1 panel's white-on-turquoise was 1.6:1). Once it has fully
// settled it hands over to <LivingLogo2D> — the same paths drawn statically (no pop), with the two dots alive:
// a soft jelly breathe, and hops on `hops` frames (dot 2 one dot-gap after dot 1). The logo itself never boils:
// it is the one crisp, printed thing on the card.
import React, {useId} from 'react';
import {useCurrentFrame} from 'remotion';
import {qashatiLogo as L} from '../../../qashati/logoPaths';
import {C} from '../palette';

export const LOGO_ASPECT = L.height / L.width;
// AnimatedLogo's dot pivots: x at 41.5% / 52.5% of the width, y at 13.5% of the height (the dots' base)
const DOT_PIVOT = [
  {x: L.width * 0.415, y: L.height * 0.135},
  {x: L.width * 0.525, y: L.height * 0.135},
];
/** the reveal is fully settled at start + LOGO_SETTLE (then the living logo takes over) */
export const LOGO_SETTLE = 48;
/** @deprecated kept for old imports — the reveal is LogoReveal2D now */
export const ANIMATED_LOGO_SETTLE = LOGO_SETTLE;

const hop = (t: number, unitsPerPx: number) => {
  const AIR = 8;
  const CROUCH = 3;
  const HOP = 14;
  if (t < -AIR - CROUCH || t > 24) return {y: 0, sy: 1};
  if (t < -AIR) return {y: 0, sy: 1 - 0.13 * Math.sin((((t + AIR + CROUCH) / CROUCH) * Math.PI) / 2)};
  if (t < 0) {
    const p = (t + AIR) / AIR;
    return {y: -4 * HOP * unitsPerPx * p * (1 - p), sy: 1 + 0.1 * Math.abs(Math.cos(p * Math.PI))};
  }
  return {y: 0, sy: 1 - 0.2 * Math.cos(t * 0.9) * Math.exp(-t * 0.3)};
};

export const LivingLogo2D: React.FC<{width: number; color?: string; settledAt: number; hops?: readonly number[]; dotGap?: number; frame?: number}> = ({
  width,
  color = C.teal,
  settledAt,
  hops = [],
  dotGap = 6,
  frame,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const t = f - settledAt;
  const env = Math.min(1, Math.max(0, t / 14));
  const upp = L.width / width;
  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width={width} height={width * LOGO_ASPECT} style={{overflow: 'visible', display: 'block'}}>
      <g fill={color}>
        {L.q.map((d, i) => (
          <path key={`q${i}`} d={d} />
        ))}
        {L.dots.map((d, i) => {
          // the dots hop on twos (a drawn hop, not a tween) — the jelly breathe runs on ones (it is tiny)
          const ft = Math.floor(f / 2) * 2;
          const h = hops.map((hf) => hop(ft - (hf + i * dotGap), upp)).reduce((a, b) => ({y: a.y + b.y, sy: a.sy * b.sy}), {y: 0, sy: 1});
          const sy = h.sy * (1 + env * (0.06 * Math.sin(t * 0.21 + i * 1.9) + 0.02 * Math.sin(t * 0.47 + i)));
          const p = DOT_PIVOT[i];
          return <path key={`d${i}`} d={d} transform={`translate(${p.x} ${p.y + h.y}) scale(${2 - sy} ${sy}) translate(${-p.x} ${-p.y})`} />;
        })}
        {L.arabic.map((d, i) => (
          <path key={`a${i}`} d={d} />
        ))}
        {L.latin.map((d, i) => (
          <path key={`l${i}`} d={d} />
        ))}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ the reveal, ON TWOS
// (replaces the series-1 AnimatedLogo, whose spring pop + tweens on ones read as a default template move next to
// the hand-animated card). Same beats, so the sonic logo still lands on the dots: Q presses in like a stamp
// (approach → wide impact → overshoot → settle), the two drop-dots fall and SPLAT onto the Q at start+8 / start+14
// (stretch while falling, squash on contact, rebound), the Arabic wordmark is wiped in right → left in drawn steps,
// the Latin letters hop up one after another. Every pose is held for 2 frames.
const Q_KEYS = [
  {s: 1.32, sx: 1, sy: 1, rot: -7, o: 0.35}, // approach (the stamp in the air)
  {s: 0.94, sx: 1.12, sy: 0.86, rot: 2.5, o: 1}, // impact: wide + flat
  {s: 1.05, sx: 0.96, sy: 1.05, rot: -1.2, o: 1},
  {s: 0.985, sx: 1.01, sy: 0.99, rot: 0.4, o: 1},
  {s: 1, sx: 1, sy: 1, rot: 0, o: 1},
];
const DOT_LAND = [8, 14];
const dotPose = (k: number, land: number) => {
  // k, land: frames relative to start, k on twos
  if (k < land - 8) return null;
  if (k < land) {
    const u = (k - (land - 8)) / 8; // 0, .25, .5, .75
    return {y: -1500 * (1 - u) ** 2, sy: 1.28};
  }
  const keys = [0.58, 1.16, 0.95, 1.02, 1];
  return {y: 0, sy: keys[Math.min(keys.length - 1, (k - land) / 2)]};
};

export const LogoReveal2D: React.FC<{start: number; width: number; color?: string; frame?: number}> = ({start, width, color = C.teal, frame}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const k = Math.floor((f - start) / 2) * 2; // on twos, relative
  if (k < 0) return null;
  const q = Q_KEYS[Math.min(Q_KEYS.length - 1, k / 2)];
  // wordmark wipe: right → left, eased, in steps
  const wt = Math.max(0, Math.min(1, (k - 12) / 22));
  const wipe = 1 - (1 - wt) ** 3;
  const qc = {x: L.width / 2, y: L.height * 0.39};
  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width={width} height={width * LOGO_ASPECT} style={{overflow: 'visible', display: 'block'}}>
      <defs>
        <clipPath id={`lw${uid}`}>
          <rect x={L.width * (1 - wipe)} y={-L.height} width={L.width * wipe + 10} height={L.height * 3} />
        </clipPath>
      </defs>
      <g fill={color}>
        <g opacity={q.o} transform={`translate(${qc.x} ${qc.y}) rotate(${q.rot}) scale(${q.s * q.sx} ${q.s * q.sy}) translate(${-qc.x} ${-qc.y})`}>
          {L.q.map((d, i) => (
            <path key={`q${i}`} d={d} />
          ))}
        </g>
        {L.dots.map((d, i) => {
          const p = dotPose(k, DOT_LAND[i]);
          if (!p) return null;
          const pv = DOT_PIVOT[i];
          return <path key={`d${i}`} d={d} transform={`translate(0 ${p.y}) translate(${pv.x} ${pv.y}) scale(${2 - p.sy} ${p.sy}) translate(${-pv.x} ${-pv.y})`} />;
        })}
        {wipe > 0 ? (
          <g clipPath={`url(#lw${uid})`}>
            {L.arabic.map((d, i) => (
              <path key={`a${i}`} d={d} />
            ))}
          </g>
        ) : null}
        {L.latin.map((d, i) => {
          const at = 22 + Math.round(i * 1.3);
          const step = Math.floor((k - at) / 2);
          if (k < at) return null;
          const keys = [{y: 70, o: 0.4}, {y: -16, o: 1}, {y: 5, o: 1}, {y: 0, o: 1}];
          const kk = keys[Math.min(keys.length - 1, step)];
          return <path key={`l${i}`} d={d} opacity={kk.o} transform={`translate(0 ${kk.y})`} />;
        })}
      </g>
    </svg>
  );
};

/** The on-twos reveal from `start` (dots land at start+8 / start+14 = the sonic logo), then the living version. */
export const Logo2D: React.FC<{start: number; width: number; color?: string; hops?: readonly number[]}> = ({start, width, color = C.teal, hops}) => {
  const f = useCurrentFrame();
  if (f < start) return null;
  return f < start + LOGO_SETTLE ? (
    <LogoReveal2D start={start} width={width} color={color} />
  ) : (
    <LivingLogo2D width={width} color={color} settledAt={start + LOGO_SETTLE} hops={hops} />
  );
};
