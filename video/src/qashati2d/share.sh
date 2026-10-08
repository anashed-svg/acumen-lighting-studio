#!/usr/bin/env bash
# Size-capped copy of a delivered spot (2-pass x264 at a computed bitrate, same BT.709 tags, audio copied).
# The textured 2D look (grain/halftone) makes CRF files big; platforms re-encode to ~4–8 Mbps anyway.
# Usage: bash src/qashati2d/share.sh in.mp4 out.mp4 [maxMiB=28]
set -euo pipefail
in=${1:?in}; out=${2:?out}; cap=${3:-28}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
kbps=$(python3 -c "print(int(($cap*1024*1024*8/$dur)/1000*0.95 - 260))")
log=$(mktemp -d)/x264
common=(-c:v libx264 -preset slow -b:v ${kbps}k -maxrate $((kbps*3/2))k -bufsize $((kbps*2))k -profile:v high -level 4.1
        -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709)
ffmpeg -v error -y -i "$in" -map 0:v:0 "${common[@]}" -pass 1 -passlogfile "$log" -an -f null /dev/null
ffmpeg -v error -y -i "$in" -map 0:v:0 -map 0:a:0 "${common[@]}" -pass 2 -passlogfile "$log" -c:a copy -movflags +faststart "$out"
echo "$(basename "$out"): ${kbps} kbps → $(du -m "$out" | cut -f1) MiB"
