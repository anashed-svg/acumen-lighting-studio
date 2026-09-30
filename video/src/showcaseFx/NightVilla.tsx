import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, tint} from './brand';

// Stand-in "footage": a modern villa at night with LED coves, grazed stone piers and warm
// glazing, drawn in a 1920x1080 SVG. `cover` crops it to fill the frame; `contain` keeps the
// whole villa (sky and ground run past the viewBox, so vertical frames have no seams).
type Props = {accent: string; stone?: string; lightsFrom?: number; fit?: 'cover' | 'contain'; zoom?: number};

const piers = [300, 500, 1360, 1560];
const upperGrazers = [640, 1280];
const slabs = [
  {x: 520, y: 322, w: 880},
  {x: 200, y: 566, w: 1520},
];

export const NightVilla: React.FC<Props> = ({accent, stone = '#1B1917', lightsFrom = 0, fit = 'cover', zoom = 1}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const on = (delay: number) =>
    interpolate(frame - lightsFrom, [delay, delay + fps * 0.8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: easeOut,
    });
  const push = zoom * interpolate(frame, [0, durationInFrames], [1, 1.05]);
  const cove = on(0);
  const glass = on(fps * 0.5);

  return (
    <AbsoluteFill style={{backgroundColor: '#050506', overflow: 'hidden'}}>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
        style={{width: '100%', height: '100%', overflow: 'visible', transform: `scale(${push})`}}
      >
        <defs>
          <linearGradient id="nv-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-600" x2="0" y2="770">
            <stop offset="0" stopColor="#050506" />
            <stop offset="0.6" stopColor="#0A0B0D" />
            <stop offset="1" stopColor="#060607" />
          </linearGradient>
          <linearGradient id="nv-ground" gradientUnits="userSpaceOnUse" x1="0" y1="770" x2="0" y2="1500">
            <stop offset="0" stopColor={tint(accent, 0.1)} />
            <stop offset="0.12" stopColor="#060606" />
            <stop offset="1" stopColor="#030303" />
          </linearGradient>
          <linearGradient id="nv-cove" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint(accent, 0.55)} />
            <stop offset="0.25" stopColor={tint(accent, 0.18)} />
            <stop offset="1" stopColor={tint(accent, 0)} />
          </linearGradient>
          <radialGradient id="nv-scallop" cx="0.5" cy="1" r="1" fx="0.5" fy="1">
            <stop offset="0" stopColor={tint(accent, 0.95)} />
            <stop offset="0.2" stopColor={tint(accent, 0.5)} />
            <stop offset="0.6" stopColor={tint(accent, 0.1)} />
            <stop offset="1" stopColor={tint(accent, 0)} />
          </radialGradient>
          <linearGradient id="nv-graze" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={tint(accent, 0.6)} />
            <stop offset="0.45" stopColor={tint(accent, 0.18)} />
            <stop offset="1" stopColor={tint(accent, 0.02)} />
          </linearGradient>
          <linearGradient id="nv-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tint(accent, 0.22)} />
            <stop offset="0.35" stopColor={tint(accent, 0.07)} />
            <stop offset="1" stopColor={tint(accent, 0.12)} />
          </linearGradient>
          <linearGradient id="nv-reflect" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <filter id="nv-blur" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="nv-soft">
            <feGaussianBlur stdDeviation="3 6" />
          </filter>
          <linearGradient id="nv-fade" gradientUnits="userSpaceOnUse" x1="0" y1="770" x2="0" y2="1060">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <mask id="nv-reflection-mask" maskUnits="userSpaceOnUse" x="-2000" y="770" width="5920" height="600">
            <rect x="-2000" y="770" width="5920" height="600" fill="url(#nv-fade)" />
          </mask>
        </defs>

        <rect x="-2000" y="-1400" width="5920" height="2170" fill="url(#nv-sky)" />
        <rect x="-2000" y="770" width="5920" height="1400" fill="url(#nv-ground)" opacity={0.4 + 0.6 * cove} />

        <g id="nv-villa" transform="translate(0 -90)">
          {/* upper volume */}
          <rect x="560" y="340" width="800" height="226" fill="#0D0C0B" />
          <rect x="700" y="378" width="520" height="150" fill="url(#nv-glass)" opacity={glass} />
          <rect x="700" y="378" width="520" height="150" fill="url(#nv-reflect)" />
          {[830, 960, 1090].map((x) => (
            <rect key={x} x={x} y="378" width="3" height="150" fill="#0D0C0B" />
          ))}

          {/* ground volume */}
          <rect x="240" y="585" width="1440" height="275" fill="#0B0A09" />
          <rect x="660" y="618" width="600" height="242" fill="url(#nv-glass)" opacity={glass} />
          <rect x="660" y="618" width="600" height="242" fill="url(#nv-reflect)" />
          {[810, 960, 1110].map((x) => (
            <rect key={x} x={x} y="618" width="4" height="242" fill="#0B0A09" />
          ))}
          {piers.map((x) => (
            <rect key={x} x={x} y="585" width="64" height="275" fill={stone} />
          ))}

          {/* in-ground uplights grazing the piers and the upper wall */}
          <g style={{mixBlendMode: 'screen'}}>
            {piers.map((x, i) => (
              <g key={x} opacity={on(fps * (0.2 + i * 0.12))}>
                <rect x={x} y="585" width="64" height="275" fill="url(#nv-graze)" />
                <rect x={x - 58} y="540" width="180" height="320" fill="url(#nv-scallop)" />
              </g>
            ))}
            {upperGrazers.map((x, i) => (
              <rect key={x} x={x - 60} y="352" width="120" height="214" fill="url(#nv-scallop)" opacity={0.7 * on(fps * (0.6 + i * 0.12))} />
            ))}
          </g>

          {/* roof slabs with linear LED coves underneath, drawn on from the centre */}
          {slabs.map(({x, y, w}) => (
            <g key={y}>
              <rect x={x} y={y} width={w} height="19" fill="#191715" />
              <rect x={x + 20} y={y + 19} width={w - 40} height="110" fill="url(#nv-cove)" opacity={cove} />
              <g style={{transformOrigin: `${x + w / 2}px ${y}px`, transform: `scaleX(${cove})`}}>
                <rect x={x + 20} y={y + 18} width={w - 40} height="3" fill={accent} filter="url(#nv-blur)" />
                <rect x={x + 20} y={y + 19} width={w - 40} height="1.5" fill="#FFF3E0" />
              </g>
            </g>
          ))}
        </g>
        {/* polished paving: a soft mirror of the facade below the ground line */}
        <g mask="url(#nv-reflection-mask)">
          <use href="#nv-villa" transform="translate(0 1540) scale(1 -1)" filter="url(#nv-soft)" />
        </g>
        <rect x="-2000" y="770" width="5920" height="2" fill={tint(accent, 0.25 * cove)} />
      </svg>
    </AbsoluteFill>
  );
};
