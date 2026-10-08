// The teen's OTHER hand: a phone held from below, screen up (he types while he eats — «bas wa7de»). Top-down, same
// local space as FamilyHand (the fist sits around y ≈ 220–450, the arm runs off to +y); the phone rises from the
// fist towards −y. The screen is GENERIC: abstract message bubbles + a typing dot row (no real app UI, no logos).
// Draw <PhoneProp/> UNDER a mirrored <FamilyHand spoon={false} left/> at the same x/y/angle/scale.
import React, {useMemo} from 'react';
import {brush, C, INK, Pt, shapeD, useBoil} from '../../kit/lib';

const PW = 168;
const PH = 330;
const PY = 70; // phone centre (local y): its bottom edge disappears into the fingers

const rr = (cx: number, cy: number, w: number, h: number, r: number) =>
  `M${cx - w / 2 + r} ${cy - h / 2}H${cx + w / 2 - r}A${r} ${r} 0 0 1 ${cx + w / 2} ${cy - h / 2 + r}V${cy + h / 2 - r}A${r} ${r} 0 0 1 ${cx + w / 2 - r} ${cy + h / 2}H${cx - w / 2 + r}A${r} ${r} 0 0 1 ${cx - w / 2} ${cy + h / 2 - r}V${cy - h / 2 + r}A${r} ${r} 0 0 1 ${cx - w / 2 + r} ${cy - h / 2}Z`;

export const PhoneProp: React.FC<{x: number; y: number; angle: number; scale: number; frame: number; typing?: boolean; silhouette?: string}> = ({x, y, angle, scale, frame, typing = true, silhouette}) => {
  const g = useMemo(() => {
    const body: Pt[] = [
      [-PW / 2, PY - PH / 2 + 26], [-PW / 2 + 26, PY - PH / 2], [PW / 2 - 26, PY - PH / 2], [PW / 2, PY - PH / 2 + 26],
      [PW / 2, PY + PH / 2 - 26], [PW / 2 - 26, PY + PH / 2], [-PW / 2 + 26, PY + PH / 2], [-PW / 2, PY + PH / 2 - 26],
    ];
    return {
      ink: brush(body, {w: 6, closed: true, start: 0.2, seed: 140, shadow: 0.6, step: 4}),
      spec: brush(
        [
          [-PW / 2 + 22, PY - PH / 2 + 40],
          [-PW / 2 + 18, PY - 20],
        ],
        {w: 7, taper: [0.3, 0.5], tip: 0.05, seed: 141},
      ),
    };
  }, []);
  const b = useBoil({scale: 2.4, offset: 61, frame, freq: 0.03});
  const R = 600;
  const blink = Math.floor(frame / 4) % 3;
  return (
    <svg width={2 * R * scale} height={2 * R * scale} viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} style={{position: 'absolute', left: x - R * scale, top: y - R * scale, overflow: 'visible', pointerEvents: 'none'}}>
      <defs>{b.def}</defs>
      <g transform={`rotate(${angle})`}>
        {silhouette ? (
          <path d={rr(0, PY, PW, PH, 28)} fill={silhouette} />
        ) : (
          <g filter={b.url}>
            {/* case + screen */}
            <path d={rr(0, PY, PW, PH, 28)} fill="#2B3138" />
            <path d={rr(0, PY, PW - 18, PH - 18, 22)} fill="#0E3C45" />
            {/* a generic chat: abstract bubbles, one of them his — typing «bas wa7de» */}
            <path d={rr(-18, PY - 104, 104, 30, 13)} fill="#6FCFC5" opacity={0.9} />
            <path d={rr(20, PY - 62, 92, 30, 13)} fill="#E6F4F1" opacity={0.85} />
            <path d={rr(-10, PY - 20, 120, 30, 13)} fill="#6FCFC5" opacity={0.9} />
            <path d={rr(16, PY + 22, 98, 30, 13)} fill="#E6F4F1" opacity={0.85} />
            {/* keyboard block + typing dots */}
            <path d={rr(0, PY + 106, PW - 30, 70, 10)} fill="#1F5059" />
            {typing
              ? [0, 1, 2].map((i) => <circle key={i} cx={-18 + i * 18} cy={PY + 64} r={6} fill="#E6F4F1" opacity={i === blink ? 1 : 0.45} />)
              : null}
            <path d={g.spec} fill={C.white} opacity={0.35} />
            <path d={g.ink} fill={INK} />
            <path d={shapeD([[-16, PY - PH / 2 + 12], [16, PY - PH / 2 + 12], [16, PY - PH / 2 + 18], [-16, PY - PH / 2 + 18]], 3)} fill="#101418" />
          </g>
        )}
      </g>
    </svg>
  );
};
