import {Composition} from 'remotion';
import {BrandLowerThird, brandLowerThirdDefaults, brandLowerThirdSchema} from './BrandLowerThird';
import {SocialCaptions, SOCIAL_CAPTIONS_FPS, socialCaptionsDefaults, socialCaptionsMetadata, socialCaptionsSchema} from './SocialCaptions';
import {SkiaLightShader, skiaLightShaderDefaults, skiaLightShaderSchema} from './SkiaLightShader';

// A fragment, so the main Root can mount it next to AcumenIntro. The bundle needs the
// react-native -> react-native-web alias from ./remotion.config.ts (Skia).
export const ShowcaseFxCompositions: React.FC = () => (
  <>
    <Composition
      id="SkiaLightShader"
      component={SkiaLightShader}
      schema={skiaLightShaderSchema}
      defaultProps={skiaLightShaderDefaults}
      durationInFrames={120}
      fps={30}
      width={1280}
      height={720}
    />
    <Composition
      id="BrandLowerThird"
      component={BrandLowerThird}
      schema={brandLowerThirdSchema}
      defaultProps={brandLowerThirdDefaults}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="SocialCaptions"
      component={SocialCaptions}
      schema={socialCaptionsSchema}
      defaultProps={socialCaptionsDefaults}
      calculateMetadata={socialCaptionsMetadata}
      durationInFrames={120}
      fps={SOCIAL_CAPTIONS_FPS}
      width={1080}
      height={1920}
    />
  </>
);
