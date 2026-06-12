import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { VersionInfo } from '../../api/types'
import { useEditorStore } from '../../store/editorStore'

export function VersionHistory({ onClose }: { onClose: () => void }) {
  const docId = useEditorStore(s => s.docId)!
  const current = useEditorStore(s => s.version)
  const revert = useEditorStore(s => s.revert)
  const [versions, setVersions] = useState<VersionInfo[]>([])

  useEffect(() => {
    api.getDocument(docId).then(d => setVersions(d.versions)).catch(() => {})
  }, [docId, current])

  return (
    <aside className="w-72 overflow-y-auto shrink-0"
      style={{ background: 'var(--surface)', borderLeft: 'var(--bd-3)' }}>
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: 'var(--bd)' }}>
        <h2 className="f-disp font-bold m-0" style={{ fontSize: 17 }}>History</h2>
        <button className="cursor-pointer bg-transparent border-none font-bold text-lg p-0"
          style={{ color: 'var(--ink-soft)' }} onClick={onClose} aria-label="Close">×</button>
      </div>
      <ul className="m-0 p-0 list-none">
        {versions.map(v => (
          <li key={v.number}
            className="px-4 py-3 text-sm cursor-pointer"
            style={{
              borderBottom: '2px solid var(--paper-2)',
              background: v.number === current ? 'var(--accent)' : 'transparent',
              color: v.number === current ? '#fff' : 'var(--ink)',
            }}
            onClick={() => revert(v.number)}>
            <div className="font-bold">
              {v.number === 0 ? 'Original' : `Version ${v.number}`}
              {v.number === current && ' ●'}
            </div>
            <div className="text-xs font-semibold mt-0.5"
              style={{ color: v.number === current ? 'rgba(255,255,255,.75)' : 'var(--ink-soft)' }}>
              {v.ops_summary.length ? v.ops_summary.join(', ') : 'uploaded'} · {v.created_at}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
