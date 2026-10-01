// Rubber-stamp ink for the title stamp and the CTA button (same recipe as the Act-1 stamps: rough warped
// edges, grain voids, pinholes, uneven density, a little bleed). Applied to HTML via CSS `filter: url(#…)`,
// so primitive units are the element's own CSS px (the texture scales with the stamp).
import React from 'react';

// grain / pin: alpha intercepts of the void masks (higher = more solid ink)
const Ink: React.FC<{id: string; seed: number; grain: number; pin: number; warp: number; bleed: number}> = ({id, seed, grain, pin, warp, bleed}) => (
  <filter id={id} x="-8%" y="-20%" width="116%" height="140%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="warpN" />
    <feDisplacementMap in="SourceGraphic" in2="warpN" scale={warp} xChannelSelector="R" yChannelSelector="G" result="rough" />
    {/* grain voids (fine), pinholes (very fine), blotches (large, uneven pressure) */}
    <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves={3} seed={seed + 3} result="grain" />
    <feColorMatrix in="grain" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 -14 0 ${grain}`} result="grainA" />
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seed + 7} result="pin" />
    <feColorMatrix in="pin" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -16 0 0 0 ${pin}`} result="pinA" />
    <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={2} seed={seed + 11} result="blot" />
    <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1.1 0 0 0.55" result="blotA" />
    <feComposite in="grainA" in2="pinA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="mask0" />
    <feComposite in="mask0" in2="blotA" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="mask" />
    <feComposite in="rough" in2="mask" operator="in" result="inked" />
    <feGaussianBlur in="rough" stdDeviation={1.4} result="bleedB" />
    <feComponentTransfer in="bleedB" result="bleedA">
      <feFuncA type="linear" slope={bleed} />
    </feComponentTransfer>
    <feMerge>
      <feMergeNode in="bleedA" />
      <feMergeNode in="inked" />
    </feMerge>
  </filter>
);

export const InkDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
    <defs>
      <Ink id="q2e-ink-title" seed={23} grain={9.9} pin={12.2} warp={7} bleed={0.3} />
      <Ink id="q2e-ink-cta" seed={57} grain={10.8} pin={12.9} warp={5} bleed={0.25} />
      <filter id="q2e-blur2" x="-20%" y="-30%" width="140%" height="160%">
        <feGaussianBlur stdDeviation={2.4} />
      </filter>
    </defs>
  </svg>
);
