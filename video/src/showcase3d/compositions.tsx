import {Composition} from 'remotion';
import {LottieShowcase, lottieShowcaseDefaults, lottieShowcaseSchema} from './LottieShowcase';
import {RiveDemo, riveDemoDefaults, riveDemoSchema} from './RiveDemo';
import {Svg3DLogo, svg3DLogoDefaults, svg3DLogoSchema} from './Svg3DLogo';
import {TheatreKeyframes, theatreKeyframesDefaults, theatreKeyframesSchema} from './TheatreKeyframes';
import {ThreeLightScene, threeLightSceneDefaults, threeLightSceneSchema} from './ThreeLightScene';

const hd = {fps: 30, width: 1280, height: 720, durationInFrames: 120};

// A fragment, so the main Root can mount these next to AcumenIntro later.
export const Showcase3DCompositions: React.FC = () => (
  <>
    <Composition
      id="ThreeLightScene"
      component={ThreeLightScene}
      schema={threeLightSceneSchema}
      defaultProps={threeLightSceneDefaults}
      {...hd}
    />
    <Composition
      id="LottieShowcase"
      component={LottieShowcase}
      schema={lottieShowcaseSchema}
      defaultProps={lottieShowcaseDefaults}
      {...hd}
    />
    <Composition
      id="TheatreKeyframes"
      component={TheatreKeyframes}
      schema={theatreKeyframesSchema}
      defaultProps={theatreKeyframesDefaults}
      {...hd}
    />
    <Composition id="RiveDemo" component={RiveDemo} schema={riveDemoSchema} defaultProps={riveDemoDefaults} {...hd} />
    <Composition id="Svg3DLogo" component={Svg3DLogo} schema={svg3DLogoSchema} defaultProps={svg3DLogoDefaults} {...hd} />
  </>
);
