"""Acumen lighting prompts + effect catalog. Edit to tune the look."""

# ---------------------------------------------------------------------------
# Telegram bot (free-form) prompt
# ---------------------------------------------------------------------------

WELCOME_MESSAGE = (
    "أهلاً فيك ببوت Acumen للإضاءة 🌙\n\n"
    "ابعتلي صورة المبنى النهارية (وعلّم عليها بالأحمر وين بدك الإضاءة إذا حاب)، "
    "واكتب بالكابشن نوع الإضاءة المطلوب.\n\n"
    "ورح أرجّعلك نفس المبنى بنسخة ليلية فخمة مع الإضاءة المطلوبة ✨"
)

BASE_PROMPT = """You are an architectural lighting visualizer for Acumen, a luxury lighting studio.

TASK: Transform the attached DAYTIME architectural render into a photorealistic NIGHTTIME version of the EXACT SAME scene, with architectural lighting added. The image may contain RED hand-drawn marks showing WHERE lighting is wanted — treat them as instructions and do NOT show them in the final image.

Keep the architecture IDENTICAL (geometry, materials, openings, landscaping, camera). Only change day to night and add lighting. Output ONE clean photorealistic render with no marks or text.

Warm 2700-3000K amber-gold light, cinematic calm high-end mood, deep-but-not-black sky, rich shadows, realistic falloff and reflections. Elegant, never over-lit.

CLIENT'S SPECIFIC INSTRUCTIONS FOR THIS IMAGE:
{instructions}
"""

DEFAULT_INSTRUCTIONS = (
    "Add architectural lighting where the red marks are, choosing the fixture type "
    "that best suits each location."
)


def build_prompt(instructions: str) -> str:
    instructions = (instructions or "").strip() or DEFAULT_INSTRUCTIONS
    return BASE_PROMPT.format(instructions=instructions)


# ---------------------------------------------------------------------------
# Web studio: effect catalog + legend-based prompt
# ---------------------------------------------------------------------------

# Single source of truth for the lighting effects. `color` is the on-image
# marking color (also drawn in the UI); `color_name` is how that color is
# described to the model in the legend.
EFFECTS = [
    {"id": "linear", "en": "Linear Light", "ar": "لينير", "kind": "line",
     "color": "#ff3b30", "color_name": "red",
     "desc": "a continuous, even, warm hidden LED line of light running exactly along the marked line (cove / under coping / edge / stair nosing)."},
    {"id": "wall_washer", "en": "Wall Washer", "ar": "وول واشر", "kind": "line",
     "color": "#34c759", "color_name": "green",
     "desc": "a clearly visible, even, uniform wash of warm light covering the whole wall plane next to the marked line — smooth and bright enough to read in the night scene, no hotspots, no scallops. It must be obviously lit."},
    {"id": "wall_grazer", "en": "Wall Grazer", "ar": "وول جريزر", "kind": "line",
     "color": "#5ac8fa", "color_name": "light blue",
     "desc": "light grazing very close along the marked surface, emphasizing texture with strong vertical streaks and shadows."},
    {"id": "spotlight", "en": "Spotlight", "ar": "سبوت لايت", "kind": "point",
     "color": "#ffcc00", "color_name": "yellow",
     "desc": "a tight focused beam highlighting the marked feature, with a clear bright pool and soft falloff."},
    {"id": "downlight", "en": "Downlight", "ar": "داون لايت", "kind": "point",
     "color": "#af52de", "color_name": "purple",
     "desc": "light cast downward from above the marked point, creating a pool of light on the surface below."},
    {"id": "uplight", "en": "Uplight", "ar": "أب لايت", "kind": "point",
     "color": "#ff9500", "color_name": "orange",
     "desc": "a ground spot at the marked point aiming up — a bright pool at the base fading upward with a soft scalloped cone on the wall, column or tree."},
    {"id": "accent", "en": "Accent", "ar": "أكسنت", "kind": "point",
     "color": "#ff2d92", "color_name": "pink",
     "desc": "a small, subtle accent highlight emphasizing the marked decorative detail."},
    {"id": "step", "en": "Step / Ground", "ar": "إضاءة أرضية", "kind": "point",
     "color": "#00c7be", "color_name": "teal",
     "desc": "low-level light at the marked point marking steps, paths or ground edges with a soft warm glow."},
    {"id": "underwater", "en": "Underwater", "ar": "أندروتر", "kind": "point",
     "color": "#0a84ff", "color_name": "blue",
     "desc": "a submerged light at the marked point glowing up through water, with caustics and reflections."},
]

_EFFECTS_BY_ID = {e["id"]: e for e in EFFECTS}

STUDIO_PROMPT = """You are an expert architectural lighting visualizer for Acumen, a luxury lighting studio.

You are given ONE daytime architectural render of a building (often a villa or a mosque). A lighting designer has drawn colored marks (dots and lines) on it. Each mark gives the EXACT position and TYPE of a lighting fixture to add.

GOAL: produce a photorealistic NIGHTTIME photo of the SAME building with these lights turned on, and output a CLEAN image with all the marks removed.

STEP 1 - Keep the building EXACTLY as it is. Same architecture, geometry, materials, proportions, number of windows / arches / domes / towers, landscaping, plants, parked cars, paving and camera angle. Do NOT add, remove, move or redesign any architectural element. Only (a) turn day into night, and (b) add the lighting described below.

STEP 2 - Add EXACTLY {n} lighting fixture(s) - no more, no less. Totals by type: {totals}. Each fixture is NUMBERED to match the small number printed next to its colored mark on the image. Place each one precisely where its mark is, and make it the correct TYPE. Do NOT invent, duplicate, or add any light that is not in this list (the image is split into left / center / right and upper / middle / lower):
{placements}

LEGEND - what each effect type must look like (match it to the mark color):
{legend}

STEP 3 - COMPLETENESS (critical): ALL {n} fixtures above MUST be clearly visible and switched ON in the final image. Do NOT skip or omit even one. Subtle effects like Wall Washer, Wall Grazer and Linear are the easiest to forget - make sure every single one's warm glow is clearly visible on its wall or surface, bright enough to read in the night scene.

STEP 4 - CLEAN output. The colored dots, lines and numbers are GUIDES ONLY, not real objects. The final image must be fully photorealistic with NO colored dots, NO lines, NO circles, NO outlines and NO numbers or text - as if a photographer shot the finished building at night.

MOOD: warm 2700-3000K amber-gold light (never cold or blue), cinematic calm luxury night, deep but not pitch-black sky, rich shadows, realistic glow, soft light falloff and reflections on stone and paving. Elegant and restrained, never over-lit. Areas with no marked fixture stay naturally dark.

FINAL CHECK before output: count the lit fixtures in your image - there must be exactly {n}, one for every numbered item in the list (do not forget any Wall Washer or Linear). If one is missing, add it before finishing.

EXTRA NOTES: {note}
"""


def _zone(x: float, y: float) -> str:
    col = "left" if x < 0.34 else "center" if x < 0.67 else "right"
    row = "upper" if y < 0.34 else "middle" if y < 0.67 else "lower"
    if row == "middle" and col == "center":
        return "the center"
    if row == "middle":
        return f"the {col} side"
    if col == "center":
        return f"the {row} center"
    return f"the {row}-{col}"


def build_studio_prompt(annotations, note: str = "") -> str:
    """Build the render prompt from the placed annotations (numbered to match the image).

    annotations: list of {"effect": id, "kind": "line"|"point",
                          "points": [{"x": 0..1, "y": 0..1}, ...], "note": str}
    """
    annotations = annotations or []

    place_lines = []
    for i, a in enumerate(annotations, 1):
        e = _EFFECTS_BY_ID.get(a.get("effect"))
        if not e:
            continue
        pts = a.get("points") or []
        if a.get("kind") == "line" and len(pts) >= 2:
            mx = (pts[0]["x"] + pts[-1]["x"]) / 2
            my = (pts[0]["y"] + pts[-1]["y"]) / 2
            orient = ("horizontal" if abs(pts[-1]["x"] - pts[0]["x"])
                      >= abs(pts[-1]["y"] - pts[0]["y"]) else "vertical")
            loc = f"a {orient} line at {_zone(mx, my)}"
        elif pts:
            loc = _zone(pts[0]["x"], pts[0]["y"])
        else:
            loc = "the center"
        hint = (a.get("note") or "").strip()
        hint = f" ({hint})" if hint else ""
        place_lines.append(f"{i}. {e['en']} - {loc}{hint}")

    placements = "\n".join(place_lines) if place_lines else "(none)"
    n = len(place_lines)

    used = [e for e in EFFECTS if any(a.get("effect") == e["id"] for a in annotations)]
    totals = ", ".join(
        f"{e['en']} x{sum(1 for a in annotations if a.get('effect') == e['id'])}" for e in used
    ) or "(none)"
    legend = "\n".join(f"- {e['color_name']} = {e['en']}: {e['desc']}" for e in used) or "- (none)"
    return STUDIO_PROMPT.format(
        n=n, totals=totals, placements=placements, legend=legend, note=(note or "").strip() or "—"
    )
