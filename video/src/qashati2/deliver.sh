#!/usr/bin/env bash
# Delivery encode for social: Remotion renders JPEG frames → full-range BT.601 YCbCr (yuvj420p).
# Convert the matrix explicitly to BT.709 limited range, tag it, mux the master WAV (no double-lossy
# audio, no AAC priming drift from the render), and put the moov atom first for instant playback.
# Usage: bash src/qashati2/deliver.sh out/qashati2/render.mp4 out/qashati2/mish-qashta.wav out/qashati2/mish-qashta-vN.mp4
set -euo pipefail
in=${1:?render.mp4}; wav=${2:?master.wav}; out=${3:?out.mp4}
ffmpeg -v error -y -i "$in" -i "$wav" -map 0:v:0 -map 1:a:0 \
  -vf "scale=in_range=pc:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.1 \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$out"
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,color_range,color_space:format=duration,size -of compact "$out"
