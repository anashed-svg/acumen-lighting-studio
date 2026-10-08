#!/usr/bin/env bash
# Render style-frame stills of the kit (or any composition) from ONE bundle, plus 360-px phone-size copies and a
# contact sheet.  Usage (from video/):
#   bash src/qashati2d/kit/tools/stills.sh <outdir> <comp> <frame> [<frame> ...]
#   ENTRY=src/qashati2d/spoon/index.ts bash src/qashati2d/kit/tools/stills.sh out/qashati2d/spoon/stills OneSpoon 0 30 60
set -euo pipefail
out=${1:?outdir}; comp=${2:?composition}; shift 2
entry=${ENTRY:-src/qashati2d/kit/index.ts}
mkdir -p "$out"
bundle="$out/.bundle"
nice -n 10 npx remotion bundle "$entry" --out-dir="$bundle" --log=error >/dev/null
names=()
for f in "$@"; do
  name=$(printf "%s/f%04d.png" "$out" "$f")
  nice -n 10 npx remotion still "$bundle" "$comp" "$name" --frame="$f" --log=error >/dev/null
  convert "$name" -resize 360x "${name%.png}_360.png"
  names+=("$name")
done
montage "${names[@]}" -tile "${#names[@]}x1" -geometry 360x640+6+6 -background '#222' "$out/sheet.jpg"
montage $(for n in "${names[@]}"; do echo "${n%.png}_360.png"; done) -tile "${#names[@]}x1" -geometry +4+4 -background '#222' "$out/sheet_360.png"
echo "$out/sheet.jpg"
