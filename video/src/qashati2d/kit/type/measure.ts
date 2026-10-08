// Deterministic text measuring for layout (bubbles): waits for the font face (document.fonts.load) under a
// delayRender, then measures with a canvas (RTL aware). Results are cached per (font, text).
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';

const cache = new Map<string, number>();
let canvas: HTMLCanvasElement | null = null;

const cssFont = (family: string, size: number, weight: number) => `${weight} ${size}px ${family}`;

const measureNow = (text: string, family: string, size: number, weight: number) => {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * size * 0.5;
  ctx.font = cssFont(family, size, weight);
  ctx.direction = 'rtl';
  return ctx.measureText(text).width;
};

/** Widths of each line (px) once the font is ready; `null` until then (the render is held meanwhile). */
export const useTextWidths = (lines: string[], family: string, size: number, weight: number): number[] | null => {
  const keys = lines.map((l) => `${family}|${size}|${weight}|${l}`);
  const ready = keys.every((k) => cache.has(k));
  const [, force] = useState(0);
  const [handle] = useState(() => (ready ? null : delayRender(`measure text: ${lines.join(' / ')}`)));
  useEffect(() => {
    if (ready) {
      if (handle !== null) continueRender(handle);
      return;
    }
    const first = family.split(',')[0].trim();
    Promise.all(lines.map((l) => document.fonts.load(cssFont(first, size, weight), l || ' ')))
      .then(() => {
        lines.forEach((l, i) => cache.set(keys[i], measureNow(l, family, size, weight)));
        force((x) => x + 1);
      })
      .catch((e) => cancelRender(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (ready && handle !== null) continueRender(handle);
  }, [ready, handle]);
  return ready ? keys.map((k) => cache.get(k) as number) : null;
};
