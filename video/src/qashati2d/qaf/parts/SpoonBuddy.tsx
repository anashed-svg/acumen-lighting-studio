// <SpoonBuddy/> — the spot's little hero: a long steel dessert spoon standing on its handle end, the bowl is its HEAD
// (a face drawn on the back of the bowl). It acts: hopeful → worried → deadpan look to camera → a "take" → 🥵 panting
// → melting → boing back → a dive into the cup → up with a hat of qashta, blissful.
// Rubber-hose logic: the handle bends (`bend`), squashes (`squash`), melts (`melt`: the head droops and sags, the
// handle goes wavy, drips form). The steel reflects the world (`tint`: turquoise or chili red), drawn as a cel band.
//
// Local space: the FOOT (handle end, the contact point) is (0, 0); the spoon stands up −y. L = foot → bowl centre.
// spoonHead() returns the head centre + angle (for bubbles' tails, sweat, the dive mask).
import React, {useId, useMemo} from 'react';
import {blobPts, brush, catmull, ellipsePts, Pt, rng, shapeD, smoothD} from '../../kit/geom';
import {useBoil} from '../../kit/look/Boil';
import {C, INK} from '../../kit/palette';

export type Eye = 'open' | 'half' | 'closed' | 'squeeze' | 'big' | 'spark' | 'shut';
export type Mouth = 'smile' | 'flat' | 'o' | 'wavy' | 'pant' | 'grin' | 'bliss' | 'gulp';
export type SpoonFace = {
  eye: Eye;
  /** pupil offset −1..1 (x right, y down) */
  look?: Pt;
  /** brows: raise (−1 low … 1 high), tilt (+ = worried: inner ends up; − = cross) */
  brow?: {raise?: number; tilt?: number};
  mouth: Mouth;
  /** 0..1 pink cheeks */
  blush?: number;
  /** 0..1 red-hot flush over the face */
  flush?: number;
};

export type SpoonPose = {
  /** sideways bend of the head (−1..1, + = right) */
  bend?: number;
  /** + squash (shorter, fatter), − stretch */
  squash?: number;
  /** 0..1 melt */
  melt?: number;
  /** melt droop side (−1 left, +1 right) */
  meltSide?: 1 | -1;
};

const L0 = 520; // foot → bowl centre
const BOWL_RX = 64;
const BOWL_RY = 84;

/** the spine (foot → neck) and the head frame for a pose. */
export const spoonHead = (p: SpoonPose = {}, L = L0) => {
  const bend = p.bend ?? 0;
  const sq = p.squash ?? 0;
  const melt = p.melt ?? 0;
  const side = p.meltSide ?? -1;
  const len = (L - BOWL_RY) * (1 - sq * 0.55);
  const N = 18;
  const spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let x = bend * 150 * t * t;
    let y = -len * t;
    // melt: an S-wobble and the top sinks and curls over to the side
    x += melt * (26 * Math.sin(t * Math.PI * 2.2) * t + side * 120 * t ** 3);
    y += melt * len * 0.3 * t ** 2.4;
    spine.push([x, y]);
  }
  const a = spine[N - 1];
  const b = spine[N];
  const ang = Math.atan2(b[0] - a[0], -(b[1] - a[1])); // 0 = straight up, + = leaning right
  const droop = melt * side * 0.9;
  const hAng = ang + droop;
  const neckLen = BOWL_RY * (1 - sq * 0.2) * (1 + melt * 0.12);
  const head: Pt = [b[0] + Math.sin(hAng) * neckLen, b[1] - Math.cos(hAng) * neckLen];
  return {spine, head, angle: (hAng * 180) / Math.PI, len};
};

const steelW = (t: number) => (t < 0.06 ? 30 + 10 * Math.sqrt(t / 0.06) : 40 - 22 * ((t - 0.06) / 0.94) ** 0.8);

const Cel: React.FC<{id: string; d: string; base: string; lit: string; off: Pt; transform?: string}> = ({id, d, base, lit, off, transform}) => (
  <g transform={transform}>
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

const eyePaths = (e: Eye, x: number, y: number, s: number, look: Pt, mirror: boolean) => {
  const rx = 15 * s;
  const ry = 20 * s;
  if (e === 'closed') {
    // happy closed eyes: an arch
    const arc = ellipsePts(x, y + 6 * s, rx, ry * 0.7, 12, Math.PI * 1.08, Math.PI * 1.92);
    return {white: '', ink: brush(arc, {w: 6 * s, dense: true, taper: [0.3, 0.3], tip: 0.2, seed: mirror ? 3 : 4}), pupil: '', hi: '', lid: ''};
  }
  if (e === 'shut') {
    // a plain blink: the lid line, a hair curved down
    const pts: Pt[] = [
      [x - rx, y + 2 * s],
      [x, y + 6 * s],
      [x + rx, y + 2 * s],
    ];
    return {white: '', ink: brush(pts, {w: 6 * s, taper: [0.2, 0.2], tip: 0.3, seed: mirror ? 9 : 10}), pupil: '', hi: '', lid: ''};
  }
  if (e === 'squeeze') {
    // > <  (screwed shut)
    const d = mirror ? -1 : 1;
    const pts: Pt[] = [
      [x - d * rx, y - ry * 0.6],
      [x + d * rx * 0.7, y],
      [x - d * rx, y + ry * 0.6],
    ];
    return {white: '', ink: brush(pts, {w: 6.5 * s, taper: [0.2, 0.2], tip: 0.25, seed: mirror ? 5 : 6}), pupil: '', hi: '', lid: ''};
  }
  const big = e === 'big' ? 1.35 : 1;
  const half = e === 'half';
  const W = ellipsePts(x, y, rx * big, ry * big, 26);
  const pr = (e === 'big' ? 4.5 : 7.5) * s;
  const px = x + look[0] * rx * big * 0.45;
  const py = y + look[1] * ry * big * 0.42 + (half ? ry * 0.25 : 0);
  const pupil = ellipsePts(px, py, pr, pr * 1.15, 14);
  const hi = e === 'spark' ? ellipsePts(px - pr * 0.35, py - pr * 0.45, pr * 0.55, pr * 0.55, 10) : ellipsePts(px - pr * 0.4, py - pr * 0.5, pr * 0.32, pr * 0.32, 8);
  let lid = '';
  if (half) {
    // heavy upper lid (deadpan / melting): an ink-filled cap over the top 55 % of the eye
    const cap: Pt[] = [...ellipsePts(x, y, rx * 1.04, ry * 1.04, 16, Math.PI, Math.PI * 2), [x + rx * 1.04, y + ry * 0.05], [x - rx * 1.04, y + ry * 0.05]];
    lid = smoothD(cap, true);
  }
  return {
    white: smoothD(W, true),
    ink: brush(W, {w: 4.2 * s, closed: true, dense: true, start: 0.6, seed: mirror ? 7 : 8, shadow: 0.4}),
    pupil: smoothD(pupil, true),
    hi: smoothD(hi, true),
    lid,
  };
};

const mouthPath = (m: Mouth, s: number, f2: number): {fill?: string; ink: string; inner?: string; tongue?: string} => {
  const w = 26 * s;
  switch (m) {
    case 'smile':
      return {ink: brush(ellipsePts(0, -6 * s, w, 16 * s, 12, Math.PI * 0.15, Math.PI * 0.85), {w: 5 * s, dense: true, taper: [0.3, 0.3], tip: 0.2, seed: 21})};
    case 'flat':
      return {ink: brush([[-w * 0.7, 2 * s], [0, 3 * s], [w * 0.7, 1 * s]], {w: 5 * s, taper: [0.2, 0.2], tip: 0.3, seed: 22})};
    case 'gulp':
      return {ink: brush([[-w * 0.6, 4 * s], [-w * 0.2, -2 * s], [w * 0.2, 4 * s], [w * 0.6, -1 * s]], {w: 5 * s, taper: [0.2, 0.2], tip: 0.3, seed: 23})};
    case 'wavy': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push([-w + (2 * w * i) / 8, 6 * s + 5 * s * Math.sin(i * 1.9 + (f2 % 4))]);
      return {ink: brush(pts, {w: 4.8 * s, taper: [0.2, 0.2], tip: 0.3, seed: 24})};
    }
    case 'o': {
      const o = ellipsePts(0, 6 * s, 11 * s, 15 * s, 16);
      return {fill: smoothD(o, true), ink: brush(o, {w: 4.6 * s, closed: true, dense: true, seed: 25})};
    }
    case 'pant': {
      // 🥵: open mouth, tongue out
      const o: Pt[] = [...ellipsePts(0, 0, w * 0.75, 6 * s, 10, Math.PI, Math.PI * 2), ...ellipsePts(0, 0, w * 0.75, 20 * s, 14, 0, Math.PI)];
      const tg = ellipsePts(4 * s, 16 * s + (f2 % 4 ? 2 : 0) * s, 10 * s, 13 * s, 14);
      return {fill: smoothD(o, true), ink: brush(o, {w: 4.8 * s, closed: true, dense: true, seed: 26}), tongue: smoothD(tg, true)};
    }
    case 'grin': {
      const o: Pt[] = [...ellipsePts(0, -4 * s, w, 5 * s, 10, Math.PI, Math.PI * 2), ...ellipsePts(0, -4 * s, w, 24 * s, 16, 0, Math.PI)];
      const tg = ellipsePts(0, 12 * s, 12 * s, 7 * s, 12, 0, Math.PI);
      return {fill: smoothD(o, true), ink: brush(o, {w: 5 * s, closed: true, dense: true, seed: 27}), tongue: smoothD([...tg, [12 * s, 12 * s]], true)};
    }
    case 'bliss':
    default:
      return {ink: brush(ellipsePts(0, -10 * s, w * 0.8, 18 * s, 12, Math.PI * 0.12, Math.PI * 0.88), {w: 5.2 * s, dense: true, taper: [0.3, 0.3], tip: 0.2, seed: 28})};
  }
};

/** a heaped spoonful of qashta seen from behind the spoon (head-local; the bowl's top is y = −BOWL_RY): the mound
 *  rises over the head's top edge (its base is hidden behind the bowl) with a soft curl, honey running over it. */
const heapPts = (k: number): Pt[] =>
  catmull(
    (
      [
        [-56, -30], [-64, -86], [-50, -128], [-22, -156], [-2, -184], [14, -204], [30, -196], [24, -176], [46, -152], [64, -118], [68, -80], [56, -30],
      ] as Pt[]
    ).map(([x, y]) => [x * (0.75 + 0.25 * k), y < -84 ? -84 + (y + 84) * k : y] as Pt),
    true,
    8,
  );

const HeapBack: React.FC<{load: number; f2: number}> = ({load, f2}) => {
  const k = load;
  const pts = heapPts(k);
  const hi = catmull(
    ([[-44, -96], [-38, -126], [-18, -150], [-2, -172]] as Pt[]).map(([x, y]) => [x * (0.75 + 0.25 * k), -84 + (y + 84) * k] as Pt),
    false,
    8,
  );
  const honey: Pt[] = ([[18, -190], [30, -160], [50, -136], [60, -104], [64, -76]] as Pt[]).map(([x, y]) => [x * (0.75 + 0.25 * k), -84 + (y + 84) * k] as Pt);
  return (
    <g>
      <path d={smoothD(pts, true)} fill={C.creamShade} />
      <path d={smoothD(pts, true)} fill={C.cream} transform="translate(-8 -8) scale(0.94)" />
      <path d={brush(pts, {w: 6.5, closed: true, dense: true, start: 0.55, seed: 31, shadow: 0.7})} fill={INK} />
      <path d={brush(catmull(([[-12, -120], [6, -138], [18, -158]] as Pt[]).map(([x, y]) => [x, -84 + (y + 84) * k] as Pt), false, 6), {w: 3.6, taper: [0.3, 0.5], tip: 0.1, seed: 32})} fill={INK} opacity={0.75} />
      <path d={brush(hi, {w: 10, dense: true, taper: [0.3, 0.5], tip: 0.1, seed: 33})} fill={C.white} />
      <path d={brush(honey, {w: 15, taper: [0.2, 0.05], tip: 0.55, seed: 34})} fill={C.honey} />
      <path d={brush(honey.slice(0, 4).map(([x, y]) => [x - 4, y] as Pt), {w: 4, taper: [0.3, 0.3], tip: 0.1, seed: 35})} fill={C.honeyLight} />
      <path d={shapeD(blobPts(-26, -84 - 40 * k, 9, 6, 0.3, 19, 8, 2))} fill={C.pistachio} stroke={INK} strokeWidth={2.4} />
      <path d={shapeD(blobPts(-44, -84 - 14 * k, 6, 5, 0.3, 21, 8, 2))} fill={C.pistachioSkin} stroke={INK} strokeWidth={2.2} />
      <path d={shapeD(blobPts(34, -84 - 70 * k, 6, 5, 0.3, 23, 8, 2))} fill={C.pistachio} stroke={INK} strokeWidth={2.2} />
      {/* a strawberry slice stuck in the heap */}
      <g transform={`translate(${-14} ${-84 - 86 * k}) rotate(-28) scale(1.15)`}>
        <path d={shapeD([[-16, 10], [-18, -6], [-8, -22], [0, -26], [9, -21], [17, -6], [15, 10], [0, 16]])} fill={C.strawberry} stroke={INK} strokeWidth={3.4} />
        <path d={shapeD([[-8, 6], [-9, -6], [-3, -14], [4, -14], [9, -5], [8, 6], [0, 9]])} fill={C.strawberryMid} />
        <path d={shapeD([[-3, 2], [-3, -6], [2, -9], [4, -2], [2, 4]])} fill={C.strawberryCore} />
        <path d="M-10 -12 Q-12 -14 -9 -15" stroke={C.white} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      {/* the honey bead about to drop off the rim */}
      <ellipse cx={64 * (0.75 + 0.25 * k)} cy={-70 + 5 * ((f2 / 2) % 2)} rx={9} ry={10} fill={C.honey} stroke={C.honeyDeep} strokeWidth={2.6} />
      <ellipse cx={64 * (0.75 + 0.25 * k) - 3} cy={-73 + 5 * ((f2 / 2) % 2)} rx={3} ry={3.5} fill={C.white} />
    </g>
  );
};

/** cream lips spilling over the bowl's top edge (in front of the bowl) */
const HeapFront: React.FC<{load: number}> = ({load}) => {
  if (load < 0.3) return null;
  const k = (load - 0.3) / 0.7;
  const lip = (x: number, len: number, seed: number) => {
    const pts: Pt[] = [[x - 18, -86], [x + 18, -86], [x + 10, -78 + len * 0.5], [x + 8, -78 + len], [x, -72 + len], [x - 8, -78 + len], [x - 12, -78 + len * 0.4]];
    return (
      <g key={seed}>
        <path d={shapeD(pts, 6)} fill={C.cream} />
        <path d={brush(catmull(pts.slice(1), false, 6), {w: 4, taper: [0.2, 0.3], tip: 0.2, seed})} fill={INK} />
      </g>
    );
  };
  return <g>{[lip(-30, 22 * k, 36), lip(26, 30 * k, 37)]}</g>;
};

export const SpoonBuddy: React.FC<{
  frame: number;
  pose?: SpoonPose;
  face: SpoonFace;
  /** colour the steel reflects (the world) */
  tint?: string;
  /** hat of qashta 0..1 */
  load?: number;
  /** a coat of qashta smeared on the face/bowl 0..1 (after the dive) */
  coat?: number;
  boil?: number;
  shadow?: boolean;
  /** a nervous sweat bead on the temple (0..1) */
  bead?: number;
  /** "take" lines radiating from the head (0..1) */
  shock?: number;
}> = ({frame, pose = {}, face, tint = C.turquoise, load = 0, coat = 0, boil = 1, shadow = true, bead = 0, shock = 0}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const f2 = Math.floor(frame / 2);
  const bS = useBoil({scale: 2.4 * boil, offset: 51, frame, freq: 0.026});
  const bF = useBoil({scale: 1.6 * boil, offset: 53, frame, freq: 0.02});
  const melt = pose.melt ?? 0;
  const side = pose.meltSide ?? -1;
  const mq = Math.round(melt * 24) / 24;
  const key = `${(pose.bend ?? 0).toFixed(3)}:${(pose.squash ?? 0).toFixed(3)}:${mq}:${side}`;
  const G = useMemo(() => {
    const H = spoonHead({...pose, melt: mq});
    const {spine} = H;
    const N = spine.length - 1;
    const left: Pt[] = [];
    const right: Pt[] = [];
    const sqW = 1 + (pose.squash ?? 0) * 0.5;
    for (let i = 0; i <= N; i++) {
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(N, i + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      const w = (steelW(i / N) / 2) * sqW * (1 + melt * 0.25 * Math.sin(i * 1.3));
      left.push([spine[i][0] - (ty / tl) * w, spine[i][1] + (tx / tl) * w]);
      right.push([spine[i][0] + (ty / tl) * w, spine[i][1] - (tx / tl) * w]);
    }
    // rounded foot
    // rounded paddle end (the handle's tip is what it stands on)
    const fr = (steelW(0) / 2) * sqW;
    const foot = ellipsePts(spine[0][0], spine[0][1] - fr * 0.55, fr, fr * 0.75, 14, 0, Math.PI).reverse();
    const handle = [...left.slice(1).reverse(), ...foot.reverse(), ...right.slice(1)];
    // the bowl: an egg (wider at the top), sagging with melt
    const hr = ((H.angle * Math.PI) / 180);
    const bowlLocal: Pt[] = ellipsePts(0, 0, BOWL_RX, BOWL_RY, 48).map(([x, y]) => {
      const egg = y < 0 ? 1.04 : 0.9 - 0.12 * (y / BOWL_RY);
      const sag = melt * (y > 0 ? 0.16 * (y / BOWL_RY) : 0.05);
      return [x * egg * (1 + sag * 0.6), y * (1 + sag)] as Pt;
    });
    const toW = ([x, y]: Pt): Pt => [H.head[0] + x * Math.cos(hr) - y * Math.sin(hr), H.head[1] + x * Math.sin(hr) + y * Math.cos(hr)];
    const bowl = bowlLocal.map(toW);
    // drips hanging from the lowest part of the melting bowl (straight down): fills sit UNDER the bowl (their tops
    // tuck behind its rim) and are inked only along the sides and the bulb — no "tooth" outline
    let drips = '';
    let dripInk = '';
    if (melt > 0.15) {
      const kk = Math.min(1, (melt - 0.15) / 0.45);
      // three of the LOWEST points of the drooping head (away from the neck), drips hang straight down from them
      const neck = spine[N];
      const cands = bowl
        .filter((q) => Math.hypot(q[0] - neck[0], q[1] - neck[1]) > 46)
        // only points on the head's underside (nothing of the head hangs below them)
        .filter((q) => !bowl.some((o) => Math.abs(o[0] - q[0]) < 12 && o[1] > q[1] + 4))
        .sort((p1, p2) => p2[1] - p1[1]);
      const picks: Pt[] = [];
      for (const q of cands) {
        if (picks.every((pp) => Math.abs(pp[0] - q[0]) > 34)) picks.push(q);
        if (picks.length === 3) break;
      }
      picks.forEach((p, j) => {
        const len = [66, 44, 88][j] * kk;
        const x = p[0];
        const y = p[1] - 10;
        const r = [10, 8, 11][j];
        const side: Pt[] = [[x - 8, y], [x - 5, y + 14], [x - 4, y + len * 0.55], [x - r, y + len], [x - r * 0.7, y + len + r * 0.9], [x, y + len + r * 1.25], [x + r * 0.7, y + len + r * 0.9], [x + r, y + len], [x + 4, y + len * 0.55], [x + 5, y + 14], [x + 8, y]];
        drips += shapeD(side, 6);
        dripInk += brush(catmull(side.slice(2, -2), false, 6), {w: 3.8, taper: [0.25, 0.25], tip: 0.1, seed: 70 + j});
      });
    }
    // the reflected world: a soft band across the bowl and a long one down the handle
    const band = ellipsePts(BOWL_RX * 0.25, BOWL_RY * 0.08, BOWL_RX * 0.62, BOWL_RY * 0.82, 30, -Math.PI * 0.42, Math.PI * 0.55).map(toW);
    const bandIn = ellipsePts(BOWL_RX * 0.38, BOWL_RY * 0.12, BOWL_RX * 0.36, BOWL_RY * 0.6, 30, -Math.PI * 0.42, Math.PI * 0.55).map(toW).reverse();
    const spec = catmull(
      ([[-BOWL_RX * 0.62, BOWL_RY * 0.05], [-BOWL_RX * 0.58, -BOWL_RY * 0.42], [-BOWL_RX * 0.28, -BOWL_RY * 0.74]] as Pt[]).map(toW),
      false,
      8,
    );
    const handleSpec = spine.slice(2, N - 2).map(([x, y], i) => [x - 6 + 0 * i, y] as Pt);
    return {
      H,
      hr,
      handle: smoothD(handle, true),
      handleInk: brush(handle, {w: 5.6, closed: true, dense: true, start: 0.7, seed: 41, shadow: 0.7}),
      bowl: smoothD(bowl, true),
      bowlInk: brush(bowl, {w: 7, closed: true, dense: true, start: 0.85, seed: 42, shadow: 0.8}),
      band: smoothD([...band, ...bandIn], true),
      spec: brush(spec, {w: 10, dense: true, taper: [0.35, 0.5], tip: 0.1, seed: 43}),
      handleSpec: brush(handleSpec, {w: 5, taper: [0.3, 0.4], tip: 0.1, seed: 44}),
      drips,
      dripInk,
      neck: brush(
        [spine[N], [spine[N][0] + Math.sin(hr) * 20, spine[N][1] - Math.cos(hr) * 20]],
        {w: 4, taper: [0.3, 0.3], seed: 45},
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const {H} = G;
  const fs = 1;
  const look = face.look ?? [0, 0];
  const big = face.eye === 'big' ? 1.1 : 1;
  const eL = eyePaths(face.eye, -25 * big, -12, fs, look, false);
  const eR = eyePaths(face.eye, 25 * big, -12, fs, look, true);
  const brow = face.brow ?? {};
  const by = -46 - 10 * (brow.raise ?? 0) - (face.eye === 'big' ? 10 : 0);
  const tilt = brow.tilt ?? 0;
  const browD = (sx: number) =>
    brush(
      [
        [sx * 12, by - tilt * 7 * 1],
        [sx * 26, by - 4 - tilt * 1],
        [sx * 40, by + tilt * 7],
      ],
      {w: 6.5, taper: [0.25, 0.4], tip: 0.2, seed: sx > 0 ? 46 : 47},
    );
  const M = mouthPath(face.mouth, fs, f2);
  const sh: Pt = [16, 22];
  const r = rng(f2 * 3 + 11);
  void r;
  return (
    <g>
      <defs>
        {bS.def}
        {bF.def}
      </defs>
      {shadow ? (
        <g opacity={0.2}>
          <ellipse cx={H.spine[0][0] + 26} cy={6} rx={46} ry={9} fill={INK} />
        </g>
      ) : null}
      <g filter={bF.url}>
        <Cel id={`h${uid}`} d={G.handle} base={C.steelShade} lit={C.steel} off={[-7, -4]} />
        <path d={G.handleSpec} fill={C.white} opacity={0.9} />
        {load > 0 ? (
          <g transform={`translate(${H.head[0]} ${H.head[1]}) rotate(${H.angle})`}>
            <HeapBack load={load} f2={f2} />
          </g>
        ) : null}
        {G.drips ? <path d={G.drips} fill={C.steel} /> : null}
        <Cel id={`b${uid}`} d={G.bowl} base={C.steelDeep} lit={C.steel} off={[-12, -12]} />
        <clipPath id={`bc${uid}`}>
          <path d={G.bowl} />
        </clipPath>
        <path d={G.band} fill={tint} opacity={0.55} clipPath={`url(#bc${uid})`} />
        {face.flush ? <path d={G.bowl} fill={C.chiliHot} opacity={0.42 * face.flush} /> : null}
        <path d={G.spec} fill={C.white} opacity={0.95} clipPath={`url(#bc${uid})`} />
        {coat > 0 ? (
          <path
            d={shapeD(blobPts(-8, 30, 52, 30, 0.18, 7, 24, 3))}
            fill={C.cream}
            opacity={coat}
            transform={`translate(${H.head[0]} ${H.head[1]}) rotate(${H.angle})`}
            stroke={INK}
            strokeWidth={3}
          />
        ) : null}
      </g>
      <g filter={bS.url}>
        <path d={G.handleInk} fill={INK} />
        <path d={G.bowlInk} fill={INK} />
        {G.dripInk ? <path d={G.dripInk} fill={INK} /> : null}
        {/* the face (head-local) */}
        <g transform={`translate(${H.head[0]} ${H.head[1] + melt * 10}) rotate(${H.angle * (1 - melt * 0.3)})`}>
          {face.blush ? (
            <g opacity={face.blush}>
              <ellipse cx={-38} cy={20} rx={13} ry={8} fill={C.strawberryMid} opacity={0.7} />
              <ellipse cx={38} cy={20} rx={13} ry={8} fill={C.strawberryMid} opacity={0.7} />
            </g>
          ) : null}
          {[eL, eR].map((e, i) => (
            <g key={i}>
              {e.white ? <path d={e.white} fill={C.white} /> : null}
              {e.pupil ? <path d={e.pupil} fill={INK} /> : null}
              {e.hi ? <path d={e.hi} fill={C.white} /> : null}
              {e.lid ? <path d={e.lid} fill={C.steelShade} /> : null}
              {e.lid ? <path d={brush(ellipsePts(i ? 25 : -25, -12 + 1, 16, 2, 8, 0, Math.PI), {w: 5, dense: true, taper: [0.2, 0.2], seed: 48 + i})} fill={INK} /> : null}
              <path d={e.ink} fill={INK} />
            </g>
          ))}
          {face.eye !== 'closed' ? (
            <>
              <path d={browD(-1)} fill={INK} />
              <path d={browD(1)} fill={INK} />
            </>
          ) : null}
          <g transform={`translate(0 ${34})`}>
            {M.fill ? <path d={M.fill} fill={C.tealDark} /> : null}
            {M.tongue ? <path d={M.tongue} fill={C.strawberryMid} stroke={INK} strokeWidth={3} /> : null}
            <path d={M.ink} fill={INK} />
          </g>
          {load > 0 ? <HeapFront load={load} /> : null}
          {bead > 0 ? (
            <g transform={`translate(${54} ${-46 + 6 * (f2 % 3)}) scale(${bead})`}>
              <path d="M0 -20C5 -9 11 -2 11 6C11 13 6 17 0 17C-6 17 -11 13 -11 6C-11 -2 -5 -9 0 -20Z" fill="#BDF3FF" stroke={INK} strokeWidth={3.4} />
              <ellipse cx={-4} cy={5} rx={2.6} ry={4.4} fill={C.white} />
            </g>
          ) : null}
          {shock > 0
            ? [-150, -118, -90, -62, -30, 0].map((a, i) => {
                const r0 = 104 + (f2 % 2) * 6;
                const r1 = r0 + 34 * shock;
                const ar = (a * Math.PI) / 180;
                return (
                  <path
                    key={i}
                    d={brush([[Math.cos(ar) * r0 * 0.82, Math.sin(ar) * r0], [Math.cos(ar) * r1 * 0.82, Math.sin(ar) * r1]], {w: 7, taper: [0.2, 0.6], tip: 0.15, seed: 60 + i})}
                    fill={INK}
                  />
                );
              })
            : null}
        </g>
      </g>
    </g>
  );
};

export const SPOON_L = L0;
export const SPOON_BOWL = {rx: BOWL_RX, ry: BOWL_RY};
