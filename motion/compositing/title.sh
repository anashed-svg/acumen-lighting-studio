#!/usr/bin/env bash
# Bilingual title overlay via libass (ffmpeg "ass" filter): HarfBuzz + FriBidi shape Arabic RTL,
# and ASS gives real letter-spacing (animated), fades and a soft glow layer - drawtext can't track.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

usage() { echo "usage: title.sh [-i in.mp4] [-o out.mp4] [-e EN] [-a AR] [-t start] [-d dur] [-p center|lower]"; }
in="" out=$OUT/title.mp4 en=$(brand tagline_en) ar=$(brand tagline_ar) t0=0.4 dur="" pos=center
while getopts "i:o:e:a:t:d:p:h" opt; do
  case $opt in
    i) in=$OPTARG ;; o) out=$OPTARG ;; e) en=$OPTARG ;; a) ar=$OPTARG ;; t) t0=$OPTARG ;; d) dur=$OPTARG ;;
    p) pos=$OPTARG ;; h) usage; exit 0 ;; *) usage; exit 1 ;;
  esac
done
if [[ -n $in ]]; then
  src=(-i "$in") len=$(duration "$in")
  read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$in" | tr x ' ')
else  # no input: title card on the brand background
  W=${SIZE%x*} H=${SIZE#*x} len=4
  src=(-f lavfi -i "color=c=0x$(hex background):s=${W}x$H:r=$FPS:d=$len")
fi
[[ -n $dur ]] || dur=$(calc "$len - $t0 - 0.2")

ass_time() { awk -v s="$1" 'BEGIN { printf "%d:%02d:%05.2f", s / 3600, (s % 3600) / 60, s - int(s / 60) * 60 }'; }
ass_col() { local h=${1#\#}; echo "&H00${h:4:2}${h:2:2}${h:0:2}&"; }
family() { python3 -c "from fontTools.ttLib import TTFont; import sys; print(TTFont(sys.argv[1])['name'].getDebugName(1))" "$1"; }

mkdir -p "$OUT" "$(dirname "$out")"
tmp=$(mktemp -d "$OUT/.title.XXXXXX") fonts=$tmp
trap 'rm -rf "$tmp"' EXIT
ln -sf "$(brand_path font_latin)" "$fonts/latin.ttf"
ln -sf "$(brand_path font_arabic)" "$fonts/arabic.ttf"
fen=$(family "$fonts/latin.ttf") far=$(family "$fonts/arabic.ttf")
sen=$((H * 40 / 1000)) sar=$((H * 56 / 1000))
track=$(calc "$(brand tracking_em) * $sen")
cx=$((W / 2)) cy=$((H / 2))
[[ $pos == lower ]] && cy=$((H * 78 / 100))
yen=$((cy - H * 3 / 100)) yline=$((cy + H * 2 / 100)) yar=$((cy + H * 75 / 1000))
a=$(ass_time "$t0") b=$(ass_time "$(calc "$t0 + $dur")")
ink=$(ass_col "$(hex ink)") glow=$(ass_col "$(hex glow)")
lw=$((W / 8))

ass=$tmp/title.ass
cat > "$ass" <<EOT
[Script Info]
ScriptType: v4.00+
PlayResX: $W
PlayResY: $H
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: EN,$fen,$sen,$ink,$ink,&H00000000&,&H00000000&,0,0,0,0,100,100,$track,0,1,0,0,5,0,0,0,1
Style: AR,$far,$sar,$ink,$ink,&H00000000&,&H00000000&,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,$a,$b,EN,,0,0,0,,{\pos($cx,$yen)\fad(900,500)\blur9\c$glow\alpha&H70&\fsp$(calc "$track*0.55")\t(0,1800,0.6,\fsp$track)}${en//[\{\}]/}
Dialogue: 1,$a,$b,EN,,0,0,0,,{\pos($cx,$yen)\fad(900,500)\fsp$(calc "$track*0.55")\t(0,1800,0.6,\fsp$track)}${en//[\{\}]/}
Dialogue: 1,$a,$b,EN,,0,0,0,,{\an5\pos($cx,$yline)\fad(600,500)\blur0.6\c$glow\fscx0\t(250,1500,0.5,\fscx100)\p1}m 0 0 l $lw 0 $lw 1 0 1{\p0}
Dialogue: 0,$a,$b,AR,,0,0,0,,{\pos($cx,$yar)\fad(0,500)\blur7\c$glow\alpha&HFF&\t(500,1400,\alpha&H80&)}${ar//[\{\}]/}
Dialogue: 1,$a,$b,AR,,0,0,0,,{\pos($cx,$yar)\fad(0,500)\alpha&HFF&\t(500,1400,\alpha&H00&)}${ar//[\{\}]/}
EOT
ffmpeg -v error -y "${src[@]}" -filter_complex "[0:v]ass=filename='$ass':fontsdir='$fonts',format=yuv420p" \
  -map 0:a? -c:a copy "${X264[@]}" -t "$len" "$out"
done_msg "$out"
