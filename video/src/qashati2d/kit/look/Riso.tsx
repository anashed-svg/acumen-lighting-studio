// Risograph misregistration: the dark INK plate and the colour plate are printed separately and never line up.
// <Riso> wraps HTML/SVG children in a CSS filter that
//   1. separates the ink plate (dark pixels: teal outlines, text, deep shadows) by luminance,
//   2. paints the colour plate with "paper" where the ink was (nothing is printed under the line),
//   3. prints the ink plate back on top, shifted by 1–2 px (re-registered on twos: a small jitter every drawing).
// Result: a hair of paper shows on one side of every line and the ink overprints the colour on the other side —
// the real riso tell (NOT an RGB split, which reads as a digital glitch). Use on whole scenes or big groups.
//
// Inside an <svg> use <RisoFilterDef id/> + filter={`url(#id)`} directly.
import React, {useId} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {rng} from '../geom';

export const RisoFilterDef: React.FC<{
  id: string;
  /** plate shift in px */
  amount?: number;
  frame: number;
  /** extra random re-registration per drawing (px) */
  jitter?: number;
  /** what shows in the gap (the paper) */
  gap?: string;
  /** luminance below which a pixel belongs to the ink plate (0..1, sRGB) */
  threshold?: number;
}> = ({id, amount = 1.6, frame, jitter = 0.5, gap = '#FFF6E6', threshold = 0.28}) => {
  const r = rng(4242 + Math.floor(frame / 2) * 13);
  const dx = amount * 0.85 + (r() * 2 - 1) * jitter;
  const dy = amount * 0.55 + (r() * 2 - 1) * jitter;
  // alpha = A − lum, then a steep ramp around (1 − threshold) (steep: mid-tones must not half-belong to the plate,
  // or textured ink turns into grey mottling)
  const k = 12;
  const intercept = -k * (1 - threshold - 0.08);
  return (
    <filter id={id} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0" result="mraw" />
      <feComponentTransfer in="mraw" result="m">
        <feFuncA type="linear" slope={k} intercept={intercept} />
      </feComponentTransfer>
      <feComposite in="SourceGraphic" in2="m" operator="in" result="ink" />
      <feOffset in="ink" dx={dx} dy={dy} result="inkOff" />
      {/* the paper shows only in the HAIR the shifted plate leaves uncovered — not through every grain void / pinhole
          of textured ink (that read as snow): close the mask (fill the voids), shift it like the ink, cut it out */}
      <feMorphology in="m" operator="dilate" radius={2} result="mD" />
      <feMorphology in="mD" operator="erode" radius={2} result="mC" />
      <feOffset in="mC" dx={dx} dy={dy} result="mCOff" />
      <feComposite in="m" in2="mCOff" operator="out" result="hair" />
      <feFlood floodColor={gap} result="paper" />
      <feComposite in="paper" in2="hair" operator="in" result="paperUnderInk" />
      <feComposite in="paperUnderInk" in2="SourceGraphic" operator="over" result="colour" />
      <feMerge>
        <feMergeNode in="colour" />
        <feMergeNode in="inkOff" />
      </feMerge>
    </filter>
  );
};

export const Riso: React.FC<{amount?: number; jitter?: number; gap?: string; children: React.ReactNode; style?: React.CSSProperties; frame?: number}> = ({
  amount = 1.6,
  jitter = 0.5,
  gap,
  children,
  style,
  frame,
}) => {
  const cur = useCurrentFrame();
  const raw = useId();
  const id = `riso${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  if (amount <= 0) return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={style}>
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
        <defs>
          <RisoFilterDef id={id} amount={amount} jitter={jitter} gap={gap} frame={frame ?? cur} />
        </defs>
      </svg>
      <AbsoluteFill style={{filter: `url(#${id})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
