"""Coordinate contract.

Everything crossing the API boundary is in PDF points with a TOP-LEFT origin,
y increasing downward — PyMuPDF's native page space (fitz.Rect/Point).

fitz reports page.rect and get_text coordinates in the *visible* (rotation-
applied) space, and pdf.js getViewport({scale}) defaults to the page's own
rotation — so both sides agree: the frontend renders with the default viewport
and maps `css_px = pt * scale` in both axes with no y-flip, where
`scale = renderedWidthPx / layout.width`.
"""


def hex_to_rgb(color: str) -> tuple[float, float, float]:
    """'#rrggbb' -> (r, g, b) floats in 0..1 for fitz color args."""
    c = color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    try:
        return tuple(int(c[i : i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return (0.0, 0.0, 0.0)


def int_to_hex(color: int) -> str:
    """fitz span color int -> '#rrggbb'."""
    return f"#{color:06x}"
