// 23:04 lock screen = the boss beat: the phone wakes to the boss's message, big, right under the clock
// (no keyboard, nothing covering it; smart replies «تمام · حاضر · إن شاء الله»). Then the family group
// explodes on top of it while the clock runs on to 23:31, and a tap opens the group.
import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {COPY, FPS, T} from '../../spec';
import {UI_FONT} from '../theme';
import {clamp, hash, P} from '../timeline';
import {GroupAvatar} from './ChatBits';
import {CameraIcon, FlashlightIcon} from './Icons';
import {HomeBar, RollingClock} from './StatusBar';
import {Mixed} from './Text';

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

const STACK_TOP = 424;
const BOSS_H = 262;
const FAM_H = 238;
const GAP = 16;
export const FAM_CARD = {top: STACK_TOP, left: 36, width: 1008, height: FAM_H};
// Air date is October (see spec: humid, 41°). Thursday, so the weather's «اليوم/الجمعة…» logic holds.
const DATE = 'الخميس 8 أكتوبر';

const Skyline: React.FC = () => {
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

const cardStyle = (pressed = 0): React.CSSProperties => ({
  position: 'absolute',
  left: 36,
  width: 1008,
  borderRadius: 52,
  background: `rgba(${255 - pressed * 40},${255 - pressed * 40},${255 - pressed * 40},${0.2 + pressed * 0.06})`,
  backdropFilter: 'blur(24px)',
  border: '1.5px solid rgba(255,255,255,0.14)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
  boxSizing: 'border-box',
  padding: '28px 36px',
  display: 'flex',
  gap: 28,
});

export const LockScreen: React.FC<{frame: number}> = ({frame}) => {
  const wake = interpolate(frame, [P.wake, P.wake + 3], [0, 1], clamp);
  const nB = spring({frame: frame - P.bossNotif, fps: FPS, config: {damping: 15, stiffness: 200}});
  const nF = spring({frame: frame - P.famNotif, fps: FPS, config: {damping: 14, stiffness: 210}});
  const pressed = interpolate(frame, [P.famTap - 1, P.famTap, P.famTap + 2], [0, 1, 0.6], clamp);
  const roll = interpolate(frame, [P.clockRoll.from, P.clockRoll.to], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  // editorial punch-in on the boss's message, released when the family explodes
  const punch =
    interpolate(frame, [P.bossPunch.from, P.bossPunch.to], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.8, 0.3, 1)}) *
    (1 - interpolate(frame, [P.famNotif - 3, P.famNotif + 2], [0, 1], clamp));
  const unread = Math.round(interpolate(frame, [P.famNotif, P.famTap - 1], [12, 37], clamp));
  const bossTop = STACK_TOP + nF * (FAM_H + GAP);
  const bossCy = STACK_TOP + BOSS_H / 2;
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
      <div style={{position: 'absolute', inset: 0, transformOrigin: `540px ${bossCy}px`, transform: `scale(${1 + 0.12 * punch})`}}>
        <div style={{position: 'absolute', top: 146, width: '100%', textAlign: 'center', fontSize: 42, fontWeight: 500, opacity: 0.88}}>
          <Mixed text={DATE} />
        </div>
        <div style={{position: 'absolute', top: 176, width: '100%', display: 'flex', justifyContent: 'center', fontSize: 196, fontWeight: 600, lineHeight: '236px', letterSpacing: -4}}>
          <RollingClock from={T.screens[2].clock} to={T.screens[3].clock} p={roll} color="#FFFFFF" />
        </div>

        {/* boss */}
        <div style={{...cardStyle(), top: bossTop, height: BOSS_H, transform: `translateY(${(1 - nB) * 140}px) scale(${0.92 + 0.08 * nB})`, opacity: Math.min(1, nB * 1.4) * (1 - 0.35 * nF)}}>
          <MessengerIcon size={96} />
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontSize: 42, fontWeight: 700}}>{COPY.boss.contact}</span>
              <span style={{fontSize: 30, opacity: 0.7}}>الآن</span>
            </div>
            <div style={{fontSize: 56, fontWeight: 500, lineHeight: '78px', marginTop: 4, whiteSpace: 'nowrap'}}>
              <Mixed text={COPY.boss.message} />
            </div>
            <div style={{display: 'flex', gap: 16, marginTop: 14}}>
              {['تمام', 'حاضر', 'إن شاء الله'].map((c) => (
                <span key={c} style={{fontSize: 32, fontWeight: 600, padding: '8px 30px', borderRadius: 32, background: 'rgba(255,255,255,0.18)'}}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* family, landing on top of the stack */}
        {nF > 0.01 ? (
          <div
            style={{
              ...cardStyle(pressed),
              top: FAM_CARD.top,
              height: FAM_H,
              transform: `translateY(${(1 - nF) * -60}px) scale(${(0.9 + 0.1 * nF) * (1 - pressed * 0.03)})`,
              opacity: Math.min(1, nF * 1.5),
            }}
          >
            <GroupAvatar size={96} />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                <span style={{fontSize: 42, fontWeight: 700}}>{COPY.family.group}</span>
                <span style={{fontSize: 30, opacity: 0.7}}>الآن</span>
              </div>
              <div style={{fontSize: 50, fontWeight: 500, lineHeight: '70px', marginTop: 4, whiteSpace: 'nowrap'}}>
                {COPY.family.messages[0].from}: {COPY.family.messages[0].text}
              </div>
              <div style={{fontSize: 32, opacity: 0.72, marginTop: 6}}>
                <Mixed text={COPY.family.unread.replace(/\d+/, String(unread))} />
              </div>
            </div>
          </div>
        ) : null}
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
