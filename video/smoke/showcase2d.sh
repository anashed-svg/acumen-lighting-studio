#!/usr/bin/env bash
# Re-renders the Remotion 2D showcase (16:9 samples) from scratch and checks each output.
# Usage: bash video/smoke/showcase2d.sh            (from any directory)
set -euo pipefail
cd "$(dirname "$0")/.."

ENTRY=src/showcase2d/index.ts
OUT=out/showcase2d
IDS=(LogoDraw KineticType TransitionsReel)

npx tsc -p src/showcase2d  # this area only; `npx tsc` checks the whole project
mkdir -p "$OUT"
for id in "${IDS[@]}"; do rm -f "$OUT/$id.mp4"; done

failed=0
for id in "${IDS[@]}"; do
  file="$OUT/$id.mp4"
  echo "▸ rendering $id"
  # LightLeak and Starburst are WebGL; the default GL backend (SwiftShader) handles them on CPU.
  nice -n 10 npx remotion render "$ENTRY" "$id" "$file" --log=error || true
  if [[ ! -s "$file" ]]; then
    echo "✗ $id: no output"; failed=1; continue
  fi
  info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type,width,height,nb_frames -of csv=p=0 "$file" || true)
  if [[ "$info" != video,* ]]; then
    echo "✗ $id: no video stream"; failed=1; continue
  fi
  echo "✓ $id ($info)"
done

exit "$failed"
