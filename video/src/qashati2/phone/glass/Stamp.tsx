// Rubber stamps on the glass: «مش قشطة» slams in red; later the cream (the hero bead or a splat) runs over
// «مش», drags the wet ink down with it until it is gone, and the stamp pops turquoise reading «قشطة».
import React from 'react';
import {interpolate, interpolateColors} from 'remotion';
import {COLORS, COPY, T} from '../../spec';
import {carrierAt, carrierStart, designToStamp, STAMP_SIZE, STAMPS, stampMetrics as M} from '../layout';
import {STAMP_FONT} from '../theme';
import {clamp, easeOut, frozen, hash, P} from '../timeline';

const RED = COLORS.stampRed;
const TURQ = COLORS.turquoise;
const SMEAR = 7; // stacked, offset copies of «مش» = the wet ink smearing down the glass
const PAD_R = (M.width - M.textW) / 2;
const MISH_LEFT = -M.width / 2 + M.width - PAD_R - M.wm;
const WORD_H = M.glyphBottom - M.glyphTop;

// Per-stamp melt: columns of the smeared word slide down by different amounts (runny streaks) while a
// rising noise threshold eats the ink away, as if the cream is washing it off.
const MeltFilter: React.FC<{i: number; melt: number}> = ({i, melt}) => (
  <filter id={`q2-melt-${i}`} x="-30%" y="-60%" width="160%" height="400%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.075 0.006" numOctaves={2} seed={4 + i} result="n" />
    <feComponentTransfer in="n" result="d">
      <feFuncR type="linear" slope={0} intercept={0.5} />
      <feFuncG type="linear" slope={1.4} intercept={-0.45} />
    </feComponentTransfer>
    <feDisplacementMap in="SourceGraphic" in2="d" scale={70 * melt} xChannelSelector="R" yChannelSelector="G" result="run" />
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={19 + i} result="er" />
    <feColorMatrix in="er" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  9 0 0 0 ${-1.2 - 4.5 * Math.pow(melt, 1.3)}`} result="erA" />
    <feComposite in="run" in2="erA" operator="in" />
  </filter>
);

// Rubber-stamp ink: rough edges, speckled voids, uneven density, slight bleed.
export const StampFilters: React.FC = () => (
  <defs>
    {STAMPS.map((_, i) => (
      <filter key={i} id={`q2-ink-${i}`} x="-12%" y="-25%" width="124%" height="150%" colorInterpolationFilters="sRGB">
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
      <filter key={`f${i}`} id={`q2-inkfresh-${i}`} x="-12%" y="-25%" width="124%" height="150%" colorInterpolationFilters="sRGB">
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
    <filter id="q2-stamp-approach" x="-20%" y="-30%" width="140%" height="160%">
      <feGaussianBlur stdDeviation={2.2} />
    </filter>
  </defs>
);

const Sparkle: React.FC<{x: number; y: number; s: number; color: string}> = ({x, y, s, color}) =>
  s <= 0 ? null : (
    <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -22 C2 -6 6 -2 22 0 C6 2 2 6 0 22 C-2 6 -6 2 -22 0 C-6 -2 -2 -6 0 -22 Z" fill={color} />
  );

// approach (scale, opacity) for the 2 frames before impact: the hook is already mid-slam on frame 0
const approachOf = (i: number, k: number) => {
  if (i === 0) return k === -2 ? {s: 1.25, o: 0.64, blur: false} : {s: 1.08, o: 0.92, blur: false};
  if (i >= 4) return k === -2 ? {s: 1.8, o: 0.28, blur: true} : {s: 1.38, o: 0.62, blur: true};
  return k === -2 ? {s: 1.6, o: 0.38, blur: true} : {s: 1.22, o: 0.8, blur: false};
};

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

// Synced "ta-da" bounces of every stamp while the all-«قشطة» screen holds.
const holdPulse = (f: number) =>
  P.holdBounce.reduce((a, b, j) => {
    const t = f - b;
    return a + (t >= 0 ? (j ? 0.1 : 0.17) * Math.sin(t * 0.8) * Math.exp(-t * 0.24) : 0);
  }, 0);

export const Stamp: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const slot = STAMPS[i];
  const hero = i === 0;
  const burst = i >= 4;
  const k = frozen(frame) - (i < 4 ? T.screens[i].stamp : T.burst[i - 4]);
  if (k < -2) return null;
  const e = frame - T.erase[i];

  // --- slam: comes down from above the glass, squashes, settles
  const ap = k < 0 ? approachOf(i, k) : null;
  const settleAmp = hero ? 0.1 : 0.07;
  let scale = ap ? ap.s : 1 - settleAmp * Math.cos(k * 1.25) * Math.exp(-k * 0.55);
  let rot = slot.rot + (k < 6 ? (hero ? 4 : 3) * Math.exp(-Math.max(0, k) * 0.6) * (i % 2 ? -1 : 1) : 0);

  // --- erase: the carrier's progress over «مش» (0 = its front touches the word, 1 = it has passed)
  const c = carrierAt(i, frame);
  const cl = c ? designToStamp(i, c.x, c.y) : null;
  const rl = c ? c.r / slot.s : 0;
  const p = cl ? Math.min(1, Math.max(0, (cl.y + rl - M.glyphTop) / (WORD_H + 1.3 * rl))) : 0;
  const [sh0, sh1, fl0, fl1] = hero ? [13, 21, 14, 18] : [3, 10, 4.5, 7];
  const wordO = 1 - interpolate(p, [0.55, 1], [0, 1], {...clamp, easing: (t) => t * t * (3 - 2 * t)});
  const shrink = interpolate(e, [sh0, sh1], [0, 1], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12});
  const flip = interpolate(e, [fl0, fl1], [0, 1], clamp);
  const bounceT = e - fl0 - 0.5;
  const bounce = bounceT >= 0 ? (hero ? 0.24 : 0.2) * Math.sin(bounceT * 0.85) * Math.exp(-bounceT * 0.22) : 0;
  if (bounceT >= 0) {
    scale *= 1 + bounce + holdPulse(frame) + (e > 16 ? 0.012 * Math.sin((e - 16) * 0.3 + i) : 0);
    const happyRot = slot.rot * 0.35;
    rot =
      interpolate(e, [fl0, fl0 + 7], [slot.rot, happyRot], {...clamp, easing: easeOut}) +
      7 * Math.sin(bounceT * 0.7) * Math.exp(-bounceT * 0.25) +
      12 * holdPulse(frame) * (i % 2 ? 1 : -1);
  }

  // red -> flash of white -> turquoise (a straight RGB blend would pass through grey)
  const ink = interpolateColors(flip, [0, 0.45, 1], [RED, '#F4FFFD', TURQ]);
  const w = M.width + (M.widthAfter - M.width) * shrink;
  const h = M.height;
  const left = -M.width / 2;
  const cx = left + w / 2; // after shrinking, pivot around the new centre so the bounce centres on «قشطة»
  const base = M.base;
  const thick = k === 0 ? (hero ? 3.5 : 2.5) : 0; // wet, heavy ink on the impact frame

  // ink specks flung on impact (the hook throws a proper burst of ink)
  const nSpecks = hero ? 26 : burst ? 6 : 10;
  const specks =
    k >= 0
      ? Array.from({length: nSpecks}).map((_, j) => {
          const a = hash(i * 31 + j) * Math.PI * 2;
          const onEdge = {x: Math.cos(a) * (M.width / 2), y: Math.sin(a) * (h / 2)};
          // (the hook's burst flies sideways and down: nothing lands on the reading band above it — the
          // upward specks stay tucked into the top border instead of dotting «العظمى» / «حاضر»)
          const up = Math.sin(a) < -0.2;
          const fling = hero ? (up ? -(10 + hash(i * 17 + j) * 12) : 24 + hash(i * 17 + j) * 120) : 10 + hash(i * 17 + j) * 46;
          const t = Math.min(1, (k + 1) / 3);
          const r = (hero ? 2 : 2.5) + hash(i * 13 + j * 3) * (hero ? (up ? 5 : 9) : 7);
          return {x: onEdge.x * 1.02 + Math.cos(a) * fling * t, y: onEdge.y * 1.05 + Math.sin(a) * fling * t, r};
        })
      : [];
  // the hook also splashes a few fat ink blots with tails
  const blots = hero && k >= 0 ? [0, 1, 2, 3, 4].map((j) => {
    const a = Math.PI * 0.08 + j * 0.2 * Math.PI + hash(70 + j) * 0.25;
    const t = Math.min(1, (k + 1) / 2.5);
    const d = M.width * 0.5 + 30 + hash(80 + j) * 60;
    return {x: Math.cos(a) * d * t, y: Math.sin(a) * (h * 0.5 + 40 + hash(90 + j) * 50) * t, r: 7 + hash(95 + j) * 7, a};
  }) : [];

  // melting «مش»: the ink runs down in tapered drips with bulbous tips (counter-rotated: gravity = screen-down)
  const drips = [
    {p: 0.12, w: 24, l: 150},
    {p: 0.34, w: 13, l: 70},
    {p: 0.55, w: 20, l: 190},
    {p: 0.74, w: 11, l: 48},
    {p: 0.9, w: 17, l: 115},
  ].map((dd, j) => {
    const hj = hash(i * 7 + j);
    const g = Math.max(0, p - 0.25 - hj * 0.15) / 0.5;
    const grow = easeOut(Math.min(1, g));
    const fall = Math.max(0, e - (hero ? 12 : 6) - hj * 3);
    return {
      x: MISH_LEFT + M.wm * (dd.p + (hash(i * 3 + j * 11) - 0.5) * 0.06),
      y: base - 18 - hash(j * 5 + i) * 22,
      len: grow * dd.l * (0.8 + 0.4 * hash(i * 13 + j)),
      w: dd.w * (0.85 + 0.3 * hash(i + j * 9)),
      bend: (hash(i * 17 + j * 3) - 0.5) * 12,
      drop: 4 * fall * fall,
      o: 1 - Math.min(1, fall / 6),
    };
  });
  const nSpark = hero ? 8 : 4;
  // sparkles when the stamp turns, and again on the first synced "ta-da" of the hold
  const sparkle = (j: number) => {
    const bump = (t: number) => (t < 0 || t > 12 ? 0 : Math.sin((t / 12) * Math.PI));
    const t1 = bump(e - fl0 - 1 - j * 1.2);
    const t2 = bump(frame - P.holdBounce[0] - j * 1.2 - (i % 3));
    return Math.max(t1, 0.8 * t2) * (0.9 + 0.5 * hash(i * 5 + j)) * (hero ? 1.5 : 1);
  };
  const glowO =
    interpolate(e, [fl0, fl0 + 2, fl0 + 12], [0, hero ? 0.7 : 0.55, 0], clamp) +
    P.holdBounce.reduce((a, b, j) => a + interpolate(frame - b, [0, 2, 12], [0, j ? 0.3 : 0.45, 0], clamp), 0);

  // «مش» is shoved down by the cream: once the carrier's front has swallowed the top of the word it pushes
  // the rest ahead of it — the word slides, stretches, leaves a smear behind and fades as it leaves the
  // stamp. The band above the carrier's centre is clean.
  const front = cl ? cl.y + rl : -1e4;
  // (a splat lands on the word: it only starts pushing once it slides, never on the impact frame)
  const c0 = carrierAt(i, carrierStart(i));
  const front0 = c0 ? designToStamp(i, c0.x, c0.y).y + c0.r / slot.s : -1e4;
  const push = Math.max(0, front - Math.max(front0, M.glyphTop + 0.3 * WORD_H));
  const slide = push * 0.92;
  const stretch = 1 + Math.min(0.55, push / 160);
  const smearLen = Math.min(70, push * 0.5);
  const clipTop = cl ? cl.y - 0.15 * rl : -1e4;
  const melt = interpolate(p, [0.35, 1], [0, 1], {...clamp, easing: (t) => t * t});
  const mishText = (sIdx: number) => (
    <g key={sIdx} transform={`translate(0 ${M.glyphTop + slide - (sIdx / (SMEAR - 1)) * smearLen}) scale(1 ${stretch}) translate(0 ${-M.glyphTop})`}>
      <text
        x={MISH_LEFT + M.wm / 2}
        y={base}
        textAnchor="middle"
        fontFamily={STAMP_FONT}
        fontSize={STAMP_SIZE}
        fill={RED}
        stroke={thick ? RED : undefined}
        strokeWidth={thick}
        opacity={sIdx === 0 ? 1 : 0.55}
      >
        {COPY.erased}
      </text>
    </g>
  );

  const approachF = ap?.blur ? 'url(#q2-stamp-approach)' : undefined;
  return (
    <g
      transform={`translate(${slot.x} ${slot.y}) rotate(${rot}) scale(${slot.s}) translate(${cx} 0) scale(${scale}) translate(${-cx} 0)`}
      opacity={ap ? ap.o : 1}
    >
      {ap ? <rect x={left + 24} y={-h / 2 + (hero ? 30 : 60)} width={M.width} height={h} rx={34} fill={`rgba(0,0,0,${hero ? 0.1 : 0.35})`} filter="url(#q2-stamp-shadow)" /> : null}
      {glowO > 0 ? <rect x={cx - w / 2 - 20} y={-h / 2 - 20} width={w + 40} height={h + 40} rx={50} fill={TURQ} opacity={glowO} filter="url(#q2-glow)" /> : null}
      {p > 0 ? (
        <defs>
          <MeltFilter i={i} melt={melt} />
          <linearGradient id={`q2-drip-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={RED} stopOpacity={0} />
            <stop offset="0.22" stopColor={RED} stopOpacity={0.9} />
            <stop offset="1" stopColor={RED} />
          </linearGradient>
          <clipPath id={`q2-clean-${i}`}>
            <rect x={left - 200} y={clipTop} width={M.width + 400} height={2000} />
          </clipPath>
        </defs>
      ) : null}
      <g filter={approachF}>
        <g filter={`url(#q2-ink-${i})`}>
          <rect x={left + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} rx={30} fill="none" stroke={ink} strokeWidth={11 + thick} />
          <rect x={left + 22} y={-h / 2 + 22} width={w - 44} height={h - 44} rx={17} fill="none" stroke={ink} strokeWidth={4 + thick * 0.5} />
          <text
            x={left + PAD_R + M.wq / 2}
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
          {wordO > 0 ? (
            p > 0 ? (
              <g clipPath={`url(#q2-clean-${i})`}>
                <g opacity={wordO} filter={`url(#q2-melt-${i})`}>
                  {Array.from({length: SMEAR}).map((_, sIdx) => mishText(sIdx))}
                </g>
              </g>
            ) : (
              mishText(0)
            )
          ) : null}
          {p > 0
            ? drips.map((d, j) =>
                d.o <= 0 || d.len < 2 ? null : (
                  <g key={j} transform={`translate(${d.x} ${d.y + slide * 0.6 + d.drop}) rotate(${-rot}) scale(1 ${1 + d.drop / 400})`} opacity={d.o}>
                    <path d={dripPath(d.w, d.len, d.bend)} fill={`url(#q2-drip-${i})`} />
                  </g>
                ),
              )
            : null}
          {specks.map((s, j) => (
            <circle key={j} cx={s.x} cy={s.y} r={s.r} fill={RED} opacity={flip > 0 ? 1 - flip : 1} />
          ))}
          {blots.map((b, j) => (
            <g key={`b${j}`} opacity={flip > 0 ? 1 - flip : 1}>
              <circle cx={b.x} cy={b.y} r={b.r} fill={RED} />
              <line x1={b.x} y1={b.y} x2={b.x - Math.cos(b.a) * b.r * 3.2} y2={b.y - Math.sin(b.a) * b.r * 3.2} stroke={RED} strokeWidth={b.r * 0.9} strokeLinecap="round" />
            </g>
          ))}
        </g>
        {flip > 0.6 ? (
          <g filter={`url(#q2-inkfresh-${i})`} opacity={0.55 * interpolate(flip, [0.6, 1], [0, 1], clamp)}>
            <rect x={left + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} rx={30} fill="none" stroke={TURQ} strokeWidth={11} />
            <rect x={left + 22} y={-h / 2 + 22} width={w - 44} height={h - 44} rx={17} fill="none" stroke={TURQ} strokeWidth={4} />
            <text x={left + PAD_R + M.wq / 2} y={base} textAnchor="middle" fontFamily={STAMP_FONT} fontSize={STAMP_SIZE} fill={TURQ}>
              {COPY.stampAfter}
            </text>
          </g>
        ) : null}
      </g>
      {Array.from({length: nSpark}).map((_, j) => {
        const a = (j / nSpark) * Math.PI * 2 + 0.6;
        const pos =
          j < 4
            ? [
                {x: cx - w / 2 - 18, y: -h / 2 - 10},
                {x: cx + w / 2 + 14, y: -h / 2 + 4},
                {x: cx + w / 2 - 10, y: h / 2 + 18},
                {x: cx - w / 2 + 30, y: h / 2 + 22},
              ][j]
            : {x: cx + Math.cos(a) * (w / 2 + 40), y: Math.sin(a) * (h / 2 + 34)};
        return <Sparkle key={j} x={pos.x} y={pos.y} s={sparkle(j)} color={j % 2 ? '#FFFFFF' : TURQ} />;
      })}
    </g>
  );
};
