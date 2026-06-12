import uuid
from pathlib import Path

import fitz

from ..config import STORAGE_DIR
from ..db import get_db


def doc_dir(doc_id: str) -> Path:
    d = STORAGE_DIR / doc_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def version_path(doc_id: str, number: int) -> Path:
    return doc_dir(doc_id) / f"v{number}.pdf"


def assets_dir(doc_id: str) -> Path:
    d = doc_dir(doc_id) / "assets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def create_document(
    name: str, pdf_bytes: bytes,
    owner_id: int | None = None, folder_id: str | None = None,
) -> dict:
    """Store uploaded PDF as v0 and create DB rows. Raises ValueError on bad/encrypted PDF."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Not a valid PDF: {e}") from e
    if doc.needs_pass:
        doc.close()
        raise ValueError("Encrypted PDFs are not supported — please remove the password first.")
    page_count = doc.page_count
    doc.close()

    doc_id = uuid.uuid4().hex
    path = version_path(doc_id, 0)
    path.write_bytes(pdf_bytes)

    db = get_db()
    db.execute(
        "INSERT INTO documents (id, name, owner_id, folder_id) VALUES (?, ?, ?, ?)",
        (doc_id, name, owner_id, folder_id),
    )
    db.execute(
        "INSERT INTO versions (document_id, number, file_path, page_count) VALUES (?, 0, ?, ?)",
        (doc_id, str(path), page_count),
    )
    db.commit()
    return {"id": doc_id, "name": name, "page_count": page_count, "current_version": 0}


def save_asset(doc_id: str, data: bytes, kind: str, ext: str) -> str:
    asset_id = uuid.uuid4().hex
    path = assets_dir(doc_id) / f"{asset_id}.{ext}"
    path.write_bytes(data)
    db = get_db()
    db.execute(
        "INSERT INTO assets (id, document_id, file_path, kind) VALUES (?, ?, ?, ?)",
        (asset_id, doc_id, str(path), kind),
    )
    db.commit()
    return asset_id


def asset_path(asset_id: str) -> Path | None:
    row = get_db().execute("SELECT file_path FROM assets WHERE id = ?", (asset_id,)).fetchone()
    return Path(row["file_path"]) if row else None
