import {loadFont} from '@remotion/fonts';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Brand fonts ship as local files (public/fonts) so renders never depend on the network.
const poppins = 'Poppins';
const kufi = 'Noto Kufi Arabic';
loadFont({family: poppins, url: staticFile('fonts/Poppins-ExtraLight.ttf'), weight: '200'});
loadFont({family: poppins, url: staticFile('fonts/Poppins-Light.ttf'), weight: '300'});
loadFont({family: kufi, url: staticFile('fonts/NotoKufiArabic-Light.ttf'), weight: '300'});

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Dark stage -> warm light sweeps across -> logo, wordmark and tagline settle in.
export const AcumenIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const unit = Math.min(width, height) / 1080;

  const sweep = interpolate(frame, [0, 60], [-0.4, 1.4], {extrapolateRight: 'clamp', easing: ease});
  const glow = interpolate(frame, [20, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const logo = interpolate(frame, [30, 75], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const text = interpolate(frame, [60, 100], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const out = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#050505', opacity: out}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 42%, rgba(255,196,120,${0.22 * glow}) 0%, rgba(0,0,0,0) 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(100deg, transparent ${sweep * 100 - 12}%, rgba(255,214,160,0.18) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)`,
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <Img
          src={staticFile('logo-white.png')}
          style={{
            width: 300 * unit,
            opacity: logo,
            transform: `scale(${0.94 + 0.06 * logo})`,
            filter: `drop-shadow(0 0 ${40 * unit * glow}px rgba(255,200,130,0.45))`,
          }}
        />
        <div
          style={{
            fontFamily: poppins,
            fontWeight: 300,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 22 * unit,
            letterSpacing: '0.34em',
            paddingLeft: '0.34em',
            textTransform: 'uppercase',
            marginTop: 44 * unit,
            opacity: text,
            transform: `translateY(${(1 - text) * 16 * unit}px)`,
          }}
        >
          Crafting the Atmosphere
        </div>
        <div
          dir="rtl"
          style={{
            fontFamily: kufi,
            fontWeight: 300,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 24 * unit,
            marginTop: 14 * unit,
            opacity: text,
          }}
        >
          نصنع الأجواء
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
