import {Composition} from 'remotion';
import {AcumenIntro} from './AcumenIntro';
import {Showcase2DCompositions} from './showcase2d/compositions';
import {Showcase3DCompositions} from './showcase3d/compositions';
import {ShowcaseFxCompositions} from './showcaseFx/compositions';

export const Root: React.FC = () => (
  <>
    {/* 16:9 — YouTube, website, presentations */}
    <Composition id="AcumenIntro" component={AcumenIntro} durationInFrames={150} fps={30} width={1920} height={1080} />
    {/* 9:16 — Reels, TikTok, Shorts */}
    <Composition id="AcumenIntroVertical" component={AcumenIntro} durationInFrames={150} fps={30} width={1080} height={1920} />
    {/* Templates: logo draw, kinetic type, transitions */}
    <Showcase2DCompositions />
    {/* Three.js, Lottie, Theatre.js, Rive, SVG 3D */}
    <Showcase3DCompositions />
    {/* Skia shaders, Tailwind lower third, social captions */}
    <ShowcaseFxCompositions />
  </>
);
