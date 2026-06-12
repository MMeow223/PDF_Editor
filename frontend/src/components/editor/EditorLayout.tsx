import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { usePdfDocument } from '../../hooks/usePdfDocument'
import { Icon } from '../icons'
import { EditorTopBar, ToolDock } from './Toolbar'
import { ThumbnailRail } from './ThumbnailRail'
import { PageView } from './PageView'
import { SignatureModal } from './SignatureModal'
import { WatermarkDialog } from './WatermarkDialog'
import { VersionHistory } from './VersionHistory'

export interface PendingAsset {
  assetId: string
  kind: 'image' | 'signature'
}

export function EditorLayout() {
  const pdf = usePdfDocument()
  const pageCount = useEditorStore(s => s.pageCount)
  const error = useEditorStore(s => s.error)
  const setError = useEditorStore(s => s.setError)
  const busy = useEditorStore(s => s.busy)
  const [pendingAsset, setPendingAsset] = useState<PendingAsset | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [showWatermark, setShowWatermark] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--paper-2)' }}>
      <EditorTopBar onHistory={() => setShowHistory(h => !h)} />

      {error && (
        <div className="bp-errbar">
          <span className="flex-1">{error}</span>
          <button className="cursor-pointer bg-transparent border-none text-white p-0.5" onClick={() => setError(null)} aria-label="Dismiss">
            <Icon id="x" className="w-[18px] h-[18px]" />
          </button>
        </div>
      )}
      {pendingAsset && (
        <div className="bp-hintbar">
          <Icon id={pendingAsset.kind === 'signature' ? 'pen' : 'image'} className="w-[18px] h-[18px]" />
          <span className="flex-1">Click on a page to place the {pendingAsset.kind}</span>
          <button className="bp-btn sm" onClick={() => setPendingAsset(null)}>
            <Icon id="x" /> Cancel
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <ToolDock
          onSignature={() => setShowSignature(true)}
          onWatermark={() => setShowWatermark(true)}
          onPickAsset={setPendingAsset}
        />
        <ThumbnailRail />
        <main className="flex-1 overflow-auto p-10">
          <div className="flex flex-col items-center gap-8">
            {pdf && Array.from({ length: pageCount }, (_, i) => (
              <PageView
                key={i}
                pdf={pdf}
                pageIndex={i}
                pendingAsset={pendingAsset}
                onPlacedAsset={() => setPendingAsset(null)}
              />
            ))}
          </div>
        </main>
        {showHistory && <VersionHistory onClose={() => setShowHistory(false)} />}
      </div>

      <div className="bp-status">
        <span className={busy ? 'dot-busy' : 'dot-ok'} />
        {busy ? 'Working…' : 'All changes saved'}
      </div>

      {showSignature && (
        <SignatureModal
          onClose={() => setShowSignature(false)}
          onReady={assetId => { setPendingAsset({ assetId, kind: 'signature' }); setShowSignature(false) }}
        />
      )}
      {showWatermark && <WatermarkDialog onClose={() => setShowWatermark(false)} />}
    </div>
  )
}
