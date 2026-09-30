import {loadFont} from '@remotion/fonts';
import {zColor} from '@remotion/zod-types';
import {Easing, Img, interpolate, interpolateColors, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {z} from 'zod';

// Local OFL faces only: headless Chromium must never reach a font CDN.
export const LATIN = 'Poppins';
export const ARABIC = 'Noto Kufi Arabic';
loadFont({family: LATIN, url: staticFile('fonts/Poppins-ExtraLight.ttf'), weight: '200'});
loadFont({family: LATIN, url: staticFile('fonts/Poppins-Light.ttf'), weight: '300'});
loadFont({family: ARABIC, url: staticFile('fonts/NotoKufiArabic-Light.ttf'), weight: '300'});

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// The props every template in this folder shares; override in Studio or with --props.
export const brandSchema = z.object({
  logo: z.string().describe('Path inside public/'),
  tagline: z.string(),
  taglineAr: z.string(),
  background: zColor(),
  accent: zColor(),
});
export type Brand = z.infer<typeof brandSchema>;

export const acumen: Brand = {
  logo: 'logo-white.png',
  tagline: 'Crafting the Atmosphere',
  taglineAr: 'نصنع الأجواء',
  background: '#050505',
  accent: '#FFC478',
};

// ramp(t, 1, 2): 0 -> 1 while t goes from 1 s to 2 s, eased and clamped.
export const ramp = (t: number, from: number, to: number, easing = easeOut) =>
  interpolate(t, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

// tint('#FFC478', 0.4) -> 'rgba(255, 196, 120, 0.4)' for any CSS color the zColor() picker produces.
export const tint = (color: string, alpha: number) => {
  const [r, g, b, a = 1] = interpolateColors(0, [0, 1], [color, color])
    .match(/[\d.]+/g)!
    .map(Number);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha * a))})`;
};

export const useSeconds = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};

export const useUnit = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height) / 1080;
};

// Logo + English tagline + Arabic tagline (RTL), revealed by `t` (0..1).
export const Lockup: React.FC<{brand: Brand; t: number; logoSize?: number; logoOnly?: boolean}> = ({
  brand,
  t,
  logoSize = 150,
  logoOnly = false,
}) => {
  const u = useUnit();
  const line = (delay: number) => {
    const p = interpolate(t, [delay, delay + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return {opacity: p, transform: `translateY(${(1 - p) * 14 * u}px)`};
  };
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <Img
        src={staticFile(brand.logo)}
        style={{width: logoSize * u, ...line(0), filter: `drop-shadow(0 0 ${24 * u}px ${tint(brand.accent, 0.33)})`}}
      />
      {logoOnly ? null : (
        <>
          <div
            style={{
              fontFamily: LATIN,
              fontWeight: 300,
              fontSize: 20 * u,
              letterSpacing: '0.38em',
              paddingLeft: '0.38em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.78)',
              marginTop: 28 * u,
              ...line(0.25),
            }}
          >
            {brand.tagline}
          </div>
          <div
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: ARABIC,
              fontWeight: 300,
              fontSize: 24 * u,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 10 * u,
              ...line(0.4),
            }}
          >
            {brand.taglineAr}
          </div>
        </>
      )}
    </div>
  );
};
