import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './stage';
import {Kit2DStyleFrames, STYLE_FRAMES_DURATION} from './StyleFrames';

export const Kit2DRoot: React.FC = () => (
  <>
    <Composition id="Kit2DStyleFrames" component={Kit2DStyleFrames} durationInFrames={STYLE_FRAMES_DURATION} fps={FPS} width={W} height={H} />
  </>
);
