import fitz

from ..services.storage import asset_path


def insert_image(page: fitz.Page, op) -> None:
    path = asset_path(op.asset_id)
    if path is None:
        raise ValueError(f"Unknown asset {op.asset_id}")
    page.insert_image(fitz.Rect(op.bbox), filename=str(path), keep_proportion=False)


def delete_image(page: fitz.Page, op) -> None:
    """Page-local image removal via redaction (doc-wide delete_image would hit
    every page sharing the xref)."""
    page.add_redact_annot(fitz.Rect(op.bbox))
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_REMOVE,
        text=fitz.PDF_REDACT_TEXT_NONE,
    )


def move_image(doc: fitz.Document, page: fitz.Page, op) -> None:
    img = doc.extract_image(op.xref)
    if not img:
        raise ValueError(f"Cannot extract image xref {op.xref}")
    page.add_redact_annot(fitz.Rect(op.old_bbox))
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_REMOVE,
        text=fitz.PDF_REDACT_TEXT_NONE,
    )
    page.insert_image(fitz.Rect(op.new_bbox), stream=img["image"], keep_proportion=False)
