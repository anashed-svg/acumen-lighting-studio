import {type Caption, createTikTokStyleCaptions, type TikTokPage} from '@remotion/captions';
import {measureText} from '@remotion/layout-utils';
import {createRoundedTextBox} from '@remotion/rounded-text-box';
import {zColor} from '@remotion/zod-types';
import {useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from 'remotion';
import {z} from 'zod';
import {acumen, ARABIC, easeOut, LATIN, tint, useFontsReady} from './brand';
import {NightVilla} from './NightVilla';

export const SOCIAL_CAPTIONS_FPS = 30;

export const socialCaptionsSchema = z.object({
  captionsFile: z.string().describe('Caption[] JSON in public/ (@remotion/captions format)'),
  combineWithinMs: z.number().min(0).describe('Words starting within this window share a page'),
  fontSize: z.number().min(24).max(160),
  accent: zColor(),
  text: zColor(),
  box: zColor(),
  tagline: z.string(),
  logo: z.string().describe('Image in public/, empty to hide'),
});
type Props = z.infer<typeof socialCaptionsSchema>;

export const socialCaptionsDefaults: Props = {
  captionsFile: 'showcaseFx/captions.json',
  combineWithinMs: 1200,
  fontSize: 68,
  accent: acumen.accent,
  text: acumen.text,
  box: 'rgba(8, 8, 8, 0.72)',
  tagline: 'Crafting the Atmosphere',
  logo: 'logo-white.png',
};

const cache = new Map<string, Promise<Caption[]>>();
const loadCaptions = (file: string) => {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(staticFile(file)).then((res) => {
        if (!res.ok) throw new Error(`Could not load captions ${file}: HTTP ${res.status}`);
        return res.json() as Promise<Caption[]>;
      }),
    );
  }
  return cache.get(file)!;
};

// Length follows the captions file (last word + a short tail).
export const socialCaptionsMetadata: CalculateMetadataFunction<Props> = async ({props}) => {
  const captions = await loadCaptions(props.captionsFile);
  const endMs = Math.max(...captions.map((c) => c.endMs));
  return {durationInFrames: Math.ceil(((endMs + 100) / 1000) * SOCIAL_CAPTIONS_FPS)};
};

const useCaptions = (file: string) => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading ${file}`));
  useEffect(() => {
    loadCaptions(file).then(setCaptions, cancelRender);
  }, [file, cancelRender]);
  useEffect(() => {
    if (captions) continueRender(handle);
  }, [captions, handle, continueRender]);
  return captions;
};

const isArabic = (s: string) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFC]/.test(s);

type Styled = {text: string; fromMs: number; toMs: number; arabic: boolean; width: number};

// Arabic words get the Arabic face and no tracking (tracking breaks the letter joins).
const wordStyle = (arabic: boolean, fontSize: number) =>
  arabic
    ? {fontFamily: ARABIC, fontSize, fontWeight: 500, letterSpacing: '0em'}
    : {fontFamily: LATIN, fontSize, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' as const};

const layoutPage = (page: TikTokPage, fontSize: number, maxWidth: number) => {
  const gap = fontSize * 0.36;
  const words: Styled[] = page.tokens.map((t) => {
    const text = t.text.trim();
    const arabic = isArabic(text);
    return {text, fromMs: t.fromMs, toMs: t.toMs, arabic, width: measureText({text, ...wordStyle(arabic, fontSize)}).width};
  });
  const lines: {words: Styled[]; width: number}[] = [];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if (line && line.width + gap + word.width <= maxWidth) {
      line.words.push(word);
      line.width += gap + word.width;
    } else {
      lines.push({words: [word], width: word.width});
    }
  }
  return {lines, gap, rtl: words.some((w) => w.arabic)};
};

const CaptionPage: React.FC<{page: TikTokPage; last: boolean; frames: number} & Props> = ({page, last, frames, fontSize, accent, text, box}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const ms = page.startMs + (frame / fps) * 1000;

  const padding = fontSize * 0.55;
  const lineHeight = fontSize * 1.6;
  const {lines, gap, rtl} = useMemo(() => layoutPage(page, fontSize, width * 0.78 - padding * 2), [page, fontSize, width, padding]);
  const {d, boundingBox} = createRoundedTextBox({
    textMeasurements: lines.map((l) => ({width: l.width, height: lineHeight})),
    textAlign: 'center',
    horizontalPadding: padding,
    borderRadius: fontSize * 0.42,
  });

  const enter = spring({frame, fps, config: {damping: 16, stiffness: 160}});
  const leave = last ? 1 : interpolate(frame, [frames - 4, frames], [1, 0], {extrapolateLeft: 'clamp'});

  return (
    <AbsoluteFill style={{alignItems: 'center', top: '66%', bottom: 'auto'}}>
      <div
        style={{
          position: 'relative',
          width: boundingBox.width,
          height: boundingBox.height,
          opacity: Math.min(1, enter * 1.5) * leave,
          transform: `translateY(${(1 - enter) * 40}px) scale(${0.9 + 0.1 * enter})`,
        }}
      >
        <svg
          viewBox={`${boundingBox.x1} ${boundingBox.y1} ${boundingBox.width} ${boundingBox.height}`}
          style={{position: 'absolute', inset: 0, overflow: 'visible'}}
        >
          <path d={d} fill={box} stroke={tint(accent, 0.28)} strokeWidth={1.5} />
        </svg>
        {lines.map((line, i) => (
          <div
            key={i}
            dir={rtl ? 'rtl' : 'ltr'}
            style={{position: 'absolute', left: 0, right: 0, top: i * lineHeight, height: lineHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap}}
          >
            {line.words.map((w) => {
              const active = ms >= w.fromMs && ms < w.toMs;
              const pop = spring({frame: frame - Math.round(((w.fromMs - page.startMs) / 1000) * fps), fps, config: {damping: 12, stiffness: 200}});
              return (
                <span
                  key={w.fromMs}
                  dir={w.arabic ? 'rtl' : 'ltr'}
                  style={{
                    ...wordStyle(w.arabic, fontSize),
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    color: active ? accent : text,
                    opacity: ms >= w.fromMs ? 1 : 0.38,
                    textShadow: active ? `0 0 ${fontSize * 0.45}px ${tint(accent, 0.55)}` : 'none',
                    transform: `scale(${active ? interpolate(pop, [0, 1], [1.08, 1.02]) : 1})`,
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const SocialCaptions: React.FC<Props> = (props) => {
  const {captionsFile, combineWithinMs, accent, text, tagline, logo} = props;
  const fontsReady = useFontsReady();
  const captions = useCaptions(captionsFile);
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const pages = useMemo(
    () => (captions ? createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds: combineWithinMs}).pages : []),
    [captions, combineWithinMs],
  );
  const brandIn = interpolate(frame, [0, fps * 0.9], [0, 1], {extrapolateRight: 'clamp', easing: easeOut});

  return (
    <AbsoluteFill>
      <NightVilla accent={accent} fit="contain" zoom={1.3} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.6) 100%)'}} />
      <AbsoluteFill style={{alignItems: 'center', paddingTop: 190, opacity: brandIn}}>
        {logo ? <Img src={staticFile(logo)} style={{width: 150}} /> : null}
        <div
          style={{
            marginTop: 34,
            fontFamily: LATIN,
            fontWeight: 200,
            fontSize: 26,
            letterSpacing: '0.42em',
            paddingLeft: '0.42em',
            textTransform: 'uppercase',
            color: tint(text, 0.75),
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
      {fontsReady
        ? pages.map((page, i) => {
            const from = Math.round((page.startMs / 1000) * fps);
            const last = i === pages.length - 1;
            const to = last ? durationInFrames : Math.round(((page.startMs + page.durationMs) / 1000) * fps);
            const frames = Math.max(1, to - from);
            return (
              <Sequence key={page.startMs} from={from} durationInFrames={frames} layout="none">
                <CaptionPage page={page} last={last} frames={frames} {...props} />
              </Sequence>
            );
          })
        : null}
    </AbsoluteFill>
  );
};
