#!/usr/bin/env bash
# Re-render every vector sample from scratch; fail if an output is missing, blank, static or has no video stream.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf out/lottie out/synfig out/svg out/inkscape out/vectorize out/frames
mkdir -p out/frames out/vectorize
fail=0
bad() { echo "FAIL: $*"; fail=1; }
run() { echo "» $*"; nice -n 10 "$@"; }
ex() { BRAND_JSON=brands/example.json run "$@"; }

run python3 make_lottie.py --mp4 --gif
ex python3 make_lottie.py --still 3.8
run python3 svg_draw.py
run python3 svg_draw.py --still 3.8
ex python3 svg_draw.py --still 2.5
run python3 render_synfig.py
ex python3 render_synfig.py --still 3.8

run ./inkscape_export.sh ../../video/public/logo-white.svg
run ./inkscape_export.sh out/svg/acumen_3.8s.svg
run ./inkscape_export.sh assets/tagline-text.svg --paths
run ./inkscape_export.sh assets/tagline-text.svg --pdf

convert ../../video/public/logo-white.png -background black -alpha remove -resize 700x -quality 85 out/vectorize/white-on-black.jpg
run ./vectorize.sh assets/sample-client-logo.jpg                     # dark on light (auto)
run ./vectorize.sh ../../video/public/logo-white.png                  # transparent PNG (alpha)
run ./vectorize.sh out/vectorize/white-on-black.jpg --color '#FFC478' # light on dark (auto invert)

echo "── checks"
for f in out/lottie/acumen.mp4 out/synfig/acumen.mp4 out/svg/acumen.mp4; do
  n=$(basename "$(dirname "$f")")
  if [[ ! -s $f ]] || ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$f" | grep -q video; then
    bad "$f missing or has no video stream"; continue
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  for t in 0.5 3.5; do ffmpeg -v error -y -ss $t -i "$f" -frames:v 1 -vf scale=640:-1 "out/frames/${n}_$t.png"; done
  mean=$(convert "out/frames/${n}_3.5.png" -colorspace Gray -format "%[fx:mean]" info:)
  diff=$(compare -metric RMSE "out/frames/${n}_0.5.png" "out/frames/${n}_3.5.png" null: 2>&1 || true)  # exits 1 if different
  diff=$(sed 's/.*(\(.*\))/\1/' <<<"$diff")
  echo "ok? $f  ${dur}s  mean@3.5s=$mean  change 0.5→3.5s=$diff"
  awk -v d="$dur" -v m="$mean" -v c="$diff" 'BEGIN { exit !(d > 0 && d <= 4.05 && m > 0.01 && c > 0.01) }' \
    || bad "$f too long, blank or not moving"
done

frames=$(identify out/lottie/acumen.gif 2>/dev/null | wc -l)
[[ $frames -gt 10 ]] && echo "ok: out/lottie/acumen.gif ($frames frames)" || bad "gif missing or static"
for j in out/lottie/acumen.json out/lottie/example.json assets/acumen-lines.json; do
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d['layers'] and d['op'] > d['ip']" "$j" \
    && echo "ok: $j" || bad "$j is not a Lottie animation"
done

check_png() {  # file min_width
  [[ -s $1 ]] && [[ $(identify -format %w "$1") -ge $2 ]] \
    && awk -v m="$(convert "$1" -colorspace Gray -format "%[fx:mean]" info:)" 'BEGIN { exit !(m > 0.005) }' \
    && echo "ok: $1" || bad "$1 missing, too small or blank"
}
check_png out/lottie/example_3.8s.png 1280
check_png out/svg/acumen_3.8s.png 1280
check_png out/svg/example_2.5s.png 1280
check_png out/synfig/example_3.8s.png 1280
check_png out/inkscape/logo-white_4k.png 3840
check_png out/inkscape/acumen_3.8s_4k.png 3840
[[ -s out/inkscape/tagline-text.pdf ]] && echo "ok: out/inkscape/tagline-text.pdf" || bad "pdf missing"
f=out/inkscape/tagline-text_paths.svg
[[ -s $f ]] && ! grep -q "<text" "$f" && echo "ok: $f (text baked to paths)" || bad "$f missing or still has <text>"

for spec in sample-client-logo:9 logo-white:13 white-on-black:10; do
  f=out/vectorize/${spec%%:*}.svg min=${spec##*:}
  n=$(grep -c "<path" "$f" 2>/dev/null || true)
  [[ ${n:-0} -ge $min && -s ${f%.svg}_preview.png ]] && echo "ok: $f ($n paths)" || bad "$f has ${n:-0} paths (want ≥ $min)"
done

[[ $fail == 0 ]] && echo "ALL OK" || echo "SMOKE FAILED"
exit $fail
