"""Font resolution for edited text — most accurate replacement available.

Tiers (best first):
1. The PDF's own embedded font, when extractable and it contains every glyph
   of the new text (true 100% match) — see text_ops.find_embedded_font.
2. Bundled metric-compatible fonts: Liberation Sans/Serif/Mono are drop-in
   metric matches for Arial / Times New Roman / Courier New; Carlito for
   Calibri; Caladea for Cambria.
3. Base-14 (helv/tiro/cour) as last resort — only if a bundled file is
   missing on disk.
"""

import re
from pathlib import Path

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

# family key -> (file prefix, human label, css generic fallback)
FAMILIES = {
    "liberation-sans": ("LiberationSans", "Liberation Sans (≈ Arial/Helvetica)", "sans-serif"),
    "liberation-serif": ("LiberationSerif", "Liberation Serif (≈ Times New Roman)", "serif"),
    "liberation-mono": ("LiberationMono", "Liberation Mono (≈ Courier New)", "monospace"),
    "carlito": ("Carlito", "Carlito (≈ Calibri)", "sans-serif"),
    "caladea": ("Caladea", "Caladea (≈ Cambria)", "serif"),
}

_VARIANT_SUFFIX = {
    (False, False): "Regular",
    (True, False): "Bold",
    (False, True): "Italic",
    (True, True): "BoldItalic",
}

_BASE14 = {
    "liberation-sans": ("helv", "hebo", "heit", "hebi"),
    "carlito": ("helv", "hebo", "heit", "hebi"),
    "liberation-serif": ("tiro", "tibo", "tiit", "tibi"),
    "caladea": ("tiro", "tibo", "tiit", "tibi"),
    "liberation-mono": ("cour", "cobo", "coit", "cobi"),
}

# ordered: first match wins
_NAME_RULES: list[tuple[str, str]] = [
    (r"calibri|carlito", "carlito"),
    (r"cambria|caladea", "caladea"),
    (r"courier|consol|menlo|monaco|roboto.?mono|liberation.?mono|\bmono\b", "liberation-mono"),
    (r"times|liberation.?serif|georgia|garamond|cumberland|book.?antiqua|palatino|caslon|minion|charter|serif", "liberation-serif"),
    (r".*", "liberation-sans"),
]

# span flags bits from fitz
FLAG_ITALIC = 1 << 1
FLAG_SERIFED = 1 << 2
FLAG_MONO = 1 << 3
FLAG_BOLD = 1 << 4


def strip_subset(font_name: str) -> str:
    """'ABCDEF+TimesNewRomanPS-BoldMT' -> 'TimesNewRomanPS-BoldMT'."""
    return font_name.split("+")[-1]


def classify(font_name: str, flags: int = 0) -> tuple[str, bool, bool]:
    """-> (family_key, bold, italic)."""
    name = strip_subset(font_name).lower()
    bold = bool(flags & FLAG_BOLD) or bool(re.search(r"bold|black|heavy|semibold|demi", name))
    italic = bool(flags & FLAG_ITALIC) or bool(re.search(r"italic|oblique", name))

    family = "liberation-sans"
    if flags & FLAG_MONO:
        family = "liberation-mono"
    else:
        for pattern, fam in _NAME_RULES:
            if re.search(pattern, name):
                family = fam
                break
        # name said sans but flags say serifed -> trust flags
        if family == "liberation-sans" and (flags & FLAG_SERIFED):
            family = "liberation-serif"
    return family, bold, italic


def resolve_font(font_name: str, flags: int = 0, family_override: str | None = None) -> dict:
    """Resolve to a concrete replacement font.

    Returns {"family", "label", "css", "bold", "italic", "file": Path|None,
             "base14": str} — file is None only if the bundled TTF is missing.
    """
    family, bold, italic = classify(font_name, flags)
    if family_override and family_override in FAMILIES:
        family = family_override
    prefix, label, css = FAMILIES[family]
    suffix = _VARIANT_SUFFIX[(bold, italic)]
    path = FONT_DIR / f"{prefix}-{suffix}.ttf"
    return {
        "family": family,
        "label": label,
        "css": css,
        "bold": bold,
        "italic": italic,
        "file": path if path.is_file() else None,
        "fontname": f"{prefix}-{suffix}",
        "base14": _BASE14[family][(1 if bold else 0) + (2 if italic else 0)],
    }


def font_file(family: str, variant: str) -> Path | None:
    """For the font-serving endpoint. variant in Regular/Bold/Italic/BoldItalic."""
    if family not in FAMILIES or variant not in _VARIANT_SUFFIX.values():
        return None
    path = FONT_DIR / f"{FAMILIES[family][0]}-{variant}.ttf"
    return path if path.is_file() else None


def match_font(font_name: str, flags: int = 0) -> str:
    """Legacy Base-14 shortcode (used where a fontfile isn't practical)."""
    return resolve_font(font_name, flags)["base14"]
