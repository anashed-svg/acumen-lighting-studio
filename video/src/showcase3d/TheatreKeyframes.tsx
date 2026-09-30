import {getProject, types, type ISheet} from '@theatre/core';
import {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Img, interpolateColors, staticFile, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {acumen, ARABIC, brandSchema, LATIN, tint, useUnit} from './brand';

export const theatreKeyframesSchema = brandSchema.extend({
  state: z.string().describe('Theatre.js project state exported from Studio, inside public/'),
});
type Props = z.infer<typeof theatreKeyframesSchema>;

export const theatreKeyframesDefaults: Props = {...acumen, state: 'theatre/acumen-reveal.theatre.json'};

// Theatre refuses (in dev/Studio) a second getProject() with the same id but a different state,
// so the id carries a hash of the state: swapping or editing the JSON loads it as a fresh project.
const projectId = (json: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193);
  return `Acumen Reveal ${(h >>> 0).toString(16)}`;
};

// Loads the exported state once; Theatre then only acts as a keyframe/curve evaluator.
const useTheatreSheet = (stateFile: string) => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Theatre state ${stateFile}`));
  const [sheet, setSheet] = useState<ISheet | null>(null);
  useEffect(() => {
    fetch(staticFile(stateFile))
      .then((r) => r.text())
      .then(async (json) => {
        const project = getProject(projectId(json), {state: JSON.parse(json)});
        await project.ready;
        setSheet(project.sheet('Reveal'));
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [stateFile, handle, continueRender, cancelRender]);
  return sheet;
};

// Prop names and defaults must match the tracks in the state file (Studio creates both).
const useObjects = (sheet: ISheet | null) =>
  useMemo(() => {
    if (!sheet) return null;
    const unit = types.number(0, {range: [0, 1]});
    return {
      sweep: sheet.object('Sweep', {x: types.number(-0.25, {range: [-0.5, 1.5]}), intensity: unit, warmth: unit}),
      logo: sheet.object('Logo', {glow: unit, scale: types.number(1, {range: [0.5, 1.5]})}),
      tagline: sheet.object('Tagline', {
        opacity: unit,
        tracking: types.number(0.38, {range: [0, 2]}),
        y: types.number(0, {range: [-100, 100]}),
        arabic: unit,
      }),
    };
  }, [sheet]);

export const TheatreKeyframes: React.FC<Props> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = useUnit();
  const sheet = useTheatreSheet(props.state);
  const objects = useObjects(sheet);
  if (!sheet || !objects) return <AbsoluteFill style={{backgroundColor: props.background}} />;

  // Deterministic: the sequence playhead is the Remotion frame, never Theatre's own clock.
  sheet.sequence.position = frame / fps;
  const sweep = objects.sweep.value;
  const logo = objects.logo.value;
  const tag = objects.tagline.value;

  const light = interpolateColors(sweep.warmth, [0, 1], ['#dfe8ff', props.accent]);
  const barX = sweep.x * width;
  const logoSize = 300 * u;
  // The light bar itself reveals the logo: everything left of it has been "lit".
  const reveal = Math.min(1, Math.max(0, (barX - (width - logoSize) / 2) / logoSize));

  return (
    <AbsoluteFill style={{backgroundColor: props.background}}>
      <AbsoluteFill
        style={{
          opacity: logo.glow,
          background: `radial-gradient(ellipse at 50% 42%, ${tint(props.accent, 0.25)} 0%, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: sweep.intensity,
          background: `linear-gradient(90deg, transparent ${barX - 260 * u}px, ${tint(light, 0.13)} ${barX - 60 * u}px, ${tint(light, 0.8)} ${barX}px, ${tint(light, 0.13)} ${barX + 60 * u}px, transparent ${barX + 260 * u}px)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <Img
          src={staticFile(props.logo)}
          style={{
            width: logoSize,
            transform: `scale(${logo.scale})`,
            clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
            filter: `drop-shadow(0 0 ${36 * u * logo.glow}px ${tint(props.accent, 0.66)})`,
          }}
        />
        <div
          style={{
            fontFamily: LATIN,
            fontWeight: 300,
            fontSize: 24 * u,
            letterSpacing: `${tag.tracking}em`,
            paddingLeft: `${tag.tracking}em`,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            color: 'rgba(255,255,255,0.8)',
            marginTop: 40 * u,
            opacity: tag.opacity,
            transform: `translateY(${tag.y * u}px)`,
          }}
        >
          {props.tagline}
        </div>
        <div
          dir="rtl"
          lang="ar"
          style={{
            fontFamily: ARABIC,
            fontWeight: 300,
            fontSize: 28 * u,
            color: 'rgba(255,255,255,0.72)',
            marginTop: 12 * u,
            opacity: tag.arabic,
          }}
        >
          {props.taglineAr}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
