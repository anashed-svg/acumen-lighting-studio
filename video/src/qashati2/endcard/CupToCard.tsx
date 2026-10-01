// The product stays on the end card: the cup shot pulls back — the live shot starts shrinking a few frames
// before the card, then its last frame (frozen) keeps travelling towards the packshot slot while the set
// feathers away into the flat card. At the fastest part of the move, under a whip blur, the transparent
// packshot (public/qashati2/cup-packshot.png), riding exactly the same path, takes over: it fades in on top,
// then the frozen frame (with the spoon) fades out — so the camera change never shows as a static double
// image and nothing pops. The packshot lands with a small overshoot; afterwards the cup is alive but
// grounded: a very slow push-in anchored at its base (the contact shadow stays put) and a few sparkles.
//
// The packshot's framing is measured at render time (alpha bounding box), so whatever crop the 3D render
// delivers, the cup lands in exactly the same place and size.
import React, {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {COLORS, H, T, W} from '../spec';
import {clamp, CUP_LAST, E, easeInOut, PACK} from './layout';

export const CUP_SHOT = 'qashati2/cup-shot.mp4';
export const PACKSHOT = 'qashati2/cup-packshot.png';

// ---- the pull-back (shared by the live cup shot in MishQashta and the frozen frame here)
const src = {cx: CUP_LAST.cx, cy: (CUP_LAST.top + CUP_LAST.bottom) / 2, h: CUP_LAST.bottom - CUP_LAST.top};
const target = {cx: PACK.cx, cy: PACK.bottom - PACK.cupH / 2, h: PACK.cupH};
const S1 = target.h / src.h;

export const morphU = (frame: number) => easeInOut(interpolate(frame, [E.morph.from, E.morph.to], [0, 1], clamp));

// Whip blur (screen px) proportional to the pull-back's speed: peaks mid-move, ~0 at both ends.
const WHIP_BLUR = 6;
const PEAK_DU = 3 / (E.morph.to - E.morph.from); // easeInOut cubic: max slope 3 per unit time
export const whipBlur = (frame: number) => (WHIP_BLUR * (morphU(frame + 0.5) - morphU(frame - 0.5))) / PEAK_DU;
// CSS filters work in the element's own (pre-transform) px: divide by the layer's scale for screen px
const blurCss = (frame: number, scale: number) => {
  const b = whipBlur(frame);
  return b > 0.25 ? `blur(${(b / scale).toFixed(2)}px)` : undefined;
};

export const morphStyle = (frame: number): React.CSSProperties => {
  const u = morphU(frame);
  if (u <= 0) return {};
  const s = 1 + (S1 - 1) * u;
  // the frame's own edges feather into the flat card (set ≈ card colour: invisible at full size, and once
  // it shrinks no rectangle edge is ever seen)
  const fx = interpolate(u, [0, 0.3, 1], [40, 150, 200], clamp);
  const fy = interpolate(u, [0, 0.3, 1], [40, 150, 150], clamp);
  const top = interpolate(u, [0, 0.3, 1], [0, CUP_LAST.top - 170, CUP_LAST.top - 170], clamp);
  const mx = `linear-gradient(to right, transparent 0px, #000 ${fx}px, #000 ${W - fx}px, transparent ${W}px)`;
  const my = `linear-gradient(to bottom, transparent ${top}px, #000 ${top + 140}px, #000 ${H - fy}px, transparent ${H}px)`;
  return {
    transformOrigin: `${src.cx}px ${src.cy}px`,
    transform: `translate(${(target.cx - src.cx) * u}px, ${(target.cy - src.cy) * u}px) scale(${s})`,
    WebkitMaskImage: `${mx}, ${my}`,
    WebkitMaskComposite: 'source-in',
    maskImage: `${mx}, ${my}`,
    maskComposite: 'intersect',
    filter: blurCss(frame, s),
  };
};

// ---- packshot framing: alpha bounding box of the solid cup (alpha > 0.5, so a soft shadow is ignored)
type Bounds = {w: number; h: number; l: number; r: number; t: number; b: number}; // px of the natural image
const cache: {b?: Bounds; p?: Promise<Bounds>} = {};
const measure = (url: string) =>
  new Promise<Bounds>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 300 / img.naturalWidth);
      const cw = Math.round(img.naturalWidth * k);
      const ch = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, cw, ch);
      const a = ctx.getImageData(0, 0, cw, ch).data;
      let l = cw, r = -1, t = ch, b = -1;
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++)
          if (a[(y * cw + x) * 4 + 3] > 128) {
            if (x < l) l = x;
            if (x > r) r = x;
            if (y < t) t = y;
            if (y > b) b = y;
          }
      if (r < 0) return reject(new Error(`${url}: fully transparent`));
      resolve({w: img.naturalWidth, h: img.naturalHeight, l: l / k, r: (r + 1) / k, t: t / k, b: (b + 1) / k});
    };
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });

const usePackBounds = () => {
  const [b, setB] = useState<Bounds | null>(cache.b ?? null);
  const [handle] = useState(() => (cache.b ? null : delayRender('measure cup-packshot.png')));
  useEffect(() => {
    if (cache.b) return;
    cache.p ??= measure(staticFile(PACKSHOT));
    cache.p.then((r) => setB((cache.b = r))).catch((e) => cancelRender(e));
  }, []);
  // release only after the render WITH the packshot has committed (so its <Img> has registered its own
  // delayRender first — otherwise the frame could be captured before the image is decoded)
  useEffect(() => {
    if (b && handle !== null) continueRender(handle);
  }, [b, handle]);
  return b;
};

const Sparkle: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) =>
  s <= 0.01 ? null : (
    <svg width={60} height={60} viewBox="-30 -30 60 60" style={{position: 'absolute', left: x - 30, top: y - 30, overflow: 'visible'}}>
      <path
        transform={`scale(${s}) rotate(${s * 30})`}
        d="M0 -26 C2 -7 7 -2 26 0 C7 2 2 7 0 26 C-2 7 -7 2 -26 0 C-7 -2 -2 -7 0 -26 Z"
        fill="#FFFFFF"
        style={{filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))'}}
      />
    </svg>
  );

export const CupToCard: React.FC<{frame: number}> = ({frame}) => {
  const measured = usePackBounds();
  // (the frozen frame alone needs no measurement; anything with the packshot waits for it — delayRender)
  if (frame < T.endCard || (!measured && frame >= E.packIn.from)) return null;
  const pack = measured ? interpolate(frame, [E.packIn.from, E.packIn.to], [0, 1], clamp) : 0;
  const frozen = 1 - interpolate(frame, [E.frozenOut.from, E.frozenOut.to], [0, 1], clamp);
  const bounds = measured ?? {w: 1, h: 1, l: 0, r: 1, t: 0, b: 1};

  // the packshot rides the frozen frame's path: its cup box coincides with the frozen cup box at every u
  const u = morphU(frame);
  const ride = (1 + (S1 - 1) * u) / S1;

  // place the packshot so its cup bbox lands exactly on the target
  const k = target.h / (bounds.b - bounds.t);
  const imgW = bounds.w * k;
  const imgH = bounds.h * k;
  const left = target.cx - ((bounds.l + bounds.r) / 2) * k;
  const top = PACK.bottom - bounds.b * k;
  const cupL = bounds.l * k;
  const cupW = (bounds.r - bounds.l) * k;
  const cupT = bounds.t * k;
  // feather the image's own edges (a contact shadow that runs into the PNG border must never end in a line)
  const fL = bounds.l * k * 0.5;
  const fR = imgW - (imgW - bounds.r * k) * 0.5;
  const fT = cupT * 0.5;
  const fB = bounds.b * k + (imgH - bounds.b * k) * 0.35;
  const edgeMask = `linear-gradient(to right, transparent 0px, #000 ${fL}px, #000 ${fR}px, transparent ${imgW}px), linear-gradient(to bottom, transparent 0px, #000 ${fT}px, #000 ${fB}px, transparent ${imgH}px)`;

  // lands with a small overshoot (keeps shrinking a touch past the slot, springs back), then a slow push-in
  // anchored at the base
  const kk = frame - E.morph.to;
  const settle = kk >= 0 ? 1 - 0.022 * Math.sin(kk * 0.42) * Math.exp(-kk * 0.22) : 1;
  const creep = 1 + interpolate(frame, [E.loopFrom, T.end], [0, 0.035], clamp);
  const sparkle = (at: number) => {
    const t = frame - at;
    return t < 0 || t > 14 ? 0 : Math.sin((t / 14) * Math.PI);
  };

  return (
    <>
      {frozen > 0 ? (
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...morphStyle(frame), opacity: frozen}}>
          <Sequence from={T.endCard} layout="none">
            <Freeze frame={T.endCard - T.cupShot - 1}>
              <OffthreadVideo src={staticFile(CUP_SHOT)} muted style={{width: W, height: H, display: 'block', background: COLORS.turquoise}} />
            </Freeze>
          </Sequence>
        </div>
      ) : null}
      {pack > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            transformOrigin: `${target.cx}px ${target.cy}px`,
            transform: ride === 1 ? undefined : `translate(${(src.cx - target.cx) * (1 - u)}px, ${(src.cy - target.cy) * (1 - u)}px) scale(${ride})`,
            filter: blurCss(frame, ride),
            opacity: pack,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left,
              top,
              width: imgW,
              height: imgH,
              transformOrigin: `${target.cx - left}px ${PACK.bottom - top}px`,
              transform: `scale(${settle * creep})`,
            }}
          >
            <Img
              src={staticFile(PACKSHOT)}
              style={{width: '100%', height: '100%', display: 'block', WebkitMaskImage: edgeMask, WebkitMaskComposite: 'source-in', maskImage: edgeMask, maskComposite: 'intersect'}}
            />
            <Sparkle x={cupL + cupW * 0.32} y={cupT + cupW * 0.1} s={0.9 * sparkle(T.cta + 20)} />
            <Sparkle x={cupL + cupW * 0.74} y={cupT + cupW * 0.18} s={0.65 * sparkle(T.cta + 27)} />
            <Sparkle x={cupL + cupW * 0.55} y={cupT + cupW * 0.05} s={0.8 * sparkle(T.end - 26)} />
          </div>
        </div>
      ) : null}
    </>
  );
};
