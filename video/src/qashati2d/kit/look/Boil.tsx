// Line boil: the drawing is "redrawn" every 2 frames. An SVG feTurbulence → feDisplacementMap filter whose seed
// changes on twos (boilSeed(frame) = Math.floor(frame / 2) + offset). Use it on INK groups (scale ≈ 2.5–4 art units)
// and, gentler and with another offset, on FILL groups — so line and colour wobble independently (the cel-animation
// / riso misregistration look: colour peeks out from under the line by a hair and moves).
//
//   const boil = useBoil({scale: 3});         // inside an <svg>
//   <defs>{boil.def}</defs><g filter={boil.url}>…ink…</g>
//
// For HTML elements use <BoilDefs/> once (an inline 0×0 svg) + style={{filter: `url(#${id})`}}.
import React, {useId} from 'react';
import {useCurrentFrame} from 'remotion';
import {boilSeed} from '../time';

export type BoilOpts = {
  /** displacement in user units of the element (≈ px at scale 1) */
  scale?: number;
  /** turbulence base frequency (user units⁻¹): lower = broader, slower wobble */
  freq?: number;
  octaves?: number;
  /** seed offset so separate layers don't boil in sync */
  offset?: number;
  /** override the frame (e.g. a frozen drawing) */
  frame?: number;
  /** cycle the seed through N drawings (classic 3-drawing boil loop); 0 = never repeats */
  cycle?: number;
  /** filter region padding (fraction of the bbox) */
  pad?: number;
};

export const BoilFilter: React.FC<BoilOpts & {id: string; seed: number}> = ({id, seed, scale = 3, freq = 0.022, octaves = 2, pad = 0.08}) => (
  <filter id={id} x={-pad} y={-pad} width={1 + 2 * pad} height={1 + 2 * pad} filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={octaves} seed={seed} result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
  </filter>
);

export const seedFor = (frame: number, offset = 0, cycle = 0) => {
  const s = boilSeed(frame, 0);
  return (cycle > 0 ? s % cycle : s) + offset * 101 + 1;
};

/** Returns {id, url, def} — put `def` inside the same <svg> (in <defs>) and `filter={url}` on the group. */
export const useBoil = (o: BoilOpts = {}) => {
  const raw = useId();
  const id = `boil${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const cur = useCurrentFrame();
  const frame = o.frame ?? cur;
  const seed = seedFor(frame, o.offset ?? 0, o.cycle ?? 0);
  if ((o.scale ?? 3) <= 0) return {id, url: undefined as string | undefined, def: null as React.ReactNode};
  return {id, url: `url(#${id})` as string | undefined, def: <BoilFilter id={id} seed={seed} {...o} /> as React.ReactNode};
};

/** A group that boils its children (convenience). */
export const Boil: React.FC<BoilOpts & {children: React.ReactNode}> = ({children, ...o}) => {
  const b = useBoil(o);
  return (
    <>
      <defs>{b.def}</defs>
      <g filter={b.url}>{children}</g>
    </>
  );
};

/** For HTML: an invisible svg holding a boil filter with a fixed id (use style.filter = `url(#id)`). */
export const BoilDefs: React.FC<BoilOpts & {id: string}> = ({id, ...o}) => {
  const cur = useCurrentFrame();
  const seed = seedFor(o.frame ?? cur, o.offset ?? 0, o.cycle ?? 0);
  return (
    <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
      <defs>
        <BoilFilter id={id} seed={seed} {...o} />
      </defs>
    </svg>
  );
};
