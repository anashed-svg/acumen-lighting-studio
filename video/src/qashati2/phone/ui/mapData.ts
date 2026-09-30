// Procedural (deterministic) street map for the 18:07 navigation screen. Built once at import.
import {random} from 'remotion';

type Pt = [number, number];

// Emirates Road runs bottom-right -> top-left through the frame.
export const HIGHWAY: Pt[] = [
  [1230, 1640],
  [1010, 1360],
  [860, 1170],
  [700, 975],
  [540, 790],
  [400, 640],
  [250, 470],
  [60, 250],
  [-160, 10],
];

const dir = (() => {
  const dx = 400 - 860;
  const dy = 640 - 1170;
  const l = Math.hypot(dx, dy);
  return {a: [dx / l, dy / l] as Pt, b: [-dy / l, dx / l] as Pt};
})();

const O: Pt = [700, 975];
const toXY = (s: number, t: number): Pt => [O[0] + s * dir.a[0] + t * dir.b[0], O[1] + s * dir.a[1] + t * dir.b[1]];

// Catmull-Rom -> cubic bezier path
export const smoothPath = (pts: Pt[], closed = false) => {
  if (pts.length < 2) return '';
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? d + ' Z' : d;
};

const wobble = (pts: Pt[], seed: string, amp: number): Pt[] =>
  pts.map(([x, y], i) => [x + (random(`${seed}x${i}`) - 0.5) * amp, y + (random(`${seed}y${i}`) - 0.5) * amp]);

const lineST = (s0: number, t0: number, s1: number, t1: number, n = 6, seed = '', amp = 0): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(toXY(s0 + (s1 - s0) * u, t0 + (t1 - t0) * u));
  }
  return amp ? wobble(pts, seed, amp) : pts;
};

export const map = (() => {
  const locals: string[] = [];
  const arterials: string[] = [];
  const parks: string[] = [];
  const sand: string[] = [];
  const blocks: string[] = [];

  // arterial grid aligned with the highway
  const tLines = [-1180, -860, -560, -270, 270, 560, 860, 1180];
  const sLines = [-1500, -1180, -880, -600, -320, -40, 250, 540, 840, 1140];
  tLines.forEach((t, i) => arterials.push(smoothPath(lineST(-1800, t, 1800, t + 40, 10, `ta${i}`, 18))));
  sLines.forEach((s, i) => arterials.push(smoothPath(lineST(s, -1500, s + 30, 1500, 10, `sa${i}`, 18))));

  // cells between arterials -> neighbourhood patterns
  for (let i = 0; i < sLines.length - 1; i++) {
    for (let j = 0; j < tLines.length - 1; j++) {
      const s0 = sLines[i] + 22;
      const s1 = sLines[i + 1] - 22;
      const t0 = tLines[j] + 22;
      const t1 = tLines[j + 1] - 22;
      if (t0 < 0 && t1 > 0) continue; // highway corridor
      const r = random(`cell${i}-${j}`);
      if (r < 0.1) {
        parks.push(smoothPath([toXY(s0 + 20, t0 + 20), toXY(s1 - 30, t0 + 30), toXY(s1 - 20, t1 - 20), toXY(s0 + 30, t1 - 40)], true));
        continue;
      }
      if (r < 0.2) {
        sand.push(smoothPath([toXY(s0, t0), toXY(s1, t0 + 10), toXY(s1 - 10, t1), toXY(s0 + 10, t1)], true));
        continue;
      }
      blocks.push(smoothPath([toXY(s0 - 8, t0 - 8), toXY(s1 + 8, t0 - 8), toXY(s1 + 8, t1 + 8), toXY(s0 - 8, t1 + 8)], true));
      if (r < 0.55) {
        // villa loops: a ring road with cul-de-sacs
        const ms = (s0 + s1) / 2;
        const mt = (t0 + t1) / 2;
        const rs = (s1 - s0) / 2 - 30;
        const rt = (t1 - t0) / 2 - 30;
        const ring: Pt[] = [];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          ring.push(toXY(ms + Math.cos(a) * rs, mt + Math.sin(a) * rt));
        }
        locals.push(smoothPath(wobble(ring, `ring${i}${j}`, 16), true));
        locals.push(smoothPath([toXY(ms, t0 - 20), toXY(ms, mt - rt)]));
        for (let k = 0; k < 5; k++) {
          const a = random(`cul${i}${j}${k}`) * Math.PI * 2;
          const p0 = toXY(ms + Math.cos(a) * rs, mt + Math.sin(a) * rt);
          const p1 = toXY(ms + Math.cos(a) * rs * 0.45, mt + Math.sin(a) * rt * 0.45);
          locals.push(`M${p0[0]},${p0[1]} L${p1[0]},${p1[1]}`);
        }
      } else {
        // dense grid of small streets
        const n = 3 + Math.floor(random(`n${i}${j}`) * 3);
        for (let k = 1; k <= n; k++) {
          const t = t0 + ((t1 - t0) * k) / (n + 1);
          locals.push(smoothPath(lineST(s0 - 20, t, s1 + 20, t + 6, 3, `g${i}${j}${k}`, 5)));
        }
        const m = 2 + Math.floor(random(`m${i}${j}`) * 2);
        for (let k = 1; k <= m; k++) {
          const s = s0 + ((s1 - s0) * k) / (m + 1);
          locals.push(smoothPath(lineST(s, t0 - 20, s + 8, t1 + 20, 3, `h${i}${j}${k}`, 5)));
        }
      }
    }
  }

  // parallel highway and a crossing highway
  const parallel = smoothPath(lineST(-1800, 1020, 1800, 980, 12, 'par', 10));
  const crossing = smoothPath(lineST(-620, -1600, -560, 1600, 12, 'cross', 10));
  const interchange = (() => {
    const c = toXY(-590, 0);
    return c;
  })();
  return {locals, arterials, parks, sand, blocks, parallel, crossing, interchange};
})();

// Route: from "you" on Emirates Road up to the exit, then a short local hop to home.
export const ROUTE: Pt[] = [
  [872, 1186],
  [700, 975],
  [540, 790],
  [400, 640],
  [318, 546],
  [272, 520],
  [238, 548],
];
export const HOME: Pt = [238, 548];
export const YOU: Pt = [872, 1186];

// traffic colour stops along the route (fraction of length)
export const TRAFFIC: {from: number; to: number; c: 'red' | 'dark' | 'orange' | 'blue'}[] = [
  {from: 0, to: 0.06, c: 'orange'},
  {from: 0.06, to: 0.3, c: 'dark'},
  {from: 0.3, to: 0.42, c: 'red'},
  {from: 0.42, to: 0.66, c: 'dark'},
  {from: 0.66, to: 0.84, c: 'red'},
  {from: 0.84, to: 0.92, c: 'orange'},
  {from: 0.92, to: 1, c: 'blue'},
];
