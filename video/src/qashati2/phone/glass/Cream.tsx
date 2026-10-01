// Qashta on the glass: the two logo dots leap out of the app icon and splat onto the hook stamp, merge
// into one big glossy bead that slides down through «مش» (the hero shot), runs on through stamp 1 and
// hangs; cream splats wash the rest one by one; then the cream floods the screen. Plus CreamReveal, the
// sheet that slides off the glass to uncover the cup shot.
//
// All liquid is drawn as plain shapes inside one group and turned into glossy cream by an SVG
// "goo + lighting" filter: blur → alpha threshold (merges shapes into organic liquid) → height map →
// diffuse (cream, calibrated so flat areas are exactly COLORS.cream) + specular glints + soft shadow.
import {noise2D} from '@remotion/noise';
import React from 'react';
import {interpolate, random} from 'remotion';
import {COLORS, T} from '../../spec';
import {beadAt, BEAD_FROM, BEAD_IDX, carrierAt, DOT_LAND, DOT_R, mishPoint, SPLAT_IDX, splatAt, splatImpact, splatR, STAMPS} from '../layout';
import {clamp, P} from '../timeline';
import {bannerOffset, iconDot} from '../ui/OrderBanner';

const CREAM = COLORS.cream;
const EL = 38; // light elevation (deg); flat surfaces get N·L = sin(EL)
const KD = 1 / Math.sin((EL * Math.PI) / 180);

export const CreamFilter: React.FC<{id: string; blur?: number; soften?: number; relief?: number; shadow?: number; ambient?: number}> = ({
  id,
  blur = 8,
  soften = 5,
  relief = 11,
  shadow = 0.5,
  ambient = 0.3,
}) => (
  <filter id={id} x={-100} y={-300} width={1280} height={2520} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="b" />
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 26 -12" result="goo" />
    <feGaussianBlur in="goo" stdDeviation={soften} result="h" />
    <feDiffuseLighting in="h" surfaceScale={relief} diffuseConstant={KD} lightingColor={CREAM} result="diff">
      <feDistantLight azimuth={225} elevation={EL} />
    </feDiffuseLighting>
    <feSpecularLighting in="h" surfaceScale={relief} specularConstant={1.7} specularExponent={64} lightingColor="#FFFFFF" result="spec">
      <feDistantLight azimuth={225} elevation={EL} />
    </feSpecularLighting>
    {/* meniscus: a thin warm rim where the cream meets the glass */}
    <feMorphology in="goo" operator="erode" radius={2.5} result="inner" />
    <feComposite in="goo" in2="inner" operator="out" result="rim" />
    <feFlood floodColor="#B99C70" floodOpacity={0.3} result="rimC" />
    <feComposite in="rimC" in2="rim" operator="in" result="rimPaint" />
    {/* ambient fill: flat areas stay exactly cream, the shaded side no longer goes cartoon-dark */}
    <feFlood floodColor={CREAM} result="flat" />
    <feComposite in="diff" in2="flat" operator="arithmetic" k1={0} k2={1 - ambient} k3={ambient} k4={0} result="diffA" />
    <feComposite in="diffA" in2="goo" operator="in" result="body" />
    <feComposite in="spec" in2="goo" operator="in" result="glint" />
    <feComposite in="body" in2="glint" operator="arithmetic" k1={0} k2={1} k3={1} k4={0} result="lit" />
    <feGaussianBlur in="goo" stdDeviation={10} result="sb" />
    <feOffset in="sb" dx={8} dy={14} result="so" />
    <feColorMatrix in="so" type="matrix" values={`0 0 0 0 0  0 0 0 0 0.02  0 0 0 0 0.04  0 0 0 ${shadow} 0`} result="shadow" />
    <feMerge>
      <feMergeNode in="shadow" />
      <feMergeNode in="lit" />
      <feMergeNode in="rimPaint" />
    </feMerge>
  </filter>
);

// ---------------------------------------------------------------- the two dots and the hero bead
const E0 = T.erase[0];

// where each landed dot sits: on its landing spot, then pulled into the bead as they merge
const dotCentre = (d: 0 | 1, f: number) => {
  const L = DOT_LAND[d];
  const b = beadAt(BEAD_FROM);
  const m = interpolate(f, [T.dropLand[1], BEAD_FROM], [0, 1], {...clamp, easing: (t) => t * t * (3 - 2 * t)});
  return {x: L.x + (b.x - L.x) * m, y: L.y + (b.y - L.y) * m};
};

const Splash: React.FC<{x: number; y: number; k: number; R: number; seed: string; n?: number}> = ({x, y, k, R, seed, n = 10}) => {
  if (k < 0) return null;
  const out: React.ReactNode[] = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + random(`sa${seed}${j}`) * 0.5;
    const dist = R * (1.05 + random(`sd${seed}${j}`) * 1.4);
    const t = Math.min(1, (k + 0.6) / 3.5);
    const e = 1 - Math.pow(1 - t, 3);
    const r = (R / 64) * (5 + random(`sr${seed}${j}`) * 11);
    out.push(<circle key={j} cx={x + Math.cos(a) * dist * e} cy={y + Math.sin(a) * dist * e * 0.85} r={r * (0.6 + 0.4 * e)} />);
  }
  return <>{out}</>;
};

const HeroCream: React.FC<{frame: number}> = ({frame}) => {
  const shapes: React.ReactNode[] = [];
  // the landed dots (before the bead exists)
  ([0, 1] as const).forEach((d) => {
    const land = T.dropLand[d];
    if (frame < land) return;
    const k = frame - land;
    const L = DOT_LAND[d];
    shapes.push(<Splash key={`sp${d}`} x={L.x} y={L.y} k={k} R={DOT_R} seed={`h${d}`} />);
    if (frame >= BEAD_FROM) return;
    const c = dotCentre(d, frame);
    const wob = Math.exp(-k * 0.55) * Math.cos(k * 1.4);
    shapes.push(<ellipse key={`dot${d}`} cx={c.x} cy={c.y} rx={DOT_R * (1 + 0.42 * wob)} ry={DOT_R * (1 - 0.3 * wob)} />);
  });
  if (frame >= BEAD_FROM) {
    // trail: a thick film along the path with beads left behind; thicker where the bead was slow
    const step = 0.25;
    for (let t = E0 + 1; t <= frame; t += step) {
      const p = beadAt(t);
      const q = beadAt(t - step);
      const speed = Math.hypot(p.x - q.x, p.y - q.y) / step;
      const r = p.r * (0.3 + 0.06 * noise2D('tw', t * 0.3, 1)) + 16 * Math.max(0, 1 - speed / 14);
      shapes.push(<circle key={`t${t}`} cx={p.x + 6 * noise2D('tx', t * 0.2, 0)} cy={p.y - p.r * 0.2} r={r} />);
    }
    for (let b = 0; b < 12; b++) {
      const tb = E0 + 5 + b * 3.4 + random(`bead${b}`) * 2;
      if (tb > frame - 3) break;
      const p = beadAt(tb);
      shapes.push(<circle key={`bd${b}`} cx={p.x + (random(`bx${b}`) - 0.5) * 30} cy={p.y - p.r * 0.1} r={p.r * (0.3 + random(`br${b}`) * 0.12)} />);
    }
    // head: a bulbous running bead with a neck; it wobbles as it gathers before breaking free
    const p = beadAt(frame);
    const prev = beadAt(frame - 1);
    const v = Math.min(1, Math.hypot(p.x - prev.x, p.y - prev.y) / 25);
    const gather = frame < E0 ? Math.sin((frame - BEAD_FROM) * 1.6) * 0.05 : 0;
    shapes.push(<ellipse key="head" cx={p.x} cy={p.y} rx={p.r * (1 - 0.06 * v + gather)} ry={p.r * (1 + 0.05 * v - gather)} />);
    shapes.push(<circle key="neck" cx={p.x - (p.x - prev.x) * 0.3} cy={p.y - p.r * (0.55 + 0.4 * v)} r={p.r * 0.7} />);
  }
  return <>{shapes}</>;
};

// ---------------------------------------------------------------- the domino splats
const splatTrail = (i: number, f: number) => {
  const imp = splatImpact(i);
  const out: {x: number; y: number; r: number}[] = [];
  for (let t = imp; t <= f; t += 0.5) out.push(splatAt(i, t));
  return out;
};

const SplatCream: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const imp = splatImpact(i);
  const k = frame - imp;
  if (k < 0) return null;
  const s = splatAt(i, frame);
  const R = splatR(i);
  const wob = Math.exp(-k * 0.6) * Math.cos(k * 1.5);
  const land = splatAt(i, imp);
  return (
    <>
      <Splash x={land.x} y={land.y} k={k} R={R} seed={`s${i}`} n={8} />
      {splatTrail(i, frame).map((p, j) => (
        <circle key={j} cx={p.x} cy={p.y - p.r * 0.2} r={p.r * 0.3} />
      ))}
      <ellipse cx={s.x} cy={s.y} rx={s.r * (1 + 0.38 * wob)} ry={s.r * (1 - 0.28 * wob)} />
      <circle cx={s.x} cy={s.y - s.r * 0.6} r={s.r * 0.66} />
    </>
  );
};

// The splat flying in (outside the goo): a glossy cream ball coming down onto the glass, like the stamps.
const SplatIncoming: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const k = frame - splatImpact(i);
  if (k >= 0 || k < -3) return null;
  const L = splatAt(i, splatImpact(i));
  const R = splatR(i);
  const t = (k + 3) / 3; // 0..1 → impact
  const size = R * (1.6 - 0.55 * t);
  const off = (1 - t) * 70;
  return (
    <g>
      <ellipse cx={L.x + off * 0.6 + 14} cy={L.y + off + 22} rx={size * 0.75} ry={size * 0.65} fill="rgba(0,0,0,0.22)" filter="url(#q2-soft)" />
      <circle cx={L.x - off * 0.2} cy={L.y - off * 0.9} r={size} fill="url(#q2-drop-grad)" />
      <circle cx={L.x - off * 0.2} cy={L.y - off * 0.9} r={size - 1.5} fill="none" stroke="#CDB58C" strokeWidth={3} opacity={0.6} />
      <ellipse cx={L.x - off * 0.2 - size * 0.3} cy={L.y - off * 0.9 - size * 0.34} rx={size * 0.22} ry={size * 0.13} fill="#fff" opacity={0.9} />
    </g>
  );
};

// ---------------------------------------------------------------- wet gloss + dissolved ink on top
const Gloss: React.FC<{x: number; y: number; r: number}> = ({x, y, r}) => {
  const hx = x - r * 0.34;
  const hy = y - r * 0.3;
  return (
    <g>
      <ellipse cx={x - r * 0.18} cy={y - r * 0.16} rx={r * 0.5} ry={r * 0.36} fill="#FFFFFF" opacity={0.3} filter="url(#q2-soft)" />
      <ellipse cx={hx} cy={hy} rx={r * 0.24} ry={r * 0.13} fill="#FFFFFF" opacity={0.95} transform={`rotate(-38 ${hx} ${hy})`} filter="url(#q2-hl-blur)" />
      <circle cx={x + r * 0.38} cy={y + r * 0.36} r={r * 0.06} fill="#FFFFFF" opacity={0.8} />
    </g>
  );
};

// The red ink the cream picked up: streaks in the trail below each washed «مش», dissolving into the cream.
const InkStreaks: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const c = carrierAt(i, frame);
  if (!c) return null;
  const m = mishPoint(i);
  const s = STAMPS[i].s;
  const e = frame - T.erase[i];
  const top = m.y - 20 * s;
  const bottom = Math.min(c.y - c.r * 0.35, m.y + 260 * s);
  if (bottom < top + 10) return null;
  const fade = interpolate(e, i === 0 ? [4, 12, 44] : [0, 4, 28], [0, 1, 0], clamp);
  if (fade <= 0) return null;
  return (
    <g opacity={fade} style={{mixBlendMode: 'multiply'}}>
      {[-0.55, -0.2, 0.15, 0.5].map((u, j) => {
        const x0 = m.x + u * 70 * s;
        const pts: string[] = [];
        for (let y = top; y <= bottom; y += 8) pts.push(`${(x0 + 5 * s * noise2D(`ik${i}${j}`, y * 0.01, 0)).toFixed(1)},${y.toFixed(1)}`);
        return <polyline key={j} points={pts.join(' ')} fill="none" stroke={COLORS.stampRed} strokeWidth={(3 + 3 * ((j * 7) % 3)) * s} strokeLinecap="round" opacity={0.45} filter="url(#q2-hl-blur)" />;
      })}
    </g>
  );
};

// A pink blush in the carrier while it swallows the ink.
const InkBlush: React.FC<{i: number; frame: number}> = ({i, frame}) => {
  const c = carrierAt(i, frame);
  if (!c) return null;
  const e = frame - T.erase[i];
  const o = interpolate(e, i === 0 ? [-2, 6, 26] : [-1, 2, 12], [0, 0.16, 0], clamp);
  if (o <= 0) return null;
  return <ellipse cx={c.x} cy={c.y - c.r * 0.35} rx={c.r * 0.38} ry={c.r * 0.8} fill={COLORS.stampRed} opacity={o} filter="url(#q2-soft)" style={{mixBlendMode: 'multiply'}} />;
};

// ---------------------------------------------------------------- flying dots (before they land)
const FlyingDot: React.FC<{d: 0 | 1; frame: number}> = ({d, frame}) => {
  const launch = P.dotLaunch[d];
  const land = T.dropLand[d];
  if (frame < launch || frame >= land) return null;
  const src = iconDot(d);
  const sy = src.y + bannerOffset(launch);
  const dst = DOT_LAND[d];
  const ghosts = [1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0];
  const pos = (back: number) => {
    const t = Math.max(0, (frame - back - launch) / (land - launch));
    // it leaps off the icon towards the viewer: grows, hops, and lands on the glass
    const e = t * t * (3 - 2 * t);
    return {
      t,
      x: src.x + (dst.x - src.x) * e,
      y: sy + (dst.y - sy) * e - Math.sin(Math.PI * t) * (d === 0 ? 120 : 90),
      size: src.h * 1.1 + (DOT_R * 2.3 - src.h * 1.1) * Math.pow(t, 0.9),
    };
  };
  const head = pos(0);
  const pop = frame - launch;
  return (
    <g>
      {pop >= 0 && pop < 5 ? (
        <circle cx={src.x} cy={sy + 6} r={14 + pop * 12} fill="none" stroke="#FFFFFF" strokeWidth={6 * (1 - pop / 5)} opacity={0.85 * (1 - pop / 5)} />
      ) : null}
      {/* shadow on the UI grows softer and further as the drop rises off it */}
      <ellipse cx={head.x + 20 + 60 * head.t} cy={head.y + 40 + 80 * head.t} rx={head.size * 0.45} ry={head.size * 0.4} fill="rgba(0,0,0,0.35)" filter="url(#q2-soft)" />
      {ghosts.slice(0, -1).map((back, gi) => {
        const g = pos(back);
        return <circle key={gi} cx={g.x} cy={g.y} r={(g.size / 2) * (0.55 + 0.06 * gi)} fill={CREAM} opacity={0.1 + 0.06 * gi} />;
      })}
      {(() => {
        const {t, x, y, size} = head;
        const round = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
        const logoScale = src.artScale * (size / src.h);
        return (
          <g transform={`translate(${x} ${y}) rotate(${(1 - round) * (d ? 16 : -22) * Math.sin(t * 3)})`}>
            <g opacity={1 - round} transform={`scale(${logoScale}) translate(${-src.cx} ${-src.cy})`}>
              <path d={src.path} fill="url(#q2-drop-grad)" />
            </g>
            <circle r={(size / 2) * (0.85 + 0.15 * round)} fill="url(#q2-drop-grad)" opacity={round} />
            <ellipse cx={-size * 0.14} cy={-size * 0.2} rx={size * 0.12} ry={size * 0.07} fill="#fff" opacity={0.9} transform={`rotate(-35 ${-size * 0.14} ${-size * 0.2})`} />
          </g>
        );
      })()}
    </g>
  );
};

// Shock ring on the glass where cream lands.
const ImpactRing: React.FC<{x: number; y: number; R: number; k: number}> = ({x, y, R, k}) => {
  if (k < 0 || k > 9) return null;
  const t = k / 9;
  return <circle cx={x} cy={y} r={R * (1.2 + 2.2 * t)} fill="none" stroke="#FFFFFF" strokeWidth={14 * (1 - t) + 2} opacity={0.34 * (1 - t)} filter="url(#q2-ring-blur)" />;
};

// ---------------------------------------------------------------- flood
const FLOOD_DRIPS = [
  {x: 70, w: 44, len: 170, tip: 1.25},
  {x: 205, w: 86, len: 330, tip: 1.1},
  {x: 318, w: 30, len: 120, tip: 1.4},
  {x: 452, w: 64, len: 420, tip: 1.2},
  {x: 540, w: 24, len: 90, tip: 1.3},
  {x: 655, w: 104, len: 250, tip: 1.05},
  {x: 790, w: 38, len: 360, tip: 1.35},
  {x: 900, w: 70, len: 190, tip: 1.2},
  {x: 1020, w: 50, len: 300, tip: 1.3},
];

const wavyEdge = (y0: number, seed: string, t: number, dir: 1 | -1, amp = 1) => {
  const pts: string[] = [];
  for (let x = -60; x <= 1140; x += 12) {
    const y = y0 + dir * amp * (46 * noise2D(`${seed}a`, x * 0.0045, t * 0.05) + 16 * noise2D(`${seed}b`, x * 0.018, t * 0.08));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts;
};

export const floodFront = (frame: number) => {
  const t = interpolate(frame, [P.flood.from, P.flood.full], [0, 1], clamp);
  return -100 + 2320 * Math.pow(t, 1.5);
};

const FloodShape: React.FC<{frame: number}> = ({frame}) => {
  if (frame < P.flood.from) return null;
  const front = floodFront(frame);
  const t = interpolate(frame, [P.flood.from, P.flood.full], [0, 1], clamp);
  const edge = wavyEdge(front, 'fl', frame, 1);
  return (
    <>
      <polygon points={`-60,-500 ${edge.join(' ')} 1140,-500`} />
      {FLOOD_DRIPS.map((g, k) => {
        const grow = Math.min(1, Math.max(0, t * 1.6 - (k % 3) * 0.12));
        const L = g.len * grow * (0.8 + 0.2 * Math.sin(k + frame * 0.2));
        if (L < 4) return null;
        const n = Math.max(3, Math.ceil((L + 60) / 9));
        const tipR = (g.w / 2) * g.tip * Math.min(1, grow * 2);
        const wob = (y: number) => 7 * noise2D(`fd${k}`, y * 0.006, frame * 0.03);
        return (
          <React.Fragment key={k}>
            {Array.from({length: n + 1}).map((_, j) => {
              const u = j / n;
              const y = front - 60 + u * (L + 60 - tipR * 0.6);
              const r = (g.w / 2) * (1 - 0.42 * Math.min(1, u / 0.85));
              return <circle key={j} cx={g.x + wob(y) * u} cy={y} r={r} />;
            })}
            <circle cx={g.x + wob(front + L)} cy={front + L} r={tipR} />
          </React.Fragment>
        );
      })}
    </>
  );
};

// Gloss that lives on the flood sheet: a rolling lip highlight hugging the front, highlight streaks on
// each drip, and slow sheen bands on the body, so the sheet reads thick and wet rather than flat fill.
const FloodGloss: React.FC<{frame: number}> = ({frame}) => {
  if (frame < P.flood.from || frame >= T.cupShot) return null;
  const front = floodFront(frame);
  const t = interpolate(frame, [P.flood.from, P.flood.full], [0, 1], clamp);
  const lip = wavyEdge(front - 30, 'fl', frame, 1);
  const lipSoft = wavyEdge(front - 72, 'fl', frame, 1);
  return (
    <g>
      <polyline points={lipSoft.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={34} opacity={0.34} filter="url(#q2-sheen-blur)" />
      <polyline points={lip.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.85} filter="url(#q2-hl-blur)" />
      {FLOOD_DRIPS.map((g, k) => {
        const grow = Math.min(1, Math.max(0, t * 1.6 - (k % 3) * 0.12));
        const L = g.len * grow * (0.8 + 0.2 * Math.sin(k + frame * 0.2));
        if (L < 40) return null;
        const x = g.x - g.w * 0.2;
        return <line key={k} x1={x} y1={front - 10} x2={x + 1} y2={front + L - g.w * 0.3} stroke="#FFFFFF" strokeWidth={Math.max(3, g.w * 0.1)} strokeLinecap="round" opacity={0.7} filter="url(#q2-hl-blur)" />;
      })}
      <SheetSheen t={frame - P.flood.from} bottom={front} />
    </g>
  );
};

// Slow sheen bands on a big cream sheet (used by the flood, the full-cream frames and the reveal), so the
// cream never sits as one perfectly flat colour.
// The sheet keeps sliding, so its folds travel down a little every frame.
export const SheetSheen: React.FC<{t: number; bottom?: number; top?: number; blurId?: string}> = ({t, bottom = 2400, top = -400, blurId = 'q2-sheen-blur'}) => (
  <g>
    {[0, 1, 2].map((k) => {
      const x = 170 + k * 340 + 60 * Math.sin(t * 0.12 + k * 2);
      const cy = Math.min(bottom - 420 - k * 160, 700 + k * 240 + t * 22);
      return <ellipse key={`sh${k}`} cx={x} cy={Math.max(top + 300, cy)} rx={70 + 30 * k} ry={520} fill="#FFFFFF" opacity={0.2} transform={`rotate(${-8 + k * 6} ${x} ${cy})`} filter={`url(#${blurId})`} />;
    })}
    {[0, 1, 2].map((k) => {
      const x = 250 + k * 330 + 40 * Math.sin(t * 0.09 + k);
      const cy = Math.min(bottom - 620, 820 + k * 220 + t * 26);
      return <ellipse key={`sd${k}`} cx={x} cy={Math.max(top + 300, cy)} rx={110 - 15 * k} ry={600} fill="#E6CFA6" opacity={0.3} filter={`url(#${blurId})`} />;
    })}
  </g>
);

export const CreamDefs: React.FC = () => (
  <defs>
    <CreamFilter id="q2-cream" />
    <radialGradient id="q2-drop-grad" cx="0.42" cy="0.38" r="0.65">
      <stop offset="0" stopColor="#FFFFFF" />
      <stop offset="0.55" stopColor={CREAM} />
      <stop offset="1" stopColor="#E6D2AE" />
    </radialGradient>
    <filter id="q2-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={12} />
    </filter>
    <filter id="q2-ring-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={3} />
    </filter>
    <filter id="q2-sheen-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={16} />
    </filter>
    <filter id="q2-hl-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={1.6} />
    </filter>
  </defs>
);

// Everything cream on the glass, for PhoneStory (design space 1080x1920).
export const GlassCream: React.FC<{frame: number}> = ({frame}) => {
  if (frame < P.dotLaunch[0]) return null;
  const solid = interpolate(frame, [P.flood.full - 1, P.flood.full], [0, 1], clamp);
  const bead = frame >= BEAD_FROM ? beadAt(frame) : null;
  return (
    <g>
      {/* ink the cream dissolved, under the gloss but over the glass */}
      <g filter="url(#q2-cream)">
        <HeroCream frame={frame} />
        {SPLAT_IDX.map((i) => (
          <SplatCream key={i} i={i} frame={frame} />
        ))}
        <FloodShape frame={frame} />
      </g>
      {frame < P.flood.full ? (
        <>
          <clipPath id="q2-below-flood">
            <rect x={-100} y={frame >= P.flood.from ? floodFront(frame) + 70 : -400} width={1280} height={3000} />
          </clipPath>
          <g clipPath="url(#q2-below-flood)">
            {[...BEAD_IDX, ...SPLAT_IDX].map((i) => (
              <InkStreaks key={`is${i}`} i={i} frame={frame} />
            ))}
            {[...BEAD_IDX, ...SPLAT_IDX].map((i) => (
              <InkBlush key={`ib${i}`} i={i} frame={frame} />
            ))}
            {bead ? <Gloss x={bead.x} y={bead.y} r={bead.r} /> : null}
            {!bead
              ? ([0, 1] as const).map((d) => (frame >= T.dropLand[d] ? <Gloss key={d} {...dotCentre(d, frame)} r={DOT_R} /> : null))
              : null}
            {SPLAT_IDX.map((i) => (frame >= splatImpact(i) ? <Gloss key={`g${i}`} {...splatAt(i, frame)} /> : null))}
          </g>
        </>
      ) : null}
      {frame >= P.flood.from ? (
        <>
          <clipPath id="q2-flood-clip">
            <FloodShape frame={frame} />
          </clipPath>
          <g clipPath="url(#q2-flood-clip)">
            <FloodGloss frame={frame} />
          </g>
        </>
      ) : null}
      {([0, 1] as const).map((d) => (
        <ImpactRing key={`r${d}`} x={DOT_LAND[d].x} y={DOT_LAND[d].y} R={DOT_R} k={frame - T.dropLand[d]} />
      ))}
      {SPLAT_IDX.map((i) => {
        const L = splatAt(i, splatImpact(i));
        return <ImpactRing key={`rs${i}`} x={L.x} y={L.y} R={splatR(i)} k={frame - splatImpact(i)} />;
      })}
      {SPLAT_IDX.map((i) => (
        <SplatIncoming key={`in${i}`} i={i} frame={frame} />
      ))}
      <FlyingDot d={0} frame={frame} />
      <FlyingDot d={1} frame={frame} />
      {solid > 0 ? <CreamSheet t={frame - (T.cupShot - 2)} opacity={solid} /> : null}
    </g>
  );
};

// Full-bleed cream with a slow sheen: the last phone frames and the first reveal frame share it.
export const CreamSheet: React.FC<{t: number; opacity?: number; blurId?: string}> = ({t, opacity = 1, blurId}) => (
  <g opacity={opacity}>
    <rect x={-100} y={-100} width={1280} height={2120} fill={CREAM} />
    <SheetSheen t={t + 16} blurId={blurId} />
  </g>
);


// ---------------------------------------------------------------- CreamReveal
// The sheet slides off the glass downwards: a thick rounded lip leads, a thin film clears behind it, and
// a few droplets stuck to the glass slide down after it (bulb down, tail up — they fall, never hang up).
const RESIDUE = Array.from({length: 24}).map((_, k) => ({
  x: 40 + random(`qx${k}`) * 1000,
  y: 120 + random(`qy${k}`) * 1650,
  r: 7 + random(`qr${k}`) * 12,
  v: 0.6 + random(`qv${k}`) * 0.8,
}));

export const REVEAL_FRAMES = 15;

// The lip starts ~70 px down so the cup already shows on the reveal's 2nd frame (no long blank-cream run).
const REVEAL_Y0 = 70;
const REVEAL_SPAN = 2330;
const revealTop = (r: number) => {
  const t = Math.min(1, Math.max(0, r / (REVEAL_FRAMES - 2)));
  return {t, top: REVEAL_Y0 + REVEAL_SPAN * Math.pow(t, 1.45)};
};

export const RevealShape: React.FC<{r: number}> = ({r}) => {
  const {top} = revealTop(r);
  const edge = wavyEdge(top, 'rv', r, -1, 1.1);
  return (
    <>
      <polygon points={`-60,2600 ${edge.join(' ')} 1140,2600`} />
      {RESIDUE.map((q, k) => {
        if (q.y > top - 40) return null;
        const uncover = (REVEAL_FRAMES - 2) * Math.pow(Math.max(0, (q.y + 40 - REVEAL_Y0) / REVEAL_SPAN), 1 / 1.45);
        const since = Math.max(0, r - uncover);
        const y = q.y + since * since * 10 * q.v;
        const rr = q.r * Math.max(0, 1 - since / 9);
        if (rr < 2.5) return null;
        return (
          <React.Fragment key={k}>
            <circle cx={q.x} cy={y} r={rr} />
            {[1, 2, 3].map((j) => (
              <circle key={j} cx={q.x} cy={y - j * rr * (0.8 + since * 0.15)} r={rr * (1 - j * 0.24)} />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

// The thin film the sheet leaves behind: translucent cream fading upwards above the lip.
export const RevealFilm: React.FC<{r: number}> = ({r}) => {
  const {top} = revealTop(r);
  return <rect x={-60} y={top - 320} width={1200} height={360} fill="url(#q2-reveal-film)" />;
};

// Gloss on the draining sheet: sheen bands and a bright rolling lip along its top edge.
export const RevealGloss: React.FC<{r: number}> = ({r}) => {
  const {top} = revealTop(r);
  const lip = wavyEdge(top + 26, 'rv', r, -1, 1.1);
  const lipSoft = wavyEdge(top + 70, 'rv', r, -1, 1.1);
  return (
    <g>
      <SheetSheen t={r + 18} top={top} blurId="q2-reveal-sheen" />
      <polyline points={lipSoft.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={34} opacity={0.34} filter="url(#q2-reveal-sheen)" />
      <polyline points={lip.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.85} filter="url(#q2-reveal-hl)" />
    </g>
  );
};
