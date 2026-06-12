import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { usePdfDocument } from '../../hooks/usePdfDocument'
import { Toolbar } from './Toolbar'
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
    <div className="h-screen flex flex-col bg-slate-200">
      <Toolbar
        onSignature={() => setShowSignature(true)}
        onWatermark={() => setShowWatermark(true)}
        onHistory={() => setShowHistory(h => !h)}
        onPickAsset={setPendingAsset}
      />

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold px-2">×</button>
        </div>
      )}
      {pendingAsset && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-700 px-4 py-2 text-sm flex justify-between">
          <span>Click on a page to place the {pendingAsset.kind}</span>
          <button onClick={() => setPendingAsset(null)} className="font-bold px-2">Cancel</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <ThumbnailRail />
        <main className="flex-1 overflow-auto p-6">
          <div className="flex flex-col items-center gap-6">
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

      {busy && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Working…
        </div>
      )}

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
