#!/usr/bin/env bash
# Re-renders every motion-graphics sample from scratch and prints a pass/fail table.
# Usage:  bash scripts/smoke-all.sh            (takes ~20-30 min on 4 CPUs)
#         bash scripts/smoke-all.sh manim blender   (only these)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

declare -A SMOKE=(
  [showcase2d]="video/smoke/showcase2d.sh"
  [showcase3d]="video/smoke/showcase3d.sh"
  [showcaseFx]="video/smoke/showcaseFx.sh"
  [manim]="motion/manim/smoke.sh"
  [blender]="motion/blender/smoke.sh"
  [revideo]="motion/revideo/smoke.sh"
  [motion-canvas]="motion/motion-canvas/smoke.sh"
  [vector]="motion/vector/smoke.sh"
  [compositing]="motion/compositing/smoke.sh"
)
ORDER=(showcase2d showcase3d showcaseFx manim blender revideo motion-canvas vector compositing)
[ "$#" -gt 0 ] && ORDER=("$@")

mkdir -p "$ROOT/video/out"
declare -A RESULT
for name in "${ORDER[@]}"; do
  script="${SMOKE[$name]:-}"
  [ -z "$script" ] && { echo "unknown area: $name"; RESULT[$name]="unknown"; continue; }
  log="$ROOT/video/out/smoke-$name.log"
  echo "==> $name ($script)"
  start=$(date +%s)
  if bash "$ROOT/$script" >"$log" 2>&1; then status=pass; else status=FAIL; fi
  RESULT[$name]="$status $(( $(date +%s) - start ))s"
  echo "    ${RESULT[$name]}  (log: ${log#$ROOT/})"
done

echo; echo "Summary:"
fail=0
for name in "${ORDER[@]}"; do
  printf '  %-14s %s\n' "$name" "${RESULT[$name]}"
  [[ "${RESULT[$name]}" == pass* ]] || fail=1
done
exit "$fail"
