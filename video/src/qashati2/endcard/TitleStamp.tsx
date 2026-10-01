// «خلّيها قشطة.» — the platform line lands as the last and biggest rubber stamp (callback to Act 1):
// double rounded border, Lalezar, teal ink with texture, slight clockwise tilt, slam with overshoot and a
// burst of ink specks. It stays put through the end card — like the Act-1 stamps, it is ink on the glass
// and the world changes underneath it. The whole line is one text run (never animated per letter).
import React from 'react';
import {random} from 'remotion';
import {COLORS, COPY, T} from '../spec';
import {STAMP_FONT} from './fonts';
import {TITLE, titlePose} from './layout';

const INK = COLORS.teal;
const N_SPECKS = 16;

export const TitleStamp: React.FC<{frame: number}> = ({frame}) => {
  const k = frame - T.title;
  if (k < -2) return null;
  const approach = k < 0;
  const scale = approach ? (k === -2 ? 1.42 : 1.14) : 1 - 0.085 * Math.cos(k * 1.2) * Math.exp(-k * 0.5);
  const opacity = approach ? (k === -2 ? 0.4 : 0.82) : 1;
  const rot = TITLE.rot + (approach ? -2.5 : -3.2 * Math.exp(-k * 0.55) * Math.cos(k * 0.9));
  const wet = k === 0 ? 3.5 : k === 1 ? 1.5 : 0; // heavy wet ink on the impact frame
  const pose = titlePose(frame);
  const cy = pose.cy;
  const s = scale * pose.s;

  // ink specks flung from the edge on impact; they stay on the glass (fewer and finer than Act 1: premium)
  const specks =
    k >= 0
      ? Array.from({length: N_SPECKS}).map((_, j) => {
          // specks fly sideways and up only: nothing lands in the product/logo row below (no stray "third dot"
          // next to the logo's two dots)
          const a0 = random(`q2e-sa${j}`) * Math.PI * 2;
          const a = Math.sin(a0) > 0.2 ? -a0 : a0;
          const t = Math.min(1, (k + 1) / 3);
          const fling = 12 + random(`q2e-sf${j}`) * 52;
          return {
            left: 50 + 51 * Math.cos(a),
            top: 50 + 54 * Math.sin(a),
            dx: Math.cos(a) * fling * t,
            dy: Math.sin(a) * fling * t * 0.7,
            r: 2.5 + random(`q2e-sr${j}`) * 6.5,
          };
        })
      : [];

  return (
    <div
      style={{
        position: 'absolute',
        left: TITLE.cx,
        top: cy,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})`,
        opacity,
        filter: approach ? 'url(#q2e-blur2)' : undefined,
      }}
    >
      {approach ? (
        <div style={{position: 'absolute', inset: 0, transform: 'translate(22px, 40px)', borderRadius: 40, background: 'rgba(3,43,40,0.16)', filter: 'blur(16px)'}} />
      ) : null}
      <div style={{position: 'relative', filter: 'url(#q2e-ink-title)', padding: 14}}>
        <div style={{border: `${13 + wet}px solid ${INK}`, borderRadius: 38, padding: 11}}>
          <div
            style={{
              border: `${5 + wet * 0.5}px solid ${INK}`,
              borderRadius: 22,
              padding: '0px 44px 8px',
              direction: 'rtl',
              whiteSpace: 'nowrap',
              fontFamily: STAMP_FONT,
              fontSize: TITLE.fontSize,
              lineHeight: 1.16,
              color: INK,
              WebkitTextStroke: wet ? `${wet}px ${INK}` : undefined,
            }}
          >
            {COPY.title}
          </div>
        </div>
        {specks.map((s, j) => (
          <div
            key={j}
            style={{
              position: 'absolute',
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.r * 2,
              height: s.r * 2,
              marginLeft: -s.r,
              marginTop: -s.r,
              borderRadius: '50%',
              background: INK,
              transform: `translate(${s.dx}px, ${s.dy}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
