// «مش قشطة» — assembly (v2). Timeline and copy come from spec.ts only.
//   0 → T.cupShot          PhoneStory (Acts 1–2, incl. the cream flood)
//   T.cupShot → T.endCard  cup-shot.mp4 (3D hero shot, 120 frames) with CreamReveal sliding off on top
//   T.title → end          «خلّيها قشطة.» slams as the last, biggest stamp and stays on the glass
//   T.endCard → end        end card: the frozen last cup frame shrinks into the packshot, logo, CTA, prompt
import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, random, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CUP_SHOT, EndCard, InkDefs, morphStyle, TitleStamp} from './endcard';
import {CreamReveal, PhoneStory} from './phone/PhoneStory';
import {COLORS, H, T, W} from './spec';

// The title stamp hits the "glass": the shot underneath takes a short, decaying knock.
const knockAt = (frame: number) => {
  const k = frame - T.title;
  if (k < 0 || k > 9) return {x: 0, y: 0, s: 1};
  const a = 9 * Math.exp(-k * 0.45);
  const y = a * (random(`q2-ky${k}`) * 2 - 1) + (k === 0 ? 6 : 0);
  return {x: a * (random(`q2-kx${k}`) * 2 - 1), y, s: 1 + (2.4 * (a + Math.abs(y))) / W}; // scale covers the edges
};

export const MishQashta: React.FC<{music: string}> = ({music}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const knock = knockAt(frame);
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.turquoise, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden', transform: `scale(${width / W})`, transformOrigin: '0 0'}}>
        <InkDefs />
        <Sequence from={0} durationInFrames={T.cupShot} layout="none">
          <PhoneStory />
        </Sequence>
        <Sequence from={T.cupShot} durationInFrames={T.endCard - T.cupShot}>
          <AbsoluteFill style={morphStyle(frame)}>
            <AbsoluteFill style={{transform: `translate(${knock.x}px, ${knock.y}px) scale(${knock.s})`}}>
              <OffthreadVideo src={staticFile(CUP_SHOT)} muted style={{width: W, height: H}} />
            </AbsoluteFill>
          </AbsoluteFill>
        </Sequence>
        {/* CreamReveal returns null once the sheet has slid off (REVEAL_FRAMES) */}
        <Sequence from={T.cupShot} durationInFrames={30}>
          <CreamReveal />
        </Sequence>
        <EndCard frame={frame} />
        <TitleStamp frame={frame} />
      </div>
      {music ? <Audio src={staticFile(music)} /> : null}
    </AbsoluteFill>
  );
};
