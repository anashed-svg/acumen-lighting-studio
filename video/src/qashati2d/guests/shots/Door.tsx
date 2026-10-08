// SHOT 4 — the door opens. The same dark front door (peephole ring glowing, chain, lever) from a step back; latch
// click, it swings open towards us (anticipation crack → fast swing on twos → bounce), and there they are, all six,
// crammed in the doorway in the warm corridor light, waving: «مرحبااا! 👋». They surge in; the camera pushes.
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {brush, C, Halftone, INK, onTwos, Pt, roundedPoly, smoothD, SpeechBubble, useBoil} from '../../kit/lib';
import {Cam, camAt, layerG, shake, withShake} from '../camera';
import {Guest, GuestId} from '../art/Guest';
import {COPY, LAYOUT, T} from '../spec';

const DOOR = {x0: 190, x1: 890, top: 300, bot: 1760, base: '#0C4843', grain: '#13605A', deep: '#062E2B'};
const BRASS = {deep: '#8F5F14', base: '#D6A23F', light: '#F6D98A'};
const poly = (pts: Pt[], r = 18) => smoothD(roundedPoly(pts, r, 3), true);

type P = {id: GuestId; x: number; y: number; s: number; side: 1 | -1; ph: number; arm: 'wave' | 'none'; mouth?: 'grin' | 'smile'; eyes?: 'open' | 'smile'};
const CROWD: P[] = [
  {id: 'jiddo', x: 360, y: 700, s: 0.96, side: -1, ph: 0.3, arm: 'wave', eyes: 'smile'},
  {id: 'amo', x: 730, y: 690, s: 0.98, side: 1, ph: 2.1, arm: 'wave'},
  {id: 'teta', x: 560, y: 790, s: 0.86, side: 1, ph: 1.2, arm: 'none', mouth: 'smile'},
  {id: 'khala', x: 330, y: 1040, s: 1.02, side: -1, ph: 0.8, arm: 'wave'},
  {id: 'walad', x: 690, y: 1170, s: 0.9, side: 1, ph: 2.7, arm: 'wave'},
  {id: 'bint', x: 470, y: 1330, s: 0.78, side: -1, ph: 1.6, arm: 'wave'},
];

const doorAngle = (g: number) => {
  const k = onTwos(g);
  if (k < T.doorUnlatch) return 0;
  if (k < T.doorSwing[0]) return 6; // the crack (anticipation)
  const t = k - T.doorSwing[0];
  const dur = T.doorSwing[1] - T.doorSwing[0];
  if (t <= dur * 0.6) return 6 + (118 - 6) * (1 - (1 - t / (dur * 0.6)) ** 2);
  return 106 + 12 * Math.cos((t - dur * 0.6) * 0.6) * Math.exp(-(t - dur * 0.6) * 0.2);
};

const DoorFace: React.FC = () => {
  const g = useMemo(() => {
    const planks = Array.from({length: 7}, (_, i) => DOOR.x0 + 50 + i * 100);
    return {planks};
  }, []);
  const W = DOOR.x1 - DOOR.x0;
  return (
    <g>
      <rect x={DOOR.x0} y={DOOR.top} width={W} height={DOOR.bot - DOOR.top} fill={DOOR.base} />
      {g.planks.map((x, i) => (
        <path key={i} d={brush([[x, DOOR.top + 10], [x + 4, DOOR.bot - 10]], {w: i % 2 ? 4 : 6, taper: [0.02, 0.02], tip: 0.9, jitter: 0.3, seed: 500 + i})} fill={i % 2 ? DOOR.grain : DOOR.deep} />
      ))}
      {/* the peephole ring (the view glows) */}
      <circle cx={540} cy={640} r={50} fill={BRASS.base} stroke={INK} strokeWidth={6} />
      <circle cx={540} cy={640} r={30} fill="#F2CF86" stroke={INK} strokeWidth={5} />
      <circle cx={532} cy={632} r={9} fill={C.white} opacity={0.8} />
      {/* the chain + the lever */}
      <rect x={300} y={1010} width={60} height={34} rx={10} fill={BRASS.base} stroke={INK} strokeWidth={5} />
      <path d={brush([[330, 1028], [420, 1090], [560, 1050]], {w: 8, taper: [0.05, 0.05], tip: 0.8, seed: 510})} fill={BRASS.light} stroke={INK} strokeWidth={1.5} />
      <g transform="translate(780 1050)">
        <circle r={34} fill={BRASS.deep} stroke={INK} strokeWidth={6} />
        <path d={poly([[-20, -14], [-170, -20], [-182, 0], [-170, 18], [-20, 14]], 10)} fill={BRASS.base} stroke={INK} strokeWidth={6} />
        <circle r={14} fill={BRASS.light} stroke={INK} strokeWidth={4} />
      </g>
      <Halftone box={[DOOR.x0, DOOR.top, W, DOOR.bot - DOOR.top]} cell={14} angle={20} fill={DOOR.deep} opacity={0.8} tone={[{t: 'lin', x0: DOOR.x0, y0: 0, x1: DOOR.x1, y1: 0, a: 0.1, b: 0.8}]} />
    </g>
  );
};

export const Door: React.FC<{from: number}> = ({from}) => {
  const g = useCurrentFrame() + from;
  const g2 = onTwos(g);
  const bWall = useBoil({scale: 3, offset: 520, freq: 0.016});
  const base = camAt(
    [
      {f: T.door, x: 600 - 1400, y: 1010, z: 0.92, r: -3},
      {f: T.door + 5, x: 600, y: 1010, z: 0.92, r: -1.2, ease: (t) => 1 - (1 - t) ** 3},
      {f: T.doorSwing[1], x: 590, y: 1000, z: 0.95, r: -0.6},
      {f: T.surge, x: 580, y: 990, z: 0.97, r: -0.4},
      {f: T.sofa, x: 560, y: 930, z: 1.16, r: 1.2, ease: (t) => t * t},
    ],
    g,
  );
  const cam: Cam = withShake(base, shake(g, [{at: T.doorUnlatch, amp: 3}, {at: T.doorSwing[0] + 6, amp: 10}]));
  const ang = doorAngle(g);
  const th = (ang * Math.PI) / 180;
  const W = DOOR.x1 - DOOR.x0;
  const xf = DOOR.x0 + W * Math.cos(th);
  const grow = 1 + 0.25 * Math.sin(th);
  const yc = (DOOR.top + DOOR.bot) / 2;
  const hh = ((DOOR.bot - DOOR.top) / 2) * grow;
  const quad: Pt[] = [
    [DOOR.x0, DOOR.top],
    [xf, yc - hh],
    [xf, yc + hh],
    [DOOR.x0, DOOR.bot],
  ];
  const open = ang > 4;
  const surge = g2 >= T.surge ? Math.min(1, (g2 - T.surge) / 10) : 0;
  return (
    <AbsoluteFill style={{background: '#E8DCC0'}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <defs>
          {bWall.def}
          <clipPath id="doorway">
            <rect x={DOOR.x0} y={DOOR.top} width={DOOR.x1 - DOOR.x0} height={DOOR.bot - DOOR.top} />
          </clipPath>
        </defs>
        <g transform={layerG(cam, 1)}>
          {/* the entrance hall wall (inside), the door frame */}
          <rect x={-1600} y={-600} width={4300} height={3400} fill="#E8DCC0" />
          <Halftone box={[-600, -300, 2300, 2500]} cell={16} angle={20} fill="#D6C59F" tone={[{t: 'rad', cx: 540, cy: 1000, r0: 600, r1: 1300, a: 0, b: 1}]} />
          <rect x={-1600} y={1760} width={4300} height={900} fill="#B98F62" />
          {/* the corridor outside: warm light */}
          {open ? (
            <g clipPath="url(#doorway)">
              <rect x={DOOR.x0} y={DOOR.top} width={W} height={DOOR.bot - DOOR.top} fill="#F2CF86" />
              <Halftone box={[DOOR.x0, DOOR.top, W, DOOR.bot - DOOR.top]} cell={12} angle={20} fill="#D9A651" tone={[{t: 'rad', cx: 540, cy: 560, r0: 160, r1: 760, a: 0, b: 1}]} />
              <ellipse cx={540} cy={DOOR.top + 40} rx={70} ry={36} fill="#FFF3C4" stroke={INK} strokeWidth={5} />
              <rect x={DOOR.x0} y={1560} width={W} height={200} fill="#B97C4B" />
              {CROWD.map((p) => {
                const ph = g2 * 0.42 + p.ph * 2;
                const reveal = Math.min(1, ang / 90);
                return (
                  <Guest
                    key={p.id}
                    id={p.id}
                    x={540 + (p.x - 540) * (1 + 0.1 * surge)}
                    y={p.y + Math.sin(ph * 0.5) * 6 + (1 - reveal) * 30 + surge * 40}
                    scale={p.s * (1 + 0.14 * surge)}
                    tilt={Math.sin(ph * 0.5) * 3}
                    arm={p.arm}
                    side={p.side}
                    wave={Math.sin(ph)}
                    eyes={p.eyes ?? 'open'}
                    mouth={p.mouth ?? 'grin'}
                    look={[(540 - p.x) / 600, 0.1]}
                    brow={0.7}
                    frame={g}
                  />
                );
              })}
            </g>
          ) : null}
          <g filter={bWall.url}>
            {/* the door frame (architrave) */}
            <rect x={DOOR.x0 - 70} y={DOOR.top - 70} width={W + 140} height={70} fill="#F6EFDF" />
            <rect x={DOOR.x0 - 70} y={DOOR.top} width={70} height={DOOR.bot - DOOR.top} fill="#F6EFDF" />
            <rect x={DOOR.x1} y={DOOR.top} width={70} height={DOOR.bot - DOOR.top} fill="#EADFC8" />
            <path d={brush([[DOOR.x0 - 70, DOOR.bot], [DOOR.x0 - 70, DOOR.top - 70], [DOOR.x1 + 70, DOOR.top - 70], [DOOR.x1 + 70, DOOR.bot]], {w: 7, taper: [0.02, 0.02], tip: 0.9, dense: true, seed: 530})} fill={INK} />
            <path d={brush([[DOOR.x0, DOOR.bot], [DOOR.x0, DOOR.top], [DOOR.x1, DOOR.top], [DOOR.x1, DOOR.bot]], {w: 6, taper: [0.02, 0.02], tip: 0.9, dense: true, seed: 531})} fill={INK} />
            {/* key hooks + a little mirror on the right wall (asymmetry, home life) */}
            <g transform="translate(1070 760)">
              <rect x={-60} y={-90} width={120} height={150} rx={60} fill="#CFE9E3" stroke={INK} strokeWidth={7} />
              <path d={brush([[-30, -50], [-10, -66]], {w: 8, taper: [0.3, 0.3], seed: 533})} fill={C.white} />
              <rect x={-70} y={120} width={140} height={22} rx={6} fill="#C9A06A" stroke={INK} strokeWidth={5} />
              {[-40, 0, 40].map((x) => (
                <path key={x} d={brush([[x, 142], [x + 4, 190]], {w: 5, taper: [0.1, 0.1], seed: 534 + x})} fill={INK} />
              ))}
              <rect x={-12} y={186} width={34} height={44} rx={8} fill={C.turquoise} stroke={INK} strokeWidth={4} />
            </g>
            {/* the door itself */}
            {ang <= 82 ? (
              <g transform={`translate(${DOOR.x0} 0) scale(${Math.max(0.02, Math.cos(th))} 1) translate(${-DOOR.x0} 0)`}>
                <DoorFace />
                <rect x={DOOR.x0} y={DOOR.top} width={W} height={DOOR.bot - DOOR.top} fill="none" stroke={INK} strokeWidth={8} />
              </g>
            ) : (
              <g>
                <path d={poly(quad, 6)} fill={DOOR.grain} />
                <path d={brush(roundedPoly(quad, 6, 3), {w: 8, closed: true, dense: true, seed: 532})} fill={INK} />
              </g>
            )}
          </g>
          {/* a shoe rack by the door (home life) */}
          <g transform="translate(980 1700)">
            <rect x={-60} y={-90} width={240} height={90} rx={8} fill="#C9A06A" stroke={INK} strokeWidth={6} />
            <path d={poly([[-40, -90], [40, -90], [50, -118], [-30, -124]], 10)} fill={C.strawberry} stroke={INK} strokeWidth={5} />
          </g>
        </g>
      </svg>
      <SpeechBubble x={LAYOUT.hello.x} y={LAYOUT.hello.y} text={COPY.hello} start={T.hello} exit={T.helloOut} shape="burst" fontSize={84} font="title" fill={C.flameYellow} rotate={-4} seed={41} frame={g} />
    </AbsoluteFill>
  );
};

