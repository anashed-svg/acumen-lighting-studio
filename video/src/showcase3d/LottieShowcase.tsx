import {Lottie, type LottieAnimationData} from '@remotion/lottie';
import {useEffect, useState} from 'react';
import {AbsoluteFill, interpolate, interpolateColors, Sequence, staticFile, useDelayRender} from 'remotion';
import {z} from 'zod';
import {acumen, ARABIC, brandSchema, LATIN, Lockup, ramp, tint, useSeconds, useUnit} from './brand';

export const lottieShowcaseSchema = brandSchema.extend({
  title: z.string(),
  titleAr: z.string(),
  items: z.array(z.object({file: z.string(), label: z.string(), labelAr: z.string()})).max(6),
});
type Props = z.infer<typeof lottieShowcaseSchema>;

export const lottieShowcaseDefaults: Props = {
  ...acumen,
  title: 'Architectural Lighting',
  titleAr: 'الإضاءة المعمارية',
  items: [
    {file: 'lottie/uplight.json', label: 'Uplight', labelAr: 'إضاءة صاعدة'},
    {file: 'lottie/wall-washer.json', label: 'Wall Washer', labelAr: 'غمر الجدران'},
    {file: 'lottie/linear-led.json', label: 'Linear LED', labelAr: 'إضاءة خطية'},
    {file: 'lottie/spotlight.json', label: 'Spotlight', labelAr: 'إضاءة موضعية'},
  ],
};

// The icons are generated with accent #FFC478; swap it for the brand accent at load time.
const SOURCE_ACCENT = [255, 196, 120].map((v) => v / 255);
const toUnitRgb = (color: string) =>
  interpolateColors(0, [0, 1], [color, color])
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map((v) => Number(v) / 255);
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.01);

const recolor = (node: unknown, to: number[]): unknown => {
  if (Array.isArray(node)) return node.map((n) => recolor(n, to));
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) out[key] = recolor(value, to);
  const o = out as {ty?: string; c?: {k: number[]}; g?: {p: number; k: {k: number[]}}};
  if ((o.ty === 'fl' || o.ty === 'st') && o.c && near(o.c.k.slice(0, 3), SOURCE_ACCENT)) o.c.k = [...to, ...o.c.k.slice(3)];
  if (o.ty === 'gf' && o.g) {
    const stops = o.g.k.k;
    for (let i = 0; i < o.g.p * 4; i += 4) {
      if (near(stops.slice(i + 1, i + 4), SOURCE_ACCENT)) stops.splice(i + 1, 3, ...to);
    }
  }
  return out;
};

const useLottieJson = (file: string, accent: string) => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading ${file}`));
  const [data, setData] = useState<LottieAnimationData | null>(null);
  useEffect(() => {
    fetch(staticFile(file))
      .then((r) => r.json())
      .then((json) => {
        setData(recolor(json, toUnitRgb(accent)) as LottieAnimationData);
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [file, accent, handle, continueRender, cancelRender]);
  return data;
};

const Icon: React.FC<{file: string; label: string; labelAr: string; accent: string; size: number}> = ({
  file,
  label,
  labelAr,
  accent,
  size,
}) => {
  const data = useLottieJson(file, accent);
  const u = useUnit();
  const t = useSeconds();
  const text = ramp(t, 0.7, 1.4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: size}}>
      {data ? <Lottie animationData={data} style={{width: size, height: size}} /> : <div style={{height: size}} />}
      <div
        style={{
          fontFamily: LATIN,
          fontWeight: 300,
          fontSize: 21 * u,
          letterSpacing: '0.32em',
          paddingLeft: '0.32em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)',
          opacity: text,
          marginTop: 4 * u,
        }}
      >
        {label}
      </div>
      <div
        dir="rtl"
        lang="ar"
        style={{fontFamily: ARABIC, fontWeight: 300, fontSize: 26 * u, color: accent, opacity: text, marginTop: 8 * u}}
      >
        {labelAr}
      </div>
    </div>
  );
};

export const LottieShowcase: React.FC<Props> = (props) => {
  const u = useUnit();
  const t = useSeconds();
  const head = ramp(t, 0.1, 0.9);
  const cell = 330 * u;
  return (
    <AbsoluteFill style={{backgroundColor: props.background, alignItems: 'center', justifyContent: 'center'}}>
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse at 50% 55%, ${tint(props.accent, 0.12)} 0%, transparent 60%)`}}
      />
      <div style={{marginTop: -60 * u, textAlign: 'center', opacity: head, transform: `translateY(${(1 - head) * 12 * u}px)`}}>
        <div
          style={{
            fontFamily: LATIN,
            fontWeight: 200,
            fontSize: 40 * u,
            letterSpacing: '0.42em',
            paddingLeft: '0.42em',
            textTransform: 'uppercase',
            color: '#fff',
          }}
        >
          {props.title}
        </div>
        <div
          dir="rtl"
          lang="ar"
          style={{fontFamily: ARABIC, fontWeight: 300, fontSize: 32 * u, color: 'rgba(255,255,255,0.7)', marginTop: 12 * u}}
        >
          {props.titleAr}
        </div>
      </div>
      <div style={{display: 'flex', gap: 36 * u, marginTop: 30 * u}}>
        {props.items.map((item, i) => (
          <div key={item.file} style={{width: cell, height: cell + 100 * u}}>
            <Sequence from={8 + i * 6} layout="none">
              <Icon {...item} accent={props.accent} size={cell} />
            </Sequence>
          </div>
        ))}
      </div>
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 * u}}>
        <Lockup brand={props} t={ramp(t, 2.4, 3.4, (x) => x)} logoSize={64} logoOnly />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: '#000',
          opacity: interpolate(t, [3.6, 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      />
    </AbsoluteFill>
  );
};
