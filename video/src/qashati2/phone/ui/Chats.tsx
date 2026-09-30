// 23:04 boss chat (keyboard up, frozen), 23:31 chat list flash, 23:31 family group chaos.
import React from 'react';
import {interpolate} from 'remotion';
import {COPY, T} from '../../spec';
import {UI_FONT, UIC} from '../theme';
import {clamp, hash, P} from '../timeline';
import {Avatar, Bubble, bubbleH, ChatHeader, ChatWallpaper, DateChip, GroupAvatar, InputBar} from './ChatBits';
import {SearchIcon} from './Icons';
import {Keyboard} from './Keyboard';
import {HomeBar} from './StatusBar';

export const arabicDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const KB_TOP = 1020;
const INPUT_TOP = 910;

// ---------------------------------------------------------------- boss
export const BossChat: React.FC<{frame: number}> = ({frame}) => {
  const words = COPY.boss.message.split(' ');
  const msg = [words.slice(0, 4).join(' '), words.slice(4).join(' ')];
  const newTop = INPUT_TOP - 16 - bubbleH(2);
  const badgeN = Math.round(interpolate(frame, [P.familyBadge.from, P.familyBadge.to], [0, 37], clamp));
  const lastBump = frame - Math.round(interpolate(badgeN, [0, 37], [P.familyBadge.from, P.familyBadge.to]));
  const badgeScale = badgeN > 0 ? 1 + 0.18 * Math.exp(-Math.max(0, lastBump) * 0.9) : 1;
  const h1 = bubbleH(1);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', direction: 'rtl', fontFamily: UI_FONT}}>
      <ChatWallpaper />
      <DateChip top={newTop - 3 * (h1 + 14) - 90} text="اليوم" />
      <Bubble side="in" top={newTop - 3 * (h1 + 14) - 12} lines={['وين وصلت بالتقرير؟']} time="6:52 م" />
      <Bubble side="out" top={newTop - 2 * (h1 + 14) - 6} lines={['خلّصته تقريباً 👍']} time="6:53 م" ticks />
      <Bubble side="in" top={newTop - (h1 + 14)} lines={['تمام']} time="6:55 م" />
      <Bubble side="in" top={newTop} lines={msg} time={COPY.boss.time} />
      <ChatHeader
        name={COPY.boss.contact}
        sub="متصل الآن"
        subColor={UIC.unread}
        avatar={<Avatar size={104} bg="linear-gradient(135deg,#6A7BFF,#4150C9)" text="م" />}
        badge={badgeN ? arabicDigits(badgeN) : undefined}
        badgeScale={badgeScale}
      />
      <InputBar top={INPUT_TOP} cursor={frame % 16 < 9} keyboard />
      <Keyboard top={KB_TOP} suggestions={['تمام', 'حاضر', 'إن شاء الله']} />
      <HomeBar dark />
    </div>
  );
};

// ---------------------------------------------------------------- chat list
const rows = [
  {name: COPY.family.group, preview: `${COPY.family.messages[3].from}: ${COPY.family.messages[3].text}`, time: '11:31 م', badge: '٣٧', avatar: {bg: '#2B3A55'}},
  {name: COPY.boss.contact, preview: COPY.boss.message, time: COPY.boss.time, avatar: {bg: 'linear-gradient(135deg,#6A7BFF,#4150C9)', text: 'م'}},
  {name: 'خالتو ريم', preview: '🎤 رسالة صوتية (٠:٤٧)', time: '10:48 م', avatar: {bg: '#1F8F6A', text: 'ر'}},
  {name: 'صيانة المكيّف ❄️', preview: 'الفني بيوصل بكرا بين ٩ الصبح و٦ المسا', time: '9:15 م', avatar: {bg: '#2D6FB5', text: 'ص'}},
  {name: 'جمعية البناية', preview: 'الرجاء عدم ترك الأحذية أمام الأبواب 🙏', time: '8:02 م', avatar: {bg: '#8A5A2B', text: 'ج'}},
  {name: 'أحمد – الشغل', preview: '📎 التقرير_النهائي_٣.pdf', time: 'أمس', avatar: {bg: '#6B4FA8', text: 'أ'}},
  {name: 'بابا', preview: 'وين صرت؟', time: 'أمس', avatar: {bg: '#B8742B', text: 'ب'}},
];

export const ChatList: React.FC<{frame: number; pressed: number}> = ({frame, pressed}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', direction: 'rtl', fontFamily: UI_FONT, background: UIC.darkBg, color: UIC.darkText}}>
    <div style={{position: 'absolute', top: 150, right: 50, fontSize: 84, fontWeight: 700}}>الدردشات</div>
    <div style={{position: 'absolute', top: 290, left: 40, right: 40, height: 92, borderRadius: 26, background: '#1C2127', display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px', color: '#6F7782', fontSize: 38}}>
      <SearchIcon size={44} color="#6F7782" />
      بحث
    </div>
    <div style={{position: 'absolute', top: 410, right: 40, display: 'flex', gap: 18}}>
      {['الكل', 'غير مقروءة', 'المجموعات', 'المفضلة'].map((c, i) => (
        <div key={c} style={{padding: '10px 30px', borderRadius: 30, background: i ? '#1C2127' : 'rgba(61,139,255,0.22)', color: i ? '#AEB5BF' : UIC.accent, fontSize: 32, fontWeight: 600}}>
          {c}
        </div>
      ))}
    </div>
    <div style={{position: 'absolute', top: 510, left: 0, width: 1080, height: 170, display: 'flex', alignItems: 'center', gap: 28, padding: '0 40px', boxSizing: 'border-box', color: UIC.darkSub, fontSize: 38}}>
      <div style={{width: 128, display: 'flex', justifyContent: 'center'}}>
        <svg width={64} height={64} viewBox="0 0 24 24">
          <path d="M3 5 H21 V9 H3 Z M4.5 9 V19.5 H19.5 V9 M9.5 12.5 H14.5" stroke="#8C939D" strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', borderBottom: `1.5px solid ${UIC.darkSep}`, height: '100%', alignItems: 'center'}}>
        <span style={{color: UIC.darkText, fontWeight: 600, fontSize: 40}}>المؤرشفة</span>
        <span>١٢</span>
      </div>
    </div>
    {rows.map((r, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          top: 690 + i * 184,
          left: 0,
          width: 1080,
          height: 184,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          padding: '0 40px',
          boxSizing: 'border-box',
          background: i === 0 && pressed > 0 ? `rgba(255,255,255,${0.1 * pressed})` : undefined,
        }}
      >
        {i === 0 ? <GroupAvatar size={128} /> : <Avatar size={128} bg={r.avatar.bg} text={r.avatar.text} />}
        <div style={{flex: 1, minWidth: 0, borderBottom: `1.5px solid ${UIC.darkSep}`, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: 44, fontWeight: 600}}>{r.name}</span>
            <span style={{fontSize: 30, color: r.badge ? UIC.unread : UIC.darkSub, direction: 'rtl'}}>{r.time}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginTop: 6}}>
            <span style={{fontSize: 36, color: i === 0 ? UIC.unread : UIC.darkSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {i === 0 ? (frame % 10 < 5 ? 'ماما تكتب…' : 'لين تكتب…') : r.preview}
            </span>
            {r.badge ? (
              <span style={{minWidth: 58, height: 58, borderRadius: 29, background: UIC.unread, color: '#06210F', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', boxSizing: 'border-box'}}>
                {r.badge}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    ))}
    <HomeBar dark />
  </div>
);

// ---------------------------------------------------------------- family group
const PEOPLE: Record<string, string> = {
  ماما: '#FF7AB6',
  سامي: '#5AB0FF',
  لين: '#C49BFF',
  بابا: '#FFB547',
  'خالتو ريم': '#43D19E',
  جدو: '#FFD84D',
};

type Item =
  | {kind: 'text'; from?: string; text: string; time: string; out?: boolean}
  | {kind: 'divider'; text: string}
  | {kind: 'sticker'; from: string; emoji: string; time: string}
  | {kind: 'voice'; from: string; dur: string; time: string}
  | {kind: 'photo'; from: string; caption: string; time: string};

const itemH = (it: Item) => {
  switch (it.kind) {
    case 'divider':
      return 76;
    case 'sticker':
      return 190;
    case 'voice':
      return bubbleH(1, true) + 10;
    case 'photo':
      return 470;
    default:
      return bubbleH(1, !it.out);
  }
};

const M = COPY.family.messages;
const base: Item[] = [
  {kind: 'text', from: 'خالتو ريم', text: 'تصبحوا على خير 🌙', time: '10:58 م'},
  {kind: 'text', out: true, text: 'وأنتِ من أهله', time: '10:59 م'},
  {kind: 'divider', text: COPY.family.unread},
  {kind: 'text', from: M[0].from, text: M[0].text, time: '11:29 م'},
  {kind: 'text', from: M[1].from, text: M[1].text, time: '11:29 م'},
  {kind: 'voice', from: 'خالتو ريم', dur: '0:47', time: '11:30 م'},
  {kind: 'text', from: M[2].from, text: M[2].text, time: '11:30 م'},
  {kind: 'text', from: M[3].from, text: M[3].text, time: '11:31 م'},
];
const chaos: Item[] = [
  {kind: 'text', from: 'ماما', text: 'سامي؟؟؟', time: '11:31 م'},
  {kind: 'sticker', from: 'لين', emoji: '🕵️‍♀️', time: '11:31 م'},
  {kind: 'text', from: 'خالتو ريم', text: 'شو القصة؟ 😂', time: '11:31 م'},
  {kind: 'text', from: 'سامي', text: 'والله مو أنا', time: '11:31 م'},
  {kind: 'photo', from: 'لين', caption: 'الدليل 📸', time: '11:31 م'},
  {kind: 'text', from: 'جدو', text: 'شو صار؟', time: '11:31 م'},
  {kind: 'text', from: 'ماما', text: 'الصحن فاضي!!', time: '11:31 م'},
  {kind: 'text', from: 'سامي', text: '😭😭😭', time: '11:31 م'},
  {kind: 'text', from: 'بابا', text: 'خلص يا جماعة', time: '11:31 م'},
  {kind: 'text', from: 'ماما', text: 'لا مش خلص!!', time: '11:31 م'},
  {kind: 'text', from: 'خالتو ريم', text: 'هههههههههههه', time: '11:31 م'},
  {kind: 'text', from: 'لين', text: 'اعترف يا سامي', time: '11:31 م'},
  {kind: 'text', from: 'جدو', text: '👍', time: '11:31 م'},
  {kind: 'text', from: 'ماما', text: '😡😡', time: '11:31 م'},
];

// frames at which chaos messages land: accelerating from every ~3.5 frames to every ~1.3
const arrivals = (() => {
  const out: number[] = [];
  let t = P.chaos.from + 1;
  for (let i = 0; i < chaos.length; i++) {
    out.push(Math.round(t));
    t += Math.max(1.2, 3.6 - i * 0.28);
  }
  return out;
})();
export const familyArrivals = arrivals;

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
  <svg width={520} height={330} viewBox="0 0 520 330" style={{display: 'block', borderRadius: 28, marginTop: 8}}>
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
    {/* plate: contact shadow, rim, well */}
    <ellipse cx={272} cy={196} rx={176} ry={104} fill="#000" opacity={0.55} filter="url(#q2-ph-soft)" />
    <ellipse cx={262} cy={176} rx={176} ry={104} fill="url(#q2-ph-plate)" />
    <ellipse cx={262} cy={172} rx={128} ry={72} fill="url(#q2-ph-well)" stroke="#D2C9BB" strokeWidth={2} />
    <path d="M110 150 C150 88 360 80 420 140" stroke="#FFFFFF" strokeWidth={5} fill="none" opacity={0.8} strokeLinecap="round" />
    {/* the evidence: a dragged smear of chocolate frosting + crumbs */}
    <path d="M196 196 C226 176 262 186 300 164 C314 156 330 160 334 168" stroke="#4A2614" strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.85} />
    <path d="M200 192 C228 174 262 183 298 162" stroke="#7A4526" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
    {CRUMBS.map((c, i) => (
      <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
        <ellipse rx={c.r * 1.25} ry={c.r} fill={i % 3 ? '#5A3019' : '#3B1D0E'} />
        <ellipse cx={-c.r * 0.3} cy={-c.r * 0.35} rx={c.r * 0.45} ry={c.r * 0.3} fill="#9A6440" opacity={0.8} />
      </g>
    ))}
    {/* fork lying across the plate */}
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

const renderItem = (it: Item, top: number, key: string | number, opacity = 1, dy = 0) => {
  const wrap = (el: React.ReactNode) => (
    <div key={key} style={{position: 'absolute', inset: 0, opacity, transform: `translateY(${dy}px)`}}>
      {el}
    </div>
  );
  switch (it.kind) {
    case 'divider':
      return wrap(
        <div style={{position: 'absolute', top: top + 8, left: 0, width: 1080, height: 60, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9D1DB', fontSize: 32, fontWeight: 600, fontFamily: UI_FONT}}>
          {it.text}
        </div>,
      );
    case 'sticker':
      return wrap(
        <div style={{position: 'absolute', top, right: 40, fontSize: 150, lineHeight: '180px'}}>{it.emoji}</div>,
      );
    case 'voice':
      return wrap(
        <Bubble side="in" top={top} time={it.time} sender={{name: it.from, color: PEOPLE[it.from]}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, direction: 'ltr', height: 60}}>
            <div style={{width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: `28px solid ${UIC.darkText}`}} />
            <Wave seed={3} />
            <span style={{fontSize: 30, color: UIC.darkSub}}>{it.dur}</span>
          </div>
        </Bubble>,
      );
    case 'photo':
      return wrap(
        <Bubble side="in" top={top} time={it.time} sender={{name: it.from, color: PEOPLE[it.from]}} style={{padding: '14px 14px 10px'}}>
          <EvidencePhoto />
          <div style={{fontSize: 40, marginTop: 8, marginRight: 14}}>{it.caption}</div>
        </Bubble>,
      );
    default:
      return wrap(
        <Bubble side={it.out ? 'out' : 'in'} top={top} lines={[it.text]} time={it.time} ticks={it.out} sender={it.from ? {name: it.from, color: PEOPLE[it.from]} : undefined} />,
      );
  }
};

export const FAMILY_FIRST_TOP = 318;
const GAP = 12;

export const FamilyChat: React.FC<{frame: number}> = ({frame}) => {
  const f = Math.min(frame, T.act1End); // dead stop: everything freezes at act1End
  const items: {it: Item; h: number; top: number; t: number}[] = [];
  let y = FAMILY_FIRST_TOP;
  base.forEach((it) => {
    const h = itemH(it);
    items.push({it, h, top: y, t: 1});
    y += h + GAP;
  });
  let scroll = 0;
  const bottomLimit = 1760;
  chaos.forEach((it, i) => {
    const t = interpolate(f, [arrivals[i], arrivals[i] + 3], [0, 1], clamp);
    if (t <= 0) return;
    const h = itemH(it);
    items.push({it, h, top: y, t});
    y += (h + GAP) * t;
  });
  scroll = Math.max(0, y - bottomLimit);
  const typing = f >= P.chaos.from ? ['ماما تكتب…', 'لين تكتب…', 'سامي يكتب…', 'خالتو ريم تكتب…'][Math.floor(f / 4) % 4] : 'ماما، بابا، سامي، لين، خالتو ريم، جدو، أنت';
  const unseen = chaos.filter((_, i) => arrivals[i] <= f).length;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', direction: 'rtl', fontFamily: UI_FONT}}>
      <ChatWallpaper />
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)`}}>
        {items.map(({it, top, t}, i) => renderItem(it, top, i, t, (1 - t) * 40))}
      </div>
      <ChatHeader
        name={COPY.family.group}
        sub={typing}
        subColor={f >= P.chaos.from ? UIC.unread : undefined}
        avatar={<GroupAvatar size={104} />}
        badge="٢"
      />
      {unseen > 0 ? (
        <div style={{position: 'absolute', left: 40, top: 1620, width: 96, height: 96, borderRadius: 48, background: '#262B32', boxShadow: '0 4px 10px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={44} height={44} viewBox="0 0 24 24">
            <path d="M5 9 L12 16 L19 9" stroke="#C9D1DB" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', top: -14, right: -8, minWidth: 50, height: 50, borderRadius: 25, background: UIC.unread, color: '#06210F', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', boxSizing: 'border-box'}}>
            {arabicDigits(unseen)}
          </div>
        </div>
      ) : null}
      <InputBar top={1770} cursor={false} keyboard={false} />
      <HomeBar dark />
    </div>
  );
};
