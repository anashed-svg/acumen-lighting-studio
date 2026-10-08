// The spoon counter «ملعقة 0…8»: a cream paper card taped to the frame with turquoise washi tape (screen space),
// the number on a hand-inked teal tile that FLIPS on twos (old digit folds away → new one lands stretched →
// squash → settle) and makes the whole card jump. 7 turns the tile red; 8 (the snatch) adds a shake.
// Western digits (UAE phones). RTL: the label on the right, the number on the left.
import React, {useMemo} from 'react';
import {brush, C, FONT, FONT_WEIGHT, INK, InkTextureFilter, jiggle, Pt, rng, shapeD, smoothD, unpopOnTwos} from '../../kit/lib';

const CARD_W = 330;
const CARD_H = 158;
const TILE_W = 118;
const TILE_H = 132;

const cardGeo = () => {
  const r = rng(77);
  // a soft rectangle, wobbly like cut paper
  const pts: Pt[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const e = 5;
    const k = 1 / Math.pow(Math.abs(c) ** e + Math.abs(s) ** e, 1 / e);
    pts.push([c * (CARD_W / 2) * k + (r() - 0.5) * 3, s * (CARD_H / 2) * k + (r() - 0.5) * 3]);
  }
  const tile: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const e = 4;
    const k = 1 / Math.pow(Math.abs(c) ** e + Math.abs(s) ** e, 1 / e);
    tile.push([c * (TILE_W / 2) * k + (r() - 0.5) * 2.5, s * (TILE_H / 2) * k + (r() - 0.5) * 2.5]);
  }
  // washi tape: a translucent strip with torn (zig-zag) ends, across the top-right corner
  const tape: Pt[] = [];
  const tw = 150;
  const th = 40;
  for (let i = 0; i <= 6; i++) tape.push([-tw / 2 + (i / 6) * tw, -th / 2 + (r() - 0.5) * 2]);
  for (let i = 0; i <= 5; i++) tape.push([tw / 2 + (i % 2 ? 5 : -2), -th / 2 + (i / 5) * th]);
  for (let i = 6; i >= 0; i--) tape.push([-tw / 2 + (i / 6) * tw, th / 2 + (r() - 0.5) * 2]);
  for (let i = 5; i >= 0; i--) tape.push([-tw / 2 + (i % 2 ? -5 : 2), -th / 2 + (i / 5) * th]);
  return {
    card: shapeD(pts, 5),
    cardInk: brush(pts, {w: 6, closed: true, start: 0.3, seed: 81, shadow: 0.6, step: 4}),
    tile: shapeD(tile, 5),
    tileInk: brush(tile, {w: 4.5, closed: true, start: 0.8, seed: 82, shadow: 0.6, step: 4}),
    tape: smoothD(tape, true),
  };
};

/** value of the counter at frame f given the flip frames (each flip adds one) */
export const counterValue = (f: number, flips: number[]) => flips.filter((x) => f >= x).length;

export const SpoonCounter: React.FC<{
  x: number;
  y: number;
  rot?: number;
  frame: number;
  /** frames where the counter adds one (sorted) */
  flips: number[];
  label: string;
  exit?: number;
}> = ({x, y, rot = -3, frame: f, flips, label, exit}) => {
  const g = useMemo(cardGeo, []);
  const value = counterValue(f, flips);
  const lastFlip = value > 0 ? flips[value - 1] : -999;
  const k = f - lastFlip; // frames since the last flip
  const step = Math.floor(k / 2);
  // the flip, on twos: [incoming squashed] → [stretched past] → [squash back] → settle
  const keys = [
    {sx: 1.18, sy: 0.42, dy: -18},
    {sx: 0.9, sy: 1.2, dy: 6},
    {sx: 1.06, sy: 0.93, dy: -2},
    {sx: 0.99, sy: 1.01, dy: 0},
  ];
  const kk = k >= 0 && step < keys.length ? keys[step] : {sx: 1, sy: 1, dy: 0};
  const prevShow = k >= 0 && k < 2 && value > 0; // the old digit folding away (one drawing)
  const red = value >= 7;
  const doom = value >= 8;
  // card reaction: a hop on every flip (on twos), a shake on 8
  const hop = jiggle(Math.floor(f / 2) * 2, lastFlip, 1, 1.0, 0.3);
  const shake = doom && k < 18 ? Math.sin(Math.floor(f / 2) * 2.7) * 7 * Math.exp(-k * 0.12) : 0;
  const ex = exit !== undefined ? unpopOnTwos(f, exit) : {visible: true, s: 1, sx: 1, sy: 1};
  if (!ex.visible) return null;
  const seed = 600 + Math.floor(f / 2) * 3;
  const tileFill = red ? C.chili : INK;
  const digitColor = red ? C.white : C.turquoise;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `translate(${shake}px, ${-6 * hop}px) rotate(${rot + 2.2 * hop + shake * 0.3}deg) scale(${ex.s * ex.sx}, ${ex.s * ex.sy})`,
      }}
    >
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <InkTextureFilter id="spoon-counter-ink" seed={seed} warp={2.5} grain={12.5} pin={14.5} />
        </defs>
      </svg>
      <svg width={CARD_W + 120} height={CARD_H + 120} viewBox={`${-CARD_W / 2 - 60} ${-CARD_H / 2 - 60} ${CARD_W + 120} ${CARD_H + 120}`} style={{position: 'absolute', left: -CARD_W / 2 - 60, top: -CARD_H / 2 - 60, overflow: 'visible'}}>
        <path d={g.card} fill={INK} opacity={0.22} transform="translate(7 10)" />
        <path d={g.card} fill={C.cream} />
        <path d={g.cardInk} fill={INK} />
        {/* the number tile, on the LEFT (RTL: label first on the right) */}
        <g transform={`translate(${-CARD_W / 2 + TILE_W / 2 + 18} 0)`}>
          <path d={g.tile} fill={INK} opacity={0.25} transform="translate(4 6)" />
          <path d={g.tile} fill={tileFill} />
          <path d={g.tileInk} fill={INK} />
          {/* fold line of the flip card */}
          <path d={`M${-TILE_W / 2 + 6} 0L${TILE_W / 2 - 6} 0`} stroke={red ? C.chiliDeep : C.tealDark} strokeWidth={3} opacity={0.7} />
        </g>
        <g transform={`translate(${CARD_W / 2 - 40} ${-CARD_H / 2 - 4}) rotate(14)`}>
          <path d={g.tape} fill={C.turquoise} opacity={0.62} />
          <path d={g.tape} fill={C.white} opacity={0.18} transform="translate(-2 -3) scale(0.9 0.5)" />
        </g>
      </svg>
      {/* label */}
      <div
        style={{
          position: 'absolute',
          left: -CARD_W / 2 + TILE_W + 22,
          width: CARD_W - TILE_W - 30,
          top: -CARD_H / 2,
          height: CARD_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
          fontFamily: FONT.friendly,
          fontWeight: FONT_WEIGHT.friendly,
          fontSize: 60,
          color: INK,
          filter: 'url(#spoon-counter-ink)',
        }}
      >
        {label}
      </div>
      {/* digit(s) */}
      <div style={{position: 'absolute', left: -CARD_W / 2 + 18, top: -TILE_H / 2, width: TILE_W, height: TILE_H, overflow: 'visible'}}>
        {prevShow ? (
          <Digit v={value - 1} color={digitColor} sx={1.04} sy={0.5} dy={22} />
        ) : (
          <Digit v={value} color={digitColor} sx={kk.sx} sy={kk.sy} dy={kk.dy} />
        )}
        {k >= 0 && k < 6 ? (
          // flip speed lines (two drawings)
          <svg width={TILE_W + 80} height={TILE_H + 60} viewBox={`${-40} ${-30} ${TILE_W + 80} ${TILE_H + 60}`} style={{position: 'absolute', left: -40, top: -30, overflow: 'visible'}}>
            {[-1, 1].map((sgn) => (
              <path
                key={sgn}
                d={brush(
                  [
                    [TILE_W / 2 + sgn * (TILE_W / 2 + 14), -8 + step * 6],
                    [TILE_W / 2 + sgn * (TILE_W / 2 + 22), 18 + step * 6],
                    [TILE_W / 2 + sgn * (TILE_W / 2 + 16), 44 + step * 6],
                  ],
                  {w: 6, taper: [0.2, 0.7], tip: 0.1, seed: 30 + sgn + step},
                )}
                fill={INK}
                opacity={1 - step * 0.3}
              />
            ))}
          </svg>
        ) : null}
      </div>
    </div>
  );
};

const Digit: React.FC<{v: number; color: string; sx: number; sy: number; dy: number}> = ({v, color, sx, sy, dy}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT.title,
      fontWeight: FONT_WEIGHT.title,
      fontSize: 132,
      lineHeight: 1,
      color,
      transform: `translateY(${dy + 8}px) scale(${sx}, ${sy})`,
      transformOrigin: '50% 50%',
      filter: 'url(#spoon-counter-ink)',
    }}
  >
    {String(v)}
  </div>
);

export const COUNTER_SIZE = {w: CARD_W, h: CARD_H};
