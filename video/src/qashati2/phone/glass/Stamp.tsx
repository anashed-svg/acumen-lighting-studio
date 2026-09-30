// Rubber stamps on the glass: «مش قشطة» slams in red, later a cream drop washes «مش» off
// and the stamp pops turquoise reading «قشطة».
import React from 'react';
import {interpolate, interpolateColors} from 'remotion';
import {COLORS, COPY, T} from '../../spec';
import {STAMP_EM, STAMP_SIZE, STAMPS, stampMetrics as M} from '../layout';
import {STAMP_FONT} from '../theme';
import {clamp, easeOut, hash} from '../timeline';

const RED = COLORS.stampRed;
const STAMP_PAD_RIGHT = (M.width - M.textW) / 2;
const TURQ = COLORS.turquoise;
const SMEAR = 6; // stacked, offset copies of «مش» = the ink smearing down the glass

// Per-stamp melt: columns of the smeared word slide down by different amounts (runny streaks) while a
// rising noise threshold eats the ink away, as if the cream is washing it off.
const MeltFilter: React.FC<{i: number; melt: number}> = ({i, melt}) => (
  <filter id={`q2-melt-${i}`} x="-30%" y="-40%" width="160%" height="260%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.075 0.006" numOctaves={2} seed={4 + i} result="n" />
    <feComponentTransfer in="n" result="d">
      <feFuncR type="linear" slope={0} intercept={0.5} />
      <feFuncG type="linear" slope={1.4} intercept={-0.45} />
    </feComponentTransfer>
    <feDisplacementMap in="SourceGraphic" in2="d" scale={95 * melt} xChannelSelector="R" yChannelSelector="G" result="run" />
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={19 + i} result="er" />
    <feColorMatrix in="er" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  9 0 0 0 ${-1.5 - 5 * Math.pow(melt, 1.2)}`} result="erA" />
    <feComposite in="run" in2="erA" operator="in" />
  </filter>
);

// Rubber-stamp ink: rough edges, speckled voids, uneven density, slight bleed.
export const StampFilters: React.FC = () => (
  <defs>
    {STAMPS.map((_, i) => (
      <filter key={i} id={`q2-ink-${i}`} x="-10%" y="-20%" width="120%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={11 + i * 7} result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale={7} xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves={3} seed={3 + i * 5} result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 -14 0 9.3" result="grainA" />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={41 + i} result="pin" />
        <feColorMatrix in="pin" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -16 0 0 0 11.4" result="pinA" />
        <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves={2} seed={29 + i * 3} result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1.3 0 0 0.3" result="blotA" />
        <feComposite in="grainA" in2="pinA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="mask0" />
        <feComposite in="mask0" in2="blotA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="mask" />
        <feComposite in="rough" in2="mask" operator="in" result="inked" />
        <feGaussianBlur in="rough" stdDeviation={1.3} result="bleed" />
        <feComponentTransfer in="bleed" result="bleedA">
          <feFuncA type="linear" slope={0.28} />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode in="bleedA" />
          <feMergeNode in="inked" />
        </feMerge>
      </filter>
    ))}
    {/* the same rough warp as the ink, without the voids: the fresh turquoise ink of a happy stamp */}
    {STAMPS.map((_, i) => (
      <filter key={`f${i}`} id={`q2-inkfresh-${i}`} x="-10%" y="-20%" width="120%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={11 + i * 7} result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale={7} xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feGaussianBlur in="rough" stdDeviation={0.7} />
      </filter>
    ))}
    <filter id="q2-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={18} />
    </filter>
    <filter id="q2-stamp-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={14} />
    </filter>
  </defs>
);

const Sparkle: React.FC<{x: number; y: number; s: number; color: string}> = ({x, y, s, color}) =>
  s <= 0 ? null : (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -22 C2 -6 6 -2 22 0 C6 2 2 6 0 22 C-2 6 -6 2 -22 0 C-6 -2 -2 -6 0 -22 Z"
      fill={color}
    />
  );

export const Stamp: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const slot = STAMPS[i];
  const k = frame - T.screens[i].stamp;
  if (k < -2) return null;
  const e = frame - T.erase[i];

  // --- slam: comes down from above the glass, squashes, settles
  const approach = k < 0 ? [1.62, 1.22][k + 2] : 1;
  const settle = k >= 0 ? 1 - 0.07 * Math.cos(k * 1.25) * Math.exp(-k * 0.55) : 1;
  let scale = k < 0 ? approach : settle;
  const approachOpacity = k < 0 ? [0.38, 0.8][k + 2] : 1;
  let rot = slot.rot + (k < 6 ? 3 * Math.exp(-Math.max(0, k) * 0.6) * (i % 2 ? -1 : 1) : 0);

  // --- erase: «مش» melts, border hugs «قشطة», ink flips turquoise with a happy bounce
  const melt = interpolate(e, [-1, 8], [0, 1], clamp);
  const wordO = 1 - interpolate(melt, [0.45, 1], [0, 1], {...clamp, easing: (t) => t * t * (3 - 2 * t)});
  const shrink = interpolate(e, [3, 11], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12});
  const flip = interpolate(e, [4.5, 7], [0, 1], clamp);
  const bounceT = e - 5;
  const bounce = bounceT >= 0 ? 0.2 * Math.sin(bounceT * 0.85) * Math.exp(-bounceT * 0.22) : 0;
  if (e >= 5) {
    scale *= 1 + bounce + (e > 14 ? 0.018 * Math.sin((e - 14) * 0.3 + i) : 0);
    const happyRot = slot.rot * 0.35;
    rot = interpolate(e, [5, 12], [slot.rot, happyRot], {...clamp, easing: easeOut}) + (bounceT >= 0 ? 7 * Math.sin(bounceT * 0.7) * Math.exp(-bounceT * 0.25) : 0);
  }

  // red -> flash of white -> turquoise (a straight RGB blend would pass through grey)
  const ink = interpolateColors(flip, [0, 0.45, 1], [RED, '#F4FFFD', TURQ]);
  const w = M.width + (M.widthAfter - M.width) * shrink;
  const h = M.height;
  const left = -M.width / 2;
  // after shrinking, pivot around the new centre so the bounce is centred on «قشطة»
  const cx = left + w / 2;
  const base = STAMP_SIZE * ((STAMP_EM.top - STAMP_EM.bottom) / 2);
  const glyphTop = base - STAMP_EM.top * STAMP_SIZE;
  const thick = k === 0 ? 2.5 : 0; // wet, heavy ink on the impact frame

  // ink specks flung on impact
  const specks =
    k >= 0
      ? Array.from({length: 9}).map((_, j) => {
          const a = hash(i * 31 + j) * Math.PI * 2;
          const onEdge = {x: Math.cos(a) * (M.width / 2), y: Math.sin(a) * (h / 2)};
          const fling = 10 + hash(i * 17 + j) * 46;
          const t = Math.min(1, (k + 1) / 3);
          const r = 2.5 + hash(i * 13 + j * 3) * 7;
          return {x: onEdge.x * 1.02 + Math.cos(a) * fling * t, y: onEdge.y * 1.05 + Math.sin(a) * fling * t, r};
        })
      : [];

  // melting «مش»: the ink runs down in tapered drips with bulbous tips that sag, detach and fall
  // straight down the glass (counter-rotated so gravity is screen-down, whatever the stamp's tilt).
  const mishLeft = left + M.width - STAMP_PAD_RIGHT - M.wm;
  const drips = [
    {p: 0.12, w: 24, l: 150},
    {p: 0.34, w: 13, l: 70},
    {p: 0.55, w: 20, l: 190},
    {p: 0.74, w: 11, l: 48},
    {p: 0.9, w: 17, l: 115},
  ].map((dd, j) => {
    const hj = hash(i * 7 + j);
    const start = -0.5 + hj * 2.2;
    const grow = easeOut(Math.min(1, Math.max(0, (e - start) / 8)));
    const fall = Math.max(0, e - start - 7.5 - hj * 3);
    return {
      x: mishLeft + M.wm * (dd.p + (hash(i * 3 + j * 11) - 0.5) * 0.06),
      y: base - 18 - hash(j * 5 + i) * 22,
      len: grow * dd.l * (0.8 + 0.4 * hash(i * 13 + j)),
      w: dd.w * (0.85 + 0.3 * hash(i + j * 9)),
      bend: (hash(i * 17 + j * 3) - 0.5) * 12,
      drop: 4 * fall * fall,
      o: 1 - Math.min(1, fall / 6),
    };
  });
  // one teardrop run: wide and fading where it leaves the word, tapering to a neck, bulb at the tip
  const dripPath = (w: number, len: number, bend: number) => {
    const b = Math.max(3, w * 0.5 * (0.55 + 0.45 * Math.min(1, len / 50)));
    const tip = Math.max(len, b * 1.2);
    const nw = Math.max(1.6, w * 0.2);
    const yN = tip - 1.6 * b;
    return [
      `M ${-w / 2} 0`,
      `C ${-w * 0.42} ${0.35 * yN} ${bend * 0.6 - nw} ${0.7 * yN} ${bend - nw} ${yN}`,
      `C ${bend - nw} ${yN + 0.3 * b} ${bend - b} ${tip - 0.6 * b} ${bend - b} ${tip}`,
      `A ${b} ${b} 0 0 0 ${bend + b} ${tip}`,
      `C ${bend + b} ${tip - 0.6 * b} ${bend + nw} ${yN + 0.3 * b} ${bend + nw} ${yN}`,
      `C ${bend * 0.6 + nw} ${0.7 * yN} ${w * 0.42} ${0.35 * yN} ${w / 2} 0`,
      'Z',
    ].join(' ');
  };
  const sparkle = (j: number) => {
    const t = e - 6 - j * 1.5;
    if (t < 0 || t > 12) return 0;
    return Math.sin((t / 12) * Math.PI) * (0.9 + 0.5 * hash(i * 5 + j));
  };
  const glowO = interpolate(e, [5, 7, 16], [0, 0.55, 0], clamp);

  return (
    <g transform={`translate(${slot.x} ${slot.y}) rotate(${rot}) translate(${cx} 0) scale(${scale}) translate(${-cx} 0)`} opacity={approachOpacity}>
      {k < 0 ? (
        <rect x={left + 20} y={-h / 2 + 50} width={M.width} height={h} rx={34} fill="rgba(0,0,0,0.35)" filter="url(#q2-stamp-shadow)" />
      ) : null}
      {glowO > 0 ? <rect x={cx - w / 2 - 20} y={-h / 2 - 20} width={w + 40} height={h + 40} rx={50} fill={TURQ} opacity={glowO} filter="url(#q2-glow)" /> : null}
      {melt > 0 ? (
        <defs>
          <MeltFilter i={i} melt={melt} />
          <linearGradient id={`q2-drip-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={RED} stopOpacity={0} />
            <stop offset="0.22" stopColor={RED} stopOpacity={0.9} />
            <stop offset="1" stopColor={RED} />
          </linearGradient>
        </defs>
      ) : null}
      <g filter={`url(#q2-ink-${i})`}>
        <rect x={left + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} rx={30} fill="none" stroke={ink} strokeWidth={11 + thick} />
        <rect x={left + 22} y={-h / 2 + 22} width={w - 44} height={h - 44} rx={17} fill="none" stroke={ink} strokeWidth={4 + thick * 0.5} />
        <text
          x={left + STAMP_PAD_RIGHT + M.wq / 2}
          y={base}
          textAnchor="middle"
          fontFamily={STAMP_FONT}
          fontSize={STAMP_SIZE}
          fill={ink}
          stroke={thick ? ink : undefined}
          strokeWidth={thick}
        >
          {COPY.stampAfter}
        </text>
        {melt < 1 ? (
          <g opacity={wordO} filter={melt > 0 ? `url(#q2-melt-${i})` : undefined}>
            {Array.from({length: melt > 0 ? SMEAR : 1}).map((_, sIdx) => (
              <g key={sIdx} transform={`translate(0 ${glyphTop + (sIdx / (SMEAR - 1)) * 64 * melt}) scale(1 ${1 + 0.35 * melt}) translate(0 ${-glyphTop})`}>
                <text
                  x={mishLeft + M.wm / 2}
                  y={base}
                  textAnchor="middle"
                  fontFamily={STAMP_FONT}
                  fontSize={STAMP_SIZE}
                  fill={RED}
                  stroke={thick ? RED : undefined}
                  strokeWidth={thick}
                  opacity={sIdx === 0 ? 1 : 0.9}
                >
                  {COPY.erased}
                </text>
              </g>
            ))}
          </g>
        ) : null}
        {melt > 0
          ? drips.map((d, j) =>
              d.o <= 0 || d.len < 2 ? null : (
                <g key={j} transform={`translate(${d.x} ${d.y + d.drop}) rotate(${-rot}) scale(1 ${1 + d.drop / 400})`} opacity={d.o}>
                  <path d={dripPath(d.w, d.len, d.bend)} fill={`url(#q2-drip-${i})`} />
                </g>
              ),
            )
          : null}
        {specks.map((s, j) => (
          <circle key={j} cx={s.x} cy={s.y} r={s.r} fill={RED} opacity={flip > 0 ? 1 - flip : 1} />
        ))}
      </g>
      {flip > 0.6 ? (
        <g filter={`url(#q2-inkfresh-${i})`} opacity={0.55 * interpolate(flip, [0.6, 1], [0, 1], clamp)}>
          <rect x={left + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} rx={30} fill="none" stroke={TURQ} strokeWidth={11} />
          <rect x={left + 22} y={-h / 2 + 22} width={w - 44} height={h - 44} rx={17} fill="none" stroke={TURQ} strokeWidth={4} />
          <text x={left + STAMP_PAD_RIGHT + M.wq / 2} y={base} textAnchor="middle" fontFamily={STAMP_FONT} fontSize={STAMP_SIZE} fill={TURQ}>
            {COPY.stampAfter}
          </text>
        </g>
      ) : null}
      {[0, 1, 2, 3].map((j) => {
        const pos = [
          {x: cx - w / 2 - 18, y: -h / 2 - 10},
          {x: cx + w / 2 + 14, y: -h / 2 + 4},
          {x: cx + w / 2 - 10, y: h / 2 + 18},
          {x: cx - w / 2 + 30, y: h / 2 + 22},
        ][j];
        return <Sparkle key={j} x={pos.x} y={pos.y} s={sparkle(j)} color={j % 2 ? '#FFFFFF' : TURQ} />;
      })}
    </g>
  );
};

