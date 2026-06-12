import io
import subprocess
import tempfile
import zipfile
from pathlib import Path

import fitz

from ..config import find_soffice


def pdf_to_docx(pdf_path: str, docx_path: str) -> None:
    from pdf2docx import Converter

    cv = Converter(pdf_path)
    try:
        cv.convert(docx_path)
    finally:
        cv.close()


def pages_to_png_zip(doc: fitz.Document, indices: list[int], dpi: int = 150) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in indices:
            pix = doc[i].get_pixmap(dpi=dpi)
            zf.writestr(f"page-{i + 1}.png", pix.tobytes("png"))
    return buf.getvalue()


def page_to_png(doc: fitz.Document, index: int, dpi: int = 150) -> bytes:
    return doc[index].get_pixmap(dpi=dpi).tobytes("png")


def word_to_pdf(docx_bytes: bytes, filename: str) -> bytes:
    soffice = find_soffice()
    if soffice is None:
        raise FileNotFoundError(
            "LibreOffice not installed — brew install --cask libreoffice"
        )
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / filename
        src.write_bytes(docx_bytes)
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
            check=True, timeout=120, capture_output=True,
        )
        out = src.with_suffix(".pdf")
        if not out.exists():
            raise RuntimeError("LibreOffice conversion produced no output")
        return out.read_bytes()
