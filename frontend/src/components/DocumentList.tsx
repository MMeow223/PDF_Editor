import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DocumentInfo } from '../api/types'
import { useEditorStore } from '../store/editorStore'

export function DocumentList() {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const wordRef = useRef<HTMLInputElement>(null)
  const openDocument = useEditorStore(s => s.openDocument)

  const refresh = useCallback(() => {
    api.listDocuments().then(setDocs).catch(e => setError(e.message))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const open = async (d: DocumentInfo) => {
    const detail = await api.getDocument(d.id)
    openDocument(detail.id, detail.name, detail.current_version, detail.page_count, detail.max_version)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          await api.uploadDocument(file)
        } else {
          await api.wordToPdf(file)
        }
      }
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: string) => {
    await api.deleteDocument(id)
    refresh()
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-16 px-4">
      <h1 className="text-3xl font-bold text-slate-800 mb-1">PDF Editor</h1>
      <p className="text-slate-500 mb-8">Edit text, images, pages, forms and more</p>

      <div
        className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      >
        <p className="text-lg text-slate-700 font-medium">
          {uploading ? 'Uploading…' : 'Drop a PDF here or click to browse'}
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Word files (.docx) are converted to PDF (requires LibreOffice)
        </p>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.odt" multiple hidden
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        <input ref={wordRef} type="file" hidden />
      </div>

      {error && (
        <div className="mt-4 w-full max-w-2xl rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {docs.length > 0 && (
        <div className="mt-10 w-full max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent documents</h2>
          <ul className="space-y-2">
            {docs.map(d => (
              <li key={d.id}
                className="bg-white rounded-lg px-4 py-3 flex items-center justify-between shadow-sm hover:shadow cursor-pointer"
                onClick={() => open(d)}>
                <div>
                  <div className="font-medium text-slate-800">{d.name}</div>
                  <div className="text-xs text-slate-400">
                    {d.page_count} page{d.page_count !== 1 ? 's' : ''} · v{d.current_version} · {d.created_at}
                  </div>
                </div>
                <button
                  className="text-slate-400 hover:text-red-600 text-sm px-2 py-1"
                  onClick={e => { e.stopPropagation(); remove(d.id) }}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
