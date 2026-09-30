import {Composition} from 'remotion';
import {MishQashta} from './MishQashta';
import {DURATION, FPS, H, W} from './spec';

// Qashati Alsham spot #2 «مش قشطة» — see SPEC.md.
export const MishQashtaCompositions: React.FC = () => (
  <Composition
    id="MishQashta"
    component={MishQashta}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{music: 'qashati2/audio/mish-qashta.mp3'}}
  />
);
