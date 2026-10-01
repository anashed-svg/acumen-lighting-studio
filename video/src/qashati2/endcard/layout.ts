// Title stamp + end card — layout (1080x1920 design px) and the micro-timeline, all derived from ../spec.ts.
// Hierarchy on the card: platform line (stamp, top) → product + brand lockup (middle row) → CTA stamp button
// → how/where (2 info lines) → comment prompt. Everything sits inside SAFE; the CTA, ctaSub and location end
// above y 1400 (≈1375), the comment bubble at ≈1466.
import {Easing, interpolate} from 'remotion';
import {SAFE, T} from '../spec';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);

// Optical centre of the safe column (the right rail of TikTok/Reels sits right of SAFE.right).
export const CX = (SAFE.left + SAFE.right) / 2; // 510

export const TITLE = {
  cx: CX,
  cy: 376, // whole stamp (border + ink) inside SAFE: y 220–520 at full size
  fontSize: 168, // ≈ 82% of the width, border inside x 60–960
  rot: 2.2, // clockwise: the line rises as it is read right → left
  // on the end card the camera pulls back with the cup: the stamp eases to a smaller size, a touch higher
  endScale: 0.8,
  // during the spoon lift the scoop rises to y≈453 under the stamp's right half: the stamp eases smaller and
  // a touch higher first (bottom ≈446 at x 840), then settles at endCy on the card once the scoop is gone
  scoopCy: 330,
  endCy: 345, // y 221–460 on the card
  // bottom of the outer border below the centre, measured along x = cx at scale 1 (incl. ink bleed)
  bottomOff: 133,
};

// Middle row: packshot on the left, logo lockup on the right (read first in RTL, clear of the right rail).
// cup of cup-packshot.png (its solid-alpha bbox, measured at render time) lands centred on cx, base on bottom
export const PACK = {cx: 292, bottom: 1054, cupH: 545};
export const LOGO = {cx: 716, top: 490, width: 356}; // tagline (≈455 px wide) ends at x ≈ 943, clear of the right rail
export const LOGO_ASPECT = 2396 / 2048; // qashatiLogo height / width
export const TAGLINE_GAP = 54; // px between the Latin wordmark and the tagline
export const TAGLINE_SIZE = 42;

export const CTA = {cx: CX, cy: 1164, fontSize: 74, rot: 1.6};
export const SUB = {top: 1240, fontSize: 48};
export const LOC = {top: 1306, fontSize: 45};
export const COMMENT = {cx: CX, top: 1392, fontSize: 38};

// Where the cup sits in the LAST frame of cup-shot.mp4 (design px) — the start of the cup → packshot pull-back.
// v2 shot ends pushed in with the cup's base below the frame: top = garnish tip, bottom = the VIRTUAL base
// (dome width 900 px × the packshot's height/width ≈ 1.52). Re-measure if the final framing changes
// (out/qashati2/v2/endcard/measure_cup.py prints the visible bbox; the spoon and the frame edge are in it).
export const CUP_LAST = {cx: 540, top: 585, bottom: 1955};

// Micro-timeline (global frames).
export const E = {
  titleApproach: T.title - 2,
  // pull-back: the live shot starts shrinking 4 f before the card (so the cup has cleared the logo column
  // when the Q pops), the frozen last frame carries on into the packshot slot
  morph: {from: T.endCard - 4, to: T.endCard + 12},
  // the swap to the packshot happens at the fastest part of the pull-back, under a whip blur: the packshot
  // (riding the same path) fades in over the frozen frame, then the frozen frame (and its spoon) fades out
  packIn: {from: T.endCard + 3, to: T.endCard + 6},
  frozenOut: {from: T.endCard + 5, to: T.endCard + 7},
  logoStart: T.logoDots[0] - 8, // AnimatedLogo: its dot 1 lands at start + 8 (= T.logoDots[0], the sonic logo)
  logoSettled: T.logoDots[0] - 8 + 52, // AnimatedLogo is fully static from here → own wobbling-dots version
  tagline: {from: T.logoDots[0] + 26, to: T.logoDots[0] + 40},
  ctaApproach: T.cta - 2,
  sub: {from: T.cta + 8, to: T.cta + 18},
  loc: {from: T.cta + 12, to: T.cta + 22},
  ctaGlint: [T.cta + 34, T.cta + 62], // both sweeps finish before the loop point
  loopFrom: T.endCard + 16, // "alive" loop motion (float, dot wobble) from here to the end
  // the logo's two dots echo the sonic logo («تشك-تشك») on the music: dot 1 lands on these frames, dot 2 one
  // dot-gap later — beat 13 of the 120 BPM groove and the stop-time button (T.end - 20, see make_sound.py BUTTON).
  // The first take-off (landing − 11 f) must come after logoSettled, when the dots become our own paths.
  dotHops: [T.end - 35, T.end - 20],
  dotGap: T.logoDots[1] - T.logoDots[0],
};

// Where the title stamp is at a frame (it eases smaller and higher with the pull-back), and the y of its
// bottom edge at a given x (rotation included) — the logo's falling dots are hidden above this line, so they
// drop out from under the stamp instead of passing through its letters.
export const titlePull = (frame: number) => easeInOut(interpolate(frame, [E.morph.from, E.morph.to], [0, 1], clamp));
const titleLift = (frame: number) => easeInOut(interpolate(frame, [T.spoon[0] + 20, T.spoon[0] + 32], [0, 1], clamp));
// Stamp centre y and scale at a frame: lift clear of the scoop, then the pull-back onto the card.
export const titlePose = (frame: number) => {
  const lift = titleLift(frame);
  const cy = TITLE.cy + (TITLE.scoopCy - TITLE.cy) * lift + (TITLE.endCy - TITLE.scoopCy) * titlePull(frame);
  return {cy, s: 1 + (TITLE.endScale - 1) * lift};
};
export const titleBottomAt = (frame: number, x: number) => {
  const {cy, s} = titlePose(frame);
  return cy + TITLE.bottomOff * s + (x - TITLE.cx) * s * Math.tan((TITLE.rot * Math.PI) / 180);
};
