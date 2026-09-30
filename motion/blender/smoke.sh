#!/usr/bin/env bash
# Re-render the Blender samples from scratch and fail if any output is missing, blank or static.
# Engine: Cycles CPU 16 spp + Intel OIDN (pyoidn) = the fastest engine that looks right on this box.
set -euo pipefail
cd "$(dirname "$0")"
ENGINE=${ENGINE:-CYCLES}

rm -rf out/villa* out/logo* out/frames
mkdir -p out/frames

render() {  # render <name> <script> [args...]
  local name=$1 script=$2; shift 2
  if ! nice -n 10 blender -b --factory-startup -P "$script" -- --out "out/$name" --engine "$ENGINE" \
       --res 640x360 --samples 16 "$@" > "out/$name.log" 2>&1; then
    echo "FAIL: $script $* (log: out/$name.log)"; tail -n 15 "out/$name.log"; exit 1
  fi
  grep '^\[acumen\]' "out/$name.log" | tail -n 1
}
render villa scene.py --frames 24
render logo logo.py --frames 48
render logo_example logo.py --frames 12 --brand brands/example.json --transparent

fail=0
check() {  # check <name> <frames>
  local f=out/$1.mp4 n
  if [[ ! -s $f ]] || ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q video; then
    echo "FAIL: $f missing or has no video stream"; fail=1; return
  fi
  n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
  ffmpeg -v error -y -i "$f" -vf "select=eq(n\,0)" -frames:v 1 "out/frames/$1_first.jpg"
  ffmpeg -v error -y -sseof -0.05 -i "$f" -frames:v 1 -update 1 "out/frames/$1_last.jpg"
  local stats mean max diff
  stats=$(convert "out/frames/$1_last.jpg" -colorspace Gray -format "%[fx:mean] %[fx:maxima]" info:)
  read -r mean max <<< "$stats"
  diff=$({ compare -metric RMSE "out/frames/$1_first.jpg" "out/frames/$1_last.jpg" null: 2>&1 || true; } | sed -E 's/.*\((.*)\)/\1/')
  if awk -v n="$n" -v want="$2" -v m="$mean" -v x="$max" -v d="$diff" \
       'BEGIN { exit !(n == want && m > 0.003 && x > 0.3 && d > 0.004) }'; then
    echo "ok: $f  frames=$n  last frame mean=$mean max=$max  first/last rmse=$diff"
  else
    echo "FAIL: $f  frames=$n (want $2)  mean=$mean max=$max  rmse=$diff: wrong length, blank or static"; fail=1
  fi
}
check villa 24
check logo 48
check logo_example 12
if ffprobe -v error -show_entries stream=codec_name,pix_fmt -of csv=p=0 out/logo_example.mov | grep -q 'prores,yuva'; then
  echo "ok: out/logo_example.mov (ProRes 4444 with alpha, brands/example.json re-skin)"
else
  echo "FAIL: out/logo_example.mov missing or without alpha"; fail=1
fi
exit $fail
