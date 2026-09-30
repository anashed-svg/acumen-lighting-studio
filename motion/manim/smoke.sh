#!/usr/bin/env bash
# Re-render the Manim samples from scratch and fail if any output is missing or broken.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf out/videos out/images out/frames
mkdir -p out/frames

render() { nice -n 10 python3 -m manim --progress_bar none -v WARNING "$@"; }
render scenes.py LogoReveal -o LogoReveal
render scenes.py BeamAngle -o BeamAngle
BRAND_JSON=brands/example.json render -s scenes.py LogoReveal -o example_LogoReveal

fail=0
for name in LogoReveal BeamAngle; do
  f=out/videos/$name.mp4
  if [[ ! -s $f ]] || ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q video; then
    echo "FAIL: $f missing or has no video stream"; fail=1; continue
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ffmpeg -v error -y -ss 3.0 -i "$f" -frames:v 1 -vf scale=640:-1 "out/frames/$name.jpg"
  mean=$(convert "out/frames/$name.jpg" -colorspace Gray -format "%[fx:mean]" info:)
  echo "ok: $f  ${dur}s  frame@3s mean=$mean"
  awk -v d="$dur" -v m="$mean" 'BEGIN { exit !(d > 0 && d <= 4.05 && m > 0.01) }' || { echo "FAIL: $f too long or blank"; fail=1; }
done
[[ -s out/images/example_LogoReveal.png ]] && echo "ok: out/images/example_LogoReveal.png (BRAND_JSON re-skin)" \
  || { echo "FAIL: re-skin still missing"; fail=1; }
exit $fail
