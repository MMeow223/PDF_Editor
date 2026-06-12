import { create } from 'zustand'
import type { Op, Tool, VersionState } from '../api/types'
import { api } from '../api/client'

interface Selection {
  kind: 'image' | 'overlay'
  page: number
  id: string | number
}

interface EditorState {
  docId: string | null
  docName: string
  version: number
  maxVersion: number
  pageCount: number
  activeTool: Tool
  zoom: number
  selection: Selection | null
  error: string | null
  busy: boolean

  openDocument: (id: string, name: string, version: number, pageCount: number, maxVersion: number) => void
  closeDocument: () => void
  setTool: (t: Tool) => void
  setZoom: (z: number) => void
  setSelection: (s: Selection | null) => void
  setError: (e: string | null) => void
  applyOps: (ops: Op[]) => Promise<boolean>
  undo: () => Promise<void>
  redo: () => Promise<void>
  revert: (version: number) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => {
  const sync = (s: VersionState) =>
    set({ version: s.current_version, pageCount: s.page_count, maxVersion: s.max_version, selection: null })

  const guarded = async (fn: () => Promise<VersionState>): Promise<boolean> => {
    const { docId } = get()
    if (!docId) return false
    set({ busy: true, error: null })
    try {
      sync(await fn())
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return false
    } finally {
      set({ busy: false })
    }
  }

  return {
    docId: null,
    docName: '',
    version: 0,
    maxVersion: 0,
    pageCount: 0,
    activeTool: 'select',
    zoom: 1,
    selection: null,
    error: null,
    busy: false,

    openDocument: (id, name, version, pageCount, maxVersion) =>
      set({ docId: id, docName: name, version, pageCount, maxVersion, activeTool: 'select', selection: null, error: null }),
    closeDocument: () => set({ docId: null, docName: '', version: 0, pageCount: 0, selection: null }),
    setTool: (t) => set({ activeTool: t, selection: null }),
    setZoom: (z) => set({ zoom: Math.min(3, Math.max(0.4, z)) }),
    setSelection: (s) => set({ selection: s }),
    setError: (e) => set({ error: e }),

    applyOps: (ops) => guarded(() => api.applyOperations(get().docId!, ops)),
    undo: async () => { await guarded(() => api.undo(get().docId!)) },
    redo: async () => { await guarded(() => api.redo(get().docId!)) },
    revert: async (version) => { await guarded(() => api.revert(get().docId!, version)) },
  }
})
