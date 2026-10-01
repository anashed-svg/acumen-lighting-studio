// «مش قشطة» — Acts 1–2 as a phone screen recording (frames 0 → T.cupShot) + the cream reveal overlay.
// Layers (all inside one "camera"): UI under the glass (screens, touches) → red wash + dim → order banner
// → stamps on the glass → cream on the glass.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, H, T, W} from '../spec';
import {CreamDefs, CreamFilter, CreamSheet, GlassCream, REVEAL_FRAMES, RevealFilm, RevealGloss, RevealShape} from './glass/Cream';
import {Stamp, StampFilters} from './glass/Stamp';
import {N_STAMPS, splatImpact, SPLAT_IDX, STAMPS} from './layout';
import './theme';
import {clamp, frozen, P} from './timeline';
import {OrderBanner} from './ui/OrderBanner';
import {Screens} from './ui/Screens';

const STAMP_AT = [...T.screens.map((s) => s.stamp), ...T.burst];

// Phone shake: stamp slams (the hook hardest, the burst a machine-gun), the family buzzing that builds
// until the dead stop, and small knocks when cream lands. Nothing moves between act1End and the banner.
const shakeAt = (frame: number) => {
  let amp = 0;
  let kick = 0;
  const f = frozen(frame);
  if (frame < T.act1End) {
    STAMP_AT.forEach((at, i) => {
      const k = f - at;
      if (k < 0 || k > 14) return;
      const a = i === 0 ? 58 : i < 4 ? 30 : 17;
      amp += a * Math.exp(-k * (i === 0 ? 0.33 : 0.45));
      if (k === 0) kick += i === 0 ? 1.6 : i < 4 ? 1 : 0.6;
    });
    if (f >= P.chaos.from) amp += interpolate(f, [P.chaos.from, T.act1End - 1], [2, 9], clamp);
  }
  T.dropLand.forEach((l) => {
    const k = frame - l;
    if (k >= 0 && k < 6) amp += 7 * Math.exp(-k * 0.6);
  });
  SPLAT_IDX.forEach((i) => {
    const k = frame - splatImpact(i);
    if (k >= 0 && k < 5) amp += 4 * Math.exp(-k * 0.7);
  });
  if (amp < 0.05) return {x: 0, y: 0, r: 0, s: 1};
  const x = amp * (random(`sx${frame}`) * 2 - 1);
  const y = amp * (random(`sy${frame}`) * 2 - 1) + kick * 10;
  const r = amp * 0.035 * (random(`sr${frame}`) * 2 - 1);
  return {x, y, r, s: 1 + (amp * 2.4) / 1080 + kick * 0.012};
};

// The hero camera: push in on stamp 0 as the dots land, creep while «مش» smears off, whip back out.
const PUSH = 1.3;
const FOCUS = {x: STAMPS[0].x + 60, y: STAMPS[0].y - 30}; // a touch right: «مش» and the bead are the subject
const TARGET = {x: W / 2, y: 930};
const camAt = (f: number) => {
  let a = 0;
  let creep = 0;
  let blur = 0;
  if (f >= P.push.from && f < P.whip.from) {
    a = interpolate(f, [P.push.from, P.push.to], [0, 1], {...clamp, easing: Easing.bezier(0.25, 0.9, 0.3, 1)});
    creep = interpolate(f, [P.push.to, P.whip.from], [0, 0.045], clamp);
  } else if (f >= P.whip.from && f < P.whip.to) {
    const u = (f - P.whip.from) / (P.whip.to - P.whip.from);
    a = 1 - Easing.inOut(Easing.poly(5))(u);
    creep = 0.045 * (1 - u);
    blur = 7 * Math.sin(Math.PI * u);
  }
  // the all-«قشطة» hold: a small camera punch on each synced bounce
  const beat = P.holdBounce.reduce((acc, b, j) => {
    const t = f - b;
    return acc + (t >= 0 ? (j ? 0.018 : 0.03) * Math.sin(t * 0.8) * Math.exp(-t * 0.3) : 0);
  }, 0);
  const s = (1 + (PUSH - 1) * a) * (1 + creep) * (1 + beat);
  return {s, tx: (TARGET.x - FOCUS.x) * a, ty: (TARGET.y - FOCUS.y) * a, rot: 2 * a, blur};
};

// How much of the day has turned «قشطة» (0..1): the red wash and the dim calm down with every stamp.
const calmAt = (f: number) =>
  T.erase.reduce((acc, e, i) => acc + interpolate(f, [e + (i ? 4 : 14), e + (i ? 10 : 22)], [0, 1 / N_STAMPS], clamp), 0);

const redAt = (f: number) => {
  if (f < T.act1End) return interpolate(f, [P.chaos.from - 2, T.act1End - 1], [0, 1], clamp);
  return Math.max(0, 1 - 0.85 * calmAt(f) - 0.15 * interpolate(f, [T.holdQashta, T.holdQashta + 14], [0, 1], clamp));
};
const dimAt = (f: number) => {
  const freeze = interpolate(f, [T.act1End, T.act1End + 3], [0, 0.4], clamp);
  return freeze * (1 - calmAt(f)) * (1 - interpolate(f, [T.holdQashta, T.holdQashta + 14], [0, 1], clamp));
};

// On the cymbal a streak of light runs across the glass — the first hint that the glass itself matters.
const GlassGlint: React.FC<{frame: number}> = ({frame}) => {
  const g = interpolate(frame, [T.cymbal - 1, T.cymbal + 10], [0, 1], clamp);
  if (g <= 0 || g >= 1) return null;
  const c = -30 + g * 160;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        background: `linear-gradient(118deg, rgba(255,255,255,0) ${c - 16}%, rgba(255,255,255,0.16) ${c - 4}%, rgba(255,255,255,0.3) ${c}%, rgba(255,255,255,0.06) ${c + 5}%, rgba(255,255,255,0) ${c + 12}%)`,
      }}
    />
  );
};

const Stage: React.FC<{frame: number}> = ({frame}) => {
  const sh = shakeAt(frame);
  const cam = camAt(frame);
  const red = redAt(frame);
  const redPulse = red * (frame < T.act1End ? 0.85 + 0.15 * Math.sin(frozen(frame) * 1.7) : 0.85 + 0.15 * Math.sin(T.act1End * 1.7));
  const dim = dimAt(frame);
  return (
    <div style={{position: 'absolute', width: W, height: H, overflow: 'hidden', background: '#000'}}>
      <div
        style={{
          position: 'absolute',
          width: W,
          height: H,
          transformOrigin: `${FOCUS.x}px ${FOCUS.y}px`,
          transform: `translate(${cam.tx + sh.x}px, ${cam.ty + sh.y}px) rotate(${cam.rot + sh.r}deg) scale(${cam.s * sh.s})`,
          filter: cam.blur > 0.3 ? `blur(${cam.blur.toFixed(2)}px)` : undefined,
        }}
      >
        <Screens frame={frame} />
        {red > 0 ? (
          <>
            <div style={{position: 'absolute', inset: 0, background: '#FF1E1E', opacity: 0.1 * redPulse, mixBlendMode: 'screen'}} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 62% at 50% 48%, rgba(229,48,58,0) 50%, rgba(229,48,58,0.42) 82%, rgba(150,0,10,0.78) 100%)',
                opacity: redPulse,
              }}
            />
          </>
        ) : null}
        {dim > 0 ? <div style={{position: 'absolute', inset: 0, background: '#000', opacity: dim}} /> : null}
        <OrderBanner frame={frame} />
        <GlassGlint frame={frame} />
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <StampFilters />
          <CreamDefs />
          {STAMPS.map((_, i) => (
            <Stamp key={i} i={i} frame={frame} />
          ))}
          <GlassCream frame={frame} />
        </svg>
      </div>
    </div>
  );
};

export const PhoneStory: React.FC = () => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: W, height: H, transform: `scale(${width / W})`, transformOrigin: '0 0'}}>
        <Stage frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

// Overlay for the start of the cup shot: the cream sheet slides off the glass downwards to uncover
// whatever is underneath. Its frame 0 (= T.cupShot) matches PhoneStory's last frames exactly.
export const CreamReveal: React.FC = () => {
  const r = useCurrentFrame();
  const {width} = useVideoConfig();
  if (r >= REVEAL_FRAMES) return null;
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, transform: `scale(${width / W})`, transformOrigin: '0 0', overflow: 'visible'}}>
        <defs>
          <CreamFilter id="q2-reveal" blur={10} soften={8} relief={8} shadow={0.35} />
          <filter id="q2-reveal-sheen" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
          <filter id="q2-reveal-hl" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={1.6} />
          </filter>
          <linearGradient id="q2-reveal-film" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COLORS.cream} stopOpacity={0} />
            <stop offset="1" stopColor={COLORS.cream} stopOpacity={0.5} />
          </linearGradient>
          {r > 0 ? (
            <clipPath id="q2-reveal-clip">
              <RevealShape r={r} />
            </clipPath>
          ) : null}
        </defs>
        {r === 0 ? (
          <CreamSheet t={2} blurId="q2-reveal-sheen" />
        ) : (
          <>
            <RevealFilm r={r} />
            <g filter="url(#q2-reveal)">
              <RevealShape r={r} />
            </g>
            <g clipPath="url(#q2-reveal-clip)">
              <RevealGloss r={r} />
            </g>
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
};

