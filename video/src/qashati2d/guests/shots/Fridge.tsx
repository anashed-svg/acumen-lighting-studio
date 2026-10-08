// SHOT 2 — the empty fridge. Whip in, the host's pyjama hand grabs the handle and YANKS (anticipation → swing →
// bounce). The light flickers on (buzz), cold mist rolls out… inside: ONE egg in a six-egg tray, a lemon, a nearly empty
// ketchup bottle. A dead beat. The lemon rolls and clinks the egg (it wobbles). The bulb dies.
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {blobPts, brush, C, ellipsePts, Halftone, INK, onTwos, Pt, roundedPoly, shapeD, smoothD, useBoil} from '../../kit/lib';

/** a straight-sided polygon with softly rounded corners */
const poly = (pts: Pt[], r = 18) => smoothD(roundedPoly(pts, r, 3), true);
import {Cam, camAt, layerG, shake, withShake} from '../camera';
import {Mist} from '../art/Fx';
import {GripFist, Sleeve} from '../art/Host';
import {shrink} from '../art/draw';
import {T} from '../spec';

const FR = {x0: 170, x1: 910, top: 230, split: 560, bot: 1720};
export const WALL = {base: '#EDE3CB', tile: '#CFE9E3', tileInk: '#2C6C66'};
const BODY = {base: '#F7F3E8', shade: '#D8D1BE', deep: '#B9B19B'};
const ICE = {lit: '#E2F5F2', litShade: '#BFE3DE', dark: '#173431', darkShade: '#0E2422'};

/** door angle (deg) over time: ajar on the grab, swing open past 90°, bounce, settle */
const doorAngle = (g: number) => {
  const k = onTwos(g);
  if (k < T.handGrab) return 0;
  if (k < T.fridgeYank) return 4 * ((k - T.handGrab) / (T.fridgeYank - T.handGrab)); // the pull (seal holding)
  const t = k - T.fridgeYank;
  if (t <= 6) return 4 + (124 - 4) * (1 - (1 - t / 6) ** 2);
  return 112 + 12 * Math.cos((t - 6) * 0.55) * Math.exp(-(t - 6) * 0.22);
};
const isLit = (g: number) => {
  if (g >= T.bulbDies) return false;
  const ons = T.lightOn;
  const offs = T.lightOff;
  let lit = false;
  const evts = [...ons.map((f) => ({f, on: true})), ...offs.map((f) => ({f, on: false}))].sort((a, b) => a.f - b.f);
  for (const e of evts) if (g >= e.f) lit = e.on;
  return lit;
};

export const Tiles: React.FC<{x0: number; y0: number; x1: number; y1: number}> = ({x0, y0, x1, y1}) => {
  const d = useMemo(() => {
    let p = '';
    let ink = '';
    const s = 110;
    for (let x = x0; x < x1; x += s)
      for (let y = y0; y < y1; y += s) {
        const cx = x + s / 2;
        const cy = y + s / 2;
        // a four-petal cement-tile motif
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          const petal = blobPts(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 20, 11, 0.05, 3 + k, 12, 2, a);
          p += shapeD(petal);
        }
        ink += brush([[x, y], [x + s, y + 1]], {w: 2.5, taper: [0.02, 0.02], tip: 0.9, seed: Math.round(x + y)});
        ink += brush([[x, y], [x + 1, y + s]], {w: 2.5, taper: [0.02, 0.02], tip: 0.9, seed: Math.round(x * 3 + y)});
      }
    return {p, ink};
  }, [x0, y0, x1, y1]);
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={WALL.tile} />
      <path d={d.p} fill={C.turquoiseShade} opacity={0.55} />
      <path d={d.ink} fill={WALL.tileInk} opacity={0.5} />
    </g>
  );
};

const Lemon: React.FC<{rot: number}> = ({rot}) => {
  const g = useMemo(() => {
    const body: Pt[] = [[-62, 0], [-48, -30], [-10, -42], [34, -36], [58, -16], [72, 0], [58, 18], [30, 36], [-14, 40], [-48, 28]];
    return {d: shapeD(body, 6), lit: shapeD(shrink(body, 0.84, -6, -8), 6), ink: brush(body, {w: 6, closed: true, dense: false, seed: 301, shadow: 0.6}), pores: Array.from({length: 18}, (_, i) => [(-40 + ((i * 37) % 80)), -20 + ((i * 23) % 44)] as Pt)};
  }, []);
  return (
    <g transform={`rotate(${rot})`}>
      <path d={g.d} fill="#E0B400" />
      <path d={g.lit} fill="#FFE04A" />
      {g.pores.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill="#D9A800" opacity={0.7} />
      ))}
      <path d={brush([[-34, -22], [-8, -30], [20, -26]], {w: 7, taper: [0.3, 0.5], seed: 302})} fill={C.white} opacity={0.9} />
      <path d={g.ink} fill={INK} />
      <path d={brush([[70, -2], [80, -4]], {w: 6, taper: [0.2, 0.2], seed: 303})} fill={INK} />
    </g>
  );
};

/** a six-egg carton with its lid flipped open … and ONE egg */
const EggTray: React.FC<{wob: number}> = ({wob}) => {
  const g = useMemo(() => {
    const body: Pt[] = [[-170, -60], [170, -60], [186, 30], [-186, 30]];
    const lid: Pt[] = [[-170, -60], [170, -60], [150, -150], [-150, -150]];
    const cups: Pt[] = [];
    [-46, -4].forEach((y, row) => [-1, 0, 1].forEach((k) => cups.push([k * (row ? 112 : 100), y])));
    return {body, lid, cups, egg: blobPts(0, -40, 34, 44, 0.03, 311, 26, 2)};
  }, []);
  return (
    <g>
      {/* the open lid (bumpy cardboard) */}
      <path d={poly(g.lid, 10)} fill="#BFB196" />
      {[-100, 0, 100].map((x) => (
        <ellipse key={x} cx={x * 0.88} cy={-108} rx={34} ry={20} fill="#D3C6AB" stroke={INK} strokeWidth={3} opacity={0.9} />
      ))}
      <path d={brush(roundedPoly(g.lid, 10, 3), {w: 5, closed: true, dense: true, seed: 309})} fill={INK} />
      <path d={poly(g.body, 12)} fill="#D3C6AB" />
      <path d={poly([[-186, 30], [186, 30], [180, 58], [-180, 58]], 6)} fill="#A8987C" stroke={INK} strokeWidth={4} />
      {g.cups.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={42} ry={17} fill="#8F7F63" />
          <ellipse cx={x} cy={y + 3} rx={34} ry={11} fill="#6F6048" />
          <path d={brush(ellipsePts(x, y, 42, 17, 18, Math.PI, Math.PI * 2), {w: 3.6, dense: false, seed: 312 + i})} fill={INK} opacity={0.8} />
        </g>
      ))}
      <path d={brush(roundedPoly(g.body, 12, 3), {w: 5, closed: true, dense: true, seed: 310})} fill={INK} />
      {/* the ONE egg (front-left cup), wobbling */}
      <g transform={`translate(-112 -2) rotate(${wob})`}>
        <path d={shapeD(g.egg)} fill="#E9DCC4" />
        <path d={shapeD(shrink(g.egg, 0.86, -5, -6))} fill="#FFF8EC" />
        <path d={brush([[-18, -60], [-22, -40]], {w: 7, taper: [0.3, 0.5], seed: 313})} fill={C.white} />
        <path d={brush(g.egg, {w: 5, closed: true, dense: false, seed: 314, shadow: 0.6})} fill={INK} />
      </g>
    </g>
  );
};

/** a moth flutters out of the empty fridge (the classic "nothing in here" gag) */
const Moth: React.FC<{t: number; flap: number}> = ({t, flap}) => {
  if (t <= 0 || t >= 1) return null;
  const x = 520 + 420 * t + 50 * Math.sin(t * 14);
  const y = 1000 - 760 * t + 40 * Math.cos(t * 11);
  const s = 0.9 + 1.6 * t;
  const w = flap ? 1 : 0.35;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${-20 + 30 * Math.sin(t * 9)})`}>
      {[-1, 1].map((sd) => (
        <path key={sd} d={shapeD([[0, 0], [sd * 46, -30 * w], [sd * 60, 6 * w], [sd * 22, 22]], 4)} fill="#B8A88E" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      ))}
      <ellipse rx={9} ry={20} fill="#7A6A52" stroke={INK} strokeWidth={4} />
      <path d={brush([[-4, -18], [-14, -34]], {w: 3, seed: 370})} fill={INK} />
      <path d={brush([[4, -18], [14, -34]], {w: 3, seed: 371})} fill={INK} />
      {/* dust puffs behind it */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={-30 - i * 26} cy={34 + i * 18} r={9 - i * 2} fill={C.white} opacity={0.7 - i * 0.2} />
      ))}
    </g>
  );
};

const Cobweb: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.85}>
    {[0, 0.4, 0.8, 1.2, 1.57].map((a, i) => (
      <path key={i} d={brush([[0, 0], [Math.cos(a) * 150, Math.sin(a) * 150]], {w: 2.4, taper: [0.05, 0.4], seed: 380 + i})} fill={INK} />
    ))}
    {[50, 95, 135].map((r, i) => (
      <path key={i} d={brush(ellipsePts(0, 0, r, r, 10, 0.02, 1.55).map(([px, py], k) => [px - (k % 2) * 4, py - (k % 2) * 4] as Pt), {w: 2.2, dense: false, taper: [0.1, 0.1], seed: 390 + i})} fill={INK} />
    ))}
  </g>
);

const Ketchup: React.FC = () => (
  <g transform="rotate(14)">
    <path d={shapeD([[-44, -150], [44, -150], [52, -20], [44, 0], [-44, 0], [-52, -20]], 6)} fill="#F6C9C4" opacity={0.85} />
    <path d={shapeD([[-50, -40], [50, -40], [46, -2], [-46, -2]], 4)} fill={C.chili} />
    <path d={shapeD([[-28, -150], [28, -150], [24, -186], [-24, -186]], 3)} fill={C.white} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d={shapeD([[-10, -186], [10, -186], [6, -206], [-6, -206]], 2)} fill={C.white} stroke={INK} strokeWidth={4} />
    <rect x={-40} y={-118} width={80} height={52} rx={6} fill="#FFF7E8" stroke={INK} strokeWidth={3.5} />
    <path d={brush([[-24, -98], [20, -96]], {w: 5, taper: [0.2, 0.2], seed: 320})} fill={C.chili} opacity={0.6} />
    <path d={brush([[-30, -140], [-34, -60]], {w: 6, taper: [0.3, 0.5], seed: 321})} fill={C.white} opacity={0.9} />
    <path d={brush([[-44, -150], [-52, -20], [-44, 0], [44, 0], [52, -20], [44, -150]], {w: 5.5, dense: false, taper: [0.02, 0.02], tip: 0.9, seed: 322})} fill={INK} />
  </g>
);

export const Fridge: React.FC<{from: number}> = ({from}) => {
  const g = useCurrentFrame() + from;
  const g2 = onTwos(g);
  const bDoor = useBoil({scale: 3, offset: 330, freq: 0.018});
  const bIn = useBoil({scale: 2.4, offset: 331, freq: 0.022});
  const base = camAt(
    [
      {f: T.fridge, x: 540 + 1500, y: 980, z: 0.98, r: 2},
      {f: T.fridge + 6, x: 540, y: 980, z: 0.98, r: 0, ease: (t) => 1 - (1 - t) ** 3},
      {f: T.fridgeYank + 4, x: 548, y: 1000, z: 1.0, r: 0},
      {f: T.deadBeat[0], x: 560, y: 1050, z: 1.3, r: -0.6},
      {f: T.bulbDies, x: 568, y: 1080, z: 1.46, r: -1.4},
      {f: T.clock, x: 570, y: 1082, z: 1.47, r: -1.5},
    ],
    g,
  );
  const cam: Cam = withShake(base, shake(g, [{at: T.fridgeYank + 6, amp: 9}, {at: T.lemonClink, amp: 3}, {at: T.bulbDies, amp: 4}]));
  const ang = doorAngle(g);
  const open = ang > 2;
  const lit = isLit(g);
  const th = (ang * Math.PI) / 180;
  const W = FR.x1 - FR.x0;
  const xf = FR.x0 + W * Math.cos(th);
  const grow = 1 + 0.22 * Math.sin(th);
  const yTop = FR.split + 20;
  const yBot = FR.bot;
  const yc = (yTop + yBot) / 2;
  const hh = ((yBot - yTop) / 2) * grow;
  const doorQuad: Pt[] = [
    [FR.x0, yTop],
    [xf, yc - hh],
    [xf, yc + hh],
    [FR.x0, yBot],
  ];
  const inner = ang > 90;
  // the handle on the free edge (outer face) — the hand holds it until it leaves frame
  const handleX = FR.x0 + (W - 50) * Math.cos(th);
  const handle: Pt = [handleX, yc - hh * 0.62];
  const handOn = g2 >= T.handGrab && g2 < T.fridgeYank + 8;
  const handEnter = Math.min(1, Math.max(0, (g - (T.handGrab - 6)) / 6));
  const lemonT0 = Math.min(1, Math.max(0, (g2 - T.lemonRoll) / (T.lemonClink - T.lemonRoll)));
  const lemonT = lemonT0;
  const lemonX = 790 - 150 * lemonT * lemonT;
  const eggWob = g2 >= T.lemonClink ? 12 * Math.sin((g2 - T.lemonClink) * 0.9) * Math.exp(-(g2 - T.lemonClink) * 0.15) : 0;
  const inC = lit ? ICE : {lit: ICE.dark, litShade: ICE.darkShade};
  const flick = g >= T.bulbDies && g < T.bulbDies + 2;
  return (
    <AbsoluteFill style={{background: WALL.base}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <defs>
          {bDoor.def}
          {bIn.def}
        </defs>
        <g transform={layerG(cam, 0.85)}>
          <rect x={-1200} y={-400} width={3600} height={2900} fill={WALL.base} />
          <Tiles x0={-1180} y0={420} x1={2300} y1={1500} />
          <rect x={-1200} y={1720} width={3600} height={800} fill="#C9B48E" />
          <path d={brush([[-1200, 1722], [2400, 1722]], {w: 6, taper: [0.01, 0.01], tip: 0.9, seed: 340})} fill={INK} />
        </g>
        <g transform={layerG(cam, 1)}>
          {/* fridge shadow + body */}
          <path d={poly([[FR.x0 + 30, FR.top + 40], [FR.x1 + 46, FR.top + 40], [FR.x1 + 60, FR.bot + 30], [FR.x0 + 30, FR.bot + 30]], 40)} fill={INK} opacity={0.22} />
          <g filter={bDoor.url}>
            <rect x={FR.x0} y={FR.top} width={W} height={FR.bot - FR.top} rx={46} fill={BODY.shade} />
            <rect x={FR.x0 - 6} y={FR.top - 4} width={W - 40} height={FR.bot - FR.top - 10} rx={44} fill={BODY.base} />
            {/* freezer door */}
            <path d={brush([[FR.x0 + 10, FR.split], [FR.x1 - 10, FR.split]], {w: 6, taper: [0.02, 0.02], tip: 0.9, seed: 341})} fill={INK} />
            <rect x={FR.x1 - 120} y={FR.split - 230} width={26} height={170} rx={13} fill={BODY.deep} stroke={INK} strokeWidth={5} />
            <rect x={FR.x0} y={FR.top} width={W} height={FR.bot - FR.top} rx={46} fill="none" stroke={INK} strokeWidth={8} />
            {/* a magnet + a child's drawing on the freezer door (home life) */}
            <g transform={`translate(${FR.x0 + 150} ${FR.top + 150}) rotate(-6)`}>
              <rect x={-70} y={-80} width={150} height={170} fill="#FFFDF6" stroke={INK} strokeWidth={4} />
              {/* a crayon house (an M-zigzag here read as a fast-food logo at phone size) */}
              <path d={brush([[-46, 6], [-2, -34], [44, 6]], {w: 7, taper: [0.1, 0.1], seed: 342})} fill={C.strawberry} />
              <path d={brush([[-34, 4], [-34, 60], [34, 60], [34, 4]], {w: 6, taper: [0.1, 0.1], seed: 343})} fill={C.strawberry} />
              <path d={brush([[-8, 60], [-8, 30], [10, 30], [10, 60]], {w: 5, taper: [0.1, 0.1], seed: 344})} fill={C.turquoiseDeep} />
              <circle cx={30} cy={-40} r={16} fill="#FFD23F" stroke={INK} strokeWidth={3} />
              <circle cx={4} cy={-82} r={14} fill={C.turquoise} stroke={INK} strokeWidth={4} />
            </g>
          </g>
          {/* the interior (seen once the door opens) */}
          {open ? (
            <g filter={bIn.url}>
              <rect x={FR.x0 + 26} y={FR.split + 26} width={W - 52} height={FR.bot - FR.split - 52} rx={18} fill={inC.litShade} />
              <path d={poly([[FR.x0 + 70, FR.split + 70], [FR.x1 - 70, FR.split + 70], [FR.x1 - 70, FR.bot - 70], [FR.x0 + 70, FR.bot - 70]], 10)} fill={inC.lit} />
              {lit ? <Halftone box={[FR.x0 + 26, FR.split + 26, W - 52, FR.bot - FR.split - 52]} cell={10} angle={20} fill={ICE.litShade} tone={[{t: 'rad', cx: 540, cy: FR.split + 120, r0: 120, r1: 700, a: 0, b: 1}]} /> : null}
              {/* perspective corners */}
              {[[FR.x0 + 26, FR.split + 26, FR.x0 + 70, FR.split + 70], [FR.x1 - 26, FR.split + 26, FR.x1 - 70, FR.split + 70], [FR.x0 + 26, FR.bot - 26, FR.x0 + 70, FR.bot - 70], [FR.x1 - 26, FR.bot - 26, FR.x1 - 70, FR.bot - 70]].map((l, i) => (
                <path key={i} d={brush([[l[0], l[1]], [l[2], l[3]]], {w: 4, taper: [0.1, 0.1], seed: 350 + i})} fill={INK} opacity={0.7} />
              ))}
              {/* glass shelves */}
              {[880, 1150, 1420].map((y, i) => (
                <g key={y}>
                  <path d={poly([[FR.x0 + 30, y], [FR.x1 - 30, y], [FR.x1 - 70, y - 30], [FR.x0 + 70, y - 30]], 4)} fill={lit ? '#F4FFFD' : '#2A4A47'} opacity={0.75} />
                  <path d={brush([[FR.x0 + 30, y], [FR.x1 - 30, y + 2]], {w: 7, taper: [0.02, 0.02], tip: 0.9, seed: 355 + i})} fill={INK} />
                  {lit ? <path d={brush([[FR.x0 + 60, y - 6], [FR.x0 + 300, y - 6]], {w: 4, taper: [0.3, 0.5], seed: 358 + i})} fill={C.white} /> : null}
                </g>
              ))}
              <Cobweb x={FR.x0 + 72} y={FR.split + 72} s={1.1} />
              {/* the bulb */}
              <circle cx={540} cy={FR.split + 66} r={20} fill={lit ? '#FFF6C8' : '#3A504D'} stroke={INK} strokeWidth={5} />
              {flick ? <path d={brush([[530, FR.split + 60], [552, FR.split + 74]], {w: 6, seed: 360})} fill={C.flameYellow} /> : null}
              {/* the contents: a nearly empty ketchup bottle (top shelf), ONE egg + a lemon (middle shelf) */}
              <g opacity={lit ? 1 : 0.9} style={{filter: lit ? undefined : 'brightness(0.32) saturate(0.6)'}}>
                <g transform={`translate(700 ${880 - 4}) scale(1.45)`}>
                  <Ketchup />
                </g>
                <g transform={`translate(420 ${1150 - 50}) scale(1.15)`}>
                  <EggTray wob={eggWob} />
                </g>
                <g transform={`translate(${lemonX} ${1150 - 64}) scale(1.55)`}>
                  <Lemon rot={-((790 - lemonX) / 100) * 57} />
                </g>
              </g>
              {/* the crisper drawer: empty */}
              <path d={poly([[FR.x0 + 60, 1450], [FR.x1 - 60, 1450], [FR.x1 - 70, 1660], [FR.x0 + 70, 1660]], 14)} fill={lit ? '#D3EEEA' : '#1E3A37'} opacity={0.8} />
              <path d={brush(roundedPoly([[FR.x0 + 60, 1450], [FR.x1 - 60, 1450], [FR.x1 - 70, 1660], [FR.x0 + 70, 1660]], 14, 3), {w: 5, closed: true, dense: true, seed: 362})} fill={INK} opacity={0.8} />
            </g>
          ) : null}
          {/* the door */}
          <g filter={bDoor.url}>
            <path d={poly(doorQuad, 40)} fill={inner ? '#EDE6D4' : BODY.base} />
            {inner ? (
              <g>
                {/* door shelves (empty) + the gasket */}
                {[0.25, 0.55, 0.82].map((t, i) => {
                  const y0 = FR.split + 20 + (yBot - yTop) * t;
                  const x1 = FR.x0 + (xf - FR.x0) * 0.9;
                  return (
                    <path
                      key={i}
                      d={poly([[FR.x0 + (xf - FR.x0) * 0.1, y0], [x1, y0 + (grow - 1) * 80 * (t - 0.5)], [x1, y0 + 60], [FR.x0 + (xf - FR.x0) * 0.1, y0 + 60]], 6)}
                      fill={BODY.shade}
                      stroke={INK}
                      strokeWidth={4}
                    />
                  );
                })}
              </g>
            ) : (
              <rect x={Math.min(handleX, handleX - 10)} y={handle[1] - 160} width={22} height={300} rx={11} fill={BODY.deep} stroke={INK} strokeWidth={5} transform={`translate(-11 0)`} />
            )}
            <path d={brush(roundedPoly(doorQuad, 40, 3), {w: 8, closed: true, dense: true, seed: 365})} fill={INK} />
          </g>
          {/* the moth is out of shot before the dead beat (on twos): in the dead beat NOTHING moves but the hum */}
          <Moth t={(onTwos(g) - T.moth) / (T.deadBeat[0] - T.moth)} flap={Math.floor(g / 2) % 2} />
          {/* cold mist rolling out */}
          {open ? <Mist x0={FR.x0 + 40} x1={FR.x1 - 40} y={FR.bot - 120} t={Math.max(0, (g - T.mist) / 40)} seed={7} /> : null}
          {/* the bulb's light spills onto the floor */}
          {lit && open ? <Halftone box={[FR.x0 - 200, FR.bot, W + 400, 300]} cell={12} angle={20} fill="#F4FFFD" opacity={0.8} tone={[{t: 'rad', cx: 540, cy: FR.bot, r0: 60, r1: 520, a: 1, b: 0, sx: 1.6, sy: 0.6}]} /> : null}
        </g>
        {/* the host's hand (foreground: moves more) */}
        {handOn || (g2 >= T.handGrab - 6 && g2 < T.handGrab) ? (
          <g transform={layerG(cam, 1.08)}>
            <g transform={`translate(${(1 - handEnter) * 220} ${(1 - handEnter) * 300})`}>
              <Sleeve pts={[[handle[0] + 620, handle[1] + 1150], [handle[0] + 330, handle[1] + 560], [handle[0] + 118, handle[1] + 96]]} w0={210} w1={150} seed={11} />
              <g transform={`translate(${handle[0]} ${handle[1]}) rotate(${-6 + (g2 >= T.fridgeYank ? -12 : 0)})`}>
                <GripFist s={1.5} squeeze={g2 >= T.handGrab + 2 ? 1 : 0} />
              </g>
            </g>
          </g>
        ) : null}
        {/* dark overlay when the bulb dies: only the kitchen's ambient */}
        {g >= T.bulbDies ? <rect x={0} y={0} width={1080} height={1920} fill={INK} opacity={0.28} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

