import json
import shutil
from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from ..config import STORAGE_DIR
from ..db import get_db
from ..models import DocumentDetailOut, DocumentOut, LayoutOut
from ..pdf.fonts import FAMILIES, font_file
from ..pdf.layout import page_layout
from ..services import storage, versions

router = APIRouter(prefix="/documents", tags=["documents"])
fonts_router = APIRouter(prefix="/fonts", tags=["fonts"])


@fonts_router.get("")
def list_families():
    return [
        {"family": key, "label": label, "css": css}
        for key, (_prefix, label, css) in FAMILIES.items()
    ]


@fonts_router.get("/{family}/{variant}.ttf")
def get_font(family: str, variant: str):
    path = font_file(family, variant)
    if path is None:
        raise HTTPException(404, "Font not found")
    return FileResponse(
        path, media_type="font/ttf",
        headers={"Cache-Control": "public, max-age=86400"},
    )


def _get_doc_or_404(doc_id: str) -> dict:
    doc = versions.get_document(doc_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(file: UploadFile):
    data = await file.read()
    try:
        info = storage.create_document(file.filename or "untitled.pdf", data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {**info, "created_at": ""}


@router.get("", response_model=list[DocumentOut])
def list_documents():
    rows = get_db().execute(
        """SELECT d.*, v.page_count FROM documents d
           JOIN versions v ON v.document_id = d.id AND v.number = d.current_version
           ORDER BY d.created_at DESC"""
    ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{doc_id}", response_model=DocumentDetailOut)
def get_document(doc_id: str):
    doc = _get_doc_or_404(doc_id)
    rows = get_db().execute(
        "SELECT number, created_at, ops_json FROM versions WHERE document_id = ? ORDER BY number",
        (doc_id,),
    ).fetchall()
    vers = [
        {
            "number": r["number"],
            "created_at": r["created_at"],
            "ops_summary": [op.get("type", "?") for op in json.loads(r["ops_json"])],
        }
        for r in rows
    ]
    return {
        **doc,
        "page_count": versions.page_count_of(doc_id, doc["current_version"]),
        "versions": vers,
        "max_version": versions.max_version(doc_id),
    }


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    _get_doc_or_404(doc_id)
    db = get_db()
    db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    db.commit()
    shutil.rmtree(STORAGE_DIR / doc_id, ignore_errors=True)


@router.get("/{doc_id}/file")
def get_file(doc_id: str, version: int | None = None):
    doc = _get_doc_or_404(doc_id)
    num = doc["current_version"] if version is None else version
    path = versions.file_for_version(doc_id, num)
    if not Path(path).exists():
        raise HTTPException(404, f"Version {num} not found")
    return FileResponse(
        path, media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/{doc_id}/pages/{page}/layout", response_model=LayoutOut)
def get_layout(doc_id: str, page: int):
    _get_doc_or_404(doc_id)
    with fitz.open(str(versions.current_file(doc_id))) as doc:
        if not (0 <= page < doc.page_count):
            raise HTTPException(404, "Page out of range")
        return page_layout(doc[page])


@router.get("/{doc_id}/pages/{page}/thumbnail")
def get_thumbnail(doc_id: str, page: int, w: int = 160):
    _get_doc_or_404(doc_id)
    with fitz.open(str(versions.current_file(doc_id))) as doc:
        if not (0 <= page < doc.page_count):
            raise HTTPException(404, "Page out of range")
        p = doc[page]
        zoom = w / p.rect.width
        pix = p.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        png = pix.tobytes("png")
    return Response(png, media_type="image/png", headers={"Cache-Control": "no-store"})


@router.post("/{doc_id}/assets")
async def upload_asset(doc_id: str, file: UploadFile, kind: str = "image"):
    _get_doc_or_404(doc_id)
    data = await file.read()
    ext = (file.filename or "img.png").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "gif", "webp", "bmp"):
        raise HTTPException(400, "Unsupported image type")
    if kind not in ("image", "signature"):
        raise HTTPException(400, "kind must be 'image' or 'signature'")
    asset_id = storage.save_asset(doc_id, data, kind, ext)
    return {"asset_id": asset_id}
