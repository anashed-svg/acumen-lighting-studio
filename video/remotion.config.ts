import fs from 'node:fs';
import path from 'node:path';
import {Config} from '@remotion/cli/config';

// Assets (logo, fonts, footage, music) live in ./public — reference them with staticFile().
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Cloud sessions can't download Remotion's own Chrome, so reuse the preinstalled
// Playwright headless shell when there is one. Locally Remotion downloads its own.
const pwDir = process.env.PLAYWRIGHT_BROWSERS_PATH;
const headlessShell =
  pwDir && fs.existsSync(pwDir)
    ? fs
        .readdirSync(pwDir)
        .filter((d) => d.startsWith('chromium_headless_shell-'))
        .map((d) => path.join(pwDir, d, 'chrome-linux', 'headless_shell'))
        .find((p) => fs.existsSync(p))
    : undefined;
if (headlessShell) {
  Config.setBrowserExecutable(headlessShell);
}
