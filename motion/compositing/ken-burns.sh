#!/usr/bin/env bash
# Ken Burns: eased push-in / pull-out / pan on a still. zoompan runs on a 4x supersampled
# plate so the integer crop never jitters.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() {
  cat <<EOT
usage: ken-burns.sh [-i still] [-o out.mp4] [-d sec] [-m in|out|left|right|up] [-z zoom] [-f fx,fy] [-s WxH] [-r fps]
  -i  still image (default: generated night-villa plate out/samples/facade.png)
  -m  move (default in); -z end zoom (default 1.15); -f zoom focus 0..1 (default 0.5,0.5)
EOT
}
in="" out=$OUT/ken-burns.mp4 dur=4 move=in zoom=1.15 focus=0.5,0.5
while getopts "i:o:d:m:z:f:s:r:h" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; d) dur=$OPTARG ;; m) move=$OPTARG ;; z) zoom=$OPTARG ;;
    f) focus=$OPTARG ;; s) SIZE=$OPTARG ;; r) FPS=$OPTARG ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
[[ -n $in ]] || in=$(sample_still)
[[ -s $in ]] || die "missing input $in"
W=${SIZE%x*} H=${SIZE#*x} SS=4 fx=${focus%,*} fy=${focus#*,}
n=$(awk "BEGIN { print int($dur * $FPS + 0.5) }")
p="on/($n-1)"; e="(($p)*($p)*(3-2*$p))"  # smoothstep ease 0..1
case $move in
  in)    z="1+($zoom-1)*$e"   x="(iw-iw/zoom)*$fx"      y="(ih-ih/zoom)*$fy" ;;
  out)   z="$zoom-($zoom-1)*$e" x="(iw-iw/zoom)*$fx"    y="(ih-ih/zoom)*$fy" ;;
  left)  z="$zoom"            x="(iw-iw/zoom)*(1-$e)"   y="(ih-ih/zoom)*$fy" ;;
  right) z="$zoom"            x="(iw-iw/zoom)*$e"       y="(ih-ih/zoom)*$fy" ;;
  up)    z="$zoom"            x="(iw-iw/zoom)*$fx"      y="(ih-ih/zoom)*(1-$e)" ;;
  *) usage; exit 1 ;;
esac
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y -i "$in" -filter_complex \
  "[0:v]scale=$((W*SS)):$((H*SS)):force_original_aspect_ratio=increase:flags=lanczos,crop=$((W*SS)):$((H*SS)),
   zoompan=z='$z':x='$x':y='$y':d=$n:s=${W}x${H}:fps=$FPS,format=yuv420p" \
  -frames:v "$n" "${X264[@]}" "$out"
done_msg "$out"
