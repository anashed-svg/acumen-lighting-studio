// End card + title — fonts (local files, @remotion/fonts). Families come from ../spec.ts.
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONTS} from '../spec';

const load = (family: string, file: string, weight: string) => loadFont({family, url: staticFile(`qashati2/fonts/${file}`), weight});

load(FONTS.stamp, 'Lalezar-400.ttf', '400');
load(FONTS.ui, 'IBMPlexSansArabic-600.ttf', '600');
load(FONTS.ui, 'IBMPlexSansArabic-700.ttf', '700');
load(FONTS.latin, 'Poppins-500.ttf', '500');

export const STAMP_FONT = `'${FONTS.stamp}', sans-serif`;
export const INFO_FONT = `'${FONTS.ui}', 'Noto Color Emoji', sans-serif`;
export const LATIN_FONT = `'${FONTS.latin}', sans-serif`;
