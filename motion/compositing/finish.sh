#!/usr/bin/env bash
# One-pass finishing chain (single encode, no generation loss): LUT grade -> bloom -> vignette + grain [-> bars].
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() { echo "usage: finish.sh [-i in.mp4] [-o out.mp4] [-l lut.cube] [-G grade 0..1] [-w glow 0..2] [-g grain] [-v vignette rad] [-b bars aspect]"; }
in="" out=$OUT/finish.mp4 lut=$HERE/luts/acumen-warm-night.cube G=0.85 glow=0.45 g=7 v=0.5 bars=""
while getopts "i:o:l:G:w:g:v:b:h" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; l) lut=$OPTARG ;; G) G=$OPTARG ;; w) glow=$OPTARG ;;
    g) g=$OPTARG ;; v) v=$OPTARG ;; b) bars=$OPTARG ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
[[ -n $in ]] || in=$(sample_clip)
[[ -s $lut ]] || python3 "$HERE/luts/make_lut.py" -o "$lut" >/dev/null
graph="[0:v]$(fg_grade "$(realpath "$lut")" "$G"),$(fg_glow "$glow" 6 0.45 "$(hex glow)"),$(fg_grain_vignette "$g" "$v")"
[[ -n $bars ]] && graph+=",$(fg_bars "$bars")"
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y -i "$in" -filter_complex "$graph,format=yuv420p" -map 0:a? -c:a copy "${X264[@]}" "$out"
done_msg "$out"
