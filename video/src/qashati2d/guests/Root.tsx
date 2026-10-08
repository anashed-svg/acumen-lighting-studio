// Compositions of the «ضيوف فجأة» spot. Render without sound (until guests/audio/make_sound.py has made it):
//   nice -n 10 npx remotion render src/qashati2d/guests/index.ts SurpriseGuests out/qashati2d/guests/render.mp4 --props='{"audio":null}'
// GuestsLab = the spot's drawing sheet (the six guests' expressions/poses), for development only.
import React from 'react';
import {Composition} from 'remotion';
import {GuestsLab} from './Lab';
import {SurpriseGuests, SurpriseGuestsProps} from './SurpriseGuests';
import {DURATION, FPS, H, W} from './spec';

export const SurpriseGuestsRoot: React.FC = () => (
  <>
    <Composition
      id="SurpriseGuests"
      component={SurpriseGuests}
      durationInFrames={DURATION}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{audio: 'qashati2d/audio/guests.mp3'} as SurpriseGuestsProps}
    />
    <Composition id="GuestsLab" component={GuestsLab} durationInFrames={8} fps={FPS} width={W} height={H} />
  </>
);
