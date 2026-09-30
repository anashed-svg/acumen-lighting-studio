#!/usr/bin/env bash
# Installs the video-production toolchain (ffmpeg, fonts, Python + Node video libs).
# Safe to re-run. Usage:  bash scripts/setup-video-tools.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> System packages (ffmpeg, ImageMagick, audio, fonts)"
$SUDO apt-get update -qq || true   # some third-party PPAs may be unreachable; ignore
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq --no-install-recommends \
  ffmpeg imagemagick sox libsox-fmt-mp3 mediainfo librsvg2-bin webp gifsicle fontconfig \
  fonts-noto-core fonts-noto-color-emoji fonts-hosny-amiri fonts-kacst \
  fonts-inter fonts-roboto-unhinted fonts-liberation fonts-dejavu-core
$SUDO fc-cache -f >/dev/null

echo "==> Python video libraries"
python3 -m pip install -q --upgrade -r "$ROOT/requirements-video.txt"

echo "==> Remotion (React motion graphics) in ./video"
(cd "$ROOT/video" && npm ci --no-audit --no-fund --loglevel=error)

echo "==> Done"
ffmpeg -version | head -1
