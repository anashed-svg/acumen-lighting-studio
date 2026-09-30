import {loadFont} from '@remotion/fonts';
import {zColor} from '@remotion/zod-types';
import gsap from 'gsap';
import {useEffect, useMemo, useState} from 'react';
import {Easing, interpolateColors, staticFile, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';
import {z} from 'zod';

// Every face ships in public/fonts (SIL OFL) so renders never touch the network.
export const LATIN_FONT = 'Poppins';
export const ARABIC_FONTS = ['Noto Kufi Arabic', 'IBM Plex Sans Arabic', 'Cairo'] as const;

const faces: [family: string, file: string, weight: string][] = [
  [LATIN_FONT, 'Poppins-ExtraLight.ttf', '200'],
  [LATIN_FONT, 'Poppins-Light.ttf', '300'],
  ['Noto Kufi Arabic', 'NotoKufiArabic-Light.ttf', '300'],
  ['IBM Plex Sans Arabic', 'IBMPlexSansArabic-ExtraLight.ttf', '200'],
  ['IBM Plex Sans Arabic', 'IBMPlexSansArabic-Light.ttf', '300'],
  ['Cairo', 'Cairo-Light.ttf', '300'],
];
const fontsLoaded = Promise.all(
  faces.map(([family, file, weight]) => loadFont({family, url: staticFile(`fonts/${file}`), weight})),
);

// measureText()/fitText() cache their results, so only measure once the faces are really in.
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('showcase2d fonts'));
  useEffect(() => {
    fontsLoaded.then(() => setReady(true), cancelRender);
  }, [cancelRender]);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle, continueRender]);
  return ready;
};

// Re-skin a composition by editing these props (Studio sidebar or --props).
export const brandSchema = z.object({
  background: zColor(),
  text: zColor(),
  accent: zColor(),
  arabicFont: z.enum(ARABIC_FONTS),
});
export type Brand = z.infer<typeof brandSchema>;

export const acumen: Brand = {
  background: '#050505',
  text: '#F4F1EC',
  accent: '#FFC478',
  arabicFont: 'Noto Kufi Arabic',
};

// tint('#FFC478', 0.4) -> 'rgba(255, 196, 120, 0.4)'; accepts hex, rgb() and named colors.
export const tint = (color: string, alpha: number) => {
  const [r, g, b, a] = interpolateColors(0, [0, 1], [color, color]).match(/[\d.]+/g)!.map(Number);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha * a))})`;
};

// Solid blend of two brand colors, e.g. mix(background, accent, 0.1) for a warm dark.
export const mix = (from: string, to: string, t: number) => interpolateColors(t, [0, 1], [from, to]);

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const useUnit = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height) / 1080;
};

// GSAP as a pure keyframe engine: the timeline tweens plain objects and is seeked to the
// current frame on every render (never real time), so any frame renders identically in any order.
export const useGsapTimeline = <T,>(build: (tl: gsap.core.Timeline) => T, deps: unknown[]): T => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {tl, state} = useMemo(() => {
    const timeline = gsap.timeline({paused: true});
    return {tl: timeline, state: build(timeline)};
  }, deps);
  tl.seek(frame / fps, true);
  return state;
};
