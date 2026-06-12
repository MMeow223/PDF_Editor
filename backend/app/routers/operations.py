import fitz
from fastapi import APIRouter, HTTPException

from ..models import OperationsRequest, RevertRequest, VersionStateOut
from ..pdf import form_ops, image_ops, page_ops, text_ops, watermark
from ..services import versions

router = APIRouter(prefix="/documents/{doc_id}", tags=["operations"])


def _apply_op(doc: fitz.Document, op) -> None:
    t = op.type
    if t in ("edit_text", "insert_text", "delete_text", "insert_image",
             "delete_image", "move_image", "fill_form", "place_signature"):
        if not (0 <= op.page < doc.page_count):
            raise ValueError(f"Page {op.page} out of range")
        page = doc[op.page]
        if t == "edit_text":
            text_ops.edit_text(page, op)
        elif t == "insert_text":
            text_ops.insert_text(page, op)
        elif t == "delete_text":
            text_ops.delete_text(page, op)
        elif t == "insert_image":
            image_ops.insert_image(page, op)
        elif t == "delete_image":
            image_ops.delete_image(page, op)
        elif t == "move_image":
            image_ops.move_image(doc, page, op)
        elif t == "fill_form":
            form_ops.fill_form(page, op)
        elif t == "place_signature":
            form_ops.place_signature(page, op)
    elif t == "page_add":
        page_ops.page_add(doc, op)
    elif t == "page_delete":
        page_ops.page_delete(doc, op)
    elif t == "page_reorder":
        page_ops.page_reorder(doc, op)
    elif t == "page_rotate":
        page_ops.page_rotate(doc, op)
    elif t == "watermark":
        watermark.apply_watermark(doc, op)
    else:
        raise ValueError(f"Unknown operation type {t}")


@router.post("/operations", response_model=VersionStateOut)
def apply_operations(doc_id: str, req: OperationsRequest):
    if versions.get_document(doc_id) is None:
        raise HTTPException(404, "Document not found")
    if not req.operations:
        raise HTTPException(400, "No operations provided")
    doc = fitz.open(str(versions.current_file(doc_id)))
    try:
        for op in req.operations:
            _apply_op(doc, op)
        if any(op.type == "fill_form" for op in req.operations):
            doc.need_appearances(True)
        return versions.commit_new_version(doc_id, doc, req.operations)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        doc.close()


@router.post("/undo", response_model=VersionStateOut)
def undo(doc_id: str):
    if versions.get_document(doc_id) is None:
        raise HTTPException(404, "Document not found")
    return versions.undo(doc_id)


@router.post("/redo", response_model=VersionStateOut)
def redo(doc_id: str):
    if versions.get_document(doc_id) is None:
        raise HTTPException(404, "Document not found")
    return versions.redo(doc_id)


@router.post("/revert", response_model=VersionStateOut)
def revert(doc_id: str, req: RevertRequest):
    if versions.get_document(doc_id) is None:
        raise HTTPException(404, "Document not found")
    return versions.set_pointer(doc_id, req.version)
