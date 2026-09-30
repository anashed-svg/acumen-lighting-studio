#!/usr/bin/env bash
# Colour grade with a 3D LUT (lut3d, tetrahedral) mixed back over the source at -s strength.
# Default LUT: luts/acumen-warm-night.cube (regenerate/re-skin with luts/make_lut.py).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() { echo "usage: grade.sh [-i in.mp4] [-o out.mp4] [-l lut.cube] [-s strength 0..1] [-c]  (-c = before|after split)"; }
in="" out=$OUT/grade.mp4 lut=$HERE/luts/acumen-warm-night.cube s=1 compare=0
while getopts "i:o:l:s:ch" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; l) lut=$OPTARG ;; s) s=$OPTARG ;; c) compare=1 ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
[[ -n $in ]] || in=$(sample_clip)
[[ -s $lut ]] || python3 "$HERE/luts/make_lut.py" -o "$lut" >/dev/null
lut=$(realpath "$lut")
graph="[0:v]$(fg_grade "$lut" "$s")"
if ((compare)); then  # left half untouched, right half graded, hairline divider
  graph="[0:v]split[src][g];[g]$(fg_grade "$lut" "$s"),format=yuv420p[gr];[src]format=yuv420p[sr];
         [sr]crop=iw/2:ih:0:0[l];[gr]crop=iw/2:ih:iw/2:0[r];[l][r]hstack,drawbox=x=iw/2-1:y=0:w=2:h=ih:c=white@0.6:t=fill"
fi
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y -i "$in" -filter_complex "$graph,format=yuv420p" -map 0:a? -c:a copy "${X264[@]}" "$out"
done_msg "$out"
