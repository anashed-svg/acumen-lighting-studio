import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, CUP, T, rnd} from './brand';

// Menu variants of the qashta cup. Only the product names appear in the video (as text),
// never third-party logos or packaging.
export const TOPPINGS = [
  {id: 'kinder', ar: 'كيندر', en: 'Kinder'},
  {id: 'raffaello', ar: 'رافاييللو', en: 'Raffaello'},
  {id: 'nutella', ar: 'نوتيلا', en: 'Nutella'},
  {id: 'maltesers', ar: 'مالتيزرز', en: 'Maltesers'},
] as const;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const {cx} = CUP;

type Props = {domeY: (x: number) => number; domeHalf: number};

// One element dropping onto the dome, popping out when the next topping arrives.
const Drop: React.FC<{start: number; end: number; i: number; x: number; y: number; rot?: number; children: React.ReactNode}> = ({
  start,
  end,
  i,
  x,
  y,
  rot = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const land = start + 6 + i * 2;
  if (frame < land - 8 || frame > end + 6) return null;
  const t = interpolate(frame, [land - 8, land], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const sq = interpolate(frame - land, [0, 3, 7], [0.75, 1.08, 1], clamp);
  const out = interpolate(frame, [end, end + 6], [1, 0], clamp);
  const s = frame >= land ? sq : 1;
  return (
    <g transform={`translate(${x} ${y - (1 - t) * 520 - (1 - out) * 80}) rotate(${rot}) scale(${(2 - s) * out * 1.4} ${s * out * 1.4})`}>{children}</g>
  );
};

const Drizzle: React.FC<{d: string; color: string; shine: string; width: number; draw: number}> = ({d, color, shine, width, draw}) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
    <path
      d={d}
      fill="none"
      stroke={shine}
      strokeWidth={width * 0.28}
      strokeLinecap="round"
      transform="translate(-2 -3)"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - draw}
      opacity={0.7}
    />
  </g>
);

export const Toppings: React.FC<Props> = ({domeY, domeHalf}) => {
  const frame = useCurrentFrame();
  const spots = (n: number, key: string, spread = 0.75) =>
    Array.from({length: n}, (_, i) => {
      const x = cx + (i / (n - 1) - 0.5) * 2 * domeHalf * spread + rnd(`${key}${i}`, -12, 12);
      return {x, y: domeY(x) - rnd(`${key}y${i}`, 6, 22), rot: rnd(`${key}r${i}`, -35, 35)};
    });
  const zigzag = (key: string, amp: number) => {
    const n = 7;
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = cx - domeHalf * 0.75 + (i / (n - 1)) * domeHalf * 1.5;
      const y = domeY(x) + (i % 2 ? amp : -4) + rnd(`${key}${i}`, -4, 4);
      d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
    }
    return d;
  };

  return (
    <g>
      {TOPPINGS.map((top, k) => {
        const start = T.swaps[k];
        const end = T.swaps[k + 1] ?? T.wipe + 30;
        if (frame < start || frame > end + 8) return null;
        const draw = interpolate(frame, [start + 4, start + 20], [0, 1], clamp);
        const fade = interpolate(frame, [end, end + 6], [1, 0], clamp);
        switch (top.id) {
          case 'kinder':
            return (
              <g key={top.id}>
                <g opacity={fade}>
                  <Drizzle d={zigzag('kz', 26)} color={C.chocolate} shine={C.chocolateLight} width={13} draw={draw} />
                </g>
                {spots(4, 'kb', 0.62).map((p, i) => (
                  <Drop key={i} start={start} end={end} i={i} x={p.x} y={p.y - 18} rot={p.rot}>
                    <rect x={-34} y={-16} width={68} height={32} rx={6} fill={C.chocolate} />
                    <rect x={-30} y={-6} width={60} height={12} rx={3} fill="#FFF6E6" />
                    <rect x={-30} y={-13} width={60} height={4} rx={2} fill={C.chocolateLight} opacity={0.8} />
                  </Drop>
                ))}
              </g>
            );
          case 'raffaello':
            return (
              <g key={top.id}>
                {spots(5, 'rb', 0.7).map((p, i) => (
                  <Drop key={i} start={start} end={end} i={i} x={p.x} y={p.y - 20}>
                    <circle r={26} fill="#FFFDF5" />
                    <circle r={26} fill="none" stroke="#E9DFC9" strokeWidth={3} />
                    {Array.from({length: 9}, (_, j) => (
                      <circle key={j} cx={rnd(`rs${i}${j}`, -18, 18)} cy={rnd(`rsy${i}${j}`, -18, 18)} r={2.4} fill="#E4D7BD" />
                    ))}
                    <circle cx={-8} cy={-9} r={7} fill="#FFFFFF" />
                  </Drop>
                ))}
              </g>
            );
          case 'nutella':
            return (
              <g key={top.id}>
                <g opacity={fade}>
                  <Drizzle
                    d={`M${cx - domeHalf * 0.7} ${domeY(cx - domeHalf * 0.7)} Q ${cx - 60} ${domeY(cx) - 60} ${cx} ${domeY(cx) - 10} T ${cx + domeHalf * 0.7} ${domeY(cx + domeHalf * 0.7)}`}
                    color="#5A2E17"
                    shine="#A0613A"
                    width={30}
                    draw={draw}
                  />
                </g>
                {spots(5, 'nh', 0.68).map((p, i) => (
                  <Drop key={i} start={start} end={end} i={i} x={p.x} y={p.y - 14} rot={p.rot}>
                    <ellipse rx={15} ry={12} fill="#9A5B2E" />
                    <ellipse cx={-4} cy={-4} rx={5} ry={3} fill="#D59A63" />
                  </Drop>
                ))}
              </g>
            );
          case 'maltesers':
            return (
              <g key={top.id}>
                {spots(6, 'mb', 0.74).map((p, i) => (
                  <Drop key={i} start={start} end={end} i={i} x={p.x} y={p.y - 18}>
                    <circle r={24} fill="#6B3A21" />
                    <circle r={24} fill="url(#q-malt)" />
                    <ellipse cx={-8} cy={-9} rx={8} ry={5} fill="#FFFFFF" opacity={0.35} />
                  </Drop>
                ))}
                <defs>
                  <radialGradient id="q-malt" cx="35%" cy="30%" r="75%">
                    <stop offset="0" stopColor="#A86A43" />
                    <stop offset="1" stopColor="#3E1E0E" stopOpacity={0.9} />
                  </radialGradient>
                </defs>
              </g>
            );
        }
      })}
    </g>
  );
};
