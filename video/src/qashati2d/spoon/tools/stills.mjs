// Fast stills for the spoon spot: ONE bundle, ONE browser, many frames (+ 360-px copies + contact sheets).
//   node src/qashati2d/spoon/tools/stills.mjs <outdir> <frame> [<frame> …]      (from video/; set NOBUNDLE=1 to reuse)
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [out, ...frames] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const bundleDir = path.resolve('out/qashati2d/spoon/.bundle');
const serveUrl = bundleDir;
if (!process.env.NOBUNDLE || !fs.existsSync(bundleDir)) {
  // the CLI bundle applies remotion.config.ts (webpack overrides)
  execFileSync('npx', ['remotion', 'bundle', 'src/qashati2d/spoon/index.ts', `--out-dir=${bundleDir}`, '--log=error'], {stdio: 'inherit'});
}
// cloud: no Remotion Chrome download — reuse the preinstalled Playwright headless shell (as remotion.config.ts does)
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
const shell = pw && fs.existsSync(pw)
  ? fs.readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell-')).map((d) => path.join(pw, d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p))
  : undefined;
const inputProps = {music: null};
const chromiumOptions = {gl: 'angle-egl'};
const browser = await openBrowser('chrome', {browserExecutable: shell ?? null, chromiumOptions});
const composition = await selectComposition({serveUrl, id: 'OneSpoon', inputProps, puppeteerInstance: browser, browserExecutable: shell ?? null, chromiumOptions});
const names = [];
for (const fr of frames.map(Number)) {
  const name = path.join(out, `f${String(fr).padStart(4, '0')}.png`);
  const t0 = Date.now();
  await renderStill({serveUrl, composition, frame: fr, output: name, inputProps, puppeteerInstance: browser, overwrite: true, browserExecutable: shell ?? null, chromiumOptions});
  execFileSync('convert', [name, '-resize', '360x', name.replace('.png', '_360.png')]);
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  names.push(name);
}
await browser.close({silent: true});
execFileSync('montage', [...names, '-tile', `${names.length}x1`, '-geometry', '360x640+6+6', '-background', '#222', path.join(out, 'sheet.jpg')]);
execFileSync('montage', [...names.map((n) => n.replace('.png', '_360.png')), '-tile', `${names.length}x1`, '-geometry', '+4+4', '-background', '#222', path.join(out, 'sheet_360.png')]);
console.log(path.join(out, 'sheet.jpg'));
