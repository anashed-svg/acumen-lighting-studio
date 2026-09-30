import RiveRuntime, {
  type Artboard,
  type LinearAnimationInstance,
  type RiveCanvas,
  type WrappedRenderer,
} from '@rive-app/canvas-advanced';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {interpolateColors, useCurrentFrame, useDelayRender, useVideoConfig} from 'remotion';

// @remotion/rive fetches rive.wasm from unpkg.com, which offline/sandboxed render machines cannot reach.
// This bundles the wasm from node_modules instead and seeks the animation absolutely every frame.
const wasmUrl = new URL('@rive-app/canvas-advanced/rive.wasm', import.meta.url).href;
let runtime: Promise<RiveCanvas> | null = null;
const loadRuntime = () => (runtime ??= RiveRuntime({locateFile: () => wasmUrl}));

// Solid fills and gradient stops are stored as property 37/38 followed by ARGB (little-endian).
// Swapping one RGB for another (alpha kept) lets a baked .riv follow the brand accent, like the Lottie recolor.
const rgb = (color: string) => interpolateColors(0, [0, 1], [color, color]).match(/[\d.]+/g)!.slice(0, 3).map(Number);
const recolorRiv = (bytes: Uint8Array, from: string, to: string) => {
  const [fr, fg, fb] = rgb(from);
  const [tr, tg, tb] = rgb(to);
  for (let i = 0; i + 3 < bytes.length; i++) {
    if ((bytes[i] === 37 || bytes[i] === 38) && bytes[i + 1] === fb && bytes[i + 2] === fg && bytes[i + 3] === fr) {
      bytes.set([tb, tg, tr], i + 1);
    }
  }
  return bytes;
};

type Loaded = {rive: RiveCanvas; renderer: WrappedRenderer; artboard: Artboard; animation: LinearAnimationInstance};

export const LocalRiveCanvas: React.FC<{
  src: string;
  artboard?: string;
  animation?: string;
  fit?: 'contain' | 'cover' | 'fill';
  /** Replace this colour in the file's fills/gradient stops with `recolorTo`. */
  recolorFrom?: string;
  recolorTo?: string;
  style?: React.CSSProperties;
}> = ({src, artboard, animation, fit = 'contain', recolorFrom, recolorTo, style}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading Rive file ${src}`));
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    Promise.all([loadRuntime(), fetch(src).then((r) => r.arrayBuffer())])
      .then(async ([rive, buffer]) => {
        const bytes = new Uint8Array(buffer);
        const file = await rive.load(recolorFrom && recolorTo ? recolorRiv(bytes, recolorFrom, recolorTo) : bytes);
        const board = artboard ? file.artboardByName(artboard) : file.defaultArtboard();
        const linear = animation ? board.animationByName(animation) : board.animationByIndex(0);
        setLoaded({
          rive,
          renderer: rive.makeRenderer(canvas.current!),
          artboard: board,
          animation: new rive.LinearAnimationInstance(linear, board),
        });
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [src, artboard, animation, recolorFrom, recolorTo, handle, continueRender, cancelRender]);

  useLayoutEffect(() => {
    if (!loaded) return;
    const {rive, renderer, artboard: board, animation: anim} = loaded;
    anim.time = frame / fps;
    anim.apply(1);
    board.advance(0);
    renderer.clear();
    renderer.save();
    renderer.align(rive.Fit[fit], rive.Alignment.center, {minX: 0, minY: 0, maxX: width, maxY: height}, board.bounds);
    board.draw(renderer);
    renderer.restore();
    rive.resolveAnimationFrame();
  }, [loaded, frame, fps, fit, width, height]);

  return <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', ...style}} />;
};
