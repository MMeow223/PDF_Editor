import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'

export function WatermarkDialog({ onClose }: { onClose: () => void }) {
  const applyOps = useEditorStore(s => s.applyOps)
  const pageCount = useEditorStore(s => s.pageCount)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.15)
  const [size, setSize] = useState(48)
  const [color, setColor] = useState('#888888')
  const [angle, setAngle] = useState(45)
  const [range, setRange] = useState('')

  const apply = async () => {
    let pages: number[] | null = null
    if (range.trim()) {
      pages = []
      for (const part of range.split(',')) {
        const [a, b] = part.includes('-') ? part.split('-').map(Number) : [Number(part), Number(part)]
        for (let p = a; p <= (b || a); p++) if (p >= 1 && p <= pageCount) pages.push(p - 1)
      }
    }
    const ok = await applyOps([{ type: 'watermark', text, pages, opacity, size, color, angle }])
    if (ok) onClose()
  }

  const row = 'flex items-center justify-between gap-3 text-sm text-slate-700'
  const input = 'border border-slate-300 rounded px-2 py-1 text-sm'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-96 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-slate-800">Add watermark</h2>
        <label className={row}>Text<input className={`${input} flex-1`} value={text} onChange={e => setText(e.target.value)} /></label>
        <label className={row}>Font size<input type="number" className={`${input} w-20`} value={size} min={8} max={200} onChange={e => setSize(Number(e.target.value))} /></label>
        <label className={row}>Opacity<input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="flex-1" /><span className="w-8 text-right">{opacity.toFixed(2)}</span></label>
        <label className={row}>Angle<input type="number" className={`${input} w-20`} value={angle} min={-90} max={90} onChange={e => setAngle(Number(e.target.value))} /></label>
        <label className={row}>Color<input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-8 border border-slate-300 rounded cursor-pointer" /></label>
        <label className={row}>Pages<input className={`${input} flex-1`} placeholder={`all (1-${pageCount})`} value={range} onChange={e => setRange(e.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-1">
          <button className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
            disabled={!text.trim()} onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
