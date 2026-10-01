// Brand lockup: the teal logo (its two dots drop in via the brand's AnimatedLogo — dot 1 lands on
// T.logoDots[0] = the sonic-logo cymbal) + "The Sweet Happiness" set as part of the lockup.
// The dots fall from behind the title stamp: above its bottom edge they are hidden, so they drop out from under
// the stamp instead of passing through «خلّيها». Once AnimatedLogo has fully settled, the same paths are drawn
// statically (identical geometry at the hand-over frame → no pop) so the two dots stay alive: a soft jelly
// wobble, and on the music (E.dotHops) they hop and land one after the other — the sonic logo's «تشك-تشك»
// as a picture, the second time on the stop-time button.
import React from 'react';
import {interpolate} from 'remotion';
import {AnimatedLogo} from '../../qashati/Logo';
import {qashatiLogo as L} from '../../qashati/logoPaths';
import {COLORS, COPY, T, W} from '../spec';
import {LATIN_FONT} from './fonts';
import {clamp, E, easeOut, LOGO, LOGO_ASPECT, TAGLINE_GAP, TAGLINE_SIZE, titleBottomAt} from './layout';

const INK = COLORS.teal;

// AnimatedLogo's dot pivots (see qashati/Logo.tsx): x at 41.5% / 52.5% of the width, y at 13.5% of the height
// (= the dots' base).
const DOT_PIVOT = [
  {x: L.width * 0.415, y: L.height * 0.135},
  {x: L.width * 0.525, y: L.height * 0.135},
];
const UNITS_PER_PX = L.width / LOGO.width;

// One hop of a dot that lands at t = 0 (frames): crouch, up, down, squash on the landing, jelly back.
const HOP_PX = 12; // the dots stay ≥ 15 px clear of the title stamp at the top of the hop
const AIR = 8;
const CROUCH = 3;
const hop = (t: number) => {
  if (t < -AIR - CROUCH || t > 24) return {y: 0, sy: 1};
  if (t < -AIR) return {y: 0, sy: 1 - 0.13 * Math.sin((((t + AIR + CROUCH) / CROUCH) * Math.PI) / 2)};
  if (t < 0) {
    const p = (t + AIR) / AIR;
    return {y: -4 * HOP_PX * UNITS_PER_PX * p * (1 - p), sy: 1 + 0.1 * Math.abs(Math.cos(p * Math.PI))};
  }
  return {y: 0, sy: 1 - 0.2 * Math.cos(t * 0.9) * Math.exp(-t * 0.3)};
};

const LivingLogo: React.FC<{frame: number; width: number}> = ({frame, width}) => {
  const t = frame - E.logoSettled;
  const env = interpolate(t, [0, 14], [0, 1], clamp);
  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width={width} height={(width * L.height) / L.width} style={{overflow: 'visible', display: 'block'}}>
      <g fill={INK}>
        {L.q.map((d, i) => (
          <path key={`q${i}`} d={d} />
        ))}
        {L.dots.map((d, i) => {
          // soft jelly: squash/stretch about the dot's base, the two dots out of phase; plus the hops
          const h = E.dotHops.map((f) => hop(frame - (f + i * E.dotGap))).reduce((a, b) => ({y: a.y + b.y, sy: a.sy * b.sy}), {y: 0, sy: 1});
          const sy = h.sy * (1 + env * (0.065 * Math.sin(t * 0.21 + i * 1.9) + 0.025 * Math.sin(t * 0.47 + i)));
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

export const Lockup: React.FC<{frame: number}> = ({frame}) => {
  if (frame < E.logoStart) return null;
  const h = LOGO.width * LOGO_ASPECT;
  // the sonic logo: a small press on dot 1 (sound and picture on the same beat)
  const hit = interpolate(frame - T.sonicLogo, [0, 2, 10], [0, 1, 0], clamp);
  const tag = interpolate(frame, [E.tagline.from, E.tagline.to], [0, 1], {...clamp, easing: easeOut});
  // while the dots fall, hide everything above the title stamp's bottom edge (it moves with the pull-back)
  const falling = frame <= T.logoDots[1];
  const clip = falling ? `polygon(0px ${titleBottomAt(frame, 0)}px, ${W}px ${titleBottomAt(frame, W)}px, ${W}px 100%, 0px 100%)` : undefined;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, clipPath: clip}}>
        <div
          style={{
            position: 'absolute',
            left: LOGO.cx - LOGO.width / 2,
            top: LOGO.top,
            width: LOGO.width,
            height: h,
            transform: `scale(${1 + 0.025 * hit})`,
            transformOrigin: '50% 40%',
          }}
        >
          {frame < E.logoSettled ? <AnimatedLogo start={E.logoStart} width={LOGO.width} color={INK} /> : <LivingLogo frame={frame} width={LOGO.width} />}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: LOGO.cx - 300,
          width: 600,
          top: LOGO.top + h + TAGLINE_GAP - TAGLINE_SIZE * 0.3,
          textAlign: 'center',
          fontFamily: LATIN_FONT,
          fontWeight: 500,
          fontSize: TAGLINE_SIZE,
          lineHeight: 1.2,
          letterSpacing: '0.01em',
          color: INK,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 14}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        {COPY.tagline}
      </div>
    </>
  );
};
