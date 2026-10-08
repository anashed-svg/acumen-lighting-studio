// SHOT 1 — the peephole (the hook). Frame 0: «ضيوف فجأة 😳» over a door viewer crammed with six grinning, waving
// guests, «دينغ…» already ringing. «دونغ!» at T.dong. The boy winds back and SMUSHES his face on the lens (cross-eyed,
// nose flat, breath fog). The host jumps back (the lens shrinks into the door), whip to the kitchen.
// The lens content is drawn flat and bent by a real barrel distortion (feDisplacementMap + a pre-computed map,
// tools/make_fisheye.py) — door frames and the ceiling lamp curve like a real door viewer.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {blobPts, brush, C, ellipsePts, Halftone, INK, InkTitle, onTwos, rng, shapeD, useBoil} from '../../kit/lib';
import {Cam, camAt, layerG, shake, withShake} from '../camera';
import {SfxWord} from '../art/Fx';
import {Guest, GuestId} from '../art/Guest';
import {COPY, LAYOUT, T} from '../spec';

export const FISHEYE_MAP = 'qashati2d/guests/fisheye.png';
const SCALE_R = 0.42; // must match tools/make_fisheye.py
const R = LAYOUT.lens.r;
const DOOR = {base: '#0C4843', grain: '#13605A', deep: '#062E2B'};
const BRASS = {deep: '#8F5F14', base: '#D6A23F', light: '#F6D98A', engrave: '#7E5212'};

type Pose = {id: GuestId; x: number; y: number; s: number; tilt: number; side: 1 | -1; ph: number; arm: 'wave' | 'none'};
// lens-local layout (before the bulge): back row → front
const CROWD: Pose[] = [
  {id: 'jiddo', x: -104, y: -196, s: 0.74, tilt: -8, side: -1, ph: 0.4, arm: 'wave'},
  {id: 'teta', x: 112, y: -200, s: 0.7, tilt: 9, side: 1, ph: 1.9, arm: 'wave'},
  {id: 'khala', x: -176, y: -18, s: 0.8, tilt: -12, side: -1, ph: 0.9, arm: 'wave'},
  {id: 'amo', x: 180, y: -30, s: 0.8, tilt: 10, side: 1, ph: 2.6, arm: 'none'},
  {id: 'bint', x: -206, y: 186, s: 0.56, tilt: -14, side: -1, ph: 1.3, arm: 'wave'},
];

const Hallway: React.FC = () => {
  const b = useBoil({scale: 2.5, offset: 201, freq: 0.02});
  return (
    <g>
      <defs>{b.def}</defs>
      <rect x={-R - 40} y={-R - 40} width={2 * R + 80} height={2 * R + 80} fill="#F2CF86" />
      <Halftone box={[-R, -R, 2 * R, 2 * R]} cell={12} angle={20} fill="#D9A651" opacity={0.85} tone={[{t: 'rad', cx: 0, cy: -60, r0: 160, r1: 470, a: 0, b: 1}]} />
      <g filter={b.url}>
        {/* the corridor: a floor, the far wall, neighbours' door frames (they bend in the lens) */}
        <path d={`M${-R - 40} 300L${R + 40} 300L${R + 40} ${R + 40}L${-R - 40} ${R + 40}Z`} fill="#B97C4B" />
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <rect x={sd > 0 ? 330 : -400} y={-R - 40} width={70} height={340 + R} fill="#E6B565" />
            <path d={brush([[sd * 330, -R - 40], [sd * 330, 300]], {w: 7, taper: [0.02, 0.02], tip: 0.8, seed: 210 + sd})} fill={INK} />
            <path d={brush([[sd * 400, -R - 40], [sd * 400, 300]], {w: 6, taper: [0.02, 0.02], tip: 0.8, seed: 212 + sd})} fill={INK} />
          </g>
        ))}
        <path d={brush([[-R - 40, 300], [R + 40, 300]], {w: 7, taper: [0.02, 0.02], tip: 0.8, seed: 214})} fill={INK} />
        {[-300, -150, 0, 150, 300].map((x, i) => (
          <path key={i} d={brush([[x * 0.6, 300], [x * 1.6, R + 40]], {w: 4, taper: [0.02, 0.2], seed: 215 + i})} fill={INK} opacity={0.5} />
        ))}
        {/* the ceiling lamp */}
        <path d={brush([[0, -R - 40], [0, -330]], {w: 5, seed: 220})} fill={INK} />
        <path d={shapeD(ellipsePts(0, -300, 56, 34, 24))} fill="#FFF3C4" />
        <path d={brush(ellipsePts(0, -300, 56, 34, 24), {w: 5, closed: true, dense: false, seed: 221})} fill={INK} />
      </g>
    </g>
  );
};

/** the door's lever handle + keyhole plate (so the frame reads "front door" at a glance) */
const DoorHardware: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-60} y={-150} width={120} height={330} rx={50} fill={BRASS.deep} stroke={INK} strokeWidth={7} />
    <rect x={-50} y={-140} width={100} height={310} rx={44} fill={BRASS.base} />
    <path d={brush([[-30, -110], [-34, 120]], {w: 10, taper: [0.3, 0.4], seed: 292})} fill={BRASS.light} />
    <path d={shapeD([[-14, 70], [14, 70], [8, 120], [-8, 120]], 3)} fill={INK} />
    <circle cx={0} cy={66} r={16} fill={INK} />
    <circle r={44} cy={-60} fill={BRASS.deep} stroke={INK} strokeWidth={6} />
    <path d={shapeD([[-10, -78], [-330, -86], [-350, -60], [-330, -34], [-10, -42]], 4)} fill={BRASS.base} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
    <path d={brush([[-40, -70], [-310, -74]], {w: 9, taper: [0.2, 0.4], seed: 293})} fill={BRASS.light} />
    <circle r={18} cy={-60} fill={BRASS.light} stroke={INK} strokeWidth={5} />
  </g>
);

export const Peephole: React.FC = () => {
  const f = useCurrentFrame();
  const f2 = onTwos(f);
  // camera: a slow creep in on the lens; the recoil (zoom out fast, a jolt); then the whip to the LEFT
  const base = camAt(
    [
      {f: 0, x: 540, y: 960, z: 1.0},
      {f: T.recoil, x: 534, y: 950, z: 1.05},
      {f: T.recoil + 6, x: 560, y: 980, z: 0.46, ease: (t) => 1 - (1 - t) ** 3},
      {f: T.whip1, x: 560, y: 980, z: 0.44},
      {f: T.whip1 + 8, x: -900, y: 980, z: 0.44, ease: (t) => t * t * t},
    ],
    f,
  );
  const cam: Cam = withShake(base, shake(f, [{at: T.ding, amp: 10}, {at: T.dong, amp: 16}, {at: T.kidSmush, amp: 9}, {at: T.recoil, amp: 14}]));
  const lensX = LAYOUT.lens.x;
  const lensY = LAYOUT.lens.y;

  // the boy: wind back → lunge → smush (on twos), jerks back on the recoil
  const k = f2;
  let kid = {x: 6, y: 66, s: 0.92, squash: 0, smush: 0, cross: 0, eyes: 'open' as 'open' | 'wide' | 'smile', mouth: 'grin' as 'grin' | 'o' | 'flat'};
  if (k >= T.kidLean && k < T.kidLean + 6) kid = {...kid, y: 84, s: 0.86, squash: -0.07};
  if (k >= T.kidLean + 6 && k < T.kidSmush) {
    const u = (k - (T.kidLean + 6)) / (T.kidSmush - T.kidLean - 6);
    kid = {...kid, x: 6 - 6 * u, y: 66 - 40 * u, s: 0.92 + 1.0 * u, squash: -0.1, eyes: 'wide'};
  }
  if (k >= T.kidSmush && k < T.recoil + 2) {
    const t = k - T.kidSmush;
    kid = {x: 0, y: 20, s: 1.95, squash: 0.16 - 0.04 * Math.min(1, t / 6), smush: 1, cross: 0.95, eyes: 'open', mouth: 'flat'};
  }
  if (k >= T.recoil + 2) kid = {x: 10, y: 70, s: 1.25, squash: -0.05, smush: 0, cross: 0, eyes: 'smile', mouth: 'grin'};
  const others = k >= T.kidSmush - 2 && k < T.recoil + 2;
  const fog = k >= T.kidSmush ? Math.min(1, (k - T.kidSmush) / 8) : 0;

  const r = rng(Math.floor(f / 2) * 11 + 3);
  return (
    <AbsoluteFill style={{background: DOOR.deep}}>
      {/* preload the displacement map (Img holds the render until it is decoded; feImage then hits the cache) */}
      <Img src={staticFile(FISHEYE_MAP)} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <filter id="fisheye" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x={-R} y={-R} width={2 * R} height={2 * R} colorInterpolationFilters="sRGB">
            <feImage href={staticFile(FISHEYE_MAP)} x={-R} y={-R} width={2 * R} height={2 * R} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={SCALE_R * 2 * R} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="lensClip">
            <circle cx={0} cy={0} r={R} />
          </clipPath>
        </defs>
        <g transform={layerG(cam, 1)}>
          {/* the inside of the front door: painted wood planks */}
          <rect x={-1400} y={-1600} width={3900} height={5100} fill={DOOR.base} />
          {Array.from({length: 26}).map((_, i) => (
            <path
              key={i}
              d={brush(
                [
                  [-1300 + i * 140 + (i % 3) * 20, -1600],
                  [-1290 + i * 140, 400],
                  [-1300 + i * 140 + (i % 2) * 14, 3400],
                ],
                {w: i % 4 === 0 ? 7 : 3, taper: [0.01, 0.01], tip: 0.9, jitter: 0.3, seed: 230 + i},
              )}
              fill={i % 4 === 0 ? DOOR.deep : DOOR.grain}
              opacity={0.9}
            />
          ))}
          <Halftone box={[-700, -1200, 2500, 4400]} cell={22} angle={20} fill={DOOR.deep} opacity={0.9} tone={[{t: 'rad', cx: lensX, cy: lensY, r0: 560, r1: 1500, a: 0, b: 1}]} />
          <DoorHardware x={lensX + 300} y={lensY + R + 330} />
          {/* the door viewer */}
          <g transform={`translate(${lensX} ${lensY})`}>
            {/* brass escutcheon */}
            <circle r={R + 58} fill={INK} opacity={0.35} transform="translate(10 14)" />
            <circle r={R + 56} fill={BRASS.deep} />
            <circle r={R + 48} fill={BRASS.base} transform="translate(-4 -5)" />
            <path d={brush(ellipsePts(0, 0, R + 30, R + 30, 60, Math.PI * 1.05, Math.PI * 1.55), {w: 14, taper: [0.3, 0.3], dense: false, seed: 240})} fill={BRASS.light} />
            {Array.from({length: 36}).map((_, i) => {
              const a = (i / 36) * Math.PI * 2;
              return <path key={i} d={brush([[Math.cos(a) * (R + 14), Math.sin(a) * (R + 14)], [Math.cos(a) * (R + 40), Math.sin(a) * (R + 40)]], {w: 3, taper: [0.3, 0.3], seed: 241 + i})} fill={BRASS.engrave} opacity={0.7} />;
            })}
            <path d={brush(ellipsePts(0, 0, R + 56, R + 56, 72), {w: 8, closed: true, dense: false, seed: 280})} fill={INK} />
            {/* the view */}
            <g clipPath="url(#lensClip)">
              <g filter="url(#fisheye)">
                <Hallway />
                {CROWD.map((p) => {
                  const ph = f2 * 0.42 + p.ph * 2;
                  const bob = Math.sin(ph * 0.5) * 6;
                  const hide = others && (p.id === 'khala' || p.id === 'amo' || p.id === 'bint');
                  return (
                    <Guest
                      key={p.id}
                      id={p.id}
                      x={p.x + (others ? Math.sign(p.x) * 40 : 0)}
                      y={p.y + bob}
                      scale={p.s}
                      tilt={p.tilt + Math.sin(ph * 0.5) * 2}
                      arm={hide ? 'none' : p.arm}
                      side={p.side}
                      wave={Math.sin(ph)}
                      eyes={p.id === 'jiddo' ? 'smile' : 'open'}
                      look={[-Math.sign(p.x) * 0.3, -0.1]}
                      mouth={p.id === 'teta' ? 'smile' : 'grin'}
                      brow={0.6}
                      blush={0.8}
                    />
                  );
                })}
                <Guest
                  id="walad"
                  x={kid.x}
                  y={kid.y + (kid.smush ? 0 : Math.sin(f2 * 0.3) * 5)}
                  scale={kid.s}
                  squash={kid.squash}
                  tilt={kid.smush ? 0 : -4}
                  arm="none"
                  side={1}
                  wave={Math.sin(f2 * 0.45 + 1)}
                  eyes={kid.eyes}
                  mouth={kid.mouth}
                  look={[0, -0.25]}
                  cross={kid.cross}
                  smush={kid.smush}
                  brow={kid.smush ? 1 : 0.6}
                  blush={1}
                />
              </g>
              {/* breath fog on the glass (not bent: it's ON the lens) */}
              {fog > 0 ? (
                <g opacity={0.62 * fog * (k >= T.recoil + 2 ? 0.6 : 1)}>
                  <path d={shapeD(blobPts(-4, 186, 120 + 60 * fog, 64 + 30 * fog, 0.16, 250, 30, 3))} fill={C.white} />
                  <path d={shapeD(blobPts(40, 160, 70 * fog, 40 * fog, 0.2, 251, 20, 3))} fill={C.white} />
                </g>
              ) : null}
              {/* lens: dark rim (halftone), a glass glare */}
              <Halftone box={[-R, -R, 2 * R, 2 * R]} cell={13} angle={20} fill={INK} opacity={0.95} tone={[{t: 'rad', cx: 0, cy: 0, r0: R * 0.84, r1: R * 1.0, a: 0, b: 1, pow: 1.3}]} />
              <path d={brush(ellipsePts(0, 0, R * 0.8, R * 0.8, 40, Math.PI * 1.08, Math.PI * 1.38), {w: 26, taper: [0.4, 0.4], tip: 0.05, dense: false, seed: 252})} fill={C.white} opacity={0.42} />
              <path d={brush(ellipsePts(0, 0, R * 0.68, R * 0.68, 30, Math.PI * 1.12, Math.PI * 1.26), {w: 12, taper: [0.4, 0.4], tip: 0.05, dense: false, seed: 253})} fill={C.white} opacity={0.5} />
            </g>
            <path d={brush(ellipsePts(0, 0, R + 2, R + 2, 72), {w: 9, closed: true, dense: false, seed: 254})} fill={INK} />
          </g>
        </g>
      </svg>
      {/* type (screen space) */}
      <InkTitle
        x={LAYOUT.hookTitle.x + (f >= T.dong && f < T.dong + 8 ? (r() - 0.5) * 14 : 0)}
        y={LAYOUT.hookTitle.y}
        text={COPY.hookTitle}
        start={T.titleHook}
        stagger={4}
        fontSize={LAYOUT.hookTitle.size}
        color={C.cream}
        plate={C.turquoise}
        plateOffset={[8, 7]}
        rotate={-3}
        exit={T.titleHookOut}
      />
      <SfxWord x={LAYOUT.ding.x} y={LAYOUT.ding.y} text={COPY.ding} size={LAYOUT.ding.size} rot={LAYOUT.ding.rot} start={T.ding} from={1} exit={T.recoil} color={C.turquoise} burst={C.flameYellow} />
      <SfxWord x={LAYOUT.dong.x} y={LAYOUT.dong.y} text={COPY.dong} size={LAYOUT.dong.size} rot={LAYOUT.dong.rot} start={T.dong} exit={T.recoil} color={C.flameYellow} burst={C.turquoise} />
    </AbsoluteFill>
  );
};
