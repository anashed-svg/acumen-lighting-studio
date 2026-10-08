// <InkTitle/> — big kinetic Arabic headlines, word by word (RTL: the first word lands on the right), each word
// PRESSED like a printing block ON TWOS: approach (big, faint) → impact (wide, wet ink spreads) → settle, then the
// print boils (ink texture reseeded every 2 frames, a hair of tilt jitter). Never letter by letter (joining breaks).
// Optional misregistered second plate (riso) behind the ink and ink specks on impact.
//
//   <InkTitle x={510} y={600} text={'الفرق كلّو\nبالـ ق.'} start={10} fontSize={150} highlight={{3: C.turquoise}} />
import React, {useId, useMemo} from 'react';
import {random, useCurrentFrame} from 'remotion';
import {FONT, FONT_WEIGHT, FontKey} from '../fonts';
import {rng} from '../geom';
import {InkTextureFilter} from '../look/InkTexture';
import {INK} from '../palette';
import {unpopOnTwos} from '../time';

export type InkTitleProps = {
  /** centre of the block (parent px) */
  x: number;
  y: number;
  /** words split on spaces, lines on '\n' */
  text: string;
  start?: number;
  /** frames between words (keep it even: on twos) */
  stagger?: number;
  fontSize?: number;
  lineHeight?: number;
  font?: FontKey;
  color?: string;
  /** colour per word index (reading order, 0 = first word) */
  highlight?: Record<number, string>;
  /** second colour plate behind the ink, offset like a misregistered riso print (or null) */
  plate?: string | null;
  plateOffset?: [number, number];
  /** ink specks flung on each impact */
  specks?: boolean;
  /** frame it leaves (words un-press in reverse order, on twos) */
  exit?: number;
  rotate?: number;
  /** max line width (px) for centring; lines never wrap on their own */
  width?: number;
  boil?: number;
  frame?: number;
  style?: React.CSSProperties;
};

// per-word keys on twos after the word's start: approach, impact, rebound, settle
const KEYS = [
  {s: 1.32, sx: 1, sy: 1, o: 0.45, wet: 0, blur: 2.2},
  {s: 1, sx: 1.08, sy: 0.9, o: 1, wet: 2.2, blur: 0},
  {s: 0.97, sx: 0.98, sy: 1.03, o: 1, wet: 0.8, blur: 0},
  {s: 1, sx: 1, sy: 1, o: 1, wet: 0, blur: 0},
];

export const InkTitle: React.FC<InkTitleProps> = ({
  x,
  y,
  text,
  start = 0,
  stagger = 4,
  fontSize = 140,
  lineHeight = 1.18,
  font = 'title',
  color = INK,
  highlight = {},
  plate = null,
  plateOffset = [7, 6],
  specks = true,
  exit,
  rotate = -2,
  width = 900,
  boil = 1,
  frame,
  style,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const lines = useMemo(() => text.split('\n').map((l) => l.split(' ').filter(Boolean)), [text]);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const f2 = Math.floor(f / 2);
  if (f < start - 2) return null;
  const exitP = exit !== undefined ? unpopOnTwos(f, exit) : null;
  if (exitP && !exitP.visible) return null;
  const fam = FONT[font];
  const wgt = FONT_WEIGHT[font];
  let idx = -1;
  void total;
  const seed = boil > 0 ? 300 + f2 * 3 : 300;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        transform: `translateY(-50%) rotate(${rotate}deg) scale(${exitP ? exitP.s : 1})`,
        ...style,
      }}
    >
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <InkTextureFilter id={`ink${raw}`} seed={seed} warp={3.5 * boil + 1} />
        </defs>
      </svg>
      {lines.map((words, li) => (
        <div
          key={li}
          style={{
            direction: 'rtl',
            display: 'flex',
            justifyContent: 'center',
            gap: fontSize * 0.26,
            fontFamily: fam,
            fontWeight: wgt,
            fontSize,
            lineHeight,
            whiteSpace: 'nowrap',
          }}
        >
          {words.map((w) => {
            idx++;
            const at = start + idx * stagger;
            const k = Math.floor((f - at) / 2);
            const key = k < 0 ? null : KEYS[Math.min(k, KEYS.length - 1)];
            const r = rng(idx * 97 + (k >= KEYS.length - 1 ? f2 : k) * 13 + 5);
            const jit = k >= KEYS.length - 1 ? (r() - 0.5) * 0.9 * boil : 0;
            const jy = k >= KEYS.length - 1 ? (r() - 0.5) * 1.6 * boil : 0;
            const col = highlight[idx] ?? color;
            const sp =
              specks && key && k >= 1
                ? Array.from({length: 5}).map((_, j) => {
                    // flung above / below the word only (never into the gaps between words: they would read as punctuation)
                    const up = j % 2 === 0 ? -1 : 1;
                    const a = up * (Math.PI / 2) + (random(`sp${raw}${idx}${j}`) - 0.5) * 1.6;
                    const d = (0.62 + random(`sd${raw}${idx}${j}`) * 0.4) * fontSize * (0.7 + 0.15 * (Math.min(k, 3) - 1));
                    return {x: Math.cos(a) * d * 0.9, y: Math.sin(a) * d * 0.62, r: 2 + random(`sr${raw}${idx}${j}`) * fontSize * 0.03};
                  })
                : [];
            return (
              <span key={idx} style={{position: 'relative', display: 'inline-block', visibility: key ? 'visible' : 'hidden'}}>
                {plate && key ? (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      color: plate,
                      transform: `translate(${plateOffset[0]}px, ${plateOffset[1]}px) rotate(${jit}deg) scale(${key.s * key.sx}, ${key.s * key.sy})`,
                      opacity: key.o,
                      filter: `url(#ink${raw})`,
                    }}
                  >
                    {w}
                  </span>
                ) : null}
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    color: col,
                    transform: key ? `translateY(${jy}px) rotate(${jit}deg) scale(${key.s * key.sx}, ${key.s * key.sy})` : undefined,
                    opacity: key ? key.o : 0,
                    WebkitTextStroke: key && key.wet > 0 ? `${key.wet}px ${col}` : undefined,
                    filter: key && key.blur > 0 ? `blur(${key.blur}px)` : `url(#ink${raw})`,
                  }}
                >
                  {w}
                </span>
                {sp.map((p, j) => (
                  <span
                    key={j}
                    style={{position: 'absolute', left: '50%', top: '55%', width: p.r * 2, height: p.r * 2, borderRadius: '50%', background: col, transform: `translate(${p.x - p.r}px, ${p.y - p.r}px)`}}
                  />
                ))}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
