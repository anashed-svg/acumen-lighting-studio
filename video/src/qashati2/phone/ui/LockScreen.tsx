// 23:04 lock screen: the phone wakes up to the boss's message.
import React from 'react';
import {interpolate, spring} from 'remotion';
import {COPY, FPS, T} from '../../spec';
import {UI_FONT} from '../theme';
import {clamp, hash, P} from '../timeline';
import {CameraIcon, FlashlightIcon} from './Icons';
import {HomeBar} from './StatusBar';

export const MessengerIcon: React.FC<{size: number}> = ({size}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: 'linear-gradient(160deg, #5AA2FF 0%, #2360D8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
      <path d="M12 3 C6.5 3 2.5 6.6 2.5 11 C2.5 13.4 3.7 15.5 5.6 17 L4.8 21 L9.2 18.6 C10.1 18.9 11 19 12 19 C17.5 19 21.5 15.4 21.5 11 C21.5 6.6 17.5 3 12 3 Z" fill="#fff" />
    </svg>
  </div>
);

export const LOCK_CARD = {top: 1096, left: 36, width: 1008, height: 250};

const Skyline: React.FC = () => {
  // generic skyline silhouette with a few lit windows
  const towers = [
    [0, 160], [70, 240], [150, 200], [215, 330], [300, 260], [370, 420], [430, 300], [505, 230], [560, 360],
    [630, 520], [690, 280], [760, 350], [830, 250], [900, 310], [960, 220], [1030, 280],
  ];
  return (
    <svg width={1080} height={600} style={{position: 'absolute', left: 0, bottom: 0}}>
      <defs>
        <linearGradient id="q2-sky-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A0C1C" stopOpacity={0.9} />
          <stop offset="1" stopColor="#05060F" />
        </linearGradient>
      </defs>
      {towers.map(([x, h], i) => {
        const w = 72;
        const spire = i === 9 ? <path d={`M${x + 20} ${600 - h} L${x + 36} ${600 - h - 150} L${x + 52} ${600 - h} Z`} fill="url(#q2-sky-fade)" /> : null;
        return (
          <g key={i}>
            {spire}
            <rect x={x} y={600 - h} width={w} height={h} fill="url(#q2-sky-fade)" />
            {Array.from({length: 7}).map((_, j) =>
              hash(i * 13 + j) > 0.55 ? (
                <rect key={j} x={x + 10 + (j % 3) * 20} y={600 - h + 24 + Math.floor(j / 3) * 36 + hash(i + j) * 60} width={9} height={12} fill="#FFD68A" opacity={0.55} />
              ) : null,
            )}
          </g>
        );
      })}
    </svg>
  );
};

export const LockScreen: React.FC<{frame: number}> = ({frame}) => {
  const wake = interpolate(frame, [P.wake, P.wake + 3], [0, 1], clamp);
  const n = spring({frame: frame - P.lockNotif, fps: FPS, config: {damping: 15, stiffness: 190}});
  const pressed = interpolate(frame, [P.lockTap - 1, P.lockTap, P.lockTap + 2], [0, 1, 0.6], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        direction: 'rtl',
        fontFamily: UI_FONT,
        color: '#fff',
        background: 'linear-gradient(180deg, #090C22 0%, #17194A 38%, #3A2254 72%, #4A2346 100%)',
        opacity: wake,
      }}
    >
      <div style={{position: 'absolute', left: 540, top: 1500, width: 900, height: 600, marginLeft: -450, background: 'radial-gradient(ellipse at 50% 60%, rgba(255,140,90,0.35), rgba(255,120,80,0) 70%)'}} />
      <Skyline />
      <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontSize: 44, fontWeight: 500, opacity: 0.88}}>الخميس ٢٤ سبتمبر</div>
      <div style={{position: 'absolute', top: 168, width: '100%', textAlign: 'center', fontSize: 236, fontWeight: 600, lineHeight: '300px', letterSpacing: -4, direction: 'ltr'}}>
        {T.screens[2].clock}
      </div>
      <div
        style={{
          position: 'absolute',
          ...LOCK_CARD,
          borderRadius: 50,
          background: `rgba(${255 - pressed * 40},${255 - pressed * 40},${255 - pressed * 40},${0.17 + pressed * 0.06})`,
          backdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          boxSizing: 'border-box',
          padding: '30px 34px',
          display: 'flex',
          gap: 28,
          transform: `translateY(${(1 - n) * 120}px) scale(${(0.92 + 0.08 * n) * (1 - pressed * 0.03)})`,
          opacity: Math.min(1, n * 1.4),
        }}
      >
        <MessengerIcon size={100} />
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontSize: 42, fontWeight: 700}}>{COPY.boss.contact}</span>
            <span style={{fontSize: 30, opacity: 0.7}}>الآن</span>
          </div>
          <div style={{fontSize: 42, lineHeight: '60px', marginTop: 6, whiteSpace: 'nowrap'}}>{COPY.boss.message}</div>
          <div style={{fontSize: 30, opacity: 0.6, marginTop: 6}}>رسائل</div>
        </div>
      </div>
      {[{x: 90, I: FlashlightIcon}, {x: 870, I: CameraIcon}].map(({x, I}, i) => (
        <div key={i} style={{position: 'absolute', left: x, top: 1700, width: 120, height: 120, borderRadius: 60, background: 'rgba(20,20,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <I size={56} color="#fff" />
        </div>
      ))}
      <HomeBar dark />
    </div>
  );
};
