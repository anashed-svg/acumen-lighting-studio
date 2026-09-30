// The order-arrived banner (T.notification) with the brand app icon: turquoise rounded square,
// white ق + its two dots. The two dots later leap out of the icon onto the glass.
import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {qashatiLogo as L} from '../../../qashati/logoPaths';
import {COLORS, COPY, FPS, T} from '../../spec';
import {UI_FONT} from '../theme';
import {clamp, P} from '../timeline';

export const BANNER = {left: 30, top: 186, width: 1020, height: 236, radius: 58};
export const ICON = {size: 128, x: BANNER.left + BANNER.width - 36 - 128, y: BANNER.top + (BANNER.height - 128) / 2};

// logo art (Q + dots) fitted into the icon
const ART = {x0: 531, y0: 0, w: 988, h: 1521};
const artScale = (ICON.size * 0.7) / ART.h;
const artTx = (ICON.size - ART.w * artScale) / 2 - ART.x0 * artScale;
const artTy = (ICON.size - ART.h * artScale) / 2 - ART.y0 * artScale + ICON.size * 0.01;

const DOT_BOX = [
  {x0: 751, x1: 938, y0: 22, y1: 326},
  {x0: 975.5, x1: 1165, y0: 1.5, y1: 307.6},
];

// Screen position (design px) and size of dot i inside the (settled) banner icon.
export const iconDot = (i: 0 | 1) => {
  const b = DOT_BOX[i];
  return {
    x: ICON.x + artTx + ((b.x0 + b.x1) / 2) * artScale,
    y: ICON.y + artTy + ((b.y0 + b.y1) / 2) * artScale,
    w: (b.x1 - b.x0) * artScale,
    h: (b.y1 - b.y0) * artScale,
    cx: (b.x0 + b.x1) / 2,
    cy: (b.y0 + b.y1) / 2,
    path: L.dots[i],
  };
};

export const bannerOffset = (frame: number) => {
  const inn = spring({frame: frame - P.banner.in, fps: FPS, config: {damping: 13, stiffness: 170, mass: 0.8}});
  const out = interpolate(frame, [P.banner.out, P.banner.out + 7], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return (1 - inn) * -(BANNER.top + BANNER.height + 40) - out * (BANNER.top + BANNER.height + 60);
};

export const QashatiIcon: React.FC<{size: number; frame: number; hideDots?: [boolean, boolean]; squash?: [number, number]}> = ({size, frame, hideDots = [false, false], squash = [0, 0]}) => {
  const shine = interpolate(frame, [T.cymbal, T.cymbal + 10], [-0.6, 1.6], clamp);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(160deg, #4FF7EA 0%, ${COLORS.turquoise} 45%, ${COLORS.turquoiseDeep} 100%)`,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(0,0,0,0.08)',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${ICON.size} ${ICON.size}`} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${artTx} ${artTy}) scale(${artScale})`} fill="#FFFFFF">
          {L.q.map((d, i) => (
            <path key={i} d={d} />
          ))}
          {L.dots.map((d, i) => {
            if (hideDots[i]) return null;
            const b = DOT_BOX[i];
            const cx = (b.x0 + b.x1) / 2;
            const cy = b.y1;
            const s = squash[i];
            return <path key={i} d={d} transform={`translate(${cx} ${cy}) scale(${1 + 0.25 * s} ${1 - 0.3 * s}) translate(${-cx} ${-cy})`} />;
          })}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(115deg, rgba(255,255,255,0) ${shine * 100 - 20}%, rgba(255,255,255,0.75) ${shine * 100}%, rgba(255,255,255,0) ${shine * 100 + 20}%)`,
        }}
      />
    </div>
  );
};

export const OrderBanner: React.FC<{frame: number}> = ({frame}) => {
  if (frame < P.banner.in - 1 || frame > P.banner.out + 8) return null;
  const y = bannerOffset(frame);
  const pop = frame >= T.cymbal ? 1 + 0.12 * Math.sin((frame - T.cymbal) * 0.9) * Math.exp(-(frame - T.cymbal) * 0.3) : 1;
  const hide: [boolean, boolean] = [frame >= P.dotLaunch[0], frame >= P.dotLaunch[1]];
  const sq = (i: 0 | 1): number => interpolate(frame, [P.dotLaunch[i] - 4, P.dotLaunch[i] - 1], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: BANNER.left,
        top: BANNER.top,
        width: BANNER.width,
        height: BANNER.height,
        transform: `translateY(${y}px)`,
        borderRadius: BANNER.radius,
        background: 'rgba(38,40,46,0.8)',
        backdropFilter: 'blur(30px) saturate(1.4)',
        border: '1.5px solid rgba(255,255,255,0.1)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
        boxSizing: 'border-box',
        direction: 'rtl',
        fontFamily: UI_FONT,
        color: '#fff',
      }}
    >
      <div style={{position: 'absolute', left: ICON.x - BANNER.left, top: ICON.y - BANNER.top, transform: `scale(${pop})`}}>
        <QashatiIcon size={ICON.size} frame={frame} hideDots={hide} squash={[sq(0), sq(1)]} />
      </div>
      <div style={{position: 'absolute', right: 36 + ICON.size + 32, left: 44, top: 44}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontSize: 42, fontWeight: 700}}>{COPY.notification.app}</span>
          <span style={{fontSize: 32, color: 'rgba(255,255,255,0.6)'}}>{COPY.notification.time}</span>
        </div>
        <div style={{fontSize: 50, fontWeight: 500, marginTop: 10, lineHeight: '66px'}}>{COPY.notification.text}</div>
      </div>
    </div>
  );
};
