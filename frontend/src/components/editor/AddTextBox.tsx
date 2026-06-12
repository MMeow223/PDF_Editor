import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  page: number
  at: { x: number; y: number } // PDF points
  scale: number
  onDone: () => void
}

export function AddTextBox({ page, at, scale, onDone }: Props) {
  const applyOps = useEditorStore(s => s.applyOps)
  const [text, setText] = useState('')
  const [size, setSize] = useState(12)
  const [color, setColor] = useState('#000000')

  const commit = async () => {
    if (text.trim()) {
      const width = Math.max(120, text.length * size * 0.6)
      await applyOps([{
        type: 'insert_text', page,
        bbox: [at.x, at.y, at.x + width, at.y + size * 1.5],
        text, size, color,
      }])
    }
    onDone()
  }

  return (
    <div
      className="absolute z-30 bg-white rounded-lg shadow-xl border border-slate-300 p-3 w-72"
      style={{ left: at.x * scale, top: at.y * scale }}
      onClick={e => e.stopPropagation()}
    >
      <textarea
        autoFocus
        className="w-full border border-slate-300 rounded px-2 py-1 text-sm resize-y"
        rows={2}
        placeholder="New text…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape') onDone()
        }}
      />
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
        <label className="flex items-center gap-1">
          Size
          <input type="number" className="w-14 border border-slate-300 rounded px-1 py-0.5"
            value={size} min={4} max={144} onChange={e => setSize(Number(e.target.value))} />
        </label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-7 h-7 border border-slate-300 rounded cursor-pointer" />
        <div className="flex-1" />
        <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={onDone}>Cancel</button>
        <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500" onClick={commit}>Add</button>
      </div>
    </div>
  )
}
