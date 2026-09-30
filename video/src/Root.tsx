import {Composition} from 'remotion';
import {AcumenIntro} from './AcumenIntro';

export const Root: React.FC = () => (
  <>
    {/* 16:9 — YouTube, website, presentations */}
    <Composition id="AcumenIntro" component={AcumenIntro} durationInFrames={150} fps={30} width={1920} height={1080} />
    {/* 9:16 — Reels, TikTok, Shorts */}
    <Composition id="AcumenIntroVertical" component={AcumenIntro} durationInFrames={150} fps={30} width={1080} height={1920} />
  </>
);
