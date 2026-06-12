import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { loadPdf, type PdfDocument } from '../lib/pdf'
import { useEditorStore } from '../store/editorStore'

/** Re-fetches PDF bytes whenever the document or version changes. */
export function usePdfDocument(): PdfDocument | null {
  const docId = useEditorStore(s => s.docId)
  const version = useEditorStore(s => s.version)
  const setError = useEditorStore(s => s.setError)
  const [pdf, setPdf] = useState<PdfDocument | null>(null)

  useEffect(() => {
    if (!docId) { setPdf(null); return }
    let cancelled = false
    api.getFileBytes(docId, version)
      .then(loadPdf)
      .then(doc => {
        if (cancelled) { doc.destroy(); return }
        setPdf(prev => { prev?.destroy(); return doc })
      })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [docId, version, setError])

  return pdf
}
