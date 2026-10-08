// Top-down dolly camera with parallax. The camera moves ON ONES (smooth); the drawings step on twos.
// A world point p at height h projects to  screen = (540, 960) + R(rot) · (p − cam) · k(h),  k(h) = HC / (HC/z − h)
// so hands (h > 0) are bigger than the table and slide further when the camera pans or pushes in.
import {Pt} from '../kit/lib';
import {CAM_HC, CAM_KEYS, HANDS} from './spec';

export type Cam = {x: number; y: number; z: number; rot: number};

const ease = (t: number) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;

/** base camera from the keys (eased in-out between keys) */
const baseCam = (f: number): Cam => {
  const K = CAM_KEYS;
  if (f <= K[0].f) return {...K[0]};
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i];
    const b = K[i + 1];
    if (f <= b.f) {
      const t = ease((f - a.f) / Math.max(1e-6, b.f - a.f));
      return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, rot: a.rot + (b.rot - a.rot) * t};
    }
  }
  return {...K[K.length - 1]};
};

/** a soft camera punch-in on every spoon impact (decaying), and a hand-held shake on the snatch */
export const camAt = (f: number, snatchAt: number, stopAt: number): Cam => {
  const c = baseCam(f);
  let bump = 0;
  for (const h of HANDS) {
    const t = f - h.dig;
    if (t >= 0 && t < 24) bump += 0.014 * Math.exp(-t * 0.22) * Math.cos(t * 0.5);
  }
  c.z *= 1 + bump;
  // the snatch: a short shake (on ones — it is the camera reacting)
  const s = f - snatchAt;
  if (s >= 0 && s < 16) {
    const a = 9 * Math.exp(-s * 0.28);
    c.x += a * Math.sin(s * 2.1);
    c.y += a * 0.6 * Math.cos(s * 1.7);
    c.rot += 0.5 * a * 0.1 * Math.sin(s * 1.3);
  }
  // the dead stop: a tiny "catch" (the camera bumps into the stillness)
  const d = f - stopAt;
  if (d >= 0 && d < 8) c.z *= 1 + 0.01 * Math.exp(-d * 0.5);
  return c;
};

export const layerK = (cam: Cam, h: number) => CAM_HC / (CAM_HC / cam.z - h);

export const project = (cam: Cam, p: Pt, h = 0): Pt => {
  const k = layerK(cam, h);
  const dx = (p[0] - cam.x) * k;
  const dy = (p[1] - cam.y) * k;
  const r = (cam.rot * Math.PI) / 180;
  return [540 + dx * Math.cos(r) - dy * Math.sin(r), 960 + dx * Math.sin(r) + dy * Math.cos(r)];
};

/** CSS transform for a layer whose children are positioned in world px at height h (transform-origin 0 0) */
export const layerTransform = (cam: Cam, h: number) => {
  const k = layerK(cam, h);
  return `translate(540px, 960px) rotate(${cam.rot}deg) scale(${k}) translate(${-cam.x}px, ${-cam.y}px)`;
};
