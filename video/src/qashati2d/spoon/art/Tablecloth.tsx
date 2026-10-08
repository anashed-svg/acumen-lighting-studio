// The family table, seen from above: a block-printed cotton tablecloth (the sufra cloth of every Levantine/Gulf
// home) — cream ground, a hand-stamped rosette grid in two faded inks (teal-green + pomegranate), misregistered
// like a block print (the second ink a hair off), ironed fold creases, a halftone darkening towards the edges.
// It is the SET: it does not boil (stop-motion sets stand still; the paper grain on top re-photographs on twos).
// World units (spot world px). Static geometry, built once.
import React from 'react';
import {blobPts, brush, C, ellipsePts, Halftone, Pt, rng, shapeD} from '../../kit/lib';

const X0 = -420;
const Y0 = -620;
const CW = 1900;
const CH = 3100;

type ClothArt = {petals: string; centres: string; dots: string; creaseDark: string; creaseLight: string; stitch: string};
let cached: ClothArt | null = null;

const build = (): ClothArt => {
  const r = rng(4711);
  const ang = (11 * Math.PI) / 180;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const step = 190;
  let petals = '';
  let centres = '';
  let dots = '';
  for (let j = -2; j < CH / step + 3; j++) {
    for (let i = -3; i < CW / step + 3; i++) {
      const u = i * step + (j % 2 ? step / 2 : 0);
      const v = j * step * 0.88;
      const x = X0 + u * ca - v * sa + 120;
      const y = Y0 + u * sa + v * ca;
      if (x < X0 - 80 || x > X0 + CW + 80 || y < Y0 - 80 || y > Y0 + CH + 80) continue;
      // a stamped rosette: 8 petals (each its own brush stroke: the block print never inks evenly)
      const rot = r() * 0.3;
      for (let k = 0; k < 8; k++) {
        const a = rot + (k / 8) * Math.PI * 2;
        const p0: Pt = [x + Math.cos(a) * 12, y + Math.sin(a) * 12];
        const p1: Pt = [x + Math.cos(a + 0.08) * 34, y + Math.sin(a + 0.08) * 34];
        const p2: Pt = [x + Math.cos(a) * 48, y + Math.sin(a) * 48];
        petals += brush([p0, p1, p2], {w: 15 + r() * 4, taper: [0.25, 0.7], tip: 0.15, jitter: 0.3, seed: i * 31 + j * 7 + k});
      }
      centres += shapeD(blobPts(x + 2.5, y + 2, 9, 9, 0.2, i * 13 + j, 10, 2), 4);
      // between rosettes: a four-dot cluster
      const mx = x + step * 0.5 * ca;
      const my = y + step * 0.5 * sa + step * 0.44;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        dots += shapeD(blobPts(mx + Math.cos(a) * 13, my + Math.sin(a) * 13, 5.5, 5.5, 0.25, i * 17 + j * 3 + k, 8, 2), 3);
      }
    }
  }
  // ironed fold creases: a dark line with a light line beside it (a valley and its lit lip)
  let creaseDark = '';
  let creaseLight = '';
  const crease = (a: Pt, b: Pt, seed: number) => {
    const mid: Pt = [(a[0] + b[0]) / 2 + (r() - 0.5) * 30, (a[1] + b[1]) / 2 + (r() - 0.5) * 30];
    creaseDark += brush([a, mid, b], {w: 4, taper: [0.08, 0.08], tip: 0.3, jitter: 0.5, jitterLen: 120, seed});
    creaseLight += brush(
      [a, mid, b].map(([x, y]) => [x - 5, y - 6] as Pt),
      {w: 5, taper: [0.08, 0.08], tip: 0.3, jitter: 0.5, jitterLen: 120, seed: seed + 1},
    );
  };
  // only the two main folds of a cloth that was folded in four (more read as floor tiles)
  crease([X0 + 1010, Y0], [X0 + 1060, Y0 + CH], 901);
  crease([X0, Y0 + 1660], [X0 + CW, Y0 + 1590], 951);
  // a running stitch of a hem far away (only visible on the widest frames)
  const hem = ellipsePts(560, 880, 1180, 1500, 120);
  const stitch = hem
    .filter((_, i) => i % 2 === 0)
    .map(([x, y]) => shapeD(blobPts(x, y, 7, 3, 0.2, Math.round(x * y) % 997, 8, 2), 3))
    .join('');
  return {petals, centres, dots, creaseDark, creaseLight, stitch};
};
const getCloth = () => (cached ??= build());

export const Tablecloth: React.FC = () => {
  const A = getCloth();
  return (
    <svg width={CW} height={CH} viewBox={`${X0} ${Y0} ${CW} ${CH}`} style={{position: 'absolute', left: X0, top: Y0, overflow: 'visible'}}>
      <rect x={X0} y={Y0} width={CW} height={CH} fill="#F2E3C4" />
      {/* the block-print inks: colour plate a hair off the key plate (printed by hand) */}
      <path d={A.petals} fill="#86BFB0" opacity={0.36} />
      <path d={A.petals} fill="#3E8E80" opacity={0.14} transform="translate(-3 -2)" />
      <path d={A.centres} fill="#D9645A" opacity={0.42} />
      <path d={A.dots} fill="#C9A86E" opacity={0.55} />
      <path d={A.stitch} fill="#C9A86E" opacity={0.6} />
      <path d={A.creaseLight} fill={C.white} opacity={0.32} />
      <path d={A.creaseDark} fill="#8C7451" opacity={0.22} />
      {/* the cloth falls into shade towards the edges of the table (halftone, never a smooth gradient) */}
      <Halftone
        box={[X0, Y0, CW, CH]}
        cell={13}
        angle={20}
        fill="#B79A6B"
        opacity={0.5}
        tone={[{t: 'rad', cx: 560, cy: 880, r0: 640, r1: 1300, a: 0, b: 1, sx: 1, sy: 1.35}, {t: 'noise', amp: 0.2, freq: 0.006, seed: 11}]}
      />
    </svg>
  );
};
