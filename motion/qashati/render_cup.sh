#!/usr/bin/env bash
# Qashati «مش قشطة» — Act 3 product hero shot, v2 (Blender 5 / Cycles + OIDN, CPU).
# Writes video/public/qashati2/cup-shot.mp4 (1080x1920, 30 fps, exactly T.endCard - T.cupShot = 120 frames,
# h264 CRF 14, yuv420p, tv range, BT.709 matrix + tags) and video/public/qashati2/cup-packshot.png (transparent
# end-card still of the finished cup, soft semi-transparent contact shadow).
#
#   bash motion/qashati/render_cup.sh                   # everything (~60-70 min on 4 shared CPUs)
#   STAGE=render bash motion/qashati/render_cup.sh      # only the frames
#   STAGE=packshot bash motion/qashati/render_cup.sh    # only the end-card still (needs a graded frame 0 once)
#   STAGE=encode bash motion/qashati/render_cup.sh      # grade + assemble (+ flow in-betweens) + encode + verify
#   RES=360x640 SPP=4 STAGE=render bash ...             # quick low-res preview of the whole shot
#
# Cadence: the shot is rendered "on twos" (even frames) except the drop-landing window (14-44: the dots land on
# local 24 / 33 = spec T.cupDrops) and the spoon-scoop window (60-105 = spec T.spoon), which are rendered on
# every frame. The even pass is rendered FIRST, so a complete shot exists early; the odd frames of the two
# windows follow. INTERP=flow (default) fills the remaining odd frames with a motion-compensated in-between of
# their rendered neighbours (camera push-in only, 1-3 px/frame: no stepping judder against the 30 fps title);
# INTERP=hold repeats the previous rendered frame instead (classic twos).
# Colour: Cycles -> Khronos PBR Neutral, then a secondary grade (cup3d.py grade) locks the sweep onto #01E8D5
# and applies the food (appetite) grade: salmon honey/mango -> amber/mango, red strawberry, green pistachio,
# cream/PET/set untouched (FOOD_GRADE=0 disables it; re-grading the existing frames: STAGE=encode, ~1.5 min);
# RGB -> Y'CbCr with the BT.709 matrix into tv range, tagged bt709 (verified below by decoding with bt709).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
RES=${RES:-720x1280}
SPP=${SPP:-10}
FRAMES=${FRAMES:-0-118:2,15-43:2,61-105:2}
WORK=${WORK:-$REPO/video/out/qashati2/v2/cup3d}
FRAMES_DIR=${FRAMES_DIR:-$WORK/frames}
OUT=${OUT:-$REPO/video/public/qashati2/cup-shot.mp4}
PACK=${PACK:-$REPO/video/public/qashati2/cup-packshot.png}
PACK_RES=${PACK_RES:-900x1300}
PACK_SPP=${PACK_SPP:-32}
INTERP=${INTERP:-flow}
BPY=${BPY:-/opt/bpy5/bin/python}
STAGE=${STAGE:-all}
N=$(cd "$HERE" && python3 -c "import cup3d; print(cup3d.NFRAMES)")
mkdir -p "$FRAMES_DIR" "$WORK/previews" "$(dirname "$OUT")" "$HERE/out"
T0=$(date +%s)

[ -f "$HERE/out/sticker.png" ] || python3 "$HERE/cup3d.py" sticker "$HERE/out/sticker.png"
[ -f "$HERE/out/dots_sdf.npz" ] || python3 "$HERE/cup3d.py" dots "$HERE/out/dots_sdf.npz"

if [ "$STAGE" = all ] || [ "$STAGE" = render ]; then
  echo "[cup] rendering frames $FRAMES @ $RES, $SPP spp -> $FRAMES_DIR"
  rm -f "$FRAMES_DIR"/[0-9][0-9][0-9][0-9].png
  nice -n 10 "$BPY" "$HERE/cup3d.py" render --out "$FRAMES_DIR" --res "$RES" --samples "$SPP" \
    --frames "$FRAMES" 2>&1 | grep --line-buffered -E '^\[cup\]|Error|Traceback' || true
fi

GRADED="$FRAMES_DIR/graded"
RATIO="$FRAMES_DIR/grade.json"
if [ "$STAGE" = all ] || [ "$STAGE" = encode ]; then
  # brand-colour lock: map the sweep (headline zone of frame 0) exactly onto #01E8D5, subject untouched
  rm -rf "$GRADED"
  python3 "$HERE/cup3d.py" grade "$FRAMES_DIR" "$GRADED" "$RATIO"
  # assemble exactly N frames (flow in-betweens or holds for the frames rendered on twos)
  SEQ="$FRAMES_DIR/seq"
  rm -rf "$SEQ"
  nice -n 10 python3 "$HERE/cup3d.py" assemble "$GRADED" "$SEQ" "$N" "$INTERP"
  # crop: Cycles/OIDN leave a darker 1 px border that upscaling turns into a line (trim keeps 9:16 < 0.1 %)
  ffmpeg -v error -y -framerate 30 -i "$SEQ/%04d.png" \
    -vf "crop=iw-4:ih-7:2:3,scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p,unsharp=5:5:0.45:5:5:0.0" \
    -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -an \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$OUT"
  python3 "$HERE/cup3d.py" verify "$OUT" "$WORK/previews" "$N"
fi

if [ "$STAGE" = all ] || [ "$STAGE" = packshot ]; then
  [ -f "$RATIO" ] || { echo "[cup] packshot needs $RATIO (run STAGE=encode once)"; exit 1; }
  RAW="$WORK/packshot_raw.png"
  nice -n 10 "$BPY" "$HERE/cup3d.py" render --res "$PACK_RES" --samples "$PACK_SPP" --packshot "$RAW" \
    2>&1 | grep --line-buffered -E '^\[cup\]|Error|Traceback' || true
  python3 "$HERE/cup3d.py" grade-packshot "$RAW" "$PACK" "$RATIO"
  convert -size "$PACK_RES" xc:'#01E8D5' "$PACK" -composite "$WORK/previews/packshot_on_turquoise.png"
  convert -size "$PACK_RES" pattern:checkerboard "$PACK" -composite "$WORK/previews/packshot_on_checker.png"
fi
echo "[cup] done in $(( ($(date +%s) - T0) / 60 )) min -> $OUT"
