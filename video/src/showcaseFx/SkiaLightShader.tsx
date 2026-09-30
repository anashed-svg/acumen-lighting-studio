import {LoadSkiaWeb} from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';
import {zColor} from '@remotion/zod-types';
import {useEffect, useState} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {acumen, arabicText, easeOut, LATIN, rgb01, useUnit} from './brand';

// CanvasKit's wasm is emitted into the bundle by enableSkia() (remotion.config.ts) and fetched
// from the same local server as bundle.js, so nothing is downloaded at render time. Loading it
// here (instead of in index.ts) keeps this composition self-contained inside any Root.
type CanvasModule = typeof import('./LightWallCanvas');
let canvasModule: Promise<CanvasModule> | null = null;
const loadCanvas = () => (canvasModule ??= LoadSkiaWeb().then(() => import('./LightWallCanvas')));

const useLightWallCanvas = () => {
  const [mod, setMod] = useState<CanvasModule | null>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('Loading CanvasKit'));
  useEffect(() => {
    loadCanvas().then(setMod, cancelRender);
  }, [cancelRender]);
  useEffect(() => {
    if (mod) continueRender(handle);
  }, [mod, handle, continueRender]);
  return mod;
};

export const skiaLightShaderSchema = z.object({
  title: z.string(),
  titleAr: z.string(),
  lightColor: zColor(),
  wallColor: zColor(),
  textColor: zColor(),
  logo: z.string().describe('PNG/SVG in public/, empty to hide'),
});

export const skiaLightShaderDefaults: z.infer<typeof skiaLightShaderSchema> = {
  title: 'Crafting the Atmosphere',
  titleAr: 'نصنع الأجواء',
  lightColor: acumen.accent,
  wallColor: acumen.wall,
  textColor: acumen.text,
  logo: 'logo-white.png',
};

const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const SkiaLightShader: React.FC<z.infer<typeof skiaLightShaderSchema>> = ({
  title,
  titleAr,
  lightColor,
  wallColor,
  textColor,
  logo,
}) => {
  const mod = useLightWallCanvas();
  const frame = useCurrentFrame();
  const {fps, width, height, durationInFrames} = useVideoConfig();
  const unit = useUnit();

  const uniforms = {
    time: frame / fps,
    wash: interpolate(frame, [0, durationInFrames], [0, 1], {...clamp, easing: inOut}),
    grazers: interpolate(frame, [4, fps * 2.3], [0, 1], clamp),
    beams: interpolate(frame, [fps, fps * 2.6], [0, 1], {...clamp, easing: easeOut}),
    lightColor: rgb01(lightColor),
    wallColor: rgb01(wallColor),
  };
  const text = interpolate(frame, [fps * 1.8, fps * 3], [0, 1], {...clamp, easing: easeOut});
  const logoIn = interpolate(frame, [fps * 1.4, fps * 2.6], [0, 1], {...clamp, easing: easeOut});

  return (
    <AbsoluteFill style={{backgroundColor: acumen.background}}>
      {mod ? <mod.LightWallCanvas width={width} height={height} uniforms={uniforms} /> : null}
      <div style={{position: 'absolute', top: 72 * unit, left: 84 * unit, color: textColor}}>
        {logo ? <Img src={staticFile(logo)} style={{width: 128 * unit, opacity: 0.92 * logoIn, display: 'block'}} /> : null}
        <div style={{opacity: text, transform: `translateY(${(1 - text) * 18 * unit}px)`}}>
          <div style={{width: 72 * unit * text, height: 1, background: lightColor, margin: `${44 * unit}px 0 ${28 * unit}px`}} />
          <div style={{fontFamily: LATIN, fontWeight: 200, fontSize: 30 * unit, letterSpacing: '0.38em', textTransform: 'uppercase'}}>
            {title}
          </div>
          <div dir="rtl" style={{...arabicText, textAlign: 'left', fontWeight: 300, fontSize: 30 * unit, marginTop: 10 * unit, opacity: 0.75}}>
            {titleAr}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
