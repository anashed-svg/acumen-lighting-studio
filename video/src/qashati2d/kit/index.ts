// Entry for the kit's own test compositions (style frames). Spots import from './kit' modules directly.
//   npx remotion still src/qashati2d/kit/index.ts Kit2DStyleFrames out/qashati2d/kit/frame.png --frame=30
import {registerRoot} from 'remotion';
import {Kit2DRoot} from './Root';

registerRoot(Kit2DRoot);
