import { useEffect, useRef, useState } from 'react'
import type { FontFamily, Rect, Span } from '../../api/types'
import { cssFamilyName, ensureFontLoaded, listFamilies } from '../../lib/fonts'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  page: number
  spans: Span[]
  scale: number
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface EditState {
  span: Span
  draft: string
  size: number
  color: string
  box: Rect // live box in CSS px
  family: string // replacement family key (auto-detected or user override)
  overridden: boolean
}

export function TextSpanOverlay({ page, spans, scale }: Props) {
  const applyOps = useEditorStore(s => s.applyOps)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [families, setFamilies] = useState<FontFamily[]>([])
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; box: Rect } | null>(null)

  useEffect(() => { listFamilies().then(setFamilies).catch(() => {}) }, [])

  const pxBox = (r: Rect): Rect => [r[0] * scale, r[1] * scale, r[2] * scale, r[3] * scale]

  const startEdit = (span: Span) => {
    ensureFontLoaded(span.repl.family)
    setEdit({
      span,
      draft: span.text,
      size: span.size,
      color: span.color,
      box: pxBox(span.bbox),
      family: span.repl.family,
      overridden: false,
    })
  }

  const setFamily = (family: string) => {
    if (!edit) return
    ensureFontLoaded(family)
    setEdit({ ...edit, family, overridden: family !== edit.span.repl.family })
  }

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!edit) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box: edit.box }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !edit) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    let [x0, y0, x1, y1] = d.box
    if (d.mode === 'move') {
      x0 += dx; x1 += dx; y0 += dy; y1 += dy
    } else {
      if (d.mode.includes('w')) x0 = Math.min(x0 + dx, x1 - 16)
      if (d.mode.includes('e')) x1 = Math.max(x1 + dx, x0 + 16)
      if (d.mode.includes('n')) y0 = Math.min(y0 + dy, y1 - 12)
      if (d.mode.includes('s')) y1 = Math.max(y1 + dy, y0 + 12)
    }
    setEdit({ ...edit, box: [x0, y0, x1, y1] })
  }

  const onDragUp = () => { drag.current = null }

  const cancel = () => setEdit(null)

  const commit = async () => {
    if (!edit) return
    const { span, draft, size, color, box, family, overridden } = edit
    setEdit(null)

    if (draft.trim() === '') {
      await applyOps([{ type: 'delete_text', page, bbox: span.bbox }])
      return
    }

    const orig = pxBox(span.bbox)
    const moved = box.some((v, i) => Math.abs(v - orig[i]) > 1)
    const resized =
      Math.abs((box[2] - box[0]) - (orig[2] - orig[0])) > 1 ||
      Math.abs((box[3] - box[1]) - (orig[3] - orig[1])) > 1
    const changed =
      draft !== span.text || size !== span.size || color !== span.color || moved || overridden
    if (!changed) return

    const newBbox: Rect = [box[0] / scale, box[1] / scale, box[2] / scale, box[3] / scale]
    await applyOps([{
      type: 'edit_text', page,
      bbox: span.bbox, origin: span.origin,
      new_text: draft, font: span.font, flags: span.flags,
      size, color,
      orig_size: span.size,
      new_bbox: newBbox,
      wrap: resized || draft.includes('\n'),
      repl_family: overridden ? family : null,
    }])
  }

  const repl = edit?.span.repl
  const exactPossible = Boolean(
    edit && !edit.overridden && repl?.embedded_available &&
    [...edit.draft].every(c => edit.span.text.includes(c) || c === ' ' || c === '\n'),
  )

  return (
    <div className="absolute inset-0">
      {spans.map(span => {
        const [x0, y0, x1, y1] = span.bbox
        if (edit && edit.span.id === span.id) return null
        return (
          <div
            key={span.id}
            className="absolute cursor-text hover:outline-2 hover:outline-blue-500 hover:bg-blue-500/10 rounded-xs"
            style={{ left: x0 * scale, top: y0 * scale, width: (x1 - x0) * scale, height: (y1 - y0) * scale }}
            title={`${span.text}\n${span.font} ${span.size}pt → ${span.repl.label}`}
            onClick={e => { e.stopPropagation(); if (!edit) startEdit(span) }}
          />
        )
      })}

      {edit && repl && (
        <>
          {/* floating toolbar */}
          <div
            className="absolute z-40 bg-white rounded-lg shadow-xl border border-slate-300 px-2 py-1.5 text-xs text-slate-600 select-none w-max max-w-md"
            style={{ left: Math.max(0, edit.box[0] - 4), top: Math.max(0, edit.box[1] - 68) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span
                className="cursor-move text-slate-400 px-1 text-base leading-none"
                title="Drag to move text"
                onPointerDown={startDrag('move')}
                onPointerMove={onDragMove}
                onPointerUp={onDragUp}
              >⠿</span>
              <select
                className="border border-slate-300 rounded px-1 py-0.5 max-w-44"
                value={edit.family}
                onChange={e => setFamily(e.target.value)}
                title={`Original font: ${edit.span.font}`}
              >
                {families.map(f => <option key={f.family} value={f.family}>{f.label}</option>)}
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="number" className="w-14 border border-slate-300 rounded px-1 py-0.5"
                  value={edit.size} min={4} max={144} step={0.5}
                  onChange={e => setEdit({ ...edit, size: Number(e.target.value) || edit.size })}
                />
                pt
              </label>
              <input
                type="color" value={edit.color}
                className="w-7 h-7 border border-slate-300 rounded cursor-pointer"
                onChange={e => setEdit({ ...edit, color: e.target.value })}
              />
              <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={cancel} title="Esc">✕</button>
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500" onClick={commit} title="⌘/Ctrl+Enter">✓ Apply</button>
            </div>
            <div className="mt-1 text-[10px] text-slate-400 truncate" title={edit.span.font}>
              {exactPossible
                ? <span className="text-emerald-600 font-medium">Original embedded font will be reused — exact match</span>
                : <>Original: {edit.span.font} → {families.find(f => f.family === edit.family)?.label ?? edit.family}</>}
            </div>
          </div>

          {/* live edit box */}
          <div
            className="absolute z-30 bg-white outline-2 outline-blue-600"
            style={{
              left: edit.box[0], top: edit.box[1],
              width: edit.box[2] - edit.box[0], height: edit.box[3] - edit.box[1],
            }}
            onClick={e => e.stopPropagation()}
          >
            <textarea
              autoFocus
              className="w-full h-full bg-transparent resize-none outline-none overflow-hidden p-0 border-0"
              style={{
                fontSize: edit.size * scale,
                lineHeight: 1.2,
                color: edit.color,
                fontFamily: `${cssFamilyName(edit.family)}, ${repl.css}`,
                fontWeight: repl.bold ? 700 : 400,
                fontStyle: repl.italic ? 'italic' : 'normal',
                whiteSpace: 'pre-wrap',
              }}
              value={edit.draft}
              onChange={e => setEdit({ ...edit, draft: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
                if (e.key === 'Escape') cancel()
              }}
            />
            {/* move border (drag anywhere on edge) */}
            <div className="absolute -inset-1 cursor-move -z-10"
              onPointerDown={startDrag('move')} onPointerMove={onDragMove} onPointerUp={onDragUp} />
            {(['nw', 'ne', 'sw', 'se'] as const).map(m => (
              <div
                key={m}
                className={`absolute w-2.5 h-2.5 bg-blue-600 border border-white rounded-sm
                  ${m.includes('n') ? '-top-1.5' : '-bottom-1.5'} ${m.includes('w') ? '-left-1.5' : '-right-1.5'}
                  ${m === 'nw' || m === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`}
                onPointerDown={startDrag(m)}
                onPointerMove={onDragMove}
                onPointerUp={onDragUp}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
