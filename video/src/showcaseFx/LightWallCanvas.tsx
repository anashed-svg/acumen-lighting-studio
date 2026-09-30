// Loaded only after CanvasKit is ready (see SkiaLightShader): react-native-skia binds to
// the global CanvasKit the moment this module is evaluated.
import {SkiaCanvas} from '@remotion/skia';
import {Fill, Shader, Skia} from '@shopify/react-native-skia';
import {lightWallSksl} from './lightWall.sksl';

const effect = Skia.RuntimeEffect.Make(lightWallSksl);
if (!effect) throw new Error('lightWall.sksl failed to compile');

export type LightWallUniforms = {
  time: number;
  wash: number;
  grazers: number;
  beams: number;
  lightColor: [number, number, number];
  wallColor: [number, number, number];
};

export const LightWallCanvas: React.FC<{width: number; height: number; uniforms: LightWallUniforms}> = ({
  width,
  height,
  uniforms,
}) => (
  <SkiaCanvas width={width} height={height}>
    <Fill>
      <Shader source={effect} uniforms={{resolution: [width, height], ...uniforms}} />
    </Fill>
  </SkiaCanvas>
);
