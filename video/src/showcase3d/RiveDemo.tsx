import {zColor} from '@remotion/zod-types';
import {AbsoluteFill, staticFile} from 'remotion';
import {z} from 'zod';
import {acumen, ARABIC, brandSchema, LATIN, ramp, useSeconds, useUnit} from './brand';
import {LocalRiveCanvas} from './rive/LocalRiveCanvas';

export const riveDemoSchema = brandSchema.extend({
  riv: z.string().describe('.riv file inside public/'),
  artboard: z.string(),
  animation: z.string(),
  rivAccent: zColor().describe('Colour baked into the .riv that is swapped for `accent`'),
  wordmark: z.string(),
});
type Props = z.infer<typeof riveDemoSchema>;

export const riveDemoDefaults: Props = {
  ...acumen,
  riv: 'rive/acumen-frame.riv',
  artboard: 'Acumen',
  animation: 'reveal',
  rivAccent: '#FFC478',
  wordmark: 'Acumen',
};

// A Rive animation (frame + glow) with live HTML type layered on top.
export const RiveDemo: React.FC<Props> = (props) => {
  const u = useUnit();
  const t = useSeconds();
  const word = ramp(t, 1.2, 2.2);
  const tag = ramp(t, 2.0, 3.0);
  return (
    <AbsoluteFill style={{backgroundColor: props.background}}>
      <LocalRiveCanvas
        src={staticFile(props.riv)}
        artboard={props.artboard}
        animation={props.animation}
        recolorFrom={props.rivAccent}
        recolorTo={props.accent}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            fontFamily: LATIN,
            fontWeight: 300,
            fontSize: 76 * u,
            letterSpacing: `${0.6 - 0.24 * word}em`,
            paddingLeft: `${0.6 - 0.24 * word}em`,
            textTransform: 'uppercase',
            color: '#fff',
            opacity: word,
          }}
        >
          {props.wordmark}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60 * u, opacity: tag}}>
        <div
          style={{
            fontFamily: LATIN,
            fontWeight: 300,
            fontSize: 22 * u,
            letterSpacing: '0.38em',
            paddingLeft: '0.38em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {props.tagline}
        </div>
        <div
          dir="rtl"
          lang="ar"
          style={{fontFamily: ARABIC, fontWeight: 300, fontSize: 26 * u, color: props.accent, marginTop: 8 * u}}
        >
          {props.taglineAr}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
