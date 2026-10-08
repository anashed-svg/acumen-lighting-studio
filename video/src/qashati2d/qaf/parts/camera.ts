// Camera for the qaf spot: smooth keys (on ONES — the drawings step on twos, the camera never does), parallax
// layers, a world → screen mapper (for screen-space masks of world shapes) and a damped hit shake.
import {easeInOutCubic, Pt} from '../../kit/lib';
import {CAM} from '../spec';

export type Cam = {zoom: number; cx: number; cy: number; rot: number};

export const camAt = (f: number): Cam => {
  const keys = CAM;
  if (f <= keys[0].f) return {...keys[0]};
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f <= b.f) {
      const t = easeInOutCubic((f - a.f) / (b.f - a.f));
      return {zoom: a.zoom + (b.zoom - a.zoom) * t, cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, rot: a.rot + (b.rot - a.rot) * t};
    }
  }
  const z = keys[keys.length - 1];
  return {zoom: z.zoom, cx: z.cx, cy: z.cy, rot: z.rot};
};

/** the camera seen by a layer at depth p (1 = the world plane, < 1 = further away, > 1 = closer) */
export const parallax = (c: Cam, p: number): Cam => ({
  zoom: 1 + (c.zoom - 1) * p,
  cx: 540 + (c.cx - 540) * p,
  cy: 960 + (c.cy - 960) * p,
  rot: c.rot * p,
});

export const camCss = (c: Cam, shake: Pt = [0, 0]) =>
  `translate(${540 + shake[0]}px, ${960 + shake[1]}px) rotate(${c.rot}deg) scale(${c.zoom}) translate(${-c.cx}px, ${-c.cy}px)`;

export const toScreen = (c: Cam, p: Pt, shake: Pt = [0, 0]): Pt => {
  const x = (p[0] - c.cx) * c.zoom;
  const y = (p[1] - c.cy) * c.zoom;
  const r = (c.rot * Math.PI) / 180;
  return [540 + shake[0] + x * Math.cos(r) - y * Math.sin(r), 960 + shake[1] + x * Math.sin(r) + y * Math.cos(r)];
};

/** damped shake after a hit (screen px), stepped on twos like a re-photographed frame */
export const shakeAt = (f: number, hits: {at: number; amp: number}[]): Pt => {
  let x = 0;
  let y = 0;
  const f2 = Math.floor(f / 2) * 2;
  for (const h of hits) {
    const t = f2 - h.at;
    if (t < 0 || t > 14) continue;
    const e = h.amp * Math.exp(-t * 0.28);
    x += e * Math.sin(t * 2.1 + h.at);
    y += e * 0.8 * Math.cos(t * 2.7 + h.at * 0.5);
  }
  return [x, y];
};
