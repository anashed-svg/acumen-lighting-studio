// Phone story — fonts, font stacks and UI palette. Timing/copy/brand colours come from ../spec.ts.
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONTS} from '../spec';

const load = (family: string, file: string, weight: string) =>
  loadFont({family, url: staticFile(`qashati2/fonts/${file}`), weight});

load(FONTS.ui, 'IBMPlexSansArabic-400.ttf', '400');
load(FONTS.ui, 'IBMPlexSansArabic-500.ttf', '500');
load(FONTS.ui, 'IBMPlexSansArabic-600.ttf', '600');
load(FONTS.ui, 'IBMPlexSansArabic-700.ttf', '700');
load(FONTS.stamp, 'Lalezar-400.ttf', '400');
load(FONTS.latin, 'Poppins-500.ttf', '500');

// Emoji come from the system Noto Color Emoji (Chromium falls back per glyph).
export const UI_FONT = `'${FONTS.ui}', 'Noto Color Emoji', sans-serif`;
export const STAMP_FONT = `'${FONTS.stamp}', sans-serif`;

// 1 pt of a ~390 pt-wide phone at 1080 px.
export const PT = 1080 / 390;

export const UIC = {
  // Dark mode (23:xx chats, lock screen)
  darkBg: '#0B0E12',
  darkBar: '#15191E',
  darkBubbleIn: '#23272D',
  darkBubbleOut: '#2360D8',
  darkText: '#F2F4F7',
  darkSub: '#8C939D',
  darkSep: 'rgba(255,255,255,0.08)',
  accent: '#3D8BFF',
  unread: '#2FC26B',
  // Light warm (weather) and light (maps)
  lightText: '#1D1B18',
  lightSub: '#6F6A61',
  trafficRed: '#C8211B',
  trafficDark: '#8E1410',
  trafficOrange: '#F08A00',
  route: '#1A73E8',
};
