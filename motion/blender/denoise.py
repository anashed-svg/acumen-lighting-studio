#!/usr/bin/env python3
"""Intel Open Image Denoise for Cycles frames (the apt Blender is built without OIDN).

Reads PASSES/color_####.hdr + albedo_####.hdr + normal_####.hdr (normal stored as n*0.5+0.5)
and writes PASSES/denoised_####.hdr. Runs with the system python3: pip install pyoidn.
"""
import glob
import os
import sys

import cv2
import numpy as np
import pyoidn


def read(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        sys.exit(f'denoise: cannot read {path}')
    return np.ascontiguousarray(img[:, :, ::-1], dtype=np.float32)


def main(passes):
    colors = sorted(glob.glob(os.path.join(passes, 'color_*.hdr')))
    if not colors:
        sys.exit(f'denoise: no color_*.hdr in {passes}')
    fmt = pyoidn.OIDN_FORMAT_FLOAT3
    with pyoidn.Device() as dev:
        dev.commit()
        for path in colors:
            n = path[-8:-4]
            color = read(path)
            albedo = read(os.path.join(passes, f'albedo_{n}.hdr'))
            normal = np.ascontiguousarray(read(os.path.join(passes, f'normal_{n}.hdr')) * 2 - 1)
            out = np.zeros_like(color)
            with pyoidn.Filter(dev, pyoidn.OIDN_FILTER_TYPE_RT) as flt:
                flt.set_image(pyoidn.OIDN_IMAGE_COLOR, color, fmt)
                flt.set_image(pyoidn.OIDN_IMAGE_ALBEDO, albedo, fmt)
                flt.set_image(pyoidn.OIDN_IMAGE_NORMAL, normal, fmt)
                flt.set_image(pyoidn.OIDN_IMAGE_OUTPUT, out, fmt)
                flt.set_bool('hdr', True)
                flt.commit()
                flt.execute()
            if err := dev.get_error():
                sys.exit(f'denoise: OIDN error: {err}')
            cv2.imwrite(os.path.join(passes, f'denoised_{n}.hdr'), np.maximum(out, 0)[:, :, ::-1])
    print(f'[acumen] OIDN denoised {len(colors)} frames')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: denoise.py PASSES_DIR')
    main(sys.argv[1])
