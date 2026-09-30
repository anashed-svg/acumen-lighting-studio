import React from 'react';
import {UI_FONT} from '../theme';
import {BatteryIcon, SignalIcon, WifiIcon} from './Icons';

export const STATUS_H = 132;

// Odometer-style clock: characters that differ between `from` and `to` roll upwards.
const RollingClock: React.FC<{from: string; to: string; p: number; color: string}> = ({from, to, p, color}) => (
  <div style={{display: 'flex', direction: 'ltr', color}}>
    {from.split('').map((c, i) => {
      const d = to[i] ?? c;
      if (c === d || p <= 0) return <span key={i}>{p >= 1 ? d : c}</span>;
      if (p >= 1) return <span key={i}>{d}</span>;
      // stagger: rightmost digits roll first, like minutes ticking over fast
      const local = Math.min(1, Math.max(0, p * 1.6 - (from.length - 1 - i) * 0.3));
      return (
        <span key={i} style={{position: 'relative', display: 'inline-block', overflow: 'hidden', height: '1.2em'}}>
          <span style={{display: 'block', transform: `translateY(${-local * 1.2}em)`}}>
            <span style={{display: 'block', height: '1.2em'}}>{c}</span>
            <span style={{display: 'block', height: '1.2em'}}>{d}</span>
          </span>
        </span>
      );
    })}
  </div>
);

export const StatusBar: React.FC<{
  clock: string;
  clockTo?: string;
  roll?: number;
  battery: number;
  dark: boolean;
  network?: 'wifi' | '5G';
  shadow?: boolean;
}> = ({clock, clockTo, roll = 0, battery, dark, network = 'wifi', shadow}) => {
  const color = dark ? '#FFFFFF' : '#15130F';
  const low = battery <= 20;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1080,
        height: STATUS_H,
        fontFamily: UI_FONT,
        color,
        textShadow: shadow ? '0 1px 6px rgba(0,0,0,0.35)' : undefined,
        pointerEvents: 'none',
      }}
    >
      {/* RTL phones put the clock on the right */}
      <div style={{position: 'absolute', right: 86, top: 40, fontSize: 45, fontWeight: 600, lineHeight: '54px', letterSpacing: 0.5}}>
        <RollingClock from={clock} to={clockTo ?? clock} p={roll} color={color} />
      </div>
      <div style={{position: 'absolute', left: 74, top: 50, display: 'flex', alignItems: 'center', gap: 16, direction: 'ltr'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <BatteryIcon level={battery} size={70} color={color} fill={low ? '#FF3B30' : undefined} />
          <span style={{fontSize: 34, fontWeight: 600, color: low ? '#FF453A' : color, fontFamily: UI_FONT}}>{battery}%</span>
        </div>
        {network === 'wifi' ? <WifiIcon size={44} color={color} /> : <span style={{fontSize: 32, fontWeight: 700}}>5G</span>}
        <SignalIcon size={44} color={color} bars={network === '5G' ? 3 : 4} />
      </div>
    </div>
  );
};

// Gesture bar at the bottom of every app.
export const HomeBar: React.FC<{dark: boolean}> = ({dark}) => (
  <div
    style={{
      position: 'absolute',
      left: 540 - 190,
      bottom: 22,
      width: 380,
      height: 14,
      borderRadius: 7,
      background: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.78)',
    }}
  />
);
