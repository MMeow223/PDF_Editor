import fitz

from .coords import int_to_hex
from .fonts import resolve_font, strip_subset

_WIDGET_TYPE_NAMES = {
    fitz.PDF_WIDGET_TYPE_TEXT: "text",
    fitz.PDF_WIDGET_TYPE_CHECKBOX: "checkbox",
    fitz.PDF_WIDGET_TYPE_RADIOBUTTON: "radio",
    fitz.PDF_WIDGET_TYPE_COMBOBOX: "combobox",
    fitz.PDF_WIDGET_TYPE_LISTBOX: "listbox",
    fitz.PDF_WIDGET_TYPE_BUTTON: "button",
    fitz.PDF_WIDGET_TYPE_SIGNATURE: "signature",
}


def page_layout(page: fitz.Page) -> dict:
    """Extract spans, images and form widgets for the edit overlay.

    All coordinates are in unrotated page space (top-left origin points);
    rotation is reported separately.
    """
    # embedded (extractable) fonts on this page, by normalized basefont name
    import re

    def norm(n: str) -> str:
        return re.sub(r"[^a-z0-9]", "", strip_subset(n).lower())

    embedded = set()
    for entry in page.get_fonts(full=True):
        ext, basefont = entry[1], entry[3]
        if ext != "n/a":
            embedded.add(norm(basefont))

    repl_cache: dict[tuple[str, int], dict] = {}

    def repl_for(font: str, flags: int) -> dict:
        key = (font, flags)
        if key not in repl_cache:
            r = resolve_font(font, flags)
            repl_cache[key] = {
                "family": r["family"],
                "label": r["label"],
                "css": r["css"],
                "bold": r["bold"],
                "italic": r["italic"],
                "embedded_available": any(
                    norm(font) in e or e in norm(font) for e in embedded if e
                ),
            }
        return repl_cache[key]

    spans = []
    text = page.get_text("dict")
    for bi, block in enumerate(text["blocks"]):
        if block["type"] != 0:
            continue
        for li, line in enumerate(block["lines"]):
            for si, span in enumerate(line["spans"]):
                if not span["text"].strip():
                    continue
                spans.append({
                    "id": f"{bi}:{li}:{si}",
                    "text": span["text"],
                    "bbox": list(span["bbox"]),
                    "font": span["font"],
                    "size": round(span["size"], 2),
                    "color": int_to_hex(span["color"]),
                    "flags": span["flags"],
                    "origin": list(span["origin"]),
                    "repl": repl_for(span["font"], span["flags"]),
                })

    images = []
    seen = set()
    for info in page.get_image_info(xrefs=True):
        xref = info.get("xref", 0)
        key = (xref, tuple(round(v, 1) for v in info["bbox"]))
        if key in seen:
            continue
        seen.add(key)
        images.append({"xref": xref, "bbox": list(info["bbox"])})

    widgets = []
    for w in page.widgets() or []:
        wtype = _WIDGET_TYPE_NAMES.get(w.field_type, "unknown")
        if wtype in ("button", "signature", "unknown"):
            continue
        options = None
        if wtype in ("combobox", "listbox"):
            options = [v if isinstance(v, str) else v[0] for v in (w.choice_values or [])]
        elif wtype == "radio":
            states = w.button_states() or {}
            options = [s for s in states.get("normal", []) if s != "Off"]
        value = w.field_value
        if wtype == "checkbox":
            value = bool(value) and value != "Off"
        widgets.append({
            "name": w.field_name or "",
            "type": wtype,
            "value": value,
            "rect": list(w.rect),
            "options": options,
        })

    return {
        "width": page.rect.width,
        "height": page.rect.height,
        "rotation": page.rotation,
        "spans": spans,
        "images": images,
        "widgets": widgets,
    }
