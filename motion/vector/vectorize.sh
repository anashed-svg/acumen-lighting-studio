#!/usr/bin/env bash
# Raster client logo (PNG/JPG/...) → clean SVG with potrace, ready for stroke-draw animation, + previews.
#
#   ./vectorize.sh logo.jpg                       → out/vectorize/logo.svg, logo_preview.png, logo_compare.png
#   ./vectorize.sh logo.png -o brands/client.svg -t 60 --color '#F4F1EA'
#
# Options:
#   -o FILE         output SVG (default out/vectorize/<name>.svg)
#   -t N            threshold 0-100 (default 50); raise it if thin parts vanish, lower it if shapes bleed
#   -i, --invert    flip the auto polarity (use when the SVG traced the background instead of the logo)
#   --alpha / --no-alpha   trace the alpha channel (default: auto when the image has transparency)
#   --color HEX     fill colour (default #FFFFFF, for dark videos)
#   --turd N        drop specks smaller than N px² (default 10)
#   --smooth F      potrace corner smoothing 0 (sharp) .. 1.33 (round), default 1.0
#   --size N        upscale so the long side is at least N px before tracing (default 2400)
#
# Polarity is automatic: a light border means a dark logo on a light background (typical client JPG),
# a dark border means a light logo on a dark background. Either way the logo is what gets traced.
set -euo pipefail

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
[[ $# -ge 1 ]] || usage 1
[[ $1 == -h || $1 == --help ]] && usage

in=$1; shift
[[ -f $in ]] || { echo "no such file: $in" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
name=$(basename "${in%.*}")
out="" thr=50 invert=0 alpha=auto color="#FFFFFF" turd=10 smooth=1.0 size=2400
while [[ $# -gt 0 ]]; do
  case $1 in
    -o) out=$2; shift ;;
    -t) thr=$2; shift ;;
    -i|--invert) invert=1 ;;
    --alpha) alpha=1 ;;
    --no-alpha) alpha=0 ;;
    --color) color=$2; shift ;;
    --turd) turd=$2; shift ;;
    --smooth) smooth=$2; shift ;;
    --size) size=$2; shift ;;
    -h|--help) usage ;;
    *) echo "unknown option: $1" >&2; usage 1 ;;
  esac
  shift
done
out=${out:-$here/out/vectorize/$name.svg}
mkdir -p "$(dirname "$out")"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# 1. grey mask (logo = dark), upscaled smoothly so the traced curves come out clean
if [[ $alpha == auto ]]; then
  [[ $(convert "$in[0]" -format "%[opaque]" info:) == [Ff]alse ]] && alpha=1 || alpha=0
fi
if [[ $alpha == 1 ]]; then
  convert "$in[0]" -alpha extract -negate "$tmp/gray.png"
  mode="alpha channel"
else
  convert "$in[0]" -background white -alpha remove -alpha off -colorspace Gray "$tmp/gray.png"
  all=$(convert "$tmp/gray.png" -resize 100x100! -format "%[fx:mean]" info:)
  inner=$(convert "$tmp/gray.png" -resize 100x100! -shave 5x5 -format "%[fx:mean]" info:)
  if awk -v a="$all" -v i="$inner" 'BEGIN { exit !((a*10000 - i*8100) / 1900 < 0.5) }'; then
    convert "$tmp/gray.png" -negate "$tmp/gray.png"
    mode="light logo on dark background"
  else
    mode="dark logo on light background"
  fi
fi
[[ $invert == 1 ]] && { convert "$tmp/gray.png" -negate "$tmp/gray.png"; mode="$mode, inverted"; }

# 2. threshold → bitmap → potrace (one <path> per shape, holes kept)
convert "$tmp/gray.png" -filter Lanczos -resize "${size}x${size}<" -threshold "${thr}%" "$tmp/mask.pbm"
potrace "$tmp/mask.pbm" -s -o "$out" --turdsize "$turd" --alphamax "$smooth" --opttolerance 0.2 --color "$color"

# 3. previews: the SVG on a contrasting background, and source | trace side by side
light=$(convert xc:"$color" -format "%[fx:luminance>0.5?1:0]" info:)
bg=$([[ $light == 1 ]] && echo "#050505" || echo "#F4F1EA")
preview=${out%.svg}_preview.png compare=${out%.svg}_compare.png
rsvg-convert -w 1024 -a -b "$bg" "$out" -o "$preview"
convert \( "$in[0]" -background "#808080" -alpha remove -resize 1024x1024 \) "$preview" \
  -gravity center -background "#808080" +append -resize 1600x +repage "$compare"

paths=$(grep -c "<path" "$out" || true)
echo "vectorized ($mode): $out  paths=$paths  $(du -h "$out" | cut -f1)"
echo "preview: $preview"
echo "compare: $compare"
