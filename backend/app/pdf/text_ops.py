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
    keep_size: bool = False,
) -> None:
    """insert_text at original baseline when it fits; insert_htmlbox otherwise.

    keep_size: honor the requested size even if the text overflows the box
    (user explicitly chose it) — never shrink, never wrap.
    """
    rect = fitz.Rect(bbox)
    if "\n" not in text:
        fontsize = size
        fits = keep_size
        if not keep_size:
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
                fits = width <= rect.width + 1
        if fits:
            try:
                page.insert_text(
                    fitz.Point(origin), text,
                    fontname=fontname, fontsize=fontsize, color=color,
                )
                return
            except Exception:
                pass  # non-encodable chars etc. — fall through to htmlbox

    _insert_htmlbox(page, bbox, text, fontname, size, color)


def _insert_htmlbox(
    page: fitz.Page,
    bbox: list[float],
    text: str,
    fontname: str,
    size: float,
    color: tuple[float, float, float],
) -> None:
    """Wrapping insertion via insert_htmlbox at the given rect."""
    rect = fitz.Rect(bbox)
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
        f"font-weight: {weight}; font-style: {style}; margin: 0; padding: 0; "
        f"line-height: 1.2; }}"
    )
    grown = fitz.Rect(rect.x0, rect.y0, max(rect.x1, rect.x0 + 10), max(rect.y1, rect.y0 + size * 1.4))
    spare, _scale = page.insert_htmlbox(grown, f"<div>{body}</div>", css=css)
    if spare < 0:  # didn't fit — retry allowing htmlbox to scale down
        page.insert_htmlbox(grown, f"<div>{body}</div>", css=css, scale_low=0.3)


def edit_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
    fontname = match_font(op.font, op.flags)
    color = hex_to_rgb(op.color)
    target = op.new_bbox or op.bbox
    if op.wrap:
        _insert_htmlbox(page, target, op.new_text, fontname, op.size, color)
        return
    # baseline shifted by the box displacement; ascent scales with a size change
    dx = target[0] - op.bbox[0]
    ascent = op.origin[1] - op.bbox[1]
    if op.orig_size and op.orig_size > 0:
        ascent *= op.size / op.orig_size
    origin = [op.origin[0] + dx, target[1] + ascent]
    size_changed = bool(op.orig_size) and abs(op.size - op.orig_size) > 0.01
    _insert_with_fallback(
        page, target, origin, op.new_text, fontname, op.size, color,
        keep_size=size_changed,
    )


def insert_text(page: fitz.Page, op) -> None:
    rect = fitz.Rect(op.bbox)
    fontname = match_font(op.font or "helv")
    ascender = op.size * 0.8
    origin = [rect.x0, rect.y0 + ascender]
    _insert_with_fallback(page, op.bbox, origin, op.text, fontname, op.size, hex_to_rgb(op.color))


def delete_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
