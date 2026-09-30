#!/usr/bin/env python3
"""Render synfig/glow.sif for a brand: rewrite the exported <defs> values, then synfig → PNG frames → x264.

  python3 render_synfig.py                                   # → out/synfig/acumen.mp4
  BRAND_JSON=brands/example.json python3 render_synfig.py    # → out/synfig/example.mp4
  python3 render_synfig.py --still 3.5                       # one PNG at t=3.5 s (fast preview)
"""
import argparse
import shutil
import subprocess
import xml.etree.ElementTree as ET

from PIL import Image

from common import HERE, OUT, is_arabic, load_brand, rgb

SIF = HERE / "synfig" / "glow.sif"
BOTTOM = -1.15  # logo baseline in Synfig units (y up, 80 px per unit)


def tracked(text):
    """Letter-spacing for Synfig: one space between letters, three between words (Latin only)."""
    return text if is_arabic(text) else "   ".join(" ".join(word) for word in text.split())


def brand_sif(brand, out_dir):
    tree = ET.parse(SIF)
    defs = {el.get("id"): el for el in tree.getroot().find("defs")}

    def color(key, hex_color, alpha=1.0):
        for tag, v in zip("rgba", (*rgb(hex_color), alpha)):
            defs[key].find(tag).text = f"{v:.6f}"

    color("bg", brand["background"])
    color("ink", brand["ink"])
    color("glow", brand["glow"])
    for stop in defs["falloff"]:  # keep each stop's alpha, swap in the brand glow
        for tag, v in zip("rgb", rgb(brand["glow"])):
            stop.find(tag).text = f"{v:.6f}"
    logo = brand.get("logo_png")
    if not logo:  # Synfig's own SVG import is unreliable: rasterise vector logos first
        logo = str(out_dir / f"{brand['slug']}_logo.png")
        subprocess.run(["rsvg-convert", "-w", "1024", "-h", "1024", "-a", brand["logo_svg"], "-o", logo], check=True)
    defs["logo"].text = logo
    # fit the logo in a 6.5 x 3.5 unit box (520 x 280 px), bottom edge just above the LED line
    with Image.open(logo) as im:
        aspect = im.width / im.height
    w, h = (6.5, 6.5 / aspect) if aspect > 6.5 / 3.5 else (3.5 * aspect, 3.5)
    for key, (x, y) in {"logo_tl": (-w / 2, BOTTOM + h), "logo_br": (w / 2, BOTTOM), "logo_center": (0, BOTTOM + h / 2)}.items():
        defs[key].find("x").text, defs[key].find("y").text = f"{x:.4f}", f"{y:.4f}"
    defs["font_latin"].text = brand["font_latin_file"]
    defs["font_arabic"].text = brand["font_arabic_file"]
    defs["tagline_en"].text = tracked(brand["tagline_en"])
    defs["tagline_ar"].text = brand["tagline_ar"]
    path = out_dir / f"{brand['slug']}.sif"
    tree.write(path, encoding="UTF-8", xml_declaration=True)
    return path


def synfig(*args):
    run = subprocess.run(["synfig", "-q", *map(str, args)], capture_output=True, text=True)
    if run.returncode:
        raise SystemExit(f"synfig failed:\n{run.stderr[-2000:]}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--still", type=float, help="render a single PNG at this time (seconds)")
    args = ap.parse_args()

    brand = load_brand()
    out = OUT / "synfig"
    out.mkdir(parents=True, exist_ok=True)
    sif = brand_sif(brand, out)
    if args.still is not None:
        png = out / f"{brand['slug']}_{args.still:g}s.png"
        synfig(sif, "--time", f"{args.still}s", "-o", png)
        print(f"wrote {png}")
        return

    frames = out / f"{brand['slug']}_frames"
    shutil.rmtree(frames, ignore_errors=True)
    frames.mkdir()
    synfig(sif, "-t", "png", "-o", frames / "f.png")
    fps = ET.parse(sif).getroot().get("fps")
    mp4 = out / f"{brand['slug']}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", fps, "-i", frames / "f.%04d.png",
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], check=True)
    shutil.rmtree(frames)
    print(f"wrote {mp4}")


if __name__ == "__main__":
    main()
