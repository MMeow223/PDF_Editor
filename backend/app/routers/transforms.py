import fitz
from fastapi import APIRouter, HTTPException, Request, UploadFile

from ..models import OcrRequest, SplitRequest, VersionStateOut
from ..pdf import ocr, page_ops
from ..services import storage, versions

router = APIRouter(prefix="/documents/{doc_id}", tags=["transforms"])


def _require(doc_id: str) -> None:
    if versions.get_document(doc_id) is None:
        raise HTTPException(404, "Document not found")


@router.post("/merge", response_model=VersionStateOut)
async def merge(doc_id: str, file: UploadFile, position: int | None = None):
    _require(doc_id)
    other = await file.read()
    doc = fitz.open(str(versions.current_file(doc_id)))
    try:
        page_ops.merge_pdf(doc, other, position)
        return versions.commit_new_version(doc_id, doc, [{"type": "merge", "name": file.filename}])
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        doc.close()


@router.post("/split")
def split(doc_id: str, req: SplitRequest, request: Request):
    _require(doc_id)
    doc = fitz.open(str(versions.current_file(doc_id)))
    try:
        indices = page_ops.parse_ranges(req.ranges, doc.page_count)
        data = page_ops.extract_pages(doc, indices)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        doc.close()
    src = versions.get_document(doc_id)
    base = src["name"].rsplit(".pdf", 1)[0]
    info = storage.create_document(
        f"{base}-pages-{req.ranges}.pdf", data,
        owner_id=request.state.user["id"],
    )
    return [info]


@router.post("/ocr", response_model=VersionStateOut)
def run_ocr(doc_id: str, req: OcrRequest):
    _require(doc_id)
    doc = fitz.open(str(versions.current_file(doc_id)))
    try:
        done = ocr.ocr_pages(doc, req.pages, req.language)
        if not done:
            raise HTTPException(400, "No pages needed OCR (text already extractable)")
        return versions.commit_new_version(doc_id, doc, [{"type": "ocr", "pages": done}])
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    finally:
        doc.close()
