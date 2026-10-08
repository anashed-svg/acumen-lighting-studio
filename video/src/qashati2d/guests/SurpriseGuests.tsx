// «ضيوف فجأة» — the spot. Read spec.ts first (story, timeline, copy, cue list). One <Sequence> per shot; every shot
// draws its own world, multiplane camera and type in screen space; whip pans get a horizontal motion blur + drawn speed
// lines; the kit end card slides over the feast; paper grain LAST.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {C, ENDCARD_DURATION, EndCard2D, InkTitle, PaperGrain} from '../kit/lib';
import {MotionBlurDefs, SpeedLines} from './art/Fx';
import {ClockPhone} from './shots/ClockPhone';
import {Door} from './shots/Door';
import {Feast} from './shots/Feast';
import {Fridge} from './shots/Fridge';
import {Majlis} from './shots/Majlis';
import {Peephole} from './shots/Peephole';
import {COPY, LAYOUT, T} from './spec';

export type SurpriseGuestsProps = {audio: string | null};

/** whip-pan windows: [start, cut, end] — blur peaks on the cut frame */
const WHIPS: [number, number, number][] = [
  [T.whip1, T.fridge, T.fridge + 6],
  [T.phoneOut, T.door, T.door + 5],
  [T.feast - 6, T.feast, T.feast + 5],
];
const whipAmount = (f: number) => {
  for (const [a, c, b] of WHIPS) {
    if (f >= a && f <= b) return f <= c ? (f - a + 1) / (c - a + 1) : 1 - (f - c) / (b - c + 1);
  }
  return 0;
};

export const SurpriseGuests: React.FC<SurpriseGuestsProps> = ({audio}) => {
  const f = useCurrentFrame();
  const w = whipAmount(f);
  return (
    <AbsoluteFill style={{background: C.paper}}>
      {w > 0 ? <MotionBlurDefs id="whipBlur" amount={Math.round(w * 46)} /> : null}
      <AbsoluteFill style={{filter: w > 0.05 ? 'url(#whipBlur)' : undefined}}>
        <Sequence from={0} durationInFrames={T.fridge} name="1 peephole">
          <Peephole />
        </Sequence>
        <Sequence from={T.fridge} durationInFrames={T.clock - T.fridge} name="2 fridge">
          <Fridge from={T.fridge} />
        </Sequence>
        <Sequence from={T.clock} durationInFrames={T.door - T.clock} name="3 clock + phone">
          <ClockPhone from={T.clock} />
        </Sequence>
        <Sequence from={T.door} durationInFrames={T.sofa - T.door} name="4 door">
          <Door from={T.door} />
        </Sequence>
        <Sequence from={T.sofa} durationInFrames={T.feast - T.sofa} name="5 coffee + arrival">
          <Majlis from={T.sofa} />
        </Sequence>
        <Sequence from={T.feast} durationInFrames={T.endCard + 12 - T.feast} name="6 feast">
          <Feast from={T.feast} />
        </Sequence>
      </AbsoluteFill>
      {w > 0 ? <SpeedLines amount={w} dir={1} seed={Math.round(f / 20)} /> : null}
      {/* the turn of the story, in screen space: it lands on the arrival, stays crisp over the whip (no blur) and is
          still on screen over the feast, so «…ووصلت القشاطي 🛵» reads sound-off (~1.4 s instead of a 0.2 s flash) */}
      {f >= T.titleArrival - 2 && f < T.arrivalOut + 8 ? (
        <InkTitle x={LAYOUT.arrivalTitle.x} y={LAYOUT.arrivalTitle.y} text={COPY.arrivalTitle} start={T.titleArrival} stagger={T.titleStagger} fontSize={LAYOUT.arrivalTitle.size} exit={T.arrivalOut} rotate={-2} plate={C.turquoise} frame={f} />
      ) : null}
      <Sequence from={T.endCard} durationInFrames={ENDCARD_DURATION} name="7 end card">
        <EndCard2D comment={COPY.endComment} grain={false} />
      </Sequence>
      <PaperGrain />
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
