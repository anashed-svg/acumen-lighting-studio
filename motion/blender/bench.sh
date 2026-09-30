#!/usr/bin/env bash
# Per-frame render times for every engine on both templates (640x360 by default).
# usage: bash bench.sh [frames=6] [res=640x360] [samples=16]
set -euo pipefail
cd "$(dirname "$0")"
frames=${1:-6} res=${2:-640x360} samples=${3:-16}
mkdir -p out/bench
for scene in scene logo; do
  for engine in CYCLES BLENDER_EEVEE BLENDER_WORKBENCH; do
    nice -n 10 blender -b --factory-startup -P "$scene.py" -- --out "out/bench/${scene}_${engine}" \
      --engine "$engine" --res "$res" --frames "$frames" --samples "$samples" 2>&1 | grep '\[acumen\]' || true
  done
done
python3 - "$frames" <<'PY'
import glob, json, os
print(f"\n{'template':8} {'engine':18} {'first frame':>11} {'s/frame after':>13} {'denoise s/fr':>12} {'total s':>8}")
for f in sorted(glob.glob('out/bench/*.json')):
    d = json.load(open(f))
    t = d['render_s_per_frame']
    dn = d.get('denoise_s', 0) / d['frames'] if 'denoise_s' in d else 0
    print(f"{os.path.basename(f).split('_')[0]:8} {d['engine']:18} {t[0]:11.2f} {d['avg_s_per_frame_after_first']:13.2f} {dn:12.2f} {d['total_s']:8.1f}")
PY
