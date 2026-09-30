import {fitText, measureText} from '@remotion/layout-utils';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {LATIN_FONT, acumen, brandSchema, mix, tint, useFontsReady, useGsapTimeline, useUnit} from './brand';

export const kineticTypeSchema = brandSchema.extend({
  word: z.string(),
  wordAr: z.string(),
  line: z.string(),
  lineAr: z.string(),
  tagline: z.string(),
  taglineAr: z.string(),
});
type Props = z.infer<typeof kineticTypeSchema>;

export const kineticTypeDefaults: Props = {
  ...acumen,
  arabicFont: 'IBM Plex Sans Arabic',
  word: 'Light',
  wordAr: 'الضوء',
  line: 'Shapes the Night',
  lineAr: 'يرسم ملامح الليل',
  tagline: 'Crafting the Atmosphere',
  taglineAr: 'نصنع الأجواء',
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const TRACK = 0.3; // em, Poppins display tracking

// Beat 1: a beam of light passes over the word and "switches on" each letter; the Arabic word
// reveals right-to-left. Beat 2: the line builds word by word in both languages. Arabic is animated
// per word, never per letter, so its letters stay joined.
export const KineticType: React.FC<Props> = (props) => {
  const {background, text, accent, arabicFont, word, wordAr, line, lineAr, tagline, taglineAr} = props;
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const unit = useUnit();
  const ready = useFontsReady();

  const s = useGsapTimeline(
    (tl) => {
      const letters = Array.from(word).map(() => ({y: 1, o: 0, blur: 1}));
      const beam = {x: -0.3};
      const reveal = {p: 0};
      const exit = {p: 0};
      const words = line.split(' ').map(() => ({y: 1, o: 0}));
      const wordsAr = lineAr.split(' ').map(() => ({y: 1, o: 0}));
      const tag = {o: 0};
      tl.to(letters, {y: 0, o: 1, blur: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07}, 0.1)
        .to(beam, {x: 1.35, duration: 1.3, ease: 'power2.inOut'}, 0.3)
        .to(reveal, {p: 1, duration: 0.8, ease: 'power3.inOut'}, 0.6)
        .to(exit, {p: 1, duration: 0.45, ease: 'power2.in'}, 1.75)
        .to(words, {y: 0, o: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12}, 2.05)
        .to(wordsAr, {y: 0, o: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12}, 2.25)
        .to(tag, {o: 1, duration: 0.6, ease: 'power1.out'}, 2.95);
      return {letters, beam, reveal, exit, words, wordsAr, tag};
    },
    [word, line, lineAr],
  );

  const power = interpolate(frame, [0, 18], [0, 1], clamp);
  const stage = (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        backgroundImage: `radial-gradient(ellipse 45% 70% at 50% -10%, ${tint(accent, 0.13 * power)} 0%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );
  if (!ready) return stage;

  const portrait = height > width;
  const upper = 'uppercase' as const;
  const bigSize = Math.min(
    fitText({text: word, withinWidth: width * (portrait ? 0.8 : 0.56), fontFamily: LATIN_FONT, fontWeight: 200, letterSpacing: `${TRACK}em`, textTransform: upper}).fontSize,
    280 * unit,
  );
  const barWidth =
    measureText({text: word, fontFamily: LATIN_FONT, fontWeight: 200, fontSize: bigSize, letterSpacing: `${TRACK}em`, textTransform: upper}).width -
    TRACK * bigSize;
  const lineSize = Math.min(
    fitText({text: line, withinWidth: width * (portrait ? 0.86 : 0.66), fontFamily: LATIN_FONT, fontWeight: 200, letterSpacing: '0.24em', textTransform: upper}).fontSize,
    120 * unit,
  );
  const lineArSize = Math.min(fitText({text: lineAr, withinWidth: width * 0.5, fontFamily: arabicFont, fontWeight: 300}).fontSize, lineSize * 0.62);

  const bar = spring({frame: frame - 20, fps, config: {damping: 200}, durationInFrames: 30});
  const dim = mix(background, text, 0.2);
  const e = s.exit.p;

  return (
    <AbsoluteFill>
      {stage}
      {/* Beat 1 */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          opacity: 1 - e,
          transform: `translateY(${-60 * unit * e}px)`,
          filter: `blur(${8 * unit * e}px)`,
        }}
      >
        <div style={{display: 'flex', fontFamily: LATIN_FONT, fontWeight: 200, fontSize: bigSize, lineHeight: 1, textTransform: upper}}>
          {Array.from(word).map((ch, i, all) => {
            const l = s.letters[i];
            const c = (i + 0.5) / all.length;
            const on = interpolate(s.beam.x, [c - 0.12, c + 0.04], [0, 1], clamp);
            const hot = Math.exp(-((c - s.beam.x) ** 2) / 0.01);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  marginRight: i < all.length - 1 ? `${TRACK}em` : 0,
                  opacity: l.o,
                  transform: `translateY(${l.y * 0.3}em)`,
                  filter: `blur(${l.blur * 14 * unit}px)`,
                  color: mix(mix(dim, text, on), accent, 0.45 * hot),
                  textShadow: `0 0 ${30 * unit * hot}px ${tint(accent, 0.8 * hot)}, 0 0 ${80 * unit * hot}px ${tint(accent, 0.45 * hot)}`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <div
          style={{
            width: barWidth,
            height: Math.max(1, 2 * unit),
            marginTop: 34 * unit,
            background: `linear-gradient(90deg, rgba(0,0,0,0), ${accent} 50%, rgba(0,0,0,0))`,
            transform: `scaleX(${bar})`,
            boxShadow: `0 0 ${18 * unit}px ${tint(accent, 0.6)}`,
          }}
        />
        <div
          dir="rtl"
          style={{
            fontFamily: arabicFont,
            fontWeight: 300,
            fontSize: bigSize * 0.4,
            lineHeight: 1.4,
            marginTop: 26 * unit,
            color: tint(text, 0.9),
            // Soft right-to-left wipe: the mask edge travels from the right edge to the left.
            maskImage: `linear-gradient(to left, #000 ${s.reveal.p * 130 - 30}%, transparent ${s.reveal.p * 130}%)`,
          }}
        >
          {wordAr}
        </div>
      </AbsoluteFill>
      {/* Beat 2 */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30 * unit}}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: '0.55em',
            fontFamily: LATIN_FONT,
            fontWeight: 200,
            fontSize: lineSize,
            letterSpacing: '0.24em',
            textTransform: upper,
            lineHeight: 1.1,
          }}
        >
          {line.split(' ').map((w, i, all) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '-0.24em',
                opacity: s.words[i].o,
                transform: `translateY(${s.words[i].y * 0.5}em)`,
                color: i === all.length - 1 ? accent : text,
                textShadow: i === all.length - 1 ? `0 0 ${40 * unit}px ${tint(accent, 0.45)}` : undefined,
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <div dir="rtl" style={{display: 'flex', gap: '0.3em', fontFamily: arabicFont, fontWeight: 300, fontSize: lineArSize, lineHeight: 1.5}}>
          {lineAr.split(' ').map((w, i, all) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: s.wordsAr[i].o,
                transform: `translateY(${s.wordsAr[i].y * 0.5}em)`,
                color: i === all.length - 1 ? accent : tint(text, 0.85),
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 90 * unit,
          opacity: s.tag.o,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 28 * unit, color: tint(text, 0.6)}}>
          <span style={{fontFamily: LATIN_FONT, fontWeight: 300, fontSize: 18 * unit, letterSpacing: '0.42em', textTransform: upper}}>{tagline}</span>
          <span style={{width: 1, height: 22 * unit, background: tint(accent, 0.7)}} />
          <span dir="rtl" style={{fontFamily: arabicFont, fontWeight: 300, fontSize: 22 * unit}}>
            {taglineAr}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
