// «مش قشطة» — Acts 1–2 as a phone screen recording (frames 0 → T.cupShot) + the cream reveal overlay.
// Layers: UI under the glass (screens, banners, touches) → stamps on the glass → cream on the glass.
import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, H, T, W} from '../spec';
import {CreamDefs, CreamFilter, GlassCream, REVEAL_FRAMES, RevealGloss, RevealShape} from './glass/Cream';
import {Stamp, StampFilters} from './glass/Stamp';
import './theme';
import {clamp, P} from './timeline';
import {familyArrivals} from './ui/Chats';
import {Screens} from './ui/Screens';

// Phone shake: stamp slams, drop impacts, and the family-chat buzzing that builds until the dead stop.
const shakeAt = (f: number) => {
  let amp = 0;
  let kick = 0;
  T.screens.forEach((s) => {
    const k = f - s.stamp;
    if (k >= 0 && k < 12) {
      amp += 30 * Math.exp(-k * 0.42);
      if (k === 0) kick = 1;
    }
  });
  T.dropLand.forEach((l) => {
    const k = f - l;
    if (k >= 0 && k < 6) amp += 8 * Math.exp(-k * 0.6);
  });
  if (f >= P.chaos.from && f < T.act1End) {
    amp += interpolate(f, [P.chaos.from, T.act1End - 1], [2, 11], clamp);
    if (familyArrivals.includes(f)) amp += 6;
  }
  const x = amp * (random(`sx${f}`) * 2 - 1);
  const y = amp * (random(`sy${f}`) * 2 - 1) + kick * 10;
  const r = amp * 0.035 * (random(`sr${f}`) * 2 - 1);
  return {x, y, r, s: 1 + (amp * 2.4) / 1080 + kick * 0.012};
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
  const red = frame >= P.chaos.from - 2 && frame < T.act1End ? interpolate(frame, [P.chaos.from - 2, T.act1End - 1], [0.05, 1], clamp) : 0;
  const redPulse = red * (0.85 + 0.15 * Math.sin(frame * 1.7));
  return (
    <div style={{position: 'absolute', width: W, height: H, overflow: 'hidden', background: '#000'}}>
      <div style={{position: 'absolute', width: W, height: H, transform: `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg) scale(${sh.s})`}}>
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
        <GlassGlint frame={frame} />
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <StampFilters />
          <CreamDefs />
          {[0, 1, 2, 3].map((i) => (
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

// Overlay for the start of the cup shot: the solid cream drains down the glass with drippy, glossy
// edges to uncover whatever is underneath. Starts fully cream at its frame 0 (= T.cupShot).
export const CreamReveal: React.FC = () => {
  const r = useCurrentFrame();
  const {width} = useVideoConfig();
  if (r >= REVEAL_FRAMES) return null;
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, transform: `scale(${width / W})`, transformOrigin: '0 0', overflow: 'visible'}}>
        {r === 0 ? (
          <rect x={-10} y={-10} width={W + 20} height={H + 20} fill={COLORS.cream} />
        ) : (
          <>
            <defs>
              <CreamFilter id="q2-reveal" blur={10} soften={8} relief={8} shadow={0.35} />
              <filter id="q2-reveal-sheen" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={16} />
              </filter>
              <filter id="q2-reveal-hl" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={1.6} />
              </filter>
              <clipPath id="q2-reveal-clip">
                <RevealShape r={r} />
              </clipPath>
            </defs>
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
