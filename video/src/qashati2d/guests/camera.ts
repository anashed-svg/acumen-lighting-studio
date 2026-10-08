// A 2D multiplane camera for the «ضيوف فجأة» shots. The camera moves ON ONES (smooth); drawings step on twos.
// Every layer has a depth factor d: 1 = the focus plane, < 1 = background (moves/zooms less), > 1 = foreground
// (moves/zooms more) — the parallax that gives a flat drawing depth.
import {easeInOutSine} from '../kit/lib';

export type Cam = {x: number; y: number; z: number; r: number};
export type CamKey = {f: number; x: number; y: number; z: number; r?: number; ease?: (t: number) => number};

/** camera from keys (x/y = the world point at screen centre, z = zoom, r = roll deg); eased between keys */
export const camAt = (keys: CamKey[], f: number): Cam => {
  const k0 = keys[0];
  if (f <= k0.f) return {x: k0.x, y: k0.y, z: k0.z, r: k0.r ?? 0};
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f <= b.f) {
      const e = b.ease ?? easeInOutSine;
      const t = e((f - a.f) / Math.max(1e-6, b.f - a.f));
      return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, r: (a.r ?? 0) + ((b.r ?? 0) - (a.r ?? 0)) * t};
    }
  }
  const kl = keys[keys.length - 1];
  return {x: kl.x, y: kl.y, z: kl.z, r: kl.r ?? 0};
};

/** decaying hand-held shake after each hit (on ones — it is the camera reacting) */
export const shake = (f: number, hits: {at: number; amp: number; decay?: number}[]): {x: number; y: number; r: number} => {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const h of hits) {
    const t = f - h.at;
    if (t < 0 || t > 30) continue;
    const a = h.amp * Math.exp(-t * (h.decay ?? 0.3));
    x += a * Math.sin(t * 2.3 + h.at);
    y += a * 0.7 * Math.cos(t * 1.9 + h.at * 0.7);
    r += a * 0.06 * Math.sin(t * 1.4 + h.at);
  }
  return {x, y, r};
};

export const withShake = (c: Cam, s: {x: number; y: number; r: number}): Cam => ({x: c.x - s.x, y: c.y - s.y, z: c.z, r: c.r + s.r});

const layerParams = (cam: Cam, d: number) => {
  const cx = 540 + (cam.x - 540) * d;
  const cy = 960 + (cam.y - 960) * d;
  const z = 1 + (cam.z - 1) * d;
  return {cx, cy, z, r: cam.r * Math.min(1, d)};
};
/** SVG transform for a layer whose children are in world px at depth d */
export const layerG = (cam: Cam, d = 1) => {
  const p = layerParams(cam, d);
  return `translate(540 960) rotate(${p.r.toFixed(3)}) scale(${p.z.toFixed(4)}) translate(${(-p.cx).toFixed(2)} ${(-p.cy).toFixed(2)})`;
};
/** CSS transform (transform-origin 0 0) for an HTML layer at depth d */
export const layerCss = (cam: Cam, d = 1) => {
  const p = layerParams(cam, d);
  return `translate(540px, 960px) rotate(${p.r.toFixed(3)}deg) scale(${p.z.toFixed(4)}) translate(${(-p.cx).toFixed(2)}px, ${(-p.cy).toFixed(2)}px)`;
};
/** world point → screen px for depth d */
export const toScreen = (cam: Cam, x: number, y: number, d = 1): [number, number] => {
  const p = layerParams(cam, d);
  const a = (p.r * Math.PI) / 180;
  const dx = (x - p.cx) * p.z;
  const dy = (y - p.cy) * p.z;
  return [540 + dx * Math.cos(a) - dy * Math.sin(a), 960 + dx * Math.sin(a) + dy * Math.cos(a)];
};
