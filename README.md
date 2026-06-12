# PDF Editor

Full-stack PDF editor webapp. React frontend renders PDFs with pdf.js; a FastAPI backend does all PDF processing with PyMuPDF — including true in-place text editing, image manipulation, page operations, form filling, OCR and format conversion.

## Features

- **Edit text in place** — click any text span, type a replacement; original text is redacted and rewritten at the same baseline (substitute Base-14 font for embedded fonts)
- **Add new text** anywhere on a page
- **Images** — insert, move, resize, delete (including images already in the PDF)
- **Pages** — add blank, delete, rotate, drag-to-reorder thumbnails, merge another PDF, split/extract pages to a new document
- **Forms** — fill text fields, checkboxes, dropdowns and radio groups in AcroForm PDFs
- **Signature** — draw on a canvas or upload an image, click to place (visual only, not cryptographic)
- **Watermark** — text watermark with opacity/angle/color/page-range controls
- **Undo / redo / history** — every operation batch creates a new version; jump to any version
- **OCR** — make scanned pages searchable/editable (Tesseract)
- **Export** — PDF, pages as PNG (zip), Word (.docx); convert Word → PDF (LibreOffice)

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, pdfjs-dist, Zustand |
| Backend | Python 3.12, FastAPI, PyMuPDF (fitz), pdf2docx, SQLite |
| System deps | Tesseract (OCR), LibreOffice (Word→PDF, optional) |

## Run locally

```bash
# system deps (macOS)
brew install tesseract                  # for OCR
brew install --cask libreoffice         # optional, only for Word→PDF

# backend — http://localhost:8000
cd backend
uv sync --python 3.12
uv run uvicorn app.main:app --reload --port 8000

# frontend — http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and drop a PDF.

## Architecture

- Frontend fetches raw PDF bytes per version and renders with pdf.js. Per-page **layout JSON** (text spans, image rects, form widgets with exact positions from PyMuPDF) powers the click-to-edit overlays.
- Edits are sent as an **operations batch** (`POST /api/documents/{id}/operations`); the backend applies them with fitz and saves a new version file. Undo/redo just moves the document's version pointer; editing after an undo truncates the redo tail (linear history).
- Coordinates everywhere are **PDF points, top-left origin** (PyMuPDF's native space, matching the pdf.js viewport at scale 1) — `css_px = pt × zoom`, no y-flip.
- Storage: `backend/storage/{doc_id}/v{n}.pdf` snapshots + SQLite (`documents`, `versions`, `assets`).

## Limitations

- **Font matching is approximate.** Embedded/subset fonts can't be reused for new glyphs, so edited text falls back to a matched Base-14 font (Helvetica/Times/Courier × bold/italic). Stylized documents will show a visible difference.
- **Encrypted PDFs are rejected** at upload — remove the password first.
- Redact-and-rewrite can clip overlapping ascenders/descenders on very tight layouts; rotated or curved text edits poorly.
- **OCR rasterizes the page** (already true for scans); quality depends on scan DPI; English tessdata by default.
- PDF→Word (pdf2docx) is layout-approximate, especially for multi-column layouts and complex tables. Word→PDF requires LibreOffice.
- Any edit **invalidates existing digital signatures** and degrades accessibility tags; the drawn signature is visual, not cryptographic.
- Single-user, no auth; whole-file snapshot per version grows storage for large PDFs.
