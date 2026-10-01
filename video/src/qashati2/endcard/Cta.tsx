// The ask: a negative rubber stamp (teal plate, copy knocked out in turquoise, double border) slams in
// like the Act-1 stamps, then how/where in plain readable lines, then the comment prompt as a comment bubble.
import React from 'react';
import {interpolate, spring} from 'remotion';
import {COLORS, COPY, FPS, T} from '../spec';
import {INFO_FONT, STAMP_FONT} from './fonts';
import {clamp, COMMENT, CTA, CX, E, easeOut, LOC, SUB} from './layout';

const INK = COLORS.teal;
const KNOCK = COLORS.turquoise; // "knocked out" = the card colour showing through the stamp

const Pin: React.FC<{size: number}> = ({size}) => (
  <svg width={size * 0.78} height={size} viewBox="0 0 24 31" style={{display: 'inline-block', verticalAlign: 'middle'}}>
    <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 31 12 31s12-10.6 12-19.3C24 5.2 18.6 0 12 0Z" fill={INK} />
    <circle cx={12} cy={11.5} r={4.6} fill={KNOCK} />
  </svg>
);

export const CtaStamp: React.FC<{frame: number}> = ({frame}) => {
  const k = frame - T.cta;
  if (k < -2) return null;
  const approach = k < 0;
  const scale = approach ? (k === -2 ? 1.5 : 1.16) : 1 - 0.09 * Math.cos(k * 1.25) * Math.exp(-k * 0.55);
  const opacity = approach ? (k === -2 ? 0.35 : 0.8) : 1;
  const rot = CTA.rot + (approach ? 3 : 2.6 * Math.exp(-k * 0.6) * Math.cos(k * 0.9));
  // one glint across the plate after it settles (draws the eye back to the ask)
  const g = interpolate(frame, [E.ctaGlint[0], E.ctaGlint[0] + 16], [0, 1], clamp);
  const g2 = interpolate(frame, [E.ctaGlint[1], E.ctaGlint[1] + 16], [0, 1], clamp);
  const glint = (p: number) =>
    p <= 0 || p >= 1
      ? null
      : `linear-gradient(105deg, rgba(255,255,255,0) ${p * 140 - 30}%, rgba(255,255,255,0.28) ${p * 140 - 18}%, rgba(255,255,255,0) ${p * 140 - 6}%)`;
  const glintBg = glint(g) ?? glint(g2);
  return (
    <div
      style={{
        position: 'absolute',
        left: CTA.cx,
        top: CTA.cy,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
        opacity,
        filter: approach ? 'url(#q2e-blur2)' : undefined,
      }}
    >
      {approach ? <div style={{position: 'absolute', inset: 10, transform: 'translate(18px, 30px)', borderRadius: 30, background: 'rgba(3,43,40,0.2)', filter: 'blur(14px)'}} /> : null}
      <div style={{position: 'relative', filter: 'url(#q2e-ink-cta)', padding: 10}}>
        <div style={{background: INK, borderRadius: 30, padding: 10, position: 'relative', overflow: 'hidden'}}>
          <div
            style={{
              border: `4px solid ${KNOCK}`,
              borderRadius: 21,
              padding: '2px 44px 6px',
              direction: 'rtl',
              whiteSpace: 'nowrap',
              fontFamily: STAMP_FONT,
              fontSize: CTA.fontSize,
              lineHeight: 1.4,
              color: KNOCK,
            }}
          >
            {COPY.cta}
          </div>
          {glintBg ? <div style={{position: 'absolute', inset: 0, background: glintBg, mixBlendMode: 'screen'}} /> : null}
        </div>
      </div>
    </div>
  );
};

export const CtaInfo: React.FC<{frame: number}> = ({frame}) => {
  const sub = interpolate(frame, [E.sub.from, E.sub.to], [0, 1], {...clamp, easing: easeOut});
  const loc = interpolate(frame, [E.loc.from, E.loc.to], [0, 1], {...clamp, easing: easeOut});
  if (sub <= 0) return null;
  const line = (top: number, size: number, weight: number, o: number): React.CSSProperties => ({
    position: 'absolute',
    left: CX - 440,
    width: 880,
    top,
    textAlign: 'center',
    direction: 'rtl',
    whiteSpace: 'nowrap',
    fontFamily: INFO_FONT,
    fontWeight: weight,
    fontSize: size,
    lineHeight: 1.3,
    color: INK,
    opacity: o,
    transform: `translateY(${(1 - o) * 12}px)`,
  });
  return (
    <>
      <div style={line(SUB.top, SUB.fontSize, 700, sub)}>{COPY.ctaSub}</div>
      {loc > 0 ? (
        <div style={line(LOC.top, LOC.fontSize, 600, loc)}>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 12}}>
            <Pin size={LOC.fontSize * 0.86} />
            <span>{COPY.location}</span>
          </span>
        </div>
      ) : null}
    </>
  );
};

// «وإنت؟ شو مش قشطة اليوم؟ 👇» as a comment bubble; the 👇 keeps nudging down towards the comments.
export const CommentPrompt: React.FC<{frame: number}> = ({frame}) => {
  const k = frame - T.commentPrompt;
  if (k < 0) return null;
  const s = spring({frame: k, fps: FPS, config: {damping: 12, stiffness: 190, mass: 0.7}});
  const nudgeT = k - 16;
  const nudge = nudgeT > 0 ? 7 * Math.max(0, Math.sin(nudgeT * 0.3)) ** 2 : 0;
  const [text, emoji] = splitEmoji(COPY.commentPrompt);
  return (
    <div
      style={{
        position: 'absolute',
        left: COMMENT.cx,
        top: COMMENT.top,
        transform: `translateX(-50%) scale(${0.7 + 0.3 * s})`,
        transformOrigin: '50% 100%',
        opacity: Math.min(1, s * 1.6),
      }}
    >
      <div
        style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: 999,
          padding: '6px 30px 10px',
          direction: 'rtl',
          whiteSpace: 'nowrap',
          fontFamily: INFO_FONT,
          fontWeight: 600,
          fontSize: COMMENT.fontSize,
          lineHeight: 1.35,
          color: INK,
          boxShadow: '0 6px 18px rgba(3,43,40,0.14)',
        }}
      >
        {text}
        {emoji ? <span style={{display: 'inline-block', marginRight: 10, transform: `translateY(${nudge}px)`}}>{emoji}</span> : null}
      </div>
    </div>
  );
};

// "… اليوم؟ 👇" → ["… اليوم؟", "👇"] (the emoji gets its own nudge; the Arabic run stays one piece)
const splitEmoji = (s: string): [string, string] => {
  const m = s.match(/^(.*?)\s*(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}\p{Emoji_Modifier}]*)\s*$/u);
  return m ? [m[1], m[2]] : [s, ''];
};
