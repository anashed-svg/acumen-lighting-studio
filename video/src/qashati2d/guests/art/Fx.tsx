// Drawn effects for «ضيوف فجأة»: onomatopoeia lettering (دينغ / دونغ / تشك-تشك) that pops and rings on twos,
// whip-pan speed lines + a horizontal motion blur, floating hearts, vibration marks, cold mist.
import React, {useId} from 'react';
import {useCurrentFrame} from 'remotion';
import {brush, C, ellipsePts, FONT, FONT_WEIGHT, INK, InkTextureFilter, noise1, Pt, rng, shapeD} from '../../kit/lib';
import {heartPts} from './draw';

// ------------------------------------------------------------------------------------------------ onomatopoeia
const SFX_KEYS = [
  {s: 0.5, sx: 1.4, sy: 0.6, r: -10}, // smear
  {s: 1.28, sx: 0.94, sy: 1.08, r: 6},
  {s: 0.93, sx: 1.05, sy: 0.96, r: -3},
  {s: 1.05, sx: 0.99, sy: 1.01, r: 1.5},
  {s: 1, sx: 1, sy: 1, r: 0},
];
/** A shouted sound word: burst shape behind, ink-outlined letters, rings (vibrates) on twos after it lands. */
export const SfxWord: React.FC<{
  x: number;
  y: number;
  text: string;
  size?: number;
  rot?: number;
  start: number;
  /** frames it keeps ringing after landing */
  ring?: number;
  exit?: number;
  color?: string;
  burst?: string | null;
  /** burst spikes radius factor */
  burstK?: number;
  font?: 'title' | 'friendly';
  /** pre-roll: on `start` already show this key index (frame-0 hook) */
  from?: number;
  frame?: number;
}> = ({x, y, text, size = 110, rot = 0, start, ring = 16, exit, color = C.turquoise, burst = C.flameYellow, burstK = 1, font = 'title', from = 0, frame}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (f < start) return null;
  const step = Math.floor((f - start) / 2) + from;
  let k = SFX_KEYS[Math.min(step, SFX_KEYS.length - 1)];
  let fade = 1;
  if (exit !== undefined && f >= exit) {
    const e = Math.floor((f - exit) / 2);
    if (e >= 3) return null;
    k = [{s: 1.08, sx: 1.05, sy: 0.95, r: 2}, {s: 0.7, sx: 0.8, sy: 1.2, r: 4}, {s: 0.3, sx: 0.5, sy: 1.5, r: 8}][e];
    fade = 1 - e * 0.25;
  }
  const r = rng(Math.floor(f / 2) * 17 + Math.round(x));
  const ringing = f - start < ring + 8;
  const jx = ringing ? (r() - 0.5) * size * 0.06 : 0;
  const jy = ringing ? (r() - 0.5) * size * 0.06 : 0;
  const jr = ringing ? (r() - 0.5) * 3 : (r() - 0.5) * 0.6;
  const w = text.length * size * 0.42;
  const hw = w / 2 + size * 0.5;
  const hh = size * 0.72;
  const spikes: Pt[] = [];
  const n = 18;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const out = i % 2 === 0;
    const rr = out ? 1.18 + 0.12 * noise1(i * 1.7, 3 + Math.floor(f / 2)) : 0.86;
    spikes.push([Math.cos(a) * hw * rr * burstK, Math.sin(a) * hh * rr * burstK]);
  }
  const seed = 900 + Math.floor(f / 2) * 3;
  const fam = font === 'title' ? FONT.title : FONT.friendly;
  const wgt = FONT_WEIGHT[font];
  return (
    <div
      style={{
        position: 'absolute',
        left: x + jx,
        top: y + jy,
        width: 0,
        height: 0,
        transform: `rotate(${rot + k.r + jr}deg) scale(${k.s * k.sx}, ${k.s * k.sy})`,
        opacity: fade,
      }}
    >
      {burst ? (
        <svg width={4 * hw} height={4 * hh} viewBox={`${-2 * hw} ${-2 * hh} ${4 * hw} ${4 * hh}`} style={{position: 'absolute', left: -2 * hw, top: -2 * hh, overflow: 'visible'}}>
          <path d={shapeD(spikes.map(([a, b]) => [a + 8, b + 10] as Pt), 2)} fill={INK} opacity={0.35} />
          <path d={shapeD(spikes, 2)} fill={burst} />
          <path d={brush(spikes, {w: 6, closed: true, dense: false, seed: 3, step: 3})} fill={INK} />
          {/* ring marks */}
          {ringing
            ? [0, 1, 2, 3].map((i) => {
                const a = (i / 4) * Math.PI * 2 + 0.6 + (Math.floor(f / 2) % 2) * 0.15;
                const r0 = 1.42;
                const r1 = 1.7;
                return (
                  <path
                    key={i}
                    d={brush(
                      [
                        [Math.cos(a) * hw * r0, Math.sin(a) * hh * r0],
                        [Math.cos(a) * hw * r1, Math.sin(a) * hh * r1],
                      ],
                      {w: 7, taper: [0.2, 0.6], seed: 5 + i},
                    )}
                    fill={INK}
                  />
                );
              })
            : null}
        </svg>
      ) : null}
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <InkTextureFilter id={`sfx${raw}`} seed={seed} warp={3} grain={13} pin={15} />
        </defs>
      </svg>
      <div style={{position: 'absolute', left: -600, width: 1200, top: -size * 0.78, textAlign: 'center', direction: 'rtl', whiteSpace: 'nowrap', fontFamily: fam, fontWeight: wgt, fontSize: size, lineHeight: 1.4}}>
        <span style={{position: 'absolute', left: 0, right: 0, color: INK, WebkitTextStroke: `${size * 0.16}px ${INK}`, transform: 'translate(5px, 7px)'}}>{text}</span>
        <span style={{position: 'absolute', left: 0, right: 0, color: INK, WebkitTextStroke: `${size * 0.16}px ${INK}`, filter: `url(#sfx${raw})`}}>{text}</span>
        <span style={{position: 'absolute', left: 0, right: 0, color}}>{text}</span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ whip pan
/** SVG filter defs for a horizontal (or vertical) motion blur; use style.filter = `url(#id)` on the shot */
export const MotionBlurDefs: React.FC<{id: string; amount: number; vertical?: boolean}> = ({id, amount, vertical}) => (
  <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
    <defs>
      <filter id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={vertical ? `0 ${amount}` : `${amount} 0`} edgeMode="duplicate" />
      </filter>
    </defs>
  </svg>
);

/** ink speed lines across the frame for a whip pan, drawn on twos; amount 0..1 */
export const SpeedLines: React.FC<{amount: number; dir?: 1 | -1; seed?: number; color?: string; vertical?: boolean}> = ({amount, dir = 1, seed = 1, color = INK, vertical}) => {
  const f = useCurrentFrame();
  if (amount <= 0.02) return null;
  const r = rng(seed * 1000 + Math.floor(f / 2) * 7);
  const lines = Array.from({length: 26}, () => {
    const y = r() * 1920;
    const x = r() * 1080;
    const len = (200 + r() * 600) * amount;
    const w = 3 + r() * 9;
    return {x, y, len, w};
  });
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      <g transform={vertical ? 'rotate(90 540 960) translate(-420 420)' : undefined}>
        {lines.map((l, i) => (
          <path
            key={i}
            d={brush(
              [
                [l.x - (dir * l.len) / 2, l.y],
                [l.x + (dir * l.len) / 2, l.y + 2],
              ],
              {w: l.w, taper: [0.5, 0.1], tip: 0.05, seed: i},
            )}
            fill={color}
            opacity={0.55 * amount}
          />
        ))}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ hearts
export const DrawnHeart: React.FC<{r: number; color?: string}> = ({r, color = C.strawberry}) => {
  const h = heartPts(0, 0, r);
  return (
    <g>
      <path d={shapeD(h, 4)} fill={INK} opacity={0.25} transform={`translate(${r * 0.12} ${r * 0.16})`} />
      <path d={shapeD(h, 4)} fill={color} />
      <path d={brush([[-r * 0.55, -r * 0.2], [-r * 0.42, -r * 0.5], [-r * 0.12, -r * 0.58]], {w: r * 0.2, taper: [0.3, 0.5], seed: 3})} fill={C.white} opacity={0.9} />
      <path d={brush(h, {w: Math.max(3, r * 0.14), closed: true, dense: false, seed: 4})} fill={INK} />
    </g>
  );
};

/** hearts that pop and float up from spawn points (SVG, parent units); on twos */
export const FloatHearts: React.FC<{spawns: {x: number; y: number; at: number; r?: number}[]; life?: number}> = ({spawns, life = 40}) => {
  const f = useCurrentFrame();
  const f2 = Math.floor(f / 2) * 2;
  return (
    <g>
      {spawns.map((s, i) => {
        const t = f2 - s.at;
        if (t < 0 || t > life) return null;
        const u = t / life;
        const pop = t < 2 ? 0.5 : t < 4 ? 1.25 : t < 6 ? 0.92 : 1;
        const x = s.x + Math.sin(t * 0.25 + i) * 18;
        const y = s.y - u * 170;
        const op = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${Math.sin(t * 0.2 + i) * 12}) scale(${pop})`} opacity={op}>
            <DrawnHeart r={s.r ?? 30} />
          </g>
        );
      })}
    </g>
  );
};

/** two little vibration marks either side of something (SVG, around 0,0, half-width hw) */
export const ShakeMarks: React.FC<{hw: number; h?: number; on: boolean}> = ({hw, h = 60, on}) => {
  const f = useCurrentFrame();
  if (!on) return null;
  const k = Math.floor(f / 2) % 2;
  return (
    <g opacity={0.8}>
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <path d={brush([[sd * (hw + 14 + k * 4), -h * 0.4], [sd * (hw + 24 + k * 4), 0], [sd * (hw + 14 + k * 4), h * 0.4]], {w: 6, taper: [0.3, 0.3], seed: 7})} fill={INK} />
          <path d={brush([[sd * (hw + 36 + k * 4), -h * 0.28], [sd * (hw + 44 + k * 4), 0], [sd * (hw + 36 + k * 4), h * 0.28]], {w: 5, taper: [0.3, 0.3], seed: 8})} fill={INK} />
        </g>
      ))}
    </g>
  );
};

/** soft cold mist wisps (SVG) rolling out and down from a line, 0..1 progress; on twos */
export const Mist: React.FC<{x0: number; x1: number; y: number; t: number; seed?: number}> = ({x0, x1, y, t, seed = 1}) => {
  const f = useCurrentFrame();
  if (t <= 0) return null;
  const r = rng(seed);
  const k = Math.floor(f / 2);
  return (
    <g>
      {Array.from({length: 9}).map((_, i) => {
        const bx = x0 + (x1 - x0) * (i / 8) + (r() - 0.5) * 40;
        const drop = 30 + 260 * Math.min(1, t * (0.6 + r() * 0.6));
        const rx = 50 + r() * 60;
        const op = Math.min(1, t * 3) * (1 - Math.max(0, t - 0.6) / 0.6) * (0.35 + r() * 0.25);
        const pts = ellipsePts(bx + noise1(k * 0.3 + i, seed) * 10, y + drop, rx * (0.6 + t), 26 + 20 * t, 18);
        return <path key={i} d={shapeD(pts.map(([px, py], j) => [px, py + noise1(j * 0.9 + k * 0.4, i) * 8] as Pt))} fill={C.white} opacity={op} />;
      })}
    </g>
  );
};
