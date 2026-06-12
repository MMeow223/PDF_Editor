import { useState } from 'react'
import type { Span } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  page: number
  spans: Span[]
  scale: number
}

export function TextSpanOverlay({ page, spans, scale }: Props) {
  const applyOps = useEditorStore(s => s.applyOps)
  const [editing, setEditing] = useState<Span | null>(null)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(11)

  const startEdit = (span: Span) => {
    setEditing(span)
    setDraft(span.text)
    setColor(span.color)
    setSize(span.size)
  }

  const commit = async () => {
    if (!editing) return
    const span = editing
    setEditing(null)
    if (draft === span.text) return
    if (draft.trim() === '') {
      await applyOps([{ type: 'delete_text', page, bbox: span.bbox }])
      return
    }
    await applyOps([{
      type: 'edit_text', page,
      bbox: span.bbox, origin: span.origin,
      new_text: draft, font: span.font, size, color, flags: span.flags,
    }])
  }

  return (
    <div className="absolute inset-0">
      {spans.map(span => {
        const [x0, y0, x1, y1] = span.bbox
        return (
          <div
            key={span.id}
            className="absolute cursor-text hover:outline-2 hover:outline-blue-500 hover:bg-blue-500/10 rounded-xs"
            style={{ left: x0 * scale, top: y0 * scale, width: (x1 - x0) * scale, height: (y1 - y0) * scale }}
            title={span.text}
            onClick={e => { e.stopPropagation(); startEdit(span) }}
          />
        )
      })}

      {editing && (
        <div
          className="absolute z-30 bg-white rounded-lg shadow-xl border border-slate-300 p-3 w-80"
          style={{
            left: Math.max(0, editing.bbox[0] * scale - 8),
            top: editing.bbox[3] * scale + 6,
          }}
          onClick={e => e.stopPropagation()}
        >
          <textarea
            autoFocus
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono resize-y"
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
              if (e.key === 'Escape') setEditing(null)
            }}
          />
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
            <label className="flex items-center gap-1">
              Size
              <input type="number" className="w-14 border border-slate-300 rounded px-1 py-0.5"
                value={size} min={4} max={144} step={0.5}
                onChange={e => setSize(Number(e.target.value))} />
            </label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-7 h-7 border border-slate-300 rounded cursor-pointer" />
            <span className="text-slate-400 truncate flex-1" title={editing.font}>{editing.font}</span>
            <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500" onClick={commit}>
              Apply
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Replacement uses a substitute font — exact match isn't possible for embedded fonts. Empty text deletes the span.
          </p>
        </div>
      )}
    </div>
  )
}
