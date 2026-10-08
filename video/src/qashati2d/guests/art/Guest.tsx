// <Guest/> — the six surprise guests of «ضيوف فجأة», hand-inked busts that ACT: expressions (eyes / mouth / brows),
// head turn, a waving hand, a finjan of coffee, a spoon of qashta, a caffeine shake. Same characters in every shot:
// peephole (fisheye), doorway, sofa + coffee, the qashati feast.
//
//   khala  — Shami auntie, plum hijab, mustard top, gold bracelets (the loud one)
//   amo    — the uncle: bald crown, big moustache, round glasses, striped shirt
//   jiddo  — grandpa: white ghutra + black agal, short grey beard, kandura with its tassel
//   teta   — grandma: lavender scarf, grey fringe, tortoiseshell glasses, green cardigan
//   walad  — the boy: curly hair, gap-tooth grin, the dino hoodie (the same kid as the spoon spot)
//   bint   — the little girl: bob, bangs, two puffs with red bows, yellow dress
//
// Local art space: head centre (0,0); face ≈ ±92 wide, top ≈ −105, chin ≈ +112; the body runs down to y ≈ 640.
// Place inside an <svg> with x/y (head centre, parent units) and scale. Drawings step on twos (feed onTwos frames for
// the pose props); the ink boils by itself.
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, C, ellipsePts, Halftone, INK, Pt, rng, shapeD, smoothD, SpoonArt, stackOutline, useBoil} from '../../kit/lib';
import {capsule, dotD, heartPts, mir, rot, scatter, shrink, sym, tr, tube} from './draw';

export type GuestId = 'khala' | 'amo' | 'jiddo' | 'teta' | 'walad' | 'bint';
export type EyeState = 'open' | 'smile' | 'wide' | 'hearts' | 'closed' | 'blink';
export type MouthState = 'grin' | 'smile' | 'o' | 'chew' | 'flat' | 'yum';
export type ArmPose = 'none' | 'wave' | 'cup' | 'spoon';

export type GuestProps = {
  id: GuestId;
  x?: number;
  y?: number;
  scale?: number;
  /** head tilt (deg) */
  tilt?: number;
  eyes?: EyeState;
  mouth?: MouthState;
  /** pupils −1..1 */
  look?: Pt;
  /** head turn −1 (to screen left) … 1 (to screen right) */
  turn?: number;
  /** brows: −1 frown … 1 raised */
  brow?: number;
  blush?: number;
  arm?: ArmPose;
  /** which side the active arm is on (1 = screen right) */
  side?: 1 | -1;
  /** wave swing −1..1 (the hand rotates around the wrist) */
  wave?: number;
  /** cup shake (the «enough» shake) −1..1 */
  cupShake?: number;
  /** coffee in the finjan 0..1 */
  coffee?: number;
  /** qashta on the spoon (arm 'spoon') 0..1 */
  spoonLoad?: number;
  /** draw the shoulders / body */
  body?: boolean;
  /** squash (+) / stretch (−) of the whole bust, anchored at the chin */
  squash?: number;
  /** hearts pulse 0..1 (eyes='hearts') */
  pulse?: number;
  /** pupils shrink + tremble (caffeine) 0..1 */
  wired?: number;
  /** cross-eyed (pupils converge) 0..1 */
  cross?: number;
  /** face squashed flat against glass (the peephole smush) 0..1 */
  smush?: number;
  boil?: number;
  frame?: number;
  /** extra transform on the head only (e.g. the whip of a head-snap) */
  headDx?: number;
  headDy?: number;
};

// ------------------------------------------------------------------------------------------------ the cast
type FaceShape = {top: number; brow: number; cheek: number; jaw: number; chin: number; chinW: number};
type Look = {
  skin: 0 | 1 | 2 | 3 | 4;
  lid: number;
  face: FaceShape;
  eyeX: number;
  eyeY: number;
  eyeS: number;
  browW: number;
  browC: string;
  nose: 'button' | 'big' | 'long' | 'small';
  mouthY: number;
  mouthW: number;
  cloth: {base: string; shade: string; light: string};
  collar: 'top' | 'shirt' | 'kandura' | 'cardigan' | 'hoodie' | 'round';
  kid?: boolean;
};

export const GUEST_LOOK: Record<GuestId, Look> = {
  khala: {
    lid: 0.06,
    skin: 1,
    face: {top: 104, brow: 84, cheek: 94, jaw: 82, chin: 112, chinW: 42},
    eyeX: 37, eyeY: -6, eyeS: 1, browW: 5.5, browC: '#4A2232', nose: 'button', mouthY: 60, mouthW: 40,
    cloth: {base: '#E3A72F', shade: '#B37A12', light: '#F6CD6A'},
    collar: 'top',
  },
  amo: {
    lid: 0.26,
    skin: 3,
    face: {top: 114, brow: 86, cheek: 98, jaw: 96, chin: 116, chinW: 54},
    eyeX: 38, eyeY: -10, eyeS: 0.92, browW: 10, browC: '#221A17', nose: 'big', mouthY: 72, mouthW: 42,
    cloth: {base: '#9CC3E8', shade: '#6F9BC6', light: '#C9E0F5'},
    collar: 'shirt',
  },
  jiddo: {
    lid: 0.36,
    skin: 2,
    face: {top: 106, brow: 82, cheek: 90, jaw: 80, chin: 112, chinW: 42},
    eyeX: 36, eyeY: -8, eyeS: 0.95, browW: 7, browC: '#7B7D7A', nose: 'long', mouthY: 62, mouthW: 34,
    cloth: {base: '#FCFBF4', shade: '#D6DDD9', light: '#FFFFFF'},
    collar: 'kandura',
  },
  teta: {
    lid: 0.3,
    skin: 0,
    face: {top: 100, brow: 80, cheek: 88, jaw: 76, chin: 106, chinW: 38},
    eyeX: 35, eyeY: -4, eyeS: 0.9, browW: 4.5, browC: '#9A948C', nose: 'small', mouthY: 58, mouthW: 32,
    cloth: {base: '#4F8F64', shade: '#356B47', light: '#7DB58E'},
    collar: 'cardigan',
  },
  walad: {
    lid: 0,
    skin: 2,
    face: {top: 98, brow: 86, cheek: 92, jaw: 80, chin: 102, chinW: 46},
    eyeX: 36, eyeY: 2, eyeS: 1.18, browW: 6, browC: '#1F1714', nose: 'button', mouthY: 56, mouthW: 36,
    cloth: {base: '#6CC24A', shade: '#4A9A2E', light: '#A2DE7F'},
    collar: 'hoodie',
    kid: true,
  },
  bint: {
    lid: 0,
    skin: 1,
    face: {top: 96, brow: 84, cheek: 90, jaw: 76, chin: 100, chinW: 42},
    eyeX: 35, eyeY: 4, eyeS: 1.2, browW: 4.5, browC: '#3B241A', nose: 'small', mouthY: 54, mouthW: 26,
    cloth: {base: '#FFD23F', shade: '#E3A600', light: '#FFE98F'},
    collar: 'round',
    kid: true,
  },
};

const HIJAB = {base: '#8E2F60', shade: '#621B40', light: '#B4588A', dot: '#F5C6D9'};
const SCARF = {base: '#B9A3E0', shade: '#8A73BF', light: '#DCD0F4'};
const GHUTRA = {base: '#FCFBF4', shade: '#D3DAD6', deep: '#AEB8B3'};
const HAIR = {dark: '#241A16', darkLight: '#4E3B31', grey: '#7E807C', greyLight: '#B8BAB6', white: '#DCD8CF', brown: '#3B241A', brownLight: '#6A4434'};
const MOUTH = {in: '#5A1624', tongue: '#F07786', teeth: '#FFFDF6'};
const EYE_WHITE = '#FFFDF6';

// ------------------------------------------------------------------------------------------------ geometry
const faceHalf = (o: FaceShape): Pt[] => [
  [0, -o.top],
  [o.brow * 0.62, -o.top * 0.95],
  [o.brow, -o.top * 0.62],
  [o.cheek, -o.top * 0.12],
  [o.cheek * 0.98, o.chin * 0.3],
  [o.jaw, o.chin * 0.68],
  [o.chinW, o.chin * 0.95],
  [0, o.chin],
];
const facePts = (o: FaceShape, turn: number): Pt[] =>
  sym(faceHalf(o)).map(([x, y]) => {
    // a turned head: the lower face slides towards the turn, the far cheek flattens
    const k = Math.max(0, y / o.chin);
    const far = Math.sign(x) === -Math.sign(turn) ? 1 - 0.08 * Math.abs(turn) : 1 + 0.03 * Math.abs(turn);
    return [x * far + turn * 14 * k, y] as Pt;
  });

const bodyPts = (kid: boolean): Pt[] => {
  const s = kid ? 0.86 : 1;
  return sym([
    [0, 92],
    [38 * s, 96],
    [62 * s, 120],
    [122 * s, 140],
    [162 * s, 172],
    [182 * s, 236],
    [190 * s, 400],
    [194 * s, 660],
    [0, 660],
  ]);
};

// open hand, palm to camera, wrist at (0,0), fingers up. Fingers are drawn BEHIND the palm (the palm's outline covers
// their bases) — the classic cartoon hand build, no boolean union needed.
const openHand = (s = 1) => {
  const palm = blobPts(0, -34 * s, 32 * s, 31 * s, 0.05, 3, 30, 2);
  const fingers = [
    capsule(-21 * s, -48 * s, -16, 44 * s, 16 * s, 14.5 * s),
    capsule(-7 * s, -54 * s, -5, 52 * s, 16.5 * s, 15 * s),
    capsule(8 * s, -53 * s, 6, 50 * s, 16.5 * s, 15 * s),
    capsule(22 * s, -46 * s, 17, 38 * s, 15 * s, 13.5 * s),
  ];
  const thumb = capsule(-24 * s, -22 * s, -60, 40 * s, 18 * s, 15.5 * s);
  return {palm, fingers, thumb};
};
const OPEN_HAND = openHand(1.32);

// ------------------------------------------------------------------------------------------------ small parts
const Eye: React.FC<{x: number; y: number; s: number; state: EyeState; look: Pt; sx?: number; wired: number; f: number; lashes?: boolean; pulse: number; mirror: boolean; lid?: number; skin?: string}> = ({
  x,
  y,
  s,
  state,
  look,
  sx = 1,
  wired,
  f,
  lashes,
  pulse,
  mirror,
  lid = 0,
  skin = '#E9B98F',
}) => {
  const tf = `translate(${x} ${y}) scale(${sx * (mirror ? -1 : 1)} 1)`;
  if (state === 'smile') {
    return <path transform={tf} d={brush([[-16 * s, 5 * s], [-8 * s, -6 * s], [3 * s, -8 * s], [15 * s, 2 * s]], {w: 7 * s, taper: [0.3, 0.35], tip: 0.2, seed: 5})} fill={INK} />;
  }
  if (state === 'closed') {
    return <path transform={tf} d={brush([[-16 * s, -2 * s], [-6 * s, 6 * s], [6 * s, 6 * s], [16 * s, -3 * s]], {w: 6.5 * s, taper: [0.3, 0.35], tip: 0.2, seed: 6})} fill={INK} />;
  }
  if (state === 'blink') {
    return <path transform={tf} d={brush([[-16 * s, 1 * s], [0, 3 * s], [16 * s, 0]], {w: 6 * s, taper: [0.3, 0.35], tip: 0.2, seed: 6})} fill={INK} />;
  }
  if (state === 'hearts') {
    const k = 1 + 0.16 * pulse;
    const h = heartPts(0, 0, 21 * s * k);
    return (
      <g transform={tf}>
        <path d={shapeD(h, 4)} fill={C.strawberryDeep} transform="translate(2.5 3)" />
        <path d={shapeD(h, 4)} fill={C.strawberry} />
        <path d={brush([[-12 * s * k, -6 * s * k], [-8 * s * k, -12 * s * k], [-2 * s * k, -12 * s * k]], {w: 5 * s, taper: [0.3, 0.5], seed: 9})} fill={C.white} />
        <path d={brush(h, {w: 4.5 * s, closed: true, dense: false, seed: 8})} fill={INK} />
      </g>
    );
  }
  const wide = state === 'wide';
  const rx = (wide ? 22 : 15.5) * s;
  const ry = (wide ? 26 : 18.5) * s;
  const tremble = wired > 0 ? rng(Math.floor(f / 2) * 13 + Math.round(x)) : null;
  const jx = tremble ? (tremble() - 0.5) * 5 * wired : 0;
  const jy = tremble ? (tremble() - 0.5) * 5 * wired : 0;
  const pr = (wide ? 5.5 : 9.5) * s * (1 - 0.45 * wired);
  const px = look[0] * (rx - pr * 0.75) * 0.9 + jx;
  const py = look[1] * (ry - pr - 2) * 0.7 + jy;
  const sclera = ellipsePts(0, 0, rx, ry, 28);
  return (
    <g transform={tf}>
      <path d={shapeD(sclera)} fill={EYE_WHITE} />
      <path d={shapeD(ellipsePts(0, 0, rx, ry, 28))} fill={C.creamShade} opacity={0.7} transform={`translate(0 ${ry * 0.5}) scale(1 0.5)`} />
      <circle cx={mirror ? -px : px} cy={py} r={pr} fill={INK} />
      <circle cx={(mirror ? -px : px) - pr * 0.35} cy={py - pr * 0.4} r={Math.max(1.6, pr * 0.32)} fill={C.white} />
      <path d={brush(sclera, {w: 3 * s, closed: true, dense: false, start: 0.1, seed: 4})} fill={INK} />
      {/* the heavy upper lid (with a flick at the outer corner); a lowered lid (kind / sleepy eyes) covers the top */}
      {!wide && lid > 0.02 ? (
        <>
          <path d={`M${-rx - 2} ${-ry - 4}H${rx + 2}V${-ry + 2 * ry * lid}Q0 ${-ry + 2 * ry * lid + 4 * s} ${-rx - 2} ${-ry + 2 * ry * lid}Z`} fill={skin} />
          <path d={brush([[-rx - 3 * s, -ry + 2 * ry * lid + 6 * s], [-rx * 0.5, -ry + 2 * ry * lid - 1 * s], [rx * 0.4, -ry + 2 * ry * lid - 2 * s], [rx + 4 * s, -ry + 2 * ry * lid + 5 * s]], {w: 6.5 * s, taper: [0.25, 0.3], tip: 0.25, seed: 7})} fill={INK} />
          <path d={brush([[-rx * 0.6, -ry * 0.95], [rx * 0.5, -ry * 1.0]], {w: 2.4 * s, taper: [0.3, 0.3], seed: 10})} fill={INK} opacity={0.5} />
        </>
      ) : (
        <path d={brush([[-rx - 3 * s, 3 * s], [-rx * 0.6, -ry * 0.92], [rx * 0.3, -ry * 1.04], [rx + 4 * s, -ry * 0.25]], {w: 6.5 * s, taper: [0.25, 0.3], tip: 0.25, seed: 7})} fill={INK} />
      )}
      {lashes ? <path d={brush([[rx * 0.75, -ry * 0.62], [rx + 10 * s, -ry * 0.95]], {w: 4 * s, taper: [0.1, 0.8], seed: 8})} fill={INK} /> : null}
      {wide ? <path d={brush([[-rx * 0.7, ry * 1.25], [0, ry * 1.42], [rx * 0.7, ry * 1.25]], {w: 2.6 * s, taper: [0.3, 0.3], seed: 9})} fill={INK} opacity={0.7} /> : null}
    </g>
  );
};

const Mouth: React.FC<{y: number; w: number; state: MouthState; dx: number; kid?: boolean; gap?: boolean; f: number}> = ({y, w, state, dx, gap, f}) => {
  const g = useMemo(() => {
    if (state === 'grin' || state === 'yum') {
      const h = w * 0.95;
      const pts: Pt[] = [[-w, -3], [-w * 0.5, 3], [0, 4], [w * 0.5, 3], [w, -3], [w * 0.86, h * 0.5], [w * 0.45, h * 0.92], [0, h], [-w * 0.45, h * 0.92], [-w * 0.86, h * 0.5]];
      return {
        shape: shapeD(pts, 6),
        teeth: shapeD([[-w * 0.92, -1], [0, 5], [w * 0.92, -1], [w * 0.8, h * 0.3], [0, h * 0.34], [-w * 0.8, h * 0.3]], 5),
        tongue: shapeD(blobPts(w * 0.12, h * 0.86, w * 0.55, h * 0.36, 0.05, 3, 20, 2)),
        ink: brush(pts, {w: 5.5, closed: true, dense: false, start: 0.1, seed: 11, shadow: 0.8}),
        corners: brush([[-w - 8, -10], [-w - 2, -2], [-w - 7, 6]], {w: 3.5, taper: [0.3, 0.4], seed: 12}) + brush([[w + 8, -10], [w + 2, -2], [w + 7, 6]], {w: 3.5, taper: [0.3, 0.4], seed: 13}),
        clip: pts,
      };
    }
    return null;
  }, [state, w]);
  const clipId = `mclip${Math.round(w)}${Math.round(y)}${state}`;
  if (g) {
    return (
      <g transform={`translate(${dx} ${y})`}>
        <defs>
          <clipPath id={clipId}>
            <path d={g.shape} />
          </clipPath>
        </defs>
        <path d={g.shape} fill={MOUTH.in} />
        <g clipPath={`url(#${clipId})`}>
          <path d={g.teeth} fill={MOUTH.teeth} />
          {gap ? <rect x={-5} y={0} width={10} height={w * 0.4} fill={MOUTH.in} /> : null}
          <path d={g.tongue} fill={MOUTH.tongue} />
        </g>
        <path d={g.ink} fill={INK} />
        <path d={g.corners} fill={INK} opacity={0.8} />
        {state === 'yum' ? <path d={shapeD(blobPts(w * 0.55, w * 0.62, 11, 10, 0.1, 4, 14, 2))} fill={MOUTH.tongue} stroke={INK} strokeWidth={3.5} /> : null}
      </g>
    );
  }
  if (state === 'o') {
    const o = blobPts(0, 10, w * 0.38, w * 0.48, 0.06, 5, 20, 2);
    return (
      <g transform={`translate(${dx} ${y})`}>
        <path d={shapeD(o)} fill={MOUTH.in} />
        <path d={shapeD(blobPts(0, 10 + w * 0.26, w * 0.24, w * 0.16, 0.05, 6, 14, 2))} fill={MOUTH.tongue} />
        <path d={brush(o, {w: 5, closed: true, dense: false, seed: 14})} fill={INK} />
      </g>
    );
  }
  if (state === 'chew') {
    // cheeks full, a wobbly closed mouth that moves on twos
    const ph = Math.floor(f / 4) % 2;
    return (
      <g transform={`translate(${dx} ${y})`}>
        <path d={brush([[-w * 0.6, 4], [-w * 0.25, ph ? 10 : 2], [w * 0.1, ph ? 4 : 10], [w * 0.55, 3]], {w: 5.5, taper: [0.3, 0.3], tip: 0.25, seed: 15})} fill={INK} />
      </g>
    );
  }
  if (state === 'flat') {
    return <path transform={`translate(${dx} ${y})`} d={brush([[-w * 0.55, 6], [0, 7], [w * 0.55, 5]], {w: 5.5, taper: [0.3, 0.3], tip: 0.25, seed: 16})} fill={INK} />;
  }
  // smile
  return (
    <g transform={`translate(${dx} ${y})`}>
      <path d={brush([[-w * 0.8, -2], [-w * 0.35, w * 0.32], [w * 0.35, w * 0.32], [w * 0.8, -2]], {w: 6, taper: [0.25, 0.25], tip: 0.2, seed: 17})} fill={INK} />
      <path d={brush([[-w * 0.95, -8], [-w * 0.78, 0]], {w: 3.2, taper: [0.3, 0.3], seed: 18})} fill={INK} opacity={0.75} />
      <path d={brush([[w * 0.95, -8], [w * 0.78, 0]], {w: 3.2, taper: [0.3, 0.3], seed: 19})} fill={INK} opacity={0.75} />
    </g>
  );
};

const Nose: React.FC<{kind: Look['nose']; x: number; y: number; skin: string; shade: string}> = ({kind, x, y, skin, shade}) => {
  if (kind === 'big') {
    const b = blobPts(0, 0, 24, 21, 0.06, 7, 24, 2);
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={shapeD(b)} fill={shade} />
        <path d={shapeD(shrink(b, 0.82, -3, -3))} fill={skin} />
        <circle cx={-8} cy={-7} r={4.5} fill={C.white} opacity={0.8} />
        <path d={brush(b.slice(4, 24), {w: 5.5, dense: false, taper: [0.2, 0.25], seed: 21})} fill={INK} />
        <path d={dotD(-9, 9, 3.6) + dotD(10, 9, 3.6)} fill={INK} opacity={0.8} />
      </g>
    );
  }
  if (kind === 'long') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={shapeD([[-4, -40], [10, -6], [16, 10], [6, 16], [-10, 12], [-6, 0]], 6)} fill={shade} opacity={0.75} />
        <path d={brush([[-2, -40], [8, -10], [17, 8], [8, 17], [-4, 14]], {w: 5.5, taper: [0.3, 0.2], tip: 0.15, seed: 22})} fill={INK} />
        <path d={dotD(-9, 12, 3)} fill={INK} opacity={0.7} />
      </g>
    );
  }
  if (kind === 'small') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={brush([[-6, 8], [2, 12], [9, 6]], {w: 4.5, taper: [0.3, 0.3], seed: 23})} fill={INK} />
        <circle cx={-3} cy={-1} r={3} fill={C.white} opacity={0.7} />
      </g>
    );
  }
  // button
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={shapeD(blobPts(2, 2, 14, 11, 0.05, 9, 18, 2))} fill={shade} opacity={0.8} />
      <path d={brush([[-12, 6], [-4, 13], [8, 13], [14, 4]], {w: 5, taper: [0.3, 0.3], seed: 24})} fill={INK} />
      <circle cx={-4} cy={-2} r={3.5} fill={C.white} opacity={0.75} />
    </g>
  );
};

const Brow: React.FC<{x: number; y: number; w: number; color: string; raise: number; side: 1 | -1; bushy?: boolean}> = ({x, y, w, color, raise, side, bushy}) => {
  const lift = -raise * 9;
  const tilt = raise < 0 ? -raise * 8 : 0; // frown: inner end down
  const pts: Pt[] = [
    [-20 * side, 3 + lift + tilt],
    [-4 * side, -4 + lift],
    [14 * side, -3 + lift - raise * 2],
    [24 * side, 4 + lift],
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={brush(pts, {w: w * (bushy ? 1.25 : 1), taper: [0.25, 0.55], tip: 0.3, nib: 0.5, seed: side > 0 ? 25 : 26})} fill={color} />
    </g>
  );
};

/** a finjan (handleless Arabic coffee cup), base centre at (0,0) */
export const Finjan: React.FC<{coffee?: number; s?: number}> = ({coffee = 1, s = 1}) => {
  const g = useMemo(() => {
    const body: Pt[] = [[-30, -46], [-27, -24], [-21, -6], [-15, 0], [15, 0], [21, -6], [27, -24], [30, -46]];
    return {
      body: shapeD([...body, [20, -50], [0, -51], [-20, -50]], 6),
      shade: shapeD([[8, -44], [27, -46], [26, -24], [20, -6], [14, 0], [6, 0], [14, -18]], 5),
      band: brush([[-29, -38], [0, -34], [29, -38]], {w: 5, taper: [0.05, 0.05], tip: 0.8, seed: 30}),
      rim: shapeD(ellipsePts(0, -46, 30, 7, 24)),
      coffee: shapeD(ellipsePts(0, -45, 25, 5, 24)),
      ink: brush([...body, [20, -50], [0, -51], [-20, -50]], {w: 4.2, closed: true, dense: false, start: 0.5, seed: 31}),
      rimInk: brush(ellipsePts(0, -46, 30, 7, 24), {w: 3, closed: true, dense: false, seed: 32}),
      gloss: brush([[-20, -40], [-21, -24], [-15, -10]], {w: 5, taper: [0.3, 0.5], seed: 33}),
    };
  }, []);
  return (
    <g transform={`scale(${s})`}>
      <path d={g.body} fill="#FFFDF6" />
      <path d={g.shade} fill="#DCE6E3" />
      <path d={g.band} fill="#D6A23F" />
      <path d={g.gloss} fill={C.white} />
      <path d={g.rim} fill="#F3EFE6" />
      {coffee > 0.02 ? <path d={g.coffee} fill="#B07A2E" opacity={Math.min(1, coffee * 1.5)} /> : null}
      {coffee > 0.02 ? <ellipse cx={-8} cy={-46} rx={6} ry={1.6} fill="#E8C98A" opacity={Math.min(1, coffee * 1.5)} /> : null}
      <path d={g.ink} fill={INK} />
      <path d={g.rimInk} fill={INK} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ the component
export const Guest: React.FC<GuestProps> = ({
  id,
  x = 0,
  y = 0,
  scale = 1,
  tilt = 0,
  eyes = 'open',
  mouth = 'grin',
  look = [0, 0],
  turn = 0,
  brow = 0.3,
  blush = 0.7,
  arm = 'none',
  side = 1,
  wave = 0,
  cupShake = 0,
  coffee = 1,
  spoonLoad = 1,
  body = true,
  squash = 0,
  pulse = 0,
  wired = 0,
  cross = 0,
  smush = 0,
  boil = 1,
  frame,
  headDx = 0,
  headDy = 0,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const L = GUEST_LOOK[id];
  const seedBase = ['khala', 'amo', 'jiddo', 'teta', 'walad', 'bint'].indexOf(id) * 10;
  const bInk = useBoil({scale: 2.6 * boil, offset: 60 + seedBase, frame: f, freq: 0.03});
  const bFill = useBoil({scale: 1.6 * boil, offset: 61 + seedBase, frame: f, freq: 0.02});
  const skin = C.skin[L.skin];
  const skinShade = C.skinShade[L.skin];
  const tq = Math.round(turn * 10) / 10;
  const uid = `${id}${Math.round(x)}${Math.round(y)}`.replace(/-/g, 'm');

  const geo = useMemo(() => {
    const face = facePts(L.face, tq);
    const bodyP = bodyPts(!!L.kid);
    return {
      face,
      faceD: shapeD(face, 6),
      faceLit: shapeD(shrink(face, 0.9, -9 + tq * 6, -10), 6),
      faceInk: brush(face, {w: 6.5, closed: true, dense: false, start: 0.62, seed: 40 + seedBase, shadow: 0.7}),
      body: bodyP,
      bodyD: shapeD(bodyP, 6),
      bodyLit: shapeD(tr(bodyP, -18, 0, 0.94, 1), 6),
      bodyInk: brush(bodyP.slice(0, Math.floor(bodyP.length / 2) - 1), {w: 6.5, dense: false, taper: [0.02, 0.1], tip: 0.5, seed: 41}) +
        brush(bodyP.slice(Math.floor(bodyP.length / 2) + 2), {w: 6.5, dense: false, taper: [0.1, 0.02], tip: 0.5, seed: 42}),
      neck: shapeD([[-34, 60], [34, 60], [38, 128], [0, 140], [-38, 128]], 6),
      ears: [-1, 1].map((sd) => {
        const ex = sd * (L.face.cheek - 2) + (sd === -Math.sign(tq) ? -sd * 6 * Math.abs(tq) : 0);
        const e = blobPts(ex + sd * 6, 6, 15, 23, 0.06, 50 + sd, 18, 2);
        return {d: shapeD(e), ink: brush(e, {w: 5, closed: true, dense: false, start: sd > 0 ? 0.55 : 0.05, seed: 51 + sd}), inner: brush([[ex + sd * 2, -6], [ex + sd * 10, 2], [ex + sd * 4, 14]], {w: 3.5, seed: 53})};
      }),
    };
  }, [id, tq]);

  // ---- feature placement (turn slides the features)
  const fx = tq * 20 + headDx * 0;
  const eyeL = -L.eyeX + fx;
  const eyeR = L.eyeX + fx;
  const farK = (sd: number) => (sd === Math.sign(tq) ? 1 - 0.28 * Math.abs(tq) : 1);
  const browRaise = brow;
  const sk = squash;
  const bustTf = `translate(${x} ${y}) scale(${scale}) rotate(${tilt}) scale(${1 + sk * 0.5} ${1 - sk})`;
  const headTf = `translate(${headDx} ${headDy})`;
  const clipFace = `face${uid}`;

  // ---- per character layers
  const back: React.ReactNode[] = [];
  const front: React.ReactNode[] = [];
  const bodyExtra: React.ReactNode[] = [];
  const faceExtra: React.ReactNode[] = [];

  if (id === 'khala') {
    // a soft draped hijab: hugs the head, wraps under the chin, falls over the shoulders in folds (one end thrown
    // over the left shoulder), a thin gold trim on the face edge
    const outer: Pt[] = [
      [0, -146], [70, -140], [114, -104], [128, -40], [126, 30], [114, 92], [104, 132], [140, 160], [176, 196], [196, 240],
      [188, 262], [150, 270], [100, 262], [50, 272], [0, 266], [-50, 276], [-104, 270], [-150, 286], [-196, 300], [-214, 262],
      [-196, 206], [-150, 160], [-112, 128], [-118, 90], [-128, 30], [-130, -40], [-116, -104], [-70, -140],
    ];
    const open = sym([[0, -94], [58, -88], [84, -52], [92, 0], [86, 54], [64, 98], [32, 118], [0, 124]]).map(([px, py]) => [px + tq * 14 * Math.max(0, py / 112), py] as Pt);
    const d = shapeD(outer, 6) + shapeD(open, 6);
    const flowers = scatter(34, 7, [-210, -150, 420, 440])
      .map(([px, py]) => [0, 1, 2, 3, 4].map((k) => dotD(px + Math.cos((k / 5) * 6.28) * 5, py + Math.sin((k / 5) * 6.28) * 5, 3.2)).join(''))
      .join('');
    back.push(<path key="hb" d={shapeD(tr(outer, 6, 10, 1.0), 6)} fill={INK} opacity={0.2} />);
    front.push(
      <g key="hijab">
        <defs>
          <clipPath id={`hj${uid}`}>
            <path d={d} clipRule="evenodd" />
          </clipPath>
        </defs>
        <path d={d} fill={HIJAB.shade} fillRule="evenodd" />
        <path d={shapeD(tr(outer, -14, -12, 0.93), 6) + shapeD(open, 6)} fill={HIJAB.base} fillRule="evenodd" clipPath={`url(#hj${uid})`} />
        <path d={flowers} fill={HIJAB.light} opacity={0.55} clipPath={`url(#hj${uid})`} />
        {/* gold trim along the face edge */}
        <path d={brush(shrink(open, 1.07, 0, 2), {w: 6, closed: true, dense: false, taper: [0.02, 0.02], tip: 0.9, jitter: 0.05, seed: 59})} fill="#E2B54A" />
        {[
          [[-36, 132], [-58, 196], [-60, 262]],
          [[30, 130], [54, 196], [66, 260]],
          [[108, -60], [118, 10], [108, 86]],
          [[-112, -60], [-118, 20], [-108, 96]],
          [[-130, 160], [-160, 220], [-170, 284]],
          [[140, 178], [164, 222]],
        ].map((p, i) => (
          <path key={i} d={brush(p as Pt[], {w: 4.5, taper: [0.3, 0.6], tip: 0.1, seed: 61 + i})} fill={INK} opacity={0.7} />
        ))}
        <path d={brush(outer, {w: 7, closed: true, dense: false, start: 0.4, seed: 66, shadow: 0.6})} fill={INK} />
        <path d={brush(open, {w: 5, closed: true, dense: false, start: 0.9, seed: 67})} fill={INK} />
      </g>,
    );
  }
  if (id === 'jiddo') {
    const outerR: Pt[] = [[0, -160], [80, -152], [128, -112], [144, -40], [148, 50], [160, 150], [182, 250], [206, 342]];
    const innerR: Pt[] = [[128, 346], [114, 240], [104, 130], [98, 40], [94, -30], [84, -76], [50, -100], [0, -106]];
    const turnPts = (p: Pt[]) => p.map(([px, py]) => [px + tq * 12 * Math.max(0, Math.min(1, py / 112)), py] as Pt);
    const shape = turnPts([...outerR, ...innerR, ...mir(innerR).reverse().slice(1), ...mir(outerR).reverse().slice(0, -1)]);
    const d = shapeD(shape, 6);
    back.push(<path key="gb" d={shapeD(sym([[0, -160], [90, -150], [150, -60], [170, 120], [210, 350], [0, 360]]), 6)} fill={GHUTRA.shade} />);
    front.push(
      <g key="ghutra">
        <path d={d} fill={GHUTRA.shade} transform="translate(4 6)" opacity={0.6} />
        <path d={d} fill={GHUTRA.base} />
        {[
          [[110, -90], [130, 20], [150, 200], [176, 320]],
          [[-110, -90], [-130, 20], [-150, 200], [-176, 320]],
          [[60, -140], [92, -60], [112, 60]],
          [[-60, -140], [-92, -60], [-112, 60]],
        ].map((p, i) => (
          <path key={i} d={brush(p as Pt[], {w: 4, taper: [0.4, 0.5], tip: 0.1, seed: 70 + i})} fill={GHUTRA.deep} />
        ))}
        <path d={brush(shape, {w: 6.5, closed: true, dense: false, start: 0.25, seed: 75, shadow: 0.6})} fill={INK} />
        {/* the agal: two black cord loops */}
        <path d={brush([[-104, -112], [-50, -134], [0, -138], [50, -134], [104, -112]], {w: 9, taper: [0.1, 0.1], tip: 0.7, seed: 76})} fill="#1C1B20" />
        <path d={brush([[-118, -104], [-60, -88], [0, -84], [60, -88], [118, -104]], {w: 15, taper: [0.06, 0.06], tip: 0.8, seed: 77})} fill="#1C1B20" />
        <path d={brush([[-114, -88], [-60, -72], [0, -68], [60, -72], [114, -88]], {w: 14, taper: [0.06, 0.06], tip: 0.8, seed: 78})} fill="#1C1B20" />
        <path d={brush([[-80, -86], [-30, -78], [20, -78]], {w: 3, taper: [0.3, 0.5], seed: 79})} fill="#6B6A75" />
      </g>,
    );
    // beard + moustache
    const beard = sym([[0, 136], [44, 128], [80, 98], [94, 54], [96, 14], [82, 18], [74, 56], [52, 86], [22, 96], [0, 98]]).map(([px, py]) => [px + tq * 14 * Math.max(0, py / 112), py] as Pt);
    faceExtra.push(
      <g key="beard">
        <path d={shapeD(beard, 5)} fill={HAIR.greyLight} />
        <path d={shapeD(shrink(beard, 0.9, -4, -2), 5)} fill={HAIR.white} />
        <path d={brush(beard, {w: 5, closed: true, dense: false, start: 0.7, seed: 80})} fill={INK} />
        {[-50, -25, 0, 25, 50].map((bx, i) => (
          <path key={i} d={brush([[bx + tq * 14, 104], [bx * 1.1 + tq * 14, 120]], {w: 2.6, taper: [0.4, 0.4], seed: 81 + i})} fill={HAIR.grey} />
        ))}
        <path
          d={shapeD(sym([[0, 44], [22, 40], [44, 46], [52, 58], [36, 56], [14, 54], [0, 56]]).map(([px, py]) => [px + fx, py + 4] as Pt), 5)}
          fill={HAIR.white}
          stroke={INK}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </g>,
    );
  }
  if (id === 'teta') {
    const outer: Pt[] = [
      [0, -140], [74, -134], [118, -96], [130, -30], [126, 40], [112, 96], [96, 134], [136, 168], [168, 214], [160, 246],
      [110, 238], [60, 248], [0, 240], [-60, 250], [-110, 244], [-164, 250], [-170, 210], [-138, 166], [-100, 134], [-114, 96],
      [-128, 40], [-132, -30], [-120, -96], [-74, -134],
    ];
    const open = sym([[0, -80], [60, -76], [88, -46], [94, 0], [86, 54], [64, 96], [32, 116], [0, 122]]).map(([px, py]) => [px + tq * 14 * Math.max(0, py / 112), py] as Pt);
    const d = shapeD(outer, 6) + shapeD(open, 6);
    back.push(<path key="tb" d={shapeD(tr(outer, 6, 10), 6)} fill={INK} opacity={0.2} />);
    faceExtra.push(
      <g key="fringe">
        <path d={shapeD([[-88, -60], [-62, -90], [0, -98], [62, -90], [88, -60], [62, -52], [34, -66], [4, -56], [-28, -68], [-60, -52]], 6)} fill={HAIR.white} />
        <path d={brush([[-84, -62], [-60, -54], [-28, -68], [4, -57], [34, -66], [60, -54], [84, -62]], {w: 4.5, taper: [0.2, 0.2], seed: 85})} fill={INK} />
        {[
          [[-50, -84], [-34, -70]],
          [[10, -90], [26, -74]],
          [[46, -86], [60, -72]],
        ].map((p, i) => (
          <path key={i} d={brush(p as Pt[], {w: 3, taper: [0.3, 0.3], seed: 86 + i})} fill={HAIR.grey} />
        ))}
      </g>,
    );
    front.push(
      <g key="scarf">
        <defs>
          <clipPath id={`sc${uid}`}>
            <path d={d} clipRule="evenodd" />
          </clipPath>
        </defs>
        <path d={d} fill={SCARF.shade} fillRule="evenodd" />
        <path d={shapeD(tr(outer, -12, -10, 0.93), 6) + shapeD(open, 6)} fill={SCARF.base} fillRule="evenodd" clipPath={`url(#sc${uid})`} />
        {/* a sparse little paisley print */}
        <path d={scatter(26, 17, [-200, -140, 400, 380]).map(([px, py]) => brush(ellipsePts(px, py, 8, 6, 10, 0, Math.PI * 1.6), {w: 3.2, dense: false, taper: [0.2, 0.6], seed: Math.round(px)})).join('')} fill={SCARF.light} opacity={0.85} clipPath={`url(#sc${uid})`} />
        {[
          [[-106, -60], [-116, 20], [-104, 100]],
          [[104, -60], [114, 20], [104, 96]],
          [[-30, 132], [-46, 180], [-40, 236]],
        ].map((p, i) => (
          <path key={i} d={brush(p as Pt[], {w: 4.2, taper: [0.3, 0.6], tip: 0.1, seed: 87 + i})} fill={INK} opacity={0.65} />
        ))}
        <path d={brush(outer, {w: 7, closed: true, dense: false, start: 0.4, seed: 89, shadow: 0.6})} fill={INK} />
        <path d={brush(open, {w: 5.5, closed: true, dense: false, start: 0.9, seed: 90})} fill={INK} />
        {/* the knot under the chin + two short tails */}
        <path d={shapeD([[40, 132], [62, 140], [74, 196], [56, 200], [46, 150]], 5)} fill={SCARF.shade} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
        <path d={shapeD([[30, 136], [44, 146], [36, 210], [20, 206], [24, 150]], 5)} fill={SCARF.base} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
        <path d={shapeD(blobPts(38 + tq * 14, 132, 18, 14, 0.12, 91, 16, 2))} fill={SCARF.base} stroke={INK} strokeWidth={5} />
      </g>,
    );
  }
  if (id === 'amo') {
    // bald crown with side hair over the ears
    faceExtra.push(
      <g key="hair">
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <path d={shapeD(blobPts(sd * 90 + tq * 6, -44, 18, 34, 0.18, 92 + sd, 16, 3))} fill={HAIR.dark} />
            <path d={brush(blobPts(sd * 90 + tq * 6, -44, 18, 34, 0.18, 92 + sd, 16, 3), {w: 4, closed: true, dense: false, seed: 93})} fill={INK} />
          </g>
        ))}
        <path d={brush([[-50, -92], [-24, -106], [8, -108]], {w: 11, taper: [0.3, 0.5], seed: 94})} fill={C.white} opacity={0.7} />
        <path d={brush([[-18, -76], [-4, -84], [12, -82]], {w: 4, taper: [0.3, 0.5], seed: 95})} fill={INK} opacity={0.55} />
      </g>,
    );
  }
  if (id === 'walad') {
    const curls: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (1.02 + 0.96 * (i / 40));
      const bump = 1 + 0.08 * Math.abs(Math.sin(a * 9.5));
      curls.push([Math.cos(a) * 108 * bump + tq * 6, -26 + Math.sin(a) * 100 * bump]);
    }
    const fringe: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      fringe.push([96 - 192 * t + tq * 8, -46 + 10 * Math.abs(Math.sin(t * Math.PI * 4)) - 8 * Math.sin(t * Math.PI)]);
    }
    const hair = [...curls, ...fringe];
    back.push(
      <g key="hood">
        <path d={shapeD(sym([[0, 40], [90, 50], [150, 110], [176, 190], [120, 160], [0, 150]]), 6)} fill={L.cloth.shade} stroke={INK} strokeWidth={5} />
        {[-1, 1].map((sd) =>
          [0, 1, 2].map((i) => (
            <path
              key={`${sd}${i}`}
              d={shapeD([[sd * (110 + i * 22), 70 + i * 34], [sd * (140 + i * 22), 50 + i * 34], [sd * (130 + i * 22), 92 + i * 34]], 3)}
              fill="#FF8A1E"
              stroke={INK}
              strokeWidth={4}
              strokeLinejoin="round"
            />
          )),
        )}
      </g>,
    );
    front.push(
      <g key="curls">
        <path d={shapeD(hair, 4)} fill={HAIR.dark} />
        {scatter(18, 31, [-90, -120, 180, 70]).map(([px, py], i) => (
          <path key={i} d={brush(ellipsePts(px, py, 9, 7, 10, Math.PI * 0.9, Math.PI * 1.9), {w: 3.4, taper: [0.3, 0.3], dense: false, seed: 96 + i})} fill={HAIR.darkLight} />
        ))}
        <path d={brush(hair, {w: 6, closed: true, dense: false, start: 0.98, seed: 97})} fill={INK} />
      </g>,
    );
    faceExtra.push(
      <g key="freckles" opacity={0.55}>
        {[[-52, 30], [-60, 22], [-44, 22], [52, 30], [60, 22], [44, 22]].map(([px, py], i) => (
          <circle key={i} cx={px + fx} cy={py} r={2.6} fill={C.skinShade[4]} />
        ))}
      </g>,
    );
  }
  if (id === 'bint') {
    const bob = sym([[0, -132], [80, -122], [118, -70], [124, 10], [118, 64], [96, 74], [92, 20], [82, -40], [0, -60]]);
    back.push(
      <g key="bob">
        {[-1, 1].map((sd) => {
          const p = blobPts(sd * 118 + tq * 6, -104, 46, 44, 0.12, 98 + sd, 24, 4);
          return (
            <g key={sd}>
              <path d={shapeD(p)} fill={HAIR.brown} />
              <path d={brush(ellipsePts(sd * 112, -112, 26, 22, 10, Math.PI * 1.1, Math.PI * 1.7), {w: 5, taper: [0.3, 0.3], dense: false, seed: 99})} fill={HAIR.brownLight} />
              <path d={brush(p, {w: 6, closed: true, dense: false, seed: 100 + sd})} fill={INK} />
            </g>
          );
        })}
        <path d={shapeD(tr(bob, tq * 6, 0), 6)} fill={HAIR.brown} />
        <path d={brush(tr(bob, tq * 6, 0), {w: 6, closed: true, dense: false, start: 0.5, seed: 102})} fill={INK} />
      </g>,
    );
    const bangs: Pt[] = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      if (t <= 0.5) {
        const a = Math.PI * (1.05 + 0.9 * (t / 0.5));
        bangs.push([Math.cos(a) * 98, -30 + Math.sin(a) * 96]);
      }
    }
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bangs.push([94 - 188 * t, -44 + 8 * Math.abs(Math.sin(t * Math.PI * 5))]);
    }
    const bangsT = tr(bangs, tq * 10, 0);
    front.push(
      <g key="bangs">
        <path d={shapeD(bangsT, 4)} fill={HAIR.brown} />
        <path d={brush([[-60, -94], [-20, -110], [20, -108]], {w: 9, taper: [0.3, 0.5], seed: 103})} fill={HAIR.brownLight} />
        <path d={brush(bangsT, {w: 6, closed: true, dense: false, start: 0.95, seed: 104})} fill={INK} />
        {[-1, 1].map((sd) => (
          <g key={sd} transform={`translate(${sd * 84 + tq * 6} -140) rotate(${sd * 18})`}>
            <path d={shapeD([[0, 0], [-34, -20], [-38, 18]], 4)} fill={C.strawberry} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
            <path d={shapeD([[0, 0], [34, -20], [38, 18]], 4)} fill={C.strawberry} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
            <circle r={9} fill={C.strawberryDeep} stroke={INK} strokeWidth={4} />
          </g>
        ))}
      </g>,
    );
  }

  // ---- body: clothes + collars
  if (body) {
    const c = L.cloth;
    if (L.collar === 'shirt') {
      bodyExtra.push(
        <g key="stripes" clipPath={`url(#body${uid})`}>
          {Array.from({length: 18}).map((_, i) => (
            <rect key={i} x={-260 + i * 30} y={80} width={9} height={600} fill="#3D6FA8" opacity={0.55} transform={`rotate(${(i % 2) * 0.4})`} />
          ))}
        </g>,
        <g key="collar">
          {[-1, 1].map((sd) => (
            <path
              key={sd}
              d={shapeD(sd > 0 ? [[6, 104], [58, 96], [70, 156], [24, 150]] : [[-6, 104], [-58, 96], [-70, 156], [-24, 150]], 4)}
              fill={c.light}
              stroke={INK}
              strokeWidth={5}
              strokeLinejoin="round"
            />
          ))}
          <path d={brush([[0, 150], [2, 400], [0, 660]], {w: 4, taper: [0.1, 0.1], seed: 110})} fill={INK} opacity={0.6} />
          {[200, 290, 380].map((by) => (
            <circle key={by} cx={12} cy={by} r={6} fill={c.light} stroke={INK} strokeWidth={3} />
          ))}
        </g>,
      );
    }
    if (L.collar === 'kandura') {
      bodyExtra.push(
        <g key="kandura">
          <path d={brush(ellipsePts(0, 108, 46, 18, 20, 0.15, Math.PI - 0.15), {w: 5, dense: false, seed: 111})} fill={INK} />
          <path d={brush([[0, 128], [0, 230]], {w: 4, taper: [0.1, 0.3], seed: 112})} fill={INK} opacity={0.6} />
          {/* the tarboosha: a tassel hanging from the collar */}
          <path d={brush([[16, 126], [22, 200], [18, 300]], {w: 4, taper: [0.1, 0.1], tip: 0.8, seed: 113})} fill="#E8E2D2" />
          <path d={shapeD(blobPts(18, 318, 10, 24, 0.1, 114, 14, 2))} fill="#F4EEDD" stroke={INK} strokeWidth={4} />
        </g>,
      );
    }
    if (L.collar === 'cardigan') {
      bodyExtra.push(
        <g key="cardigan">
          <path d={shapeD([[-60, 120], [60, 120], [12, 420], [-12, 420]], 4)} fill="#FFF3DC" />
          <path d={brush([[-60, 120], [-6, 420]], {w: 6, taper: [0.1, 0.1], seed: 115})} fill={INK} />
          <path d={brush([[60, 120], [6, 420]], {w: 6, taper: [0.1, 0.1], seed: 116})} fill={INK} />
          {[260, 340].map((by) => (
            <circle key={by} cx={-22} cy={by} r={7} fill="#D6A23F" stroke={INK} strokeWidth={3} />
          ))}
          <g clipPath={`url(#body${uid})`} opacity={0.35}>
            {Array.from({length: 14}).map((_, i) => (
              <path key={i} d={brush([[-240 + i * 36, 160], [-236 + i * 36, 660]], {w: 3, taper: [0.1, 0.1], seed: 117 + i})} fill={c.shade} />
            ))}
          </g>
        </g>,
      );
    }
    if (L.collar === 'round') {
      bodyExtra.push(
        <g key="round">
          {[-1, 1].map((sd) => (
            <path key={sd} d={shapeD(sd > 0 ? [[0, 104], [40, 98], [78, 120], [70, 150], [26, 146]] : [[0, 104], [-40, 98], [-78, 120], [-70, 150], [-26, 146]], 5)} fill="#FFFDF6" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          ))}
        </g>,
      );
    }
    if (L.collar === 'hoodie') {
      bodyExtra.push(
        <g key="strings">
          {[-1, 1].map((sd) => (
            <g key={sd}>
              <path d={brush([[sd * 30, 120], [sd * 34, 200], [sd * 30, 260]], {w: 5, taper: [0.1, 0.1], tip: 0.8, seed: 118})} fill="#FFFDF6" />
              <rect x={sd * 30 - 6} y={258} width={12} height={20} rx={4} fill="#FF8A1E" stroke={INK} strokeWidth={3} />
            </g>
          ))}
          <path d={brush(ellipsePts(0, 104, 54, 22, 20, 0.1, Math.PI - 0.1), {w: 6, dense: false, seed: 119})} fill={INK} />
        </g>,
      );
    }
  }

  // ---- arms
  const armLayer: React.ReactNode[] = [];
  const sleeve = id === 'khala' ? HIJAB : L.cloth;
  if (arm === 'wave') {
    const sh: Pt = [side * 190 * (L.kid ? 0.86 : 1), 250];
    const elbow: Pt = [side * 262, 150];
    const wrist: Pt = [side * 236, -20];
    const tube1 = tube([sh, [side * 240, 210], elbow, [side * 252, 70], wrist], 78, 58, false, true);
    const handRot = side * (8 + wave * 24);
    armLayer.push(
      <g key="wave">
        <path d={shapeD(tube1, 4)} fill={id === 'khala' ? L.cloth.base : sleeve.base} />
        <path d={shapeD(tr(tube1, -side * 6, -4, 1), 4)} fill={id === 'khala' ? L.cloth.light : sleeve.light} opacity={0.5} />
        <path d={brush(tube1, {w: 6, closed: true, dense: false, start: 0.5, seed: 120})} fill={INK} />
        <g transform={`translate(${wrist[0]} ${wrist[1] + 6}) rotate(${handRot}) scale(${side < 0 ? -1 : 1} 1)`}>
          {OPEN_HAND.fingers.map((fp, i) => (
            <g key={i}>
              <path d={shapeD(fp, 4)} fill={i === 3 ? skinShade : skin} />
              <path d={shapeD(tr(fp, 4, 0, 1), 4)} fill={skinShade} opacity={0.5} clipPath={undefined} />
              <path d={brush(fp, {w: 4.6, closed: true, dense: false, start: 0.9, seed: 121 + i, shadow: 0.5})} fill={INK} />
              <path d={brush([[fp[0][0] + 2, fp[0][1] - 10], [fp[0][0] + 6, fp[0][1] - 4]], {w: 2.6, taper: [0.3, 0.3], seed: 127 + i})} fill={INK} opacity={0.5} />
            </g>
          ))}
          <path d={shapeD(OPEN_HAND.thumb, 4)} fill={skin} />
          <path d={brush(OPEN_HAND.thumb, {w: 4.8, closed: true, dense: false, start: 0.2, seed: 128, shadow: 0.5})} fill={INK} />
          <path d={shapeD(OPEN_HAND.palm)} fill={skinShade} />
          <path d={shapeD(shrink(OPEN_HAND.palm, 0.88, -4, -4))} fill={skin} />
          <path d={brush([[-14, -30], [-2, -18], [14, -24]], {w: 3, taper: [0.3, 0.3], seed: 129})} fill={INK} opacity={0.45} />
          <path d={brush([...OPEN_HAND.palm.slice(27), ...OPEN_HAND.palm.slice(0, 18)], {w: 5.5, dense: true, taper: [0.15, 0.15], tip: 0.3, seed: 125})} fill={INK} />
          {id === 'khala' ? (
            <g>
              {[0, 1, 2].map((i) => (
                <path key={i} d={brush(ellipsePts(0, 8 + i * 11, 34, 9, 18, 0.1, Math.PI - 0.1), {w: 6, dense: false, taper: [0.1, 0.1], tip: 0.8, seed: 126 + i})} fill="#E2B54A" stroke={INK} strokeWidth={2} />
              ))}
            </g>
          ) : null}
          {/* cuff */}
          <path d={shapeD([[-36, 10], [36, 10], [38, 34], [-38, 34]], 3)} fill={id === 'khala' ? L.cloth.shade : sleeve.shade} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
        {/* motion arcs (drawn, on twos) */}
        {Math.abs(wave) > 0.3 ? (
          <path
            d={brush(ellipsePts(wrist[0], wrist[1] - 30, 92, 92, 10, -Math.PI / 2 - (side > 0 ? 0.9 : -0.1) - (wave > 0 ? 0.5 : 0), -Math.PI / 2 + (side > 0 ? 0.1 : 0.9) - (wave > 0 ? 0.5 : 0)), {w: 5, taper: [0.5, 0.5], tip: 0.05, dense: false, seed: 129})}
            fill={INK}
            opacity={0.55}
          />
        ) : null}
      </g>,
    );
  }
  if (arm === 'cup' || arm === 'spoon') {
    // the forearm comes up from below (elbow out of the bust) to a hand held in front of the chest / at the mouth
    const hand: Pt = arm === 'cup' ? [side * 64, 236] : [side * 74, 196];
    const elbow: Pt = [side * 176 * (L.kid ? 0.86 : 1), 470];
    const wrist: Pt = [hand[0] + side * 38, hand[1] + 40];
    const t1 = tube([elbow, [side * 150, 380], [wrist[0] + side * 22, wrist[1] + 60], wrist], 84, 62, false, false);
    const cuffC = id === 'khala' ? L.cloth : sleeve;
    const palm = blobPts(side * 8, 14, 40, 24, 0.06, 131, 24, 2);
    armLayer.push(
      <g key="hold">
        <path d={shapeD(t1, 4)} fill={cuffC.base} />
        <path d={shapeD(tr(t1, -side * 8, 0, 1), 4)} fill={cuffC.light} opacity={0.45} />
        <path d={brush(t1, {w: 6, closed: true, dense: false, start: 0.5, seed: 130})} fill={INK} />
        <path d={shapeD(tube([[wrist[0] + side * 24, wrist[1] + 36], wrist], 70, 66, false, false), 3)} fill={cuffC.shade} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <g transform={`translate(${hand[0]} ${hand[1]}) rotate(${arm === 'cup' ? cupShake * 16 : side * -14})`}>
          {/* palm under the cup / round the handle */}
          <path d={shapeD(palm)} fill={skinShade} />
          <path d={shapeD(shrink(palm, 0.86, -side * 4, -4))} fill={skin} />
          <path d={brush(palm, {w: 5.5, closed: true, dense: false, start: 0.25, seed: 135, shadow: 0.6})} fill={INK} />
          {arm === 'cup' ? (
            <g transform="translate(0 2)">
              <Finjan coffee={coffee} s={1.15} />
            </g>
          ) : (
            <g transform={`translate(${-side * 50} ${L.mouthY + 26 - hand[1]}) rotate(${side * 156}) scale(0.42)`}>
              <SpoonArt load={spoonLoad} frame={f} />
            </g>
          )}
          {/* curled fingers on the front, thumb up the side */}
          {[-1, 0, 1].map((k) => {
            const fp = blobPts(side * (-18 + k * 15), arm === 'cup' ? -2 + Math.abs(k) * 2 : 4, 10, 12, 0.05, 136 + k, 14, 2);
            return (
              <g key={k}>
                <path d={shapeD(fp)} fill={skin} />
                <path d={brush(fp, {w: 4, closed: true, dense: false, start: 0.75, seed: 137 + k})} fill={INK} />
              </g>
            );
          })}
          <path d={shapeD(capsule(side * 30, 10, side * -8, 36, 17, 15), 4)} fill={skin} />
          <path d={brush(capsule(side * 30, 10, side * -8, 36, 17, 15), {w: 4.8, closed: true, dense: false, start: 0.3, seed: 139})} fill={INK} />
        </g>
      </g>,
    );
  }

  const bodyClip = `body${uid}`;
  const blushOn = blush > 0.02;
  return (
    <g transform={bustTf}>
      <defs>
        {bInk.def}
        {bFill.def}
        <clipPath id={clipFace}>
          <path d={geo.faceD} />
        </clipPath>
        <clipPath id={bodyClip}>
          <path d={geo.bodyD} />
        </clipPath>
      </defs>
      <g filter={bFill.url}>
        {body ? (
          <g>
            {back}
            <path d={geo.bodyD} fill={L.cloth.shade} />
            <path d={geo.bodyLit} fill={L.cloth.base} clipPath={`url(#${bodyClip})`} />
            <Halftone box={[-260, 100, 520, 580]} cell={11} angle={24} fill={L.cloth.shade} opacity={0.9} tone={[{t: 'lin', x0: -40, y0: 0, x1: 240, y1: 0, a: 0, b: 1}]} clipPath={`url(#${bodyClip})`} />
            {bodyExtra}
            <path d={geo.bodyInk} fill={INK} />
          </g>
        ) : (
          back
        )}
        <g transform={headTf}>
          <path d={geo.neck} fill={skinShade} />
          {geo.ears.map((e, i) => (
            <g key={i}>
              <path d={e.d} fill={skin} />
              <path d={e.inner} fill={INK} opacity={0.6} />
              <path d={e.ink} fill={INK} />
            </g>
          ))}
          <path d={geo.faceD} fill={skinShade} />
          <path d={geo.faceLit} fill={skin} clipPath={`url(#${clipFace})`} />
          {blushOn ? (
            <g clipPath={`url(#${clipFace})`}>
              {[-1, 1].map((sd) => (
                <Halftone
                  key={sd}
                  box={[sd * 58 + fx - 40, 14, 80, 56]}
                  cell={6.5}
                  angle={20}
                  fill={C.strawberry}
                  opacity={0.6 * blush}
                  tone={[{t: 'rad', cx: sd * 58 + fx, cy: 40, r0: 4, r1: 30, a: 0.9, b: 0}]}
                />
              ))}
            </g>
          ) : null}
          <path d={geo.faceInk} fill={INK} />
          {/* features */}
          {faceExtra}
          <g filter={bInk.url}>
            <Nose kind={L.nose} x={fx * 1.1} y={L.nose === 'big' ? 28 : 22} skin={skin} shade={skinShade} />
            {id === 'amo' ? (
              <g transform={`translate(${fx * 1.05} 0)`}>
                <path d={shapeD(sym([[0, 44], [26, 38], [52, 44], [70, 62], [58, 70], [38, 62], [14, 62], [0, 66]]), 5)} fill={HAIR.dark} />
                {[-40, -22, 22, 40].map((mx, i) => (
                  <path key={i} d={brush([[mx, 46], [mx * 1.15, 60]], {w: 2.6, taper: [0.3, 0.4], seed: 140 + i})} fill={HAIR.darkLight} />
                ))}
                <path d={brush(sym([[0, 44], [26, 38], [52, 44], [70, 62], [58, 70], [38, 62], [14, 62], [0, 66]]), {w: 4.5, closed: true, dense: false, seed: 144})} fill={INK} />
              </g>
            ) : null}
            <Mouth y={L.mouthY + (id === 'amo' ? 4 : 0)} w={mouth === 'grin' || mouth === 'yum' ? L.mouthW : L.mouthW * 0.9} state={mouth} dx={fx * 1.08} gap={id === 'walad'} f={f} />
            {[-1, 1].map((sd) => (
              <Eye
                key={sd}
                x={sd < 0 ? eyeL : eyeR}
                y={L.eyeY}
                s={L.eyeS}
                sx={farK(sd)}
                state={eyes}
                look={[Math.max(-1, Math.min(1, look[0] + (sd < 0 ? cross : -cross))), look[1]]}
                wired={wired}
                f={f}
                lashes={id === 'bint' || id === 'khala'}
                pulse={pulse}
                mirror={sd < 0}
                lid={L.lid}
                skin={skin}
              />
            ))}
            {eyes !== 'hearts'
              ? [-1, 1].map((sd) => (
                  <Brow key={sd} x={(sd < 0 ? eyeL : eyeR) + sd * 2} y={L.eyeY - 34 * L.eyeS - (eyes === 'wide' ? 10 : 0)} w={L.browW} color={L.browC} raise={browRaise + (eyes === 'wide' ? 0.6 : 0)} side={sd as 1 | -1} bushy={id === 'amo'} />
                ))
              : null}
            {id === 'teta' ? (
              <g>
                {[-1, 1].map((sd) => (
                  <path key={sd} d={brush([[sd * 62 + fx, 4], [sd * 72 + fx, 14], [sd * 66 + fx, 24]], {w: 3, taper: [0.3, 0.3], seed: 150 + sd})} fill={INK} opacity={0.6} />
                ))}
                <path d={brush([[-28 + fx, 50], [-34 + fx, 66]], {w: 3, taper: [0.3, 0.3], seed: 153})} fill={INK} opacity={0.5} />
                <path d={brush([[28 + fx, 50], [34 + fx, 66]], {w: 3, taper: [0.3, 0.3], seed: 154})} fill={INK} opacity={0.5} />
              </g>
            ) : null}
            {id === 'amo' || id === 'teta' ? (
              <g transform={`translate(${fx} ${L.eyeY})`}>
                {[-1, 1].map((sd) => {
                  const r = id === 'amo' ? 27 : 25;
                  const ring = ellipsePts(sd * L.eyeX * farK(sd), 0, r * farK(sd), r, 24);
                  return (
                    <g key={sd}>
                      <path d={shapeD(ring)} fill={C.turquoiseLight} opacity={0.18} />
                      <path d={brush([[sd * L.eyeX - r * 0.5, -r * 0.3], [sd * L.eyeX - r * 0.1, -r * 0.7]], {w: 4, taper: [0.3, 0.3], seed: 155})} fill={C.white} opacity={0.8} />
                      <path d={brush(ring, {w: id === 'amo' ? 5 : 6, closed: true, dense: false, seed: 156 + sd})} fill={id === 'teta' ? '#7A4A2A' : INK} />
                    </g>
                  );
                })}
                <path d={brush([[-L.eyeX + 26, -2], [0, -8], [L.eyeX - 26, -2]], {w: 5, taper: [0.1, 0.1], tip: 0.8, seed: 158})} fill={id === 'teta' ? '#7A4A2A' : INK} />
              </g>
            ) : null}
          </g>
          {smush > 0.01 ? (
            <g opacity={Math.min(1, smush * 1.5)}>
              {/* flattened on the glass: pale pressed nose + lips + cheek pads, a white pressure rim */}
              {[-1, 1].map((sd) => (
                <path key={sd} d={shapeD(blobPts(sd * 62 + fx, 40, 28, 22, 0.08, 174 + sd, 16, 2))} fill="#F9E1CC" opacity={0.75} />
              ))}
              {/* a small skin-tone button nose with a glass highlight — no pale oval, no round nostrils
                  (that combination reads as a snout, which would be offensive in this market) */}
              <path d={shapeD(blobPts(fx, 24, 19, 13, 0.08, 171, 20, 2))} fill={skin} />
              <path d={shapeD(blobPts(fx, 24, 19, 13, 0.08, 171, 20, 2))} fill={C.white} opacity={0.2} />
              <path d={brush(blobPts(fx, 24, 19, 13, 0.08, 171, 20, 2), {w: 2.5, closed: true, dense: false, seed: 172})} fill={C.white} opacity={0.8} />
              <path d={brush([[fx - 9, 31], [fx, 34], [fx + 9, 31]], {w: 2.6, taper: [0.3, 0.3], seed: 173})} fill={skinShade} />
              <path d={shapeD(blobPts(fx, L.mouthY + 6, 40, 15, 0.08, 176, 20, 2))} fill="#F4A3AE" />
              <path d={brush([[fx - 34, L.mouthY + 6], [fx, L.mouthY + 9], [fx + 34, L.mouthY + 6]], {w: 4, taper: [0.2, 0.2], seed: 177})} fill={INK} />
              <path d={brush(blobPts(fx, L.mouthY + 6, 40, 15, 0.08, 176, 20, 2), {w: 3, closed: true, dense: false, seed: 178})} fill={C.white} opacity={0.9} />
            </g>
          ) : null}
          {front}
        </g>
        {armLayer}
      </g>
    </g>
  );
};
