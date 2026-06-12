from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

Rect = list[float]  # [x0, y0, x1, y1] in PDF points, top-left origin
Point = list[float]  # [x, y]


# ---------- Operations (discriminated union on `type`) ----------

class EditTextOp(BaseModel):
    type: Literal["edit_text"]
    page: int
    bbox: Rect
    origin: Point
    new_text: str
    font: str = ""
    size: float = 11.0
    color: str = "#000000"
    flags: int = 0


class InsertTextOp(BaseModel):
    type: Literal["insert_text"]
    page: int
    bbox: Rect
    text: str
    size: float = 11.0
    color: str = "#000000"
    font: str = ""


class DeleteTextOp(BaseModel):
    type: Literal["delete_text"]
    page: int
    bbox: Rect


class InsertImageOp(BaseModel):
    type: Literal["insert_image"]
    page: int
    bbox: Rect
    asset_id: str


class DeleteImageOp(BaseModel):
    type: Literal["delete_image"]
    page: int
    bbox: Rect


class MoveImageOp(BaseModel):
    type: Literal["move_image"]
    page: int
    xref: int
    old_bbox: Rect
    new_bbox: Rect


class PageAddOp(BaseModel):
    type: Literal["page_add"]
    page: int  # insert before this index


class PageDeleteOp(BaseModel):
    type: Literal["page_delete"]
    page: int


class PageReorderOp(BaseModel):
    type: Literal["page_reorder"]
    order: list[int]  # new order as list of old indices


class PageRotateOp(BaseModel):
    type: Literal["page_rotate"]
    page: int
    degrees: int = 90


class FillFormOp(BaseModel):
    type: Literal["fill_form"]
    page: int
    field_name: str
    value: str | bool


class PlaceSignatureOp(BaseModel):
    type: Literal["place_signature"]
    page: int
    bbox: Rect
    asset_id: str


class WatermarkOp(BaseModel):
    type: Literal["watermark"]
    text: str
    pages: list[int] | None = None  # None = all
    opacity: float = 0.15
    size: float = 48.0
    color: str = "#888888"
    angle: float = 45.0


Op = Annotated[
    Union[
        EditTextOp, InsertTextOp, DeleteTextOp,
        InsertImageOp, DeleteImageOp, MoveImageOp,
        PageAddOp, PageDeleteOp, PageReorderOp, PageRotateOp,
        FillFormOp, PlaceSignatureOp, WatermarkOp,
    ],
    Field(discriminator="type"),
]


class OperationsRequest(BaseModel):
    operations: list[Op]


# ---------- Responses ----------

class DocumentOut(BaseModel):
    id: str
    name: str
    page_count: int
    current_version: int
    created_at: str


class VersionOut(BaseModel):
    number: int
    created_at: str
    ops_summary: list[str]


class DocumentDetailOut(DocumentOut):
    versions: list[VersionOut]
    max_version: int


class SpanOut(BaseModel):
    id: str
    text: str
    bbox: Rect
    font: str
    size: float
    color: str
    flags: int
    origin: Point


class ImageOut(BaseModel):
    xref: int
    bbox: Rect


class WidgetOut(BaseModel):
    name: str
    type: str
    value: str | bool | None
    rect: Rect
    options: list[str] | None = None


class LayoutOut(BaseModel):
    width: float
    height: float
    rotation: int
    spans: list[SpanOut]
    images: list[ImageOut]
    widgets: list[WidgetOut]


class VersionStateOut(BaseModel):
    current_version: int
    page_count: int
    max_version: int


class RevertRequest(BaseModel):
    version: int


class SplitRequest(BaseModel):
    ranges: str  # e.g. "1-3,7" (1-based)


class OcrRequest(BaseModel):
    pages: list[int] | None = None
    language: str = "eng"
