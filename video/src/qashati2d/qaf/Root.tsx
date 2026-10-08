import React from 'react';
import {Composition} from 'remotion';
import {QafDifference, QafDifferenceProps} from './QafDifference';
import {QafLab} from './parts/Lab';
import {DURATION, FPS, H, W} from './spec';

// «الفرق بالـ ق» — 12.5 s, 1080×1920, 30 fps. `audio` = the mixed spot sound in public/ (made by
// qaf/audio/make_sound.py → public/qashati2d/audio/qaf.mp3); render with --props='{"audio":null}' until it exists.
// QafLab = the spot's drawing sheet (hand poses, spoon faces) for development only.
export const QafRoot: React.FC = () => (
  <>
    <Composition
      id="QafDifference"
      component={QafDifference}
      durationInFrames={DURATION}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{audio: 'qashati2d/audio/qaf.mp3'} as QafDifferenceProps}
    />
    <Composition id="QafLab" component={QafLab} durationInFrames={6} fps={FPS} width={W} height={H} />
  </>
);
