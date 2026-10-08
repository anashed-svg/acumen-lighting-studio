// The HOST — we never see a face, only the POV arm in a striped pyjama sleeve (caught at home in pyjamas when the
// guests ring). Hand poses: 'grab' (a fist round a vertical bar: fridge handle, dallah handle), 'hold' (a phone held
// from below: fingertips round the right edge, the thumb free), plus the free THUMB that presses the order button.
// Also: the dallah (Arabic coffee pot) with a pouring stream, and the phone with its hand-drawn order screen.
// All SVG <g> in parent units.
import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {blobPts, brush, C, catmull, ellipsePts, FamilyPlate2D, INK, Pt, shapeD, smoothD, useBoil} from '../../kit/lib';
import {capsule, shrink, tr, tube} from './draw';

export const PJ = {base: '#F2ECDD', shade: '#D4CBB5', stripe: '#2C6C66', cuff: '#2C6C66'};
const SKIN = C.skin[2];
const SKIN_SHADE = C.skinShade[2];

// ------------------------------------------------------------------------------------------------ sleeve
/** the pyjama sleeve: a tapered tube from `from` (off-frame) to `wrist`, stripes along it, a dark cuff */
export const Sleeve: React.FC<{pts: Pt[]; w0: number; w1: number; seed?: number}> = ({pts, w0, w1, seed = 1}) => {
  const g = useMemo(() => {
    const outline = tube(pts, w0, w1, false, false, 10);
    const line = catmull(pts, false, 10);
    const n = line.length;
    const stripes: string[] = [];
    [-0.36, -0.12, 0.12, 0.36].forEach((o, k) => {
      const s: Pt[] = [];
      for (let i = 0; i < n - 2; i++) {
        const a = line[Math.max(0, i - 1)];
        const b = line[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0];
        let ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const w = w0 + ((w1 - w0) * i) / (n - 1);
        s.push([line[i][0] - ty * w * o, line[i][1] + tx * w * o]);
      }
      stripes.push(brush(s, {w: Math.max(5, w1 * 0.07), dense: true, taper: [0.02, 0.02], tip: 0.9, jitter: 0.08, seed: seed + k}));
    });
    // cuff at the wrist end
    const end = line[n - 1];
    const pre = line[Math.max(0, n - 5)];
    const cuff = tube([pre, end], w1 * 1.06, w1 * 1.04, false, false, 2);
    return {outline: shapeD(outline, 3), lit: shapeD(tr(outline, -6, -6, 1), 3), ink: brush(outline, {w: 7, closed: true, dense: false, start: 0.5, seed: seed + 9}), stripes: stripes.join(''), cuff: shapeD(cuff, 2), cuffInk: brush(cuff, {w: 6, closed: true, dense: false, seed: seed + 11})};
  }, [JSON.stringify(pts), w0, w1, seed]);
  return (
    <g>
      <path d={g.outline} fill={PJ.shade} />
      <path d={g.lit} fill={PJ.base} />
      <path d={g.stripes} fill={PJ.stripe} opacity={0.85} />
      <path d={g.ink} fill={INK} />
      <path d={g.cuff} fill={PJ.cuff} />
      <path d={g.cuffInk} fill={INK} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ hands
/** a fist round a vertical bar (bar along local y), back of the hand to camera; local origin = the grip centre */
export const GripFist: React.FC<{s?: number; squeeze?: number; flip?: boolean}> = ({s = 1, squeeze = 0, flip}) => {
  const g = useMemo(() => {
    const back = blobPts(26, 0, 62, 66, 0.05, 11, 30, 2);
    const fingers = [-40, -14, 12, 38].map((y, i) => blobPts(-36, y, 30, 15, 0.06, 12 + i, 18, 2));
    const thumb = capsule(10, -52, -78, 64, 30, 24);
    return {back, fingers, thumb};
  }, []);
  const sq = 1 - squeeze * 0.06;
  return (
    <g transform={`scale(${s * (flip ? -1 : 1) * sq} ${s})`}>
      <path d={shapeD(g.back)} fill={SKIN_SHADE} />
      <path d={shapeD(shrink(g.back, 0.88, -6, -6))} fill={SKIN} />
      <path d={brush(g.back, {w: 7, closed: true, dense: false, start: 0.1, seed: 13, shadow: 0.6})} fill={INK} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={brush([[20 + i * 16, -28 + i * 3], [28 + i * 16, -16 + i * 3]], {w: 4, taper: [0.3, 0.3], seed: 14 + i})} fill={INK} opacity={0.5} />
      ))}
      {g.fingers.map((fp, i) => (
        <g key={i}>
          <path d={shapeD(fp)} fill={i % 2 ? SKIN_SHADE : SKIN} />
          <path d={brush(fp, {w: 5.5, closed: true, dense: false, start: 0.6, seed: 20 + i})} fill={INK} />
          <path d={shapeD(blobPts(-54, fp[0][1] + 0, 7, 6, 0.1, 30 + i, 10, 2))} fill="#F7DCCB" opacity={0.85} />
        </g>
      ))}
      <path d={shapeD(g.thumb, 4)} fill={SKIN} />
      <path d={brush(g.thumb, {w: 6, closed: true, dense: false, start: 0.3, seed: 25, shadow: 0.5})} fill={INK} />
    </g>
  );
};

/** the host's thumb (pointing along local −y, base at origin), with a nail */
export const Thumb: React.FC<{s?: number; press?: number}> = ({s = 1, press = 0}) => {
  const g = useMemo(() => {
    const body = tube([[0, 0], [2, -70], [6, -150]], 74, 58, false, true, 8);
    const nail = blobPts(7, -146, 18, 22, 0.05, 41, 18, 2);
    return {body, nail};
  }, []);
  return (
    <g transform={`scale(${s} ${s * (1 - press * 0.08)})`}>
      <path d={shapeD(g.body, 4)} fill={SKIN_SHADE} />
      <path d={shapeD(tr(g.body, -6, -4, 0.94, 1), 4)} fill={SKIN} />
      <path d={brush([[-14, -96], [-2, -90], [12, -96]], {w: 4, taper: [0.3, 0.3], seed: 42})} fill={INK} opacity={0.5} />
      <path d={shapeD(g.nail)} fill="#F7DCCB" />
      <path d={brush(g.nail, {w: 3.6, closed: true, dense: false, seed: 43})} fill={INK} opacity={0.7} />
      <path d={brush(g.body, {w: 7, closed: true, dense: false, start: 0.75, seed: 44, shadow: 0.5})} fill={INK} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ dallah
const BRASS = {deep: '#8F5F14', base: '#D6A23F', light: '#F6D98A', engrave: '#7E5212'};
/** the dallah, side view, spout to the LEFT; local origin = the base centre; `tilt` deg (negative pours left) */
export const Dallah: React.FC<{s?: number}> = ({s = 1}) => {
  const b = useBoil({scale: 2.4, offset: 71, freq: 0.025});
  const g = useMemo(() => {
    const body: Pt[] = [
      [0, -250], [40, -246], [46, -214], [38, -186], [58, -150], [76, -96], [86, -40], [80, -6], [0, 0],
      [-80, -6], [-86, -40], [-76, -96], [-58, -150], [-38, -186], [-46, -214], [-40, -246],
    ];
    const lid = [...ellipsePts(0, -250, 40, 12, 18, Math.PI, Math.PI * 2), [36, -262], [20, -292], [0, -300], [-20, -292], [-36, -262]] as Pt[];
    const finial = blobPts(0, -316, 12, 16, 0.05, 72, 14, 2);
    // the crescent beak spout
    const spout: Pt[] = [[-60, -140], [-96, -170], [-136, -226], [-174, -262], [-196, -270], [-186, -252], [-150, -210], [-112, -150], [-80, -104]];
    // the handle (right): a loop
    const handle: Pt[] = [[52, -200], [104, -196], [120, -150], [102, -70], [78, -50], [92, -78], [102, -140], [92, -176], [52, -180]];
    return {
      body: shapeD(body, 6),
      bodyLit: shapeD(shrink(body, 0.86, -12, -6), 6),
      bodyInk: brush(body, {w: 7, closed: true, dense: false, start: 0.5, seed: 73, shadow: 0.6}),
      band1: brush([[-72, -110], [0, -100], [72, -110]], {w: 7, taper: [0.05, 0.05], tip: 0.8, seed: 74}),
      band2: brush([[-84, -34], [0, -24], [84, -34]], {w: 7, taper: [0.05, 0.05], tip: 0.8, seed: 75}),
      engr: [-40, -20, 0, 20, 40].map((x) => brush([[x, -92], [x + 4, -46]], {w: 3.4, taper: [0.3, 0.3], seed: 76 + x})).join(''),
      lid: shapeD(lid, 5),
      lidInk: brush(lid, {w: 6, closed: true, dense: false, seed: 81}),
      finial: shapeD(finial),
      finialInk: brush(finial, {w: 5, closed: true, dense: false, seed: 82}),
      spout: shapeD(spout, 6),
      spoutInk: brush(spout, {w: 6, closed: true, dense: false, start: 0.2, seed: 83}),
      handle: shapeD(handle, 6),
      handleInk: brush(handle, {w: 6, closed: true, dense: false, seed: 84}),
      gloss: brush([[-56, -150], [-66, -96], [-62, -40]], {w: 12, taper: [0.3, 0.5], seed: 85}),
      gloss2: brush([[-22, -230], [-24, -200]], {w: 6, taper: [0.3, 0.5], seed: 86}),
    };
  }, []);
  return (
    <g transform={`scale(${s})`}>
      <defs>{b.def}</defs>
      <g filter={b.url}>
        <path d={g.handle} fill={BRASS.deep} />
        <path d={g.handleInk} fill={INK} />
        <path d={g.spout} fill={BRASS.base} />
        <path d={brush([[-80, -128], [-120, -184], [-170, -250]], {w: 6, taper: [0.2, 0.5], seed: 87})} fill={BRASS.light} />
        <path d={g.spoutInk} fill={INK} />
        <path d={g.body} fill={BRASS.deep} />
        <path d={g.bodyLit} fill={BRASS.base} />
        <path d={g.engr} fill={BRASS.engrave} opacity={0.8} />
        <path d={g.band1} fill={BRASS.engrave} />
        <path d={g.band2} fill={BRASS.engrave} />
        <path d={g.gloss} fill={BRASS.light} />
        <path d={g.gloss2} fill={C.white} opacity={0.9} />
        <path d={g.bodyInk} fill={INK} />
        <path d={g.lid} fill={BRASS.base} />
        <path d={g.lidInk} fill={INK} />
        <path d={g.finial} fill={BRASS.light} />
        <path d={g.finialInk} fill={INK} />
      </g>
    </g>
  );
};
/** local spout tip of the dallah (art units, before scale/tilt) */
export const DALLAH_SPOUT: Pt = [-192, -266];
export const DALLAH_HANDLE: Pt = [110, -130];

/** a pouring stream of gahwa from a to b (parent units), wobbling on twos; t 0..1 how much has fallen */
export const Pour: React.FC<{a: Pt; b: Pt; t: number; w?: number}> = ({a, b, t, w = 12}) => {
  const f = useCurrentFrame();
  if (t <= 0) return null;
  const k = Math.floor(f / 2);
  const mid: Pt = [a[0] + (b[0] - a[0]) * 0.35 - 20, a[1] + (b[1] - a[1]) * 0.45];
  const end: Pt = [a[0] + (b[0] - a[0]) * Math.min(1, t), a[1] + (b[1] - a[1]) * Math.min(1, t)];
  const pts: Pt[] = t >= 1 ? [a, mid, [b[0] + Math.sin(k) * 2, b[1]]] : [a, [(a[0] + end[0]) / 2 - 10, (a[1] + end[1]) / 2], end];
  return (
    <g>
      <path d={brush(pts, {w, taper: [0.05, 0.35], tip: 0.5, jitter: 0.25, jitterLen: 30, seed: 90 + (k % 3)})} fill="#B07A2E" />
      <path d={brush(pts.map(([x, y]) => [x - w * 0.18, y] as Pt), {w: w * 0.3, taper: [0.1, 0.5], tip: 0.2, seed: 91 + (k % 3)})} fill="#E8C98A" />
      {t >= 1 ? <path d={shapeD(ellipsePts(b[0], b[1] + 4, w * 1.4, w * 0.5, 14))} fill="#E8C98A" opacity={0.8} /> : null}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ phone
/** a hand-drawn phone (no real OS / app UI): body + a drawn order screen; local origin = phone centre */
export const Phone: React.FC<{w: number; h: number; title: string; button: string; press?: number; burst?: number; titleFont?: string; buttonFont?: string}> = ({
  w,
  h,
  title,
  button,
  press = 0,
  burst = 0,
}) => {
  const b = useBoil({scale: 2.6, offset: 93, freq: 0.022});
  const f = useCurrentFrame();
  const body = useMemo(() => {
    const r = 64;
    const pts: Pt[] = [];
    const corners: Pt[] = [[w / 2 - r, -h / 2 + r], [w / 2 - r, h / 2 - r], [-w / 2 + r, h / 2 - r], [-w / 2 + r, -h / 2 + r]];
    corners.forEach(([cx, cy], i) => {
      for (let k = 0; k <= 6; k++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 2 + (k / 6) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    });
    const scr = pts.map(([x, y]) => [x * ((w - 40) / w), y * ((h - 44) / h)] as Pt);
    return {pts, scr, d: smoothD(pts, true), sd: smoothD(scr, true), ink: brush(pts, {w: 8, closed: true, dense: true, start: 0.6, seed: 94, shadow: 0.6}), scrInk: brush(scr, {w: 4, closed: true, dense: true, seed: 95})};
  }, [w, h]);
  const btnY = h * 0.28;
  const btnW = w * 0.62;
  const btnH = 128;
  const sq = press > 0 ? 1 - press * 0.12 : 1;
  return (
    <g>
      <defs>
        {b.def}
        <clipPath id="phoneScr">
          <path d={body.sd} />
        </clipPath>
      </defs>
      <path d={body.d} fill={INK} opacity={0.3} transform="translate(14 18)" />
      <g filter={b.url}>
        <path d={body.d} fill="#1E3B39" />
        <path d={body.sd} fill={C.cream} />
      </g>
      {/* the drawn screen: a turquoise "photo" panel with the sharing plate, the title, the big button */}
      <g clipPath="url(#phoneScr)">
        <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.5} fill={C.turquoise} />
        <path d={brush([[-w / 2, -h / 2 + h * 0.5], [w / 2, -h / 2 + h * 0.5 + 6]], {w: 5, taper: [0.02, 0.02], tip: 0.9, seed: 96})} fill={INK} />
      </g>
      <g filter={b.url}>
        <path d={body.scrInk} fill={INK} />
        <path d={body.ink} fill={INK} />
        {/* notch-less camera dot + speaker slit (generic) */}
        <circle cx={0} cy={-h / 2 + 22} r={6} fill="#0B1F1E" />
        <path d={brush([[-w * 0.36, -h / 2 + h * 0.08], [-w * 0.42, h * 0.1]], {w: 10, taper: [0.3, 0.5], seed: 97})} fill={C.white} opacity={0.35} />
      </g>
      <text
        x={0}
        y={h * 0.08 - 6}
        textAnchor="middle"
        direction="rtl"
        style={{fontFamily: "'Baloo Bhaijaan 2', 'Noto Color Emoji', sans-serif", fontWeight: 800, fontSize: 58}}
        fill={INK}
      >
        {title.split('\n').map((l, i) => (
          <tspan key={i} x={0} dy={i ? 66 : 0}>
            {l}
          </tspan>
        ))}
      </text>
      <g transform={`translate(0 ${btnY}) scale(${1 + press * 0.04} ${sq})`}>
        <rect x={-btnW / 2 + 6} y={-btnH / 2 + 10} width={btnW} height={btnH} rx={btnH / 2} fill={INK} opacity={press > 0 ? 0 : 1} />
        <rect x={-btnW / 2 + (press > 0 ? 6 : 0)} y={-btnH / 2 + (press > 0 ? 10 : 0)} width={btnW} height={btnH} rx={btnH / 2} fill={C.turquoise} stroke={INK} strokeWidth={7} />
        <text x={0} y={22} textAnchor="middle" direction="rtl" style={{fontFamily: "'Lalezar', sans-serif", fontWeight: 400, fontSize: 78}} fill={INK}>
          {button}
        </text>
      </g>
      {burst > 0
        ? Array.from({length: 10}).map((_, i) => {
            const a = (i / 10) * Math.PI * 2 + 0.2;
            const r0 = 110 + burst * 60;
            const r1 = r0 + 40 + 30 * (1 - burst);
            return (
              <path
                key={i}
                d={brush([[Math.cos(a) * r0, btnY + Math.sin(a) * r0 * 0.6], [Math.cos(a) * r1, btnY + Math.sin(a) * r1 * 0.6]], {w: 10, taper: [0.2, 0.6], seed: 98 + i})}
                fill={i % 2 ? C.strawberry : INK}
                opacity={1 - burst * 0.6}
              />
            );
          })
        : null}
      {f < 0 ? null : null}
    </g>
  );
};

/** the plate "photo" on the phone screen (HTML, kit FamilyPlate2D) — place it in the same layer as the phone */
export const PhonePlate: React.FC<{x: number; y: number; scale: number}> = ({x, y, scale}) => <FamilyPlate2D x={x} y={y} scale={scale} shadow={false} />;
