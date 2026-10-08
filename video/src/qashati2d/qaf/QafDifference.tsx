// «الفرق بالـ ق» — the spot. Choreography only: every state is a pure function of the frame (timeline + layout in
// spec.ts). Drawings step on twos (f2); the camera moves on ones.
// Layers (back → front):
//   screen: QashtaPaper (parallax 0.55) · ChiliPaper clipped to (bloom ∖ wave) in screen space
//   world (camera): bloom edge · qashta cup · chili cup (clipped: rising level, then outside the wave) · cup flames ·
//                   wave crest · crater · the spoon (masked by the dome while it dives) + strand + collar + sweat ·
//                   the big word (+ flames, sparks, drops, puffs) · the hand
//   screen: the spoon's bubble · the title lines · end card · paper grain
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {
  blobPts,
  brush,
  C,
  clamp01,
  CUP_ANCHORS,
  cupPoint,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  EC,
  EndCard2D,
  ENDCARD_DURATION,
  FlameArt,
  Glint,
  HeroCup2D,
  INK,
  jiggle,
  onTwos,
  PaperGrain,
  POP_KEYS,
  Pt,
  rng,
  shapeD,
  smoothD,
  SpeechBubble,
} from '../kit/lib';
import {BloomEdge, ChiliPaper, ptsToPath, QashtaPaper, spreadPts, WaveCrest, wavePts as waveFront} from './parts/Backdrop';
import {camAt, camCss, parallax, shakeAt, toScreen} from './parts/camera';
import {FlickHandArt, FlickPose, NAIL_COCKED} from './parts/FlickHand';
import {RUNS} from './parts/glyphs';
import {DropState, Puff, QAF_DROPS, QafState, QafWord, WORD_FLAMES, wordGeom} from './parts/QafWord';
import {SpoonBuddy, SpoonFace, spoonHead, SpoonPose} from './parts/SpoonBuddy';
import {VectorLine} from './parts/VectorTitle';
import {COPY, L, T} from './spec';

export type QafDifferenceProps = {audio: string | null};

// ------------------------------------------------------------------------------------------------ fixed geometry
const WG = wordGeom(L.word.cx, L.word.baseline, L.word.k);
const QAF_HOME = WG.qafPivot;
const WORD_C: Pt = [L.word.cx, L.word.baseline - 110];
const CUP = L.cup;
const cupAt = (p: Pt) => cupPoint(p, CUP.x, CUP.base, CUP.scale);
const cupArtY = (y: number) => CUP.base + (y - 930) * CUP.scale;
// the dome as a world ellipse (for the dive mask) and the point where the spoon goes in
const DOME = {cx: CUP.x, cy: cupArtY(222), rx: 232 * CUP.scale, ry: 128 * CUP.scale};
const ENTRY: Pt = [CUP.x + (204 - 300) * CUP.scale, cupArtY(214)]; // the dome's left flank
const CUP_BODY = `M${CUP.x - 232 * CUP.scale} ${cupArtY(300)}L${CUP.x + 232 * CUP.scale} ${cupArtY(300)}L${CUP.x + 172 * CUP.scale} ${cupArtY(925)}L${CUP.x - 172 * CUP.scale} ${cupArtY(925)}Z`;

const SP = L.spoon;
const HEAD_LOCAL = spoonHead({}).head; // (0, −520)
const deg = (r: number) => (r * Math.PI) / 180;
/** world head position of the standing spoon (foot fixed on the table) */
const STAND_HEAD: Pt = [SP.x - Math.sin(deg(SP.lean)) * HEAD_LOCAL[1] * SP.scale, SP.base + Math.cos(deg(SP.lean)) * HEAD_LOCAL[1] * SP.scale];

const BLOOM_R = 2200;
const WAVE_R = 2400;

// boomerang path (world, all inside the frame): in from the left edge under the word, a low swoop past the spoon,
// up the right side, then back into its slot from the right — SLAM
const BOOM: Pt[] = [[-220, 760], [700, 1150], [1350, 250], QAF_HOME];
const bez = (t: number): Pt => {
  const u = 1 - t;
  const [a, b, c, d] = BOOM;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};
const boomT = (f2: number) => {
  const tt = clamp01((f2 - T.whistle) / (T.qafSlam - T.whistle));
  return easeInCubic(tt) * 0.5 + tt * 0.5;
};

// ------------------------------------------------------------------------------------------------ the word
/** the ق's flight away after the flick (t = frames since the flick): up-left, spinning, a hair of gravity */
const flyAway = (t: number): QafState => ({show: true, dx: -44 * t, dy: -62 * t + 1.4 * t * t, rot: -38 * t, s: 1 + 0.035 * t, sx: t === 0 ? 0.8 : 1, sy: t === 0 ? 1.25 : 1});
const boomState = (tq: number): QafState => {
  const q = bez(tq);
  return {show: true, dx: q[0] - QAF_HOME[0], dy: q[1] - QAF_HOME[1], rot: -1080 * (1 - tq) ** 1.2, s: 0.9 + 0.3 * tq};
};

const qafState = (f2: number): {qaf: QafState; trail: Pt[]} => {
  if (f2 < T.flick) return {qaf: {show: true, dx: f2 >= T.windup ? ((f2 / 2) % 2 ? 1.5 : -1.5) : 0}, trail: []};
  if (f2 < T.whistle) {
    const t = f2 - T.flick;
    if (t > 14) return {qaf: {show: false}, trail: []};
    const at = (u: number): Pt => {
      const q = flyAway(Math.max(0, u));
      return [QAF_HOME[0] + (q.dx ?? 0), QAF_HOME[1] + (q.dy ?? 0)];
    };
    return {qaf: flyAway(t), trail: t >= 2 ? [at(t - 4), at(t - 3), at(t - 2), at(t - 1)] : []};
  }
  if (f2 < T.qafSlam) {
    const t = boomT(f2);
    const trail = t > 0.12 ? [0.2, 0.15, 0.1, 0.05].map((d) => bez(Math.max(0, t - d))) : [];
    return {qaf: boomState(t), trail};
  }
  // slam: impact squash keys on twos, then home
  const k = (f2 - T.qafSlam) / 2;
  const keys = [
    {s: 1.1, sx: 1.32, sy: 0.68},
    {s: 1, sx: 0.88, sy: 1.14},
    {s: 1, sx: 1.05, sy: 0.96},
    {s: 1, sx: 0.98, sy: 1.02},
  ];
  return {qaf: {show: true, ...(k < keys.length ? keys[k] : {s: 1, sx: 1, sy: 1})}, trail: []};
};

const dropHome = (i: number): Pt => WG.at(RUNS.qashta.glyphs[3].x + QAF_DROPS[i].x, QAF_DROPS[i].y);
const FLUNG_H = [46, 64]; // low: the dots stay right above the ق, so «قشطة» never reads as «مشطة»
const FLUNG_DX = [-18, 22];

const dropsState = (f2: number): {drops: [DropState, DropState]; free: boolean} => {
  if (f2 < T.flick) {
    // nerves: the drops shiver while the finger winds up (they know)
    const a = 1 + f2 / 5;
    const s = (f2 / 2) % 2 ? 1 : -1;
    return {
      drops: [
        {show: true, dx: 1.6 * a * s, dy: f2 === 6 ? -8 : 0, rot: 5 * s},
        {show: true, dx: -1.6 * a * s, dy: f2 === 8 ? -8 : 0, rot: -5 * s},
      ],
      free: false,
    };
  }
  if (f2 < T.qafSlam) {
    // they ride the ق (stretched with fright on the way out, holding on on the way back)
    return {drops: [{show: true, stretch: 0.25, dy: -6}, {show: true, stretch: 0.3, dy: -9}], free: false};
  }
  const out = [0, 1].map((i): DropState => {
    const land = T.dotLand[i];
    if (f2 < land) {
      // flung up off the ق by the slam, they hang, then fall back onto it (stretching as they fall)
      const u = (f2 - T.qafSlam) / (land - T.qafSlam);
      const y = -4 * FLUNG_H[i] * u * (1 - u);
      return {show: true, dx: FLUNG_DX[i] * Math.sin(Math.PI * u), dy: y, stretch: u > 0.5 ? 0.15 + 0.6 * (u - 0.5) * 2 : 0.1, rot: (i ? 1 : -1) * 22 * Math.sin(Math.PI * u)};
    }
    const k = (f2 - land) / 2;
    const sq = [0.95, -0.25, 0.3, -0.08, 0][Math.min(4, k)];
    // the joyful hop once the wave has passed
    let hy = 0;
    const ht = f2 - (T.wordHop + i * 4);
    if (ht >= 0 && ht < 10) hy = -4 * 34 * (ht / 10) * (1 - ht / 10);
    return {show: true, squash: Math.max(0, sq), stretch: Math.max(0, -sq), dy: hy};
  }) as [DropState, DropState];
  return {drops: out, free: true};
};

const popScale = (f2: number, at: number) => (f2 < at ? 0 : POP_KEYS[Math.min(POP_KEYS.length - 1, Math.floor((f2 - at) / 2))].s);
const flameScale = (f2: number, at: number, out: number) => {
  if (f2 < at) return 0;
  if (f2 >= out) return [0.75, 0.35, 0][Math.min(2, (f2 - out) / 2)];
  return popScale(f2, at) * (1 + 0.05 * Math.sin(f2 * 1.3 + at));
};

// ------------------------------------------------------------------------------------------------ the spoon
type SpoonState = {
  /** either standing (foot on the table) or flying (head position + rotation) */
  stand?: {dy: number; lean: number};
  fly?: {head: Pt; rot: number};
  pose: SpoonPose;
  face: SpoonFace;
  load: number;
  coat: number;
  sweat: number;
  dive: boolean;
  bead?: number;
  shock?: number;
};

// the dive geometry: a head-first lunge into the dome's left flank along a fixed axis (rot 110°: the handle sticks out
// to the left, a little up — low, so it never crosses the line at the top)
const DIVE_ROT = 110;
const DIVE_AXIS: Pt = [-Math.sin(deg(DIVE_ROT)), Math.cos(deg(DIVE_ROT))]; // head → foot (up-left)
/** head position for a depth past the entry point (δ < 0: still outside, above the dome) */
const diveHead = (d: number): Pt => [ENTRY[0] - DIVE_AXIS[0] * d, ENTRY[1] - DIVE_AXIS[1] * d];
const DIVE_DEPTH = 96;
// the leap: a parabola from the crouched stand to just above the entry, a forward somersault (rot 0 → 166), on twos
const LEAP: Record<number, {h: Pt; r: number; sq: number}> = (() => {
  const a = STAND_HEAD;
  const b = diveHead(-130);
  const out: Record<number, {h: Pt; r: number; sq: number}> = {};
  const keys = [0, 2, 4, 6, 8].map((d) => T.spoonJump + d);
  keys.forEach((fr, i) => {
    const t = (i + 1) / keys.length;
    const apex = Math.min(a[1], b[1]) - 90;
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * apex + t * t * b[1];
    const x = a[0] + (b[0] - a[0]) * (t * 0.8 + 0.2 * t * t);
    out[fr] = {h: [x, y], r: DIVE_ROT * t ** 0.8, sq: [-0.26, -0.12, -0.04, -0.1, -0.24][i]};
  });
  return out;
})();
// pull: back out along the axis until the bowl is clear (240 → 246), then away to the left so the strand stretches
// (248 → 252), snapping on 254
const PULL: Record<number, {h: Pt; r: number}> = (() => {
  const out: Record<number, {h: Pt; r: number}> = {};
  const P0 = T.spoonPull[0];
  [0, 2, 4, 6].forEach((dt, i) => {
    const d = DIVE_DEPTH - [60, 160, 270, 386][i];
    out[P0 + dt] = {h: diveHead(d), r: DIVE_ROT + i};
  });
  const p = out[P0 + 6].h;
  out[P0 + 8] = {h: [p[0] - 80, p[1] - 22], r: DIVE_ROT + 8};
  out[P0 + 10] = {h: [p[0] - 150, p[1] - 38], r: DIVE_ROT + 14};
  out[P0 + 12] = {h: [p[0] - 208, p[1] - 46], r: DIVE_ROT + 18};
  out[P0 + 14] = {h: [p[0] - 222, p[1] - 40], r: DIVE_ROT + 14}; // snapped: it recoils a hair
  return out;
})();
// it springs back upright to its spot: the rotation unwinds (≈128° → 0, the handle never points up through the line)
// and the head stays low so the heap sweeps under the title, not through it
const FLIP: Record<number, {h: Pt; r: number; sq: number}> = {
  256: {h: [STAND_HEAD[0] - 30, STAND_HEAD[1] + 50], r: 48, sq: -0.16},
};

const lookAt = (f2: number, keys: [number, Pt][]): Pt => {
  let p = keys[0][1];
  for (const [k, v] of keys) if (f2 >= k) p = v;
  return p;
};

const spoonState = (f2: number): SpoonState => {
  const base = {load: 0, coat: 0, sweat: 0, dive: false};
  const tremble = (a: number) => ((f2 / 2) % 2 ? a : -a);
  // ---- ACT 1
  if (f2 < T.flick) {
    return {...base, bead: 1, stand: {dy: 0, lean: SP.lean + tremble(0.6 + f2 * 0.08)}, pose: {bend: 0.06}, face: {eye: 'open', look: [0.85, -0.85], brow: {raise: 0.5, tilt: 1}, mouth: 'wavy'}};
  }
  if (f2 < T.spoonLookWord) {
    const k = f2 - T.flick;
    const sq = [0.16, -0.08, 0.04, 0, 0][Math.min(4, k / 2)];
    return {
      ...base,
      stand: {dy: 0, lean: SP.lean - 2},
      pose: {squash: sq, bend: -0.08},
      face: k < 2 ? {eye: 'squeeze', brow: {raise: 0.2, tilt: 1}, mouth: 'o'} : {eye: 'big', look: [-0.75, -0.85], brow: {raise: 1, tilt: 0.6}, mouth: 'o'},
    };
  }
  if (f2 < T.spoonDeadpan) {
    return {...base, stand: {dy: 0, lean: SP.lean}, pose: {bend: 0.04}, face: {eye: 'open', look: [0.35, -0.95], brow: {raise: 0.3, tilt: 0.2}, mouth: 'flat'}};
  }
  if (f2 < T.bloom) {
    // the deadpan look to camera (the comic hold) — one slow blink
    const blink = f2 >= T.spoonBlink && f2 < T.spoonBlink + 2;
    return {...base, stand: {dy: 0, lean: SP.lean}, pose: {}, face: {eye: blink ? 'shut' : 'half', look: [0.05, 0.1], brow: {raise: -0.3, tilt: -0.1}, mouth: 'flat'}};
  }
  // ---- ACT 2
  if (f2 < T.spoonTake) return {...base, stand: {dy: 0, lean: SP.lean}, pose: {squash: 0.2}, face: {eye: 'half', look: [0, 0], brow: {raise: -0.6, tilt: -0.4}, mouth: 'flat'}};
  if (f2 < T.spoonGulp) {
    const k = (f2 - T.spoonTake) / 2;
    const sq = [-0.26, -0.1, 0.06, 0, 0][Math.min(4, k)];
    const dy = [-46, -20, 0, 0, 0][Math.min(4, k)];
    const look: Pt = f2 < T.cupFill[0] - 4 ? [0, -0.2] : [0.9, 0.25];
    return {...base, shock: f2 < T.spoonTake + 6 ? 1 : 0, stand: {dy, lean: SP.lean}, pose: {squash: sq}, face: {eye: 'big', look, brow: {raise: 1.3, tilt: 0.7}, mouth: f2 < T.cupFill[0] - 4 ? 'o' : 'wavy'}};
  }
  if (f2 < T.spoonHot) {
    const k = (f2 - T.spoonGulp) / 2;
    return {...base, stand: {dy: 0, lean: SP.lean}, pose: {squash: [0.08, -0.04, 0, 0][Math.min(3, k)]}, face: {eye: 'open', look: [0.05, 0.1], brow: {raise: 0.6, tilt: 1}, mouth: 'gulp'}};
  }
  const meltT = easeInOutCubic(clamp01((f2 - T.melt[0]) / (T.melt[1] - T.melt[0]))) * 0.62;
  if (f2 < T.spoonBoing) {
    const sweat = f2 < T.qafSlam ? clamp01((f2 - T.spoonHot) / 4) : 0;
    if (f2 < T.melt[0]) {
      return {...base, sweat, stand: {dy: 0, lean: SP.lean + tremble(1.6)}, pose: {bend: tremble(0.03)}, face: {eye: 'squeeze', brow: {raise: 0.4, tilt: 1}, mouth: 'pant', flush: 1}};
    }
    if (f2 < T.spoonLookUp) {
      return {...base, sweat, stand: {dy: 0, lean: SP.lean}, pose: {melt: meltT, meltSide: 1}, face: {eye: 'half', look: [-0.3, 0.6], brow: {raise: 0, tilt: 1.2}, mouth: 'wavy', flush: 0.8}};
    }
    // still melted: the eyes follow the boomerang (left → over the top → down onto the word), then the slam jolt
    const look = lookAt(f2, [
      [T.spoonLookUp, [-0.85, -0.5]],
      [108, [-0.3, -0.4]],
      [110, [0.4, -0.3]],
      [114, [0.85, -0.6]],
      [T.qafSlam, [0.6, -0.9]],
    ]);
    const jolt = f2 >= T.qafSlam && f2 < T.qafSlam + 4 ? [0.12, -0.05][(f2 - T.qafSlam) / 2] : 0;
    return {...base, sweat, stand: {dy: 0, lean: SP.lean}, pose: {melt: meltT, meltSide: 1, squash: jolt}, face: {eye: f2 >= T.qafSlam ? 'big' : 'half', look, brow: {raise: 0.4, tilt: 0.8}, mouth: f2 >= T.qafSlam ? 'o' : 'wavy', flush: 0.6}};
  }
  // ---- ACT 3: boing back into shape
  if (f2 < T.spoonCrouch) {
    const k = (f2 - T.spoonBoing) / 2;
    const melt = [0.3, 0, 0, 0][Math.min(3, k)];
    const sq = [0, -0.24, 0.12, -0.05, 0.02, 0][Math.min(5, k)];
    const bend = jiggle(f2, T.spoonBoing + 2, 0.22, 1.2, 0.22);
    // reading the title as it lands, then the brand letter
    const look = lookAt(f2, [
      [T.spoonBoing, [0.3, -0.7]],
      [T.title1, [0.2, -0.95]],
      [T.strike[0], [-0.1, -0.95]],
      [T.title3Qaf, [0.25, -0.95]],
    ]);
    const mouth = f2 >= T.strike[0] && f2 < T.title3Qaf ? 'o' : 'grin';
    return {...base, stand: {dy: 0, lean: SP.lean}, pose: {melt, meltSide: 1, squash: sq, bend}, face: {eye: 'spark', look, brow: {raise: 0.9, tilt: -0.2}, mouth, blush: 0.8}};
  }
  // ---- ACT 4: crouch → leap → dive → nom → pull → flip → land with a heaped spoonful
  if (f2 < T.spoonJump) {
    const sq = f2 < T.spoonCrouch + 2 ? 0.2 : 0.3;
    return {...base, stand: {dy: 0, lean: SP.lean + 4}, pose: {squash: sq, bend: 0.1}, face: {eye: 'spark', look: [0.9, 0.2], brow: {raise: -0.5, tilt: -0.8}, mouth: 'grin', blush: 0.6}};
  }
  if (f2 < T.spoonDive) {
    const L0 = LEAP[f2] ?? LEAP[T.spoonJump + 8];
    return {...base, fly: {head: L0.h, rot: L0.r}, pose: {squash: L0.sq}, face: {eye: 'closed', brow: {raise: 0.8}, mouth: 'grin', blush: 0.8}};
  }
  if (f2 < T.spoonPull[0]) {
    // only the handle sticks out, wiggling: nom … nom … nom
    const k = (f2 - T.spoonDive) / 2;
    const r = DIVE_ROT + [4, -5, 6, -4, 4, -2][Math.min(5, k)];
    const bob = [0, 6, -3, 6, -2, 4][Math.min(5, k)];
    const h = diveHead(DIVE_DEPTH);
    return {...base, dive: true, fly: {head: [h[0], h[1] + bob], rot: r}, pose: {}, face: {eye: 'closed', mouth: 'bliss', blush: 1}};
  }
  if (f2 < T.spoonFlip[0]) {
    const P = PULL[f2] ?? PULL[T.spoonPull[0] + 14];
    return {...base, dive: f2 < T.spoonPull[0] + 6, load: 1, coat: 0.55, fly: {head: P.h, rot: P.r}, pose: {squash: f2 < T.strandSnap ? -0.08 : 0}, face: {eye: 'closed', mouth: 'bliss', blush: 1}};
  }
  if (f2 < T.spoonLand) {
    const F = FLIP[f2] ?? FLIP[256];
    return {...base, load: 1, coat: 0.55, fly: {head: F.h, rot: F.r}, pose: {squash: F.sq}, face: {eye: 'closed', mouth: 'bliss', blush: 1}};
  }
  const k = (f2 - T.spoonLand) / 2;
  const sq = [0.26, -0.1, 0.05, 0][Math.min(3, k)];
  return {...base, load: 1, coat: 0.55, stand: {dy: 0, lean: SP.lean - 2 + 2 * Math.sin(f2 * 0.2)}, pose: {squash: sq, bend: -0.04}, face: {eye: 'closed', brow: {raise: 0.7}, mouth: 'bliss', blush: 1}};
};

const spoonTransform = (s: SpoonState) => {
  if (s.fly) {
    const hl = spoonHead(s.pose).head;
    return `translate(${s.fly.head[0]} ${s.fly.head[1]}) rotate(${s.fly.rot}) scale(${SP.scale}) translate(${-hl[0]} ${-hl[1]})`;
  }
  const st = s.stand ?? {dy: 0, lean: SP.lean};
  return `translate(${SP.x} ${SP.base + st.dy}) rotate(${st.lean}) scale(${SP.scale})`;
};
/** world position of the spoon's head (for the bubble tail, sweat, the strand) */
const spoonHeadWorld = (s: SpoonState): {p: Pt; rot: number} => {
  if (s.fly) return {p: s.fly.head, rot: s.fly.rot};
  const st = s.stand ?? {dy: 0, lean: SP.lean};
  const hl = spoonHead(s.pose).head;
  const r = deg(st.lean);
  return {p: [SP.x + (hl[0] * Math.cos(r) - hl[1] * Math.sin(r)) * SP.scale, SP.base + st.dy + (hl[0] * Math.sin(r) + hl[1] * Math.cos(r)) * SP.scale], rot: st.lean};
};

/** big cartoon sweat drops flicking off the head (world px), redrawn on twos */
const SweatDrops: React.FC<{f2: number; at: Pt; amount: number}> = ({f2, at, amount}) => {
  if (amount <= 0) return null;
  const SPOTS: {p: Pt; d: Pt}[] = [
    {p: [-70, -40], d: [-1, -0.6]},
    {p: [72, -60], d: [1, -0.8]},
    {p: [-60, -110], d: [-1, -1]},
    {p: [64, 10], d: [1, -0.3]},
  ];
  return (
    <g>
      {SPOTS.map((sp, j) => {
        const ph = ((f2 + j * 6) % 16) / 16;
        const len = 20 + 120 * ph;
        const x = at[0] + sp.p[0] + sp.d[0] * len;
        const y = at[1] + sp.p[1] + sp.d[1] * len + 170 * ph * ph;
        const r = 15 * (1 - 0.35 * ph);
        const a = (Math.atan2(sp.d[1] + 2.4 * ph, sp.d[0]) * 180) / Math.PI + 90;
        return (
          <g key={j} transform={`translate(${x} ${y}) rotate(${a})`} opacity={amount * (ph < 0.8 ? 1 : (1 - ph) / 0.2)}>
            <path d={`M0 ${-r * 1.9}C${r * 0.5} ${-r * 0.8} ${r} ${-r * 0.2} ${r} ${r * 0.35}C${r} ${r * 1.05} ${-r} ${r * 1.05} ${-r} ${r * 0.35}C${-r} ${-r * 0.2} ${-r * 0.5} ${-r * 0.8} 0 ${-r * 1.9}Z`} fill="#BDF3FF" stroke={C.teal} strokeWidth={3.6} />
            <ellipse cx={-r * 0.35} cy={r * 0.1} rx={r * 0.22} ry={r * 0.36} fill={C.white} />
          </g>
        );
      })}
    </g>
  );
};

/** the collar while the spoon is in, the crater the spoonful leaves in the dome's flank, and the stretchy strand.
 *  Drawn in a local frame at ENTRY: +x = out of the dome along the dive axis (towards the handle), y = across. */
const diveLayers = (f2: number, head: Pt, rot: number): {crater: React.ReactNode; strand: React.ReactNode; front: React.ReactNode} => {
  const collarOn = f2 >= T.spoonDive && f2 < T.spoonPull[0] + 6;
  const craterOn = f2 >= T.spoonPull[0];
  const axisDeg = (Math.atan2(DIVE_AXIS[1], DIVE_AXIS[0]) * 180) / Math.PI;
  const local = `translate(${ENTRY[0]} ${ENTRY[1]}) rotate(${axisDeg})`;
  // the heap's far end: head-local (0, −205) → world (it points back into the crater while the spoon pulls out)
  const r = deg(rot);
  const tipL: Pt = [0, -205 * SP.scale];
  const tip: Pt = [head[0] + tipL[0] * Math.cos(r) - tipL[1] * Math.sin(r), head[1] + tipL[0] * Math.sin(r) + tipL[1] * Math.cos(r)];
  const tipOut = (tip[0] - ENTRY[0]) * DIVE_AXIS[0] + (tip[1] - ENTRY[1]) * DIVE_AXIS[1]; // > 0: out of the dome
  // the strand: a thick, glossy rope of qashta from the crater to the spoonful — wide where it leaves each mass, necking
  // in the middle as it stretches, sagging; ink only along its two sides (they taper off into the masses)
  let strandEl: React.ReactNode = null;
  if (f2 >= T.spoonPull[0] && f2 < T.strandSnap + 4 && tipOut > 0) {
    const snapped = f2 >= T.strandSnap;
    const len = Math.hypot(tip[0] - ENTRY[0], tip[1] - ENTRY[1]);
    const k = clamp01(len / 300);
    const a: Pt = [ENTRY[0] + DIVE_AXIS[0] * -10, ENTRY[1] + DIVE_AXIS[1] * -10];
    const b: Pt = snapped ? [a[0] + (tip[0] - a[0]) * 0.32, a[1] + (tip[1] - a[1]) * 0.32 + 14] : [tip[0] + (head[0] - tip[0]) * 0.3, tip[1] + (head[1] - tip[1]) * 0.3];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const Ls = Math.hypot(dx, dy) || 1;
    const nx = -dy / Ls;
    const ny = dx / Ls;
    const n = 24;
    const L1: Pt[] = [];
    const R1: Pt[] = [];
    const shade: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(Math.PI * t) * 46 * k;
      const px = a[0] + dx * t;
      const py = a[1] + dy * t + sag;
      const wEnd = snapped ? (t < 0.5 ? 70 : 14) : t < 0.5 ? 78 : 70;
      const wMid = snapped ? 10 : 58 * (1 - 0.72 * k);
      const bell = Math.sin(Math.PI * t) ** 0.9;
      const w = (wEnd + (wMid - wEnd) * bell) / 2;
      L1.push([px + nx * w, py + ny * w]);
      R1.push([px - nx * w, py - ny * w]);
      shade.push([px - nx * w * 0.25, py - ny * w * 0.25]);
    }
    const body = smoothD([...L1, ...R1.slice().reverse()], true);
    const under = ny > 0 ? L1 : R1; // the lower side gets the shade band
    const over = ny > 0 ? R1 : L1;
    const shadeBand = smoothD([...under, ...shade.slice().reverse()], true);
    strandEl = (
      <g>
        <path d={body} fill={C.cream} />
        <path d={shadeBand} fill={C.creamShade} />
        <path d={brush(over.slice(4, n - 4).map(([x, y]) => [x - (ny > 0 ? -nx : nx) * 9, y - (ny > 0 ? -ny : ny) * 9] as Pt), {w: 7, taper: [0.35, 0.35], tip: 0.05, dense: true, seed: 140})} fill={C.white} />
        <path d={brush(L1, {w: 5, dense: true, taper: [0.22, 0.22], tip: 0.02, seed: 141})} fill={INK} />
        <path d={brush(R1, {w: 5, dense: true, taper: [0.22, 0.22], tip: 0.02, seed: 142})} fill={INK} />
      </g>
    );
  }
  const collar = blobPts(0, 0, 18, 52, 0.14, 5 + (f2 % 4), 20, 2);
  return {
    crater: craterOn ? (
      // the scoop's dent in the dome: a shadowed crescent inside the hollow, a thin ink arc, a lit lip
      <g>
        <path d={shapeD(blobPts(ENTRY[0], ENTRY[1], 24, 38, 0.12, 31, 20, 2, -0.35))} fill="#DDBF8D" />
        <path d={shapeD(blobPts(ENTRY[0] + 7, ENTRY[1] + 6, 22, 35, 0.12, 31, 20, 2, -0.35))} fill={C.cream} />
        <path d={brush(blobPts(ENTRY[0], ENTRY[1], 24, 38, 0.12, 31, 20, 2, -0.35).slice(9, 17), {w: 4, dense: true, taper: [0.3, 0.3], tip: 0.1, seed: 33})} fill={INK} opacity={0.85} />
        <path d={brush(blobPts(ENTRY[0] + 7, ENTRY[1] + 6, 22, 35, 0.12, 31, 20, 2, -0.35).slice(1, 6), {w: 4.5, dense: true, taper: [0.3, 0.3], tip: 0.1, seed: 35})} fill={C.white} />
      </g>
    ) : null,
    strand: strandEl,
    front: (
      <g>
        {collarOn ? (
          <g transform={local}>
            <path d={shapeD(collar)} fill={C.cream} />
            <path d={brush(collar, {w: 4.5, closed: true, start: 0.6, seed: 7})} fill={INK} />
            <path d={brush([[6, -30], [10, -12]], {w: 5, taper: [0.3, 0.3], seed: 9})} fill={C.white} />
          </g>
        ) : null}
        {/* splash beads on the dive, thrown out of the flank */}
        {f2 >= T.spoonDive && f2 < T.spoonDive + 8
          ? [0, 1, 2, 3, 4].map((j) => {
              const t = (f2 - T.spoonDive + 2) / 10;
              const rr = rng(80 + j);
              const ang = deg(axisDeg) + (j - 2) * 0.45 + (rr() - 0.5) * 0.3;
              const d = 34 + 100 * easeOutCubic(t);
              return <circle key={j} cx={ENTRY[0] + Math.cos(ang) * d} cy={ENTRY[1] + Math.sin(ang) * d + 180 * t * t} r={(10 - j) * (1 - t * 0.6)} fill={C.cream} stroke={INK} strokeWidth={2.8} />;
            })
          : null}
      </g>
    ),
  };
};

// ------------------------------------------------------------------------------------------------ the spoon on the end card
// The hero doesn't vanish under the kit's sheet: it hops onto the card from the right (it fills the beat where the
// sheet is in but nothing has landed yet), lands upright, gets jolted by the cup plopping down beside it, leans on the
// cup with its heaped spoonful — blissful — and turns to us when the comment bubble asks «فريق قشطة ولا فريق شطة؟».
// Screen px (the end card has no camera). Drawings on twos.
const ES = L.ecSpoon;
const EC_HOPS = EC.dotHops.map((d) => T.endCard + d);
const EC_HOP: Record<number, {h: Pt; r: number; sq: number}> = {
  274: {h: [1170, 940], r: 40, sq: -0.24},
  276: {h: [975, 662], r: 27, sq: -0.12},
  278: {h: [800, 548], r: 14, sq: 0.02},
  280: {h: [640, 566], r: 2, sq: -0.16},
};
type EcSpoon = {stand?: {lean: number}; fly?: {head: Pt; rot: number}; pose: SpoonPose; face: SpoonFace};
const ecSpoonState = (f2: number): EcSpoon | null => {
  if (f2 < T.ecSpoonHop) return null;
  const bliss: SpoonFace = {eye: 'closed', brow: {raise: 0.7}, mouth: 'bliss', blush: 1};
  if (f2 < T.ecSpoonLand) {
    const k = EC_HOP[f2] ?? EC_HOP[T.ecSpoonLand - 2];
    return {fly: {head: k.h, rot: k.r}, pose: {squash: k.sq}, face: bliss};
  }
  if (f2 < T.ecSpoonLean) {
    // land (squash) → the cup plops down beside it: a jolt and a look → it leans in
    const keys: {lean: number; sq: number; face: SpoonFace}[] = [
      {lean: -6, sq: 0.26, face: {eye: 'spark', look: [0.3, -0.3], brow: {raise: 0.8}, mouth: 'grin', blush: 0.8}},
      {lean: -2, sq: -0.1, face: {eye: 'big', look: [-0.9, 0.15], brow: {raise: 1.1, tilt: 0.4}, mouth: 'o'}},
      {lean: -8, sq: 0.04, face: {eye: 'spark', look: [-0.8, 0.2], brow: {raise: 0.8}, mouth: 'grin', blush: 0.8}},
    ];
    const K = keys[Math.min(2, (f2 - T.ecSpoonLand) / 2)];
    return {stand: {lean: K.lean}, pose: {squash: K.sq}, face: K.face};
  }
  const lean = f2 < T.ecSpoonLean + 2 ? -13 : ES.lean + (f2 >= T.ecSpoonLean + 4 ? 0.9 * Math.sin((f2 - T.ecSpoonLean) * 0.16) : 0);
  // it bobs with the logo's dot hops (the «تشك-تشك» echoes)
  const bob = EC_HOPS.some((h) => f2 >= h && f2 < h + 2) ? 0.08 : EC_HOPS.some((h) => f2 >= h + 2 && f2 < h + 4) ? -0.03 : 0;
  const face: SpoonFace = f2 >= T.ecSpoonLook ? {eye: 'spark', look: [0.05, 0.05], brow: {raise: 0.6, tilt: -0.2}, mouth: 'grin', blush: 0.8} : bliss;
  return {stand: {lean}, pose: {squash: bob, bend: -0.03}, face};
};
const ecSpoonTransform = (s: EcSpoon) => {
  if (s.fly) {
    const hl = spoonHead(s.pose).head;
    return `translate(${s.fly.head[0]} ${s.fly.head[1]}) rotate(${s.fly.rot}) scale(${ES.scale}) translate(${-hl[0]} ${-hl[1]})`;
  }
  return `translate(${ES.x} ${ES.base}) rotate(${s.stand?.lean ?? 0}) scale(${ES.scale})`;
};

// ------------------------------------------------------------------------------------------------ the hand
const handPose = (f2: number): FlickPose => (f2 < T.windup ? 'cocked' : f2 < T.flick ? 'strain' : f2 < T.flick + 2 ? 'smear' : f2 < T.flick + 6 ? 'flicked' : 'relaxed');

// ------------------------------------------------------------------------------------------------ the spot
export const QafDifference: React.FC<QafDifferenceProps> = ({audio}) => {
  const f = useCurrentFrame();
  const f2 = onTwos(f);
  const cam = camAt(f);
  const shake = shakeAt(f, [
    {at: T.flick, amp: 8},
    {at: T.bloom, amp: 8},
    {at: T.qafSlam, amp: 24},
    {at: T.dotLand[0], amp: 5},
    {at: T.dotLand[1], amp: 6},
    {at: T.wave, amp: 9},
    {at: T.title3Qaf + 2, amp: 9},
    {at: T.spoonDive, amp: 6},
    {at: T.spoonLand, amp: 4},
  ]);
  const bgCam = parallax(cam, 0.55);
  const bgShake: Pt = [shake[0] * 0.5, shake[1] * 0.5];

  // ---- bloom (red) and wave (turquoise) regions, world → screen for the backdrop mask
  const bloomT = f2 < T.bloom ? 0 : clamp01((f2 - T.bloom + 2) / (T.bloomFull - T.bloom + 2)) ** 0.9;
  const waveT = f2 < T.wave ? 0 : clamp01((f2 - T.wave + 2) / (T.waveEnd - T.wave + 2)) ** 1.1;
  const redVisible = bloomT > 0 && waveT < 1;
  const bloomPts = bloomT > 0 && bloomT < 1 ? spreadPts(WORD_C, 60 + bloomT * BLOOM_R, f, 3, 0.11) : null;
  const wavePts = waveT > 0 && waveT < 1 ? waveFront(QAF_HOME, 40 + waveT * WAVE_R, f) : null;
  const scr = (pts: Pt[]) => pts.map((p) => toScreen(cam, p, shake));
  let redClip: string | undefined;
  if (redVisible) {
    const full = 'M-200 -200L1280 -200L1280 2120L-200 2120Z';
    const outer = bloomPts ? ptsToPath(scr(bloomPts)) : full;
    redClip = `path(evenodd, '${outer}${wavePts ? ptsToPath(scr(wavePts)) : ''}')`;
  }
  // is a world point inside the red region right now?
  const inRed = (p: Pt) => {
    if (!redVisible) return false;
    const dB = Math.hypot(p[0] - WORD_C[0], p[1] - WORD_C[1]);
    const dW = Math.hypot(p[0] - QAF_HOME[0], p[1] - QAF_HOME[1]);
    return (bloomT >= 1 || dB < 60 + bloomT * BLOOM_R) && !(waveT > 0 && dW < 40 + waveT * WAVE_R);
  };

  // ---- cup: chili fill (rising level), then the wave washes it back
  const fillT = f2 < T.cupFill[0] ? 0 : easeInOutCubic(clamp01((f2 - T.cupFill[0]) / (T.cupFill[1] - T.cupFill[0])));
  const chiliOn = fillT > 0 && waveT < 1;
  let chiliClip: string | undefined;
  if (chiliOn) {
    if (fillT < 1) {
      const lvl = cupArtY(940 - fillT * 900);
      const x0 = CUP.x - 330;
      const x1 = CUP.x + 330;
      let d = `M${x0} ${CUP.base + 100}`;
      for (let i = 0; i <= 16; i++) {
        const x = x0 + ((x1 - x0) * i) / 16;
        d += `L${x.toFixed(1)} ${(lvl + 9 * Math.sin(i * 1.3 + f2 * 0.7) + 5 * Math.sin(i * 2.9 - f2)).toFixed(1)}`;
      }
      d += `L${x1} ${CUP.base + 100}Z`;
      chiliClip = `path('${d}')`;
    } else if (wavePts) {
      chiliClip = `path(evenodd, 'M-1000 -1000L3000 -1000L3000 3000L-1000 3000Z${ptsToPath(wavePts)}')`;
    }
  }
  const qashtaHoney = f2 < T.wave ? 1 : f2 < T.honey[0] ? 0 : easeInOutCubic(clamp01((f2 - T.honey[0]) / (T.honey[1] - T.honey[0])));
  const cupFlames = T.cupFlames.map((at) => flameScale(f2, at, T.cupFlamesOut));

  // ---- the spoon
  const sp = spoonState(f2);
  const spHead = spoonHeadWorld(sp);
  const tint = inRed(spHead.p) ? C.chili : C.turquoise;
  const dive = diveLayers(f2, spHead.p, spHead.rot);
  const spoonGlint = clamp01((f - T.spoonGlint) / 12);
  // the dive mask: hide the part of the spoon inside the dome, past the entry line (perpendicular to the spoon axis)
  const axis: Pt = [-Math.sin(deg(spHead.rot)), Math.cos(deg(spHead.rot))]; // head → foot direction
  const nrm: Pt = [-axis[1], axis[0]];
  const E = ENTRY;
  const halfPlane = `M${E[0] + nrm[0] * 900} ${E[1] + nrm[1] * 900}L${E[0] - nrm[0] * 900} ${E[1] - nrm[1] * 900}L${E[0] - nrm[0] * 900 - axis[0] * 900} ${E[1] - nrm[1] * 900 - axis[1] * 900}L${E[0] + nrm[0] * 900 - axis[0] * 900} ${E[1] + nrm[1] * 900 - axis[1] * 900}Z`;

  // ---- word
  const {qaf, trail} = qafState(f2);
  const {drops, free} = dropsState(f2);
  const shin: 'medial' | 'initial' = f2 >= T.heal && f2 < T.qafSlam ? 'initial' : 'medial';
  const burn = f2 < T.bloom + 2 ? 0 : f2 < T.flamesOut ? clamp01((f2 - T.bloom - 2) / 6) : clamp01(1 - (f2 - T.flamesOut) / 8);
  const wordFlames = T.ignite.map((at) => flameScale(f2, at, T.flamesOut));
  const wordSquash = f2 >= T.qafSlam && f2 < T.qafSlam + 8 ? [0.1, -0.05, 0.025, 0][(f2 - T.qafSlam) / 2] : f2 === T.heal ? 0.04 : 0;
  const wordExit = f2 >= T.wordOut ? (f2 - T.wordOut) / 2 : -1;
  const plate = f2 >= T.bloom + 4 && f2 < T.wave + 8 ? C.chiliDeep : C.turquoiseDeep;

  // ---- hand
  const handOn = f2 < T.handOut[1];
  const pose = handPose(f2);
  const squeeze = f2 < T.windup ? 0.25 : f2 < T.flick ? clamp01((f2 - T.windup + 2) / 6) : 0;
  const ARM: Pt = [Math.cos(deg(L.hand.rot)), Math.sin(deg(L.hand.rot))];
  const windBack = f2 < T.windup ? 0 : f2 < T.flick ? 18 * clamp01((f2 - T.windup + 2) / 6) : f2 < T.flick + 2 ? -10 : 0;
  const handTremble: Pt = f2 < T.flick ? [((f2 / 2) % 2 ? 1 : -1) * (0.8 + squeeze * 2.4), ((f2 / 2) % 3) - 1] : [0, 0];
  const out = f2 < T.handOut[0] ? 0 : easeInCubic(clamp01((f2 - T.handOut[0]) / (T.handOut[1] - T.handOut[0]))) * 1200;
  const hx = L.hand.nail[0] + ARM[0] * (windBack + out) + handTremble[0];
  const hy = L.hand.nail[1] + ARM[1] * (windBack + out) + handTremble[1];
  const handT = `translate(${hx} ${hy}) rotate(${L.hand.rot}) scale(${L.hand.scale}) translate(${-NAIL_COCKED[0]} ${-NAIL_COCKED[1]})`;

  // ---- splashes when the drops land
  const splash = (i: number) => {
    const t = (f2 - T.dotLand[i]) / 10;
    if (t < 0 || t >= 1) return null;
    const h = dropHome(i);
    const r = rng(60 + i);
    return (
      <g key={`sp${i}`}>
        {[0, 1, 2, 3, 4].map((j) => {
          const a = -Math.PI * (0.1 + 0.8 * (j / 4)) + (r() - 0.5) * 0.3;
          const d = 18 + 76 * easeOutCubic(t);
          const y = h[1] + Math.sin(a) * d * 0.8 + 120 * t * t;
          const rr = (8 - j * 0.6) * (1 - t * 0.7);
          return <circle key={j} cx={h[0] + Math.cos(a) * d} cy={y} r={rr} fill={C.cream} stroke={C.teal} strokeWidth={2.6} />;
        })}
      </g>
    );
  };

  const bubbleTail = toScreen(cam, [spHead.p[0] + 40, spHead.p[1] - 96 * SP.scale], shake);

  return (
    <AbsoluteFill style={{background: C.turquoise, overflow: 'hidden'}}>
      {audio ? <Audio src={staticFile(audio)} /> : null}
      {/* ---------------- backdrops (far plane) */}
      <AbsoluteFill style={{transform: camCss(bgCam, bgShake), transformOrigin: '0 0'}}>
        <QashtaPaper frame={f} />
      </AbsoluteFill>
      {redVisible ? (
        <AbsoluteFill style={{clipPath: redClip}}>
          <AbsoluteFill style={{transform: camCss(bgCam, bgShake), transformOrigin: '0 0'}}>
            <ChiliPaper frame={f} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* ---------------- the world (camera) */}
      <AbsoluteFill style={{transform: camCss(cam, shake), transformOrigin: '0 0'}}>
        {bloomPts ? (
          <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
            <BloomEdge pts={bloomPts} w={9} />
          </svg>
        ) : null}

        <HeroCup2D
          x={CUP.x}
          y={CUP.base}
          scale={CUP.scale}
          honeyProgress={qashtaHoney}
          wobble={jiggle(f2, T.waveOverCup, 0.8, 0.9, 0.2) + jiggle(f2, T.spoonDive, 0.6, 1, 0.22) + jiggle(f2, T.strandSnap, 0.5, 1, 0.25)}
          squash={jiggle(f2, T.waveOverCup, 0.06, 1, 0.25) + jiggle(f2, T.spoonDive, 0.05, 1, 0.3)}
          glint={clamp01((f - T.cupGlint) / 14)}
          frame={f}
        />
        {chiliOn ? (
          <AbsoluteFill style={{clipPath: chiliClip}}>
            <HeroCup2D x={CUP.x} y={CUP.base} scale={CUP.scale} variant="chili" heat={f2 >= T.cupFill[1] ? 1 : 0} squash={f2 >= T.spoonGulp ? 0.02 * Math.sin(f2 * 1.7) : 0} frame={f} />
          </AbsoluteFill>
        ) : null}
        <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
          {CUP_ANCHORS.flames.map((p, i) => {
            const s = cupFlames[i];
            if (s <= 0.01) return null;
            const [x, y] = cupAt(p);
            return (
              <g key={i} transform={`translate(${x} ${y + 14}) scale(${s})`}>
                <FlameArt h={[125, 170, 135][i]} seed={i + 11} frame={f} />
              </g>
            );
          })}
          {CUP_ANCHORS.flames.map((p, i) => {
            const [x, y] = cupAt(p);
            return <Puff key={`cp${i}`} x={x} y={y - 20} t={(f2 - T.cupFlamesOut - i * 2) / 14} size={72} seed={30 + i} />;
          })}
          {wavePts ? <WaveCrest c={QAF_HOME} r={40 + waveT * WAVE_R} frame={f} w={84} /> : null}
          {dive.crater}
        </svg>

        {/* the spoon */}
        <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
          <defs>
            <clipPath id="qafDomeClip">
              <ellipse cx={DOME.cx} cy={DOME.cy} rx={DOME.rx} ry={DOME.ry} />
              <path d={CUP_BODY} />
            </clipPath>
            <mask id="qafDiveMask" maskUnits="userSpaceOnUse" x={-500} y={-500} width={2100} height={2900}>
              <rect x={-500} y={-500} width={2100} height={2900} fill="#fff" />
              <g clipPath="url(#qafDomeClip)">
                <path d={halfPlane} fill="#000" />
              </g>
            </mask>
          </defs>
          {dive.strand}
          <g mask={sp.dive ? 'url(#qafDiveMask)' : undefined}>
            <g transform={spoonTransform(sp)}>
              <SpoonBuddy frame={f} pose={sp.pose} face={sp.face} tint={tint} load={sp.load} coat={sp.coat} shadow={!sp.fly} bead={sp.bead ?? 0} shock={sp.shock ?? 0} />
            </g>
          </g>
          {dive.front}
          <SweatDrops f2={f2} at={spHead.p} amount={sp.sweat} />
          {spoonGlint > 0 && spoonGlint < 1 ? <Glint x={spHead.p[0] - 40} y={spHead.p[1] - 50} s={1.3 * Math.sin(Math.PI * spoonGlint)} /> : null}
        </svg>

        {/* the big word */}
        {wordExit < 3 ? (
          <AbsoluteFill
            style={
              wordExit >= 0
                ? {
                    // lifts off the paper: up and towards the camera, three drawings
                    transform: `translateY(${[-6, -24, -50][wordExit]}px) scale(${[1.04, 1.12, 1.22][wordExit]})`,
                    transformOrigin: `${L.word.cx}px ${L.word.baseline - 110}px`,
                    opacity: [1, 0.6, 0.25][wordExit],
                  }
                : undefined
            }
          >
            {trail.length > 1 ? (
              // speed lines behind the spinning letter (three tapered ink strokes along its path, redrawn on twos)
              <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
                {[-1, 0, 1].map((o) => {
                  const pts = trail.map(([x, y], i, arr) => {
                    const nb = arr[Math.min(arr.length - 1, i + 1)];
                    const pa = arr[Math.max(0, i - 1)];
                    const dx = nb[0] - pa[0];
                    const dy = nb[1] - pa[1];
                    const L = Math.hypot(dx, dy) || 1;
                    return [x - (dy / L) * o * 30, y + (dx / L) * o * 30] as Pt;
                  });
                  return <path key={o} d={brush(pts, {w: o === 0 ? 9 : 6, taper: [0.9, 0.05], tip: 0.05, seed: 150 + o + f2})} fill={INK} opacity={0.75} />;
                })}
              </svg>
            ) : null}
            <QafWord
              frame={f}
              cx={L.word.cx}
              baseline={L.word.baseline}
              k={L.word.k}
              qaf={qaf}
              drops={drops}
              dropsFree={free}
              shin={shin}
              burn={burn}
              flames={wordFlames}
              plate={plate}
              squash={wordSquash}
              sparks={f2 >= T.flick ? (f - T.flick) / 8 : 0}
            />
            <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
              {splash(0)}
              {splash(1)}
              {f2 < T.flick
                ? [0, 1].map((i) => {
                    // nervous shiver ticks beside each drop (comic emanata), alternating on twos
                    const h = dropHome(i);
                    const s2 = (f2 / 2) % 2;
                    const side = i === 0 ? -1 : 1;
                    const x0 = h[0] + side * (34 + 4 * s2);
                    return (
                      <g key={`nv${i}`}>
                        <path d={brush([[x0, h[1] - 64], [x0 + side * 14, h[1] - 54]], {w: 6, taper: [0.2, 0.5], tip: 0.2, seed: 170 + i})} fill={INK} />
                        <path d={brush([[x0 + side * 2, h[1] - 36], [x0 + side * 18, h[1] - 34]], {w: 6, taper: [0.2, 0.5], tip: 0.2, seed: 172 + i})} fill={INK} />
                      </g>
                    );
                  })
                : null}
              {WORD_FLAMES.map((F, i) => {
                const p = WG.at(F.ux, F.uy);
                return <Puff key={i} x={p[0]} y={p[1] - 30} t={(f2 - T.flamesOut - i * 2) / 14} size={84} seed={i + 3} />;
              })}
            </svg>
          </AbsoluteFill>
        ) : null}

        {/* the hand */}
        {handOn ? (
          <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
            <g transform={handT}>
              <FlickHandArt pose={pose} rot={L.hand.rot} squeeze={squeeze} frame={f} />
            </g>
          </svg>
        ) : null}
      </AbsoluteFill>

      {/* ---------------- the spoon's line (screen space: stays put and readable while the camera pushes in) */}
      <SpeechBubble
        x={330}
        y={300}
        text={COPY.bubble}
        start={T.bubble}
        exit={T.bubbleOut}
        shape="burst"
        fontSize={78}
        tail={bubbleTail}
        rotate={-5}
        seed={11}
        fill={C.flameYellow}
      />

      {/* ---------------- the line (screen space, inside SAFE) */}
      {f2 >= T.title1 - 2 ? (
        <>
          <VectorLine run={RUNS.title1} frame={f} cx={L.title.cx} baseline={L.title.y1} k={L.title.k1} words={[{start: T.title1}, {start: T.title1 + T.titleStagger}]} rotate={-2} />
          <VectorLine
            run={RUNS.title2}
            frame={f}
            cx={L.title.cx}
            baseline={L.title.y2}
            k={L.title.k2}
            words={[{start: T.title1 + 2 * T.titleStagger, exit: T.swapOut}]}
            rotate={-2}
            strike={f2 >= T.strike[0] ? clamp01((f2 - T.strike[0] + 2) / (T.strike[1] - T.strike[0] + 2)) : 0}
          />
          <VectorLine
            run={RUNS.title3}
            frame={f}
            cx={L.title.cx}
            baseline={L.title.y2}
            k={L.title.k2}
            words={[{start: T.title3}, {start: T.title3Qaf, hops: [...T.qafHops], hopH: 46}]}
            qafGlyph="uni0642"
            rotate={-2}
          />
        </>
      ) : null}

      <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION}>
        <EndCard2D comment={COPY.comment} grain={false} />
      </Sequence>
      {(() => {
        const es = ecSpoonState(f2);
        if (!es) return null;
        return (
          <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <g transform={ecSpoonTransform(es)}>
              <SpoonBuddy frame={f} pose={es.pose} face={es.face} tint={C.turquoise} load={1} coat={0.55} shadow={!!es.stand} />
            </g>
          </svg>
        );
      })()}

      <PaperGrain />
    </AbsoluteFill>
  );
};
