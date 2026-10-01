// 23:31 family group. Opens (from the lock-screen notification) on the first unread message, so
// «مين أكل آخر قطعة كيك؟؟» sits in the top band, clear of every stamp. The thumb then scrolls down to
// لين's «الدليل 📸» photo and stops there while the chat keeps exploding below (typing, the ↓ counter).
import React from 'react';
import {interpolate} from 'remotion';
import {COPY} from '../../spec';
import {UI_FONT, UIC} from '../theme';
import {clamp, frozen, hash, P} from '../timeline';
import {Bubble, bubbleH, ChatHeader, ChatWallpaper, GroupAvatar, InputBar} from './ChatBits';
import {HomeBar} from './StatusBar';

const PEOPLE: Record<string, string> = {
  ماما: '#FF7AB6',
  سامي: '#5AB0FF',
  لين: '#C49BFF',
  بابا: '#FFB547',
  'خالتو ريم': '#43D19E',
  جدو: '#FFD84D',
};

type Item =
  | {kind: 'text'; from?: string; text: string; time: string; out?: boolean; cont?: boolean}
  | {kind: 'divider'; text: string}
  | {kind: 'voice'; from: string; dur: string; time: string}
  | {kind: 'photo'; from: string; caption: string; time: string; cont?: boolean};

const PHOTO = {w: 480, h: 290};

const itemH = (it: Item) => {
  switch (it.kind) {
    case 'divider':
      return 76;
    case 'voice':
      return bubbleH(1, true) + 10;
    case 'photo':
      return 14 + PHOTO.h + 8 + 52 + 12 + (it.cont ? 0 : 40);
    default:
      return bubbleH(1, !it.out && !it.cont);
  }
};

const M = COPY.family.messages;
const ITEMS: Item[] = [
  {kind: 'divider', text: COPY.family.unread},
  {kind: 'text', from: M[0].from, text: M[0].text, time: '23:29'},
  {kind: 'text', from: M[1].from, text: M[1].text, time: '23:29'},
  {kind: 'voice', from: 'خالتو ريم', dur: '0:47', time: '23:30'},
  {kind: 'text', from: M[2].from, text: M[2].text, time: '23:30'},
  {kind: 'photo', from: M[2].from, caption: 'الدليل 📸', time: '23:30', cont: true},
  {kind: 'text', from: M[3].from, text: M[3].text, time: '23:31'},
  {kind: 'text', from: 'ماما', text: 'سامي؟؟؟', time: '23:31'},
  {kind: 'text', from: 'خالتو ريم', text: 'شو القصة؟ 😂', time: '23:31'},
  {kind: 'text', from: 'سامي', text: 'والله مو أنا', time: '23:31'},
  {kind: 'text', from: 'جدو', text: 'شو صار؟', time: '23:31'},
  {kind: 'text', from: 'ماما', text: 'الصحن فاضي!!', time: '23:31'},
  {kind: 'text', from: 'سامي', text: '😭😭😭', time: '23:31'},
];

export const FAMILY_FIRST_TOP = 312;
const GAP = 12;
const TOPS = (() => {
  const out: number[] = [];
  let y = FAMILY_FIRST_TOP;
  ITEMS.forEach((it) => {
    out.push(y);
    y += itemH(it) + GAP;
  });
  return out;
})();
const PHOTO_IDX = ITEMS.findIndex((it) => it.kind === 'photo');
// the thumb scrolls until the photo sits just under the header
export const FAMILY_SCROLL = TOPS[PHOTO_IDX] - 306;

const Wave: React.FC<{seed: number}> = ({seed}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 5, height: 60}}>
    {Array.from({length: 30}).map((_, i) => (
      <div key={i} style={{width: 6, borderRadius: 3, height: 10 + 42 * Math.abs(Math.sin(i * 0.9 + seed) * hash(i + seed)), background: i < 9 ? UIC.accent : '#7E8691'}} />
    ))}
  </div>
);

// «الدليل»: a harsh-flash night photo of the empty cake plate — wood table, ceramic plate shot at an
// angle, a smear of frosting, crumbs, a fork, flash hotspot, vignette and sensor grain.
const CRUMBS = Array.from({length: 26}).map((_, i) => {
  const a = hash(i * 3 + 1) * Math.PI * 2;
  const rr = Math.sqrt(hash(i * 7 + 2));
  return {x: 262 + Math.cos(a) * rr * 105, y: 170 + Math.sin(a) * rr * 58, r: 1.8 + hash(i + 5) * (i < 6 ? 6 : 3.2), rot: hash(i) * 180};
});
const EvidencePhoto: React.FC = React.memo(() => (
  <svg width={PHOTO.w} height={PHOTO.h} viewBox="10 12 500 302" preserveAspectRatio="xMidYMid slice" style={{display: 'block', borderRadius: 28, marginTop: 0}}>
    <defs>
      <linearGradient id="q2-ph-wood" x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0" stopColor="#3A2213" />
        <stop offset="0.45" stopColor="#6B4124" />
        <stop offset="1" stopColor="#2E1A0E" />
      </linearGradient>
      <pattern id="q2-ph-grain" width={520} height={24} patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <path d="M0 5 C120 2 260 9 520 4 M0 14 C150 17 300 11 520 16 M0 21 C200 19 340 23 520 20" stroke="#1E1009" strokeWidth={1.4} fill="none" opacity={0.55} />
      </pattern>
      <radialGradient id="q2-ph-flash" cx="0.52" cy="0.46" r="0.62">
        <stop offset="0" stopColor="#FFF6E6" stopOpacity={0.55} />
        <stop offset="0.45" stopColor="#FFE9C8" stopOpacity={0.12} />
        <stop offset="1" stopColor="#000" stopOpacity={0.55} />
      </radialGradient>
      <radialGradient id="q2-ph-plate" cx="0.45" cy="0.38" r="0.7">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.7" stopColor="#ECE7DF" />
        <stop offset="1" stopColor="#C9C1B4" />
      </radialGradient>
      <radialGradient id="q2-ph-well" cx="0.5" cy="0.4" r="0.65">
        <stop offset="0" stopColor="#FBF8F3" />
        <stop offset="1" stopColor="#DCD4C8" />
      </radialGradient>
      <linearGradient id="q2-ph-fork" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F4F6F8" />
        <stop offset="0.5" stopColor="#A9B0B8" />
        <stop offset="1" stopColor="#6E757D" />
      </linearGradient>
      <filter id="q2-ph-noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={5} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.16 0" />
      </filter>
      <filter id="q2-ph-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={9} />
      </filter>
    </defs>
    <rect width={520} height={330} fill="url(#q2-ph-wood)" />
    <rect width={520} height={330} fill="url(#q2-ph-grain)" />
    <ellipse cx={272} cy={196} rx={176} ry={104} fill="#000" opacity={0.55} filter="url(#q2-ph-soft)" />
    <ellipse cx={262} cy={176} rx={176} ry={104} fill="url(#q2-ph-plate)" />
    <ellipse cx={262} cy={172} rx={128} ry={72} fill="url(#q2-ph-well)" stroke="#D2C9BB" strokeWidth={2} />
    <path d="M110 150 C150 88 360 80 420 140" stroke="#FFFFFF" strokeWidth={5} fill="none" opacity={0.8} strokeLinecap="round" />
    <path d="M196 196 C226 176 262 186 300 164 C314 156 330 160 334 168" stroke="#4A2614" strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.85} />
    <path d="M200 192 C228 174 262 183 298 162" stroke="#7A4526" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
    {CRUMBS.map((c, i) => (
      <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
        <ellipse rx={c.r * 1.25} ry={c.r} fill={i % 3 ? '#5A3019' : '#3B1D0E'} />
        <ellipse cx={-c.r * 0.3} cy={-c.r * 0.35} rx={c.r * 0.45} ry={c.r * 0.3} fill="#9A6440" opacity={0.8} />
      </g>
    ))}
    <g transform="rotate(-24 330 150)">
      <rect x={250} y={140} width={210} height={11} rx={5.5} fill="url(#q2-ph-fork)" />
      <rect x={208} y={136} width={48} height={19} rx={6} fill="url(#q2-ph-fork)" />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={170} y={137 + k * 4.6} width={44} height={3.2} rx={1.6} fill="url(#q2-ph-fork)" />
      ))}
      <rect x={262} y={141} width={180} height={2.5} rx={1.2} fill="#FFFFFF" opacity={0.85} />
    </g>
    <rect width={520} height={330} fill="url(#q2-ph-flash)" />
    <rect width={520} height={330} filter="url(#q2-ph-noise)" />
  </svg>
));

const renderItem = (it: Item, top: number, key: number) => {
  switch (it.kind) {
    case 'divider':
      return (
        <div key={key} style={{position: 'absolute', top: top + 8, left: 0, width: 1080, height: 60, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9D1DB', fontSize: 32, fontWeight: 600, fontFamily: UI_FONT}}>
          <span style={{direction: 'rtl'}}>{it.text}</span>
        </div>
      );
    case 'voice':
      return (
        <Bubble key={key} side="in" top={top} time={it.time} sender={{name: it.from, color: PEOPLE[it.from]}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, direction: 'ltr', height: 60}}>
            <div style={{width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: `28px solid ${UIC.darkText}`}} />
            <Wave seed={3} />
            <span style={{fontSize: 30, color: UIC.darkSub}}>{it.dur}</span>
          </div>
        </Bubble>
      );
    case 'photo':
      return (
        <Bubble key={key} side="in" top={top} time={it.time} tail={!it.cont} sender={it.cont ? undefined : {name: it.from, color: PEOPLE[it.from]}} style={{padding: '14px 14px 10px'}}>
          <EvidencePhoto />
          <div style={{fontSize: 40, lineHeight: '52px', marginTop: 8, marginRight: 14}}>{it.caption}</div>
        </Bubble>
      );
    default:
      return (
        <Bubble
          key={key}
          side={it.out ? 'out' : 'in'}
          top={top}
          lines={[it.text]}
          time={it.time}
          ticks={it.out}
          tail={!it.cont}
          sender={it.from && !it.cont ? {name: it.from, color: PEOPLE[it.from]} : undefined}
        />
      );
  }
};

export const FamilyChat: React.FC<{frame: number}> = ({frame}) => {
  const f = frozen(frame); // dead stop: everything freezes at act1End
  const scroll = interpolate(f, [P.famScroll.from, P.famScroll.to], [0, FAMILY_SCROLL], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 2.6)});
  // editorial punch-in on «مين أكل آخر قطعة كيك؟؟» while it is the punchline, released as the thumb scrolls
  const zoom = 1 + 0.16 * interpolate(f, [P.openFam.from + 2, P.openFam.to + 2, P.famScroll.from, P.famScroll.to - 2], [0, 1, 1, 0], {...clamp, easing: (t) => t * t * (3 - 2 * t)});
  const chaos = f >= P.chaos.from;
  const typing = chaos ? ['ماما تكتب…', 'لين تكتب…', 'سامي يكتب…', 'خالتو ريم تكتب…', 'جدو يكتب…'][Math.floor(f / 3) % 5] : 'ماما، بابا، سامي، لين، خالتو ريم، جدو، أنت';
  const incoming = chaos ? Math.round(interpolate(f, [P.chaos.from, P.chaos.to], [1, 24], {...clamp, easing: (t) => t * t})) : 0;
  const bump = chaos ? Math.exp(-((f * 7) % 3)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', direction: 'rtl', fontFamily: UI_FONT}}>
      <ChatWallpaper />
      <div style={{position: 'absolute', inset: 0, transformOrigin: `1080px ${FAMILY_FIRST_TOP}px`, transform: `translateY(${-scroll}px) scale(${zoom})`}}>
        {ITEMS.map((it, i) => renderItem(it, TOPS[i], i))}
      </div>
      <ChatHeader name={COPY.family.group} sub={typing} subColor={chaos ? UIC.unread : undefined} avatar={<GroupAvatar size={104} />} badge="1" />
      {incoming > 0 ? (
        <div style={{position: 'absolute', left: 40, top: 1620, width: 96, height: 96, borderRadius: 48, background: '#262B32', boxShadow: '0 4px 10px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={44} height={44} viewBox="0 0 24 24">
            <path d="M5 9 L12 16 L19 9" stroke="#C9D1DB" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', top: -14, right: -8, minWidth: 50, height: 50, borderRadius: 25, background: UIC.unread, color: '#06210F', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', boxSizing: 'border-box', transform: `scale(${1 + 0.15 * bump})`}}>
            {incoming}
          </div>
        </div>
      ) : null}
      <InputBar top={1770} cursor={false} keyboard={false} />
      <HomeBar dark />
    </div>
  );
};
