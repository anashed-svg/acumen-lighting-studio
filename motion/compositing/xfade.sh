#!/usr/bin/env bash
# Chain two or more clips with ffmpeg xfade transitions (plus acrossfade when every clip has audio).
# Clips are conformed to one size/fps first, so any mix of sources works.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() {
  cat <<EOT
usage: xfade.sh [-t type[,type...]] [-d sec] [-c max sec per clip] [-o out.mp4] [-s WxH] [-r fps] clip1 clip2 [...]
       xfade.sh -l            list transition types
  -t  one type per cut, cycled (default fade); "softwipe" = soft-edged custom wipe
  with no clips: out/ken-burns.mp4 -> out/light-sweep.mp4 (rendered if missing)
EOT
}
list_types() {
  ffmpeg -hide_banner -h filter=xfade |
    awk '/^ +transition/ { on = 1; next } on && /^     [a-z]/ { print $1 } on && /^   [a-z]/ { exit }' | grep -vx custom
  echo softwipe
}
types=fade d=0.8 cap="" out=$OUT/xfade.mp4
while getopts "t:d:c:o:s:r:lh" opt; do
  case $opt in
    t) types=$OPTARG ;; d) d=$OPTARG ;; c) cap=$OPTARG ;; o) out=$OPTARG ;; s) SIZE=$OPTARG ;; r) FPS=$OPTARG ;;
    l) list_types | paste -sd' ' | fold -s -w 100; exit 0 ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
shift $((OPTIND - 1))
clips=("$@")
if ((${#clips[@]} == 0)); then
  sweep=$OUT/light-sweep.mp4
  [[ -s $sweep ]] || python3 "$HERE/light_sweep.py" -o "$sweep" >/dev/null
  clips=("$(sample_clip)" "$sweep")
fi
((${#clips[@]} >= 2)) || { usage; exit 1; }
IFS=, read -ra T <<< "$types"
valid=" $(list_types | paste -sd' ') "
for t in "${T[@]}"; do [[ $valid == *" $t "* ]] || die "unknown transition '$t' (see xfade.sh -l)"; done

W=${SIZE%x*} H=${SIZE#*x} args=() graph="" audio=1 len=() vtrim="" atrim=""
[[ -n $cap ]] && vtrim="trim=duration=$cap,setpts=PTS-STARTPTS," atrim="atrim=duration=$cap,asetpts=PTS-STARTPTS,"
for i in "${!clips[@]}"; do
  [[ -s ${clips[$i]} ]] || die "missing clip ${clips[$i]}"
  args+=(-i "${clips[$i]}")
  len+=("$(duration "${clips[$i]}")")
  [[ -n $cap ]] && len[i]=$(calc "(${len[i]} < $cap) ? ${len[i]} : $cap")
  graph+="[$i:v]${vtrim}scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1,fps=$FPS,format=yuv420p,settb=AVTB[v$i];"
  has_audio "${clips[$i]}" || audio=0
done
((audio)) && for i in "${!clips[@]}"; do graph+="[$i:a]${atrim}aresample=48000[s$i];"; done
off=0 v=v0 a=s0
for ((i = 1; i < ${#clips[@]}; i++)); do
  t=${T[$(((i - 1) % ${#T[@]}))]}
  off=$(calc "$off + ${len[i - 1]} - $d")
  if [[ $t == softwipe ]]; then  # P runs 1 -> 0; a 15%-wide feathered edge travels left -> right
    m="clip((X/W-(1-P)*1.15+0.15)/0.15,0,1)"
    t="custom:expr='A*$m+B*(1-$m)'"
  fi
  graph+="[$v][v$i]xfade=transition=$t:duration=$d:offset=$off[x$i];"
  v=x$i
  ((audio)) && graph+="[$a][s$i]acrossfade=d=$d[a$i];" && a=a$i
done
map=(-map "[$v]")
((audio)) && map+=(-map "[$a]" -c:a aac -b:a 192k)
mkdir -p "$(dirname "$out")"
ffmpeg -v error -y "${args[@]}" -filter_complex "${graph%;}" "${map[@]}" "${X264[@]}" "$out"
done_msg "$out"
