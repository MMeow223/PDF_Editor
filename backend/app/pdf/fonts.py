"""Map extracted PDF font names to Base-14 substitutes for re-inserted text.

Embedded subset fonts (e.g. 'ABCDEF+TimesNewRomanPS-BoldMT') cannot be reused
for new glyphs, so edited text falls back to the closest Base-14 font.
"""

# span flags bits from fitz
FLAG_ITALIC = 1 << 1
FLAG_SERIFED = 1 << 2
FLAG_MONO = 1 << 3
FLAG_BOLD = 1 << 4


def match_font(font_name: str, flags: int = 0) -> str:
    name = font_name.split("+")[-1].lower()

    mono = bool(flags & FLAG_MONO) or any(k in name for k in ("courier", "mono", "consol"))
    serif = bool(flags & FLAG_SERIFED) or any(k in name for k in ("times", "serif", "georgia", "garamond", "book"))
    bold = bool(flags & FLAG_BOLD) or "bold" in name or "black" in name or "heavy" in name
    italic = bool(flags & FLAG_ITALIC) or "italic" in name or "oblique" in name

    # fitz Base-14 shortcodes: regular / bold / italic / bold-italic
    if mono:
        variants = ("cour", "cobo", "coit", "cobi")
    elif serif:
        variants = ("tiro", "tibo", "tiit", "tibi")
    else:
        variants = ("helv", "hebo", "heit", "hebi")
    return variants[(1 if bold else 0) + (2 if italic else 0)]
