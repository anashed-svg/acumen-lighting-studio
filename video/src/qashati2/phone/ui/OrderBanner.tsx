// The order-arrived banner (T.notification) with the brand app icon: turquoise rounded square,
// white ق + its two dots. Big, and inside the safe top (below y 260). The two dots later leap out of the
// icon onto the glass — the icon is left with a dot-less ق.
import React from 'react';
import {Easing, getStaticFiles, Img, interpolate, staticFile} from 'remotion';
import {qashatiLogo as L} from '../../../qashati/logoPaths';
import {COLORS, COPY, T} from '../../spec';
import {UI_FONT} from '../theme';
import {clamp, P} from '../timeline';

export const BANNER = {left: 36, top: 266, width: 1008, height: 272, radius: 64};
// Rich notification: a photo of the order on the trailing side (left, in RTL), as delivery apps do —
// it plants the product at ~5.3 s without spoiling the twist. Uses the cup packshot when it exists.
const THUMB = {size: 172, left: 40, radius: 40};
const PACKSHOT = 'qashati2/cup-packshot.png';
const HAS_PACKSHOT = getStaticFiles().some((f) => f.name === PACKSHOT);
const ICON_SIZE = 168;
export const ICON = {size: ICON_SIZE, x: BANNER.left + BANNER.width - 42 - ICON_SIZE, y: BANNER.top + (BANNER.height - ICON_SIZE) / 2};

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
    artScale,
  };
};

// Drops in fast with a little overshoot: nothing on screen before T.notification, readable on it.
const backOut = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
export const bannerOffset = (frame: number) => {
  const inn = backOut(interpolate(frame, [P.banner.in, P.banner.in + 5], [0, 1], clamp));
  const out = interpolate(frame, [P.banner.out, P.banner.out + 7], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return (1 - inn) * -(BANNER.top + BANNER.height + 40) - out * (BANNER.top + BANNER.height + 60);
};

export const QashatiIcon: React.FC<{size: number; frame: number; hideDots?: [boolean, boolean]; squash?: [number, number]}> = ({
  size,
  frame,
  hideDots = [false, false],
  squash = [0, 0],
}) => {
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
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -4px 0 rgba(0,0,0,0.08)',
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
            return <path key={i} d={d} transform={`translate(${cx} ${cy}) scale(${1 + 0.3 * s} ${1 - 0.35 * s}) translate(${-cx} ${-cy})`} />;
          })}
          {/* where a dot was: a faint wet mark */}
          {L.dots.map((d, i) =>
            hideDots[i] ? <path key={`g${i}`} d={d} fill="#FFFFFF" opacity={0.14} /> : null,
          )}
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

// The order photo: the cup on the brand's turquoise set, cropped to the dome and the sticker.
const OrderThumb: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: THUMB.left,
      top: (BANNER.height - THUMB.size) / 2,
      width: THUMB.size,
      height: THUMB.size,
      borderRadius: THUMB.radius,
      overflow: 'hidden',
      background: `radial-gradient(circle at 50% 38%, #52F5E8 0%, ${COLORS.turquoise} 55%, ${COLORS.turquoiseDeep} 100%)`,
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.16)',
    }}
  >
    <Img
      src={staticFile(PACKSHOT)}
      style={{position: 'absolute', width: THUMB.size * 1.16, left: THUMB.size * -0.08, top: THUMB.size * -0.22, filter: 'drop-shadow(0 6px 8px rgba(0,60,55,0.35))'}}
    />
  </div>
);

export const OrderBanner: React.FC<{frame: number}> = ({frame}) => {
  if (frame <= P.banner.in || frame > P.banner.out + 8) return null; // nothing at all before it drops in
  const y = bannerOffset(frame);
  const pop = frame >= T.cymbal ? 1 + 0.14 * Math.sin((frame - T.cymbal) * 0.9) * Math.exp(-(frame - T.cymbal) * 0.3) : 1;
  const hide: [boolean, boolean] = [frame >= P.dotLaunch[0], frame >= P.dotLaunch[1]];
  // anticipation: each dot squashes down into the icon before it leaps
  const sq = (i: 0 | 1): number => interpolate(frame, [P.dotLaunch[i] - 3, P.dotLaunch[i] - 1], [0, 1], clamp);
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
        background: 'rgba(40,42,48,0.86)',
        backdropFilter: 'blur(30px) saturate(1.4)',
        border: '2px solid rgba(255,255,255,0.12)',
        boxShadow: '0 22px 60px rgba(0,0,0,0.55)',
        boxSizing: 'border-box',
        direction: 'rtl',
        fontFamily: UI_FONT,
        color: '#fff',
      }}
    >
      <div style={{position: 'absolute', left: ICON.x - BANNER.left, top: ICON.y - BANNER.top, transform: `scale(${pop})`}}>
        <QashatiIcon size={ICON.size} frame={frame} hideDots={hide} squash={[sq(0), sq(1)]} />
      </div>
      {HAS_PACKSHOT ? <OrderThumb /> : null}
      <div style={{position: 'absolute', right: 42 + ICON.size + 36, left: HAS_PACKSHOT ? THUMB.left + THUMB.size + 30 : 48, top: 50}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontSize: 46, fontWeight: 700, lineHeight: '60px'}}>{COPY.notification.app}</span>
          <span style={{fontSize: 34, color: 'rgba(255,255,255,0.62)'}}>{COPY.notification.time}</span>
        </div>
        <div style={{fontSize: 66, fontWeight: 600, marginTop: 14, lineHeight: '84px', whiteSpace: 'nowrap'}}>{COPY.notification.text}</div>
      </div>
    </div>
  );
};
