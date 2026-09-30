#!/usr/bin/env bash
# Installs a curated set of open-license (SIL OFL) Google Fonts system-wide, so
# Remotion/Chromium, Blender, Manim, Inkscape and ffmpeg can all use them by name.
# Usage:  bash scripts/install-fonts.sh
#
# Note: these static files register some weights as their own family, e.g. "Poppins Light",
# "Poppins ExtraLight", "Tajawal Light". In fontconfig tools (Manim/Pango, Blender, Synfig,
# Inkscape, ImageMagick, MLT) ask for the full name "Poppins Light", not "Poppins" + weight 300,
# or you silently get Regular. Check with:  fc-match "Poppins Light"
set -uo pipefail

DEST="${FONT_DIR:-/usr/local/share/fonts/google}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

ARABIC=(
  "Cairo" "Tajawal" "Almarai" "IBM Plex Sans Arabic" "Readex Pro" "Alexandria"
  "Reem Kufi" "Lalezar" "El Messiri" "Changa" "Harmattan" "Marhey" "Aref Ruqaa"
  "Rakkas" "Mada" "Lemonada" "Baloo Bhaijaan 2" "Vazirmatn" "Noto Kufi Arabic"
  "Noto Naskh Arabic" "Amiri" "Kufam" "Blaka" "Mirza" "Lateef" "Scheherazade New"
)
LATIN=(
  "Poppins" "Montserrat" "Playfair Display" "Bebas Neue" "Oswald" "Space Grotesk"
  "DM Sans" "Manrope" "Syne" "Unbounded" "Cormorant Garamond" "Archivo" "Anton"
  "Outfit" "Plus Jakarta Sans" "Sora" "Lexend" "Urbanist" "Bodoni Moda" "Raleway"
  "Big Shoulders Display" "Italiana" "Marcellus" "Josefin Sans" "Jost" "Inter"
  "Roboto" "Lato" "Open Sans" "Work Sans" "Barlow" "Barlow Condensed" "Figtree"
  "Instrument Serif" "Fraunces" "Libre Baskerville" "Cinzel" "Tenor Sans"
  "Red Hat Display" "Epilogue" "Archivo Black" "Space Mono" "JetBrains Mono"
)

$SUDO mkdir -p "$DEST"
got=0; missed=()
for family in "${ARABIC[@]}" "${LATIN[@]}"; do
  q="${family// /+}"
  dir="$DEST/${family// /}"
  $SUDO mkdir -p "$dir"
  n=0
  for w in 100 200 300 400 500 600 700 800 900; do
    css=$(curl -sS --max-time 20 "https://fonts.googleapis.com/css2?family=${q}:wght@${w}" 2>/dev/null) || continue
    url=$(printf '%s' "$css" | grep -oE 'https://fonts.gstatic.com/[^)]+\.ttf' | head -1)
    [ -z "$url" ] && continue
    out="$dir/${family// /}-${w}.ttf"
    [ -s "$out" ] || $SUDO curl -sS --max-time 60 -o "$out" "$url" || continue
    n=$((n + 1))
  done
  if [ "$n" -gt 0 ]; then got=$((got + 1)); else missed+=("$family"); $SUDO rmdir "$dir" 2>/dev/null; fi
done

$SUDO fc-cache -f "$DEST" >/dev/null
echo "Installed $got font families into $DEST"
[ "${#missed[@]}" -gt 0 ] && echo "Not found: ${missed[*]}"
exit 0
