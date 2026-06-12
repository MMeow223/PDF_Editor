import { useEffect, useState } from 'react'
import type { ImageInfo, Rect } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  page: number
  images: ImageInfo[]
  scale: number
}

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface Drag {
  mode: Mode
  startX: number
  startY: number
  box: Rect // px
}

export function ImageOverlay({ page, images, scale }: Props) {
  const applyOps = useEditorStore(s => s.applyOps)
  const [selected, setSelected] = useState<number | null>(null) // index into images
  const [drag, setDrag] = useState<Drag | null>(null)
  const [liveBox, setLiveBox] = useState<Rect | null>(null) // px while dragging

  useEffect(() => { setSelected(null); setLiveBox(null) }, [images])

  // Delete key removes selected image
  useEffect(() => {
    if (selected == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const img = images[selected]
        if (img) applyOps([{ type: 'delete_image', page, bbox: img.bbox }])
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, images, page, applyOps])

  const pxBox = (r: Rect): Rect => [r[0] * scale, r[1] * scale, r[2] * scale, r[3] * scale]
  const ptBox = (r: Rect): Rect => [r[0] / scale, r[1] / scale, r[2] / scale, r[3] / scale]

  const startDrag = (mode: Mode, idx: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelected(idx)
    const box = liveBox && selected === idx ? liveBox : pxBox(images[idx].bbox)
    setDrag({ mode, startX: e.clientX, startY: e.clientY, box })
    setLiveBox(box)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    let [x0, y0, x1, y1] = drag.box
    if (drag.mode === 'move') {
      x0 += dx; x1 += dx; y0 += dy; y1 += dy
    } else {
      if (drag.mode.includes('w')) x0 = Math.min(x0 + dx, x1 - 10)
      if (drag.mode.includes('e')) x1 = Math.max(x1 + dx, x0 + 10)
      if (drag.mode.includes('n')) y0 = Math.min(y0 + dy, y1 - 10)
      if (drag.mode.includes('s')) y1 = Math.max(y1 + dy, y0 + 10)
    }
    setLiveBox([x0, y0, x1, y1])
  }

  const onUp = () => {
    if (!drag || selected == null || !liveBox) { setDrag(null); return }
    const img = images[selected]
    const moved = liveBox.some((v, i) => Math.abs(v - pxBox(img.bbox)[i]) > 1)
    setDrag(null)
    if (moved) {
      applyOps([{ type: 'move_image', page, xref: img.xref, old_bbox: img.bbox, new_bbox: ptBox(liveBox) }])
      setLiveBox(null)
      setSelected(null)
    }
  }

  const handle = 'absolute w-2.5 h-2.5 bg-blue-600 border border-white rounded-sm'

  return (
    <div className="absolute inset-0">
      {images.map((img, idx) => {
        const box = selected === idx && liveBox ? liveBox : pxBox(img.bbox)
        const [x0, y0, x1, y1] = box
        const isSel = selected === idx
        return (
          <div
            key={`${img.xref}-${idx}`}
            className={`absolute ${isSel ? 'outline-2 outline-blue-600 cursor-move' : 'hover:outline-2 hover:outline-blue-400 cursor-pointer'}`}
            style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
            onClick={e => { e.stopPropagation(); setSelected(idx) }}
            onPointerDown={isSel ? startDrag('move', idx) : undefined}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {isSel && (
              <>
                <div className={`${handle} -top-1 -left-1 cursor-nwse-resize`} onPointerDown={startDrag('nw', idx)} onPointerMove={onMove} onPointerUp={onUp} />
                <div className={`${handle} -top-1 -right-1 cursor-nesw-resize`} onPointerDown={startDrag('ne', idx)} onPointerMove={onMove} onPointerUp={onUp} />
                <div className={`${handle} -bottom-1 -left-1 cursor-nesw-resize`} onPointerDown={startDrag('sw', idx)} onPointerMove={onMove} onPointerUp={onUp} />
                <div className={`${handle} -bottom-1 -right-1 cursor-nwse-resize`} onPointerDown={startDrag('se', idx)} onPointerMove={onMove} onPointerUp={onUp} />
                <button
                  className="absolute -top-8 right-0 bg-red-600 text-white text-xs rounded px-2 py-1 shadow"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    applyOps([{ type: 'delete_image', page, bbox: img.bbox }])
                    setSelected(null)
                  }}>
                  Delete
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
