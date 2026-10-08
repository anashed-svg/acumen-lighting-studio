// SHOT 5 — the coffee stall, then the arrival. The six on the red majlis sofa, each holding out a finjan.
// «ضيّفناهن قهوة…»: the host's pyjama arm pours gahwa from the dallah, cup after cup (the camera tracks along the row):
// each guest's eyes POP wider after their cup; grandpa shakes his finjan (the Gulf «enough» sign) and gets poured anyway;
// the whole sofa vibrates on caffeine. Then «تشك-تشك!» — the brand cymbals are the doorbell this time: six heads SNAP
// to the door, eyes turn to hearts, «…ووصلت القشاطي 🛵».
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {brush, C, ellipsePts, Halftone, INK, InkTitle, onTwos, Pt, rng, roundedPoly, shapeD, smoothD, SpeechBubble, useBoil} from '../../kit/lib';
import {Cam, camAt, layerG, shake, toScreen, withShake} from '../camera';
import {FloatHearts, ShakeMarks, SfxWord} from '../art/Fx';
import {Finjan, Guest, GuestId} from '../art/Guest';
import {Dallah, DALLAH_HANDLE, DALLAH_SPOUT, GripFist, Pour, Sleeve} from '../art/Host';
import {COPY, LAYOUT, T} from '../spec';

const poly = (pts: Pt[], r = 18) => smoothD(roundedPoly(pts, r, 3), true);
const SOFA = {base: '#9E2B33', shade: '#7A1F27', light: '#C24A4F', top: 760, seat: 1150, front: 1400};

type Seat = {id: GuestId; x: number; y: number; s: number};
// the sofa recedes to the right (vanishing point VP): front guest big on the left, the kids crammed at the far end
export const VP: Pt = [1750, 760];
const seatLineY = (x: number) => 1500 + (VP[1] - 1500) * ((x + 200) / (VP[0] + 200));
const backLineY = (x: number) => 960 + (VP[1] - 960) * ((x + 200) / (VP[0] + 200));
const frontBotY = (x: number) => 1820 + (VP[1] - 1820) * ((x + 200) / (VP[0] + 200));
const S = (id: GuestId, x: number, s: number, kid = false): Seat => ({id, x, s, y: seatLineY(x) - 405 * s + (kid ? 26 * s : 0)});
export const SEATS: Seat[] = [
  S('walad', 1030, 0.58, true),
  S('bint', 940, 0.6, true),
  S('teta', 830, 0.74),
  S('jiddo', 680, 0.9),
  S('khala', 470, 1.08),
  S('amo', 210, 1.3),
];
const seat = (id: GuestId) => SEATS.find((s) => s.id === id)!;
/** the mouth of a seated guest's finjan (arm 'cup', side +1) */
const cupMouth = (st: Seat): Pt => [st.x + 64 * st.s, st.y + 185 * st.s];

const Room: React.FC = () => {
  const b = useBoil({scale: 3, offset: 601, freq: 0.016});
  return (
    <g>
      <rect x={-900} y={-600} width={3600} height={3200} fill="#EADFC6" />
      <Halftone box={[-400, -300, 2600, 1300]} cell={14} angle={20} fill="#DCCDAB" tone={[{t: 'lin', x0: 0, y0: 380, x1: 0, y1: 960, a: 0, b: 0.75}]} />
      <g filter={b.url}>
        {/* a framed painting (a palm at sunset — four coloured dots in a box read as a UI/traffic light) + a plant (home) */}
        <g transform="translate(1060 560) scale(0.62)">
          <rect x={-150} y={-110} width={300} height={200} fill="#C9A06A" stroke={INK} strokeWidth={7} />
          <rect x={-128} y={-88} width={256} height={156} fill="#F6D98A" />
          <circle cx={58} cy={-22} r={34} fill={C.mango} />
          <path d={shapeD([[-128, 40], [-40, 18], [40, 30], [128, 14], [128, 68], [-128, 68]], 10)} fill="#E7C27A" />
          <path d={brush([[-50, 62], [-56, 10], [-44, -40]], {w: 12, taper: [0.2, 0.5], seed: 604})} fill="#7A4A35" />
          {[-2.6, -2.0, -1.2, -0.5].map((t, i) => (
            <path key={i} d={brush([[-44, -40], [-44 + Math.cos(t) * 50, -40 + Math.sin(t) * 26 - 8], [-44 + Math.cos(t) * 86, -40 + Math.sin(t) * 10 + 22]], {w: 14, taper: [0.3, 0.9], seed: 605 + i})} fill={i % 2 ? C.kiwi : C.kiwiDeep} />
          ))}
          <rect x={-128} y={-88} width={256} height={156} fill="none" stroke={INK} strokeWidth={4} />
        </g>
        <g transform="translate(-160 700) scale(0.9)">
          <path d={poly([[-50, 0], [50, 0], [38, 110], [-38, 110]], 8)} fill="#C9744A" stroke={INK} strokeWidth={6} />
          {[-40, -12, 18, 44].map((a, i) => (
            <path key={i} d={shapeD([[0, 0], [a * 2.2 - 20, -170 - (i % 2) * 40], [a * 2.2 + 20, -150 - (i % 2) * 40]], 6)} fill={i % 2 ? C.kiwi : C.kiwiDeep} stroke={INK} strokeWidth={4} />
          ))}
        </g>
        {/* the majlis sofa (receding): backrest */}
        <path d={poly([[-400, backLineY(-400) - 10], [VP[0], VP[1]], [VP[0], seatLineY(VP[0])], [-400, seatLineY(-400) + 20]], 10)} fill={SOFA.base} />
        <path d={brush([[-400, backLineY(-400)], [1500, backLineY(1500)]], {w: 8, taper: [0.01, 0.2], tip: 0.5, seed: 602})} fill={INK} />
        <path d={brush([[-400, backLineY(-400) + 70], [1500, backLineY(1500) + 18]], {w: 26, taper: [0.01, 0.4], tip: 0.3, seed: 603})} fill={SOFA.light} opacity={0.7} />
      </g>
    </g>
  );
};

/** the seat front: a receding panel with a sadu band in perspective */
const SeatFront: React.FC = () => {
  const d = useMemo(() => {
    let tri = '';
    let tri2 = '';
    let x = -400;
    while (x < 1500) {
      const k = (seatLineY(x + 1) - frontBotY(x + 1)) / (1500 - 1820);
      const w = 64 * k;
      const y0 = seatLineY(x) + 60 * k;
      const y1 = y0 + 52 * k;
      tri += `M${x} ${y1}L${x + w / 2} ${y0}L${x + w} ${y1}Z`;
      tri2 += `M${x + w * 0.32} ${y1 - 12 * k}L${x + w / 2} ${y0 + 18 * k}L${x + w * 0.68} ${y1 - 12 * k}Z`;
      x += w;
    }
    const band: Pt[] = [];
    for (let t = 0; t <= 20; t++) {
      const bx = -400 + (1900 * t) / 20;
      const k = (seatLineY(bx) - frontBotY(bx)) / (1500 - 1820);
      band.push([bx, seatLineY(bx) + 52 * k]);
    }
    for (let t = 20; t >= 0; t--) {
      const bx = -400 + (1900 * t) / 20;
      const k = (seatLineY(bx) - frontBotY(bx)) / (1500 - 1820);
      band.push([bx, seatLineY(bx) + 120 * k]);
    }
    return {tri, tri2, band: smoothD(band, true)};
  }, []);
  return (
    <g>
      <path d={poly([[-400, seatLineY(-400) - 30], [1600, seatLineY(1600) - 12], [1600, frontBotY(1600)], [-400, frontBotY(-400)]], 16)} fill={SOFA.base} />
      <path d={d.band} fill="#F3E6CC" />
      <path d={d.tri} fill={INK} />
      <path d={d.tri2} fill={C.turquoise} />
      <path d={brush([[-400, seatLineY(-400) - 30], [1600, seatLineY(1600) - 12]], {w: 8, taper: [0.01, 0.2], tip: 0.5, seed: 610})} fill={INK} />
      <path d={poly([[-400, frontBotY(-400)], [1700, frontBotY(1700)], [1700, 2600], [-400, 2600]], 4)} fill="#7A4A35" />
      <path d={brush([[-400, frontBotY(-400)], [1600, frontBotY(1600)]], {w: 7, taper: [0.01, 0.2], tip: 0.5, seed: 611})} fill={INK} />
      <clipPath id="seatFrontClip">
        <path d={poly([[-400, seatLineY(-400) - 30], [1600, seatLineY(1600) - 12], [1600, frontBotY(1600)], [-400, frontBotY(-400)]], 16)} />
      </clipPath>
      <Halftone box={[-400, 900, 2100, 1000]} cell={14} angle={20} fill={SOFA.shade} opacity={0.9} tone={[{t: 'lin', x0: -400, y0: 0, x1: 1400, y1: 0, a: 0.1, b: 0.9}]} clipPath="url(#seatFrontClip)" />
    </g>
  );
};

/** guest acting over the shot */
const act = (id: GuestId, g: number) => {
  const g2 = onTwos(g);
  const pourIdx = T.pours.findIndex((p) => p.who === id);
  const pour = pourIdx >= 0 ? T.pours[pourIdx] : null;
  let eyes: 'open' | 'wide' | 'hearts' | 'smile' = 'open';
  let mouth: 'smile' | 'grin' | 'o' = 'smile';
  let wired = 0;
  let brow = 0.4;
  let look: Pt = [0.6, 0.2];
  let coffee = 0.15;
  let cupShake = 0;
  let turn = 0;
  let jitter = 0;
  if (pour) {
    if (g2 >= pour.start) coffee = Math.min(1, 0.15 + (0.85 * (g2 - pour.start)) / (pour.end - pour.start));
    if (g2 >= pour.wide) {
      eyes = 'wide';
      mouth = 'grin';
      wired = 0.7;
      brow = 1;
      look = [0, 0];
      jitter = 0.5;
    }
  }
  if (id === 'jiddo' && g2 >= T.enoughShake && g2 < T.pours[2].end) {
    cupShake = Math.floor(g2 / 2) % 2 ? 1 : -1;
    mouth = 'o';
    brow = -0.6;
  }
  if (g2 >= T.wired) {
    eyes = 'wide';
    mouth = id === 'teta' || id === 'bint' ? 'o' : 'grin';
    wired = 1;
    brow = 1;
    jitter = 1;
    look = [0, 0];
  }
  if (g2 >= T.beat && g2 < T.headSnap) {
    // the beat: everybody freezes, wide-eyed, mid-vibration
    jitter = 0;
    wired = 0.35;
    mouth = 'o';
  }
  if (g2 >= T.headSnap) {
    turn = -0.85;
    look = [-1, 0];
    jitter = 0;
    wired = 0;
    eyes = 'open';
    mouth = 'o';
  }
  if (g2 >= T.hearts) {
    eyes = 'hearts';
    mouth = 'grin';
    brow = 0.8;
    turn = -0.6;
  }
  return {eyes, mouth, wired, brow, look, coffee, cupShake, turn, jitter};
};

export const Majlis: React.FC<{from: number}> = ({from}) => {
  const g = useCurrentFrame() + from;
  const g2 = onTwos(g);
  const base = camAt(
    [
      {f: T.sofa, x: 450, y: 930, z: 1.28, r: 1.5},
      {f: T.pours[0].end, x: 420, y: 930, z: 1.34, r: 1},
      {f: T.pours[1].start - 2, x: 580, y: 900, z: 1.36, r: 0},
      {f: T.pours[1].end, x: 590, y: 900, z: 1.4, r: -0.5},
      {f: T.pours[2].start - 2, x: 730, y: 880, z: 1.5, r: -1},
      {f: T.wired - 2, x: 735, y: 880, z: 1.56, r: -1.2},
      // pull out wide on the vibration, and land dead still on the freeze (the camera holds its breath too)
      {f: T.beat, x: 558, y: 960, z: 1.01, r: 0.2, ease: (t) => 1 - (1 - t) ** 3},
      {f: T.arrivalDing, x: 558, y: 960, z: 1.01, r: 0.2},
      {f: T.feast - 6, x: 560, y: 950, z: 1.07, r: 1},
      {f: T.feast, x: 2300, y: 950, z: 1.07, r: 4, ease: (t) => t * t * t},
    ],
    g,
  );
  const cam: Cam = withShake(base, shake(g, [...T.pours.map((p) => ({at: p.wide, amp: 6})), {at: T.wired, amp: 10}, {at: T.arrivalDing, amp: 14}, {at: T.headSnap, amp: 8}]));
  const r = rng(Math.floor(g / 2) * 31 + 7);

  // the dallah: travels between cups (upright), tilts to pour
  const dallahAt = (): {target: Pt; tilt: number; stream: number; idx: number} => {
    const P = T.pours;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const tgt = cupMouth(seat(p.who as GuestId));
      if (g2 < p.start - 6) {
        if (i === 0) return {target: tgt, tilt: 0, stream: 0, idx: i};
        continue;
      }
      if (g2 < p.start) {
        // travelling in from the previous cup (on twos, anticipation lift)
        const prev = i > 0 ? cupMouth(seat(P[i - 1].who as GuestId)) : tgt;
        const u = (g2 - (p.start - 6)) / 6;
        const e = u < 0.3 ? -0.08 : Math.min(1, (u - 0.3) / 0.6);
        return {target: [prev[0] + (tgt[0] - prev[0]) * e, prev[1] + (tgt[1] - prev[1]) * e - Math.sin(u * Math.PI) * 60], tilt: -6, stream: 0, idx: i};
      }
      if (g2 <= p.end) {
        const k = g2 - p.start;
        const tilt = k < 2 ? -20 : -38;
        return {target: tgt, tilt, stream: k < 2 ? 0 : Math.min(1, (k - 2) / 2 + 0.5), idx: i};
      }
      if (i === P.length - 1 || g2 < P[i + 1].start - 6) return {target: tgt, tilt: g2 < p.end + 2 ? -18 : 0, stream: 0, idx: i};
    }
    const last = cupMouth(seat(P[P.length - 1].who as GuestId));
    return {target: last, tilt: 0, stream: 0, idx: P.length - 1};
  };
  const dl = dallahAt();
  const gs = seat(T.pours[dl.idx].who as GuestId).s;
  const SD = 0.6 * gs;
  const FS = 0.66 * gs;
  const a = (dl.tilt * Math.PI) / 180;
  const rotP = (p: Pt): Pt => [p[0] * SD * Math.cos(a) - p[1] * SD * Math.sin(a), p[0] * SD * Math.sin(a) + p[1] * SD * Math.cos(a)];
  const tipWanted: Pt = [dl.target[0] + 6, dl.target[1] - 190 * gs];
  const sp = rotP(DALLAH_SPOUT);
  const B: Pt = [tipWanted[0] - sp[0], tipWanted[1] - sp[1]];
  const hd = rotP(DALLAH_HANDLE);
  const handle: Pt = [B[0] + hd[0], B[1] + hd[1]];
  const dallahGone = g2 >= T.wired;
  return (
    <AbsoluteFill style={{background: '#EADFC6'}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={layerG(cam, 0.9)}>
          <Room />
        </g>
        <g transform={layerG(cam, 1)}>
          {SEATS.map((st, i) => {
            const A = act(st.id, g);
            const jx = A.jitter ? (r() - 0.5) * 14 * A.jitter : 0;
            const jy = A.jitter ? (r() - 0.5) * 10 * A.jitter : 0;
            const snapSmear = g2 === T.headSnap ? -10 : 0;
            const cupless = st.id === 'walad' || st.id === 'bint';
            return (
              <g key={st.id}>
                <Guest
                  id={st.id}
                  x={st.x + jx}
                  y={st.y + jy + Math.sin(g2 * 0.2 + i) * 3}
                  scale={st.s}
                  arm={cupless ? 'none' : 'cup'}
                  side={1}
                  coffee={A.coffee}
                  cupShake={A.cupShake}
                  eyes={A.eyes}
                  mouth={A.mouth}
                  wired={A.wired}
                  brow={A.brow}
                  look={A.look}
                  turn={A.turn}
                  headDx={snapSmear + A.turn * 8}
                  pulse={Math.floor(g2 / 4) % 2}
                  frame={g}
                />
                {(() => {
                  const p = T.pours.find((pp) => pp.who === st.id);
                  const t = p ? g2 - p.wide : -1;
                  if (t < 0 || t > 8) return null;
                  return (
                    <g transform={`translate(${st.x} ${st.y - 20 * st.s}) scale(${st.s * (1 + t * 0.04)})`} opacity={1 - t / 10}>
                      {[-2.4, -1.9, -1.4, -0.9, -0.6].map((a, k) => (
                        <path key={k} d={brush([[Math.cos(a) * 150, Math.sin(a) * 150], [Math.cos(a) * 205, Math.sin(a) * 205]], {w: 9, taper: [0.2, 0.7], seed: 640 + k})} fill={INK} />
                      ))}
                    </g>
                  );
                })()}
                {A.jitter > 0.6 ? (
                  <g transform={`translate(${st.x} ${st.y})`}>
                    <g transform={`scale(${st.s})`}>
                      <ShakeMarks hw={110} h={110} on />
                    </g>
                  </g>
                ) : null}
              </g>
            );
          })}
          <SeatFront />
          {/* hearts float up once the eyes turn */}
          <FloatHearts spawns={SEATS.flatMap((st, i) => [{x: st.x + 40 * st.s, y: st.y - 150 * st.s, at: T.hearts + 2 + (i % 3) * 2, r: 30 * st.s}, {x: st.x - 60 * st.s, y: st.y - 120 * st.s, at: T.hearts + 8 + (i % 2) * 4, r: 22 * st.s}])} life={34} />
        </g>
        {/* the host's arm + dallah (foreground plane, slightly larger parallax) */}
        {!dallahGone ? (
          <g transform={layerG(cam, 1.04)}>
            <Pour a={[B[0] + sp[0], B[1] + sp[1]]} b={[dl.target[0], dl.target[1] - 6]} t={dl.stream} w={13} />
            <Sleeve pts={[[handle[0] + 900, handle[1] + 560], [handle[0] + 380, handle[1] + 230], [handle[0] + 84 * FS, handle[1] + 40 * FS]]} w0={240} w1={128 * FS} seed={31} />
            <g transform={`translate(${B[0]} ${B[1]}) rotate(${dl.tilt})`}>
              <Dallah s={SD} />
            </g>
            <g transform={`translate(${handle[0]} ${handle[1]}) rotate(${dl.tilt - 4})`}>
              <GripFist s={FS} squeeze={dl.stream > 0 ? 1 : 0} />
            </g>
          </g>
        ) : null}
        {/* foreground: the coffee table (bottom right) with a brass tray of spare finjans + dates */}
        <g transform={layerG(cam, 1.22)}>
          <path d={poly([[380, 1420], [1700, 1360], [1800, 2400], [300, 2400]], 26)} fill="#B07A45" />
          <Halftone box={[300, 1360, 1500, 700]} cell={14} angle={20} fill="#8E5C30" opacity={0.8} tone={[{t: 'lin', x0: 380, y0: 0, x1: 1300, y1: 0, a: 0.1, b: 0.9}]} />
          <path d={brush([[380, 1420], [1700, 1360]], {w: 8, taper: [0.01, 0.2], tip: 0.5, seed: 620})} fill={INK} />
          <ellipse cx={900} cy={1560} rx={300} ry={80} fill="#D6A23F" stroke={INK} strokeWidth={7} />
          <ellipse cx={890} cy={1550} rx={262} ry={60} fill="none" stroke="#8F5F14" strokeWidth={4} />
          {[760, 880, 1000].map((x) => (
            <g key={x} transform={`translate(${x} ${1590}) scale(1.1)`}>
              <Finjan coffee={0} />
            </g>
          ))}
          <g transform="translate(640 1600)">
            <ellipse rx={100} ry={34} fill="#F6EFDF" stroke={INK} strokeWidth={6} />
            {[-40, 0, 40].map((x, i) => (
              <ellipse key={i} cx={x} cy={-14} rx={22} ry={13} fill="#6B3A1E" stroke={INK} strokeWidth={4} />
            ))}
          </g>
        </g>
      </svg>
      {(() => {
        const j = seat('jiddo');
        const [bx, by] = toScreen(cam, j.x + 150 * j.s, j.y - 230 * j.s, 1);
        const [tx, ty] = toScreen(cam, j.x + 40 * j.s, j.y - 90 * j.s, 1);
        return <SpeechBubble x={bx} y={by} text={COPY.enough} tail={[tx, ty]} start={T.enoughShake} exit={T.enoughOut} fontSize={64} rotate={4} seed={47} frame={g} />;
      })()}
      <InkTitle x={LAYOUT.coffeeTitle.x} y={LAYOUT.coffeeTitle.y} text={COPY.coffeeTitle} start={T.titleCoffee} stagger={T.titleStagger} fontSize={LAYOUT.coffeeTitle.size} exit={T.titleCoffeeOut} rotate={-2.5} plate={C.turquoise} frame={g} />
      <SfxWord x={LAYOUT.arrivalSfx.x} y={LAYOUT.arrivalSfx.y} text={COPY.arrivalSfx} size={LAYOUT.arrivalSfx.size} rot={LAYOUT.arrivalSfx.rot} start={T.arrivalDing} exit={T.feast - 8} color={C.turquoise} burst="#F6D98A" frame={g} />
      {/* «…ووصلت القشاطي 🛵» is a screen title in SurpriseGuests.tsx: it rides over the whip into the feast */}
    </AbsoluteFill>
  );
};
