import type {
  DocumentDetail, DocumentInfo, Op, PageLayout, VersionState,
} from './types'

const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* keep statusText */ }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  uploadDocument(file: File): Promise<DocumentInfo> {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/documents`, { method: 'POST', body: fd }).then(r => json<DocumentInfo>(r))
  },

  listDocuments(): Promise<DocumentInfo[]> {
    return fetch(`${BASE}/documents`).then(r => json<DocumentInfo[]>(r))
  },

  getDocument(id: string): Promise<DocumentDetail> {
    return fetch(`${BASE}/documents/${id}`).then(r => json<DocumentDetail>(r))
  },

  deleteDocument(id: string): Promise<void> {
    return fetch(`${BASE}/documents/${id}`, { method: 'DELETE' }).then(r => {
      if (!r.ok) throw new Error(r.statusText)
    })
  },

  async getFileBytes(id: string, version?: number): Promise<ArrayBuffer> {
    const q = version != null ? `?version=${version}` : ''
    const res = await fetch(`${BASE}/documents/${id}/file${q}`)
    if (!res.ok) throw new Error(res.statusText)
    return res.arrayBuffer()
  },

  getLayout(id: string, page: number): Promise<PageLayout> {
    return fetch(`${BASE}/documents/${id}/pages/${page}/layout`).then(r => json<PageLayout>(r))
  },

  thumbnailUrl(id: string, page: number, version: number, w = 160): string {
    return `${BASE}/documents/${id}/pages/${page}/thumbnail?w=${w}&v=${version}`
  },

  applyOperations(id: string, operations: Op[]): Promise<VersionState> {
    return fetch(`${BASE}/documents/${id}/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    }).then(r => json<VersionState>(r))
  },

  undo(id: string): Promise<VersionState> {
    return fetch(`${BASE}/documents/${id}/undo`, { method: 'POST' }).then(r => json<VersionState>(r))
  },

  redo(id: string): Promise<VersionState> {
    return fetch(`${BASE}/documents/${id}/redo`, { method: 'POST' }).then(r => json<VersionState>(r))
  },

  revert(id: string, version: number): Promise<VersionState> {
    return fetch(`${BASE}/documents/${id}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    }).then(r => json<VersionState>(r))
  },

  uploadAsset(id: string, file: Blob, kind: 'image' | 'signature', filename: string): Promise<{ asset_id: string }> {
    const fd = new FormData()
    fd.append('file', file, filename)
    return fetch(`${BASE}/documents/${id}/assets?kind=${kind}`, { method: 'POST', body: fd })
      .then(r => json<{ asset_id: string }>(r))
  },

  merge(id: string, file: File): Promise<VersionState> {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/documents/${id}/merge`, { method: 'POST', body: fd }).then(r => json<VersionState>(r))
  },

  split(id: string, ranges: string): Promise<DocumentInfo[]> {
    return fetch(`${BASE}/documents/${id}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranges }),
    }).then(r => json<DocumentInfo[]>(r))
  },

  ocr(id: string, pages?: number[], language = 'eng'): Promise<VersionState> {
    return fetch(`${BASE}/documents/${id}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: pages ?? null, language }),
    }).then(r => json<VersionState>(r))
  },

  async wordToPdf(file: File): Promise<DocumentInfo> {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/convert/word-to-pdf`, { method: 'POST', body: fd }).then(r => json<DocumentInfo>(r))
  },

  exportUrl(id: string, kind: 'pdf' | 'png' | 'docx', params = ''): string {
    return `${BASE}/documents/${id}/export/${kind}${params}`
  },
}
