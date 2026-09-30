import {readFileSync} from 'node:fs';
import {defineConfig} from 'vite';
import motionCanvasPlugin from '@motion-canvas/vite-plugin';
import ffmpegPlugin from '@motion-canvas/ffmpeg';

// Both plugins are CJS; under "type": "module" their factory sits on `.default`.
const cjs = <T,>(m: T): T => (m as any).default ?? m;
// BRAND=brands/x.json overrides keys of src/brand.ts (exposed to the scene as __BRAND__).
const brand = process.env.BRAND ? JSON.parse(readFileSync(process.env.BRAND, 'utf8')) : {};

export default defineConfig({
  plugins: [cjs(motionCanvasPlugin)({output: './out'}), cjs(ffmpegPlugin)()],
  define: {__BRAND__: JSON.stringify(brand)},
  server: {port: Number(process.env.PORT ?? 9000)},
  build: {outDir: 'out/dist'},
});
