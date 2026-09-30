#!/usr/bin/env bash
# Re-render every compositing recipe from scratch; fail if an output is missing, has no video
# stream, is the wrong length, blank (frame at 60%) or static (first vs 60% frame).
# Frames for eyeballing land in out/frames/ (+ contact.jpg).
set -euo pipefail
cd "$(dirname "$0")"
export LC_ALL=C.UTF-8

rm -rf out
mkdir -p out/frames out/luts

step() {  # step <label> <cmd...>: run quietly, print timing, stop on failure
  local label=$1 t0=$SECONDS; shift
  if ! nice -n 10 "$@" > "out/$label.log" 2>&1; then
    echo "FAIL: $label ($*)"; tail -n 15 "out/$label.log"; exit 1
  fi
  echo "ran:  $label ($((SECONDS - t0))s)"
}

step facade      python3 facade.py
step lut         python3 luts/make_lut.py -o out/luts/acumen-warm-night.cube
step lut-example python3 luts/make_lut.py --brand brands/example.json -o out/luts/example-night.cube
step ken-burns   ./ken-burns.sh
step light-sweep python3 light_sweep.py
step xfade       ./xfade.sh -t softwipe -c 2.4 -d 0.8
step glow        ./glow.sh
step grade       ./grade.sh
step grade-cmp   ./grade.sh -c -o out/grade-compare.mp4
step grade-ex    ./grade.sh -l out/luts/example-night.cube -o out/grade-example.mp4
step grain       ./grain-vignette.sh -b 2.39
step finish      ./finish.sh
step title       ./title.sh -i out/light-sweep.mp4 -p lower
step title-ex    env BRAND=brands/example.json ./title.sh -o out/title-example.mp4
step mlt         ./mlt.sh
step moviepy     python3 moviepy_promo.py

fail=0
bad() { echo "FAIL: $*"; fail=1; }

cmp -s out/luts/acumen-warm-night.cube luts/acumen-warm-night.cube ||
  bad "luts/acumen-warm-night.cube is stale: python3 luts/make_lut.py"
[[ -s out/samples/facade.png ]] || bad "out/samples/facade.png missing"
if ffmpeg -hide_banner -buildconf | grep -q enable-libharfbuzz && ffmpeg -hide_banner -h filter=drawtext | grep -q text_shaping; then
  echo "ok:   ffmpeg drawtext/libass shape Arabic (libharfbuzz + libfribidi)"
else
  bad "this ffmpeg cannot shape Arabic text"
fi

check() {  # check <name> <seconds> [audio]
  local f=out/$1.mp4 dur mean max diff
  if [[ ! -s $f ]] || ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q video; then
    bad "$f missing or has no video stream"; return
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  ffmpeg -v error -y -i "$f" -vf "select=eq(n\,0)" -frames:v 1 "out/frames/$1_first.jpg"
  ffmpeg -v error -y -ss "$(awk -v d="$dur" 'BEGIN { print d * 0.6 }')" -i "$f" -frames:v 1 "out/frames/$1.jpg"
  ffmpeg -v error -y -sseof -0.1 -i "$f" -frames:v 1 -update 1 "out/frames/$1_last.jpg"
  read -r mean max <<< "$(convert "out/frames/$1.jpg" -colorspace Gray -format "%[fx:mean] %[fx:maxima]" info:)"
  diff=$({ compare -metric RMSE "out/frames/$1_first.jpg" "out/frames/$1.jpg" null: 2>&1 || true; } | sed -E 's/.*\((.*)\)/\1/')
  if ! awk -v d="$dur" -v want="$2" -v m="$mean" -v x="$max" -v r="$diff" \
       'BEGIN { exit !(d > want - 0.15 && d < want + 0.15 && m > 0.01 && x > 0.2 && r > 0.004) }'; then
    bad "$f  dur=$dur (want $2)  mean=$mean max=$max first/mid rmse=$diff: wrong length, blank or static"; return
  fi
  if [[ ${3:-} == audio ]] && ! ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q audio; then
    bad "$f has no audio stream"; return
  fi
  printf 'ok:   %-26s %5.2fs  mean=%.3f max=%.2f motion=%.3f %s\n' "$f" "$dur" "$mean" "$max" "$diff" "${3:-}"
}
check ken-burns 4
check light-sweep 4
check xfade 4
check glow 4
check grade 4
check grade-compare 4
check grade-example 4
check grain-vignette 4
check finish 4
check title 4
check title-example 4
check mlt 4
check moviepy-promo 4 audio

montage out/frames/{ken-burns,light-sweep,xfade,glow,grade-compare,grain-vignette,finish,title,title-example,mlt,moviepy-promo}.jpg \
  -tile 3x -geometry 426x240+4+4 -background '#111' out/frames/contact.jpg 2>/dev/null && echo "contact sheet: out/frames/contact.jpg"
exit $fail
