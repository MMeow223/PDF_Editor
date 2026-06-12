from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_schema
from .routers import documents, export, operations, transforms

app = FastAPI(title="PDF Editor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_schema()

app.include_router(documents.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(transforms.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
