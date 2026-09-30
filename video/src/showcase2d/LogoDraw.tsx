import {evolvePath, getBoundingBox, getLength, getPointAtLength, getSubpaths} from '@remotion/paths';
import {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {z} from 'zod';
import {LATIN_FONT, acumen, brandSchema, easeInOut, easeOut, mix, tint, useUnit} from './brand';
import {logoPaths} from './logoPaths';

export const logoDrawSchema = brandSchema.extend({
  tagline: z.string(),
  taglineAr: z.string(),
});
type Props = z.infer<typeof logoDrawSchema>;

export const logoDrawDefaults: Props = {
  ...acumen,
  tagline: 'Crafting the Atmosphere',
  taglineAr: 'نصنع الأجواء',
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const DRAW = {start: 4, end: 58, each: 30};

// Paths draw left -> right (the frame is leftmost, so it leads); all subpaths of a path draw together.
const useStrokes = () =>
  useMemo(() => {
    const order = logoPaths.paths
      .map((d) => ({d, box: getBoundingBox(d)}))
      .sort((a, b) => a.box.x1 - b.box.x1 || b.box.y1 - a.box.y1);
    const step = (DRAW.end - DRAW.start - DRAW.each) / Math.max(1, order.length - 1);
    return order.map(({d}, i) => ({
      d,
      start: DRAW.start + i * step,
      subpaths: getSubpaths(d).map((sub) => ({d: sub, length: getLength(sub)})),
    }));
  }, []);

export const LogoDraw: React.FC<Props> = ({background, text, accent, arabicFont, tagline, taglineAr}) => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const strokes = useStrokes();

  const size = 600 * unit; // logo width
  const boxH = (size * logoPaths.height) / logoPaths.width;
  const pathUnit = (size / logoPaths.width) * logoPaths.scale; // screen px per path unit
  const span = logoPaths.width / logoPaths.scale; // logo width in path units
  const warmWhite = mix(text, accent, 0.4);

  const fill = interpolate(frame, [46, 74], [0, 1], {...clamp, easing: easeInOut});
  const strokeFade = interpolate(frame, [58, 82], [1, 0], clamp);
  const bloom = interpolate(frame, [56, 80, 120], [0, 1, 0.6], clamp);
  const sweep = interpolate(frame, [80, 112], [-0.15, 1.15], {...clamp, easing: easeInOut}) * span;
  const line = interpolate(frame, [70, 94], [0, 1], {...clamp, easing: easeOut});
  const en = interpolate(frame, [74, 100], [0, 1], {...clamp, easing: easeOut});
  const ar = interpolate(frame, [82, 106], [0, 1], {...clamp, easing: easeOut});
  const push = interpolate(frame, [0, 120], [0.97, 1.01]);

  const shapes = (paint: string) => strokes.map((s, i) => <path key={i} d={s.d} fill={paint} />);

  return (
    <AbsoluteFill style={{backgroundColor: background}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 55% at 50% 40%, ${tint(accent, 0.14 * bloom + 0.03)} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <div style={{position: 'relative', width: size, height: boxH, transform: `scale(${push})`}}>
          {/* Bloom: a blurred accent copy of the logo behind the crisp one. */}
          <svg
            viewBox={logoPaths.viewBox}
            width={size}
            height={boxH}
            style={{position: 'absolute', inset: 0, opacity: bloom * 0.85, filter: `blur(${22 * unit}px)`}}
          >
            <g transform={logoPaths.transform}>{shapes(accent)}</g>
          </svg>
          <svg viewBox={logoPaths.viewBox} width={size} height={boxH} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <defs>
              <radialGradient id="ld-head">
                <stop offset="0" stopColor={accent} stopOpacity={0.9} />
                <stop offset="1" stopColor={accent} stopOpacity={0} />
              </radialGradient>
              <linearGradient id="ld-sweep" gradientUnits="userSpaceOnUse" x1={sweep - 0.09 * span} y1={0} x2={sweep + 0.09 * span} y2={0.12 * span}>
                <stop offset="0" stopColor={warmWhite} stopOpacity={0} />
                <stop offset="0.5" stopColor={accent} stopOpacity={0.95} />
                <stop offset="1" stopColor={warmWhite} stopOpacity={0} />
              </linearGradient>
            </defs>
            <g transform={logoPaths.transform}>
              <g fillOpacity={fill}>{shapes(text)}</g>
              <g opacity={fill}>{shapes('url(#ld-sweep)')}</g>
              {strokes.map((s, i) =>
                s.subpaths.map((sub, j) => {
                  const p = interpolate(frame, [s.start, s.start + DRAW.each], [0, 1], {...clamp, easing: easeInOut});
                  if (p === 0) return null;
                  const head = getPointAtLength(sub.d, sub.length * p);
                  const headAlpha = Math.sin(Math.PI * p);
                  return (
                    <g key={`${i}-${j}`}>
                      <path
                        d={sub.d}
                        fill="none"
                        stroke={warmWhite}
                        strokeWidth={1.6 / pathUnit}
                        strokeOpacity={strokeFade}
                        strokeLinecap="round"
                        {...evolvePath(p, sub.d)}
                      />
                      {head && headAlpha > 0.01 ? (
                        <>
                          <circle cx={head.x} cy={head.y} r={16 / pathUnit} fill="url(#ld-head)" opacity={headAlpha} />
                          <circle cx={head.x} cy={head.y} r={2.4 / pathUnit} fill={text} opacity={headAlpha} />
                        </>
                      ) : null}
                    </g>
                  );
                }),
              )}
            </g>
          </svg>
        </div>
        <div
          style={{
            width: 72 * unit,
            height: Math.max(1, unit),
            marginTop: 30 * unit,
            background: accent,
            opacity: 0.8 * line,
            transform: `scaleX(${line})`,
          }}
        />
        <div
          style={{
            fontFamily: LATIN_FONT,
            fontWeight: 300,
            fontSize: 24 * unit,
            letterSpacing: `${0.42 + 0.2 * (1 - en)}em`,
            paddingLeft: '0.42em',
            textTransform: 'uppercase',
            color: tint(text, 0.78),
            marginTop: 30 * unit,
            opacity: en,
            transform: `translateY(${(1 - en) * 14 * unit}px)`,
          }}
        >
          {tagline}
        </div>
        <div
          dir="rtl"
          style={{
            fontFamily: arabicFont,
            fontWeight: 300,
            fontSize: 30 * unit,
            color: tint(text, 0.72),
            marginTop: 12 * unit,
            opacity: ar,
            transform: `translateY(${(1 - ar) * 14 * unit}px)`,
          }}
        >
          {taglineAr}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
