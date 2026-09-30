#!/usr/bin/env bash
# Qashati «مش قشطة» — Act 3 product hero shot (Blender 5 / Cycles + OIDN, CPU).
# Renders the cup shot and writes video/public/qashati2/cup-shot.mp4 (1080x1920, 30 fps, 150 frames, h264 CRF 14).
#
#   bash motion/qashati/render_cup.sh                # full pipeline (~60 min on 4 lightly shared CPUs)
#   STAGE=encode bash motion/qashati/render_cup.sh   # only re-assemble + encode from rendered frames
#   RES=540x960 SPP=6 bash motion/qashati/render_cup.sh   # quick low-res preview of the whole shot
#
# Colour: Cycles -> Khronos PBR Neutral view (keeps the saturated turquoise, soft highlight roll-off), then a
# secondary grade (cup3d.py grade) locks the sweep onto #01E8D5 exactly; h264 tagged bt709 / tv range.
# Cadence: rendered "on twos" (even frames, each held for 2 frames = 15 unique fps, a crafted stop-motion feel)
# except the drop-impact window 25-43, which is rendered on every frame in the SAME pass, so the two landings
# (local frames 30 and 39 = spec T.cupDrops) and the squash/rebound always hit on the exact frame (85 unique).
# Rendered at RES (default 756x1344, ~42 s/frame on 4 lightly shared CPUs) and upscaled with Lanczos (+ a light
# luma unsharp) to 1080x1920 — the shot is shallow-DOF, so this is where the render budget pays off.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
RES=${RES:-756x1344}
SPP=${SPP:-10}
FRAMES=${FRAMES:-0-24:2,25-43,44-148:2}   # twos + every frame of the drop window (spec T.cupDrops = 30, 39)
FRAMES_DIR=${FRAMES_DIR:-$REPO/video/out/qashati2/cup-frames}
OUT=${OUT:-$REPO/video/public/qashati2/cup-shot.mp4}
PREV=${PREV:-$REPO/video/out/qashati2/cup-previews}
BPY=${BPY:-/opt/bpy5/bin/python}
STAGE=${STAGE:-all}
N=150
mkdir -p "$FRAMES_DIR" "$PREV" "$(dirname "$OUT")" "$HERE/out"
T0=$(date +%s)

[ -f "$HERE/out/sticker.png" ] || python3 "$HERE/cup3d.py" sticker "$HERE/out/sticker.png"

render() {  # $1 = frame list
  nice -n 10 "$BPY" "$HERE/cup3d.py" render --out "$FRAMES_DIR" --res "$RES" --samples "$SPP" \
    --frames "$1" 2>&1 | grep --line-buffered -E '^\[cup\]|Error|Traceback' || true
}

if [ "$STAGE" = all ]; then
  echo "[cup] rendering frames $FRAMES @ $RES, $SPP spp"
  rm -f "$FRAMES_DIR"/[0-9][0-9][0-9][0-9].png
  render "$FRAMES"
fi

# brand-colour lock: map the sweep (headline zone of frame 0) exactly onto #01E8D5, subject untouched
GRADED="$FRAMES_DIR/graded"
rm -rf "$GRADED"
python3 "$HERE/cup3d.py" grade "$FRAMES_DIR" "$GRADED"

# assemble exactly N frames: each output frame shows the latest rendered frame <= it
SEQ="$FRAMES_DIR/seq"
rm -rf "$SEQ" && mkdir -p "$SEQ"
last=""
for ((f = 0; f < N; f++)); do
  p=$(printf '%s/%04d.png' "$GRADED" "$f")
  [ -f "$p" ] && last="$p"
  [ -n "$last" ] || { echo "missing frame 0"; exit 1; }
  ln -s "$last" "$(printf '%s/%04d.png' "$SEQ" "$f")"
done
echo "[cup] unique frames: $(ls "$GRADED"/[0-9]*.png | wc -l)"

# crop=...: Cycles/OIDN leave a darker 1 px border (col 0 / row 0) that upscaling turns into a visible line;
# trimming 2-4 px keeps 9:16 to <0.01 %
ffmpeg -v error -y -framerate 30 -i "$SEQ/%04d.png" \
  -vf "crop=iw-4:ih-7:2:3,scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p,unsharp=5:5:0.45:5:5:0.0" \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -an \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$OUT"

# previews (frames 0, 30, 45, 75, 120, 149 of the final encode)
for f in 0 30 45 75 120 149; do
  ffmpeg -v error -y -i "$OUT" -vf "select=eq(n\,$f)" -frames:v 1 "$PREV/cup-$(printf '%03d' "$f").png"
done
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=width,height,r_frame_rate,nb_read_frames,pix_fmt,codec_name -of default=nw=1 "$OUT"
echo "[cup] done in $(( ($(date +%s) - T0) / 60 )) min -> $OUT"
