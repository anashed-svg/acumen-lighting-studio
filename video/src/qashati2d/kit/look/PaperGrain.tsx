// Paper grain overlay: put it LAST in a scene (over everything, including text). Two pre-rendered textures
// (kit/tools/make_textures.py): a near-white grain multiplied over the frame (tooth, fibres, specks, soft blotches)
// and near-black light fibres screened on top (they show on dark ink). On twos the sheet is shifted to another spot —
// a new "photograph" every drawing, like stop-motion — unless `still`.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {rng} from '../geom';
import {H, W} from '../stage';

export const PAPER_MULTIPLY = 'qashati2d/textures/paper-multiply.jpg';
export const PAPER_SCREEN = 'qashati2d/textures/paper-screen.jpg';
const TW = 1188;
const TH = 2112;

export const PaperGrain: React.FC<{
  /** 0..1.5 — opacity of the multiply grain (1 = default look) */
  strength?: number;
  /** 0..1.5 — opacity of the light fibres */
  fibres?: number;
  /** hold the sheet still (no shift on twos) */
  still?: boolean;
  /** subtle print vignette (darker corners) 0..1 */
  vignette?: number;
  frame?: number;
}> = ({strength = 1, fibres = 0.8, still = false, vignette = 0.35, frame}) => {
  const cur = useCurrentFrame();
  const f = frame ?? cur;
  const k = still ? 0 : Math.floor(f / 2);
  const r = rng(9001 + k * 7);
  const dx = still ? -(TW - W) / 2 : -Math.round(r() * (TW - W));
  const dy = still ? -(TH - H) / 2 : -Math.round(r() * (TH - H));
  const flip = !still && r() < 0.5;
  const img = (src: string, blend: React.CSSProperties['mixBlendMode'], opacity: number) => (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        left: dx,
        top: dy,
        width: TW,
        height: TH,
        mixBlendMode: blend,
        opacity,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {strength > 0 ? img(PAPER_MULTIPLY, 'multiply', Math.min(1, strength)) : null}
      {strength > 1 ? img(PAPER_MULTIPLY, 'multiply', strength - 1) : null}
      {fibres > 0 ? img(PAPER_SCREEN, 'screen', Math.min(1, fibres)) : null}
      {vignette > 0 ? (
        <AbsoluteFill
          style={{
            mixBlendMode: 'multiply',
            opacity: vignette,
            background: 'radial-gradient(ellipse 75% 62% at 50% 46%, rgba(255,255,255,0) 55%, rgba(120,100,70,0.22) 100%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
