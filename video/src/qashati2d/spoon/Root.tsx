// Compositions of the «ملعقة وحدة بس» spot. Render (no audio yet):
//   nice -n 10 npx remotion render src/qashati2d/spoon/index.ts OneSpoon out/qashati2d/spoon/render.mp4 --props='{"music":null}'
import React from 'react';
import {Composition} from 'remotion';
import {OneSpoon} from './OneSpoon';
import {DURATION, FPS, H, W} from './spec';

export const OneSpoonRoot: React.FC = () => (
  <Composition
    id="OneSpoon"
    component={OneSpoon}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{music: 'qashati2d/audio/spoon.mp3' as string | null}}
  />
);
