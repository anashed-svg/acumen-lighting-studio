#!/usr/bin/env bash
# Finishing texture: optical vignette + temporal luma-only film grain (+ optional letterbox bars).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() { echo "usage: grain-vignette.sh [-i in.mp4] [-o out.mp4] [-g grain 0..40] [-v vignette angle rad, 0=off] [-b bars aspect e.g. 2.39]"; }
in="" out=$OUT/grain-vignette.mp4 g=9 v=0.55 bars=""
while getopts "i:o:g:v:b:h" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; g) g=$OPTARG ;; v) v=$OPTARG ;; b) bars=$OPTARG ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
[[ -n $in ]] || in=$(sample_clip)
graph="[0:v]$(fg_grain_vignette "$g" "$v")"
[[ -n $bars ]] && graph+=",$(fg_bars "$bars")"
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y -i "$in" -filter_complex "$graph,format=yuv420p" -map 0:a? -c:a copy "${X264[@]}" "$out"
done_msg "$out"
