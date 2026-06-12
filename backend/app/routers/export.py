import tempfile
from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response

from ..pdf import convert, page_ops
from ..services import storage, versions

router = APIRouter(tags=["export"])


def _require(doc_id: str) -> dict:
    doc = versions.get_document(doc_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    return doc


@router.get("/documents/{doc_id}/export/pdf")
def export_pdf(doc_id: str):
    doc = _require(doc_id)
    path = versions.current_file(doc_id)
    name = doc["name"] if doc["name"].endswith(".pdf") else doc["name"] + ".pdf"
    return FileResponse(
        path, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/documents/{doc_id}/export/png")
def export_png(doc_id: str, pages: str | None = None, dpi: int = 150):
    _require(doc_id)
    dpi = max(36, min(dpi, 600))
    with fitz.open(str(versions.current_file(doc_id))) as doc:
        try:
            indices = (
                page_ops.parse_ranges(pages, doc.page_count)
                if pages else list(range(doc.page_count))
            )
        except ValueError as e:
            raise HTTPException(400, str(e))
        if len(indices) == 1:
            data = convert.page_to_png(doc, indices[0], dpi)
            return Response(
                data, media_type="image/png",
                headers={"Content-Disposition": f'attachment; filename="page-{indices[0] + 1}.png"'},
            )
        data = convert.pages_to_png_zip(doc, indices, dpi)
    return Response(
        data, media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pages.zip"'},
    )


@router.get("/documents/{doc_id}/export/docx")
def export_docx(doc_id: str):
    doc = _require(doc_id)
    src = versions.current_file(doc_id)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.docx"
        try:
            convert.pdf_to_docx(str(src), str(out))
        except Exception as e:
            raise HTTPException(500, f"PDF to Word conversion failed: {e}")
        data = out.read_bytes()
    name = doc["name"].rsplit(".pdf", 1)[0] + ".docx"
    return Response(
        data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/convert/word-to-pdf", status_code=201)
async def word_to_pdf(file: UploadFile, request: Request, folder_id: str | None = None):
    name = file.filename or "document.docx"
    if not name.lower().endswith((".docx", ".doc", ".odt")):
        raise HTTPException(400, "Expected a Word document (.docx/.doc/.odt)")
    data = await file.read()
    try:
        pdf_bytes = convert.word_to_pdf(data, name)
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Conversion failed: {e}")
    base = name.rsplit(".", 1)[0]
    return storage.create_document(
        f"{base}.pdf", pdf_bytes,
        owner_id=request.state.user["id"], folder_id=folder_id,
    )
