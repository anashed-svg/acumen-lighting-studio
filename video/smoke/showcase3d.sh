#!/usr/bin/env bash
# Re-generates the showcase3d assets and renders every composition to out/showcase3d/<Id>.mp4.
# Fails if any render fails, an output is missing, or ffprobe finds no video stream.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=out/showcase3d
ENTRY=src/showcase3d/index.ts
# No GPU in the cloud: ANGLE on Mesa llvmpipe ("angle-egl") is ~2x faster than SwiftShader ("swangle").
GL="${REMOTION_GL:-angle-egl}"
IDS=(ThreeLightScene LottieShowcase TheatreKeyframes RiveDemo Svg3DLogo)
mkdir -p "$OUT"

python3 src/showcase3d/lottie/make_lighting_icons.py >/dev/null
python3 src/showcase3d/rive/make_riv.py >/dev/null

for id in "${IDS[@]}"; do
  rm -f "$OUT/$id.mp4"
  start=$(date +%s)
  nice -n 10 npx remotion render "$ENTRY" "$id" "$OUT/$id.mp4" --gl="$GL" --log=error
  echo "rendered $id in $(($(date +%s) - start))s"
done

fail=0
for id in "${IDS[@]}"; do
  f="$OUT/$id.mp4"
  if [[ ! -s "$f" ]]; then
    echo "MISSING $f" >&2
    fail=1
    continue
  fi
  info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,nb_frames -of csv=p=0 "$f" || true)
  if [[ -z "$info" ]]; then
    echo "NO VIDEO STREAM $f" >&2
    fail=1
  else
    echo "ok $f ($info)"
  fi
done
exit "$fail"
