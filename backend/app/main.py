import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import auth
from .db import init_schema
from .routers import documents, export, folders, operations, transforms

app = FastAPI(title="PDF Editor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_schema()

_PUBLIC_PATHS = ("/api/auth/", "/api/health")
_DOC_PATH = re.compile(r"^/api/documents/([0-9a-f]{32})")


@app.middleware("http")
async def require_auth(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api") and not path.startswith(_PUBLIC_PATHS):
        token = request.cookies.get(auth.SESSION_COOKIE)
        user = auth.user_for_token(token) if token else None
        if user is None:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        request.state.user = user
        m = _DOC_PATH.match(path)
        if m and not auth.owns_document(user["id"], m.group(1)):
            return JSONResponse({"detail": "Document not found"}, status_code=404)
    return await call_next(request)


app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(documents.fonts_router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(transforms.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
