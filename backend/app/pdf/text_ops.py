import html

import fitz

from .coords import hex_to_rgb
from .fonts import match_font


def _redact(page: fitz.Page, bbox: list[float]) -> None:
    page.add_redact_annot(fitz.Rect(bbox))
    # PDF_REDACT_IMAGE_NONE: never wipe images overlapping the text rect
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)


def _insert_with_fallback(
    page: fitz.Page,
    bbox: list[float],
    origin: list[float],
    text: str,
    fontname: str,
    size: float,
    color: tuple[float, float, float],
) -> None:
    """insert_text at original baseline when it fits; insert_htmlbox otherwise."""
    rect = fitz.Rect(bbox)
    if "\n" not in text:
        fontsize = size
        try:
            width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
        except Exception:
            width = None
        if width is not None:
            if width > rect.width and rect.width > 0:
                shrunk = fontsize * rect.width / width
                if shrunk >= fontsize * 0.8:
                    fontsize = shrunk
                    width = rect.width
            if width <= rect.width + 1:
                try:
                    page.insert_text(
                        fitz.Point(origin), text,
                        fontname=fontname, fontsize=fontsize, color=color,
                    )
                    return
                except Exception:
                    pass  # non-encodable chars etc. — fall through to htmlbox

    css_color = "rgb(%d,%d,%d)" % tuple(int(c * 255) for c in color)
    if fontname.startswith("co"):
        family = "monospace"
    elif fontname.startswith("ti"):
        family = "serif"
    else:
        family = "sans-serif"
    weight = "bold" if fontname in ("hebo", "hebi", "tibo", "tibi", "cobo", "cobi") else "normal"
    style = "italic" if fontname in ("heit", "hebi", "tiit", "tibi", "coit", "cobi") else "normal"
    body = html.escape(text).replace("\n", "<br>")
    css = (
        f"* {{ font-size: {size}px; color: {css_color}; font-family: {family}; "
        f"font-weight: {weight}; font-style: {style}; margin: 0; padding: 0; }}"
    )
    grown = fitz.Rect(rect.x0, rect.y0, max(rect.x1, rect.x0 + 10), max(rect.y1, rect.y0 + size * 1.4))
    spare, _scale = page.insert_htmlbox(grown, f"<div>{body}</div>", css=css)
    if spare < 0:  # didn't fit — retry allowing htmlbox to scale down
        page.insert_htmlbox(grown, f"<div>{body}</div>", css=css, scale_low=0.3)


def edit_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
    fontname = match_font(op.font, op.flags)
    _insert_with_fallback(
        page, op.bbox, op.origin, op.new_text,
        fontname, op.size, hex_to_rgb(op.color),
    )


def insert_text(page: fitz.Page, op) -> None:
    rect = fitz.Rect(op.bbox)
    fontname = match_font(op.font or "helv")
    ascender = op.size * 0.8
    origin = [rect.x0, rect.y0 + ascender]
    _insert_with_fallback(page, op.bbox, origin, op.text, fontname, op.size, hex_to_rgb(op.color))


def delete_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
