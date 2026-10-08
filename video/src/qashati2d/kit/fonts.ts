// Fonts for the 2D series (local files in public/qashati2/fonts, loaded with @remotion/fonts — loadFont holds the
// render with delayRender until the face is ready).
//   Lalezar            → punchy headlines, stamps, CTA (InkTitle default)
//   Baloo Bhaijaan 2   → friendly lines, speech bubbles
//   IBM Plex Sans Arabic → UI / info lines (CTA sub, location)
//   Poppins            → Latin (tagline, Arabizi in bubbles)
// Noto Color Emoji is a system font and is always in the fallback chain.
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const DIR = 'qashati2/fonts';
const load = (family: string, file: string, weight: string) => loadFont({family, url: staticFile(`${DIR}/${file}`), weight});

load('Lalezar', 'Lalezar-400.ttf', '400');
load('Baloo Bhaijaan 2', 'BalooBhaijaan2-800.ttf', '800');
load('IBM Plex Sans Arabic', 'IBMPlexSansArabic-400.ttf', '400');
load('IBM Plex Sans Arabic', 'IBMPlexSansArabic-500.ttf', '500');
load('IBM Plex Sans Arabic', 'IBMPlexSansArabic-600.ttf', '600');
load('IBM Plex Sans Arabic', 'IBMPlexSansArabic-700.ttf', '700');
load('Poppins', 'Poppins-500.ttf', '500');

const EMOJI = "'Noto Color Emoji'";
export const FONT = {
  title: `'Lalezar', ${EMOJI}, sans-serif`,
  friendly: `'Baloo Bhaijaan 2', ${EMOJI}, sans-serif`,
  ui: `'IBM Plex Sans Arabic', ${EMOJI}, sans-serif`,
  latin: `'Poppins', ${EMOJI}, sans-serif`,
} as const;
export type FontKey = keyof typeof FONT;

// The weight each family exists in (Baloo only ships 800 here, Lalezar 400, Poppins 500).
export const FONT_WEIGHT: Record<FontKey, number> = {title: 400, friendly: 800, ui: 700, latin: 500};
