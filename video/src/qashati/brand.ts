import {loadFont} from '@remotion/fonts';
import {random, staticFile} from 'remotion';

// Qashati Alsham — colours sampled from the logo (#01E8D5) plus food colours for the product art.
export const C = {
  turquoise: '#01E8D5',
  turquoiseLight: '#5FF4E8',
  turquoiseDeep: '#00C2B2',
  teal: '#053F3B', // text on turquoise (contrast ~7:1)
  tealDark: '#032B28',
  cream: '#FFF7E8', // qashta
  creamShade: '#EFD9B8',
  honey: '#F4AE22',
  honeyLight: '#FFE08A',
  strawberry: '#F0364F',
  mango: '#FFA41B',
  kiwi: '#7CC242',
  kiwiDark: '#3E7D1E',
  banana: '#FBE7A1',
  blueberry: '#4B3F8F',
  pistachio: '#95C73F',
  chocolate: '#4A2616',
  chocolateLight: '#7A4428',
  white: '#FFFFFF',
};

export const F = {arabic: 'Baloo Bhaijaan 2', latin: 'Poppins'};
loadFont({family: F.arabic, url: staticFile('qashati/fonts/BalooBhaijaan2-800.ttf'), weight: '800'});
loadFont({family: F.arabic, url: staticFile('qashati/fonts/BalooBhaijaan2-600.ttf'), weight: '600'});
loadFont({family: F.latin, url: staticFile('qashati/fonts/Poppins-500.ttf'), weight: '500'});
loadFont({family: F.latin, url: staticFile('qashati/fonts/Poppins-700.ttf'), weight: '700'});

// Design space: everything is laid out in 1080x1920 px and scaled to the render size.
export const W = 1080;
export const H = 1920;

// Timeline in frames @30fps — matches the cue list in audio/make_score.py (seconds x 30).
export const T = {
  cupIn: 0,
  dropsLand: 18, // 0.60 s cream plop
  fruit1: 28, // pieces land 1.25–2.25 s
  qashta: 80, // gloop at 2.80 s
  fruit2: 116, // pieces land 4.20–4.95 s
  dome: 140,
  honey: 156, // drizzle 5.20–6.40 s
  nuts: 192, // sprinkle 6.40–7.40 s
  hero: 228, // sparkle 7.60 s
  swaps: [240, 273, 306, 339], // 8.0 / 9.1 / 10.2 / 11.3 s
  wipe: 372, // 12.40 s whoosh -> 13.20 s splash
  logo: 390,
  dotsLand: [398, 404], // 13.25 / 13.45 s
  cta: 441, // 14.70 s chime
  end: 480, // 16 s
};

// Deterministic jitter: same value for the same key on every frame / render.
export const rnd = (key: string, min = 0, max = 1) => min + random(`qashati-${key}`) * (max - min);

// Cup geometry (design px). Transparent cup, wider at the rim — like their packaging.
export const CUP = {cx: 540, rimY: 750, bottomY: 1460, topHalf: 300, bottomHalf: 222};
export const cupHalfWidth = (y: number) =>
  CUP.bottomHalf + ((CUP.topHalf - CUP.bottomHalf) * (CUP.bottomY - y)) / (CUP.bottomY - CUP.rimY);
// Content bands from the bottom (fractions of cup height).
export const BANDS = {fruit1: [0, 0.36], qashta: [0.36, 0.64], fruit2: [0.64, 0.87]} as const;
export const bandY = (f: number) => CUP.bottomY - f * (CUP.bottomY - CUP.rimY);
export const DOME = {baseY: bandY(0.87), peakY: 628};
