// <VectorLine/> — one line of the spot's headline, drawn from HarfBuzz-shaped Lalezar outlines (same print as the
// big word: teal ink, misregistered plate, ink texture, boil on twos). Each WORD is pressed like a printing block ON
// TWOS (approach big + faint → wide wet impact → rebound → settle) — never letter by letter. A word can be un-pressed
// (exit), and the ق of «بالـ ق.» is drawn with the brand's two cream drops instead of its font dots and can HOP.
import React, {useId} from 'react';
import {CreamDropArt} from '../../kit/art/CreamDrop';
import {brush, Pt, rng} from '../../kit/geom';
import {useBoil} from '../../kit/look/Boil';
import {InkTextureFilter} from '../../kit/look/InkTexture';
import {C, INK} from '../../kit/palette';
import {GLYPHS, Run} from './glyphs';

const KEYS = [
  {s: 1.34, sx: 1, sy: 1, o: 0.4},
  {s: 1, sx: 1.1, sy: 0.88, o: 1},
  {s: 0.97, sx: 0.98, sy: 1.04, o: 1},
  {s: 1, sx: 1, sy: 1, o: 1},
];
const EXIT = [
  {s: 1.06, sx: 1.04, sy: 0.96, o: 1},
  {s: 0.7, sx: 0.8, sy: 1.2, o: 0.8},
  {s: 0.3, sx: 0.6, sy: 1.4, o: 0.4},
];

/** hop pose for a frame relative to a landing frame (crouch → air → land squash) */
export const hopPose = (t: number, height: number) => {
  // t = frame − land (on twos), airborne for 8 frames before landing, 3-frame crouch before take-off
  if (t < -11 || t > 10) return {y: 0, sx: 1, sy: 1};
  if (t < -8) return {y: 0, sx: 1.12, sy: 0.86}; // crouch (anticipation)
  if (t < 0) {
    const p = (t + 8) / 8;
    return {y: -4 * height * p * (1 - p), sx: 0.92, sy: 1.12};
  }
  const k = [{sx: 1.18, sy: 0.8}, {sx: 0.95, sy: 1.06}, {sx: 1.02, sy: 0.98}, {sx: 1, sy: 1}];
  const kk = k[Math.min(k.length - 1, Math.floor(t / 2))];
  return {y: 0, ...kk};
};

export type WordAnim = {start: number; exit?: number; hops?: number[]; hopH?: number};

export const VectorLine: React.FC<{
  run: Run;
  frame: number;
  cx: number;
  baseline: number;
  k: number;
  /** per word index (reading order, 0 = rightmost) */
  words: WordAnim[];
  /** glyph name whose dots are replaced by the brand drops */
  qafGlyph?: string;
  plate?: string;
  rotate?: number;
  /** progress of an ink scribble through word `strikeWord` (0..1) */
  strike?: number;
  strikeWord?: number;
}> = ({run, frame, cx, baseline, k, words, qafGlyph, plate = C.turquoiseDeep, rotate = 0, strike = 0, strikeWord = 0}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const f2 = Math.floor(frame / 2) * 2;
  const bInk = useBoil({scale: 2.6, offset: 91, frame, freq: 0.03});
  const bPlate = useBoil({scale: 2, offset: 93, frame, freq: 0.025});
  const x0 = cx - (run.width * k) / 2;
  const nWords = Math.max(...run.glyphs.map((g) => g.w)) + 1;
  // per-word bbox (font units) for pivots
  const boxes = Array.from({length: nWords}).map((_, w) => {
    const gs = run.glyphs.filter((g) => g.w === w);
    const xs = gs.flatMap((g) => [g.x + GLYPHS[g.g].bbox[0], g.x + GLYPHS[g.g].bbox[2]]);
    return {x0: Math.min(...xs), x1: Math.max(...xs)};
  });
  const wordEls = (layer: 'plate' | 'ink') =>
    Array.from({length: nWords}).map((_, w) => {
      const A = words[w] ?? {start: 0};
      const kk = Math.floor((f2 - A.start) / 2);
      if (kk < 0) return null;
      let key = KEYS[Math.min(kk, KEYS.length - 1)];
      if (A.exit !== undefined && f2 >= A.exit) {
        const e = Math.floor((f2 - A.exit) / 2);
        if (e >= EXIT.length) return null;
        key = EXIT[e];
      }
      const px = x0 + ((boxes[w].x0 + boxes[w].x1) / 2) * k;
      const py = baseline - 260 * k;
      let hy = 0;
      let hsx = 1;
      let hsy = 1;
      for (const h of A.hops ?? []) {
        const p = hopPose(f2 - h, A.hopH ?? 60);
        hy += p.y;
        hsx *= p.sx;
        hsy *= p.sy;
      }
      // settled words get a hair of tilt jitter on twos (the print boils)
      const r = rng(w * 31 + (kk >= 3 ? f2 : kk) * 7 + 3);
      const jit = kk >= 3 ? (r() - 0.5) * 0.8 : 0;
      const T = `translate(${px} ${baseline + hy}) rotate(${jit}) scale(${key.s * key.sx * hsx} ${key.s * key.sy * hsy}) translate(${-px} ${-baseline})`;
      void py;
      const gs = run.glyphs.filter((g) => g.w === w);
      return (
        <g key={w} transform={T} opacity={key.o}>
          {gs.map((g, i) => {
            const G = GLYPHS[g.g];
            const isQ = qafGlyph && g.g === qafGlyph;
            const d = isQ ? (G.body as string) : G.d;
            return <path key={i} d={d} transform={`translate(${x0 + g.x * k} ${baseline + g.y * k}) scale(${k} ${-k})`} fill={layer === 'plate' ? plate : INK} />;
          })}
          {layer === 'ink'
            ? gs
                .filter((g) => qafGlyph && g.g === qafGlyph)
                .map((g, i) => {
                  const G = GLYPHS[g.g];
                  const db = G.dotsBox as [number, number, number, number];
                  const h = (db[3] - db[1]) * 1.25;
                  const cxq = (db[0] + db[2]) / 2;
                  return (
                    <g key={`dr${i}`}>
                      {[0, 1].map((j) => {
                        // the drops hop a beat after the letter (secondary action)
                        let dy = 0;
                        let st = 0;
                        for (const hp of A.hops ?? []) {
                          const p = hopPose(f2 - hp - 2 - j * 2, (A.hopH ?? 60) * 0.5);
                          dy += p.y;
                          st += p.sy - 1;
                        }
                        const bx = x0 + (g.x + cxq + (j ? 72 : -78)) * k;
                        const by = baseline + (db[3] + (j ? -14 : 0)) * k + dy;
                        return (
                          <g key={j} transform={`translate(${bx} ${by})`}>
                            <CreamDropArt h={h * k} which={j as 0 | 1} rot={j ? 6 : -8} stretch={Math.max(0, st)} squash={Math.max(0, -st)} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })
            : null}
        </g>
      );
    });

  // strike-through scribble (a quick zig-zag of ink across the word), drawn on as `strike` goes 0 → 1
  let scribble: string | null = null;
  if (strike > 0 && boxes[strikeWord]) {
    const b = boxes[strikeWord];
    const xa = x0 + b.x1 * k + 18;
    const xb = x0 + b.x0 * k - 18;
    const r = rng(77);
    const pts: Pt[] = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([xa + (xb - xa) * t + (r() - 0.5) * 20, baseline - 300 * k + (i % 2 ? -90 : 90) * k + (r() - 0.5) * 30 * k]);
    }
    const m = Math.max(2, Math.ceil(strike * pts.length));
    scribble = brush(pts.slice(0, m), {w: 26 * k * 3, taper: [0.08, 0.2], tip: 0.3, seed: 12});
  }

  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        {bInk.def}
        {bPlate.def}
        <InkTextureFilter id={`vt${uid}`} seed={400 + (f2 / 2) * 3} warp={2.2} grain={13} pin={15} />
      </defs>
      <g transform={`rotate(${rotate} ${cx} ${baseline})`}>
        <g filter={bPlate.url} transform="translate(6 5)">
          {wordEls('plate')}
        </g>
        <g filter={bInk.url}>
          <g filter={`url(#vt${uid})`}>{wordEls('ink')}</g>
        </g>
        {scribble ? <path d={scribble} fill={C.chili} filter={bInk.url} /> : null}
      </g>
    </svg>
  );
};
