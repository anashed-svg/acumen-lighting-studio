// <EndCard2D/> — the series' shared end card (~3.5 s, cues in ./cues.ts, relative frames):
// a turquoise paper sheet slides up over the last scene, the HeroCup2D drops in and lands, the teal logo's two dots
// land (= the sonic logo «تشك-تشك»), the CTA lands as a printed stamp «اطلبها من طلبات», then «أو من تطبيق قشاطي الشام»,
// «ندّ الحمر · دبي», and the per-spot comment prompt pops as the cup's own speech bubble. It never freezes: the cup
// breathes, the ink boils, the logo dots hop, a glint crosses the CTA.
//
// Place it in the spot as <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}><EndCard2D comment=… /></Sequence>
// Everything sits inside SAFE (x 60–960, y 220–1400). Hierarchy: product + logo → CTA → how/where → comment.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {HeroCup2D, HeroCupProps} from '../art/HeroCup2D';
import {FONT, FONT_WEIGHT} from '../fonts';
import {brush, noise1, Pt, smoothD} from '../geom';
import {Halftone} from '../look/Halftone';
import {InkTextureFilter} from '../look/InkTexture';
import {PaperGrain} from '../look/PaperGrain';
import {C, INK} from '../palette';
import {CX, H, W} from '../stage';
import {clamp01, easeOutCubic, jiggle, onTwos} from '../time';
import {InkTitle} from '../type/InkTitle';
import {balanceLines, SpeechBubble} from '../type/SpeechBubble';
import {EC, ENDCARD_COPY, ENDCARD_DURATION} from './cues';
import {Logo2D, LOGO_ASPECT} from './Logo2D';

export {EC, ENDCARD_COPY, ENDCARD_DURATION};

export type EndCard2DProps = {
  /** the per-spot comment prompt (shown as the cup's speech bubble), e.g. «إنت فريق قشطة ولا فريق شطة؟ 👇» */
  comment: string;
  /** optional InkTitle line at the top, e.g. «اطلبوا لكل واحد كاسة 😌» (the comment then moves under the CTA block) */
  headline?: string;
  /** 'paper' = the sheet slides up over the previous scene (render the previous scene underneath); 'cut' = opaque from 0 */
  enter?: 'paper' | 'cut';
  cup?: Partial<HeroCupProps>;
  copy?: Partial<typeof ENDCARD_COPY>;
  /** draw the paper grain overlay here (set false if the spot adds its own over everything) */
  grain?: boolean;
};

export const ENDCARD_LAYOUT = {
  cup: {x: 300, base: 1066, scale: 0.88, scaleWithHeadline: 0.76, baseWithHeadline: 1014},
  logo: {cx: 744, top: 500, width: 320},
  tagline: {cx: 744, size: 34},
  cta: {cx: CX, cy: 1166, size: 76, rot: -1.6},
  sub: {cy: 1262, size: 46},
  location: {cy: 1324, size: 42},
  /** no headline: the comment is the CUP's speech bubble, two balanced lines, top right, tail to the dome */
  commentTop: {x: 684, y: 352},
  commentTail: [474, 436] as Pt,
  commentBottom: {x: 520, y: 1388},
  /** with a headline the whole CTA block sits this much higher (room for the comment bubble under it) */
  headlineShift: -58,
  headline: {x: CX, y: 300, size: 100},
};
const LY = ENDCARD_LAYOUT;

// ------------------------------------------------------------------------------------------------ paper sheet
const tornEdge = (y0: number, seed: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -40 + (i / 40) * (W + 80);
    pts.push([x, y0 + 14 * noise1(i * 0.6, seed) + 6 * noise1(i * 2.1, seed + 3)]);
  }
  return pts;
};
const Sheet: React.FC<{y: number}> = ({y}) => {
  const edge = tornEdge(0, 5);
  const d = smoothD(edge, false) + `L${W + 40} ${H + 60}L-40 ${H + 60}Z`;
  const dShadow = smoothD(edge.map(([x, yy]) => [x, yy - 10] as Pt), false) + `L${W + 40} ${H + 60}L-40 ${H + 60}Z`;
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <g transform={`translate(0 ${y})`}>
        <path d={dShadow} fill={INK} opacity={0.25} />
        <path d={d} fill={C.turquoise} />
        <path d={brush(edge, {w: 5, taper: [0.02, 0.02], tip: 0.6, seed: 6})} fill={C.turquoiseLight} opacity={0.9} />
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ CTA stamp
const CtaStamp2D: React.FC<{text: string; f: number; dy?: number}> = ({text, f, dy = 0}) => {
  const k = f - EC.cta;
  if (k < -2) return null;
  const step = Math.floor(k / 2); // the stamp is a drawing: it moves on twos
  const approach = k < 0;
  const scale = approach ? 1.35 : [0.93, 1.04, 0.99, 1][Math.min(step, 3)];
  const rot = LY.cta.rot + (approach ? 3 : [-1.2, 0.8, -0.3, 0][Math.min(step, 3)]);
  const opacity = approach ? 0.55 : 1;
  const wet = k >= 0 && k < 2 ? 2.5 : 0;
  // a light sweep after it settles (draws the eye back to the ask)
  const g = clamp01((f - EC.glintCta) / 16);
  const glint = g > 0 && g < 1 ? `linear-gradient(105deg, rgba(255,255,255,0) ${g * 140 - 30}%, rgba(255,255,255,0.32) ${g * 140 - 18}%, rgba(255,255,255,0) ${g * 140 - 6}%)` : null;
  // the alive press: every 36 frames after settling, a tiny re-stamp (on twos)
  const loopK = f - (EC.cta + 30);
  const press = loopK > 0 ? 1 - 0.025 * Math.max(0, Math.cos(((onTwos(loopK) % 36) / 36) * Math.PI * 2)) ** 8 : 1;
  const seed = 500 + Math.floor(f / 2) * 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: LY.cta.cx,
        top: LY.cta.cy + dy,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale * press})`,
        opacity,
        filter: approach ? 'blur(2px)' : undefined,
      }}
    >
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <InkTextureFilter id="q2d-ec-cta" seed={seed} warp={3} grain={12.2} pin={14} wet={wet} />
        </defs>
      </svg>
      <div style={{position: 'relative', filter: 'url(#q2d-ec-cta)', padding: 10}}>
        <div style={{background: INK, borderRadius: 30, padding: 9, position: 'relative', overflow: 'hidden'}}>
          <div
            style={{
              border: `4px solid ${C.turquoise}`,
              borderRadius: 22,
              padding: '0px 46px 8px',
              direction: 'rtl',
              whiteSpace: 'nowrap',
              fontFamily: FONT.title,
              fontWeight: FONT_WEIGHT.title,
              fontSize: LY.cta.size,
              lineHeight: 1.42,
              color: C.turquoise,
            }}
          >
            {text}
          </div>
          {glint ? <div style={{position: 'absolute', inset: 0, background: glint, mixBlendMode: 'screen'}} /> : null}
        </div>
      </div>
    </div>
  );
};

const Pin: React.FC<{size: number}> = ({size}) => (
  <svg width={size * 0.78} height={size} viewBox="0 0 24 31" style={{display: 'inline-block', verticalAlign: 'middle'}}>
    <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 31 12 31s12-10.6 12-19.3C24 5.2 18.6 0 12 0Z" fill={INK} />
    <circle cx={12} cy={11.5} r={4.6} fill={C.turquoise} />
  </svg>
);

const InfoLine: React.FC<{cy: number; size: number; weight: number; from: number; f: number; children: React.ReactNode}> = ({cy, size, weight, from, f, children}) => {
  const k = f - from;
  if (k < 0) return null;
  // appears on twos: a quick drawn slide-up (not a fade-tween)
  const t = [0.35, 0.8, 1][Math.min(2, Math.floor(k / 2))];
  return (
    <div
      style={{
        position: 'absolute',
        left: CX - 450,
        width: 900,
        top: cy,
        transform: `translateY(${-size * 0.65 + (1 - t) * 18}px)`,
        opacity: t,
        textAlign: 'center',
        direction: 'rtl',
        whiteSpace: 'nowrap',
        fontFamily: FONT.ui,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.3,
        color: INK,
      }}
    >
      {children}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ the card
export const EndCard2D: React.FC<EndCard2DProps> = ({comment, headline, enter = 'paper', cup, copy, grain = true}) => {
  const f = useCurrentFrame();
  const cp = {...ENDCARD_COPY, ...copy};
  const hasHeadline = !!headline;
  const shift = hasHeadline ? LY.headlineShift : 0;
  // sheet: slides up on twos with an ease-out, overshoots a hair, settles
  const sheetT = enter === 'paper' ? easeOutCubic(clamp01(onTwos(f) / EC.sheetIn)) : 1;
  // (rests 40 px above the frame so the torn edge never shows once it is in)
  const sheetY = (1 - sheetT) * (H + 60) - 40 * sheetT - (f >= EC.sheetIn && f < EC.sheetIn + 4 ? 10 : 0);

  // cup: drops in from above, lands on EC.cupLand with a squash, then breathes
  const cupScale = hasHeadline ? LY.cup.scaleWithHeadline : LY.cup.scale;
  const cupBase = hasHeadline ? LY.cup.baseWithHeadline : LY.cup.base;
  const fall = EC.cupLand - EC.sheetIn;
  const ft = onTwos(f);
  const cupY = ft < EC.cupLand ? cupBase - 900 * (1 - clamp01((ft - (EC.cupLand - fall)) / fall)) ** 2 : cupBase;
  const land = ft >= EC.cupLand ? jiggle(ft, EC.cupLand, 1, 0.95, 0.24) : 0;
  const falling = ft < EC.cupLand && ft >= EC.cupLand - fall;
  const squash = falling ? -0.1 : 0.16 * land;
  const breathe = f > EC.cupLand + 16 ? 0.012 * Math.sin((f - EC.cupLand) * 0.12) : 0;
  const cupGlint = clamp01((f - EC.glintCup) / 14);

  const commentAt = hasHeadline ? LY.commentBottom : LY.commentTop;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {enter === 'paper' ? <Sheet y={sheetY} /> : <AbsoluteFill style={{background: C.turquoise}} />}
      {f >= EC.sheetIn || enter === 'cut' ? (
        <AbsoluteFill>
          <svg width={W} height={H} style={{position: 'absolute'}}>
            {/* print vignette: deeper turquoise halftone in the corners (no hotspot behind the logo) */}
            <Halftone
              box={[0, 0, W, H]}
              cell={14}
              angle={18}
              fill={C.turquoiseShade}
              tone={[{t: 'rad', cx: W / 2, cy: H * 0.45, r0: 700, r1: 1150, a: 0, b: 1, sx: 1, sy: 1.25}]}
            />
            {/* the caption zone: a printed teal halftone that deepens towards the bottom edge — it grounds the card
                and gives the platform's white caption/username text something darker to sit on (nothing of ours
                lives there) */}
            <Halftone box={[0, 1440, W, H - 1440]} cell={12} angle={18} fill={INK} opacity={0.3} maxR={0.66} tone={[{t: 'lin', x0: 0, y0: 1470, x1: 0, y1: H, a: 0, b: 1, pow: 1.3}, {t: 'noise', amp: 0.18, freq: 0.01, seed: 3}]} />
          </svg>
        </AbsoluteFill>
      ) : null}
      {f >= EC.cupLand - fall ? (
        <HeroCup2D
          x={LY.cup.x}
          y={cupY}
          scale={cupScale * (1 + breathe)}
          squash={squash}
          wobble={land * 0.9 + (f > EC.cupLand + 16 ? 0.12 * Math.sin((f - EC.cupLand) * 0.09) : 0)}
          glint={cupGlint}
          shadow="rgba(5,63,59,0.38)"
          {...cup}
        />
      ) : null}
      {hasHeadline ? <InkTitle x={LY.headline.x} y={LY.headline.y} text={headline!} start={EC.headline} fontSize={LY.headline.size} rotate={-2} /> : null}
      <div style={{position: 'absolute', left: LY.logo.cx - LY.logo.width / 2, top: LY.logo.top + shift / 2, width: LY.logo.width, height: LY.logo.width * LOGO_ASPECT}}>
        <Logo2D start={EC.logoStart} width={LY.logo.width} color={INK} hops={EC.dotHops} />
      </div>
      {f >= EC.tagline ? (
        <div
          style={{
            position: 'absolute',
            left: LY.tagline.cx - 220,
            width: 440,
            top: LY.logo.top + shift / 2 + LY.logo.width * LOGO_ASPECT + 22,
            textAlign: 'center',
            fontFamily: FONT.latin,
            fontWeight: FONT_WEIGHT.latin,
            fontSize: LY.tagline.size,
            color: INK,
            opacity: [0.4, 0.8, 1][Math.min(2, Math.floor((f - EC.tagline) / 2))],
            whiteSpace: 'nowrap',
          }}
        >
          {cp.tagline}
        </div>
      ) : null}
      <CtaStamp2D text={cp.cta} f={f} dy={shift} />
      <InfoLine cy={LY.sub.cy + shift} size={LY.sub.size} weight={700} from={EC.sub} f={f}>
        {cp.sub}
      </InfoLine>
      <InfoLine cy={LY.location.cy + shift} size={LY.location.size} weight={600} from={EC.location} f={f}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 12}}>
          <Pin size={LY.location.size * 0.86} />
          <span>{cp.location}</span>
        </span>
      </InfoLine>
      <SpeechBubble
        x={commentAt.x}
        y={commentAt.y}
        text={hasHeadline ? comment : balanceLines(comment)}
        start={EC.comment}
        fontSize={hasHeadline ? 42 : 50}
        font="friendly"
        tail={hasHeadline ? [commentAt.x + 230, commentAt.y + 120] : LY.commentTail}
        rotate={hasHeadline ? 1 : 2.5}
        seed={21}
      />
      {grain ? <PaperGrain /> : null}
    </AbsoluteFill>
  );
};
