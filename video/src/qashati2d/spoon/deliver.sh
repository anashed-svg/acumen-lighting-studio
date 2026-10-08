#!/usr/bin/env bash
# «ملعقة وحدة بس» — delivery encode for social (same recipe as spot #2's src/qashati2/deliver.sh):
# Remotion renders JPEG frames → full-range BT.601 YCbCr (yuvj420p). Convert the matrix explicitly to BT.709 limited
# range and tag it (otherwise players show the brand turquoise as a blue-cyan), mux the 24-bit MASTER WAV instead of
# the render's own AAC (no double-lossy audio, no 2048-sample AAC priming drift = the 42.7 ms late audio of a plain
# Remotion MP4), and put the moov atom first for instant playback.
#
#   nice -n 10 npx remotion render src/qashati2d/spoon/index.ts OneSpoon out/qashati2d/spoon/render.mp4 --concurrency=3
#   bash src/qashati2d/spoon/deliver.sh out/qashati2d/spoon/render.mp4 out/qashati2d/spoon.wav out/qashati2d/spoon/one-spoon-vN.mp4
# (the WAV comes from: nice -n 10 python3 src/qashati2d/spoon/audio/make_sound.py)
set -euo pipefail
in=${1:?render.mp4}; wav=${2:?master.wav}; out=${3:?out.mp4}
ffmpeg -v error -y -i "$in" -i "$wav" -map 0:v:0 -map 1:a:0 \
  -vf "scale=in_range=pc:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.1 \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$out"
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,color_range,color_space:format=duration,size -of compact "$out"
