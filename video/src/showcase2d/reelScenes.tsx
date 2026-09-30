import {CameraMotionBlur} from '@remotion/motion-blur';
import {noise2D} from '@remotion/noise';
import {Circle, Rect, Triangle} from '@remotion/shapes';
import {Starburst} from '@remotion/starburst';
import {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, LATIN_FONT, easeInOut, easeOut, mix, tint, useUnit} from './brand';

export type SceneProps = Brand & {index: string; title: string; titleAr: string};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Bilingual lower third: English reads in from the left, Arabic from the right.
const Caption: React.FC<SceneProps> = ({index, title, titleAr, text, accent, arabicFont}) => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const line = interpolate(frame, [4, 28], [0, 1], {...clamp, easing: easeOut});
  const en = interpolate(frame, [8, 28], [0, 1], {...clamp, easing: easeOut});
  const ar = interpolate(frame, [12, 32], [0, 1], {...clamp, easing: easeOut});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', padding: `0 ${96 * unit}px ${84 * unit}px`}}>
      <div style={{height: 1, background: tint(text, 0.2), transform: `scaleX(${line})`, transformOrigin: 'left', marginBottom: 28 * unit}} />
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32 * unit}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 24 * unit, opacity: en, transform: `translateX(${(en - 1) * 30 * unit}px)`}}>
          <span style={{fontFamily: LATIN_FONT, fontWeight: 300, fontSize: 18 * unit, letterSpacing: '0.3em', color: accent}}>{index}</span>
          <span style={{fontFamily: LATIN_FONT, fontWeight: 300, fontSize: 40 * unit, letterSpacing: '0.42em', textTransform: 'uppercase', color: text}}>
            {title}
          </span>
        </div>
        <div
          dir="rtl"
          style={{fontFamily: arabicFont, fontWeight: 300, fontSize: 38 * unit, color: tint(text, 0.8), opacity: ar, transform: `translateX(${(1 - ar) * 30 * unit}px)`}}
        >
          {titleAr}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const headX = (frame: number, width: number) => interpolate(frame, [4, 30], [-0.05, 1.05], {...clamp, easing: easeInOut}) * width;

// Lives inside <CameraMotionBlur>, which re-renders it at sub-frame times, so it reads the frame itself.
const LightHead: React.FC<{y: number; accent: string; text: string}> = ({y, accent, text}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const unit = useUnit();
  const x = headX(frame, width);
  const w = 220 * unit;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - 20 * unit,
        width: w,
        height: 40 * unit,
        opacity: interpolate(frame, [26, 34], [1, 0], clamp),
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${text} 0%, ${accent} 18%, ${tint(accent, 0.35)} 40%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );
};

export const LinearScene: React.FC<SceneProps> = (props) => {
  const {background, text, accent} = props;
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const unit = useUnit();
  const y = height * 0.36;
  const x = Math.max(0, headX(frame, width));
  const flicker = 0.9 + 0.1 * noise2D('linear-flicker', frame / 5, 0);
  const reach = 0.5 + 0.04 * noise2D('linear-reach', frame / 30, 0);
  return (
    <AbsoluteFill style={{backgroundColor: background}}>
      <AbsoluteFill
        style={{
          top: y,
          backgroundImage: `repeating-linear-gradient(90deg, ${tint(text, 0.06)} 0 1px, rgba(0,0,0,0) 1px ${width / 9}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: x,
          height: height * reach,
          background: `linear-gradient(to bottom, ${tint(accent, 0.32 * flicker)}, ${tint(accent, 0.07)} 45%, rgba(0,0,0,0))`,
          maskImage: `linear-gradient(to right, #000 calc(100% - ${260 * unit}px), transparent)`,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, top: y - 22 * unit, height: 22 * unit, background: mix(background, text, 0.08)}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: x,
          height: 3 * unit,
          opacity: flicker,
          background: mix(text, accent, 0.35),
          boxShadow: `0 0 ${12 * unit}px ${tint(accent, 0.9)}, 0 ${8 * unit}px ${50 * unit}px ${tint(accent, 0.45)}`,
        }}
      />
      <CameraMotionBlur shutterAngle={300} samples={8}>
        <LightHead y={y} accent={accent} text={text} />
      </CameraMotionBlur>
      <Caption {...props} />
    </AbsoluteFill>
  );
};

export const WallWasherScene: React.FC<SceneProps> = (props) => {
  const {background, text, accent} = props;
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const unit = useUnit();
  const count = width > height ? 5 : 3;
  const top = height * 0.12;
  const fixtures = new Array(count).fill(0).map((_, i) => {
    const x = (width * (i + 0.5)) / count;
    const on = interpolate(frame, [4 + i * 4, 22 + i * 4], [0, 1], {...clamp, easing: easeOut});
    const breathe = 0.9 + 0.1 * noise2D(`wash-${i}`, frame / 10, 0);
    return {x, on, breathe};
  });
  const wash = fixtures
    .map(
      ({x, on, breathe}) =>
        `radial-gradient(ellipse ${(width / count) * 0.85}px ${height * 0.9 * on + 1}px at ${x}px ${top}px, ${tint(accent, 0.34 * on * breathe)} 0%, ${tint(accent, 0.1 * on)} 45%, rgba(0,0,0,0) 100%)`,
    )
    .join(', ');
  const pan = interpolate(frame, [0, 46], [0, -36 * unit]);
  return (
    <AbsoluteFill style={{backgroundColor: background, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translateX(${pan}px) scale(1.05)`}}>
        <AbsoluteFill
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${tint(text, 0.05)} 0 1px, rgba(0,0,0,0) 1px ${120 * unit}px), repeating-linear-gradient(0deg, ${tint(text, 0.035)} 0 1px, rgba(0,0,0,0) 1px ${64 * unit}px)`,
          }}
        />
        <AbsoluteFill style={{backgroundImage: wash, mixBlendMode: 'screen'}} />
        {fixtures.map(({x, on}, i) => (
          <div key={i} style={{position: 'absolute', left: x - 26 * unit, top: top - 14 * unit, width: 52 * unit}}>
            <Rect width={52 * unit} height={12 * unit} cornerRadius={3 * unit} fill={mix(background, text, 0.3)} />
            <div
              style={{
                height: 2 * unit,
                margin: `0 ${6 * unit}px`,
                background: mix(text, accent, 0.4),
                opacity: on,
                boxShadow: `0 ${4 * unit}px ${24 * unit}px ${tint(accent, 0.9 * on)}`,
              }}
            />
          </div>
        ))}
      </AbsoluteFill>
      <Caption {...props} />
    </AbsoluteFill>
  );
};

const DUST = 36;

export const UplightScene: React.FC<SceneProps> = (props) => {
  const {background, text, accent} = props;
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const unit = useUnit();
  const ground = height * 0.72;
  const columns = width > height ? [0.3, 0.5, 0.7] : [0.2, 0.5, 0.8];
  const colW = 84 * unit;
  const beamLen = height * 0.78;
  const rays = useMemo(() => [background, mix(background, accent, 0.12)], [background, accent]);
  const on = (i: number) => interpolate(frame, [4 + i * 5, 26 + i * 5], [0, 1], {...clamp, easing: easeOut});
  return (
    <AbsoluteFill style={{backgroundColor: background, overflow: 'hidden'}}>
      <Starburst
        rays={20}
        colors={rays}
        rotation={frame * 0.25}
        smoothness={1}
        vignette={0.25}
        originOffsetY={0.5 - ground / height}
        style={{opacity: 0.35 * on(1)}}
      />
      {columns.map((c, i) => {
        const x = c * width;
        const o = on(i);
        const breathe = 0.92 + 0.08 * noise2D(`up-${i}`, frame / 12, 0);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: x - colW / 2,
                top: 0,
                width: colW,
                height: ground,
                background: `linear-gradient(to top, ${tint(accent, 0.5 * o * breathe)} 0%, ${tint(accent, 0.12 * o)} ${60 * o}%, ${mix(background, text, 0.05)} ${100 * o}%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: x - beamLen / 2,
                top: ground - beamLen * 0.866,
                transform: `scaleX(0.5) scaleY(${o})`,
                transformOrigin: '50% 100%',
                maskImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.35) 45%, transparent 90%)',
                filter: `blur(${10 * unit}px)`,
                mixBlendMode: 'screen',
              }}
            >
              <Triangle length={beamLen} direction="down" fill={tint(accent, 0.28 * breathe)} />
            </div>
            <div style={{position: 'absolute', left: x - 7 * unit, top: ground - 7 * unit, filter: `drop-shadow(0 0 ${14 * unit}px ${accent})`, opacity: 0.3 + 0.7 * o}}>
              <Circle radius={7 * unit} fill={mix(text, accent, 0.3)} />
            </div>
          </div>
        );
      })}
      {new Array(DUST).fill(0).map((_, i) => {
        const c = columns[i % columns.length] * width;
        const rise = (i * 0.137 + frame / 140) % 1;
        const x = c + noise2D('dust', i, frame / 45) * (30 + rise * 160) * unit;
        const y = ground - 20 * unit - rise * height * 0.6;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: (1.5 + (i % 3)) * unit,
              height: (1.5 + (i % 3)) * unit,
              borderRadius: '50%',
              background: mix(text, accent, 0.5),
              opacity: 0.55 * on(i % 3) * Math.sin(Math.PI * rise),
            }}
          />
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: ground, height: 1, background: tint(text, 0.14)}} />
      <AbsoluteFill style={{top: ground + 1, background: `linear-gradient(to bottom, ${mix(background, accent, 0.05)}, ${background} 60%)`}} />
      <Caption {...props} />
    </AbsoluteFill>
  );
};
