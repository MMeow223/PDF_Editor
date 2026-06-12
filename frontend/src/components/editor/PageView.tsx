import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { PageLayout, Rect } from '../../api/types'
import type { PdfDocument } from '../../lib/pdf'
import { useEditorStore } from '../../store/editorStore'
import type { PendingAsset } from './EditorLayout'
import { TextSpanOverlay } from './TextSpanOverlay'
import { ImageOverlay } from './ImageOverlay'
import { WidgetOverlay } from './WidgetOverlay'
import { AddTextBox } from './AddTextBox'

interface Props {
  pdf: PdfDocument
  pageIndex: number
  pendingAsset: PendingAsset | null
  onPlacedAsset: () => void
}

export function PageView({ pdf, pageIndex, pendingAsset, onPlacedAsset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docId = useEditorStore(s => s.docId)!
  const version = useEditorStore(s => s.version)
  const zoom = useEditorStore(s => s.zoom)
  const activeTool = useEditorStore(s => s.activeTool)
  const applyOps = useEditorStore(s => s.applyOps)
  const [layout, setLayout] = useState<PageLayout | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [addTextAt, setAddTextAt] = useState<{ x: number; y: number } | null>(null)

  // render canvas
  useEffect(() => {
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PdfDocument['getPage']>>['render']> | null = null
    pdf.getPage(pageIndex + 1).then(page => {
      if (cancelled) return
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      setSize({ w: viewport.width, h: viewport.height })
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderTask = page.render({ canvas, canvasContext: ctx, viewport })
      renderTask.promise.catch(() => { /* cancelled */ })
    })
    return () => { cancelled = true; renderTask?.cancel() }
  }, [pdf, pageIndex, zoom])

  // fetch layout
  useEffect(() => {
    let cancelled = false
    api.getLayout(docId, pageIndex)
      .then(l => { if (!cancelled) setLayout(l) })
      .catch(() => { if (!cancelled) setLayout(null) })
    return () => { cancelled = true }
  }, [docId, version, pageIndex])

  // scale: CSS px per PDF point (layout coords match pdf.js default-rotation viewport)
  const scale = layout && size ? size.w / layout.width : zoom

  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const px = (e.clientX - rect.left) / scale
    const py = (e.clientY - rect.top) / scale

    if (pendingAsset) {
      const w = pendingAsset.kind === 'signature' ? 180 : 200
      const h = pendingAsset.kind === 'signature' ? 70 : 150
      const bbox: Rect = [px - w / 2, py - h / 2, px + w / 2, py + h / 2]
      applyOps([
        pendingAsset.kind === 'signature'
          ? { type: 'place_signature', page: pageIndex, bbox, asset_id: pendingAsset.assetId }
          : { type: 'insert_image', page: pageIndex, bbox, asset_id: pendingAsset.assetId },
      ])
      onPlacedAsset()
      return
    }
    if (activeTool === 'addText' && !addTextAt) {
      setAddTextAt({ x: px, y: py })
    }
  }

  return (
    <div
      className="relative bg-white shadow-lg"
      style={size ? { width: size.w, height: size.h } : undefined}
      onClick={handleClick}
      data-page={pageIndex}
    >
      <canvas ref={canvasRef} className="block" />
      {layout && size && (
        <>
          {activeTool === 'text' && (
            <TextSpanOverlay page={pageIndex} spans={layout.spans} scale={scale} />
          )}
          {activeTool === 'select' && (
            <ImageOverlay page={pageIndex} images={layout.images} scale={scale} />
          )}
          {activeTool === 'forms' && (
            <WidgetOverlay page={pageIndex} widgets={layout.widgets} scale={scale} />
          )}
          {addTextAt && (
            <AddTextBox
              page={pageIndex}
              at={addTextAt}
              scale={scale}
              onDone={() => setAddTextAt(null)}
            />
          )}
        </>
      )}
      {pendingAsset && (
        <div className="absolute inset-0 cursor-crosshair bg-blue-500/5" />
      )}
    </div>
  )
}
