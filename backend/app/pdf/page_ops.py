import fitz


def page_add(doc: fitz.Document, op) -> None:
    idx = max(0, min(op.page, doc.page_count))
    ref = doc[min(idx, doc.page_count - 1)] if doc.page_count else None
    width = ref.rect.width if ref else 595
    height = ref.rect.height if ref else 842
    doc.insert_page(idx, width=width, height=height)


def page_delete(doc: fitz.Document, op) -> None:
    if doc.page_count <= 1:
        raise ValueError("Cannot delete the last remaining page")
    doc.delete_page(op.page)


def page_reorder(doc: fitz.Document, op) -> None:
    if sorted(op.order) != list(range(doc.page_count)):
        raise ValueError("Reorder list must be a permutation of all page indices")
    doc.select(op.order)


def page_rotate(doc: fitz.Document, op) -> None:
    page = doc[op.page]
    page.set_rotation((page.rotation + op.degrees) % 360)


def merge_pdf(doc: fitz.Document, other_bytes: bytes, position: int | None = None) -> None:
    other = fitz.open(stream=other_bytes, filetype="pdf")
    if other.needs_pass:
        other.close()
        raise ValueError("Encrypted PDFs are not supported")
    if position is None:
        doc.insert_pdf(other)
    else:
        doc.insert_pdf(other, start_at=position)
    other.close()


def parse_ranges(ranges: str, page_count: int) -> list[int]:
    """'1-3,7' (1-based) -> [0,1,2,6]."""
    out: list[int] = []
    for part in ranges.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(part)
        for p in range(start, end + 1):
            if 1 <= p <= page_count and (p - 1) not in out:
                out.append(p - 1)
    if not out:
        raise ValueError("No valid pages in range")
    return out


def extract_pages(doc: fitz.Document, indices: list[int]) -> bytes:
    new = fitz.open()
    for i in indices:
        new.insert_pdf(doc, from_page=i, to_page=i)
    data = new.tobytes(garbage=3, deflate=True)
    new.close()
    return data
