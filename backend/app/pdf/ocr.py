import os

import fitz

from ..config import find_tessdata

# pages with less extracted text than this are considered scanned
TEXT_THRESHOLD = 20


def ocr_pages(doc: fitz.Document, pages: list[int] | None, language: str = "eng") -> list[int]:
    """OCR scanned pages in place: rasterize at 300 dpi, run Tesseract via
    pdfocr_tobytes (image + invisible text layer), replace the page.

    Returns the list of page indices actually OCRed.
    """
    tessdata = find_tessdata()
    if tessdata is None:
        raise RuntimeError(
            "Tesseract language data not found — install with: brew install tesseract"
        )
    os.environ.setdefault("TESSDATA_PREFIX", tessdata)

    targets = pages if pages is not None else list(range(doc.page_count))
    done: list[int] = []
    for pno in targets:
        if not (0 <= pno < doc.page_count):
            continue
        page = doc[pno]
        if len(page.get_text().strip()) >= TEXT_THRESHOLD:
            continue  # already has a text layer
        pix = page.get_pixmap(dpi=300)
        ocr_bytes = pix.pdfocr_tobytes(language=language, tessdata=tessdata)
        ocr_doc = fitz.open("pdf", ocr_bytes)
        doc.delete_page(pno)
        doc.insert_pdf(ocr_doc, start_at=pno)
        ocr_doc.close()
        done.append(pno)
    return done
