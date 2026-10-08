// <QafWord/> — the hero type: «قشطة» as HarfBuzz-shaped Lalezar outlines (parts/glyphs.ts), printed in teal ink with
// a misregistered riso plate, ink-texture and boil on twos. The ق is its own object (it gets flicked off, comes back
// like a boomerang); its font dots are replaced by the brand's two cream DROPS (the logo's ق dots, CreamDropArt), so
// the word reads «قشطة» while its dots are literally qashta. Without the ق, the ش is drawn MEDIAL (a dangling join)
// until `shin = 'initial'` re-shapes it into a clean «شطة». Joins are never broken: glyphs stay where HarfBuzz put them.
//
// Everything is in WORLD px inside one <svg> (overflow visible). Props are pure state; the scene animates them.
import React, {useId} from 'react';
import {brush, ellipsePts, Pt, rng} from '../../kit/geom';
import {useBoil} from '../../kit/look/Boil';
import {InkTextureFilter} from '../../kit/look/InkTexture';
import {C, INK} from '../../kit/palette';
import {CreamDropArt} from '../../kit/art/CreamDrop';
import {FlameArt} from '../../kit/art/Flame2D';
import {GLYPHS, RUNS} from './glyphs';

export const QASHTA = RUNS.qashta;
const QAF_I = 3; // index of the ق in the run (visual order: ة ط ش ق)
const SHIN_I = 2;

/** world-space helpers for a word drawn at (cx, baseline, k) */
export const wordGeom = (cx: number, baseline: number, k: number) => {
  const x0 = cx - (QASHTA.width * k) / 2;
  const at = (ux: number, uy: number): Pt => [x0 + ux * k, baseline + uy * k];
  const q = QASHTA.glyphs[QAF_I];
  const qb = GLYPHS[q.g].bbox;
  // the ق pivot: centre of its loop (body bbox centre, a bit low)
  const qafPivot = at(q.x + (qb[0] + qb[2]) / 2 + 20, (qb[1] + qb[3]) / 2 + 30);
  return {x0, at, qafPivot, width: QASHTA.width * k};
};

// the two drops replacing the ق's font dots (font units, relative to the ق glyph origin): base centre + height
export const QAF_DROPS = [
  {x: 86, y: -408, h: 184, which: 0 as const, rot: -8},
  {x: 226, y: -424, h: 184, which: 1 as const, rot: 6},
];

// flames on the letters (run units): on ش's top dot, the ط's stem, the ة's dots — reading order (right → left)
export const WORD_FLAMES = [
  {ux: 979 + 367, uy: -650, h: 150, seed: 4},
  {ux: 449 + 214, uy: -560, h: 190, seed: 5},
  {ux: 191, uy: -650, h: 135, seed: 6},
];

export type DropState = {show: boolean; dx?: number; dy?: number; stretch?: number; squash?: number; rot?: number};
export type QafState = {show: boolean; dx?: number; dy?: number; rot?: number; s?: number; sx?: number; sy?: number};

export type QafWordProps = {
  frame: number;
  cx: number;
  baseline: number;
  k: number;
  qaf: QafState;
  /** drops in their own space: dx/dy are OFFSETS from their home on the ق (world px), applied after the ق transform
   *  when attached (attached = they ride with the ق), or from home without it when `free` */
  drops: [DropState, DropState];
  dropsFree?: boolean;
  shin: 'medial' | 'initial';
  /** 0..1 glowing heat rim around the letters */
  burn?: number;
  /** flame scale per WORD_FLAMES entry (0 = none) */
  flames?: number[];
  /** riso plate colour (behind the ink, offset) */
  plate?: string;
  /** whole-word squash on twos (impact) and a shake offset */
  squash?: number;
  shake?: Pt;
  /** sparks at the ق on impact (0..1 progress) */
  sparks?: number;
  boil?: number;
  /** draw only the ق (onion-skin ghosts of the flying letter) */
  onlyQaf?: boolean;
};

const Sparks: React.FC<{at: Pt; t: number; seed: number; size: number}> = ({at, t, seed, size}) => {
  if (t <= 0 || t >= 1) return null;
  const r = rng(seed);
  const rays = Array.from({length: 9}).map((_, i) => {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 1.25 + (r() - 0.5) * 0.25;
    const d0 = size * (0.35 + t * 0.9);
    const d1 = d0 + size * (0.5 - t * 0.35) * (0.7 + r() * 0.6);
    return brush(
      [
        [at[0] + Math.cos(a) * d0, at[1] + Math.sin(a) * d0],
        [at[0] + Math.cos(a) * d1, at[1] + Math.sin(a) * d1],
      ],
      {w: size * 0.09 * (1 - t * 0.6), taper: [0.1, 0.6], tip: 0.1, seed: seed + i},
    );
  });
  return <path d={rays.join('')} fill={INK} />;
};

export const QafWord: React.FC<QafWordProps> = ({
  frame,
  cx,
  baseline,
  k,
  qaf,
  drops,
  dropsFree = false,
  shin,
  burn = 0,
  flames = [0, 0, 0],
  plate = C.turquoiseDeep,
  squash = 0,
  shake = [0, 0],
  sparks = 0,
  boil = 1,
  onlyQaf = false,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const f2 = Math.floor(frame / 2);
  const G = wordGeom(cx, baseline, k);
  const bInk = useBoil({scale: 3.2 * boil, offset: 81, frame, freq: 0.03});
  const bPlate = useBoil({scale: 2.4 * boil, offset: 83, frame, freq: 0.025});
  const glyphs = QASHTA.glyphs.map((g, i) => (i === SHIN_I && shin === 'initial' ? {...g, g: 'uniFEB7'} : g));
  const q = glyphs[QAF_I];
  const qd = GLYPHS[q.g].body as string; // the ق without its font dots (the drops are drawn instead)
  const [px, py] = G.qafPivot;
  const qT = `translate(${px + (qaf.dx ?? 0)} ${py + (qaf.dy ?? 0)}) rotate(${qaf.rot ?? 0}) scale(${(qaf.s ?? 1) * (qaf.sx ?? 1)} ${(qaf.s ?? 1) * (qaf.sy ?? 1)}) translate(${-px} ${-py})`;
  const wordT = `translate(${shake[0]} ${shake[1]}) translate(${cx} ${baseline}) scale(${1 + 0.6 * squash} ${1 - squash}) translate(${-cx} ${-baseline})`;
  const glyphT = (x: number) => `translate(${G.x0 + x * k} ${baseline}) scale(${k} ${-k})`;

  // drops (world px): home = on the ق, in ق-glyph space
  const dropEls = drops.map((d, i) => {
    if (!d.show) return null;
    const D = QAF_DROPS[i];
    const home = G.at(q.x + D.x, D.y);
    const el = (
      <g key={i} transform={`translate(${home[0] + (d.dx ?? 0)} ${home[1] + (d.dy ?? 0)})`}>
        <CreamDropArt h={D.h * k} which={D.which} rot={D.rot + (d.rot ?? 0)} stretch={d.stretch ?? 0} squash={d.squash ?? 0} />
      </g>
    );
    return el;
  });

  const paths = (fill: string, which: 'rest' | 'qaf') =>
    which === 'rest'
      ? glyphs.map((g, i) => (i === QAF_I ? null : <path key={i} d={GLYPHS[g.g].d} transform={glyphT(g.x)} fill={fill} />))
      : [<path key="q" d={qd} transform={glyphT(q.x)} fill={fill} />];

  const heatRim = (which: 'rest' | 'qaf') =>
    burn > 0
      ? glyphs.map((g, i) =>
          (which === 'qaf') === (i === QAF_I) ? (
            <path
              key={`h${i}`}
              d={i === QAF_I ? qd : GLYPHS[g.g].d}
              transform={glyphT(g.x)}
              fill={C.flameYellow}
              stroke={C.flameYellow}
              strokeWidth={70 * burn}
              strokeLinejoin="round"
            />
          ) : null,
        )
      : null;
  const heatRim2 = (which: 'rest' | 'qaf') =>
    burn > 0
      ? glyphs.map((g, i) =>
          (which === 'qaf') === (i === QAF_I) ? (
            <path key={`o${i}`} d={i === QAF_I ? qd : GLYPHS[g.g].d} transform={glyphT(g.x)} fill={C.flameOrange} stroke={C.flameOrange} strokeWidth={38 * burn} strokeLinejoin="round" />
          ) : null,
        )
      : null;

  const ink = (which: 'rest' | 'qaf') => (
    <g>
      <g filter={bPlate.url} transform="translate(7 6)" opacity={0.95}>
        {paths(plate, which)}
      </g>
      <g filter={bInk.url}>
        {heatRim(which)}
        {heatRim2(which)}
        <g filter={`url(#tex${uid})`}>{paths(INK, which)}</g>
      </g>
    </g>
  );

  const qafCentreWorld: Pt = [px + (qaf.dx ?? 0), py + (qaf.dy ?? 0)];
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        {bInk.def}
        {bPlate.def}
        <InkTextureFilter id={`tex${uid}`} seed={200 + f2 * 3} warp={2.5} grain={13} pin={15} />
      </defs>
      <g transform={wordT}>
        {onlyQaf ? null : ink('rest')}
        {flames.map((s, i) => {
          if (s <= 0.01) return null;
          const F = WORD_FLAMES[i];
          const p = G.at(F.ux, F.uy);
          return (
            <g key={i} transform={`translate(${p[0]} ${p[1]}) scale(${s})`}>
              <FlameArt h={F.h * k * 2.9} seed={F.seed} frame={frame} />
            </g>
          );
        })}
        {qaf.show ? (
          <g transform={qT}>
            {ink('qaf')}
            {!dropsFree ? dropEls : null}
          </g>
        ) : null}
        {dropsFree ? dropEls : null}
        <Sparks at={[qafCentreWorld[0] + 30, qafCentreWorld[1] + 40]} t={sparks} seed={7 + f2} size={150 * k * 3} />
      </g>
    </svg>
  );
};

/** A smoke puff (blown-out flame): three inked cloud balls rising and fading over `life` frames (on twos). */
export const Puff: React.FC<{x: number; y: number; t: number; size: number; seed?: number}> = ({x, y, t, size, seed = 1}) => {
  if (t < 0 || t > 1) return null;
  const r = rng(seed);
  const balls = [0, 1, 2].map((i) => {
    const bx = x + (r() - 0.5) * size * 0.9 + (i - 1) * size * 0.35;
    const by = y - t * size * (0.9 + i * 0.3) - i * size * 0.2;
    const rr = size * (0.22 + 0.2 * t) * (1 - i * 0.18);
    return ellipsePts(bx, by, rr, rr * 0.92, 18);
  });
  const op = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  return (
    <g opacity={op}>
      {balls.map((b, i) => (
        <g key={i}>
          <path d={`M${b.map((p) => p.join(' ')).join('L')}Z`} fill={i === 0 ? '#D9E2E0' : '#EEF2F0'} />
          <path d={brush(b, {w: Math.max(2, size * 0.04), closed: true, dense: true, seed: seed + i})} fill={INK} opacity={0.85} />
        </g>
      ))}
    </g>
  );
};
