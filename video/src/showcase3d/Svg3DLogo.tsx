import {reduceMatrices, rotateX, rotateY} from '@remotion/svg-3d-engine';
import {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, interpolate, interpolateColors, staticFile, useDelayRender, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {acumen, ARABIC, brandSchema, easeInOut, LATIN, ramp, tint, useSeconds, useUnit} from './brand';
import {extrude, loadSvgPaths, project, type Solid} from './svg3d/extrude';

export const svg3DLogoSchema = brandSchema.extend({
  logoSvg: z.string().describe('Single-colour vector logo inside public/'),
  depth: z.number().min(10).max(400),
  face: z.string(),
});
type Props = z.infer<typeof svg3DLogoSchema>;

export const svg3DLogoDefaults: Props = {...acumen, logoSvg: 'logo-white.svg', depth: 110, face: '#f4f1ec'};

const useSolids = (file: string, depth: number) => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Extruding ${file}`));
  const [paths, setPaths] = useState<string[] | null>(null);
  useEffect(() => {
    loadSvgPaths(staticFile(file))
      .then((p) => {
        setPaths(p);
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [file, handle, continueRender, cancelRender]);
  return useMemo<Solid[] | null>(() => (paths ? extrude(paths, depth) : null), [paths, depth]);
};

// GPU-free 3D logo sting: the SVG logo is extruded and rendered as plain SVG paths every frame.
export const Svg3DLogo: React.FC<Props> = (props) => {
  const {width, height} = useVideoConfig();
  const u = useUnit();
  const t = useSeconds();
  const solids = useSolids(props.logoSvg, props.depth);
  const turn = ramp(t, 0, 3.2, easeInOut);
  const faces = useMemo(() => {
    if (!solids) return [];
    const matrix = reduceMatrices([
      rotateX(interpolate(turn, [0, 1], [0.24, 0.05])),
      rotateY(interpolate(turn, [0, 1], [-0.85, -0.18])),
    ]);
    const lightX = interpolate(t, [0, 4], [-1.2, 1.2]);
    return project(solids, matrix, 2600, [lightX, -0.6, -0.8]);
  }, [solids, turn, t]);

  const reveal = ramp(t, 0, 0.8);
  const tag = ramp(t, 2.5, 3.5);
  const scale = (height * 0.56) / 1920;
  const side = (shade: number) => interpolateColors(shade, [0, 0.6, 1], ['#0c0b0a', tint(props.accent, 0.55), props.accent]);
  const cap = (shade: number) => interpolateColors(shade, [0, 1], ['#6d6a66', props.face]);

  return (
    <AbsoluteFill style={{backgroundColor: props.background}}>
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse at 50% 45%, ${tint(props.accent, 0.16 * reveal)} 0%, transparent 55%)`}}
      />
      <svg viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`} style={{width, height, opacity: reveal}}>
        <g transform={`translate(0 ${-height * 0.05}) scale(${scale})`}>
          {faces.map((f, i) => (
            <path
              key={i}
              d={f.d}
              fill={f.cap ? cap(f.shade) : side(f.shade)}
              stroke={f.cap ? 'none' : side(f.shade)}
              strokeWidth={4}
            />
          ))}
        </g>
      </svg>
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 * u, opacity: tag}}>
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
