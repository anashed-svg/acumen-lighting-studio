import {loadFont} from '@remotion/fonts';
import {useEffect, useState} from 'react';
import {Easing, interpolateColors, staticFile, useDelayRender, useVideoConfig} from 'remotion';

// All faces are local (public/fonts, SIL OFL): headless renders never touch a font CDN.
export const LATIN = 'Poppins';
export const ARABIC = 'Noto Kufi Arabic';

const faces: [family: string, file: string, weight: string][] = [
  [LATIN, 'Poppins-ExtraLight.ttf', '200'],
  [LATIN, 'Poppins-Light.ttf', '300'],
  [LATIN, 'Poppins-Medium.ttf', '500'],
  [ARABIC, 'NotoKufiArabic-Light.ttf', '300'],
  [ARABIC, 'NotoKufiArabic-Medium.ttf', '500'],
];
const fontsLoaded = Promise.all(
  faces.map(([family, file, weight]) => loadFont({family, url: staticFile(`fonts/${file}`), weight})),
);

// measureText() caches widths, so anything that measures waits for the real faces first.
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender('showcaseFx fonts'));
  useEffect(() => {
    fontsLoaded.then(() => setReady(true), cancelRender);
  }, [cancelRender]);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle, continueRender]);
  return ready;
};

export const acumen = {
  background: '#050505',
  text: '#F4F1EC',
  accent: '#FFC478',
  wall: '#B8AFA3',
};

const channels = (color: string) =>
  interpolateColors(0, [0, 1], [color, color]).match(/[\d.]+/g)!.map(Number) as [number, number, number, number];

// tint('#FFC478', 0.4) -> 'rgba(255, 196, 120, 0.4)'; accepts any CSS color zColor() produces.
export const tint = (color: string, alpha: number) => {
  const [r, g, b, a] = channels(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha * a))})`;
};

// '#FFC478' -> [1, 0.77, 0.47] for shader uniforms.
export const rgb01 = (color: string): [number, number, number] => {
  const [r, g, b] = channels(color);
  return [r / 255, g / 255, b / 255];
};

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export const useUnit = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height) / 1080;
};

// Chrome spaces out Arabic letters (and breaks the joins) when letter-spacing is set,
// so tracking is only ever applied to Latin text.
export const arabicText: React.CSSProperties = {fontFamily: ARABIC, letterSpacing: 0, direction: 'rtl'};
