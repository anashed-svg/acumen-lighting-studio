// Generic dark-mode messenger pieces (RTL: incoming on the right, mine on the left).
import React from 'react';
import {UI_FONT, UIC} from '../theme';
import {BackChevron, CameraIcon, MicIcon, PhoneIcon, PlusIcon, StickerIcon, Ticks, VideoIcon} from './Icons';

export const BUBBLE = {font: 44, line: 60, padY: 18, padX: 32, name: 40, gap: 10, groupGap: 22};

// Height of a single-line bubble (texts in this story are kept to one or two lines).
export const bubbleH = (lines = 1, withName = false) => BUBBLE.padY * 2 - 4 + lines * BUBBLE.line + (withName ? BUBBLE.name : 0);

// time + read ticks tucked into the end of the last line
const Stamp: React.FC<{time: string; ticks?: boolean; inc: boolean}> = ({time, ticks, inc}) => (
  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 26, marginBottom: -6, direction: 'ltr', flexShrink: 0}}>
    {ticks ? <Ticks color="#A8D8FF" size={22} /> : null}
    <span style={{fontSize: 26, lineHeight: '34px', color: inc ? UIC.darkSub : 'rgba(255,255,255,0.72)', direction: 'rtl', whiteSpace: 'nowrap'}}>{time}</span>
  </span>
);

export const Bubble: React.FC<{
  side: 'in' | 'out';
  top: number;
  lines?: string[];
  time: string;
  sender?: {name: string; color: string};
  ticks?: boolean;
  tail?: boolean;
  maxW?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({side, top, lines = [], time, sender, ticks, tail = true, maxW = 800, children, style}) => {
  const inc = side === 'in';
  const r = 38;
  const radius = inc ? `${tail ? 10 : r}px ${r}px ${r}px ${r}px` : `${r}px ${tail ? 10 : r}px ${r}px ${r}px`;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        [inc ? 'right' : 'left']: 34,
        maxWidth: maxW,
        background: inc ? UIC.darkBubbleIn : UIC.darkBubbleOut,
        borderRadius: radius,
        padding: `${BUBBLE.padY}px ${BUBBLE.padX}px ${BUBBLE.padY - 4}px`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.25)',
        color: '#F4F6F8',
        fontFamily: UI_FONT,
        direction: 'rtl',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {sender ? <div style={{fontSize: 33, fontWeight: 600, color: sender.color, lineHeight: `${BUBBLE.name}px`}}>{sender.name}</div> : null}
      {children}
      {lines.map((l, i) => {
        const last = i === lines.length - 1;
        return (
          <div key={i} style={{display: 'flex', alignItems: 'flex-end', fontSize: BUBBLE.font, lineHeight: `${BUBBLE.line}px`, whiteSpace: 'nowrap', fontWeight: 400}}>
            <span>{l}</span>
            {last ? <Stamp time={time} ticks={ticks} inc={inc} /> : null}
          </div>
        );
      })}
      {lines.length === 0 ? (
        <div style={{display: 'flex', justifyContent: 'flex-end', height: 34}}>
          <Stamp time={time} ticks={ticks} inc={inc} />
        </div>
      ) : null}
    </div>
  );
};

export const DateChip: React.FC<{top: number; text: string}> = ({top, text}) => (
  <div style={{position: 'absolute', top, left: 0, width: 1080, display: 'flex', justifyContent: 'center'}}>
    <div style={{padding: '8px 28px', borderRadius: 22, background: 'rgba(40,44,50,0.92)', color: '#B7BDC6', fontSize: 30, fontWeight: 500, fontFamily: UI_FONT}}>{text}</div>
  </div>
);

export const Avatar: React.FC<{size: number; bg: string; text?: string; emoji?: string}> = ({size, bg, text, emoji}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: emoji ? size * 0.52 : size * 0.44,
      fontWeight: 600,
      fontFamily: UI_FONT,
      flexShrink: 0,
    }}
  >
    {emoji ?? text}
  </div>
);

// Group avatar: a 2x2 mosaic of family faces (the single "family" emoji renders as a sign-like tile).
export const GroupAvatar: React.FC<{size: number}> = ({size}) => {
  const faces = [
    {e: '👩', bg: '#F6B6C9'},
    {e: '👨', bg: '#9CC7F5'},
    {e: '👧', bg: '#D5B8FA'},
    {e: '👦', bg: '#FFD27A'},
  ];
  const m = size / 2;
  return (
    <div style={{width: size, height: size, borderRadius: size / 2, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#2B3A55'}}>
      {faces.map((f, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (i % 2) * m,
            top: Math.floor(i / 2) * m,
            width: m,
            height: m,
            background: f.bg,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            fontSize: m * 0.78,
            lineHeight: 1,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
          }}
        >
          <span style={{transform: `translateY(${m * 0.08}px)`}}>{f.e}</span>
        </div>
      ))}
    </div>
  );
};

export const ChatHeader: React.FC<{
  name: string;
  sub: string;
  subColor?: string;
  avatar: React.ReactNode;
  badge?: number | string;
  badgeScale?: number;
}> = ({name, sub, subColor, avatar, badge, badgeScale = 1}) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: 1080,
      height: 300,
      background: 'rgba(21,25,30,0.96)',
      borderBottom: `1.5px solid ${UIC.darkSep}`,
      fontFamily: UI_FONT,
      direction: 'rtl',
    }}
  >
    <div style={{position: 'absolute', top: 168, right: 26, display: 'flex', alignItems: 'center', gap: 4}}>
      <BackChevron size={62} color={UIC.accent} />
      {badge ? (
        <div
          style={{
            minWidth: 62,
            height: 54,
            padding: '0 14px',
            borderRadius: 27,
            background: UIC.accent,
            color: '#fff',
            fontSize: 32,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            transform: `scale(${badgeScale})`,
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
    <div style={{position: 'absolute', top: 150, right: badge ? 200 : 110, display: 'flex', alignItems: 'center', gap: 24}}>
      {avatar}
      <div>
        <div style={{fontSize: 46, fontWeight: 600, color: UIC.darkText, lineHeight: '58px', whiteSpace: 'nowrap'}}>{name}</div>
        <div style={{fontSize: 31, fontWeight: 500, color: subColor ?? UIC.darkSub, lineHeight: '40px', whiteSpace: 'nowrap'}}>{sub}</div>
      </div>
    </div>
    <div style={{position: 'absolute', top: 178, left: 50, display: 'flex', gap: 50}}>
      <PhoneIcon size={54} color={UIC.accent} />
      <VideoIcon size={58} color={UIC.accent} />
    </div>
  </div>
);

export const InputBar: React.FC<{top: number; cursor: boolean; keyboard: boolean}> = ({top, cursor, keyboard}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: 0,
      width: 1080,
      height: keyboard ? 110 : 150,
      background: 'rgba(21,25,30,0.97)',
      borderTop: `1.5px solid ${UIC.darkSep}`,
      display: 'flex',
      alignItems: keyboard ? 'center' : 'flex-start',
      paddingTop: keyboard ? 0 : 18,
      boxSizing: 'border-box',
      direction: 'rtl',
      fontFamily: UI_FONT,
      gap: 22,
      paddingRight: 30,
      paddingLeft: 30,
    }}
  >
    <PlusIcon size={58} color={UIC.accent} />
    <div
      style={{
        flex: 1,
        height: 80,
        borderRadius: 40,
        border: '2px solid rgba(255,255,255,0.14)',
        background: '#0F1216',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 10,
        boxSizing: 'border-box',
      }}
    >
      {cursor ? <div style={{width: 4, height: 50, background: UIC.accent, borderRadius: 2}} /> : null}
      <span style={{fontSize: 38, color: '#5E6570', flex: 1}}>رسالة</span>
      <StickerIcon size={46} color="#8C939D" />
    </div>
    <CameraIcon size={56} color={UIC.accent} />
    <MicIcon size={56} color={UIC.accent} />
  </div>
);

export const ChatWallpaper: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 30% 20%, #141A21 0%, ${UIC.darkBg} 60%), ${UIC.darkBg}`,
    }}
  >
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: 0.05}}>
      <defs>
        <pattern id="q2-doodle" width={180} height={180} patternUnits="userSpaceOnUse">
          <circle cx={30} cy={30} r={10} fill="none" stroke="#fff" strokeWidth={3} />
          <path d="M100 20 l14 14 l-14 14 l-14 -14 z" fill="none" stroke="#fff" strokeWidth={3} />
          <path d="M40 110 q20 -20 40 0 t40 0" fill="none" stroke="#fff" strokeWidth={3} />
          <rect x={130} y={120} width={24} height={24} rx={6} fill="none" stroke="#fff" strokeWidth={3} />
        </pattern>
      </defs>
      <rect width={1080} height={1920} fill="url(#q2-doodle)" />
    </svg>
  </div>
);
