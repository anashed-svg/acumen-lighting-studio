// Printed-ink texture for HTML text / stamps (CSS `filter: url(#id)`): rough, warped edges (boils with the seed),
// fine grain voids where the ink didn't take, a few pinholes, uneven pressure (blotches) and a little bleed.
// Same recipe family as spot #2's rubber stamps, softer (riso ink, not a rubber stamp). Primitive units are the
// element's own CSS px, so the texture scales with the type. Pass a seed that changes on twos for a boiling print.
import React from 'react';

export const InkTextureFilter: React.FC<{
  id: string;
  seed: number;
  /** edge warp in px */
  warp?: number;
  /** higher = more solid ink (fewer voids) */
  grain?: number;
  pin?: number;
  bleed?: number;
  /** extra spread on impact frames (px) — the "wet press" */
  wet?: number;
}> = ({id, seed, warp = 4, grain = 11.5, pin = 13.5, bleed = 0.28, wet = 0}) => (
  <filter id={id} x="-10%" y="-25%" width="120%" height="150%" colorInterpolationFilters="sRGB">
    {wet > 0 ? <feMorphology in="SourceGraphic" operator="dilate" radius={wet} result="src" /> : <feOffset in="SourceGraphic" dx={0} dy={0} result="src" />}
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={seed} result="warpN" />
    <feDisplacementMap in="src" in2="warpN" scale={warp} xChannelSelector="R" yChannelSelector="G" result="rough" />
    <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves={3} seed={seed + 3} result="grainN" />
    <feColorMatrix in="grainN" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 -14 0 ${grain}`} result="grainA" />
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={seed + 7} result="pinN" />
    <feColorMatrix in="pinN" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -16 0 0 0 ${pin}`} result="pinA" />
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={seed + 11} result="blotN" />
    <feColorMatrix in="blotN" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1.1 0 0 0.62" result="blotA" />
    <feComposite in="grainA" in2="pinA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="m0" />
    <feComposite in="m0" in2="blotA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="mask" />
    <feComposite in="rough" in2="mask" operator="in" result="inked" />
    <feGaussianBlur in="rough" stdDeviation={1.2} result="bleedB" />
    <feComponentTransfer in="bleedB" result="bleedA">
      <feFuncA type="linear" slope={bleed} />
    </feComponentTransfer>
    <feMerge>
      <feMergeNode in="bleedA" />
      <feMergeNode in="inked" />
    </feMerge>
  </filter>
);
