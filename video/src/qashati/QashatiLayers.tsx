import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F, H, T, W, rnd} from './brand';
import {Cup} from './Cup';
import {AnimatedLogo} from './Logo';
import {TOPPINGS} from './Toppings';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// "طبقة فوق طبقة" — a 16 s 9:16 spot for Reels / TikTok / Snapchat.
// Hook (cup + cream drops) -> build the cup layer by layer -> topping variants -> logo -> order CTA.
// Key text stays inside the platforms' safe area (y 220–1500, x 60–960).

const STEPS = [
  {at: T.fruit1, ar: 'فواكه', en: 'Fruit'},
  {at: T.qashta, ar: 'قشطة شامية', en: 'Levantine qashta'},
  {at: T.fruit2, ar: 'فواكه كمان', en: 'More fruit'},
  {at: T.honey, ar: 'عسل', en: 'Honey'},
  {at: T.nuts, ar: 'مكسرات', en: 'Nuts'},
  ...TOPPINGS.map((t, i) => ({at: T.swaps[i], ar: t.ar, en: t.en})),
];

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${C.turquoiseLight} 0%, ${C.turquoise} 45%, ${C.turquoiseDeep} 100%)`}}>
      {Array.from({length: 14}, (_, i) => {
        const size = rnd(`bs${i}`, 40, 160);
        const x = rnd(`bx${i}`, 0, W);
        const y = (rnd(`by${i}`, 0, H) - frame * rnd(`bv${i}`, 0.6, 2)) % (H + 200);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: (y + H + 200) % (H + 200) - 100,
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.16)',
              filter: 'blur(6px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Hero beat (7.6 s "ding"): sparkles pop around the finished cup.
const SPARKS = [
  [300, 600, 1],
  [790, 560, 1.3],
  [210, 930, 0.8],
  [880, 880, 1],
  [540, 500, 0.9],
  [900, 1180, 0.7],
  [180, 1220, 0.9],
];
const Sparkles: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {SPARKS.map(([x, y, k], i) => {
        const t = interpolate(frame, [T.hero - 4 + i * 2, T.hero + 4 + i * 2, T.hero + 18 + i * 2], [0, 1, 0], clamp);
        if (t <= 0) return null;
        const r = 38 * k * t;
        return (
          <path
            key={i}
            transform={`translate(${x} ${y}) rotate(${t * 45})`}
            d={`M0 ${-r} Q ${r * 0.14} ${-r * 0.14} ${r} 0 Q ${r * 0.14} ${r * 0.14} 0 ${r} Q ${-r * 0.14} ${r * 0.14} ${-r} 0 Q ${-r * 0.14} ${-r * 0.14} 0 ${-r} Z`}
            fill={C.white}
          />
        );
      })}
    </svg>
  );
};

const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const second = frame >= T.swaps[0] - 4;
  const pop = spring({frame: second ? frame - (T.swaps[0] - 4) : frame + 4, fps, config: {damping: 11, stiffness: 160}});
  const out = interpolate(frame, [T.wipe, T.wipe + 10], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        top: 220,
        width: W,
        textAlign: 'center',
        direction: 'rtl',
        fontFamily: F.arabic,
        fontWeight: 800,
        fontSize: 124,
        lineHeight: 1.1,
        color: C.teal,
        opacity: out,
        transform: `scale(${0.7 + 0.3 * pop})`,
        textShadow: '0 6px 0 rgba(255,255,255,0.35)',
      }}
    >
      {second ? 'اختار إضافتك' : 'طبقة فوق طبقة'}
    </div>
  );
};

const StepLabel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  let idx = -1;
  STEPS.forEach((s, i) => {
    if (frame >= s.at) idx = i;
  });
  if (idx < 0 || frame >= T.wipe) return null;
  const step = STEPS[idx];
  const pop = spring({frame: frame - step.at, fps, config: {damping: 10, stiffness: 180}});
  const isTopping = idx >= STEPS.length - TOPPINGS.length;
  return (
    <div style={{position: 'absolute', top: 400, width: W, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          direction: 'rtl',
          background: isTopping ? C.teal : C.white,
          color: isTopping ? C.white : C.teal,
          borderRadius: 999,
          padding: '12px 42px 16px',
          transform: `scale(${pop}) rotate(${(1 - pop) * -6}deg)`,
          boxShadow: '0 12px 30px rgba(5,63,59,0.18)',
        }}
      >
        {!isTopping ? (
          <span
            style={{
              fontFamily: F.latin,
              fontWeight: 700,
              fontSize: 34,
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: C.turquoise,
              color: C.teal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {idx + 1}
          </span>
        ) : null}
        <span style={{fontFamily: F.arabic, fontWeight: 800, fontSize: 70, lineHeight: 1.25}}>{step.ar}</span>
        <span style={{fontFamily: F.latin, fontWeight: 500, fontSize: 30, opacity: 0.65, direction: 'ltr'}}>{step.en}</span>
      </div>
    </div>
  );
};

// Qashta pours down over the frame with drippy edges, then slides away onto the end card.
const edge = (y: number, key: string, dir: 1 | -1) => {
  const n = 9;
  let d = `M0 ${y}`;
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * W;
    const x1 = ((i + 1) / n) * W;
    const len = rnd(`${key}${i}`, 50, 200) * dir;
    d += ` L${x0 + 18} ${y} C ${x0 + 18} ${y + len}, ${x1 - 18} ${y + len}, ${x1 - 18} ${y} L${x1} ${y}`;
  }
  return d;
};

const DripWipe: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.wipe || frame > T.logo + 22) return null;
  const cover = interpolate(frame, [T.wipe, T.wipe + 20], [-250, H + 250], {...clamp, easing: Easing.in(Easing.cubic)});
  const reveal = interpolate(frame, [T.wipe + 20, T.logo + 20], [-250, H + 450], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}} width="100%" height="100%">
      {/* body of the pour, bottom edge dripping down, top edge trailing up */}
      <path d={`${edge(cover, 'bot', 1)} L${W} ${reveal} L0 ${reveal} Z`} fill={C.cream} />
      <path d={`${edge(reveal, 'top', -1)} L${W} ${reveal + 2} L0 ${reveal + 2} Z`} fill={C.cream} />
    </svg>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < T.wipe + 18) return null;
  const tag = interpolate(frame, [T.logo + 30, T.logo + 44], [0, 1], clamp);
  const cta = spring({frame: frame - T.cta, fps, config: {damping: 10, stiffness: 150}});
  const range = interpolate(frame, [T.cta + 8, T.cta + 20], [0, 1], clamp);
  const glow = 0.85 + 0.15 * Math.sin(frame / 8);
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 50% at 50% 40%, #0B5E58 0%, ${C.teal} 55%, ${C.tealDark} 100%)`}}>
      <div
        style={{
          position: 'absolute',
          left: W / 2 - 360,
          top: 380,
          width: 720,
          height: 720,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(1,232,213,${0.28 * glow}) 0%, rgba(1,232,213,0) 65%)`,
        }}
      />
      <div style={{position: 'absolute', top: 300, width: W, display: 'flex', justifyContent: 'center'}}>
        <AnimatedLogo start={T.logo} width={500} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 1010,
          width: W,
          textAlign: 'center',
          fontFamily: F.latin,
          fontWeight: 500,
          fontSize: 38,
          letterSpacing: '0.32em',
          paddingLeft: '0.32em',
          textTransform: 'uppercase',
          color: C.cream,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 20}px)`,
        }}
      >
        The Sweet Happiness
      </div>
      <div style={{position: 'absolute', top: 1130, width: W, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            direction: 'rtl',
            fontFamily: F.arabic,
            fontWeight: 800,
            fontSize: 68,
            lineHeight: 1.3,
            color: C.teal,
            background: C.turquoise,
            borderRadius: 999,
            padding: '14px 64px 20px',
            transform: `scale(${cta})`,
            boxShadow: `0 0 ${40 * cta}px rgba(1,232,213,0.45)`,
          }}
        >
          اطلبها الآن من طلبات
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 1290,
          width: W,
          textAlign: 'center',
          direction: 'rtl',
          fontFamily: F.arabic,
          fontWeight: 600,
          fontSize: 42,
          color: C.cream,
          opacity: 0.8 * range,
        }}
      >
        قشاطي · كوكتيلات · عصائر · حلويات
      </div>
    </AbsoluteFill>
  );
};

export const QashatiLayers: React.FC<{music: string}> = ({music}) => {
  const {width} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: C.turquoise, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${width / W})`, transformOrigin: '0 0'}}>
        <Background />
        <Cup />
        <Sparkles />
        <Headline />
        <StepLabel />
        <EndCard />
        <DripWipe />
      </div>
      {music ? <Audio src={staticFile(music)} /> : null}
    </AbsoluteFill>
  );
};
