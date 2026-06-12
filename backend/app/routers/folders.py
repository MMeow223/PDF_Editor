import shutil
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import STORAGE_DIR
from ..db import get_db

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: str | None = None


class FolderRename(BaseModel):
    name: str = Field(min_length=1, max_length=128)


def _get_folder_or_404(folder_id: str, user_id: int) -> dict:
    row = get_db().execute(
        "SELECT * FROM folders WHERE id = ? AND owner_id = ?", (folder_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Folder not found")
    return dict(row)


@router.get("")
def list_folders(request: Request):
    rows = get_db().execute(
        "SELECT id, name, parent_id, created_at FROM folders WHERE owner_id = ? ORDER BY name",
        (request.state.user["id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
def create_folder(body: FolderIn, request: Request):
    user_id = request.state.user["id"]
    if body.parent_id is not None:
        _get_folder_or_404(body.parent_id, user_id)
    folder_id = uuid.uuid4().hex
    db = get_db()
    db.execute(
        "INSERT INTO folders (id, name, parent_id, owner_id) VALUES (?, ?, ?, ?)",
        (folder_id, body.name, body.parent_id, user_id),
    )
    db.commit()
    return {"id": folder_id, "name": body.name, "parent_id": body.parent_id}


@router.patch("/{folder_id}")
def rename_folder(folder_id: str, body: FolderRename, request: Request):
    _get_folder_or_404(folder_id, request.state.user["id"])
    db = get_db()
    db.execute("UPDATE folders SET name = ? WHERE id = ?", (body.name, folder_id))
    db.commit()
    return {"id": folder_id, "name": body.name}


@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: str, request: Request):
    user_id = request.state.user["id"]
    _get_folder_or_404(folder_id, user_id)
    db = get_db()

    # collect this folder and all descendants
    ids = [folder_id]
    frontier = [folder_id]
    while frontier:
        marks = ",".join("?" * len(frontier))
        rows = db.execute(
            f"SELECT id FROM folders WHERE parent_id IN ({marks})", frontier
        ).fetchall()
        frontier = [r["id"] for r in rows]
        ids.extend(frontier)

    marks = ",".join("?" * len(ids))
    docs = db.execute(
        f"SELECT id FROM documents WHERE folder_id IN ({marks})", ids
    ).fetchall()
    for d in docs:
        shutil.rmtree(STORAGE_DIR / d["id"], ignore_errors=True)
    db.execute(f"DELETE FROM documents WHERE folder_id IN ({marks})", ids)
    db.execute(f"DELETE FROM folders WHERE id IN ({marks})", ids)
    db.commit()
