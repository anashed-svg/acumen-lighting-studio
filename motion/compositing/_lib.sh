# Shared helpers + filtergraph builders for the ffmpeg recipes (sourced, not executed).
# Recipes never cd, so relative -i/-o paths are relative to the caller's cwd.
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT=$HERE/out
BRAND=${BRAND:-$HERE/brand.json}
FPS=${FPS:-30}
SIZE=${SIZE:-1280x720}
X264=(-c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -movflags +faststart)

die() { echo "$(basename "$0"): $*" >&2; exit 1; }
brand() { jq -er --arg k "$1" '.[$k]' "$BRAND"; }
brand_path() {  # paths in a brand JSON are relative to that JSON file
  local p; p=$(brand "$1")
  [[ $p = /* ]] && echo "$p" || realpath -m "$(dirname "$BRAND")/$p"
}
hex() { local h; h=$(brand "$1"); echo "${h#\#}"; }
calc() { awk "BEGIN { printf \"%.6g\", $1 }"; }
rgb_frac() {  # "FFC478" -> "1 0.769 0.471"
  local h=${1#\#}; echo "$(calc "$((16#${h:0:2}))/255") $(calc "$((16#${h:2:2}))/255") $(calc "$((16#${h:4:2}))/255")"
}
duration() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
has_audio() { [[ -n $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1") ]]; }
done_msg() { echo "-> $1 ($(duration "$1")s)"; }

# Default sample inputs, generated on demand into out/samples and out/.
sample_still() {
  local f=$OUT/samples/facade.png
  [[ -s $f ]] || python3 "$HERE/facade.py" -o "$f" >/dev/null
  echo "$f"
}
sample_clip() {
  local f=$OUT/ken-burns.mp4
  [[ -s $f ]] || "$HERE/ken-burns.sh" -o "$f" >/dev/null
  echo "$f"
}

# ---- filtergraph fragments: each continues the current chain and ends on one output ----
fg_grade() {  # fg_grade <lut.cube> <strength 0..1>
  local lut=$1 s=$2
  if [[ $s == 1 || $s == 1.0 ]]; then echo "format=gbrp,lut3d=file='$lut':interp=tetrahedral"; return; fi
  echo "format=gbrp,split[gr0][gr1];[gr1]lut3d=file='$lut':interp=tetrahedral[gr2];[gr0][gr2]blend=all_mode=normal:all_opacity=$s"
}
fg_glow() {  # fg_glow <strength> <radius px> <threshold 0..1> <tint hex|none>  (tint is mixed 50% with white)
  local s=$1 r=$2 t=$3 tint=$4 k="1 1 1" kr kg kb
  [[ $tint != none ]] && k=$(rgb_frac "$tint")
  read -r kr kg kb <<< "$k"
  kr=$(calc "($kr+1)/2") kg=$(calc "($kg+1)/2") kb=$(calc "($kb+1)/2")
  echo "format=gbrp,split[gl0][gl1];[gl1]colorlevels=rimin=$t:gimin=$t:bimin=$t,split[gl2][gl3];" \
       "[gl2]gblur=sigma=$r:steps=3[gl4];[gl3]gblur=sigma=$(calc "$r*4"):steps=3[gl5];" \
       "[gl4][gl5]blend=all_mode=addition,lutrgb=r='clipval*$s*$kr':g='clipval*$s*$kg':b='clipval*$s*$kb'[gl6];" \
       "[gl0][gl6]blend=all_mode=screen" | tr -d ' '
}
fg_grain_vignette() {  # fg_grain_vignette <grain 0..40> <vignette angle rad, 0=off>
  local g=$1 v=$2 f="format=yuv444p"
  [[ $v != 0 ]] && f+=",vignette=angle=$v:dither=1"
  [[ $g != 0 ]] && f+=",noise=c0s=$g:c0f=t"
  echo "$f"
}
fg_bars() {  # fg_bars <aspect e.g. 2.39>: letterbox bars, drawn over the frame (size unchanged)
  local b="(ih-iw/$1)/2"
  echo "drawbox=x=0:y=0:w=iw:h=$b+1:c=black:t=fill,drawbox=x=0:y=ih-$b-1:w=iw:h=$b+2:c=black:t=fill"
}
