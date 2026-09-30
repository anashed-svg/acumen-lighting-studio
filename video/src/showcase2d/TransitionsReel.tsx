import {LightLeak} from '@remotion/light-leaks';
import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {iris} from '@remotion/transitions/iris';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {acumen, brandSchema, easeInOut} from './brand';
import {LinearScene, UplightScene, WallWasherScene} from './reelScenes';

const sceneSchema = z.object({title: z.string(), titleAr: z.string()});
export const transitionsReelSchema = brandSchema.extend({
  linear: sceneSchema,
  wallWasher: sceneSchema,
  uplight: sceneSchema,
});
type Props = z.infer<typeof transitionsReelSchema>;

export const transitionsReelDefaults: Props = {
  ...acumen,
  linear: {title: 'Linear', titleAr: 'إضاءة خطية'},
  wallWasher: {title: 'Wall Washer', titleAr: 'إضاءة الجدران'},
  uplight: {title: 'Uplight', titleAr: 'إضاءة من الأسفل'},
};

const T = 12; // transition length in frames
const SCENES = [48, 46, 50]; // 48 + 46 + 50 - 2 * 12 = 120 frames (4 s)
export const transitionsReelDuration = SCENES.reduce((a, b) => a + b, 0) - 2 * T;

// wipe in -> Linear -> slide (+ light leak) -> Wall Washer -> iris -> Uplight -> fade out.
export const TransitionsReel: React.FC<Props> = ({linear, wallWasher, uplight, ...brand}) => {
  const {width, height} = useVideoConfig();
  const timing = linearTiming({durationInFrames: T, easing: easeInOut});
  return (
    <AbsoluteFill style={{backgroundColor: brand.background}}>
      <TransitionSeries>
        <TransitionSeries.Transition presentation={wipe({direction: 'from-left'})} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
          <LinearScene {...brand} {...linear} index="01" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({direction: 'from-right'})}
          timing={springTiming({config: {damping: 200}, durationInFrames: T})}
        />
        <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
          <WallWasherScene {...brand} {...wallWasher} index="02" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={iris({width, height})} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
          <UplightScene {...brand} {...uplight} index="03" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade({shouldFadeOutExitingScene: true})} timing={timing} />
      </TransitionSeries>
      {/* Warm leak (WebGL) flares in from the edge the slide enters from. A full-frame dim wash
          reads as olive mud on black, so it is masked to one edge and kept bright; hueShift 30 → amber. */}
      <LightLeak
        from={SCENES[0] - T - 6}
        durationInFrames={T + 12}
        seed={3}
        hueShift={30}
        style={{
          mixBlendMode: 'screen',
          opacity: 0.75,
          maskImage: 'radial-gradient(ellipse 55% 80% at 100% 30%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 75%)',
        }}
      />
    </AbsoluteFill>
  );
};
