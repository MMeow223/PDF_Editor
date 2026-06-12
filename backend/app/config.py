import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = Path(os.environ.get("PDF_EDITOR_STORAGE", BASE_DIR / "storage"))
DB_PATH = STORAGE_DIR / "pdf_editor.db"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)

_TESSDATA_CANDIDATES = [
    "/opt/homebrew/share/tessdata",
    "/usr/local/share/tessdata",
    "/usr/share/tesseract-ocr/5/tessdata",
]


def find_tessdata() -> str | None:
    env = os.environ.get("TESSDATA_PREFIX")
    if env and Path(env).is_dir():
        return env
    for cand in _TESSDATA_CANDIDATES:
        if Path(cand).is_dir():
            return cand
    return None


_SOFFICE_CANDIDATES = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
]


def find_soffice() -> str | None:
    path = shutil.which("soffice")
    if path:
        return path
    for cand in _SOFFICE_CANDIDATES:
        if Path(cand).is_file():
            return cand
    return None
