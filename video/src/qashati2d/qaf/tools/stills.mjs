// Fast stills for the qaf spot: ONE bundle + ONE browser, many frames → PNGs, 360-px copies, labelled contact sheets.
//   node src/qashati2d/qaf/tools/stills.mjs <outdir> <frame> [<frame> …]   (from video/; prefix with nice -n 10)
//   env: SCALE (default 1), COMP (default QafDifference), PROPS (JSON, default {"audio":null}), SHEET (name, default sheet)
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [out, ...frames] = process.argv.slice(2);
if (!out || !frames.length) throw new Error('usage: stills.mjs <outdir> <frame…>');
fs.mkdirSync(out, {recursive: true});
const comp = process.env.COMP ?? 'QafDifference';
const scale = Number(process.env.SCALE ?? 1);
const inputProps = JSON.parse(process.env.PROPS ?? '{"audio":null}');
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
const exe =
  pw && fs.existsSync(pw)
    ? fs
        .readdirSync(pw)
        .filter((d) => d.startsWith('chromium_headless_shell-'))
        .map((d) => path.join(pw, d, 'chrome-linux', 'headless_shell'))
        .find((p) => fs.existsSync(p))
    : undefined;
const serveUrl = await bundle({entryPoint: path.resolve('src/qashati2d/qaf/index.ts'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {browserExecutable: exe ?? null, chromiumOptions: {gl: 'angle-egl'}});
const composition = await selectComposition({serveUrl, id: comp, inputProps, puppeteerInstance: browser, browserExecutable: exe ?? null});
const names = [];
for (const fr of frames.map(Number)) {
  const name = path.join(out, `f${String(fr).padStart(4, '0')}.png`);
  const t0 = Date.now();
  await renderStill({serveUrl, composition, frame: fr, output: name, inputProps, scale, puppeteerInstance: browser, browserExecutable: exe ?? null, overwrite: true});
  execFileSync('convert', [name, '-resize', '360x', name.replace(/\.png$/, '_360.png')]);
  names.push(name);
  console.log(`frame ${fr} → ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
await browser.close({silent: true});
const sheet = process.env.SHEET ?? 'sheet';
const labelled = names.flatMap((n) => ['-label', path.basename(n, '.png'), n]);
const tile = `${Math.min(names.length, 8)}x`;
execFileSync('montage', [...labelled, '-tile', tile, '-geometry', '360x640+6+6', '-background', '#222', '-fill', '#ddd', '-pointsize', '18', path.join(out, `${sheet}.jpg`)]);
const small = names.flatMap((n) => ['-label', path.basename(n, '.png'), n.replace(/\.png$/, '_360.png')]);
execFileSync('montage', [...small, '-tile', tile, '-geometry', '+4+4', '-background', '#222', '-fill', '#ddd', '-pointsize', '14', path.join(out, `${sheet}_360.png`)]);
console.log(path.join(out, `${sheet}.jpg`));
