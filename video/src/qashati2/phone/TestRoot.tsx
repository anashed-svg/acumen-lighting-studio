// Test composition for the phone story: PhoneStory (0 → T.cupShot), then CreamReveal over the start of the
// cup shot (public/qashati2/cup-shot.mp4 when present, else a turquoise placeholder).
import React from 'react';
import {AbsoluteFill, Composition, getStaticFiles, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {COLORS, FPS, H, T, W} from '../spec';
import {REVEAL_FRAMES} from './glass/Cream';
import {CreamReveal, PhoneStory} from './PhoneStory';

const TAIL = REVEAL_FRAMES + 10;
const CUP = 'qashati2/cup-shot.mp4';
const HAS_CUP = getStaticFiles().some((f) => f.name === CUP);

const PhoneStoryTest: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Sequence durationInFrames={T.cupShot}>
      <PhoneStory />
    </Sequence>
    <Sequence from={T.cupShot}>
      {HAS_CUP ? (
        <OffthreadVideo src={staticFile(CUP)} muted />
      ) : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 45%, #5FF4E8 0%, ${COLORS.turquoise} 40%, ${COLORS.turquoiseDeep} 100%)`,
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.teal,
            fontSize: 60,
            fontFamily: 'sans-serif',
          }}
        >
          3D cup shot placeholder
        </AbsoluteFill>
      )}
      <CreamReveal />
    </Sequence>
  </AbsoluteFill>
);

export const PhoneStoryTestRoot: React.FC = () => (
  <Composition id="PhoneStoryTest" component={PhoneStoryTest} durationInFrames={T.cupShot + TAIL} fps={FPS} width={W} height={H} />
);
