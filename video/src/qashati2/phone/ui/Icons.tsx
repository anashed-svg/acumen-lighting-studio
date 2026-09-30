// Generic, hand-drawn UI glyphs (no platform icon sets) — all stroke/fill currentColor.
import React from 'react';

type P = {size?: number; color?: string; style?: React.CSSProperties};

const Svg: React.FC<P & {vb?: string; children: React.ReactNode}> = ({size = 48, color = 'currentColor', style, vb = '0 0 24 24', children}) => (
  <svg width={size} height={size} viewBox={vb} style={{display: 'block', color, ...style}} fill="none">
    {children}
  </svg>
);

export const SignalIcon: React.FC<P & {bars?: number}> = ({bars = 4, ...p}) => (
  <Svg {...p} vb="0 0 26 18">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={i * 7} y={14 - i * 4} width={5} height={4 + i * 4} rx={1.3} fill="currentColor" opacity={i < bars ? 1 : 0.3} />
    ))}
  </Svg>
);

export const WifiIcon: React.FC<P> = (p) => (
  <Svg {...p} vb="0 0 24 18">
    <path d="M12 16.6 L9.3 13.6 A4 4 0 0 1 14.7 13.6 Z" fill="currentColor" />
    <path d="M5.9 10.3 A8.8 8.8 0 0 1 18.1 10.3" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M2.3 6.6 A13.8 13.8 0 0 1 21.7 6.6" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export const BatteryIcon: React.FC<P & {level: number; fill?: string}> = ({level, fill, size = 64, color = 'currentColor', style}) => (
  <svg width={size} height={size * 0.5} viewBox="0 0 30 15" style={{display: 'block', color, ...style}}>
    <rect x={3.5} y={0.8} width={25.7} height={13.4} rx={4} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.3} />
    <rect x={5.5} y={2.8} width={Math.max(1.5, 21.7 * (level / 100))} height={9.4} rx={2.2} fill={fill ?? 'currentColor'} transform={`translate(${21.7 * (1 - level / 100)} 0)`} />
    <path d="M0.6 5 Q0.6 4.2 1.4 4.2 L2.2 4.2 L2.2 10.8 L1.4 10.8 Q0.6 10.8 0.6 10 Z" fill="currentColor" opacity={0.45} />
  </svg>
);

export const LocationArrow: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M20.5 3.5 L3.8 10.6 L11 12.9 L13.3 20.2 Z" fill="currentColor" />
  </Svg>
);

// RTL "back" chevron points right.
export const BackChevron: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M8.5 3.5 L17 12 L8.5 20.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const VideoIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x={2} y={6} width={14} height={12} rx={3} stroke="currentColor" strokeWidth={2} />
    <path d="M16 10.5 L22 7 L22 17 L16 13.5 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
  </Svg>
);

export const PhoneIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path
      d="M6.6 3.2 L9.2 3 L10.8 7.6 L8.6 9.3 C9.7 11.7 12.3 14.3 14.7 15.4 L16.4 13.2 L21 14.8 L20.8 17.4 C20.6 19.4 18.9 20.9 16.9 20.7 C9.6 19.9 4.1 14.4 3.3 7.1 C3.1 5.1 4.6 3.4 6.6 3.2 Z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlusIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 4 V20 M4 12 H20" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export const CameraIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M3 8.5 Q3 6.5 5 6.5 L7.5 6.5 L9 4.5 L15 4.5 L16.5 6.5 L19 6.5 Q21 6.5 21 8.5 L21 17.5 Q21 19.5 19 19.5 L5 19.5 Q3 19.5 3 17.5 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    <circle cx={12} cy={12.8} r={3.6} stroke="currentColor" strokeWidth={2} />
  </Svg>
);

export const MicIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x={8.5} y={2.5} width={7} height={12.5} rx={3.5} stroke="currentColor" strokeWidth={2} />
    <path d="M5 11.5 A7 7 0 0 0 19 11.5 M12 18.5 V21.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const StickerIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M20.5 12.5 A8.5 8.5 0 1 1 11.5 3.5 L20.5 12.5 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    <path d="M11.5 3.5 Q11.5 12.5 20.5 12.5" stroke="currentColor" strokeWidth={2} />
    <circle cx={8.8} cy={11} r={1.2} fill="currentColor" />
    <path d="M8 15.6 Q10.5 17.8 13.4 16" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const SearchIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx={10.5} cy={10.5} r={6.5} stroke="currentColor" strokeWidth={2.4} />
    <path d="M15.5 15.5 L20.5 20.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
  </Svg>
);

export const DotsIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    {[6, 12, 18].map((y) => (
      <circle key={y} cx={12} cy={y} r={2} fill="currentColor" />
    ))}
  </Svg>
);

export const SwapIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M8 4 V19 M8 19 L4.5 15.5 M8 19 L11.5 15.5 M16 20 V5 M16 5 L12.5 8.5 M16 5 L19.5 8.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const LayersIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3 L21 8 L12 13 L3 8 Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    <path d="M3 12.5 L12 17.5 L21 12.5 M3 16.5 L12 21.5 L21 16.5" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
  </Svg>
);

export const RecenterIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx={12} cy={12} r={6.5} stroke="currentColor" strokeWidth={2} />
    <circle cx={12} cy={12} r={2.6} fill="currentColor" />
    <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const WarningIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3 L22 20.5 L2 20.5 Z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth={1.5} />
    <path d="M12 9.5 V14.5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={12} cy={17.6} r={1.25} fill="#fff" />
  </Svg>
);

export const CarIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M4 16 V12 L6 6.5 Q6.4 5.5 7.5 5.5 L16.5 5.5 Q17.6 5.5 18 6.5 L20 12 V16 Z" fill="currentColor" />
    <rect x={5} y={15} width={3.4} height={4} rx={1.2} fill="currentColor" />
    <rect x={15.6} y={15} width={3.4} height={4} rx={1.2} fill="currentColor" />
    <circle cx={7.4} cy={12.4} r={1.3} fill="#fff" />
    <circle cx={16.6} cy={12.4} r={1.3} fill="#fff" />
    <path d="M7.2 10 L8.2 7.4 L15.8 7.4 L16.8 10 Z" fill="#fff" opacity={0.6} />
  </Svg>
);

export const Ticks: React.FC<{color?: string; size?: number}> = ({color = '#6FC3FF', size = 34}) => (
  <svg width={size * 1.45} height={size} viewBox="0 0 29 20" style={{display: 'block'}}>
    <path d="M1.5 10.5 L6.8 15.8 L17 4.5" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.5 15.8 L12.2 16.4 L27 4.5" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FlashlightIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M7 2.5 H17 V6 L14.5 10 V21.5 H9.5 V10 L7 6 Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M12 13 V16" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const GlobeIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} />
    <ellipse cx={12} cy={12} rx={4} ry={9} stroke="currentColor" strokeWidth={1.8} />
    <path d="M3 12 H21 M4.5 7 H19.5 M4.5 17 H19.5" stroke="currentColor" strokeWidth={1.6} />
  </Svg>
);

export const DeleteKeyIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M8 5 H20 Q21.5 5 21.5 6.5 V17.5 Q21.5 19 20 19 H8 L2.5 12 Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M11 9 L17 15 M17 9 L11 15" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const ShiftIcon: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 L20.5 12.5 H15.5 V20 H8.5 V12.5 H3.5 Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

export const ChevronDown: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M5 9 L12 16 L19 9" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const PinIcon: React.FC<{size?: number; color?: string}> = ({size = 80, color = '#E5392F'}) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 24 31" style={{display: 'block', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))'}}>
    <path d="M12 30 C12 30 2 18.5 2 11.5 A10 10 0 0 1 22 11.5 C22 18.5 12 30 12 30 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />
    <circle cx={12} cy={11.5} r={4} fill="#fff" />
  </svg>
);

export const HomeGlyph: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M3.5 11 L12 3.8 L20.5 11 V20.5 H14.5 V14.5 H9.5 V20.5 H3.5 Z" fill="currentColor" />
  </Svg>
);
