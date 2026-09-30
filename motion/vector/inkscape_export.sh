#!/usr/bin/env bash
# Inkscape 1.2 CLI (headless): SVG → 4K PNG key art, vector PDF, or plain SVG with text baked to outlines.
#
#   ./inkscape_export.sh logo.svg                   → out/inkscape/logo_4k.png  (3840 px wide, brand background)
#   ./inkscape_export.sh logo.svg --transparent     → PNG with alpha
#   ./inkscape_export.sh frame.svg --width 7680     → 8K
#   ./inkscape_export.sh text.svg --paths           → out/inkscape/text_paths.svg (text → shaped outlines, Arabic OK)
#   ./inkscape_export.sh poster.svg --pdf           → out/inkscape/poster.pdf (vector, text → outlines)
#
# Options: --width N (default 3840) · --bg HEX (default #050505) · --transparent · --paths · --pdf · -o FILE
set -euo pipefail

usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
[[ $# -ge 1 ]] || usage 1
[[ $1 == -h || $1 == --help ]] && usage

in=$1; shift
[[ -f $in ]] || { echo "no such file: $in" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
name=$(basename "${in%.*}")
width=3840 bg="#050505" alpha=1 mode=png out=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --width) width=$2; shift ;;
    --bg) bg=$2; shift ;;
    --transparent) alpha=0 ;;
    --paths) mode=paths ;;
    --pdf) mode=pdf ;;
    -o) out=$2; shift ;;
    -h|--help) usage ;;
    *) echo "unknown option: $1" >&2; usage 1 ;;
  esac
  shift
done

# Inkscape prints a harmless GTK warning when there is no display; hide just that.
ink() { inkscape "$@" 2> >(grep -v -e GtkRecentManager -e '^\s*$' >&2); }

dir=$here/out/inkscape
mkdir -p "$dir"
case $mode in
  png)
    out=${out:-$dir/${name}_$((width / 960))k.png}
    ink "$in" --export-type=png --export-width="$width" --export-area-page \
        --export-background="$bg" --export-background-opacity="$alpha" --export-filename="$out" ;;
  paths)
    out=${out:-$dir/${name}_paths.svg}
    ink "$in" --export-type=svg --export-plain-svg --export-text-to-path --export-filename="$out" ;;
  pdf)
    out=${out:-$dir/$name.pdf}
    ink "$in" --export-type=pdf --export-text-to-path --export-filename="$out" ;;
esac
[[ -s $out ]] || { echo "inkscape produced nothing: $out" >&2; exit 1; }
echo "wrote $out $([[ $mode == png ]] && identify -format '(%wx%h)' "$out")"
