import {Composition} from 'remotion';
import {KineticType, kineticTypeDefaults, kineticTypeSchema} from './KineticType';
import {LogoDraw, logoDrawDefaults, logoDrawSchema} from './LogoDraw';
import {TransitionsReel, transitionsReelDefaults, transitionsReelDuration, transitionsReelSchema} from './TransitionsReel';

const fps = 30;
const landscape = {fps, width: 1920, height: 1080};
const vertical = {fps, width: 1080, height: 1920};

// Registered as a fragment so the main Root can mount it next to AcumenIntro later.
export const Showcase2DCompositions: React.FC = () => (
  <>
    <Composition id="LogoDraw" component={LogoDraw} schema={logoDrawSchema} defaultProps={logoDrawDefaults} durationInFrames={120} {...landscape} />
    <Composition id="LogoDrawVertical" component={LogoDraw} schema={logoDrawSchema} defaultProps={logoDrawDefaults} durationInFrames={120} {...vertical} />
    <Composition id="KineticType" component={KineticType} schema={kineticTypeSchema} defaultProps={kineticTypeDefaults} durationInFrames={120} {...landscape} />
    <Composition id="KineticTypeVertical" component={KineticType} schema={kineticTypeSchema} defaultProps={kineticTypeDefaults} durationInFrames={120} {...vertical} />
    <Composition
      id="TransitionsReel"
      component={TransitionsReel}
      schema={transitionsReelSchema}
      defaultProps={transitionsReelDefaults}
      durationInFrames={transitionsReelDuration}
      {...landscape}
    />
    <Composition
      id="TransitionsReelVertical"
      component={TransitionsReel}
      schema={transitionsReelSchema}
      defaultProps={transitionsReelDefaults}
      durationInFrames={transitionsReelDuration}
      {...vertical}
    />
  </>
);
