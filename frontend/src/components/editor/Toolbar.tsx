import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Tool } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'
import type { PendingAsset } from './EditorLayout'

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: 'select', label: '↖', title: 'Select / move images' },
  { id: 'text', label: 'T', title: 'Edit existing text' },
  { id: 'addText', label: '+T', title: 'Add new text' },
  { id: 'forms', label: '☐', title: 'Fill form fields' },
]

interface Props {
  onSignature: () => void
  onWatermark: () => void
  onHistory: () => void
  onPickAsset: (a: PendingAsset) => void
}

export function Toolbar({ onSignature, onWatermark, onHistory, onPickAsset }: Props) {
  const s = useEditorStore()
  const imageRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)
  const [exportOpen, setExportOpen] = useState(false)

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
      window.alert(`Created "${doc.name}" — find it in the document list.`)
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

  const btn = 'px-2.5 py-1.5 rounded text-sm font-medium transition-colors'
  const toolBtn = (active: boolean) =>
    `${btn} ${active ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`

  return (
    <header className="bg-slate-800 text-white px-3 py-2 flex items-center gap-2 flex-wrap shadow z-10">
      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={s.closeDocument} title="Back to documents">
        ←
      </button>
      <span className="font-medium text-sm max-w-48 truncate" title={s.docName}>{s.docName}</span>

      <div className="w-px h-6 bg-slate-600 mx-1" />

      {TOOLS.map(t => (
        <button key={t.id} className={toolBtn(s.activeTool === t.id)} title={t.title}
          onClick={() => s.setTool(t.id)}>
          {t.label}
        </button>
      ))}
      <button className={`${btn} bg-white text-slate-700 hover:bg-slate-100`} title="Insert image"
        onClick={() => imageRef.current?.click()}>
        🖼 Image
      </button>
      <button className={`${btn} bg-white text-slate-700 hover:bg-slate-100`} title="Add signature"
        onClick={onSignature}>
        ✍ Sign
      </button>
      <button className={`${btn} bg-white text-slate-700 hover:bg-slate-100`} title="Watermark all pages"
        onClick={onWatermark}>
        ◈ Watermark
      </button>

      <div className="w-px h-6 bg-slate-600 mx-1" />

      <button className={`${btn} bg-slate-700 hover:bg-slate-600 disabled:opacity-40`}
        disabled={s.version === 0} onClick={s.undo} title="Undo">⎌ Undo</button>
      <button className={`${btn} bg-slate-700 hover:bg-slate-600 disabled:opacity-40`}
        disabled={s.version >= s.maxVersion} onClick={s.redo} title="Redo">Redo</button>

      <div className="w-px h-6 bg-slate-600 mx-1" />

      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={() => s.setZoom(s.zoom - 0.2)}>−</button>
      <span className="text-xs w-10 text-center">{Math.round(s.zoom * 100)}%</span>
      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={() => s.setZoom(s.zoom + 0.2)}>+</button>

      <div className="flex-1" />

      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={() => mergeRef.current?.click()}
        title="Append another PDF">Merge</button>
      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={split}
        title="Extract pages to a new document">Split</button>
      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={runOcr}
        title="OCR scanned pages">OCR</button>
      <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={onHistory}>History</button>

      <div className="relative">
        <button className={`${btn} bg-emerald-600 hover:bg-emerald-500`} onClick={() => setExportOpen(o => !o)}>
          Export ▾
        </button>
        {exportOpen && s.docId && (
          <div className="absolute right-0 mt-1 bg-white text-slate-800 rounded-lg shadow-xl py-1 w-44 z-20"
            onClick={() => setExportOpen(false)}>
            <a className="block px-4 py-2 text-sm hover:bg-slate-100" href={api.exportUrl(s.docId, 'pdf')}>Download PDF</a>
            <a className="block px-4 py-2 text-sm hover:bg-slate-100" href={api.exportUrl(s.docId, 'png', '?dpi=150')}>Pages as PNG</a>
            <a className="block px-4 py-2 text-sm hover:bg-slate-100" href={api.exportUrl(s.docId, 'docx')}>As Word (.docx)</a>
          </div>
        )}
      </div>

      <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" hidden
        onChange={e => { pickImage(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={mergeRef} type="file" accept=".pdf" hidden
        onChange={e => { mergeFile(e.target.files?.[0]); e.target.value = '' }} />
    </header>
  )
}
