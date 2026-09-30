#!/usr/bin/env bash
# Installs the video-production toolchain (ffmpeg, fonts, Python + Node video libs).
# Safe to re-run. Usage:  bash scripts/setup-video-tools.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> System packages (ffmpeg, ImageMagick, audio, fonts, Blender, Synfig, Inkscape, MLT, LaTeX)"
$SUDO apt-get update -qq || true   # some third-party PPAs may be unreachable; ignore
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq --no-install-recommends \
  ffmpeg imagemagick sox libsox-fmt-mp3 mediainfo librsvg2-bin webp gifsicle fontconfig \
  fonts-noto-core fonts-noto-color-emoji fonts-hosny-amiri fonts-kacst \
  fonts-inter fonts-roboto-unhinted fonts-liberation fonts-dejavu-core \
  blender synfig inkscape melt frei0r-plugins potrace \
  libcairo2-dev libpango1.0-dev pkg-config \
  texlive-latex-base texlive-latex-extra texlive-fonts-recommended texlive-science dvisvgm \
  xvfb xauth libgl1-mesa-dri libegl1 libegl-mesa0 libglu1-mesa mesa-utils
$SUDO fc-cache -f >/dev/null

echo "==> Brand fonts (Google Fonts, OFL)"
bash "$ROOT/scripts/install-fonts.sh"

echo "==> Python video libraries"
# Debian's bundled pip/setuptools can't build some sdists (manim deps); use fresh ones.
python3 -m pip install -q --upgrade --ignore-installed pip setuptools wheel
python3 -m pip install -q --upgrade -r "$ROOT/requirements-video.txt"

echo "==> Remotion (React motion graphics) in ./video"
(cd "$ROOT/video" && npm ci --no-audit --no-fund --loglevel=error)

echo "==> Done"
ffmpeg -version | head -1
