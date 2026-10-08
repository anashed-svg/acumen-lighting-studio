// <Hand2D/> — a top-down right hand holding a spoon (back of the hand up, fingers curled under the handle, thumb
// along it), with a RE-SKINNABLE sleeve + accessories, for the «ملعقة وحدة بس» spot (one hand per family member).
// Local art space: the spoon BOWL centre is (0,0), the spoon points up (−y), the arm comes from below (+y) and
// runs off past y ≈ 1300. Place with x/y = bowl centre (parent px), `angle` (deg: 0 = arm from the bottom edge,
// 90 = from the left, −90 = from the right, 180 = from the top), `scale`.
// For an arm that extends towards screen direction `d` (deg, 0 = right, 90 = down) use angle = d − 90 (armAngle(d)).
// Mirror with `left` for a left hand. Presets: HAND_PRESETS.kandura | abaya | kid | grandpa | uncle | aunt | teen.
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, catmull, ellipsePts, Pt, rng, shapeD, smoothD} from '../geom';
import {useBoil} from '../look/Boil';
import {C, INK} from '../palette';
import {SpoonArt} from './Spoon2D';

export type SleevePattern = 'none' | 'stripes' | 'dots' | 'spikes' | 'knit' | 'sheen';
export type Accessory = 'watch' | 'bracelets' | 'misbaha' | 'henna' | 'ring';
export type Sleeve = {color: string; shade?: string; cuff?: string; pattern?: SleevePattern; patternColor?: string; embroidery?: string};

export type Hand2DProps = {
  x: number;
  y: number;
  angle?: number;
  scale?: number;
  /** 0 (light) … 4 (deep) */
  skin?: 0 | 1 | 2 | 3 | 4;
  sleeve?: Sleeve;
  accessories?: Accessory[];
  /** draw the spoon (and how much qashta is on it 0..1) */
  spoon?: boolean;
  load?: number;
  /** mirror for a left hand */
  left?: boolean;
  /** 0..1 grip squeeze (fingers tighten, a tiny squash) — animate on twos for the scoop */
  grip?: number;
  boil?: number;
  frame?: number;
  style?: React.CSSProperties;
};

/** angle for an arm extending from the bowl towards screen direction d (deg; 0 = right, 90 = down) */
export const armAngle = (d: number) => d - 90;

export const HAND_PRESETS: Record<string, Pick<Hand2DProps, 'skin' | 'sleeve' | 'accessories'>> = {
  // white kandura: crisp, clean, a seam on the cuff
  kandura: {skin: 2, sleeve: {color: '#FBFBF6', shade: '#DCE3E0', cuff: '#FFFFFF', pattern: 'none'}},
  // black abaya with gold-thread cuff + henna
  abaya: {skin: 1, sleeve: {color: '#1D1B22', shade: '#0E0D12', cuff: '#1D1B22', pattern: 'sheen', patternColor: '#4A4656', embroidery: '#E2B54A'}, accessories: ['henna', 'ring']},
  // a kid in a dinosaur sleeve
  kid: {skin: 1, sleeve: {color: '#6CC24A', shade: '#4A9A2E', cuff: '#FFB23F', pattern: 'spikes', patternColor: '#FF8A1E'}},
  // grandpa: beige thobe + misbaha
  grandpa: {skin: 3, sleeve: {color: '#D8CDB6', shade: '#B9AC92', cuff: '#D8CDB6', pattern: 'none'}, accessories: ['misbaha']},
  // Egyptian uncle: striped shirt + a big watch
  uncle: {skin: 3, sleeve: {color: '#9CC3E8', shade: '#6F9BC6', cuff: '#9CC3E8', pattern: 'stripes', patternColor: '#3D6FA8'}, accessories: ['watch']},
  // Shami aunt: knit cardigan + bracelets
  aunt: {skin: 0, sleeve: {color: '#C2507E', shade: '#963A61', cuff: '#A8406A', pattern: 'knit', patternColor: '#E07AA2'}, accessories: ['bracelets', 'ring']},
  // teen: hoodie (phone in the other hand is the spot's business)
  teen: {skin: 2, sleeve: {color: '#4F5A66', shade: '#38414B', cuff: '#3A434D', pattern: 'none'}},
};

// ------------------------------------------------------------------------------------------------ geometry
const FINGERS: {c: Pt; rx: number; ry: number; rot: number}[] = [
  {c: [-30, 236], rx: 22, ry: 31, rot: -0.12}, // index (next to the thumb)
  {c: [-3, 228], rx: 22, ry: 33, rot: -0.02},
  {c: [24, 234], rx: 21, ry: 30, rot: 0.1},
  {c: [47, 248], rx: 18, ry: 25, rot: 0.24}, // pinky
];
const BACK: Pt[] = [[-58, 252], [-6, 244], [66, 258], [76, 302], [66, 350], [52, 392], [48, 452], [-44, 454], [-52, 398], [-62, 356], [-70, 302]];
const THUMB: Pt[] = [[-74, 336], [-80, 292], [-64, 254], [-40, 220], [-22, 208], [-9, 216], [-14, 238], [-30, 270], [-42, 312], [-50, 346]];
const SLEEVE_TOP = 446;
// the arm runs a LONG way (≈ 3000 units): at any scale/angle it leaves the frame instead of ending in a rounded stump
// floating on the table (the "puppet on a stick" read)
const SLEEVE_BOT = 3400;
const sleevePts = (): Pt[] => [
  [-80, SLEEVE_TOP + 6], [-30, SLEEVE_TOP - 6], [40, SLEEVE_TOP - 4], [86, SLEEVE_TOP + 8], [104, 700], [122, 1320], [150, 2400], [170, SLEEVE_BOT],
  [-168, SLEEVE_BOT], [-146, 2400], [-118, 1320], [-100, 700],
];

const shrinkShift = (pts: Pt[], k: number, dx: number, dy: number): Pt[] => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy]);
};

type HandGeo = {
  back: string;
  backLit: string;
  backInk: string;
  thumb: string;
  thumbLit: string;
  thumbInk: string;
  nail: string;
  fingers: {d: string; lit: string; ink: string}[];
  knuckles: string;
  tendons: string;
  sleeve: string;
  sleeveShade: string;
  sleeveInk: string;
  cuff: string;
  cuffInk: string;
  folds: string;
};
let geoCache: HandGeo | null = null;
const buildGeo = (): HandGeo => {
  const back = catmull(BACK, true, 6);
  const thumb = catmull(THUMB, true, 6);
  const fingers = FINGERS.map((f, i) => {
    const pts = blobPts(f.c[0], f.c[1], f.rx, f.ry, 0.04, 40 + i, 24, 2, f.rot);
    return {d: smoothD(pts, true), lit: smoothD(shrinkShift(pts, 0.8, -3, -4), true), ink: brush(pts, {w: 4.2, closed: true, dense: true, start: 0.75, seed: 50 + i, shadow: 0.6})};
  });
  const sl = catmull(sleevePts(), true, 6);
  const cuffPts: Pt[] = [[-84, SLEEVE_TOP + 4], [-30, SLEEVE_TOP - 8], [40, SLEEVE_TOP - 6], [90, SLEEVE_TOP + 6], [96, SLEEVE_TOP + 58], [40, SLEEVE_TOP + 48], [-30, SLEEVE_TOP + 46], [-90, SLEEVE_TOP + 58]];
  const cuff = catmull(cuffPts, true, 5);
  let knuckles = '';
  FINGERS.forEach((f, i) => {
    knuckles += brush(ellipsePts(f.c[0], f.c[1] + f.ry * 0.62, f.rx * 0.55, f.ry * 0.22, 8, Math.PI * 1.15, Math.PI * 1.85), {w: 2.4, taper: [0.3, 0.3], dense: true, seed: 60 + i});
  });
  const tendons = [-24, 0, 24, 44]
    .map((x0, i) => brush([[x0 * 0.9, 268], [x0 * 0.75 + 2, 318], [x0 * 0.5 + 4, 372]], {w: 2.2, taper: [0.4, 0.5], seed: 70 + i}))
    .join('');
  const folds =
    brush([[-70, 520], [-40, 560], [-52, 640]], {w: 4, taper: [0.3, 0.5], seed: 81}) +
    brush([[60, 470], [80, 540], [70, 600]], {w: 3.5, taper: [0.3, 0.5], seed: 82}) +
    brush([[-20, 760], [10, 820], [-6, 900]], {w: 3.5, taper: [0.3, 0.5], seed: 83});
  return {
    back: smoothD(back, true),
    backLit: smoothD(shrinkShift(back, 0.86, -8, -6), true),
    backInk: brush(back, {w: 5.5, closed: true, dense: true, start: 0.05, seed: 30, shadow: 0.6}),
    thumb: smoothD(thumb, true),
    thumbLit: smoothD(shrinkShift(thumb, 0.8, -4, -3), true),
    thumbInk: brush(thumb, {w: 5, closed: true, dense: true, start: 0.6, seed: 31, shadow: 0.6}),
    nail: shapeD([[-30, 222], [-20, 212], [-12, 218], [-16, 232], [-26, 236]], 4),
    fingers,
    knuckles,
    tendons,
    sleeve: smoothD(sl, true),
    sleeveShade: smoothD(sl.map(([px, py]) => [px * 0.6 + 30, py] as Pt), true),
    sleeveInk: brush(sl, {w: 7, closed: true, dense: true, start: 0.95, seed: 32, shadow: 0.6}),
    cuff: smoothD(cuff, true),
    cuffInk: brush(cuff, {w: 5, closed: true, dense: true, start: 0.1, seed: 33, shadow: 0.5}),
    folds,
  };
};
const getGeo = () => (geoCache ??= buildGeo());

// ------------------------------------------------------------------------------------------------ accessories
const Henna: React.FC = () => {
  const d = useMemo(() => {
    let s = '';
    s += brush([[-6, 380], [-10, 340], [4, 300], [-4, 262]], {w: 2.6, taper: [0.2, 0.3], seed: 91});
    for (let i = 0; i < 5; i++) {
      const y = 372 - i * 24;
      s += brush([[-6, y], [-26 - (i % 2) * 4, y - 12], [-30, y - 26]], {w: 2.2, taper: [0.2, 0.6], seed: 92 + i});
      s += brush([[-2, y - 6], [18, y - 18], [24, y - 32]], {w: 2.2, taper: [0.2, 0.6], seed: 97 + i});
    }
    const flower = ellipsePts(10, 300, 14, 14, 10).map(([x, y], i) => (i % 2 ? [x, y] : [10 + (x - 10) * 0.55, 300 + (y - 300) * 0.55]) as Pt);
    s += smoothD(flower, true);
    return s;
  }, []);
  return (
    <g>
      <path d={d} fill={C.henna} opacity={0.85} />
      {[[-22, 250], [0, 246], [22, 250], [42, 262]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5} fill={C.henna} opacity={0.8} />
      ))}
    </g>
  );
};

const Watch: React.FC = () => (
  <g>
    <path d={shapeD([[-56, 404], [56, 402], [58, 430], [-58, 432]], 3)} fill="#5A3A22" stroke={INK} strokeWidth={4} />
    <circle cx={2} cy={416} r={30} fill="#E7C15A" stroke={INK} strokeWidth={5} />
    <circle cx={2} cy={416} r={22} fill="#FFFDF4" />
    <path d="M2 416 L2 400 M2 416 L14 422" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    <path d={brush([[-14, 400], [-6, 396]], {w: 4, taper: [0.3, 0.3]})} fill={C.white} />
  </g>
);

const Bracelets: React.FC = () => (
  <g>
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={brush(ellipsePts(0, 404 + i * 13, 56, 12, 18, 0.03 * Math.PI, 0.97 * Math.PI), {w: 7, taper: [0.1, 0.1], tip: 0.5, dense: true, seed: 110 + i})}
        fill={i === 1 ? '#F2C75C' : '#D9A93A'}
        stroke={INK}
        strokeWidth={2}
      />
    ))}
  </g>
);

const Misbaha: React.FC = () => {
  const beads = useMemo(() => {
    const ctrl: Pt[] = [[-52, 410], [-16, 428], [30, 426], [58, 410], [96, 456], [104, 520], [92, 580]];
    const line = catmull(ctrl, false, 10);
    const out: Pt[] = [];
    for (let i = 0; i < line.length; i += 3) out.push(line[i]);
    return out;
  }, []);
  return (
    <g>
      {beads.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={8.5} fill="#7B4A2A" stroke={INK} strokeWidth={2.5} />
          <circle cx={x - 2.5} cy={y - 2.5} r={2.4} fill="#FFE2B8" />
        </g>
      ))}
      <path d={shapeD([[84, 584], [100, 584], [106, 640], [78, 640]], 3)} fill="#2F7A5A" stroke={INK} strokeWidth={3} />
    </g>
  );
};

const Ring: React.FC = () => <path d={brush(ellipsePts(24, 248, 20, 6, 12, 0.05 * Math.PI, 0.95 * Math.PI), {w: 6, taper: [0.1, 0.1], tip: 0.5, dense: true, seed: 120})} fill="#F2C75C" stroke={INK} strokeWidth={2} />;

// ------------------------------------------------------------------------------------------------ sleeve patterns
const SleevePatternArt: React.FC<{s: Sleeve; clip: string}> = ({s, clip}) => {
  const pc = s.patternColor ?? INK;
  const d = useMemo(() => {
    const r = rng(7);
    let out = '';
    if (s.pattern === 'stripes') for (let i = -5; i <= 5; i++) out += brush([[i * 34 - 10, SLEEVE_TOP + 60], [i * 38, 800], [i * 44 + 6, 1320], [i * 56 + 10, SLEEVE_BOT]], {w: 9, taper: [0.02, 0.02], tip: 0.8, nib: 0, seed: 130 + i});
    if (s.pattern === 'dots') for (let i = 0; i < 140; i++) out += shapeD(blobPts(-150 + r() * 300, SLEEVE_TOP + 70 + r() * (SLEEVE_BOT - SLEEVE_TOP), 7, 7, 0.1, i, 10, 2));
    if (s.pattern === 'knit') for (let j = 0; j < 74; j++) for (let i = -6; i <= 6; i++) out += brush([[i * 26 - 6, SLEEVE_TOP + 70 + j * 40], [i * 26, SLEEVE_TOP + 82 + j * 40], [i * 26 + 6, SLEEVE_TOP + 70 + j * 40]], {w: 4, taper: [0.2, 0.2], seed: 140 + i + j * 9});
    if (s.pattern === 'sheen') out += brush([[-60, SLEEVE_TOP + 80], [-70, 700], [-80, SLEEVE_BOT]], {w: 22, taper: [0.2, 0.2], nib: 0, seed: 150}) + brush([[50, SLEEVE_TOP + 120], [62, 760], [70, SLEEVE_BOT]], {w: 9, taper: [0.2, 0.2], nib: 0, seed: 151});
    if (s.pattern === 'spikes')
      for (let j = 0; j < 9; j++) {
        const yy = SLEEVE_TOP + 80 + j * 92;
        const bx = -84 - (yy - SLEEVE_TOP) * 0.038 + 10; // just inside the sleeve's outer edge
        out += `M${bx} ${yy}l${-58} ${18 + (j % 2) * 6}l${54} ${34}Z`;
      }
    return out;
  }, [s.pattern]);
  if (!s.pattern || s.pattern === 'none') return null;
  if (s.pattern === 'spikes')
    return (
      <g>
        <g clipPath={clip}>
          {Array.from({length: 90}).map((_, i) => (
            <circle key={i} cx={-120 + ((i * 53) % 250)} cy={SLEEVE_TOP + 90 + ((i * 97) % (SLEEVE_BOT - SLEEVE_TOP - 100))} r={9 + (i % 3) * 3} fill={s.shade ?? INK} opacity={0.55} />
          ))}
        </g>
      </g>
    );
  return (
    <g clipPath={clip}>
      <path d={d} fill={pc} opacity={s.pattern === 'sheen' ? 0.7 : 0.9} />
    </g>
  );
};

const Spikes: React.FC<{color: string}> = ({color}) => {
  const d = useMemo(() => {
    let out = '';
    for (let j = 0; j < 32; j++) {
      const yy = SLEEVE_TOP + 80 + j * 92;
      const bx = (yy < 1320 ? -84 - (yy - SLEEVE_TOP) * 0.038 : -118 - (yy - 1320) * 0.026) + 12;
      out += `M${bx} ${yy}L${bx - 66} ${yy + 20 + (j % 2) * 6}L${bx} ${yy + 46}Z`;
    }
    return out;
  }, []);
  return <path d={d} fill={color} stroke={INK} strokeWidth={5} strokeLinejoin="round" />;
};

// ------------------------------------------------------------------------------------------------ component
export const Hand2D: React.FC<Hand2DProps> = ({
  x,
  y,
  angle = 0,
  scale = 1,
  skin = 2,
  sleeve = HAND_PRESETS.kandura.sleeve!,
  accessories = [],
  spoon = true,
  load = 0,
  left = false,
  grip = 0,
  boil = 1,
  frame,
  style,
}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const G = getGeo();
  const sk = C.skin[skin];
  const skd = C.skinShade[skin];
  const bHand = useBoil({scale: 2.8 * boil, offset: 31, frame: f, freq: 0.025});
  const bSleeve = useBoil({scale: 3 * boil, offset: 32, frame: f, freq: 0.02});
  const clipId = `slv${Math.round(x)}${Math.round(y)}${Math.round(angle)}`.replace(/-/g, 'm');
  const g = Math.max(0, Math.min(1, grip));
  const R = 1400;
  return (
    <svg
      width={2 * R * scale}
      height={2 * R * scale}
      viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
      style={{position: 'absolute', left: x - R * scale, top: y - R * scale, overflow: 'visible', pointerEvents: 'none', ...style}}
    >
      <defs>
        {bHand.def}
        {bSleeve.def}
        <clipPath id={clipId}>
          <path d={G.sleeve} />
        </clipPath>
      </defs>
      <g transform={`rotate(${angle}) scale(${left ? -1 : 1} 1)`}>
        {/* soft cast shadow on the table (light from the upper left) */}
        <g transform="translate(26 30)" opacity={0.2}>
          <path d={G.sleeve} fill={INK} />
          <path d={G.back} fill={INK} />
        </g>
        {spoon ? (
          <g transform="rotate(180)">
            <SpoonArt load={load} frame={f} boil={boil} />
          </g>
        ) : null}
        <g filter={bSleeve.url}>
          {sleeve.pattern === 'spikes' ? <Spikes color={sleeve.patternColor ?? C.flameOrange} /> : null}
          <path d={G.sleeve} fill={sleeve.shade ?? sleeve.color} />
          <path d={G.sleeveShade} fill={sleeve.color} transform="translate(-34 0)" />
          <SleevePatternArt s={sleeve} clip={`url(#${clipId})`} />
          <path d={G.folds} fill={INK} opacity={0.55} />
          <path d={G.sleeveInk} fill={INK} />
        </g>
        <g filter={bHand.url} transform={`translate(0 ${g * 4}) scale(${1 + g * 0.03} ${1 - g * 0.03})`}>
          <path d={G.back} fill={skd} />
          <path d={G.backLit} fill={sk} />
          {accessories.includes('henna') ? <Henna /> : null}
          <path d={G.tendons} fill={skd} opacity={0.8} />
          <path d={G.backInk} fill={INK} />
          {G.fingers.map((fg, i) => (
            <g key={i} transform={`translate(0 ${g * (i % 2 ? 3 : 5)})`}>
              <path d={fg.d} fill={skd} />
              <path d={fg.lit} fill={sk} />
              <path d={fg.ink} fill={INK} />
            </g>
          ))}
          <path d={G.knuckles} fill={INK} opacity={0.6} />
          <path d={G.thumb} fill={skd} />
          <path d={G.thumbLit} fill={sk} />
          <path d={G.nail} fill="#FBE3D6" stroke={INK} strokeWidth={2} opacity={0.95} />
          <path d={G.thumbInk} fill={INK} />
          {accessories.includes('ring') ? <Ring /> : null}
        </g>
        <g filter={bSleeve.url}>
          <path d={G.cuff} fill={sleeve.cuff ?? sleeve.color} />
          {sleeve.embroidery
            ? [-60, -36, -12, 12, 36, 60].map((cx, i) => <circle key={i} cx={cx} cy={SLEEVE_TOP + 28 + (i % 2) * 6} r={5} fill={sleeve.embroidery} />)
            : null}
          <path d={G.cuffInk} fill={INK} />
          {accessories.includes('watch') ? <Watch /> : null}
          {accessories.includes('bracelets') ? <Bracelets /> : null}
          {accessories.includes('misbaha') ? <Misbaha /> : null}
        </g>
      </g>
    </svg>
  );
};
