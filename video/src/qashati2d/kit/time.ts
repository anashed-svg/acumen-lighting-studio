// Timing helpers. Convention for the whole series:
//   • characters, props, bubbles, titles animate ON TWOS (12 drawings/s): feed them onTwos(frame)
//   • the ink boils on twos too: boilSeed(frame) = Math.floor(frame / 2) (+ a per-layer offset)
//   • the CAMERA moves on ones (smooth), so the world drifts while the drawings step — the stop-motion feel
// Never use a default scale-pop: use the named curves below (anticipation → overshoot → settle) or your own.
import {useCurrentFrame} from 'remotion';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;

/** The frame held on twos: 0,0,2,2,4,4… (relative to `from` when given: from, from, from+2…). */
export const onTwos = (frame: number, from = 0) => from + Math.floor((frame - from) / 2) * 2;
/** Generic stepping: hold every `n` frames. */
export const onNs = (frame: number, n: number, from = 0) => from + Math.floor((frame - from) / n) * n;
/** Hook form: the current frame on twos (and the raw frame) — `const {f2, frame} = useOnTwos()`. */
export const useOnTwos = (from = 0) => {
  const frame = useCurrentFrame();
  return {frame, f2: onTwos(frame, from)};
};
/** Boil seed: changes every 2 frames. Different layers add different offsets so they don't boil in sync. */
export const boilSeed = (frame: number, offset = 0) => Math.floor(frame / 2) + offset;

// ---------------------------------------------------------------- easing (pure functions of t ∈ [0,1])
export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInCubic = (t: number) => clamp01(t) ** 3;
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const easeOutBack = (t: number, s = 1.6) => {
  const x = clamp01(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};

/** Progress 0→1 between two frames (clamped), with an optional easing. */
export const prog = (frame: number, from: number, to: number, ease: (t: number) => number = (t) => t) =>
  ease(clamp01((frame - from) / Math.max(1e-6, to - from)));

/** Damped spring-like oscillation after a hit at frame `at` (0 before it). freq in rad/frame, decay per frame. */
export const jiggle = (frame: number, at: number, amp = 1, freq = 0.9, decay = 0.25) => {
  const t = frame - at;
  return t < 0 ? 0 : amp * Math.sin(t * freq) * Math.exp(-t * decay);
};

/**
 * A hand-animated "pop" for appear-on-twos elements: keys are scale values on twos from `at`.
 * Default: anticipation squash → overshoot → undershoot → settle. Returns {s, sx, sy, visible}.
 * sx/sy carry the squash & stretch (volume-ish), s is the uniform part.
 */
export const POP_KEYS = [
  {s: 0.35, sx: 1.35, sy: 0.55}, // smear frame: wide & flat (comes in squashed)
  {s: 1.12, sx: 0.92, sy: 1.1}, // stretch past the target
  {s: 0.96, sx: 1.05, sy: 0.95}, // squash back
  {s: 1.01, sx: 0.99, sy: 1.01},
  {s: 1, sx: 1, sy: 1},
] as const;
export const popOnTwos = (frame: number, at: number, keys: readonly {s: number; sx: number; sy: number}[] = POP_KEYS) => {
  if (frame < at) return {visible: false, s: 0, sx: 1, sy: 1, step: -1};
  const step = Math.floor((frame - at) / 2);
  const k = keys[Math.min(step, keys.length - 1)];
  return {visible: true, s: k.s, sx: k.sx, sy: k.sy, step};
};
/** The reverse: shrink away on twos from `at` (keys played backwards, faster). */
export const unpopOnTwos = (frame: number, at: number) => {
  if (frame < at) return {visible: true, s: 1, sx: 1, sy: 1};
  const step = Math.floor((frame - at) / 2);
  const keys = [
    {s: 1.08, sx: 1.04, sy: 0.96},
    {s: 0.6, sx: 0.8, sy: 1.25},
    {s: 0.15, sx: 0.5, sy: 1.6},
  ];
  if (step >= keys.length) return {visible: false, s: 0, sx: 1, sy: 1};
  return {visible: true, ...keys[step]};
};

/**
 * Anticipation → action → overshoot → settle, as a 0..1 position curve (can go < 0 and > 1).
 * Good for a prop that moves from A to B: back up a little, go, overshoot, settle.
 */
export const anticipate = (t: number, back = 0.12, over = 0.08) => {
  const x = clamp01(t);
  if (x < 0.25) return -back * Math.sin((x / 0.25) * (Math.PI / 2));
  if (x < 0.7) {
    const u = (x - 0.25) / 0.45;
    return -back + (1 + over + back) * easeInOutCubic(u);
  }
  const u = (x - 0.7) / 0.3;
  return 1 + over * Math.cos(u * Math.PI * 0.5) * (1 - u) ** 0.5;
};

/** Squash & stretch from a vertical velocity-ish value v (−1..1): positive = falling/stretching. */
export const stretchFromVelocity = (v: number, k = 0.25) => {
  const s = 1 + k * Math.abs(v);
  return {sx: 1 / Math.sqrt(s), sy: s};
};
