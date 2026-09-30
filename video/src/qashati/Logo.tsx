import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from './brand';
import {qashatiLogo as L} from './logoPaths';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// The two dots of the Q are drops: they fall in and splat into place, the Q pops,
// the Arabic wordmark reveals right-to-left, the Latin letters rise one by one.
export const AnimatedLogo: React.FC<{start: number; width: number; color?: string}> = ({start, width, color = C.turquoise}) => {
  const frame = useCurrentFrame() - start;
  const {fps} = useVideoConfig();
  const q = spring({frame, fps, config: {damping: 9, stiffness: 140}});
  const arabic = interpolate(frame, [12, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const dotLand = [8, 14];

  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} width={width} height={(width * L.height) / L.width} style={{overflow: 'visible'}}>
      <defs>
        <clipPath id="q-arabic-reveal">
          <rect x={L.width * (1 - arabic)} y={0} width={L.width * arabic} height={L.height} />
        </clipPath>
      </defs>
      <g fill={color}>
        <g
          opacity={Math.min(1, q * 1.5)}
          transform={`translate(${L.width / 2} ${L.height * 0.39}) scale(${0.4 + 0.6 * q}) rotate(${(1 - q) * -14}) translate(${-L.width / 2} ${-L.height * 0.39})`}
        >
          {L.q.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {L.dots.map((d, i) => {
          const land = dotLand[i];
          const t = interpolate(frame, [land - 9, land], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
          const squash = interpolate(frame - land, [0, 3, 8], [0.6, 1.12, 1], clamp);
          const sy = frame >= land ? squash : 1.2;
          const baseY = L.height * 0.135;
          const x = L.width * (i === 0 ? 0.415 : 0.525);
          if (frame < land - 9) return null;
          return (
            <path
              key={i}
              d={d}
              transform={`translate(0 ${(1 - t) * -1400}) translate(${x} ${baseY}) scale(${2 - sy} ${sy}) translate(${-x} ${-baseY})`}
            />
          );
        })}
        <g clipPath="url(#q-arabic-reveal)">
          {L.arabic.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {L.latin.map((d, i) => {
          const t = interpolate(frame, [22 + i * 1.3, 32 + i * 1.3], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
          return <path key={i} d={d} opacity={t} transform={`translate(0 ${(1 - t) * 60})`} />;
        })}
      </g>
    </svg>
  );
};
