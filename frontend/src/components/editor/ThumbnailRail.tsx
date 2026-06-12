import { useState } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../store/editorStore'

export function ThumbnailRail() {
  const docId = useEditorStore(s => s.docId)!
  const version = useEditorStore(s => s.version)
  const pageCount = useEditorStore(s => s.pageCount)
  const applyOps = useEditorStore(s => s.applyOps)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [menuPage, setMenuPage] = useState<number | null>(null)

  const reorder = (from: number, to: number) => {
    if (from === to) return
    const order = Array.from({ length: pageCount }, (_, i) => i)
    order.splice(from, 1)
    order.splice(to, 0, from)
    applyOps([{ type: 'page_reorder', order }])
  }

  return (
    <aside className="w-44 bg-slate-100 border-r border-slate-300 overflow-y-auto p-3 space-y-3 shrink-0">
      {Array.from({ length: pageCount }, (_, i) => (
        <div key={i} className="relative group"
          draggable
          onDragStart={() => setDragFrom(i)}
          onDragOver={e => { e.preventDefault(); setDragOver(i) }}
          onDragLeave={() => setDragOver(d => (d === i ? null : d))}
          onDrop={e => {
            e.preventDefault()
            if (dragFrom != null) reorder(dragFrom, i)
            setDragFrom(null); setDragOver(null)
          }}
          onDragEnd={() => { setDragFrom(null); setDragOver(null) }}
        >
          <img
            src={api.thumbnailUrl(docId, i, version)}
            alt={`Page ${i + 1}`}
            className={`w-full rounded border bg-white shadow-sm cursor-grab
              ${dragOver === i ? 'border-blue-500 border-2' : 'border-slate-300'}`}
            draggable={false}
          />
          <div className="text-center text-xs text-slate-500 mt-1">{i + 1}</div>
          <button
            className="absolute top-1 right-1 bg-white/90 rounded px-1.5 text-slate-600 text-sm opacity-0 group-hover:opacity-100 shadow"
            onClick={() => setMenuPage(menuPage === i ? null : i)}>
            ⋯
          </button>
          {menuPage === i && (
            <div className="absolute top-7 right-1 bg-white rounded-lg shadow-xl py-1 z-20 w-36 text-sm text-slate-700"
              onClick={() => setMenuPage(null)}>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-slate-100"
                onClick={() => applyOps([{ type: 'page_rotate', page: i, degrees: 90 }])}>Rotate 90°</button>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-slate-100"
                onClick={() => applyOps([{ type: 'page_add', page: i + 1 }])}>Add blank after</button>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-slate-100 text-red-600 disabled:opacity-40"
                disabled={pageCount <= 1}
                onClick={() => applyOps([{ type: 'page_delete', page: i }])}>Delete page</button>
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}
