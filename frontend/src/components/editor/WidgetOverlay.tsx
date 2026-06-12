import { useEffect, useState } from 'react'
import type { Widget } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  page: number
  widgets: Widget[]
  scale: number
}

export function WidgetOverlay({ page, widgets, scale }: Props) {
  const applyOps = useEditorStore(s => s.applyOps)
  const [values, setValues] = useState<Record<string, string | boolean>>({})

  useEffect(() => {
    const init: Record<string, string | boolean> = {}
    for (const w of widgets) init[w.name] = w.value ?? (w.type === 'checkbox' ? false : '')
    setValues(init)
  }, [widgets])

  const commit = (w: Widget, value: string | boolean) => {
    const prev = w.value ?? (w.type === 'checkbox' ? false : '')
    if (value === prev) return
    applyOps([{ type: 'fill_form', page, field_name: w.name, value }])
  }

  if (widgets.length === 0) {
    return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-300 text-amber-700 text-xs rounded px-3 py-1.5 shadow">
        No form fields on this page
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      {widgets.map((w, i) => {
        const [x0, y0, x1, y1] = w.rect
        const style = {
          left: x0 * scale, top: y0 * scale,
          width: (x1 - x0) * scale, height: (y1 - y0) * scale,
          fontSize: Math.max(9, (y1 - y0) * scale * 0.6),
        }
        const base = 'absolute border border-blue-400 bg-blue-50/70 focus:bg-white focus:outline-blue-600'
        const key = `${w.name}-${i}`
        if (w.type === 'checkbox') {
          return (
            <input key={key} type="checkbox" className="absolute accent-blue-600 cursor-pointer" style={style}
              checked={Boolean(values[w.name])}
              onClick={e => e.stopPropagation()}
              onChange={e => { setValues(v => ({ ...v, [w.name]: e.target.checked })); commit(w, e.target.checked) }} />
          )
        }
        if (w.type === 'combobox' || w.type === 'listbox' || w.type === 'radio') {
          return (
            <select key={key} className={base} style={style}
              value={String(values[w.name] ?? '')}
              onClick={e => e.stopPropagation()}
              onChange={e => { setValues(v => ({ ...v, [w.name]: e.target.value })); commit(w, e.target.value) }}>
              <option value="">—</option>
              {(w.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )
        }
        return (
          <input key={key} type="text" className={`${base} px-1`} style={style}
            value={String(values[w.name] ?? '')}
            onClick={e => e.stopPropagation()}
            onChange={e => setValues(v => ({ ...v, [w.name]: e.target.value }))}
            onBlur={e => commit(w, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        )
      })}
    </div>
  )
}
