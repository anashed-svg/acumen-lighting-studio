// «Qashati 2D» — stage constants shared by the kit and the three spots (qaf, spoon, guests).
// 9:16, 1080x1920, 30 fps. Characters/props animate ON TWOS (see time.ts); cameras move on ones.

export const FPS = 30;
export const W = 1080;
export const H = 1920;

// Keep key text inside SAFE (TikTok/Reels chrome: top bar, right action rail, bottom caption zone).
// CTAs end at y ≤ ~1400; nothing important in the bottom 35 % (y > 1248) if it can be avoided.
export const SAFE = {top: 220, bottom: 1400, left: 60, right: 960} as const;
export const CAPTION_ZONE_TOP = 1248;

// Optical centre of the safe column (the right rail sits to the right of SAFE.right).
export const CX = (SAFE.left + SAFE.right) / 2; // 510
