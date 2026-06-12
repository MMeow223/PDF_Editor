import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  onClose: () => void
  onReady: (assetId: string) => void
}

export function SignatureModal({ onClose, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const docId = useEditorStore(s => s.docId)!
  const setError = useEditorStore(s => s.setError)
  const fileRef = useRef<HTMLInputElement>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = 480 * dpr
    canvas.height = 200 * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e2a5a'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const down = (e: React.PointerEvent) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    hasInk.current = true
    setEmpty(false)
  }
  const up = () => { drawing.current = false }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    hasInk.current = false
    setEmpty(true)
  }

  const useDrawn = () => {
    canvasRef.current!.toBlob(async blob => {
      if (!blob) return
      try {
        const { asset_id } = await api.uploadAsset(docId, blob, 'signature', 'signature.png')
        onReady(asset_id)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }, 'image/png')
  }

  const useUploaded = async (file: File | undefined) => {
    if (!file) return
    try {
      const { asset_id } = await api.uploadAsset(docId, file, 'signature', file.name)
      onReady(asset_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-[540px]" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-800 mb-3">Add signature</h2>
        <canvas
          ref={canvasRef}
          className="border border-slate-300 rounded-lg bg-slate-50 touch-none cursor-crosshair"
          style={{ width: 480, height: 200 }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up}
        />
        <div className="flex items-center gap-2 mt-3">
          <button className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200" onClick={clear}>Clear</button>
          <button className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200"
            onClick={() => fileRef.current?.click()}>Upload image…</button>
          <div className="flex-1" />
          <button className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
            disabled={empty} onClick={useDrawn}>Use signature</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Visual signature only — not a cryptographic digital signature.</p>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden
          onChange={e => { useUploaded(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}
