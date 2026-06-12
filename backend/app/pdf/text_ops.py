import html
import re

import fitz

from .coords import hex_to_rgb
from .fonts import resolve_font, strip_subset


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", strip_subset(name).lower())


def _redact(page: fitz.Page, bbox: list[float]) -> None:
    page.add_redact_annot(fitz.Rect(bbox))
    # PDF_REDACT_IMAGE_NONE: never wipe images overlapping the text rect
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)


def _covers(font: fitz.Font, text: str) -> bool:
    return all(font.has_glyph(ord(c)) for c in text if not c.isspace())


def find_embedded_font(page: fitz.Page, span_font: str, text: str) -> bytes | None:
    """Tier 1: extract the span's own embedded font if it can render `text`.

    Subset fonts only contain glyphs already used in the document, so this
    succeeds exactly when the replacement re-uses those characters — and then
    the match is pixel-perfect.
    """
    doc = page.parent
    target = _norm(span_font)
    if not target:
        return None
    for entry in page.get_fonts(full=True):
        xref, ext, _ftype, basefont = entry[0], entry[1], entry[2], entry[3]
        base = _norm(basefont)
        if target not in base and base not in target:
            continue
        if ext == "n/a":  # not embedded
            continue
        try:
            _name, fext, _t, buf = doc.extract_font(xref)
        except Exception:
            continue
        if not buf or fext not in ("ttf", "otf", "cff"):
            continue
        try:
            font = fitz.Font(fontbuffer=buf)
        except Exception:
            continue
        if _covers(font, text):
            return buf
    return None


def _pick_font(page: fitz.Page, op, text: str) -> tuple[fitz.Font, bytes | None, str | None]:
    """-> (font, embedded_buffer_or_None, bundled_filename_or_None)."""
    override = getattr(op, "repl_family", None)
    if not override:  # only attempt exact reuse when user didn't force a family
        buf = find_embedded_font(page, op.font, text)
        if buf:
            return fitz.Font(fontbuffer=buf), buf, None
    res = resolve_font(op.font, op.flags, override)
    if res["file"] is not None:
        font = fitz.Font(fontfile=str(res["file"]))
        if _covers(font, text):
            return font, None, res["file"].name
    return fitz.Font(res["base14"]), None, None


def _write_line(page: fitz.Page, origin: list[float], text: str,
                font: fitz.Font, size: float, color: tuple) -> None:
    tw = fitz.TextWriter(page.rect)
    tw.append(fitz.Point(origin), text, font=font, fontsize=size)
    tw.write_text(page, color=color)


def _insert_wrapped(
    page: fitz.Page,
    bbox: list[float],
    text: str,
    size: float,
    color: tuple[float, float, float],
    op=None,
    font_buf: bytes | None = None,
    font_file: str | None = None,
    css_fallback: str = "sans-serif",
    bold: bool = False,
    italic: bool = False,
) -> None:
    """Wrapping insertion via insert_htmlbox, using the resolved font when given."""
    rect = fitz.Rect(bbox)
    css_color = "rgb(%d,%d,%d)" % tuple(int(c * 255) for c in color)
    archive = None
    family = css_fallback
    face = ""
    if font_buf is not None:
        archive = fitz.Archive()
        archive.add(font_buf, "repl.ttf")
        face = '@font-face { font-family: repl; src: url(repl.ttf); }'
        family = f"repl, {css_fallback}"
    elif font_file is not None:
        from .fonts import FONT_DIR
        archive = fitz.Archive(str(FONT_DIR))
        face = f'@font-face {{ font-family: repl; src: url({font_file}); }}'
        family = f"repl, {css_fallback}"
    body = html.escape(text).replace("\n", "<br>")
    css = (
        f"{face} * {{ font-size: {size}px; color: {css_color}; font-family: {family}; "
        f"font-weight: {'bold' if bold else 'normal'}; "
        f"font-style: {'italic' if italic else 'normal'}; "
        f"margin: 0; padding: 0; line-height: 1.2; }}"
    )
    grown = fitz.Rect(rect.x0, rect.y0, max(rect.x1, rect.x0 + 10), max(rect.y1, rect.y0 + size * 1.4))
    html_doc = f"<div>{body}</div>"
    kwargs = {"css": css}
    if archive is not None:
        kwargs["archive"] = archive
    spare, _scale = page.insert_htmlbox(grown, html_doc, **kwargs)
    if spare < 0:  # didn't fit — retry allowing htmlbox to scale down
        page.insert_htmlbox(grown, html_doc, scale_low=0.3, **kwargs)


def edit_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
    color = hex_to_rgb(op.color)
    target = op.new_bbox or op.bbox
    font, font_buf, font_file = _pick_font(page, op, op.new_text)
    res = resolve_font(op.font, op.flags, getattr(op, "repl_family", None))

    if op.wrap or "\n" in op.new_text:
        _insert_wrapped(
            page, target, op.new_text, op.size, color, op,
            font_buf=font_buf, font_file=font_file,
            css_fallback=res["css"], bold=res["bold"], italic=res["italic"],
        )
        return

    # baseline shifted by the box displacement; ascent scales with a size change
    dx = target[0] - op.bbox[0]
    ascent = op.origin[1] - op.bbox[1]
    if op.orig_size and op.orig_size > 0:
        ascent *= op.size / op.orig_size
    origin = [op.origin[0] + dx, target[1] + ascent]

    size_changed = bool(op.orig_size) and abs(op.size - op.orig_size) > 0.01
    fontsize = op.size
    if not size_changed:
        # shrink slightly to fit the original box, as before
        rect = fitz.Rect(target)
        width = font.text_length(op.new_text, fontsize=fontsize)
        if width > rect.width > 0:
            shrunk = fontsize * rect.width / width
            if shrunk >= fontsize * 0.8:
                fontsize = shrunk
    try:
        _write_line(page, origin, op.new_text, font, fontsize, color)
    except Exception:
        _insert_wrapped(
            page, target, op.new_text, op.size, color, op,
            css_fallback=res["css"], bold=res["bold"], italic=res["italic"],
        )


def insert_text(page: fitz.Page, op) -> None:
    rect = fitz.Rect(op.bbox)
    color = hex_to_rgb(op.color)
    res = resolve_font(op.font or "helv", 0, getattr(op, "repl_family", None))
    if res["file"] is not None:
        font = fitz.Font(fontfile=str(res["file"]))
    else:
        font = fitz.Font(res["base14"])
    if "\n" in op.text or not _covers(font, op.text):
        _insert_wrapped(
            page, op.bbox, op.text, op.size, color,
            font_file=res["file"].name if res["file"] else None,
            css_fallback=res["css"], bold=res["bold"], italic=res["italic"],
        )
        return
    origin = [rect.x0, rect.y0 + op.size * 0.8]
    _write_line(page, origin, op.text, font, op.size, color)


def delete_text(page: fitz.Page, op) -> None:
    _redact(page, op.bbox)
