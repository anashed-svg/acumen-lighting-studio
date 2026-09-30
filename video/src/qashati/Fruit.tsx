import React from 'react';
import {C} from './brand';

export type FruitKind = 'strawberry' | 'kiwi' | 'mango' | 'banana' | 'blueberry';
export const FRUITS: FruitKind[] = ['strawberry', 'kiwi', 'mango', 'banana', 'strawberry', 'blueberry', 'mango', 'kiwi'];

// Flat, glossy fruit pieces drawn around (0,0) at size s (px). Gradients are shared via <FruitDefs/>.
export const FruitDefs: React.FC = () => (
  <defs>
    <radialGradient id="q-straw" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#FF7A8A" />
      <stop offset="0.55" stopColor={C.strawberry} />
      <stop offset="1" stopColor="#B81E35" />
    </radialGradient>
    <radialGradient id="q-kiwi" cx="50%" cy="50%" r="55%">
      <stop offset="0" stopColor="#F4FBD5" />
      <stop offset="0.3" stopColor="#B7E07A" />
      <stop offset="0.85" stopColor={C.kiwi} />
      <stop offset="1" stopColor={C.kiwiDark} />
    </radialGradient>
    <linearGradient id="q-mango" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFD166" />
      <stop offset="0.6" stopColor={C.mango} />
      <stop offset="1" stopColor="#E07A00" />
    </linearGradient>
    <radialGradient id="q-banana" cx="45%" cy="40%" r="60%">
      <stop offset="0" stopColor="#FFFBEA" />
      <stop offset="1" stopColor={C.banana} />
    </radialGradient>
    <radialGradient id="q-blue" cx="35%" cy="30%" r="70%">
      <stop offset="0" stopColor="#8C7FD6" />
      <stop offset="0.6" stopColor={C.blueberry} />
      <stop offset="1" stopColor="#241C55" />
    </radialGradient>
  </defs>
);

export const Fruit: React.FC<{kind: FruitKind; s: number}> = ({kind, s}) => {
  const r = s / 2;
  switch (kind) {
    case 'strawberry':
      return (
        <g>
          <path
            d={`M0 ${r} C ${-r * 1.15} ${r * 0.2}, ${-r * 0.95} ${-r * 0.95}, 0 ${-r * 0.7} C ${r * 0.95} ${-r * 0.95}, ${r * 1.15} ${r * 0.2}, 0 ${r} Z`}
            fill="url(#q-straw)"
          />
          <path
            d={`M0 ${r * 0.55} C ${-r * 0.5} ${r * 0.1}, ${-r * 0.45} ${-r * 0.45}, 0 ${-r * 0.3} C ${r * 0.45} ${-r * 0.45}, ${r * 0.5} ${r * 0.1}, 0 ${r * 0.55} Z`}
            fill="#FFC2CB"
            opacity={0.55}
          />
          {[
            [-0.45, -0.25],
            [0.42, -0.2],
            [-0.3, 0.25],
            [0.28, 0.3],
            [0, -0.5],
            [0.02, 0.05],
          ].map(([x, y], i) => (
            <ellipse key={i} cx={x * r} cy={y * r} rx={r * 0.05} ry={r * 0.08} fill="#FFE59A" />
          ))}
        </g>
      );
    case 'kiwi':
      return (
        <g>
          <circle r={r} fill="#6B4E2E" />
          <circle r={r * 0.9} fill="url(#q-kiwi)" />
          {Array.from({length: 12}, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <ellipse key={i} cx={Math.cos(a) * r * 0.45} cy={Math.sin(a) * r * 0.45} rx={r * 0.05} ry={r * 0.1} transform={`rotate(${(a * 180) / Math.PI + 90} ${Math.cos(a) * r * 0.45} ${Math.sin(a) * r * 0.45})`} fill="#1E2A10" />;
          })}
        </g>
      );
    case 'mango':
      return (
        <g>
          <rect x={-r} y={-r} width={s} height={s} rx={r * 0.35} fill="url(#q-mango)" />
          <rect x={-r * 0.7} y={-r * 0.75} width={s * 0.45} height={s * 0.18} rx={r * 0.1} fill="#FFF3C4" opacity={0.6} />
        </g>
      );
    case 'banana':
      return (
        <g>
          <circle r={r} fill="#F2D675" />
          <circle r={r * 0.88} fill="url(#q-banana)" />
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} cx={Math.cos(a) * r * 0.22} cy={Math.sin(a) * r * 0.22} r={r * 0.07} fill="#B89A4A" opacity={0.7} />;
          })}
        </g>
      );
    case 'blueberry':
      return (
        <g>
          <circle r={r * 0.62} fill="url(#q-blue)" />
          <circle cx={-r * 0.2} cy={-r * 0.22} r={r * 0.12} fill="#FFFFFF" opacity={0.45} />
        </g>
      );
  }
};
