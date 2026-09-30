#!/usr/bin/env bash
# Re-renders the showcaseFx samples (Skia shader, Tailwind lower third, social captions)
# from scratch and checks each output has a real, non-black video stream.
# Usage: bash video/smoke/showcaseFx.sh            (from any directory)
set -euo pipefail
cd "$(dirname "$0")/.."

ENTRY=src/showcaseFx/index.ts
OUT=out/showcaseFx
# id:expected-frames:min 90th-percentile luma (0-255) of the frame at 2.5 s. The scenes are mostly
# black on purpose, so this looks at the lit part (black = 0-16; the real Skia frame scores ~108).
CHECKS=(SkiaLightShader:120:70 BrandLowerThird:120:30 SocialCaptions:120:30)

npx tsc -p src/showcaseFx
mkdir -p "$OUT"
for check in "${CHECKS[@]}"; do rm -f "$OUT/${check%%:*}.mp4"; done

failed=0
for check in "${CHECKS[@]}"; do
  IFS=: read -r id frames min_luma <<<"$check"
  file="$OUT/$id.mp4"
  echo "▸ rendering $id"
  # CanvasKit draws through WebGL; swangle (ANGLE on SwiftShader) runs it on the CPU.
  nice -n 10 npx remotion render "$ENTRY" "$id" "$file" --gl=swangle --log=error || true
  if [[ ! -s "$file" ]]; then
    echo "✗ $id: no output"; failed=1; continue
  fi
  info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type,width,height,nb_frames -of csv=p=0 "$file" || true)
  info=${info%%,}
  if [[ "$info" != video,* ]]; then
    echo "✗ $id: no video stream"; failed=1; continue
  fi
  if [[ "${info##*,}" != "$frames" ]]; then
    echo "✗ $id: expected $frames frames, got ($info)"; failed=1; continue
  fi
  # A blank Skia canvas or a missing background still encodes fine, so look at the pixels too.
  luma=$(ffmpeg -v error -ss 2.5 -i "$file" -frames:v 1 -vf signalstats,metadata=print:key=lavfi.signalstats.YHIGH:file=- -f null - |
    sed -n 's/.*YHIGH=\([0-9.]*\).*/\1/p' | head -n1)
  if ! awk -v l="${luma:-0}" -v m="$min_luma" 'BEGIN { exit !(l >= m) }'; then
    echo "✗ $id: frame at 2.5 s is too dark (luma p90 ${luma:-?} < $min_luma)"; failed=1; continue
  fi
  echo "✓ $id ($info, luma p90 $luma)"
done

exit "$failed"
