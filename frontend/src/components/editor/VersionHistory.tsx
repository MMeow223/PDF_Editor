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
    <aside className="w-64 bg-white border-l border-slate-300 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800 text-sm">History</h2>
        <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>×</button>
      </div>
      <ul>
        {versions.map(v => (
          <li key={v.number}
            className={`px-4 py-2.5 text-sm cursor-pointer border-b border-slate-100
              ${v.number === current ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'}`}
            onClick={() => revert(v.number)}>
            <div className="font-medium">
              {v.number === 0 ? 'Original' : `Version ${v.number}`}
              {v.number === current && ' ●'}
            </div>
            <div className="text-xs text-slate-400">
              {v.ops_summary.length ? v.ops_summary.join(', ') : 'uploaded'} · {v.created_at}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
