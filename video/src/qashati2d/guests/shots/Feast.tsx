// SHOT 6 — the feast (the payoff). Looking down across the coffee table: the qashati sharing plate on its brass tray
// (kit FamilyPlate2D, laid into perspective), a hero cup for the kids, the abandoned dallah + finjans. Behind the
// table the six guests, heart-eyed, spoons of qashta at their mouths, «mmm». Spoons dig into the plate one after
// another (amo from the top, THE HOST — finally — from the bottom in his pyjama sleeve, the dino kid from the right,
// khala from the top-left); the plate gets eaten. «ضيوف فجأة؟ / خلّيها قشطة.»
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {blobPts, brush, C, FamilyPlate2D, Halftone, Hand2D, HAND_PRESETS, HeroCup2D, INK, InkTitle, onTwos, PLATE_SCOOPS, plateScoopPoint, Pt, roundedPoly, shapeD, smoothD} from '../../kit/lib';
import {Cam, camAt, layerCss, layerG, shake, withShake} from '../camera';
import {FloatHearts} from '../art/Fx';
import {Finjan, Guest, GuestId} from '../art/Guest';
import {Dallah, PJ} from '../art/Host';
import {shrink} from '../art/draw';
import {COPY, LAYOUT, T} from '../spec';

const poly = (pts: Pt[], r = 18) => smoothD(roundedPoly(pts, r, 3), true);
const PLATE = {x: 540, y: 1205, scale: 0.98, squash: 0.6};
const TABLE_BACK = 835;

type Diner = {id: GuestId; x: number; y: number; s: number; side: 1 | -1; eyes: 'hearts' | 'closed'; ph: number};
const DINERS: Diner[] = [
  {id: 'teta', x: 800, y: 642, s: 0.62, side: -1, eyes: 'closed', ph: 0.5},
  {id: 'jiddo', x: 600, y: 628, s: 0.66, side: 1, eyes: 'hearts', ph: 1.7},
  {id: 'amo', x: 395, y: 628, s: 0.68, side: -1, eyes: 'hearts', ph: 2.4},
  {id: 'khala', x: 190, y: 642, s: 0.65, side: 1, eyes: 'closed', ph: 0.9},
  {id: 'bint', x: 40, y: 720, s: 0.5, side: 1, eyes: 'hearts', ph: 1.2},
  {id: 'walad', x: 985, y: 720, s: 0.5, side: -1, eyes: 'hearts', ph: 2.9},
];

// the digs: bite i of the plate, by whom, from which side (kit PLATE_SCOOPS order: 0 top, 1 bottom, 2 right, 3 top-left)
type Dig = {bite: number; at: number; hand: 'uncle' | 'host' | 'kid' | 'aunt'};
const DIGS: Dig[] = [
  {bite: 0, at: T.spoonDigs[0], hand: 'uncle'},
  {bite: 1, at: T.spoonDigs[1], hand: 'host'},
  {bite: 2, at: T.spoonDigs[2], hand: 'kid'},
];
const HAND_LOOK = {
  uncle: HAND_PRESETS.uncle,
  kid: HAND_PRESETS.kid,
  aunt: {skin: 1 as const, sleeve: {color: '#E3A72F', shade: '#B37A12', cuff: '#8E2F60', pattern: 'none' as const}, accessories: ['bracelets' as const]},
  host: {skin: 2 as const, sleeve: {color: PJ.base, shade: PJ.shade, cuff: PJ.cuff, pattern: 'stripes' as const, patternColor: PJ.stripe}, accessories: []},
};

/** a hand's bowl position for dig d at frame g: in from outside (on twos), dig, out with a heaped spoon */
const handPose = (d: Dig, g: number) => {
  const g2 = onTwos(g);
  const sc = PLATE_SCOOPS[d.bite];
  const [px, py] = plateScoopPoint(d.bite, PLATE.x, PLATE.y, PLATE.scale);
  const a = (sc.angle * Math.PI) / 180;
  const out = (k: number): Pt => [px + Math.cos(a) * k, py + Math.sin(a) * k];
  const t = g2 - d.at;
  if (t < -12 || t > 16) return null;
  let k = 0;
  let load = 0;
  let grip = 0;
  if (t < -2) k = 700 * ((-2 - t) / 10) ** 1.6 + 30 * Math.sin(((t + 12) / 10) * Math.PI); // in (with a little lift)
  else if (t < 4) {
    k = t < 0 ? -10 : 6;
    grip = t >= 0 ? 1 : 0.4;
    load = t >= 2 ? 0.6 : 0;
  } else {
    k = 900 * ((t - 4) / 12) ** 1.4;
    load = 1;
    grip = 0.6;
  }
  return {pos: out(k), angle: sc.angle - 90, load, grip};
};

/** a spoon crater in the qashta field (top-down, drawn in the plate's plane; light from the upper left like the kit
 *  plate). It must read as a HOLE, not as a disc lying on the plate: the hole is DARKER than the field, its upper-left
 *  inner wall is in shadow under an inked cut edge, the lower-right floor catches the light with a wet glint, a pale
 *  lip of pushed-up qashta rings it (covering the cut fruit edges), honey runs into it, and a drag mark trails off
 *  where the spoon left. */
const Crater: React.FC<{x: number; y: number; r: number; angle: number; seed: number}> = ({x, y, r, angle, seed}) => {
  const a = (angle * Math.PI) / 180;
  const R = (th: number, k: number) => r * k * (1 + 0.24 * Math.cos(2 * (th - a)) + 0.05 * Math.sin(3 * th + seed * 1.7) + 0.03 * Math.sin(5 * th + seed * 2.9));
  const ring = (k: number, th0: number, th1: number, n = 28, dx = 0, dy = 0): Pt[] =>
    Array.from({length: n + 1}, (_, i) => {
      const th = th0 + ((th1 - th0) * i) / n;
      return [dx + Math.cos(th) * R(th, k), dy + Math.sin(th) * R(th, k)] as Pt;
    });
  const D = Math.PI / 180;
  const hole = ring(1, 0, Math.PI * 2, 36).slice(0, -1);
  const lip = ring(1.13, 0, Math.PI * 2, 36).slice(0, -1);
  const floor = ring(0.8, 0, Math.PI * 2, 30, r * 0.3, r * 0.32).slice(0, -1);
  const id = `crater${seed}`;
  // honey running in over the upper-left lip
  const hA = 222 * D + seed * 0.4;
  const hx = (k: number) => Math.cos(hA) * R(hA, k);
  const hy = (k: number) => Math.sin(hA) * R(hA, k);
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={id}>
          <path d={shapeD(hole)} />
        </clipPath>
      </defs>
      {/* the drag trail where the spoon left, then the pale lip of pushed-up qashta */}
      <path d={brush([[Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0], [Math.cos(a) * r * 1.85, Math.sin(a) * r * 1.85]], {w: r * 0.5, taper: [0.15, 0.85], seed: 830 + seed})} fill={C.cream} />
      <path d={shapeD(lip)} fill={C.cream} />
      <path d={brush(ring(1.2, 150 * D, 290 * D, 20), {w: Math.max(3, r * 0.09), dense: false, taper: [0.3, 0.3], seed: 820 + seed})} fill={C.white} />
      <path d={brush(ring(1.22, -20 * D, 120 * D, 20), {w: Math.max(2, r * 0.05), dense: false, taper: [0.4, 0.4], seed: 825 + seed})} fill={C.creamDeep} opacity={0.8} />
      {/* the hole: shadowed walls, a lit floor towards the lower right */}
      <path d={shapeD(hole)} fill="#C9A874" />
      <g clipPath={`url(#${id})`}>
        <path d={shapeD(ring(1, 0, Math.PI * 2, 36, r * 0.14, r * 0.16).slice(0, -1))} fill={C.creamDeep} />
        <path d={shapeD(floor)} fill={C.creamShade} />
        <path d={brush(ring(0.62, 10 * D, 80 * D, 12, r * 0.1, r * 0.12), {w: Math.max(3, r * 0.12), dense: false, taper: [0.4, 0.4], seed: 812 + seed})} fill={C.white} opacity={0.9} />
      </g>
      {/* the sharp cut edge, inked on the shadow side only (an ink line on the lit side would make it a raised disc) */}
      <path d={brush(ring(1, 140 * D, 330 * D, 24), {w: Math.max(3, r * 0.11), dense: false, taper: [0.25, 0.35], seed: 810 + seed})} fill={INK} />
      {/* a thread of honey trickling in over the lip and thinning down the wall (a thread, never a round pool: a
          yellow dot in a pale oval would read as a fried egg after the fridge gag) */}
      <path d={brush([[hx(1.32), hy(1.32)], [hx(1.0), hy(1.0) + r * 0.06], [hx(0.62) + r * 0.08, hy(0.62) + r * 0.12], [hx(0.2) + r * 0.2, hy(0.2) + r * 0.16]], {w: r * 0.2, taper: [0.35, 0.95], tip: 0.2, seed: 850 + seed})} fill={C.honey} />
      <path d={brush([[hx(1.24), hy(1.24) - r * 0.02], [hx(0.95), hy(0.95) + r * 0.03]], {w: r * 0.06, taper: [0.3, 0.3], seed: 851 + seed})} fill={C.honeyLight} />
    </g>
  );
};

export const Feast: React.FC<{from: number}> = ({from}) => {
  const g = useCurrentFrame() + from;
  const g2 = onTwos(g);
  const base = camAt(
    [
      {f: T.feast - 6, x: 540 - 1600, y: 1020, z: 1.06, r: -4},
      {f: T.feast, x: 540, y: 1020, z: 1.06, r: -1, ease: (t) => 1 - (1 - t) ** 3},
      {f: T.titleFinal, x: 540, y: 1010, z: 1.1, r: 0.6},
      {f: T.endCard + 10, x: 540, y: 1000, z: 1.13, r: 1.2},
    ],
    g,
  );
  const cam: Cam = withShake(base, shake(g, [...T.spoonDigs.map((at) => ({at, amp: 4}))]));
  // the plate gets eaten bite by bite (each bite digs in over its dig frames)
  // one spoon = one spoon-sized crater where it dug (the plate stays generous — this is the appetite shot)
  const craters = DIGS.map((d) => ({d, t: Math.min(1, Math.max(0, (g2 - (d.at - 1)) / 4))}));
  return (
    <AbsoluteFill style={{background: '#EADFC6'}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={layerG(cam, 0.8)}>
          <rect x={-900} y={-600} width={3000} height={3200} fill="#EADFC6" />
          <Halftone box={[-400, -300, 1900, 1100]} cell={16} angle={20} fill="#D8C8A4" tone={[{t: 'rad', cx: 540, cy: 300, r0: 300, r1: 900, a: 0, b: 1}]} />
          {/* the red majlis behind them */}
          <path d={poly([[-600, 830], [1700, 810], [1700, 1130], [-600, 1130]], 30)} fill="#9E2B33" />
          <path d={brush([[-600, 832], [1700, 812]], {w: 7, taper: [0.01, 0.01], tip: 0.9, seed: 701})} fill={INK} />
          <path d={brush([[-600, 870], [1700, 852]], {w: 22, taper: [0.01, 0.01], tip: 0.5, seed: 702})} fill="#C24A4F" opacity={0.7} />
        </g>
        <g transform={layerG(cam, 0.92)}>
          {DINERS.map((d) => {
            const k = Math.floor((g2 + d.ph * 10) / 8) % 2;
            return (
              <Guest
                key={d.id}
                id={d.id}
                x={d.x}
                y={d.y + Math.sin(g2 * 0.25 + d.ph) * 4}
                scale={d.s}
                tilt={Math.sin(g2 * 0.2 + d.ph) * 4}
                arm="spoon"
                side={d.side}
                eyes={d.eyes}
                mouth={k ? 'chew' : 'yum'}
                spoonLoad={k ? 0 : 1}
                brow={0.9}
                blush={1}
                pulse={k}
                turn={d.side * -0.15}
                frame={g}
              />
            );
          })}
          <FloatHearts
            spawns={DINERS.flatMap((d, i) => [
              {x: d.x + 30 * d.s, y: d.y - 140 * d.s, at: T.feast + 6 + i * 5, r: 30 * d.s},
              {x: d.x - 50 * d.s, y: d.y - 120 * d.s, at: T.heartPops[i % 4], r: 26 * d.s},
              {x: d.x + 10, y: d.y - 160 * d.s, at: T.heartPops[(i + 2) % 4] + 6, r: 22 * d.s},
            ])}
            life={36}
          />
        </g>
      </svg>
      {/* the table plane (HTML: the kit plate + hands live here) */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: layerCss(cam, 1)}}>
        <svg width={10} height={10} style={{position: 'absolute', overflow: 'visible'}}>
          <path d={poly([[-700, TABLE_BACK], [1780, TABLE_BACK], [1900, 2700], [-820, 2700]], 30)} fill="#B07A45" />
          <Halftone box={[-700, TABLE_BACK, 2500, 1300]} cell={15} angle={20} fill="#8E5C30" opacity={0.85} tone={[{t: 'lin', x0: 0, y0: TABLE_BACK, x1: 0, y1: TABLE_BACK + 700, a: 0.8, b: 0}, {t: 'noise', amp: 0.3, freq: 0.01, seed: 4}]} />
          {[1010, 1120, 1260, 1430, 1640].map((y, i) => (
            <path key={i} d={brush([[-700, y], [1800, y + 6]], {w: 4, taper: [0.02, 0.02], tip: 0.8, jitter: 0.3, seed: 710 + i})} fill="#8E5C30" opacity={0.6} />
          ))}
          <path d={brush([[-700, TABLE_BACK], [1780, TABLE_BACK]], {w: 8, taper: [0.01, 0.01], tip: 0.9, seed: 715})} fill={INK} />
          {/* the abandoned dallah + finjans (the coffee did its job) */}
          <g transform="translate(70 960) rotate(-6)">
            <Dallah s={0.5} />
          </g>
          {[[210, 896], [880, 900], [120, 1580]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(0.9)`}>
              <Finjan coffee={0.1} />
            </g>
          ))}
        </svg>
        {/* the plate in perspective + the digging hands (clipped to the table: arms come from behind its back edge) */}
        <div style={{position: 'absolute', left: 0, top: TABLE_BACK, width: 1080, height: 1400, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: -TABLE_BACK, width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${PLATE.x}px, ${PLATE.y}px) scale(1, ${PLATE.squash}) translate(${-PLATE.x}px, ${-PLATE.y}px)`}}>
            <FamilyPlate2D x={PLATE.x} y={PLATE.y} scale={PLATE.scale} scoopsTaken={0} tray="brass" frame={g} />
            <svg width={10} height={10} style={{position: 'absolute', overflow: 'visible'}}>
              {craters.map(({d, t}) => {
                if (t <= 0) return null;
                const [cx, cy] = plateScoopPoint(d.bite, PLATE.x, PLATE.y, PLATE.scale);
                return <Crater key={d.bite} x={cx} y={cy} r={58 * t} angle={PLATE_SCOOPS[d.bite].angle} seed={d.bite} />;
              })}
            </svg>
            {DIGS.map((d) => {
              const p = handPose(d, g);
              if (!p) return null;
              const look = HAND_LOOK[d.hand];
              return <Hand2D key={d.bite} x={p.pos[0]} y={p.pos[1]} angle={p.angle} scale={0.8} skin={look.skin} sleeve={look.sleeve} accessories={look.accessories as never} load={p.load} grip={p.grip} frame={g} />;
            })}
          </div>
        </div>
        {/* the kids' hero cup on the right */}
        <HeroCup2D x={900} y={1660} scale={0.55} glint={Math.max(0, Math.min(1, (g - T.feast - 30) / 14))} wobble={Math.sin(g2 * 0.3) * 0.15} frame={g} />
      </div>
      <InkTitle x={LAYOUT.finalTitle.x} y={LAYOUT.finalTitle.y} text={COPY.finalTitle} start={T.titleFinal} stagger={T.titleStagger} fontSize={LAYOUT.finalTitle.size} rotate={-2.5} plate={C.turquoise} frame={g} />
    </AbsoluteFill>
  );
};

