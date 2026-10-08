// SHOT 3 — the clock and the phone. Hard cut on a tick: the kitchen clock jolts on every tick (faster and faster),
// sweat flies off it; «دينغ دونغ!!» again. The camera tilts down (the phone, in the foreground, rises faster: parallax)
// to the host's hand holding the phone: a hand-drawn order screen (no real app UI) «صحون قشاطي للعيلة» + «اطلب».
// The thumb winds back… and PRESSES. Burst. Whip to the door.
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {blobPts, brush, C, easeOutCubic, ellipsePts, FamilyPlate2D, FONT, Halftone, INK, onTwos, prog, shapeD, useBoil} from '../../kit/lib';
import {Cam, camAt, layerCss, layerG, shake, withShake} from '../camera';
import {ShakeMarks, SfxWord} from '../art/Fx';
import {Phone, Sleeve, Thumb} from '../art/Host';
import {COPY, LAYOUT, T} from '../spec';
import {Tiles, WALL} from './Fridge';

const CLOCK = {x: 420, y: 600, r: 210};
const PH = {x: 560, y: 1300, w: LAYOUT.phone.w, h: LAYOUT.phone.h, rot: LAYOUT.phone.rot};

const Clock: React.FC<{g: number}> = ({g}) => {
  const b = useBoil({scale: 3, offset: 401, freq: 0.02});
  const ticks = T.ticks.filter((t) => g >= t);
  const n = ticks.length;
  const last = n ? ticks[n - 1] : -100;
  const since = g - last;
  const jolt = since >= 0 && since < 6 ? [1.07, 0.97, 1.01][Math.min(2, Math.floor(since / 2))] : 1;
  const rot = since >= 0 && since < 6 ? [3, -1.5, 0.5][Math.min(2, Math.floor(since / 2))] : 0;
  const sec = -90 + (40 + n * 6) * 6; // the second hand jumps on every tick
  const face = useMemo(() => ellipsePts(0, 0, CLOCK.r, CLOCK.r, 60), []);
  const hand = (deg: number, len: number, w: number, color: string, tail = 0.15) => {
    const a = (deg * Math.PI) / 180;
    return <path d={brush([[-Math.cos(a) * len * tail, -Math.sin(a) * len * tail], [Math.cos(a) * len, Math.sin(a) * len]], {w, taper: [0.1, 0.5], tip: 0.3, seed: Math.round(deg)})} fill={color} />;
  };
  return (
    <g transform={`translate(${CLOCK.x} ${CLOCK.y}) rotate(${rot}) scale(${jolt})`}>
      <defs>{b.def}</defs>
      <g filter={b.url}>
        <circle r={CLOCK.r + 16} fill={INK} opacity={0.25} transform="translate(12 16)" />
        <circle r={CLOCK.r + 14} fill={C.turquoise} />
        <circle r={CLOCK.r + 8} fill={C.turquoiseDeep} transform="translate(5 6)" opacity={0.5} />
        <path d={shapeD(face)} fill={C.cream} />
        <Halftone box={[-CLOCK.r, -CLOCK.r, 2 * CLOCK.r, 2 * CLOCK.r]} cell={9} angle={20} fill={C.creamDeep} tone={[{t: 'lin', x0: -120, y0: -120, x1: 160, y1: 160, a: 0, b: 0.7}]} clipPath="url(#clkClip)" />
        <clipPath id="clkClip">
          <path d={shapeD(face)} />
        </clipPath>
        {Array.from({length: 12}).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r0 = i % 3 === 0 ? CLOCK.r - 40 : CLOCK.r - 26;
          return <path key={i} d={brush([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * (CLOCK.r - 10), Math.sin(a) * (CLOCK.r - 10)]], {w: i % 3 === 0 ? 9 : 5, taper: [0.1, 0.1], seed: 410 + i})} fill={INK} />;
        })}
        {[
          ['12', 0, -CLOCK.r + 76],
          ['3', CLOCK.r - 72, 16],
          ['6', 0, CLOCK.r - 48],
          ['9', -CLOCK.r + 72, 16],
        ].map(([t, x, y]) => (
          <text key={t as string} x={x as number} y={y as number} textAnchor="middle" style={{fontFamily: FONT.latin, fontWeight: 500, fontSize: 46}} fill={INK}>
            {t}
          </text>
        ))}
        {hand(-90 + 8 * 30 + 15, CLOCK.r * 0.5, 14, INK)}
        {hand(-90 + 52 * 6, CLOCK.r * 0.74, 10, INK)}
        {hand(sec, CLOCK.r * 0.84, 5, C.strawberry, 0.25)}
        <circle r={14} fill={C.strawberry} stroke={INK} strokeWidth={5} />
        <path d={brush(face, {w: 8, closed: true, dense: false, seed: 420})} fill={INK} />
        <path d={brush(ellipsePts(0, 0, CLOCK.r + 14, CLOCK.r + 14, 60), {w: 8, closed: true, dense: false, seed: 421})} fill={INK} />
        <path d={brush(ellipsePts(0, 0, CLOCK.r - 30, CLOCK.r - 30, 30, Math.PI * 1.1, Math.PI * 1.45), {w: 14, taper: [0.4, 0.4], dense: false, seed: 422})} fill={C.white} opacity={0.7} />
      </g>
      <ShakeMarks hw={CLOCK.r + 20} h={140} on={since >= 0 && since < 5} />
      {/* sweat drops fly off on each tick */}
      {since >= 0 && since < 10
        ? [0, 1, 2].map((i) => {
            const a = -Math.PI * (0.15 + i * 0.35) + (n % 2) * 0.2;
            const d = CLOCK.r + 30 + onTwos(since) * 12;
            const x = Math.cos(a) * d;
            const y = Math.sin(a) * d + onTwos(since) * onTwos(since) * 1.2;
            return <path key={i} d={shapeD([[x, y - 22], [x + 12, y + 2], [x, y + 13], [x - 12, y + 2]], 6)} fill="#BFF4FF" stroke={INK} strokeWidth={4} opacity={1 - since / 10} />;
          })
        : null}
    </g>
  );
};

export const ClockPhone: React.FC<{from: number}> = ({from}) => {
  const g = useCurrentFrame() + from;
  const g2 = onTwos(g);
  const base = camAt(
    [
      {f: T.clock, x: 470, y: 700, z: 1.2, r: -1.5},
      {f: T.tilt[0], x: 474, y: 700, z: 1.26, r: -2.2},
      {f: T.tilt[1], x: 560, y: 1240, z: 1.0, r: 1.2},
      {f: T.phoneOut, x: 562, y: 1236, z: 1.04, r: 1.4},
      {f: T.phoneOut + 8, x: 2200, y: 1236, z: 1.04, r: 4, ease: (t) => t * t * t},
    ],
    g,
  );
  const cam: Cam = withShake(base, shake(g, [{at: T.clock, amp: 6}, {at: T.ding2, amp: 15}, {at: T.thumbPress, amp: 8}]));
  // the thumb: hover at the button's left end → wind back (lift: shorter, further left) → PRESS on the button's LEFT end
  // (squash) → release. It never covers «اطلب» (Lalezar 78 px, x ±70 round the button centre): at the press the thumb
  // spans x ≈ -173…-94 across the button row, so the label stays readable sound-off at the decisive moment.
  let thumbRot = 6;
  let thumbS = 1.06;
  let press = 0;
  if (g2 >= T.thumbWind && g2 < T.thumbPress) {
    const u = (g2 - T.thumbWind) / (T.thumbPress - T.thumbWind);
    thumbRot = 6 - 10 * Math.sin(u * Math.PI * 0.5);
    thumbS = 1.06 - 0.08 * u;
  }
  if (g2 >= T.thumbPress && g2 < T.thumbPress + 6) {
    thumbRot = 26;
    thumbS = 1.2;
    press = g2 < T.thumbPress + 4 ? 1 : 0.4;
  }
  if (g2 >= T.thumbPress + 6) {
    thumbRot = 20;
    thumbS = 1.12;
  }
  const burst = g >= T.thumbPress && g < T.thumbPress + 14 ? (g - T.thumbPress) / 14 : 0;
  const lift = (1 - easeOutCubic(prog(g, T.ding2 + 2, T.tilt[1] - 2))) * 760;
  const plateScale = 0.4;
  const panelCy = -PH.h / 4 + 6;
  return (
    <AbsoluteFill style={{background: WALL.base}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={layerG(cam, 0.8)}>
          <rect x={-1400} y={-800} width={4200} height={3600} fill={WALL.base} />
          <Tiles x0={-1310} y0={960} x1={2650} y1={2300} />
          <path d={brush([[-1400, 958], [2800, 958]], {w: 7, taper: [0.01, 0.01], tip: 0.9, seed: 430})} fill={INK} />
          {/* a shelf with jars (home life) to the right of the clock */}
          <g transform="translate(860 700)">
            <rect x={-170} y={0} width={360} height={22} rx={6} fill="#C9A06A" stroke={INK} strokeWidth={5} />
            {[
              [-120, '#E7C27A'],
              [-30, '#D9E8C8'],
              [70, '#F2B5A8'],
            ].map(([x, col], i) => (
              <g key={i} transform={`translate(${x as number} 0)`}>
                <path d={shapeD(blobPts(0, -60, 36, 60, 0.04, 440 + i, 20, 2))} fill={col as string} stroke={INK} strokeWidth={5} />
                <rect x={-28} y={-132} width={56} height={22} rx={6} fill={C.turquoise} stroke={INK} strokeWidth={4} />
              </g>
            ))}
          </g>
          <Clock g={g} />
        </g>
      </svg>
      {/* the phone layer (foreground, depth 1.25) — HTML so the kit plate can sit on the drawn screen */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: layerCss(cam, 1.25)}}>
        <div style={{position: 'absolute', left: PH.x, top: PH.y + lift, width: 0, height: 0, transform: `rotate(${PH.rot + lift * 0.012}deg)`}}>
          {/* the holding hand: sleeve from the bottom-left, palm behind the phone */}
          <svg width={10} height={10} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <Sleeve pts={[[-700, PH.h / 2 + 900], [-420, PH.h / 2 + 420], [-PH.w / 2 + 30, PH.h / 2 + 120]]} w0={300} w1={230} seed={21} />
            {(() => {
              const palm = blobPts(-PH.w / 2 + 80, PH.h / 2 + 10, 150, 118, 0.06, 450, 26, 2);
              return (
                <g>
                  <path d={shapeD(palm)} fill={C.skinShade[2]} />
                  <path d={shapeD(palm.map(([x, y]) => [x * 0.86 - 18, y * 0.86 + 40] as [number, number]))} fill={C.skin[2]} />
                  <path d={brush([[-PH.w / 2 + 10, PH.h / 2 - 20], [-PH.w / 2 + 70, PH.h / 2 + 40], [-PH.w / 2 + 150, PH.h / 2 + 50]], {w: 4, taper: [0.3, 0.3], seed: 451})} fill={INK} opacity={0.45} />
                  <path d={brush(palm, {w: 7, closed: true, dense: false, start: 0.2, seed: 452, shadow: 0.6})} fill={INK} />
                </g>
              );
            })()}
            <g>
              <Phone w={PH.w} h={PH.h} title={COPY.phoneTitle} button={COPY.phoneButton} press={press} burst={burst} />
            </g>
          </svg>
          <div style={{position: 'absolute', left: 0, top: panelCy, width: 0, height: 0}}>
            <FamilyPlate2D x={0} y={0} scale={plateScale} shadow={false} />
          </div>
          <svg width={10} height={10} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            {/* fingertips round the right edge */}
            {[-60, 40, 140].map((y, i) => {
              const fp = blobPts(PH.w / 2 + 6, y, 34, 26, 0.06, 460 + i, 18, 2);
              return (
                <g key={i}>
                  <path d={shapeD(fp)} fill={C.skin[2]} />
                  <path d={brush(fp, {w: 6, closed: true, dense: false, start: 0.9, seed: 463 + i})} fill={INK} />
                  <path d={shapeD(blobPts(PH.w / 2 - 8, y - 2, 12, 9, 0.1, 466 + i, 10, 2))} fill="#F7DCCB" />
                </g>
              );
            })}
            {/* the thumb, from the heel of the hand to the button */}
            <g transform={`translate(${-PH.w / 2 + 40} ${PH.h / 2 - 60}) rotate(${thumbRot})`}>
              <Thumb s={thumbS} press={press} />
            </g>
          </svg>
        </div>
      </div>
      <SfxWord x={LAYOUT.ding2.x} y={LAYOUT.ding2.y} text={COPY.ding2} size={LAYOUT.ding2.size} rot={LAYOUT.ding2.rot} start={T.ding2} exit={T.ding2 + 22} color={C.flameYellow} burst={C.turquoise} frame={g} />
    </AbsoluteFill>
  );
};

