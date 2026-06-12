import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Tool } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'
import { Icon } from '../icons'
import type { PendingAsset } from './EditorLayout'

interface Props {
  onSignature: () => void
  onWatermark: () => void
  onHistory: () => void
  onPickAsset: (a: PendingAsset) => void
}

/* ---------- top bar: navigation, undo/redo, zoom, history, export ---------- */

export function EditorTopBar({ onHistory }: { onHistory: () => void }) {
  const s = useEditorStore()
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <header className="flex items-center gap-3.5 px-5 py-3 flex-wrap z-10 shrink-0"
      style={{ background: 'var(--surface)', borderBottom: 'var(--bd-3)' }}>
      <button className="bp-btn sm" onClick={s.closeDocument}>
        <Icon id="back" /> Files
      </button>

      <div className="f-disp font-bold flex items-center gap-2.5 min-w-0" style={{ fontSize: 18 }}>
        <span className="truncate max-w-72" title={s.docName}>{s.docName}</span>
        <span className="bp-pill" style={{ background: 'var(--paper)' }}>
          {s.pageCount} page{s.pageCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button className="bp-btn sm" disabled={s.version === 0} onClick={s.undo}>
          <Icon id="undo" /> Undo
        </button>
        <button className="bp-btn sm" disabled={s.version >= s.maxVersion} onClick={s.redo}>
          <Icon id="redo" /> Redo
        </button>
      </div>

      <div style={{ width: 2, height: 30, background: 'var(--ink)', opacity: .15 }} />

      <div className="bp-zoom">
        <button onClick={() => s.setZoom(s.zoom - 0.2)} aria-label="Zoom out">
          <Icon id="minus" className="w-[18px] h-[18px]" />
        </button>
        <span className="val">{Math.round(s.zoom * 100)}%</span>
        <button onClick={() => s.setZoom(s.zoom + 0.2)} aria-label="Zoom in">
          <Icon id="plus" className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div style={{ width: 2, height: 30, background: 'var(--ink)', opacity: .15 }} />

      <button className="bp-btn sm" onClick={onHistory}>
        <Icon id="history" /> History
      </button>

      <div className="relative">
        <button className="bp-btn accent sm" onClick={() => setExportOpen(o => !o)}>
          <Icon id="export" /> Export <Icon id="chev" className="!w-3.5 !h-3.5" />
        </button>
        {exportOpen && s.docId && (
          <div className="bp-menu absolute right-0 mt-2 w-48" onClick={() => setExportOpen(false)}>
            <a href={api.exportUrl(s.docId, 'pdf')}><Icon id="doc" className="w-4 h-4" />Download PDF</a>
            <a href={api.exportUrl(s.docId, 'png', '?dpi=150')}><Icon id="image" className="w-4 h-4" />Pages as PNG</a>
            <a href={api.exportUrl(s.docId, 'docx')}><Icon id="text" className="w-4 h-4" />As Word (.docx)</a>
          </div>
        )}
      </div>
    </header>
  )
}

/* ---------- left dock: labeled tools grouped Edit / Insert / Pages ---------- */

const EDIT_TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select', icon: 'cursor', label: 'Select & move' },
  { id: 'text', icon: 'text', label: 'Edit text' },
  { id: 'addText', icon: 'addtext', label: 'Add text' },
  { id: 'forms', icon: 'form', label: 'Fill form' },
]

export function ToolDock({ onSignature, onWatermark, onPickAsset }: Omit<Props, 'onHistory'>) {
  const s = useEditorStore()
  const imageRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)

  const pickImage = async (file: File | undefined) => {
    if (!file || !s.docId) return
    try {
      const { asset_id } = await api.uploadAsset(s.docId, file, 'image', file.name)
      onPickAsset({ assetId: asset_id, kind: 'image' })
    } catch (e) {
      s.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const mergeFile = async (file: File | undefined) => {
    if (!file || !s.docId) return
    s.setError(null)
    try {
      const st = await api.merge(s.docId, file)
      useEditorStore.setState({ version: st.current_version, pageCount: st.page_count, maxVersion: st.max_version })
    } catch (e) {
      s.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const split = async () => {
    if (!s.docId) return
    const ranges = window.prompt('Pages to extract into a new document (e.g. 1-3,5):')
    if (!ranges) return
    try {
      const [doc] = await api.split(s.docId, ranges)
      window.alert(`Created "${doc.name}" — find it in My files.`)
    } catch (e) {
      s.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const runOcr = async () => {
    if (!s.docId) return
    s.setError(null)
    useEditorStore.setState({ busy: true })
    try {
      const st = await api.ocr(s.docId)
      useEditorStore.setState({ version: st.current_version, pageCount: st.page_count, maxVersion: st.max_version })
    } catch (e) {
      s.setError(e instanceof Error ? e.message : String(e))
    } finally {
      useEditorStore.setState({ busy: false })
    }
  }

  return (
    <aside className="shrink-0 overflow-y-auto px-3.5 py-4"
      style={{ width: 210, background: 'var(--surface)', borderRight: 'var(--bd-3)' }}>
      <div className="bp-sec mx-1 mb-2.5" style={{ fontSize: 11 }}>Edit</div>
      {EDIT_TOOLS.map(t => (
        <button key={t.id} className={`bp-tool ${s.activeTool === t.id ? 'on' : ''}`}
          onClick={() => s.setTool(t.id)}>
          <Icon id={t.icon} /> {t.label}
        </button>
      ))}

      <div className="bp-sec mx-1 mt-4 mb-2.5" style={{ fontSize: 11 }}>Insert</div>
      <button className="bp-tool" onClick={() => imageRef.current?.click()}>
        <Icon id="image" /> Image
      </button>
      <button className="bp-tool" onClick={onSignature}>
        <Icon id="pen" /> Signature
      </button>
      <button className="bp-tool" onClick={onWatermark}>
        <Icon id="drop" /> Watermark
      </button>

      <div className="bp-sec mx-1 mt-4 mb-2.5" style={{ fontSize: 11 }}>Pages</div>
      <button className="bp-tool" onClick={() => mergeRef.current?.click()}>
        <Icon id="merge" /> Merge PDF
      </button>
      <button className="bp-tool" onClick={split}>
        <Icon id="split" /> Split pages
      </button>
      <button className="bp-tool" onClick={runOcr}>
        <Icon id="scan" /> Make searchable
      </button>

      <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" hidden
        onChange={e => { pickImage(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={mergeRef} type="file" accept=".pdf" hidden
        onChange={e => { mergeFile(e.target.files?.[0]); e.target.value = '' }} />
    </aside>
  )
}
