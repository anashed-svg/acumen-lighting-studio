#!/usr/bin/env bash
# Re-render the Revideo samples from scratch; fail if an output is missing, blank or static.
set -euo pipefail
cd "$(dirname "$0")"
export PUPPETEER_SKIP_DOWNLOAD=1 DISABLE_TELEMETRY=true

[[ -d node_modules/@revideo/renderer ]] || npm ci --no-fund --no-audit
npx tsc -p .

rm -rf out && mkdir -p out/frames
nice -n 10 node render.mjs
nice -n 10 node render.mjs brands/example.json example.mp4

fail=0
check() {
  local f=$1 name dur mean motion
  name=$(basename "$f" .mp4)
  if [[ ! -s $f ]] || ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q video; then
    echo "FAIL: $f missing or has no video stream"; fail=1; return
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ffmpeg -v error -y -ss 1.0 -i "$f" -frames:v 1 -vf scale=640:-1 "out/frames/$name-1.0s.jpg"
  ffmpeg -v error -y -ss 3.5 -i "$f" -frames:v 1 -vf scale=640:-1 "out/frames/$name-3.5s.jpg"
  mean=$(convert "out/frames/$name-3.5s.jpg" -colorspace Gray -format "%[fx:mean]" info:)
  motion=$(compare -metric RMSE "out/frames/$name-1.0s.jpg" "out/frames/$name-3.5s.jpg" null: 2>&1 | sed -E 's/.*\((.*)\)/\1/' || true)
  echo "$f  ${dur}s  mean@3.5s=$mean  diff(1s,3.5s)=$motion"
  awk -v d="$dur" -v m="$mean" -v x="$motion" 'BEGIN { exit !(d > 3.5 && d <= 4.2 && m > 0.01 && x > 0.005) }' \
    || { echo "FAIL: $f has the wrong length, is blank or does not move"; fail=1; }
}
check out/revideo-demo.mp4
check out/example.mp4
[[ $fail == 0 ]] && echo "revideo smoke: OK"
exit $fail
