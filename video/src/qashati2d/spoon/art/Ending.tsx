// The ending's props, all drawn on twos like the rest of the spot:
//   <QashtaDollop/> — the LAST bit of qashta: a glossy soft-peaked dollop seen from above (cel-shaded lobes, a curl to a
//                     leaning peak, halftone on the shadow side, a cool turquoise bounce, broken white speculars)
//   <LastDrop/>     — that dollop alone on the empty plate: a wet film under it, a contact shadow, a glint, jelly
//                     wobbles; after the snatch only its wet ghost stays (world layer)
//   <Spotlight/>    — a theatre spotlight in halftone ink: the room goes dark around the drop (screen layer)
//   <MoralNote/>    — a torn cream note slapped onto the table, taped with turquoise washi tape (screen layer); the
//                     moral is pressed onto it by the kit's InkTitle
import React, {useId, useMemo} from 'react';
import {HoneyLayers, honeyPaths} from '../../kit/art/Honey';
import {blobPts, brush, C, Crumbs, ellipsePts, Glint, Halftone, INK, Pt, rng, scatterCrumbs, shapeD, smoothD, stackOutline, useBoil} from '../../kit/lib';

// ------------------------------------------------------------------------------------------------ the dollop
const dollopCache = new Map<number, ReturnType<typeof buildDollop>>();
const buildDollop = (r: number) => {
  const body = blobPts(0, 0, r, r * 0.9, 0.1, 901, 36, 3, 0.3);
  const mid = blobPts(-r * 0.14, -r * 0.16, r * 0.62, r * 0.56, 0.1, 902, 30, 3, 0.8);
  const peak = blobPts(-r * 0.3, -r * 0.34, r * 0.3, r * 0.26, 0.12, 903, 22, 2, 0.2);
  const stack = stackOutline([body, mid, peak], [-r * 0.05, -r * 0.05], 2);
  const lit = (pts: Pt[], k: number) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return smoothD(pts.map(([x, y]) => [cx + (x - cx) * k - r * 0.05, cy + (y - cy) * k - r * 0.06] as Pt), true);
  };
  // the curl: a soft spiral groove from the rim up to the peak (the spoon-dragged swirl of a dollop)
  const curl: Pt[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = 0.2 + t * Math.PI * 1.9;
    const rr = r * (0.8 - 0.5 * t);
    curl.push([Math.cos(a) * rr - r * 0.22 * t, Math.sin(a) * rr * 0.92 - r * 0.26 * t]);
  }
  const rim = stack.silhouette.filter(([x, y]) => x * 0.6 + y * 0.8 > r * 0.5);
  rim.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  // REVIEW FIX (it read as a boiled egg at phone size): the last bit is a DESSERT — a thread of honey falls from the
  // peak, follows the curl down the lit side, pools in the valley and slides off the shadow rim in a fat bead;
  // pistachio crumbs on top. Honey + green on cream = Levantine qashta at a glance, even at 360 px.
  const honey = honeyPaths(
    [
      [-r * 0.5, -r * 0.24],
      [-r * 0.2, -r * 0.1],
      [r * 0.06, -r * 0.24],
      [r * 0.32, -r * 0.02],
      [r * 0.58, r * 0.3],
      [r * 0.9, r * 0.56],
    ],
    {hw: Math.max(4, r * 0.11), minK: 0.6, maxK: 1.4, wave: r * 0.8, seed: 931, pools: [{s: r * 0.62, r: r * 0.06}], end: 'bead', bead: r * 0.17, taperIn: r * 0.2},
  );
  const crumbs = scatterCrumbs(9, 937, [-r, -r, 2 * r, 2 * r], (x, y) => x * x + y * y < (r * 0.7) ** 2 && !(x > -r * 0.1 && y > -r * 0.05 && y < r * 0.4), Math.max(5, r * 0.1), Math.max(8, r * 0.19));
  return {
    honey,
    crumbs,
    sil: smoothD(stack.silhouette, true),
    silPts: stack.silhouette,
    body: smoothD(body, true),
    mid: smoothD(mid, true),
    peak: smoothD(peak, true),
    bodyLit: lit(body, 0.86),
    midLit: lit(mid, 0.82),
    peakLit: lit(peak, 0.78),
    ink: brush(stack.silhouette, {w: Math.max(4, r * 0.085), closed: true, dense: true, start: 0.15, seed: 904, shadow: 0.75}),
    creases: stack.creases.map((run, i) => brush(run, {w: Math.max(2.4, r * 0.04), taper: [0.3, 0.45], tip: 0.1, dense: true, seed: 905 + i})).join(''),
    curl: brush(curl, {w: r * 0.07, taper: [0.25, 0.6], tip: 0.05, dense: true, seed: 908}),
    bounce: rim.length > 4 ? brush(rim.map(([x, y]) => [x * 0.92, y * 0.92] as Pt), {w: r * 0.1, taper: [0.35, 0.35], tip: 0.05, dense: true, seed: 909}) : '',
    spec:
      brush(ellipsePts(-r * 0.1, -r * 0.08, r * 0.62, r * 0.54, 12, Math.PI * 1.02, Math.PI * 1.36), {w: r * 0.16, taper: [0.35, 0.45], tip: 0.05, dense: true, seed: 910}) +
      brush(ellipsePts(-r * 0.1, -r * 0.08, r * 0.62, r * 0.54, 6, Math.PI * 1.44, Math.PI * 1.56), {w: r * 0.11, taper: [0.4, 0.4], tip: 0.1, dense: true, seed: 911}) +
      brush(ellipsePts(-r * 0.3, -r * 0.34, r * 0.2, r * 0.16, 8, Math.PI * 1.05, Math.PI * 1.5), {w: r * 0.09, taper: [0.4, 0.4], tip: 0.1, dense: true, seed: 912}),
  };
};
const dollopGeo = (r: number) => {
  const k = Math.round(r);
  let g = dollopCache.get(k);
  if (!g) {
    g = buildDollop(k);
    dollopCache.set(k, g);
  }
  return g;
};

/** a glossy qashta dollop from above, centred on (0,0), radius r; `wobble` −1..1 jelly squash; `shadow` = contact shadow */
export const QashtaDollop: React.FC<{r: number; wobble?: number; shadow?: boolean; toppings?: boolean}> = ({r, wobble = 0, shadow = true, toppings = true}) => {
  const g = dollopGeo(r);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const w = wobble;
  return (
    <g transform={`rotate(${4 * w}) scale(${1 + 0.07 * w} ${1 - 0.06 * w})`}>
      <defs>
        <clipPath id={`qd${uid}`}>
          <path d={g.sil} />
        </clipPath>
      </defs>
      {shadow ? <path d={g.sil} fill={INK} opacity={0.3} transform={`translate(${r * 0.16} ${r * 0.2})`} /> : null}
      <path d={g.sil} fill={C.creamDeep} />
      <path d={g.body} fill={C.creamShade} />
      <path d={g.bodyLit} fill={C.cream} />
      <path d={g.mid} fill={C.creamShade} />
      <path d={g.midLit} fill={C.cream} />
      <path d={g.peak} fill={C.creamShade} />
      <path d={g.peakLit} fill={C.cream} />
      <Halftone
        box={[-r * 1.1, -r * 1.1, r * 2.2, r * 2.2]}
        cell={Math.max(5, r * 0.09)}
        angle={30}
        fill={C.creamDeep}
        tone={[{t: 'lin', x0: -r * 0.2, y0: -r * 0.2, x1: r * 0.9, y1: r * 0.9, a: 0, b: 1, pow: 1.5}]}
        clipPath={`url(#qd${uid})`}
      />
      <path d={g.curl} fill={C.creamDeep} opacity={0.95} />
      <path d={g.bounce} fill={C.turquoiseLight} opacity={0.75} />
      <path d={g.creases} fill={INK} opacity={0.7} />
      <path d={g.spec} fill={C.white} />
      <circle cx={r * 0.28} cy={-r * 0.3} r={r * 0.07} fill={C.white} />
      <path d={g.ink} fill={INK} />
      {toppings && g.honey ? <HoneyLayers p={g.honey} shadowOffset={[r * 0.05, r * 0.08]} /> : null}
      {toppings ? <Crumbs crumbs={g.crumbs} /> : null}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------ the last drop
export const LastDrop: React.FC<{x: number; y: number; r: number; frame: number; wobble: number; gone: boolean; glint: number; show: number}> = ({x, y, r, frame, wobble, gone, glint, show}) => {
  const g = useMemo(() => {
    // a dragged smear, not a round puddle (a round film + a round dollop read as a fried egg)
    const film = blobPts(r * 0.34, r * 0.3, r * 1.25, r * 0.62, 0.22, 812, 30, 4, 0.62);
    const ghost = blobPts(0, 0, r * 0.62, r * 0.48, 0.2, 813, 24, 3, -0.3);
    return {
      film: shapeD(film, 4),
      ghost: shapeD(ghost, 4),
      ghostInk: brush(ghost.slice(4, 18), {w: 2.6, taper: [0.3, 0.4], seed: 815}),
    };
  }, [r]);
  const b = useBoil({scale: 2.4, offset: 88, frame, freq: 0.03});
  if (show <= 0) return null;
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      <defs>{b.def}</defs>
      <g filter={b.url}>
        {/* the thin wet film of cream it sits in (it was dragged here by seven spoons) */}
        <path d={g.film} fill={C.cream} opacity={0.55} />
        {gone ? (
          <>
            <path d={g.ghost} fill={C.creamShade} opacity={0.8} />
            <path d={g.ghostInk} fill={INK} opacity={0.55} />
          </>
        ) : (
          <g transform={`scale(${show})`}>
            <QashtaDollop r={r} wobble={wobble} />
            {glint > 0 ? <Glint x={-r * 0.36} y={-r * 0.42} s={glint * 1.3} /> : null}
          </g>
        )}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ spotlight
/** screen-space halftone darkness outside a circle (cx, cy, r): `amount` 0..1 fades the whole thing */
export const Spotlight: React.FC<{cx: number; cy: number; r: number; amount: number}> = ({cx, cy, r, amount}) => {
  if (amount <= 0.01) return null;
  // quantise so the dot screen is rebuilt only when it really moves (it changes on twos anyway)
  const q = (v: number) => Math.round(v / 4) * 4;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      <Halftone
        box={[-20, -20, 1120, 1960]}
        cell={13}
        angle={22}
        fill={C.tealDark}
        opacity={0.62 * amount}
        maxR={0.7}
        tone={[{t: 'rad', cx: q(cx), cy: q(cy), r0: q(r), r1: q(r + 260), a: 0, b: 1, pow: 0.8}, {t: 'noise', amp: 0.12, freq: 0.01, seed: 31}]}
      />
    </svg>
  );
};

// ------------------------------------------------------------------------------------------------ the moral note
const tornRect = (w: number, h: number, seed: number): Pt[] => {
  const r = rng(seed);
  const pts: Pt[] = [];
  const side = (x0: number, y0: number, x1: number, y1: number, n: number, amp: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const L = Math.hypot(nx, ny) || 1;
      const j = (r() - 0.5) * amp + (i % 2 ? amp * 0.35 : -amp * 0.2);
      pts.push([x0 + (x1 - x0) * t + (nx / L) * j, y0 + (y1 - y0) * t + (ny / L) * j]);
    }
  };
  // the top edge was torn off a pad (ragged), the others are cut (straight-ish)
  side(-w / 2, -h / 2, w / 2, -h / 2, 44, 9);
  side(w / 2, -h / 2, w / 2, h / 2, 10, 2.5);
  side(w / 2, h / 2, -w / 2, h / 2, 16, 2.5);
  side(-w / 2, h / 2, -w / 2, -h / 2, 10, 2.5);
  return pts;
};
const tape = (w: number, h: number, seed: number): Pt[] => {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i <= 6; i++) pts.push([-w / 2 + (i / 6) * w, -h / 2 + (r() - 0.5) * 2]);
  for (let i = 0; i <= 5; i++) pts.push([w / 2 + (i % 2 ? 5 : -2), -h / 2 + (i / 5) * h]);
  for (let i = 6; i >= 0; i--) pts.push([-w / 2 + (i / 6) * w, h / 2 + (r() - 0.5) * 2]);
  for (let i = 5; i >= 0; i--) pts.push([-w / 2 + (i % 2 ? -5 : 2), -h / 2 + (i / 5) * h]);
  return pts;
};

/** the note lands ON TWOS: falls in big & tilted (k −2) → slaps flat, squashed (k 0) → rebounds → settles */
const NOTE_KEYS = [
  {s: 1.22, r: 5, o: 1, dy: -60}, // (opaque: a falling paper never shows the plate through it)
  {s: 0.965, r: -0.8, o: 1, dy: 4},
  {s: 1.012, r: 0.5, o: 1, dy: -2},
  {s: 1, r: 0, o: 1, dy: 0},
];

export const MoralNote: React.FC<{x: number; y: number; w: number; h: number; rot: number; at: number; frame: number}> = ({x, y, w, h, rot, at, frame}) => {
  const g = useMemo(() => {
    const pts = tornRect(w, h, 2024);
    return {
      paper: smoothD(pts, true),
      ink: brush(pts, {w: 5.5, closed: true, dense: true, start: 0.12, seed: 2025, shadow: 0.6, step: 4}),
      tapeA: smoothD(tape(170, 46, 7), true),
      tapeB: smoothD(tape(150, 44, 8), true),
      lines: [0, 1, 2, 3].map((i) => brush([[-w / 2 + 40, -h / 2 + 118 + i * 98], [w / 2 - 40, -h / 2 + 116 + i * 98]], {w: 2, taper: [0.02, 0.02], tip: 0.8, jitter: 0.4, seed: 2030 + i})).join(''),
      margin: brush([[w / 2 - 92, -h / 2 + 30], [w / 2 - 94, h / 2 - 16]], {w: 2.2, taper: [0.02, 0.02], tip: 0.8, seed: 2036}),
    };
  }, [w, h]);
  const b = useBoil({scale: 2.6, offset: 77, frame, freq: 0.025});
  const k = frame - (at - 2);
  if (k < 0) return null;
  const key = NOTE_KEYS[Math.min(NOTE_KEYS.length - 1, Math.floor(k / 2))];
  const pad = 80;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + key.dy,
        width: 0,
        height: 0,
        transform: `rotate(${rot + key.r}deg) scale(${key.s})`,
        opacity: key.o,
      }}
    >
      <svg width={w + 2 * pad} height={h + 2 * pad} viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}`} style={{position: 'absolute', left: -w / 2 - pad, top: -h / 2 - pad, overflow: 'visible'}}>
        <defs>{b.def}</defs>
        {/* cast shadow on the table (bigger while it's still falling) */}
        <path d={g.paper} fill={INK} opacity={k < 2 ? 0.14 : 0.24} transform={k < 2 ? 'translate(26 40) scale(0.96)' : 'translate(9 13)'} />
        <g filter={b.url}>
          <path d={g.paper} fill={C.cream} />
          {/* a printed pad: faint rules + a red margin line (a kitchen notepad) */}
          <path d={g.lines} fill="#9FCFC8" opacity={0.55} />
          <path d={g.margin} fill={C.strawberry} opacity={0.45} />
          {/* the paper curls up a little at the lower-left corner: halftone shade */}
          <Halftone
            box={[-w / 2, -h / 2, w, h]}
            cell={8}
            angle={30}
            fill={C.creamDeep}
            opacity={0.7}
            tone={[{t: 'rad', cx: -w / 2, cy: h / 2, r0: 40, r1: 260, a: 1, b: 0}]}
          />
          <path d={g.ink} fill={INK} />
        </g>
        {/* washi tape, two corners */}
        <g transform={`translate(${w / 2 - 70} ${-h / 2 + 6}) rotate(24)`}>
          <path d={g.tapeA} fill={C.turquoise} opacity={0.68} />
          <path d={g.tapeA} fill={C.white} opacity={0.2} transform="translate(-2 -4) scale(0.9 0.45)" />
        </g>
        <g transform={`translate(${-w / 2 + 60} ${-h / 2 + 2}) rotate(-20)`}>
          <path d={g.tapeB} fill={C.turquoise} opacity={0.68} />
          <path d={g.tapeB} fill={C.white} opacity={0.2} transform="translate(-2 -4) scale(0.9 0.45)" />
        </g>
      </svg>
    </div>
  );
};
