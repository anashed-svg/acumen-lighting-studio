// Test composition for the phone story: PhoneStory, then CreamReveal over a turquoise placeholder.
import React from 'react';
import {AbsoluteFill, Composition, Sequence} from 'remotion';
import {COLORS, FPS, H, T, W} from '../spec';
import {CreamReveal, PhoneStory} from './PhoneStory';

const PhoneStoryTest: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <Sequence durationInFrames={T.cupShot}>
      <PhoneStory />
    </Sequence>
    <Sequence from={T.cupShot}>
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
      <CreamReveal />
    </Sequence>
  </AbsoluteFill>
);

export const PhoneStoryTestRoot: React.FC = () => (
  <Composition id="PhoneStoryTest" component={PhoneStoryTest} durationInFrames={T.cupShot + 20} fps={FPS} width={W} height={H} />
);
