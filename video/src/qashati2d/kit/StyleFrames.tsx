// Kit2DStyleFrames — a test reel that shows every kit component (one "page" per component).
// Pages and their frame ranges are in PAGES; tools/stills.sh renders chosen frames + phone-size copies.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {CreamDrop2D} from './art/CreamDrop';
import {Flame2D} from './art/Flame2D';
import {cupPoint, CUP_ANCHORS, HeroCup2D} from './art/HeroCup2D';
import {FamilyPlate2D, plateScoopPoint, PLATE_SCOOPS} from './art/FamilyPlate2D';
import {Hand2D, HAND_PRESETS} from './art/Hand2D';
import {InkTitle} from './type/InkTitle';
import {SpeechBubble} from './type/SpeechBubble';
import {EndCard2D, ENDCARD_DURATION} from './endcard/EndCard2D';
import {FONT} from './fonts';
import {PaperGrain} from './look/PaperGrain';
import {Riso} from './look/Riso';
import {C} from './palette';
import {jiggle, onTwos} from './time';

const Label: React.FC<{x: number; y: number; children: React.ReactNode; color?: string}> = ({x, y, children, color = C.teal}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', fontFamily: FONT.latin, fontSize: 26, color, whiteSpace: 'nowrap', opacity: 0.85}}>
    {children}
  </div>
);

const Page: React.FC<{bg?: string; title?: string; children: React.ReactNode}> = ({bg = C.turquoise, title, children}) => (
  <AbsoluteFill style={{background: bg}}>
    {children}
    {title ? <Label x={540} y={1840}>{title}</Label> : null}
    <PaperGrain />
  </AbsoluteFill>
);

// p1 — the hero cup, honey drizzling in (0–59)
const CupPage: React.FC = () => {
  const f = onTwos(useCurrentFrame()); // a drawing: everything on twos
  return (
    <Page title="HeroCup2D · qashta · honeyProgress">
      <HeroCup2D x={540} y={1460} scale={1.6} honeyProgress={Math.min(1, f / 40)} glint={(f - 44) / 14} />
    </Page>
  );
};

// p2 — states grid (60–119): chili + heat + flames · spoon dipping · spoon lifted (strand) · squash/wobble + drops
const StatesPage: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 59;
  const s = 0.82;
  const chiliAt = {x: 280, y: 860};
  const flames = CUP_ANCHORS.flames.map((p) => cupPoint(p, chiliAt.x, chiliAt.y, s));
  // landing drops on the 4th cup
  const land = 30;
  const fall = (k: number) => {
    const ff = onTwos(f) - (land + k * 6);
    if (ff < -12) return null;
    const y0 = 900;
    const y1 = 1130;
    const y = ff < 0 ? y1 - (y1 - y0) * (ff / -12) ** 2 : y1;
    return {y, stretch: ff < 0 ? 0.35 : 0, squash: ff >= 0 ? Math.max(0, 0.6 * Math.exp(-ff * 0.35) * Math.cos(ff * 0.7)) : 0};
  };
  const hit = jiggle(onTwos(f), land, 1, 0.9, 0.22);
  return (
    <Page title="variant chili + heat + Flame2D · spoon dipping · spoon lifted · squash/wobble + CreamDrop2D">
      <HeroCup2D x={chiliAt.x} y={chiliAt.y} scale={s} variant="chili" heat={1} />
      {flames.map(([x, y], i) => (
        <Flame2D key={i} x={x} y={y + 16} h={[110, 150, 120][i]} seed={i + 1} />
      ))}
      <HeroCup2D x={800} y={860} scale={s} spoon="dipping" spoonT={Math.min(1, t * 1.3)} />
      <HeroCup2D x={280} y={1640} scale={s} spoon="lifted" spoonT={Math.min(1, 0.15 + t * 0.8)} />
      <HeroCup2D x={800} y={1640} scale={s} squash={-0.12 * hit} wobble={hit * 0.8} honeyProgress={1} />
      {[0, 1].map((k) => {
        const d = fall(k);
        return d ? <CreamDrop2D key={k} x={560 + k * 70} y={d.y + (k ? -10 : 0)} h={64} which={k as 0 | 1} stretch={d.stretch} squash={d.squash} /> : null;
      })}
    </Page>
  );
};

// p3 — the family plate, eaten scoop by scoop (120–179): 0 → 8 in steps on twos, last frames = the lonely drop
const PlatePage: React.FC = () => {
  const f = useCurrentFrame();
  const taken = Math.min(8, onTwos(f) / 6);
  return (
    <Page bg={C.paper} title={`FamilyPlate2D · scoopsTaken ${taken.toFixed(2)}`}>
      <FamilyPlate2D x={540} y={900} scale={1.0} scoopsTaken={taken} rotate={-6 + f * 0.1} dropWobble={taken >= 8 ? jiggle(f, 50, 1, 0.8, 0.12) : 0} />
    </Page>
  );
};

// p4 — type (180–239): InkTitle word-by-word press + speech bubbles popping on twos
const TypePage: React.FC = () => (
  <Page title="<Riso> misregistration · InkTitle (word-by-word ink press) · SpeechBubble (RTL + Arabizi)">
    <Riso amount={1.6}>
    <InkTitle x={510} y={420} text={'الفرق كلّو'} start={2} fontSize={150} plate={C.turquoiseDeep} />
    <InkTitle x={510} y={600} text={'بالـ ق.'} start={10} fontSize={170} highlight={{1: C.white}} rotate={-3} />
    <SpeechBubble x={360} y={900} text="بس ملعقة وحدة" sub="bas wa7de" tail={[230, 1080]} start={18} rotate={-2} />
    <SpeechBubble x={700} y={1120} text={'بس معلقة وحدة\nيا تقبرني 🤏'} tail={[880, 1300]} start={26} rotate={2} fontSize={50} seed={8} />
    <SpeechBubble x={330} y={1360} text="One spoon!" font="latin" tail={[180, 1520]} start={34} shape="burst" fontSize={54} seed={5} fill={C.honeyLight} />
    <SpeechBubble x={720} y={1560} text="شطة؟؟ 🥵" tail={[860, 1720]} start={42} shape="cloud" fontSize={60} seed={11} />
    </Riso>
  </Page>
);

// p5 — hands (240–299): close-ups of the presets (240–269), then the family around the plate (270–299)
const HandsPage: React.FC = () => {
  const f = useCurrentFrame();
  const names = ['kandura', 'abaya', 'kid', 'grandpa', 'uncle', 'aunt', 'teen'] as const;
  if (f < 30) {
    const row = (n: (typeof names)[number], x: number, y: number, a: number, load: number, grip: number) => (
      <Hand2D key={n} x={x} y={y} angle={a} scale={0.82} {...HAND_PRESETS[n]} load={load} grip={grip} />
    );
    const g = onTwos(f) % 8 < 4 ? 0 : 1;
    return (
      <Page bg={C.paper} title="Hand2D close-ups: kandura · abaya + henna + ring · kid (dino sleeve) · uncle (watch)">
        {row('kandura', 300, 760, 180, 0, 0)}
        {row('abaya', 780, 660, 180, 0.9, g)}
        {row('kid', 300, 1120, 0, 0.9, 0)}
        {row('uncle', 780, 1020, 0, 0, g)}
      </Page>
    );
  }
  const taken = Math.min(5, onTwos(f - 30) / 6);
  const P = {x: 540, y: 900, s: 0.66};
  return (
    <Page bg={C.paper} title="Hand2D presets around FamilyPlate2D (angle = bite direction − 90)">
      <FamilyPlate2D x={P.x} y={P.y} scale={P.s} scoopsTaken={taken} tray />
      {names.map((n, i) => {
        const [sx, sy] = plateScoopPoint(i, P.x, P.y, P.s);
        const ang = PLATE_SCOOPS[i].angle;
        const reach = 30 + 40 * Math.max(0, Math.sin(onTwos(f) * 0.2 + i * 1.3));
        const bx = sx + Math.cos((ang * Math.PI) / 180) * reach;
        const by = sy + Math.sin((ang * Math.PI) / 180) * reach;
        return <Hand2D key={n} x={bx} y={by} angle={ang - 90} scale={0.42} {...HAND_PRESETS[n]} load={i % 2 ? 0.9 : 0} />;
      })}
    </Page>
  );
};

// p6/p7 — the end card over a previous scene (paper-sheet entrance): A = qaf spot (no headline), B = spoon spot
const EndPageA: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill style={{background: C.chili}} />
    <EndCard2D comment="إنت فريق قشطة ولا فريق شطة؟ 👇" />
  </AbsoluteFill>
);
const EndPageB: React.FC = () => (
  <AbsoluteFill style={{background: C.paper}}>
    <FamilyPlate2D x={540} y={900} scale={0.9} scoopsTaken={8} />
    <EndCard2D headline="اطلبوا لكل واحد كاسة 😌" comment="منشن يلي ببيتكن بيقول ملعقة وحدة 👇" />
  </AbsoluteFill>
);

export const PAGES = {
  cup: {from: 0, dur: 60},
  states: {from: 60, dur: 60},
  plate: {from: 120, dur: 60},
  type: {from: 180, dur: 60},
  hands: {from: 240, dur: 60},
  endA: {from: 300, dur: ENDCARD_DURATION},
  endB: {from: 300 + ENDCARD_DURATION, dur: ENDCARD_DURATION},
} as const;
export const STYLE_FRAMES_DURATION = 300 + 2 * ENDCARD_DURATION;

export const Kit2DStyleFrames: React.FC = () => (
  <AbsoluteFill style={{background: C.paper}}>
    <Sequence from={PAGES.cup.from} durationInFrames={PAGES.cup.dur}>
      <CupPage />
    </Sequence>
    <Sequence from={PAGES.states.from} durationInFrames={PAGES.states.dur}>
      <StatesPage />
    </Sequence>
    <Sequence from={PAGES.plate.from} durationInFrames={PAGES.plate.dur}>
      <PlatePage />
    </Sequence>
    <Sequence from={PAGES.type.from} durationInFrames={PAGES.type.dur}>
      <TypePage />
    </Sequence>
    <Sequence from={PAGES.hands.from} durationInFrames={PAGES.hands.dur}>
      <HandsPage />
    </Sequence>
    <Sequence from={PAGES.endA.from} durationInFrames={PAGES.endA.dur}>
      <EndPageA />
    </Sequence>
    <Sequence from={PAGES.endB.from} durationInFrames={PAGES.endB.dur}>
      <EndPageB />
    </Sequence>
  </AbsoluteFill>
);
