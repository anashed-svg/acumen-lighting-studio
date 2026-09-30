// Headless render: node render.mjs [brands/x.json] [out-name.mp4]  → out/
import {existsSync, readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(dirname(fileURLToPath(import.meta.url)));
process.env.DISABLE_TELEMETRY ??= 'true'; // Revideo otherwise pings PostHog
// Prefer the system ffmpeg (6.x) over the 2018 static build from @ffmpeg-installer.
for (const [key, bin] of [['FFMPEG_PATH', '/usr/bin/ffmpeg'], ['FFPROBE_PATH', '/usr/bin/ffprobe']]) {
  if (!process.env[key] && existsSync(bin)) process.env[key] = bin;
}

const CHROME = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find(p => p && existsSync(p));

const args = process.argv.slice(2);
const brandFile = args.find(a => a.endsWith('.json'));
const outFile = args.find(a => a.endsWith('.mp4')) ?? 'revideo-demo.mp4';
const variables = brandFile ? JSON.parse(readFileSync(brandFile, 'utf8')) : {};

const {renderVideo} = await import('@revideo/renderer');
const started = Date.now();
const file = await renderVideo({
  projectFile: './src/project.ts',
  variables,
  settings: {
    outFile,
    outDir: './out',
    workers: 1,
    logProgress: false,
    viteBasePort: Number(process.env.REVIDEO_PORT ?? 9320),
    puppeteer: {
      headless: true,
      ...(CHROME && {executablePath: CHROME}),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    },
    projectSettings: {exporter: {name: '@revideo/core/ffmpeg', options: {format: 'mp4'}}},
  },
});
console.log(`rendered ${file} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
