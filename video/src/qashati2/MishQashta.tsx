import {loadFont} from '@remotion/fonts';
import React from 'react';
import {AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AnimatedLogo} from '../qashati/Logo';
import {CreamReveal, PhoneStory} from './phone/PhoneStory';
import {COLORS, COPY, FONTS, H, T, W} from './spec';

loadFont({family: FONTS.display, url: staticFile('qashati2/fonts/BalooBhaijaan2-800.ttf'), weight: '800'});
loadFont({family: FONTS.ui, url: staticFile('qashati2/fonts/IBMPlexSansArabic-600.ttf'), weight: '600'});
loadFont({family: FONTS.latin, url: staticFile('qashati2/fonts/Poppins-500.ttf'), weight: '500'});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// «خلّيها قشطة.» — lands over the hero shot (word by word, never letter by letter).
const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = COPY.title.split(' ');
  return (
    <div style={{position: 'absolute', top: 250, width: W, display: 'flex', justifyContent: 'center', gap: 28, direction: 'rtl'}}>
      {words.map((w, i) => {
        const s = spring({frame: frame - i * 5, fps, config: {damping: 11, stiffness: 170}});
        return (
          <span
            key={i}
            style={{
              fontFamily: FONTS.display,
              fontWeight: 800,
              fontSize: 150,
              lineHeight: 1.1,
              color: COLORS.teal,
              opacity: Math.min(1, s * 1.4),
              transform: `translateY(${(1 - s) * 60}px) scale(${0.85 + 0.15 * s})`,
              textShadow: '0 6px 0 rgba(255,255,255,0.45)',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// End card: turquoise, white logo (its dots drop in), tagline, and the CTA slams in like a stamp (callback to Act 1).
const EndCard: React.FC = () => {
  const frame = useCurrentFrame(); // local, starts at T.endCard
  const {fps} = useVideoConfig();
  const wipe = interpolate(frame, [0, 12], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const tag = interpolate(frame, [T.logoDots[1] - T.endCard + 12, T.logoDots[1] - T.endCard + 26], [0, 1], clamp);
  const cta = spring({frame: frame - (T.cta - T.endCard), fps, config: {damping: 9, stiffness: 220, mass: 0.8}});
  const sub = interpolate(frame, [T.cta - T.endCard + 10, T.cta - T.endCard + 22], [0, 1], clamp);
  const sonic = interpolate(frame, [T.sonicLogo - T.endCard, T.sonicLogo - T.endCard + 4, T.sonicLogo - T.endCard + 12], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{clipPath: `circle(${wipe * 130}% at 50% 55%)`, background: `radial-gradient(ellipse 80% 55% at 50% 42%, #5FF4E8 0%, ${COLORS.turquoise} 50%, ${COLORS.turquoiseDeep} 100%)`}}>
      <div style={{position: 'absolute', top: 300, width: W, display: 'flex', justifyContent: 'center', transform: `scale(${1 + sonic * 0.03})`}}>
        <AnimatedLogo start={T.logoDots[0] - T.endCard - 8} width={480} color="#FFFFFF" />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 975,
          width: W,
          textAlign: 'center',
          fontFamily: FONTS.latin,
          fontWeight: 500,
          fontSize: 36,
          letterSpacing: '0.32em',
          paddingLeft: '0.32em',
          textTransform: 'uppercase',
          color: COLORS.teal,
          opacity: tag,
        }}
      >
        {COPY.tagline}
      </div>
      <div style={{position: 'absolute', top: 1095, width: W, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            direction: 'rtl',
            fontFamily: FONTS.display,
            fontWeight: 800,
            fontSize: 60,
            lineHeight: 1.3,
            color: '#FFFFFF',
            background: COLORS.teal,
            borderRadius: 999,
            padding: '16px 56px 22px',
            opacity: cta > 0.02 ? 1 : 0,
            transform: `scale(${1.8 - 0.8 * cta}) rotate(${-4 * cta}deg)`,
            boxShadow: `0 ${16 * cta}px 40px ${COLORS.teal}55`,
          }}
        >
          {COPY.cta}
        </div>
      </div>
      <div style={{position: 'absolute', top: 1250, width: W, textAlign: 'center', direction: 'rtl', fontFamily: FONTS.ui, fontWeight: 600, fontSize: 40, color: COLORS.teal, opacity: 0.85 * sub}}>
        {COPY.ctaSub}
      </div>
    </AbsoluteFill>
  );
};

export const MishQashta: React.FC<{music: string}> = ({music}) => {
  const {width} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.cream, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${width / W})`, transformOrigin: '0 0'}}>
        <Sequence from={0} durationInFrames={T.cupShot} layout="none">
          <PhoneStory />
        </Sequence>
        <Sequence from={T.cupShot} durationInFrames={T.endCard - T.cupShot}>
          <OffthreadVideo src={staticFile('qashati2/cup-shot.mp4')} muted style={{width: W, height: H}} />
        </Sequence>
        {/* Hold the last hero frame underneath the end-card wipe. */}
        <Sequence from={T.endCard} durationInFrames={16}>
          <Freeze frame={T.endCard - T.cupShot - 1}>
            <OffthreadVideo src={staticFile('qashati2/cup-shot.mp4')} muted style={{width: W, height: H}} />
          </Freeze>
        </Sequence>
        <Sequence from={T.title} durationInFrames={T.endCard - T.title + 14}>
          <Title />
        </Sequence>
        <Sequence from={T.cupShot} durationInFrames={20}>
          <CreamReveal />
        </Sequence>
        <Sequence from={T.endCard}>
          <EndCard />
        </Sequence>
      </div>
      {music ? <Audio src={staticFile(music)} /> : null}
    </AbsoluteFill>
  );
};
