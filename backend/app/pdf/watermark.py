import fitz

from .coords import hex_to_rgb


def apply_watermark(doc: fitz.Document, op) -> None:
    pages = op.pages if op.pages is not None else range(doc.page_count)
    color = hex_to_rgb(op.color)
    for pno in pages:
        if not (0 <= pno < doc.page_count):
            continue
        page = doc[pno]
        center = fitz.Point(page.rect.width / 2, page.rect.height / 2)
        text_width = fitz.get_text_length(op.text, fontname="helv", fontsize=op.size)
        start = fitz.Point(center.x - text_width / 2, center.y + op.size / 3)
        page.insert_text(
            start, op.text,
            fontname="helv", fontsize=op.size, color=color,
            fill_opacity=op.opacity,
            morph=(center, fitz.Matrix(op.angle)),
            overlay=True,
        )
