import {evolvePath} from '@remotion/paths';
import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BANDS, C, CUP, DOME, T, bandY, cupHalfWidth, rnd} from './brand';
import {FRUITS, Fruit, FruitDefs, FruitKind} from './Fruit';
import {qashatiLogo} from './logoPaths';
import {Toppings} from './Toppings';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const {cx, rimY, bottomY} = CUP;

// Inner cup outline, extended up to just under the text (TEXT_BOTTOM) so falling pieces never cross the titles.
const TEXT_BOTTOM = 485;
const interior = (inset = 8) => {
  const tl = cx - cupHalfWidth(rimY) + inset;
  const tr = cx + cupHalfWidth(rimY) - inset;
  const bl = cx - cupHalfWidth(bottomY) + inset;
  const br = cx + cupHalfWidth(bottomY) - inset;
  const b = bottomY - inset;
  return `M${tl} ${TEXT_BOTTOM} L${tl} ${rimY} L${bl} ${b - 28} Q${bl} ${b} ${bl + 28} ${b} L${br - 28} ${b} Q${br} ${b} ${br} ${b - 28} L${tr} ${rimY} L${tr} ${TEXT_BOTTOM} Z`;
};
const body = () => {
  const tl = cx - cupHalfWidth(rimY);
  const tr = cx + cupHalfWidth(rimY);
  const bl = cx - cupHalfWidth(bottomY);
  const br = cx + cupHalfWidth(bottomY);
  return `M${tl} ${rimY} L${bl} ${bottomY - 34} Q${bl} ${bottomY} ${bl + 34} ${bottomY} L${br - 34} ${bottomY} Q${br} ${bottomY} ${br} ${bottomY - 34} L${tr} ${rimY}`;
};

// Top surface of the qashta dome, used to seat honey, nuts and toppings on it.
const domeHalf = cupHalfWidth(DOME.baseY) - 8;
export const domeY = (x: number) => {
  const u = Math.min(1, Math.abs(x - cx) / domeHalf);
  return DOME.baseY - (DOME.baseY - DOME.peakY) * Math.pow(1 - u * u, 0.75);
};
const domePath = () => {
  const pts = Array.from({length: 41}, (_, i) => {
    const x = cx - domeHalf + (i / 40) * domeHalf * 2;
    return `${x.toFixed(1)} ${domeY(x).toFixed(1)}`;
  });
  return `M${cx - domeHalf} ${DOME.baseY + 30} L${pts.join(' L')} L${cx + domeHalf} ${DOME.baseY + 30} Z`;
};

// A piece that falls in, lands at `land` and squashes on impact.
const Falling: React.FC<{land: number; x: number; y: number; rot: number; drop?: number; children: React.ReactNode}> = ({
  land,
  x,
  y,
  rot,
  drop = 700,
  children,
}) => {
  const frame = useCurrentFrame();
  const fall = 10;
  if (frame < land - fall) return null;
  const t = interpolate(frame, [land - fall, land], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const squash = interpolate(frame - land, [0, 3, 8], [0.72, 1.08, 1], clamp);
  const sx = frame >= land ? 2 - squash : 0.9;
  const sy = frame >= land ? squash : 1.15;
  return (
    <g transform={`translate(${x} ${y - (1 - t) * drop}) rotate(${rot}) scale(${sx} ${sy})`}>{children}</g>
  );
};

type Piece = {kind: FruitKind; x: number; y: number; s: number; rot: number; land: number};

// Pack fruit pieces into a band, bottom rows first, landing one after another from `start`.
const packBand = (band: readonly [number, number], start: number, every: number, key: string): Piece[] => {
  const pieces: Piece[] = [];
  const y0 = bandY(band[0]);
  const y1 = bandY(band[1]);
  const rows = Math.max(2, Math.round((y0 - y1) / 70));
  for (let r = 0; r < rows; r++) {
    const y = y0 - 34 - r * ((y0 - y1 - 40) / Math.max(1, rows - 1));
    const half = cupHalfWidth(y) - 30;
    const cols = Math.round((half * 2) / 104);
    for (let c = 0; c < cols; c++) {
      const k = `${key}-${r}-${c}`;
      pieces.push({
        kind: FRUITS[(r * 3 + c + key.length) % FRUITS.length],
        x: cx - half + (c + 0.5) * ((half * 2) / cols) + rnd(`${k}x`, -14, 14),
        y: y + rnd(`${k}y`, -10, 10),
        s: rnd(`${k}s`, 92, 112),
        rot: rnd(`${k}r`, -40, 40),
        land: 0,
      });
    }
  }
  return pieces.map((p, i) => ({...p, land: start + Math.round(i * every)}));
};
const FRUIT1 = packBand(BANDS.fruit1, T.fruit1 + 10, 34 / 20, 'a');
const FRUIT2 = packBand(BANDS.fruit2, T.fruit2 + 10, 22 / 14, 'bb');

const NUTS = Array.from({length: 22}, (_, i) => {
  const x = cx + rnd(`nx${i}`, -domeHalf * 0.82, domeHalf * 0.82);
  return {x, y: domeY(x) - rnd(`ny${i}`, 4, 16), rot: rnd(`nr${i}`, 0, 180), s: rnd(`ns${i}`, 26, 38), land: T.nuts + 2 + Math.round(i * 1.3)};
});

// Honey zig-zags across the dome surface.
const HONEY = (() => {
  const n = 9;
  const pts = Array.from({length: n}, (_, i) => {
    const x = cx - domeHalf * 0.8 + (i / (n - 1)) * domeHalf * 1.6;
    return [x, domeY(x) + (i % 2 ? 30 : -6)];
  });
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += ` C${x0 + 30} ${y0}, ${x1 - 30} ${y1}, ${x1} ${y1}`;
  }
  return d;
})();

export const Cup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Cup springs up from below, then gets a small bounce on every topping swap.
  const enter = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const bump = T.swaps.reduce((acc, s) => acc + (frame >= s ? Math.sin(Math.min(1, (frame - s) / 10) * Math.PI) * 0.03 : 0), 0);
  const hero = interpolate(frame, [T.hero - 6, T.hero, T.hero + 12], [0, 1, 0], clamp);
  const lift = (1 - enter) * 900;
  const exitT = interpolate(frame, [T.wipe, T.wipe + 20], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});

  // Cream "base" from the two drops that land in the empty cup.
  const plop = interpolate(frame, [T.dropsLand, T.dropsLand + 8], [0, 1], clamp);
  const fruit1Fill = interpolate(frame, [T.fruit1 + 8, T.fruit1 + 46], [0, 1], clamp);
  const qashtaRise = spring({frame: frame - T.qashta, fps, config: {damping: 16, stiffness: 60}});
  const fruit2Fill = interpolate(frame, [T.fruit2 + 8, T.fruit2 + 32], [0, 1], clamp);
  const domeGrow = spring({frame: frame - T.dome, fps, config: {damping: 11, stiffness: 90}});
  const honey = interpolate(frame, [T.honey, T.honey + 34], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const baseOut = interpolate(frame, [T.swaps[0], T.swaps[0] + 6], [1, 0], clamp);
  const honeyPath = evolvePath(honey, HONEY);

  const qTop = bandY(BANDS.qashta[0]) - (bandY(BANDS.qashta[0]) - bandY(BANDS.qashta[1])) * qashtaRise;
  const wave = (y: number, amp: number, phase: number) => {
    const half = cupHalfWidth(y) + 10;
    const pts = Array.from({length: 25}, (_, i) => {
      const x = cx - half + (i / 24) * half * 2;
      return `${x.toFixed(1)} ${(y + Math.sin(i * 0.9 + phase) * amp).toFixed(1)}`;
    });
    return `M${cx - half} ${bottomY + 20} L${pts.join(' L')} L${cx + half} ${bottomY + 20} Z`;
  };

  const drops = [
    {x: cx - 60, delay: 0},
    {x: cx + 52, delay: 3},
  ];

  return (
    <svg viewBox="0 0 1080 1920" width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <FruitDefs />
      <defs>
        <clipPath id="q-interior">
          <path d={interior()} />
        </clipPath>
        <clipPath id="q-below-text">
          <rect x={0} y={TEXT_BOTTOM} width={1080} height={1920} />
        </clipPath>
        <linearGradient id="q-cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor={C.cream} />
          <stop offset="1" stopColor={C.creamShade} />
        </linearGradient>
        <linearGradient id="q-juice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9AA8" />
          <stop offset="0.5" stopColor="#FFC56B" />
          <stop offset="1" stopColor="#C8E88B" />
        </linearGradient>
        <linearGradient id="q-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <stop offset="0.12" stopColor="#FFFFFF" stopOpacity={0.12} />
          <stop offset="0.8" stopColor="#FFFFFF" stopOpacity={0.04} />
          <stop offset="0.93" stopColor="#FFFFFF" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0.08} />
        </linearGradient>
        <filter id="q-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <g
        transform={`translate(0 ${lift + exitT * 1400}) rotate(${hero * 3} ${cx} ${bottomY}) translate(${cx} ${bottomY}) scale(${1 + bump * 0.6} ${1 - bump}) translate(${-cx} ${-bottomY})`}
      >
        {/* Shadow and back rim */}
        <ellipse cx={cx} cy={bottomY + 26} rx={260} ry={34} fill={C.teal} opacity={0.28} filter="url(#q-soft)" />
        <path d={`M${cx - CUP.topHalf} ${rimY} A${CUP.topHalf} 34 0 0 1 ${cx + CUP.topHalf} ${rimY}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={5} />
        <path d={body()} fill="#FFFFFF" fillOpacity={0.16} />

        <g clipPath="url(#q-interior)">
          {/* 1. cream base from the two drops */}
          <ellipse cx={cx} cy={bottomY - 8} rx={200 * plop} ry={40 * plop} fill="url(#q-cream)" />
          {/* 2. fruit layer */}
          <rect x={0} y={bottomY - (bottomY - bandY(BANDS.fruit1[1])) * fruit1Fill} width={1080} height={800} fill="url(#q-juice)" opacity={0.85} />
          {FRUIT1.map((p, i) => (
            <Falling key={i} land={p.land} x={p.x} y={p.y} rot={p.rot}>
              <Fruit kind={p.kind} s={p.s} />
            </Falling>
          ))}
          {/* 3. qashta layer */}
          {frame >= T.qashta ? (
            <g>
              <clipPath id="q-qband">
                <rect x={0} y={0} width={1080} height={bandY(BANDS.qashta[0]) + 14} />
              </clipPath>
              <path d={wave(qTop, 9, frame * 0.12)} fill="url(#q-cream)" clipPath="url(#q-qband)" />
              <path
                d={`M${cx - 150} ${qTop + 70} q 60 -26 120 0 t 120 0`}
                fill="none"
                stroke={C.creamShade}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.6 * qashtaRise}
              />
            </g>
          ) : null}
          {/* 4. second fruit layer */}
          {fruit2Fill > 0 ? (
            <rect
              x={0}
              y={bandY(BANDS.fruit2[0]) - (bandY(BANDS.fruit2[0]) - bandY(BANDS.fruit2[1])) * fruit2Fill}
              width={1080}
              height={(bandY(BANDS.fruit2[0]) - bandY(BANDS.fruit2[1])) * fruit2Fill + 2}
              fill="url(#q-juice)"
              opacity={0.85}
            />
          ) : null}
          {FRUIT2.map((p, i) => (
            <Falling key={i} land={p.land} x={p.x} y={p.y} rot={p.rot}>
              <Fruit kind={p.kind} s={p.s} />
            </Falling>
          ))}
          {/* Falling cream drops (the logo's two dots) */}
          {drops.map((d, i) => {
            const t = interpolate(frame, [d.delay, T.dropsLand], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
            if (frame >= T.dropsLand + 2) return null;
            return (
              <path
                key={i}
                transform={`translate(${d.x} ${-120 + t * (bottomY - 60)}) scale(1.9)`}
                d="M0 -40 C 22 -10, 30 10, 30 22 A30 30 0 0 1 -30 22 C -30 10, -22 -10, 0 -40 Z"
                fill={C.cream}
              />
            );
          })}
        </g>

        {/* 5. qashta dome rising above the rim */}
        <g transform={`translate(0 ${DOME.baseY}) scale(1 ${domeGrow}) translate(0 ${-DOME.baseY})`}>
          <path d={domePath()} fill="url(#q-cream)" />
          <path
            d={`M${cx - 120} ${DOME.peakY + 60} Q ${cx} ${DOME.peakY + 20} ${cx + 120} ${DOME.peakY + 60}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={10}
            strokeLinecap="round"
            opacity={0.8}
          />
        </g>

        {/* 6. honey + 7. nuts (the classic cup), replaced by the toppings carousel */}
        <g opacity={baseOut} clipPath="url(#q-below-text)">
          {honey > 0 ? (
            <g>
              <path d={HONEY} fill="none" stroke="#C97A06" strokeWidth={20} strokeLinecap="round" strokeDasharray={honeyPath.strokeDasharray} strokeDashoffset={honeyPath.strokeDashoffset} />
              <path d={HONEY} fill="none" stroke={C.honey} strokeWidth={15} strokeLinecap="round" strokeDasharray={honeyPath.strokeDasharray} strokeDashoffset={honeyPath.strokeDashoffset} />
              <path
                d={HONEY}
                fill="none"
                stroke={C.honeyLight}
                strokeWidth={4}
                strokeLinecap="round"
                transform="translate(-2 -4)"
                strokeDasharray={honeyPath.strokeDasharray}
                strokeDashoffset={honeyPath.strokeDashoffset}
              />
            </g>
          ) : null}
          {NUTS.map((n, i) => (
            <Falling key={i} land={n.land} x={n.x} y={n.y} rot={n.rot} drop={500}>
              <path d={`M${-n.s / 2} 0 Q 0 ${-n.s * 0.7} ${n.s / 2} 0 Q 0 ${n.s * 0.5} ${-n.s / 2} 0 Z`} fill={i % 4 === 0 ? '#8A5A44' : C.pistachio} />
              <ellipse rx={n.s * 0.2} ry={n.s * 0.12} fill="#D8F08A" opacity={i % 4 === 0 ? 0 : 0.8} />
            </Falling>
          ))}
        </g>
        <g clipPath="url(#q-below-text)">
          <Toppings domeY={domeY} domeHalf={domeHalf} />
        </g>

        {/* Front of the cup: rim, glass highlights, outline */}
        <path d={body()} fill="url(#q-glass)" />
        <path d={body()} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M${cx - CUP.topHalf} ${rimY} A${CUP.topHalf} 34 0 0 0 ${cx + CUP.topHalf} ${rimY}`} fill="none" stroke="#FFFFFF" strokeWidth={7} />

        {/* Turquoise sticker with the Q mark, like their packaging */}
        <g transform={`translate(${cx} ${bottomY - 132})`}>
          <circle r={92} fill={C.turquoise} stroke="#FFFFFF" strokeWidth={7} />
          {/* Q + dots span the top 63% of the logo; fit that into the sticker. */}
          <g transform={`scale(${124 / (qashatiLogo.height * 0.63)}) translate(${-qashatiLogo.width / 2} ${-qashatiLogo.height * 0.315})`} fill="#FFFFFF">
            {[...qashatiLogo.dots, ...qashatiLogo.q].map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
};
