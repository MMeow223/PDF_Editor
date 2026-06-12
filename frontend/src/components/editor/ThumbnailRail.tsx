import { useState } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../store/editorStore'
import { Icon } from '../icons'

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
    <aside className="shrink-0 overflow-y-auto py-4"
      style={{ width: 158, background: 'var(--paper-2)', borderRight: 'var(--bd-3)' }}>
      {Array.from({ length: pageCount }, (_, i) => (
        <div key={i} className="relative group mx-auto mb-4" style={{ width: 108 }}
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
            className="w-full bg-white cursor-grab"
            style={{
              border: dragOver === i ? '2px solid var(--accent)' : 'var(--bd)',
              borderRadius: 5,
              boxShadow: dragOver === i ? '3px 3px 0 var(--accent)' : 'var(--sh-sm)',
            }}
            draggable={false}
          />
          <div className="f-disp font-bold text-center mt-1.5" style={{ fontSize: 13 }}>{i + 1}</div>
          <button
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 cursor-pointer grid place-items-center"
            style={{ width: 26, height: 26, background: 'var(--surface)', border: 'var(--bd)', borderRadius: 6, boxShadow: 'var(--sh-sm)' }}
            onClick={() => setMenuPage(menuPage === i ? null : i)} aria-label="Page actions">
            <Icon id="dots" className="w-4 h-4" />
          </button>
          {menuPage === i && (
            <div className="bp-menu absolute top-9 right-0 w-44 z-20" onClick={() => setMenuPage(null)}>
              <button onClick={() => applyOps([{ type: 'page_rotate', page: i, degrees: 90 }])}>
                <Icon id="rotate" className="w-4 h-4" />Rotate 90°
              </button>
              <button onClick={() => applyOps([{ type: 'page_add', page: i + 1 }])}>
                <Icon id="plus" className="w-4 h-4" />Add blank after
              </button>
              <div className="sep" />
              <button className="danger" disabled={pageCount <= 1}
                onClick={() => applyOps([{ type: 'page_delete', page: i }])}>
                <Icon id="trash" className="w-4 h-4" />Delete page
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        className="mx-auto flex items-center justify-center gap-2 font-bold cursor-pointer bg-transparent hover:bg-black/5"
        style={{ width: 108, height: 46, border: '2px dashed var(--ink)', borderRadius: 7, fontSize: 13, color: 'var(--ink-soft)' }}
        onClick={() => applyOps([{ type: 'page_add', page: pageCount }])}>
        <Icon id="plus" className="w-4 h-4" /> Add page
      </button>
    </aside>
  )
}
