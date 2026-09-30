// Headless render through the Motion Canvas editor (vite dev server + Chromium via playwright-core):
//   node render.mjs [brands/x.json] [--png] [out-name.mp4]
// --png switches the exporter to "Image sequence" for this run (out/project/*.png).
import {existsSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const png = args.includes('--png');
const brandFile = args.find(a => a.endsWith('.json'));
const outName = args.find(a => a.endsWith('.mp4')) ?? 'motion-canvas-demo.mp4';
if (brandFile) process.env.BRAND = brandFile; // read by vite.config.ts
process.env.VITE_CJS_IGNORE_WARNING ??= 'true'; // the MC plugins still load Vite's CJS build

const CHROME = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => p && existsSync(p));
const META = 'src/project.meta';
const meta = readFileSync(META, 'utf8'); // the editor saves UI changes into project.meta; restored below

const {createServer} = await import('vite');
const {chromium} = await import('playwright-core');

const started = Date.now();
const server = await createServer({logLevel: 'warn', server: {port: Number(process.env.PORT ?? 9410)}});
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage']});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 900}});
  // The editor UI pulls its own fonts/CSS from CDNs and checks npm for updates — not needed offline.
  await page.route(u => u.origin !== new URL(url).origin, r => r.abort());
  page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

  await page.goto(url);
  const render = page.getByRole('button', {name: 'Render', exact: true});
  await render.waitFor({timeout: 60_000});
  // Pick the exporter explicitly, whatever was last chosen in the editor.
  const exporter = png ? 'Image sequence' : 'Video (FFmpeg)';
  await page.locator('select:has(option:text("Image sequence"))').selectOption({label: exporter});

  rmSync(png ? 'out/project' : 'out/project.mp4', {recursive: true, force: true});
  await render.click();
  await page.getByRole('button', {name: 'Abort', exact: true}).waitFor({timeout: 30_000}).catch(() => {});
  await render.waitFor({timeout: 5 * 60_000}); // "Abort" turns back into "Render" when done
} finally {
  await browser.close();
  await server.close();
  if (readFileSync(META, 'utf8') !== meta) writeFileSync(META, meta);
}

if (errors.length) console.error('editor errors:\n' + errors.join('\n'));
const result = png ? 'out/project' : `out/${outName}`;
if (!png && existsSync('out/project.mp4')) renameSync('out/project.mp4', result);
if (!existsSync(result)) throw new Error(`render produced no ${result}`);
console.log(`rendered ${result} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
