#!/usr/bin/env bash
# Render an MLT XML timeline headless with melt. MLT is the engine inside Kdenlive and Shotcut,
# so their project files (.kdenlive / Shotcut .mlt) render the same way.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

[[ ${1:-} == -h ]] && { echo "usage: mlt.sh [project.mlt|.kdenlive] [out.mp4]"; exit 0; }
project=${1:-$HERE/mlt/acumen.mlt}
out=${2:-$OUT/mlt.mp4}
[[ -s $project ]] || die "missing project $project"
[[ $project == "$HERE/mlt/acumen.mlt" ]] && sample_still >/dev/null  # the sample timeline uses the facade plate
mkdir -p "$(dirname "$out")"
# Qt-based services (qimage, qtext, kdenlivetitle) need an X display: wrap in xvfb-run when there is none.
run=(melt)
[[ -z ${DISPLAY:-} ]] && grep -qE 'qimage|qtext|kdenlivetitle|qtblend' "$project" && run=(xvfb-run -a melt)
LADSPA_PATH=${LADSPA_PATH:-/dev/null} "${run[@]}" "$project" -silent -consumer "avformat:$out" \
  vcodec=libx264 preset=medium crf=17 pix_fmt=yuv420p movflags=+faststart acodec=aac 2>&1 |
  grep -vE 'LADSPA|^$|Timestamps are unset|did not produce proper pts' || true
[[ -s $out ]] || die "melt produced no output"
done_msg "$out"
