#!/usr/bin/env bash
# Bloom / glow: highlights above -t are blurred at two radii (r and 4r), tinted, scaled by -s
# and screened back over the source (in planar RGB, so colours stay clean).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() { echo "usage: glow.sh [-i in.mp4] [-o out.mp4] [-s strength 0..2] [-r radius px] [-t threshold 0..1] [-c tint hex|none]"; }
in="" out=$OUT/glow.mp4 s=0.8 r=6 t=0.45 tint=$(hex glow)
while getopts "i:o:s:r:t:c:h" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; s) s=$OPTARG ;; r) r=$OPTARG ;; t) t=$OPTARG ;; c) tint=${OPTARG#\#} ;;
    h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
[[ -n $in ]] || in=$(sample_clip)
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y -i "$in" -filter_complex "[0:v]$(fg_glow "$s" "$r" "$t" "$tint"),format=yuv420p" \
  -map 0:a? -c:a copy "${X264[@]}" "$out"
done_msg "$out"
