import fitz

from ..services.storage import asset_path


def fill_form(page: fitz.Page, op) -> None:
    for w in page.widgets() or []:
        if w.field_name != op.field_name:
            continue
        if w.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
            w.field_value = bool(op.value) and op.value not in ("Off", "false", False)
        elif w.field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
            w.field_value = op.value
        else:
            w.field_value = str(op.value)
        w.update()
        return
    raise ValueError(f"No form field named '{op.field_name}' on page {op.page}")


def place_signature(page: fitz.Page, op) -> None:
    path = asset_path(op.asset_id)
    if path is None:
        raise ValueError(f"Unknown asset {op.asset_id}")
    page.insert_image(fitz.Rect(op.bbox), filename=str(path), keep_proportion=False)
