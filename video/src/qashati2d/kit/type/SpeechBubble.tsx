// <SpeechBubble/> — a hand-drawn speech bubble: wobbly (never a UI pill), variable-weight ink that boils on twos,
// a curved hand-drawn tail pointing at the speaker, RTL Arabic (whole words/lines, never per letter) with an optional
// Latin / Arabizi line under it. Pops ON TWOS with squash & stretch from the tail's base; optional exit.
//
//   <SpeechBubble x={540} y={520} text="بس ملعقة وحدة" sub="bas wa7de" tail={[700, 760]} start={12} />
// x/y = bubble centre (parent px). `text` lines split on '\n'. Emoji are fine (Noto Color Emoji).
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {brush, noise1, Pt, rng, smoothD} from '../geom';
import {FONT, FONT_WEIGHT, FontKey} from '../fonts';
import {useBoil} from '../look/Boil';
import {C, INK} from '../palette';
import {popOnTwos, unpopOnTwos} from '../time';
import {useTextWidths} from './measure';

export type SpeechBubbleProps = {
  x: number;
  y: number;
  text: string;
  /** optional second line in Latin / Arabizi (Poppins) or any extra line */
  sub?: string;
  /** where the tail points (parent px); omit for no tail */
  tail?: Pt;
  /** frame the bubble pops (relative to the current Sequence) */
  start?: number;
  /** frame it shrinks away (optional) */
  exit?: number;
  font?: FontKey;
  fontSize?: number;
  subSize?: number;
  color?: string;
  fill?: string;
  subColor?: string;
  /** small tilt (deg) */
  rotate?: number;
  /** bubble shape: 'round' (speech) | 'cloud' (thought) | 'burst' (shout) */
  shape?: 'round' | 'cloud' | 'burst';
  padX?: number;
  padY?: number;
  seed?: number;
  boil?: number;
  frame?: number;
  style?: React.CSSProperties;
};

/**
 * Break a one-line prompt into two balanced lines at the word gap nearest the middle (whole words only — Arabic is
 * never split inside a word; a trailing emoji stays glued to its last word). Text that already has '\n' is kept.
 * Long single-line bubbles read as banners/ribbons; two lines make a real speech bubble.
 */
export const balanceLines = (text: string, minChars = 18) => {
  if (text.includes('\n') || text.length < minChars) return text;
  const words = text.split(' ');
  // glue emoji-only / punctuation-only tokens to the word before them
  const toks: string[] = [];
  words.forEach((w) => {
    if (toks.length && !/[\p{L}\p{N}]/u.test(w)) toks[toks.length - 1] += ' ' + w;
    else toks.push(w);
  });
  if (toks.length < 2) return text;
  let best = 1;
  let bestD = 1e9;
  for (let i = 1; i < toks.length; i++) {
    const a = toks.slice(0, i).join(' ').length;
    const b = toks.slice(i).join(' ').length;
    const d = Math.abs(a - b);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return toks.slice(0, best).join(' ') + '\n' + toks.slice(best).join(' ');
};

/** true when the line contains Arabic script (then it is laid out RTL; Latin/Arabizi lines stay LTR). */
export const isRtl = (s: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);

const outlinePts = (hw: number, hh: number, shape: 'round' | 'cloud' | 'burst', seed: number): Pt[] => {
  const n = shape === 'round' ? 56 : shape === 'cloud' ? 90 : 26;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // superellipse (soft rectangle) — reads hand-drawn with the wobble, never a UI pill
    const e = 2.6;
    const k = 1 / Math.pow(Math.abs(c) ** e + Math.abs(s) ** e, 1 / e);
    let rx = hw * k;
    let ry = hh * k;
    const wob = 1 + 0.035 * noise1(i * 0.35, seed) + 0.015 * noise1(i * 1.3, seed + 3);
    if (shape === 'cloud') {
      // real scallops: round puffs meeting in sharp inward cusps (|sin| has cusps at the joins)
      const puffs = Math.max(7, Math.round((hw + hh) / 46));
      const bump = 1 + 0.2 * Math.abs(Math.sin(a * puffs + seed)) ** 0.7;
      rx *= bump * 0.94;
      ry *= bump * 0.9;
    }
    if (shape === 'burst') {
      const sp = i % 2 ? 1.22 : 0.92;
      rx *= sp;
      ry *= sp;
    }
    out.push([c * rx * wob, s * ry * wob]);
  }
  return out;
};

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  x,
  y,
  text,
  sub,
  tail,
  start = 0,
  exit,
  font = 'friendly',
  fontSize = 56,
  subSize,
  color = INK,
  fill = C.white,
  subColor,
  rotate = 0,
  shape = 'round',
  padX,
  padY,
  seed = 3,
  boil = 1,
  frame,
  style,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const lines = useMemo(() => text.split('\n'), [text]);
  const fam = FONT[font];
  const wgt = FONT_WEIGHT[font];
  const ss = subSize ?? Math.round(fontSize * 0.62);
  const widths = useTextWidths(lines, fam, fontSize, wgt);
  const subW = useTextWidths(sub ? [sub] : [], FONT.latin, ss, FONT_WEIGHT.latin);
  const b = useBoil({scale: 3 * boil, offset: seed + 20, frame: f, freq: 0.03});

  const lineH = fontSize * 1.32;
  const tw = Math.max(...(widths ?? [fontSize * 4]), ...(subW ?? [0]));
  const th = lines.length * lineH + (sub ? ss * 1.35 : 0);
  const px = padX ?? fontSize * 0.75;
  const py = padY ?? fontSize * 0.5;
  const hw = tw / 2 + px;
  const hh = th / 2 + py;

  const geo = useMemo(() => {
    const pts = outlinePts(hw, hh, shape, seed);
    let all = pts;
    let puffs = '';
    let puffsInk = '';
    if (tail && shape === 'cloud') {
      // a THOUGHT: two little puffs float towards the thinker instead of a pointed tail
      const tx = tail[0] - x;
      const ty = tail[1] - y;
      const L = Math.hypot(tx, ty) || 1;
      const ux = tx / L;
      const uy = ty / L;
      const edge = Math.min(Math.abs(hw / (ux || 1e-6)), Math.abs(hh / (uy || 1e-6)));
      [0.35, 0.72].forEach((t, i) => {
        const d = edge + (L - edge) * t;
        const rr = fontSize * (i ? 0.22 : 0.36);
        const c = outlinePts(rr, rr * 0.86, 'round', seed + 7 + i).map(([px2, py2]) => [px2 + ux * d, py2 + uy * d] as Pt);
        puffs += smoothD(c, true);
        puffsInk += brush(c, {w: 5, closed: true, dense: true, start: 0.3, seed: seed + 9 + i, shadow: 0.55, step: 3});
      });
    } else if (tail) {
      const tx = tail[0] - x;
      const ty = tail[1] - y;
      const ang = Math.atan2(ty, tx);
      // tail base: the two outline points around the direction of the target
      const n = pts.length;
      let bi = 0;
      let best = -1e9;
      pts.forEach(([px2, py2], i) => {
        const d = (px2 * Math.cos(ang) + py2 * Math.sin(ang)) / Math.hypot(px2, py2);
        if (d > best) {
          best = d;
          bi = i;
        }
      });
      const span = Math.max(2, Math.round(n * 0.045));
      const i0 = (bi - span + n) % n;
      const i1 = (bi + span) % n;
      const p0 = pts[i0];
      const p1 = pts[i1];
      const tip: Pt = [tx, ty];
      const mid0: Pt = [(p0[0] + tip[0]) / 2 + (tip[1] - p0[1]) * 0.12, (p0[1] + tip[1]) / 2 - (tip[0] - p0[0]) * 0.12];
      const mid1: Pt = [(p1[0] + tip[0]) / 2 + (tip[1] - p1[1]) * 0.18, (p1[1] + tip[1]) / 2 - (tip[0] - p1[0]) * 0.18];
      // splice the tail into the outline between i0 and i1
      const seq: Pt[] = [];
      let k = i1;
      while (k !== i0) {
        seq.push(pts[k]);
        k = (k + 1) % n;
      }
      seq.push(pts[i0]);
      all = [...seq, mid0, tip, mid1];
    }
    return {
      fill: smoothD(all, true) + puffs,
      ink: brush(all, {w: 7, closed: true, dense: true, start: 0.3, seed, shadow: 0.55, step: shape === 'cloud' ? 2.5 : 4}) + puffsInk,
      shade: smoothD(all.map(([a, c]) => [a + 7, c + 9] as Pt), true),
    };
  }, [hw, hh, shape, seed, tail, x, y, fontSize]);

  const p = exit !== undefined && f >= exit ? unpopOnTwos(f, exit) : popOnTwos(f, start);
  if (!p.visible || !widths) return null;
  // pivot = the tail tip side (bubble pops out of the speaker)
  const pivot: Pt = tail ? [(tail[0] - x) * 0.6, (tail[1] - y) * 0.6] : [0, hh];
  const r = rng(Math.floor(f / 2) * 7 + seed);
  const jitter = (r() - 0.5) * 0.8; // tiny re-drawn tilt on twos
  const pad = 80;
  const W = 2 * hw + 2 * pad;
  const H = 2 * hh + 2 * pad;
  const ext = tail ? Math.max(Math.abs(tail[0] - x) - hw, Math.abs(tail[1] - y) - hh, 0) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        transform: `rotate(${rotate + jitter}deg)`,
        ...style,
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: `${pivot[0]}px ${pivot[1]}px`, transform: `scale(${p.s * p.sx}, ${p.s * p.sy})`}}>
        <svg
          width={W + 2 * ext}
          height={H + 2 * ext}
          viewBox={`${-hw - pad - ext} ${-hh - pad - ext} ${W + 2 * ext} ${H + 2 * ext}`}
          style={{position: 'absolute', left: -hw - pad - ext, top: -hh - pad - ext, overflow: 'visible'}}
        >
          <defs>{b.def}</defs>
          <g filter={b.url}>
            <path d={geo.shade} fill={INK} opacity={0.22} />
            <path d={geo.fill} fill={fill} />
            <path d={geo.ink} fill={color} />
          </g>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: -hw,
            top: -th / 2 + fontSize * 0.05,
            width: 2 * hw,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {lines.map((l, i) => (
            <div key={i} style={{direction: isRtl(l) ? 'rtl' : 'ltr', fontFamily: fam, fontWeight: wgt, fontSize, lineHeight: `${lineH}px`, color}}>
              {l}
            </div>
          ))}
          {sub ? (
            <div style={{direction: 'ltr', fontFamily: FONT.latin, fontWeight: FONT_WEIGHT.latin, fontSize: ss, lineHeight: `${ss * 1.35}px`, color: subColor ?? color, opacity: 0.9}}>{sub}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

