// Qashta on the glass: the two dots leap out of the app icon, splat on the glass, run down in wobbly
// glossy trails (washing «مش» off the stamps), then the cream floods the screen. Plus CreamReveal,
// the drain that uncovers the cup shot.
//
// All liquid is drawn as plain shapes inside one group and turned into glossy cream by an SVG
// "goo + lighting" filter: blur → alpha threshold (merges shapes into organic liquid) → height map →
// diffuse (cream, calibrated so flat areas are exactly COLORS.cream) + specular glints + soft shadow.
import {noise2D} from '@remotion/noise';
import React from 'react';
import {interpolate, random} from 'remotion';
import {COLORS, T} from '../../spec';
import {DROP_LAND, dropWaypoints, Waypoint} from '../layout';
import {clamp, P} from '../timeline';
import {bannerOffset, iconDot} from '../ui/OrderBanner';

const CREAM = COLORS.cream;
const R0 = 64; // landed drop radius
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

// ---------------------------------------------------------------- drop paths
// Monotone cubic (Fritsch–Carlson) through the waypoints, per axis.
const monotone = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
};

const makePath = (d: 0 | 1) => {
  const w: Waypoint[] = dropWaypoints(d);
  const fx = monotone(
    w.map((p) => p.f),
    w.map((p) => p.x),
  );
  const fy = monotone(
    w.map((p) => p.f),
    w.map((p) => p.y),
  );
  const land = T.dropLand[d];
  return (t: number) => {
    const ramp = Math.min(1, Math.max(0, (t - land - 4) / 8));
    return {
      x: fx(t) + ramp * 10 * noise2D(`wob${d}`, t * 0.11, 0),
      y: fy(t),
    };
  };
};
const PATHS = [makePath(0), makePath(1)];

const massAt = (d: 0 | 1, t: number) => R0 * (1 - 0.3 * Math.min(1, Math.max(0, (t - T.dropLand[d]) / 45)));

// ---------------------------------------------------------------- liquid shapes (inside the goo group)
const LandedDrop: React.FC<{d: 0 | 1; frame: number}> = ({d, frame}) => {
  const land = T.dropLand[d];
  if (frame < land) return null;
  const k = frame - land;
  const path = PATHS[d];
  const L = DROP_LAND[d];
  const circles: React.ReactNode[] = [];

  // splash crown: droplets thrown out on impact, then stuck to the glass
  for (let j = 0; j < 10; j++) {
    const a = (j / 10) * Math.PI * 2 + random(`sa${d}${j}`) * 0.5;
    const dist = R0 * (1.05 + random(`sd${d}${j}`) * 1.5);
    const t = Math.min(1, (k + 0.6) / 3.5);
    const e = 1 - Math.pow(1 - t, 3);
    const r = 5 + random(`sr${d}${j}`) * 11;
    circles.push(<circle key={`sp${j}`} cx={L.x + Math.cos(a) * dist * e} cy={L.y + Math.sin(a) * dist * e * 0.85} r={r * (0.6 + 0.4 * e)} />);
  }
  // puddle left where it landed
  circles.push(<circle key="pud" cx={L.x} cy={L.y + 6} r={R0 * 0.62} />);

  // trail: a thin film along the path with beads left behind; thicker where the drop was slow
  const step = 0.25;
  for (let t = land + 1; t <= frame; t += step) {
    const p = path(t);
    const q = path(t - step);
    const speed = Math.hypot(p.x - q.x, p.y - q.y) / step;
    const base = massAt(d, t) * 0.24;
    const r = base * (0.8 + 0.35 * noise2D(`tw${d}`, t * 0.3, 1)) + 14 * Math.max(0, 1 - speed / 12);
    circles.push(<circle key={`t${t}`} cx={p.x} cy={p.y} r={r} />);
  }
  for (let b = 0; b < 12; b++) {
    const tb = land + 8 + b * 4.3 + random(`bead${d}${b}`) * 3;
    if (tb > frame - 3) break;
    const p = path(tb);
    circles.push(<circle key={`bead${b}`} cx={p.x + (random(`bx${d}${b}`) - 0.5) * 8} cy={p.y} r={massAt(d, tb) * (0.27 + random(`br${d}${b}`) * 0.12)} />);
  }

  // head: squash on impact, then a bulbous running drop
  const p = path(frame);
  const R = massAt(d, frame);
  if (k < 6) {
    const wob = Math.exp(-k * 0.65) * Math.cos(k * 1.4);
    circles.push(<ellipse key="head" cx={L.x} cy={L.y} rx={R * (1 + 0.42 * wob)} ry={R * (1 - 0.3 * wob)} />);
  } else {
    const prev = path(frame - 1);
    const v = Math.min(1, Math.hypot(p.x - prev.x, p.y - prev.y) / 25);
    circles.push(<circle key="head" cx={p.x} cy={p.y} r={R * (1 - 0.06 * v)} />);
    circles.push(<circle key="neck" cx={p.x - (p.x - prev.x) * 0.3} cy={p.y - R * (0.5 + 0.4 * v)} r={R * 0.72} />);
  }
  return <>{circles}</>;
};

// Flood: a curtain of cream pours down over the glass, a wavy front with irregular drips leading.
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
              // thick where it leaves the sheet, necking down before the bulb
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
  const fade = interpolate(frame, [P.flood.full - 3, P.flood.full], [1, 0], clamp);
  return (
    <g opacity={fade}>
      <polyline points={lipSoft.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={34} opacity={0.34} filter="url(#q2-sheen-blur)" />
      <polyline points={lip.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.85} filter="url(#q2-hl-blur)" />
      {FLOOD_DRIPS.map((g, k) => {
        const grow = Math.min(1, Math.max(0, t * 1.6 - (k % 3) * 0.12));
        const L = g.len * grow * (0.8 + 0.2 * Math.sin(k + frame * 0.2));
        if (L < 40) return null;
        const x = g.x - g.w * 0.2;
        return <line key={k} x1={x} y1={front - 10} x2={x + 1} y2={front + L - g.w * 0.3} stroke="#FFFFFF" strokeWidth={Math.max(3, g.w * 0.1)} strokeLinecap="round" opacity={0.7} filter="url(#q2-hl-blur)" />;
      })}
      {[0, 1, 2].map((k) => {
        const x = 180 + k * 330 + 40 * Math.sin(frame * 0.15 + k * 2);
        return (
          <ellipse key={`sh${k}`} cx={x} cy={front - 420 - k * 160} rx={70 + 30 * k} ry={520} fill="#FFFFFF" opacity={0.16} transform={`rotate(${-8 + k * 6} ${x} ${front - 420})`} filter="url(#q2-sheen-blur)" />
        );
      })}
      {[0, 1].map((k) => {
        const x = 360 + k * 420;
        return <ellipse key={`sd${k}`} cx={x} cy={front - 620} rx={120} ry={600} fill="#E9D6B2" opacity={0.22} filter="url(#q2-sheen-blur)" />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------- flying dots (before they land)
const FlyingDot: React.FC<{d: 0 | 1; frame: number}> = ({d, frame}) => {
  const launch = P.dotLaunch[d];
  const land = T.dropLand[d];
  if (frame < launch || frame >= land) return null;
  const src = iconDot(d);
  const sy = src.y + bannerOffset(launch);
  const dst = DROP_LAND[d];
  // trailing samples (oldest first) — a warm cream smear rather than grey ghosts
  const ghosts = [1.1, 0.92, 0.74, 0.56, 0.38, 0.2, 0];
  const pos = (back: number) => {
    const t = Math.max(0, (frame - back - launch) / (land - launch));
    // it leaps off the icon towards the viewer: grows quickly, hops, and lands on the glass
    const e = t * t * (3 - 2 * t);
    return {
      t,
      x: src.x + (dst.x - src.x) * e,
      y: sy + (dst.y - sy) * e - Math.sin(Math.PI * t) * (d === 0 ? 90 : 60),
      size: src.h + (R0 * 2.1 - src.h) * Math.pow(t, 1.05),
    };
  };
  const head = pos(0);
  const pop = frame - launch; // a little white burst where it leaves the icon
  return (
    <g>
      {pop >= 0 && pop < 5 ? (
        <circle cx={src.x} cy={sy + 6} r={10 + pop * 9} fill="none" stroke="#FFFFFF" strokeWidth={5 * (1 - pop / 5)} opacity={0.8 * (1 - pop / 5)} />
      ) : null}
      {/* shadow on the UI grows softer and further as the drop rises off it */}
      <ellipse cx={head.x + 20 + 50 * head.t} cy={head.y + 40 + 70 * head.t} rx={head.size * 0.45} ry={head.size * 0.4} fill="rgba(0,0,0,0.35)" filter="url(#q2-soft)" />
      {ghosts.slice(0, -1).map((back, gi) => {
        const g = pos(back);
        return <circle key={gi} cx={g.x} cy={g.y} r={(g.size / 2) * (0.6 + 0.05 * gi)} fill={CREAM} opacity={0.08 + 0.05 * gi} />;
      })}
      {(() => {
        const {t, x, y, size} = head;
        const round = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
        const logoScale = (src.h / 304) * (size / src.h);
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

// Wet gloss on top of the filtered cream: a hot specular on each head, a thin streak along the trail.
const DropGloss: React.FC<{d: 0 | 1; frame: number}> = ({d, frame}) => {
  const land = T.dropLand[d];
  const k = frame - land;
  if (k < 1) return null;
  const path = PATHS[d];
  const L = DROP_LAND[d];
  const R = massAt(d, frame);
  const head = k < 6 ? {x: L.x, y: L.y} : path(frame);
  const pts: string[] = [];
  for (let t = land + 7; t <= frame - 1.5; t += 0.5) {
    const p = path(t);
    pts.push(`${(p.x - massAt(d, t) * 0.13).toFixed(1)},${p.y.toFixed(1)}`);
  }
  const hx = head.x - R * 0.34;
  const hy = head.y - R * 0.3;
  return (
    <g>
      {pts.length > 2 ? <polyline points={pts.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.75} filter="url(#q2-hl-blur)" /> : null}
      <ellipse cx={head.x - R * 0.18} cy={head.y - R * 0.16} rx={R * 0.5} ry={R * 0.36} fill="#FFFFFF" opacity={0.28} filter="url(#q2-soft)" />
      <ellipse cx={hx} cy={hy} rx={R * 0.22} ry={R * 0.12} fill="#FFFFFF" opacity={0.95} transform={`rotate(-38 ${hx} ${hy})`} filter="url(#q2-hl-blur)" />
      <circle cx={head.x + R * 0.36} cy={head.y + R * 0.34} r={R * 0.06} fill="#FFFFFF" opacity={0.8} />
    </g>
  );
};

// Shock ring on the glass where a drop lands.
const ImpactRing: React.FC<{d: 0 | 1; frame: number}> = ({d, frame}) => {
  const k = frame - T.dropLand[d];
  if (k < 0 || k > 9) return null;
  const t = k / 9;
  const L = DROP_LAND[d];
  return (
    <circle cx={L.x} cy={L.y} r={R0 * (1.2 + 2.2 * t)} fill="none" stroke="#FFFFFF" strokeWidth={14 * (1 - t) + 2} opacity={0.3 * (1 - t)} filter="url(#q2-ring-blur)" />
  );
};

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
  const solid = interpolate(frame, [P.flood.full, T.cupShot - 1], [0, 1], clamp);
  return (
    <g>
      <g filter="url(#q2-cream)">
        <LandedDrop d={0} frame={frame} />
        <LandedDrop d={1} frame={frame} />
        <FloodShape frame={frame} />
      </g>
      {frame < P.flood.full ? (
        <>
          <clipPath id="q2-below-flood">
            <rect x={-100} y={frame >= P.flood.from ? floodFront(frame) + 70 : -400} width={1280} height={3000} />
          </clipPath>
          <g clipPath="url(#q2-below-flood)">
            <DropGloss d={0} frame={frame} />
            <DropGloss d={1} frame={frame} />
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
      <ImpactRing d={0} frame={frame} />
      <ImpactRing d={1} frame={frame} />
      <FlyingDot d={0} frame={frame} />
      <FlyingDot d={1} frame={frame} />
      {solid > 0 ? <rect x={-100} y={-100} width={1280} height={2120} fill={CREAM} opacity={solid} /> : null}
    </g>
  );
};

// ---------------------------------------------------------------- CreamReveal
const RIVULETS = [
  {x: 110, w: 46, len: 300},
  {x: 262, w: 30, len: 170},
  {x: 400, w: 64, len: 430},
  {x: 575, w: 36, len: 240},
  {x: 720, w: 54, len: 360},
  {x: 880, w: 28, len: 200},
  {x: 1000, w: 50, len: 330},
];
const RESIDUE = Array.from({length: 30}).map((_, k) => ({
  x: random(`qx${k}`) * 1080,
  y: 120 + random(`qy${k}`) * 1650,
  r: 5 + random(`qr${k}`) * 13,
}));

export const REVEAL_FRAMES = 15;

const revealTop = (r: number) => {
  const t = Math.min(1, Math.max(0, r / (REVEAL_FRAMES - 2)));
  return {t, top: -150 + 2400 * Math.pow(t, 1.65)};
};

export const RevealShape: React.FC<{r: number}> = ({r}) => {
  const {t, top} = revealTop(r);
  const edge = wavyEdge(top, 'rv', r, -1, 1.1);
  return (
    <>
      <polygon points={`-60,2600 ${edge.join(' ')} 1140,2600`} />
      {RIVULETS.map((g, k) => {
        // lagging streams: thick where they leave the sheet, thinning to a film upwards
        const L = g.len * Math.min(1, t * 2.4) * (1 - 0.3 * t);
        const n = Math.max(2, Math.ceil(L / 9));
        return (
          <React.Fragment key={k}>
            {Array.from({length: n + 1}).map((_, j) => {
              const u = j / n;
              const y = top + 30 - u * (L + 30);
              const x = g.x + 10 * noise2D(`rv${k}`, y * 0.006, 0);
              return <circle key={j} cx={x} cy={y} r={(g.w / 2) * (1 - 0.5 * Math.pow(u, 0.9))} />;
            })}
          </React.Fragment>
        );
      })}
      {RESIDUE.map((q, k) => {
        if (q.y > top - 30) return null;
        const shrink = Math.max(0, 1 - Math.max(0, r - 2 - (q.y / 1920) * 6) / 6);
        return q.r * shrink > 2.5 ? <circle key={k} cx={q.x} cy={q.y} r={q.r * shrink} /> : null;
      })}
    </>
  );
};

// Gloss on the draining sheet: a bright rolling lip along its top edge, streaks on the streams.
export const RevealGloss: React.FC<{r: number}> = ({r}) => {
  const {t, top} = revealTop(r);
  const lip = wavyEdge(top + 26, 'rv', r, -1, 1.1);
  const lipSoft = wavyEdge(top + 70, 'rv', r, -1, 1.1);
  return (
    <g>
      <polyline points={lipSoft.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={34} opacity={0.34} filter="url(#q2-reveal-sheen)" />
      <polyline points={lip.join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.85} filter="url(#q2-reveal-hl)" />
      {RIVULETS.map((g, k) => {
        const L = g.len * Math.min(1, t * 2.4) * (1 - 0.3 * t);
        if (L < 40) return null;
        const x = g.x - g.w * 0.18;
        return <line key={k} x1={x} y1={top + 10} x2={x} y2={top - L * 0.7} stroke="#FFFFFF" strokeWidth={Math.max(3, g.w * 0.1)} strokeLinecap="round" opacity={0.6} filter="url(#q2-reveal-hl)" />;
      })}
    </g>
  );
};
