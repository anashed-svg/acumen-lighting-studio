// <FlickHand/> — the narrator's hand that flicks the ق off «قشطة» («طقّة»): a right hand in a white kandura sleeve,
// side view, thumb pad holding the curled index finger's nail (the classic flick), then RELEASE (smear drawing with
// speed lines) → finger snapped out with a little hyper-extension. Drawn, not traced: variable-weight teal ink, cel
// shade + a halftone core shadow, knuckle creases, a nail with a highlight. Poses are drawings (switch on twos).
//
// Local art space: the index finger's knuckle (MCP) is (0, 0); fingers point UP (−y); the forearm runs DOWN-RIGHT
// and keeps going for ≈ 2600 units, so at any angle the arm LEAVES the frame (never a floating stump).
// STRIKE = the point the nail hits on release (aim it at the target).
import React, {useMemo} from 'react';
import {brush, catmull, ellipsePts, Pt, resample, shapeD, smoothD} from '../../kit/geom';
import {Halftone} from '../../kit/look/Halftone';
import {useBoil} from '../../kit/look/Boil';
import {C, INK} from '../../kit/palette';

export type FlickPose = 'cocked' | 'smear' | 'flicked' | 'relaxed';
/** the cocked nail (aim it just under the target) */
export const NAIL_COCKED: Pt = [-106, -60];

const SKIN = C.skin[2];
const SKIN_SHADE = C.skinShade[2];
const SKIN_LIT = '#E7B58A';
const NAIL = '#F6D9C8';

/** outline of a finger/thumb: a spine with per-point radii, round caps (closed polygon, dense). */
const capsule = (spine: Pt[], radii: number[], seg = 8): Pt[] => {
  const dense = catmull(spine, false, seg);
  const n = dense.length;
  const rAt = (i: number) => {
    const t = (i / (n - 1)) * (radii.length - 1);
    const a = Math.floor(t);
    const b = Math.min(radii.length - 1, a + 1);
    return radii[a] + (radii[b] - radii[a]) * (t - a);
  };
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = dense[Math.max(0, i - 1)];
    const q = dense[Math.min(n - 1, i + 1)];
    const tx = q[0] - p[0];
    const ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1;
    const r = rAt(i);
    left.push([dense[i][0] - (ty / tl) * r, dense[i][1] + (tx / tl) * r]);
    right.push([dense[i][0] + (ty / tl) * r, dense[i][1] - (tx / tl) * r]);
  }
  // round cap at the tip
  const end = dense[n - 1];
  const prev = dense[n - 2];
  const a0 = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const rEnd = rAt(n - 1);
  const cap: Pt[] = [];
  for (let k = 1; k < 10; k++) {
    const a = a0 + Math.PI / 2 - (k / 10) * Math.PI;
    cap.push([end[0] + Math.cos(a) * rEnd, end[1] + Math.sin(a) * rEnd]);
  }
  return [...left, ...cap, ...right.reverse()];
};

type Finger = {spine: Pt[]; radii: number[]};
type Pose = {index: Finger; thumb: Finger; nailAt: number};

const POSES: Record<FlickPose, Pose> = {
  cocked: {
    // index curled up and over, its nail tucked behind the thumb pad (the loaded flick)
    index: {spine: [[-30, -46], [-60, -92], [-94, -98], [-108, -70], [-100, -46]], radii: [23, 22, 21, 20, 19]},
    // thumb across in front of it, pressing (tension)
    thumb: {spine: [[10, 26], [-28, -2], [-66, -26], [-92, -40]], radii: [27, 24, 21, 19]},
    nailAt: 0.9,
  },
  smear: {
    index: {spine: [[-30, -46], [-66, -108], [-100, -150], [-122, -170]], radii: [23, 20, 16, 12]},
    thumb: {spine: [[10, 26], [-32, -4], [-72, -22], [-98, -28]], radii: [27, 24, 21, 19]},
    nailAt: 0.92,
  },
  flicked: {
    // snapped out and over-shot forward (a diagonal follow-through — never a raised, held index finger)
    index: {spine: [[-30, -46], [-34, -108], [-8, -160], [26, -186]], radii: [23, 22, 20, 18]},
    thumb: {spine: [[10, 26], [-32, -6], [-72, -22], [-100, -24]], radii: [27, 24, 21, 19]},
    nailAt: 0.9,
  },
  relaxed: {
    // after the flick the hand goes loose as it withdraws (finger half curled)
    index: {spine: [[-30, -46], [-58, -96], [-92, -112], [-112, -94]], radii: [23, 22, 21, 19]},
    thumb: {spine: [[10, 26], [-30, -4], [-70, -24], [-96, -34]], radii: [27, 24, 21, 19]},
    nailAt: 0.9,
  },
};

const pointAt = (spine: Pt[], t: number): [Pt, Pt] => {
  const d = resample(catmull(spine, false, 10), 2, false);
  const i = Math.max(1, Math.min(d.length - 1, Math.round(t * (d.length - 1))));
  return [d[i], [d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]]];
};

type Geo = {
  fist: string;
  fistInk: string;
  fistShade: string;
  curls: {d: string; ink: string}[];
  creases: string;
  index: {d: string; shade: string; ink: string; nail: string; nailInk: string; nailHi: string; crease: string};
  thumb: {d: string; shade: string; ink: string; nail: string; nailInk: string; nailHi: string};
  sleeve: string;
  sleeveShade: string;
  sleeveInk: string;
  cuff: string;
  cuffInk: string;
  folds: string;
  speed: string;
};

const ARM_DIR: Pt = [Math.sin(0.36), Math.cos(0.36)]; // down-right (out of the frame's right edge)
const ARM_LEN = 2600;

const fingerArt = (fg: Finger, nailAt: number, seed: number) => {
  const out = capsule(fg.spine, fg.radii);
  const shadePts = capsule(
    fg.spine.map(([x, y]) => [x + 5, y + 6] as Pt),
    fg.radii.map((r) => r * 0.7),
  );
  const [p, t] = pointAt(fg.spine, nailAt);
  const ang = Math.atan2(t[1], t[0]);
  const r = fg.radii[fg.radii.length - 1];
  // the nail sits on the back of the finger (the −normal side), slightly towards the tip
  const nx = Math.sin(ang);
  const ny = -Math.cos(ang);
  const nc: Pt = [p[0] + nx * r * 0.42, p[1] + ny * r * 0.42];
  const nail = ellipsePts(nc[0], nc[1], r * 0.62, r * 0.42, 20, 0, Math.PI * 2, ang);
  const nailHi = ellipsePts(nc[0] - Math.cos(ang) * 2, nc[1] - Math.sin(ang) * 2, r * 0.42, r * 0.2, 10, Math.PI * 1.1, Math.PI * 1.7, ang);
  return {
    d: smoothD(out, true),
    shade: smoothD(shadePts, true),
    ink: brush(out, {w: 7, closed: true, dense: true, start: 0.55, seed, shadowDir: [0.5, 0.86], shadow: 0.7}),
    nail: smoothD(nail, true),
    nailInk: brush(nail, {w: 3.2, closed: true, dense: true, seed: seed + 1}),
    nailHi: brush(nailHi, {w: 3.6, dense: true, taper: [0.3, 0.3], seed: seed + 2}),
  };
};

const buildGeo = (pose: FlickPose): Geo => {
  const P = POSES[pose];
  // fist: the back of the hand + the palm mass (side view, palm to the left), the three curled fingers stacked on
  // its palm side
  const fistPts = catmull(
    [[-44, -50], [0, -64], [46, -54], [70, -16], [76, 34], [64, 80], [30, 100], [-22, 96], [-52, 66], [-56, 10]],
    true,
    8,
  );
  const fistShadePts = catmull([[50, -40], [72, -4], [76, 40], [62, 82], [30, 98], [8, 94], [40, 60], [52, 10]], true, 8);
  const curls = [
    {c: [[-18, -30], [-60, -26], [-72, -2], [-40, 6]], r: [19, 19, 18, 18]},
    {c: [[-18, 10], [-60, 14], [-70, 36], [-38, 42]], r: [18, 18, 17, 17]},
    {c: [[-16, 46], [-54, 52], [-60, 70], [-32, 76]], r: [16, 16, 15, 15]},
  ].map((k, i) => {
    const o = capsule(k.c as Pt[], k.r, 6);
    return {d: smoothD(o, true), ink: brush(o, {w: 5, closed: true, dense: true, start: 0.3, seed: 70 + i})};
  });
  const creases = [
    brush([[14, -46], [28, -50], [42, -44]], {w: 3, taper: [0.4, 0.4], seed: 81}),
    brush([[38, 8], [50, 2], [62, 8]], {w: 2.8, taper: [0.4, 0.4], seed: 82}),
  ].join('');

  // sleeve: from the wrist straight down (slightly flaring), very long so it always leaves the frame
  const wr: Pt = [12, 92];
  const nrm: Pt = [-ARM_DIR[1], ARM_DIR[0]];
  const hw0 = 70;
  const hw1 = 86;
  const pts: Pt[] = [];
  const back: Pt[] = [];
  const shadeStrip: Pt[] = [];
  const shadeBack: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const along = -6 + t * ARM_LEN;
    const hw = hw0 + (hw1 - hw0) * Math.min(1, t * 8);
    const cx = wr[0] + ARM_DIR[0] * along;
    const cy = wr[1] + ARM_DIR[1] * along;
    pts.push([cx + nrm[0] * hw, cy + nrm[1] * hw]);
    back.push([cx - nrm[0] * hw, cy - nrm[1] * hw]);
    shadeStrip.push([cx - nrm[0] * hw, cy - nrm[1] * hw]);
    shadeBack.push([cx - nrm[0] * hw * 0.3, cy - nrm[1] * hw * 0.3]);
  }
  const sleevePts = [...pts, ...back.reverse()];
  const cuffC: Pt = [wr[0] + ARM_DIR[0] * 22, wr[1] + ARM_DIR[1] * 22];
  const cuffPts: Pt[] = [
    [cuffC[0] + nrm[0] * 76 - ARM_DIR[0] * 22, cuffC[1] + nrm[1] * 76 - ARM_DIR[1] * 22],
    [cuffC[0] + nrm[0] * 78 + ARM_DIR[0] * 22, cuffC[1] + nrm[1] * 78 + ARM_DIR[1] * 22],
    [cuffC[0] - nrm[0] * 78 + ARM_DIR[0] * 22, cuffC[1] - nrm[1] * 78 + ARM_DIR[1] * 22],
    [cuffC[0] - nrm[0] * 76 - ARM_DIR[0] * 22, cuffC[1] - nrm[1] * 76 - ARM_DIR[1] * 22],
  ];
  const fold = (o: number, a: number, b: number, sd: number) => {
    const p0: Pt = [wr[0] + ARM_DIR[0] * a + nrm[0] * o, wr[1] + ARM_DIR[1] * a + nrm[1] * o];
    const p1: Pt = [wr[0] + ARM_DIR[0] * b + nrm[0] * (o * 0.6), wr[1] + ARM_DIR[1] * b + nrm[1] * (o * 0.6)];
    const m: Pt = [(p0[0] + p1[0]) / 2 + nrm[0] * 8, (p0[1] + p1[1]) / 2 + nrm[1] * 8];
    return brush([p0, m, p1], {w: 4.4, taper: [0.3, 0.5], seed: sd});
  };
  const idx = fingerArt(P.index, P.nailAt, 11);
  const th = fingerArt(P.thumb, 0.9, 21);
  // index knuckle crease
  const [kp, kt] = pointAt(P.index.spine, 0.42);
  const ka = Math.atan2(kt[1], kt[0]);
  const crease = brush(
    [
      [kp[0] + Math.sin(ka) * 6 - Math.cos(ka) * 4, kp[1] - Math.cos(ka) * 6 - Math.sin(ka) * 4],
      [kp[0] + Math.sin(ka) * 18, kp[1] - Math.cos(ka) * 18],
    ],
    {w: 3.2, taper: [0.4, 0.4], seed: 91},
  );
  // speed lines for the smear drawing: arcs following the fingertip's path
  const speed =
    pose === 'smear'
      ? [0, 1, 2]
          .map((i) => {
            const r = 150 + i * 28;
            const arc = ellipsePts(-20, -40, r, r, 10, Math.PI * (1.12 + i * 0.03), Math.PI * (1.5 - i * 0.02));
            return brush(arc, {w: 6 - i * 1.2, taper: [0.6, 0.2], tip: 0.05, dense: true, seed: 95 + i});
          })
          .join('')
      : '';
  return {
    fist: smoothD(fistPts, true),
    fistShade: smoothD(fistShadePts, true),
    fistInk: brush(fistPts, {w: 7.5, closed: true, dense: true, start: 0.05, seed: 61, shadowDir: [0.6, 0.8], shadow: 0.7}),
    curls,
    creases,
    index: {...idx, crease},
    thumb: th,
    sleeve: smoothD(sleevePts, true),
    sleeveShade: smoothD([...shadeStrip, ...shadeBack.reverse()], true),
    sleeveInk: brush(sleevePts, {w: 8, closed: true, dense: false, start: 0.5, seed: 62}),
    cuff: shapeD(cuffPts, 4),
    cuffInk: brush(catmull(cuffPts, true, 4), {w: 6, closed: true, dense: true, seed: 63}),
    folds: [fold(36, 80, 380, 64), fold(-30, 170, 520, 65), fold(8, 460, 860, 66)].join(''),
    speed,
  };
};

const CACHE: Partial<Record<FlickPose, Geo>> = {};
const geo = (p: FlickPose) => (CACHE[p] ??= buildGeo(p));

export const FlickHandArt: React.FC<{pose: FlickPose; squeeze?: number; frame: number; boil?: number}> = ({pose, squeeze = 0, frame, boil = 1}) => {
  const G = useMemo(() => geo(pose), [pose]);
  const bH = useBoil({scale: 2.6 * boil, offset: 71, frame, freq: 0.024});
  const bS = useBoil({scale: 3 * boil, offset: 72, frame, freq: 0.02});
  // tension: the index finger bulges a hair, the thumb presses (squeeze 0..1)
  const sq = 1 + 0.05 * squeeze;
  return (
    <g>
      {/* soft cast shadow on the paper (light from the upper left) */}
      <g transform="translate(22 30)" opacity={0.18}>
        <path d={G.sleeve} fill={INK} />
        <path d={G.fist} fill={INK} />
        <path d={G.index.d} fill={INK} />
      </g>
      <g filter={bS.url}>
        <path d={G.sleeve} fill="#DCE3E0" />
        <path d={G.sleeve} fill="#FBFBF6" transform="translate(-10 -6)" />
        <path d={G.sleeveShade} fill="#C9D4D1" opacity={0.85} />
        <path d={G.folds} fill={INK} opacity={0.5} />
        <path d={G.sleeveInk} fill={INK} />
      </g>
      <defs>{bH.def}{bS.def}</defs>
      <g filter={bH.url}>
        {/* fist */}
        <path d={G.fist} fill={SKIN_SHADE} />
        <path d={G.fist} fill={SKIN} transform="translate(-8 -8) scale(0.97)" />
        <path d={G.fistShade} fill={SKIN_SHADE} opacity={0.9} />
        <clipPath id="fhFist">
          <path d={G.fist} />
        </clipPath>
        <Halftone box={[-60, -70, 140, 175]} cell={7} angle={25} fill={'#B67C4F'} opacity={0.5} tone={[{t: 'rad', cx: 76, cy: 96, r0: 20, r1: 120, a: 1, b: 0}]} clipPath="url(#fhFist)" />
        <path d={G.creases} fill={INK} opacity={0.75} />
        {G.curls.map((c, i) => (
          <g key={i}>
            <path d={c.d} fill={i === 2 ? SKIN_SHADE : SKIN} />
            <path d={c.ink} fill={INK} />
          </g>
        ))}
        <path d={G.fistInk} fill={INK} />
        {/* index finger (behind the thumb in the cocked pose) */}
        <g transform={`translate(-4 -2) scale(${sq})`}>
          <path d={G.index.d} fill={SKIN_SHADE} />
          <path d={G.index.d} fill={SKIN} transform="translate(-5 -5) scale(0.98)" />
          <path d={G.index.shade} fill={SKIN_SHADE} opacity={0.55} />
          <path d={G.index.crease} fill={INK} opacity={0.7} />
          <path d={G.index.nail} fill={NAIL} />
          <path d={G.index.nailHi} fill={C.white} opacity={0.9} />
          <path d={G.index.nailInk} fill={INK} opacity={0.85} />
          <path d={G.index.ink} fill={INK} />
        </g>
        {/* thumb */}
        <g transform={`translate(${-3 * squeeze} ${-3 * squeeze})`}>
          <path d={G.thumb.d} fill={SKIN_SHADE} />
          <path d={G.thumb.d} fill={SKIN_LIT} transform="translate(-4 -6) scale(0.98)" />
          <path d={G.thumb.shade} fill={SKIN_SHADE} opacity={0.5} />
          <path d={G.thumb.nail} fill={NAIL} />
          <path d={G.thumb.nailHi} fill={C.white} opacity={0.85} />
          <path d={G.thumb.nailInk} fill={INK} opacity={0.85} />
          <path d={G.thumb.ink} fill={INK} />
        </g>
      </g>
      <g filter={bS.url}>
        <path d={G.cuff} fill="#FFFFFF" />
        <path d={G.cuffInk} fill={INK} />
      </g>
      {G.speed ? <path d={G.speed} fill={INK} opacity={0.85} /> : null}
    </g>
  );
};
