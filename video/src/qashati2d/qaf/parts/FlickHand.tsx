// <FlickHandArt/> — the narrator's hand that flicks the ق off «قشطة» («طقّة»). A chunky, hand-inked right hand in a
// white kandura sleeve, seen from the THUMB side: the index finger is curled into a hook and loaded behind the thumb
// tip (the classic flick), the other fingers are rolled into the palm. Poses are separate DRAWINGS (switch on twos):
//   cocked → strain (tighter curl, tension ticks) → smear (stretched finger + speed arcs) → flicked (finger snapped out,
//   a hair hyper-extended) → relaxed (loose, as it withdraws).
// Cel shading is computed from the screen light (upper left) for any rotation `rot`, so the shade crescents always sit
// on the right side of every shape. The forearm runs ≈ 2600 units towards +x and widens (it comes from the camera),
// so at any angle it LEAVES the frame — never a floating stump.
//
// Canonical space: the flick goes LEFT (−x), the wrist is at x ≈ 0, the arm runs to +x. NAIL = the loaded nail's
// point in the cocked pose — aim it just under the target and rotate the group by `rot` (deg).
import React, {useId, useMemo} from 'react';
import {brush, catmull, ellipsePts, Pt, resample, smoothD} from '../../kit/geom';
import {useBoil} from '../../kit/look/Boil';
import {Halftone} from '../../kit/look/Halftone';
import {C, INK} from '../../kit/palette';

export type FlickPose = 'cocked' | 'strain' | 'smear' | 'flicked' | 'relaxed';

/** the loaded nail in the cocked pose (canonical units) */
export const NAIL_COCKED: Pt = [-228, -40];

const SKIN = '#D9A174';
const SKIN_SHADE = '#B07447';
const SKIN_DEEP = '#8E5530';
const SKIN_LIT = '#EDBF93';
const NAIL = '#F7DCCB';
const SLEEVE = '#FBFAF4';
const SLEEVE_SHADE = '#CFD9D5';
const SLEEVE_DEEP = '#A9BAB5';

type Finger = {spine: Pt[]; radii: number[]; nail?: {at: number; side: 1 | -1}};
type Pose = {index: Finger; thumb: Finger; curls: Finger[]; palm: Pt[]; speed?: boolean; tension?: boolean};

/** outline of a finger: a spine with per-point radii and a round cap at the tip (closed polygon, dense). */
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
  const end = dense[n - 1];
  const prev = dense[n - 2];
  const a0 = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const rEnd = rAt(n - 1);
  const cap: Pt[] = [];
  for (let k = 1; k < 12; k++) {
    const a = a0 + Math.PI / 2 - (k / 12) * Math.PI;
    cap.push([end[0] + Math.cos(a) * rEnd, end[1] + Math.sin(a) * rEnd]);
  }
  const s0 = dense[0];
  const s1 = dense[1];
  const b0 = Math.atan2(s0[1] - s1[1], s0[0] - s1[0]);
  const r0 = rAt(0);
  const cap0: Pt[] = [];
  for (let k = 1; k < 12; k++) {
    const a = b0 + Math.PI / 2 - (k / 12) * Math.PI;
    cap0.push([s0[0] + Math.cos(a) * r0, s0[1] + Math.sin(a) * r0]);
  }
  // order: left side → tip cap (11) → right side (reversed) → base cap (11, hidden inside the palm)
  return [...left, ...cap, ...right.reverse(), ...cap0];
};

const along = (spine: Pt[], t: number): {p: Pt; dir: Pt} => {
  const d = resample(catmull(spine, false, 10), 2, false);
  const i = Math.max(1, Math.min(d.length - 1, Math.round(t * (d.length - 1))));
  const dx = d[i][0] - d[i - 1][0];
  const dy = d[i][1] - d[i - 1][1];
  const L = Math.hypot(dx, dy) || 1;
  return {p: d[i], dir: [dx / L, dy / L]};
};

// ------------------------------------------------------------------------------------------------ the drawings
// the fist: palm + the rolled middle/ring/pinky as ONE solid mass (boxing-glove proportions read at phone size)
const FIST: Pt[] = [
  [22, -58], [-50, -72], [-122, -70], [-170, -48], [-194, -8], [-194, 42], [-172, 80], [-122, 100], [-50, 102], [2, 88], [26, 40],
];
// the rolled fingers on the fist's front face (middle, ring, pinky): C-shaped folds
const FOLDS: Pt[][] = [
  [[-132, -36], [-178, -30], [-190, 2], [-162, 14]],
  [[-130, 16], [-178, 20], [-188, 50], [-158, 60]],
  [[-124, 62], [-162, 70], [-168, 90], [-142, 96]],
];

const POSES: Record<FlickPose, Pose> = {
  cocked: {
    palm: FIST,
    curls: [],
    tension: true, // the thumbnail already strains: tension ticks around the loaded finger
    index: {spine: [[-118, -50], [-152, -92], [-196, -100], [-224, -72], [-214, -40]], radii: [28, 27, 26, 25, 24], nail: {at: 0.93, side: 1}},
    thumb: {spine: [[-90, 50], [-160, 40], [-210, 16], [-238, -6]], radii: [36, 30, 26, 23], nail: {at: 0.88, side: -1}},
  },
  strain: {
    palm: FIST,
    curls: [],
    tension: true,
    index: {spine: [[-118, -50], [-148, -98], [-194, -110], [-228, -80], [-218, -44]], radii: [29, 28, 27, 26, 25], nail: {at: 0.93, side: 1}},
    thumb: {spine: [[-90, 50], [-160, 38], [-212, 10], [-242, -12]], radii: [37, 31, 27, 24], nail: {at: 0.88, side: -1}},
  },
  smear: {
    palm: FIST,
    curls: [],
    speed: true,
    index: {spine: [[-118, -50], [-180, -88], [-250, -98], [-320, -86], [-362, -66]], radii: [28, 23, 18, 14, 11], nail: {at: 0.96, side: 1}},
    thumb: {spine: [[-90, 50], [-160, 46], [-212, 26], [-240, 8]], radii: [36, 30, 26, 23], nail: {at: 0.88, side: -1}},
  },
  flicked: {
    palm: FIST,
    curls: [],
    // snapped out and a hair hyper-extended (curving up) — a follow-through, not a held pointing finger
    index: {spine: [[-118, -50], [-176, -70], [-236, -84], [-292, -100]], radii: [28, 27, 26, 25], nail: {at: 0.9, side: -1}},
    thumb: {spine: [[-90, 50], [-160, 48], [-212, 30], [-240, 14]], radii: [36, 30, 26, 23], nail: {at: 0.88, side: -1}},
  },
  relaxed: {
    palm: FIST,
    curls: [],
    index: {spine: [[-118, -50], [-166, -76], [-214, -80], [-244, -56], [-246, -26]], radii: [28, 27, 26, 25, 24], nail: {at: 0.92, side: 1}},
    thumb: {spine: [[-90, 50], [-160, 52], [-208, 40], [-236, 28]], radii: [36, 30, 26, 23], nail: {at: 0.88, side: -1}},
  },
};

// ------------------------------------------------------------------------------------------------ geometry
type Shape = {d: string; ink: string};
type FingerGeo = Shape & {nail?: {d: string; ink: string; hi: string}; crease: string};
type HandGeo = {
  palm: Shape;
  palmCrease: string;
  curls: FingerGeo[];
  index: FingerGeo;
  thumb: FingerGeo;
  sleeve: string;
  sleeveShade: string;
  sleeveDeep: string;
  sleeveInk: string;
  cuff: Shape;
  cuffStitch: string;
  folds: string;
  speed: string;
  smear: string;
  tension: string;
  silhouette: string;
};

const ARM_LEN = 2600;
const sleeveHW = (s: number) => 70 + Math.min(1, s / 900) ** 0.8 * 70 + (s > 900 ? (s - 900) * 0.04 : 0);

const fingerGeo = (fg: Finger, w: number, seed: number, sd: Pt): FingerGeo => {
  const out = capsule(fg.spine, fg.radii);
  let nail: FingerGeo['nail'];
  if (fg.nail) {
    const {p, dir} = along(fg.spine, fg.nail.at);
    const r = fg.radii[fg.radii.length - 1];
    const nx = -dir[1] * fg.nail.side;
    const ny = dir[0] * fg.nail.side;
    const nc: Pt = [p[0] + nx * r * 0.48 + dir[0] * r * 0.15, p[1] + ny * r * 0.48 + dir[1] * r * 0.15];
    const ang = Math.atan2(dir[1], dir[0]);
    const pts = ellipsePts(nc[0], nc[1], r * 0.72, r * 0.44, 22, 0, Math.PI * 2, ang);
    const hi = ellipsePts(nc[0] - nx * r * 0.08, nc[1] - ny * r * 0.08, r * 0.46, r * 0.2, 10, Math.PI * 1.15, Math.PI * 1.75, ang);
    nail = {
      d: smoothD(pts, true),
      ink: brush(pts, {w: 3.4, closed: true, dense: true, seed: seed + 1, start: 0.3}),
      hi: brush(hi, {w: 4.2, dense: true, taper: [0.35, 0.35], tip: 0.1, seed: seed + 2}),
    };
  }
  // knuckle creases: short arcs across the finger at its joints
  const creases = [0.36, 0.64].map((t, i) => {
    const {p, dir} = along(fg.spine, t);
    const r = fg.radii[Math.round(t * (fg.radii.length - 1))] ?? fg.radii[0];
    const nx = -dir[1];
    const ny = dir[0];
    return brush(
      [
        [p[0] + nx * r * 0.15 - dir[0] * 3, p[1] + ny * r * 0.15 - dir[1] * 3],
        [p[0] + nx * r * 0.55, p[1] + ny * r * 0.55],
        [p[0] + nx * r * 0.85 + dir[0] * 3, p[1] + ny * r * 0.85 + dir[1] * 3],
      ],
      {w: 3.2, taper: [0.4, 0.5], tip: 0.1, seed: seed + 5 + i},
    );
  });
  // ink: an OPEN stroke from one side to the other round the tip — the base (inside the palm) is never inked, so the
  // finger's sides flow into the fist like a real drawing (no cut-out edge)
  const nSide = catmull(fg.spine, false, 8).length;
  const skip = Math.round(nSide * 0.3);
  const open = out.slice(skip, out.length - 11 - skip);
  return {
    d: smoothD(out, true),
    ink: brush(open, {w, dense: true, taper: [0.12, 0.12], tip: 0.05, seed, shadowDir: sd, shadow: 0.8}),
    nail,
    crease: creases.join(''),
  };
};

const buildGeo = (pose: FlickPose, sd: Pt): HandGeo => {
  const P = POSES[pose];
  const palmPts = catmull(P.palm, true, 8);
  const curls = P.curls.map((c, i) => fingerGeo(c, 6.5, 70 + i * 3, sd));
  const index = fingerGeo(P.index, pose === 'smear' ? 6 : 7.5, 11, sd);
  const thumb = fingerGeo(P.thumb, 8, 21, sd);

  // sleeve: from the wrist to +x, widening towards the camera; the top edge (canonical −y) is the shadow side
  const top: Pt[] = [];
  const bot: Pt[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) ** 1.6 * ARM_LEN;
    const hw = sleeveHW(s);
    const x = 6 + s;
    const bend = 0.00004 * s * s; // a slight droop (the forearm is not a ruler)
    top.push([x, -hw * 0.92 + bend]);
    bot.push([x, hw * 1.04 + bend]);
  }
  const sleevePts = [...top, ...bot.slice().reverse()];
  const shadeTop = top.map(([x, y], i) => [x, y + sleeveHW((i / N) ** 1.6 * ARM_LEN) * 0.62] as Pt);
  const deepTop = top.map(([x, y], i) => [x, y + sleeveHW((i / N) ** 1.6 * ARM_LEN) * 0.2] as Pt);
  // cuff: the kandura's wrist band (a slightly wider ring with a stitch line and a button)
  const cuffPts = catmull(
    [[-6, -74], [30, -76], [38, -30], [40, 30], [36, 80], [-4, 78], [-10, 30], [-12, -30]],
    true,
    8,
  );
  const fold = (pts: Pt[], seed: number, w = 5) => brush(pts, {w, taper: [0.25, 0.5], tip: 0.08, seed});
  const folds = [
    fold([[150, -110], [230, -84], [330, -96]], 64),
    fold([[260, 130], [380, 100], [470, 128]], 65, 5.5),
    fold([[520, -150], [640, -110], [760, -130]], 66, 6),
    fold([[700, 168], [820, 132], [960, 160]], 67, 6),
  ].join('');
  // speed arcs for the smear drawing: follow the fingertip's path (from the loaded hook up and out)
  const speed = P.speed
    ? [0, 1, 2]
        .map((i) => {
          const r = 150 + i * 30;
          const arc = ellipsePts(-150, 20, r * 1.25, r, 14, Math.PI * (1.02 + i * 0.03), Math.PI * (1.42 - i * 0.03));
          return brush(arc, {w: 7 - i * 1.6, taper: [0.7, 0.15], tip: 0.05, dense: true, seed: 95 + i});
        })
        .join('')
    : '';
  const smear = P.speed
    ? smoothD(
        catmull(
          [[-150, -70], [-200, -120], [-270, -128], [-340, -94], [-356, -60], [-300, -70], [-236, -92], [-182, -86]],
          true,
          6,
        ),
        true,
      )
    : '';
  const tension = P.tension
    ? [
        [[-276, -64], [-298, -74]],
        [[-272, -26], [-298, -22]],
        [[-258, 8], [-278, 22]],
        [[-246, -116], [-260, -136]],
      ]
        .map((s, i) => brush(s as Pt[], {w: 6, taper: [0.2, 0.5], tip: 0.1, seed: 120 + i}))
        .join('')
    : '';
  const silhouette = [smoothD(sleevePts, true), smoothD(palmPts, true), index.d, thumb.d, ...curls.map((c) => c.d)].join('');
  return {
    palm: {d: smoothD(palmPts, true), ink: brush(palmPts, {w: 8, closed: true, dense: true, start: 0.92, seed: 61, shadowDir: sd, shadow: 0.8})},
    palmCrease: [
      ...FOLDS.map((f, i) => brush(f, {w: 5.5 - i, taper: [0.3, 0.4], tip: 0.1, seed: 81 + i})),
      brush([[-20, -36], [-46, -28], [-74, -34]], {w: 3.2, taper: [0.4, 0.5], tip: 0.1, seed: 84}),
    ].join(''),
    curls,
    index,
    thumb,
    sleeve: smoothD(sleevePts, true),
    sleeveShade: smoothD([...shadeTop, ...top.slice().reverse()], true),
    sleeveDeep: smoothD([...deepTop, ...top.slice().reverse()], true),
    sleeveInk: brush(sleevePts, {w: 9, closed: true, dense: true, start: 0.5, seed: 62, shadowDir: sd, shadow: 0.7}),
    // the cuff's wrist edge (heavy, it overlaps the hand) and its sleeve-side seam (light) — no ring outline
    cuff: {
      d: smoothD(cuffPts, true),
      ink: [
        brush(catmull([[-6, -74], [-12, -30], [-10, 30], [-4, 78]], false, 8), {w: 7, dense: true, taper: [0.15, 0.15], tip: 0.3, seed: 63}),
        brush(catmull([[34, -76], [40, -30], [42, 30], [36, 80]], false, 8), {w: 3.6, dense: true, taper: [0.2, 0.2], tip: 0.2, seed: 69}),
      ].join(''),
    },
    cuffStitch: brush([[20, -68], [26, -20], [27, 30], [22, 72]], {w: 2.6, taper: [0.2, 0.2], seed: 68}),
    folds,
    speed,
    smear,
    tension,
    silhouette,
  };
};

const CACHE = new Map<string, HandGeo>();
const geo = (p: FlickPose, rot: number) => {
  const key = `${p}:${Math.round(rot)}`;
  let g = CACHE.get(key);
  if (!g) {
    // screen light from the upper left → shadow direction (0.6, 0.8) on screen, rotated into canonical space
    const r = (-rot * Math.PI) / 180;
    const sd: Pt = [0.6 * Math.cos(r) - 0.8 * Math.sin(r), 0.6 * Math.sin(r) + 0.8 * Math.cos(r)];
    g = buildGeo(p, sd);
    CACHE.set(key, g);
  }
  return g;
};

/** cel-shaded fill: shade colour, then the lit colour shifted towards the light and clipped to the shape */
const Cel: React.FC<{id: string; d: string; base: string; lit: string; off: Pt}> = ({id, d, base, lit, off}) => (
  <g>
    <clipPath id={id}>
      <path d={d} />
    </clipPath>
    <path d={d} fill={base} />
    {/* the clip sits on a parent <g>: on the translated path itself it would move with the path */}
    <g clipPath={`url(#${id})`}>
      <path d={d} fill={lit} transform={`translate(${off[0]} ${off[1]})`} />
    </g>
  </g>
);

export const FlickHandArt: React.FC<{pose: FlickPose; rot: number; squeeze?: number; frame: number; boil?: number; shadow?: boolean}> = ({
  pose,
  rot,
  squeeze = 0,
  frame,
  boil = 1,
  shadow = true,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const G = useMemo(() => geo(pose, rot), [pose, rot]);
  const bH = useBoil({scale: 2.8 * boil, offset: 71, frame, freq: 0.022});
  const bF = useBoil({scale: 1.8 * boil, offset: 73, frame, freq: 0.018});
  const bS = useBoil({scale: 3.2 * boil, offset: 72, frame, freq: 0.016});
  const r = (-rot * Math.PI) / 180;
  // towards the light (screen upper left), in canonical space
  const toL = (k: number): Pt => [k * (-0.6 * Math.cos(r) + 0.8 * Math.sin(r)), k * (-0.6 * Math.sin(r) - 0.8 * Math.cos(r))];
  // cast shadow on the paper: screen offset (26, 36) → canonical
  const sh: Pt = [26 * Math.cos(r) - 36 * Math.sin(r), 26 * Math.sin(r) + 36 * Math.cos(r)];
  const sq = 1 + 0.05 * squeeze;
  const finger = (fg: FingerGeo, id: string, lit = SKIN, base = SKIN_SHADE) => (
    <g>
      <Cel id={id} d={fg.d} base={base} lit={lit} off={toL(9)} />
      <path d={fg.crease} fill={INK} opacity={0.6} />
      {fg.nail ? (
        <g>
          <path d={fg.nail.d} fill={NAIL} />
          <path d={fg.nail.hi} fill={C.white} opacity={0.95} />
          <path d={fg.nail.ink} fill={INK} opacity={0.9} />
        </g>
      ) : null}
      <path d={fg.ink} fill={INK} />
    </g>
  );
  return (
    <g>
      <defs>
        {bH.def}
        {bF.def}
        {bS.def}
      </defs>
      {shadow ? (
        <g transform={`translate(${sh[0]} ${sh[1]})`} opacity={0.2}>
          <path d={G.silhouette} fill={INK} />
        </g>
      ) : null}
      {/* sleeve (behind the hand) */}
      <g filter={bF.url}>
        <path d={G.sleeve} fill={SLEEVE} />
        <path d={G.sleeveShade} fill={SLEEVE_SHADE} />
        <path d={G.sleeveDeep} fill={SLEEVE_DEEP} opacity={0.8} />
        <clipPath id={`sl${uid}`}>
          <path d={G.sleeve} />
        </clipPath>
        <Halftone
          box={[0, -260, 1400, 520]}
          cell={9}
          angle={30}
          fill={SLEEVE_DEEP}
          opacity={0.55}
          tone={[{t: 'lin', x0: 0, y0: 40, x1: 0, y1: -200, a: 0, b: 1}]}
          clipPath={`url(#sl${uid})`}
        />
      </g>
      <g filter={bS.url}>
        <path d={G.folds} fill={INK} opacity={0.55} />
        <path d={G.sleeveInk} fill={INK} />
      </g>
      {/* hand */}
      <g filter={bH.url}>
        {G.speed ? <path d={G.speed} fill={INK} opacity={0.8} /> : null}
        {G.smear ? <path d={G.smear} fill={SKIN_LIT} opacity={0.75} /> : null}
        {G.curls.map((c, i) => (
          <g key={i}>{finger(c, `c${i}${uid}`, i === 0 ? SKIN_SHADE : SKIN, i === 0 ? SKIN_DEEP : SKIN_SHADE)}</g>
        ))}
        <Cel id={`p${uid}`} d={G.palm.d} base={SKIN_SHADE} lit={SKIN} off={toL(14)} />
        <clipPath id={`ph${uid}`}>
          <path d={G.palm.d} />
        </clipPath>
        <Halftone
          box={[-160, -80, 190, 170]}
          cell={7}
          angle={25}
          fill={SKIN_DEEP}
          opacity={0.55}
          tone={[{t: 'rad', cx: toL(-90)[0] - 60, cy: toL(-90)[1] + 5, r0: 30, r1: 130, a: 1, b: 0}]}
          clipPath={`url(#ph${uid})`}
        />
        <path d={G.palmCrease} fill={INK} opacity={0.6} />
        <path d={G.palm.ink} fill={INK} />
        <g transform={`translate(${-118} ${-46}) scale(${sq}) translate(${118} ${46})`}>{finger(G.index, `i${uid}`)}</g>
        <g transform={`translate(${-2 * squeeze} ${-3 * squeeze})`}>{finger(G.thumb, `t${uid}`, SKIN_LIT, SKIN_SHADE)}</g>
        {G.tension ? <path d={G.tension} fill={INK} /> : null}
      </g>
      {/* cuff over the wrist */}
      <g filter={bF.url}>
        <Cel id={`cf${uid}`} d={G.cuff.d} base={SLEEVE_SHADE} lit={SLEEVE} off={toL(10)} />
      </g>
      <g filter={bS.url}>
        <path d={G.cuffStitch} fill={INK} opacity={0.5} />
        <path d={G.cuff.ink} fill={INK} />
      </g>
    </g>
  );
};
