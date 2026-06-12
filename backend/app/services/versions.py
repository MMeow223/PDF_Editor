import json
from pathlib import Path

import fitz

from ..db import get_db
from .storage import version_path


def get_document(doc_id: str) -> dict | None:
    row = get_db().execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return dict(row) if row else None


def current_file(doc_id: str) -> Path:
    doc = get_document(doc_id)
    if doc is None:
        raise KeyError(doc_id)
    return version_path(doc_id, doc["current_version"])


def file_for_version(doc_id: str, number: int) -> Path:
    return version_path(doc_id, number)


def page_count_of(doc_id: str, number: int) -> int:
    row = get_db().execute(
        "SELECT page_count FROM versions WHERE document_id = ? AND number = ?",
        (doc_id, number),
    ).fetchone()
    return row["page_count"] if row else 0


def max_version(doc_id: str) -> int:
    row = get_db().execute(
        "SELECT MAX(number) AS m FROM versions WHERE document_id = ?", (doc_id,)
    ).fetchone()
    return row["m"] or 0


def state(doc_id: str) -> dict:
    doc = get_document(doc_id)
    cur = doc["current_version"]
    return {
        "current_version": cur,
        "page_count": page_count_of(doc_id, cur),
        "max_version": max_version(doc_id),
    }


def commit_new_version(doc_id: str, fitz_doc: fitz.Document, ops: list) -> dict:
    """Save fitz_doc as a new version after the current pointer, truncating any redo tail."""
    db = get_db()
    doc = get_document(doc_id)
    cur = doc["current_version"]

    # truncate redo branch
    stale = db.execute(
        "SELECT number, file_path FROM versions WHERE document_id = ? AND number > ?",
        (doc_id, cur),
    ).fetchall()
    for row in stale:
        Path(row["file_path"]).unlink(missing_ok=True)
    db.execute(
        "DELETE FROM versions WHERE document_id = ? AND number > ?", (doc_id, cur)
    )

    new_num = cur + 1
    path = version_path(doc_id, new_num)
    fitz_doc.save(str(path), garbage=3, deflate=True)
    ops_json = json.dumps([op.model_dump() if hasattr(op, "model_dump") else op for op in ops])
    db.execute(
        "INSERT INTO versions (document_id, number, file_path, ops_json, page_count) VALUES (?, ?, ?, ?, ?)",
        (doc_id, new_num, str(path), ops_json, fitz_doc.page_count),
    )
    db.execute(
        "UPDATE documents SET current_version = ? WHERE id = ?", (new_num, doc_id)
    )
    db.commit()
    return state(doc_id)


def set_pointer(doc_id: str, number: int) -> dict:
    db = get_db()
    number = max(0, min(number, max_version(doc_id)))
    db.execute("UPDATE documents SET current_version = ? WHERE id = ?", (number, doc_id))
    db.commit()
    return state(doc_id)


def undo(doc_id: str) -> dict:
    return set_pointer(doc_id, get_document(doc_id)["current_version"] - 1)


def redo(doc_id: str) -> dict:
    return set_pointer(doc_id, get_document(doc_id)["current_version"] + 1)
