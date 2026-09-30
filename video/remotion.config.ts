import fs from 'node:fs';
import path from 'node:path';
import {Config} from '@remotion/cli/config';
import {enableSkia} from '@remotion/skia/enable';
import {enableTailwind} from '@remotion/tailwind-v4';

// Assets (logo, fonts, footage, music) live in ./public — reference them with staticFile().
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// yuv420p plays everywhere (JPEG frames would otherwise give full-range yuvj420p).
Config.setPixelFormat('yuv420p');
// Skia (GPU-style shaders / 2D canvas) and Tailwind v4 (import src/tailwind.css where used).
// @shopify/react-native-skia imports `react-native`, which on the web is react-native-web.
Config.overrideWebpackConfig((config) => {
  const withPlugins = enableTailwind(enableSkia(config));
  return {
    ...withPlugins,
    resolve: {
      ...withPlugins.resolve,
      alias: {
        ...(withPlugins.resolve?.alias as Record<string, string | false> | undefined),
        'react-native$': 'react-native-web',
      },
    },
  };
});

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
  // No GPU here: ANGLE on Mesa llvmpipe is ~2x faster than the SwiftShader fallback for WebGL.
  Config.setChromiumOpenGlRenderer('angle-egl');
}
