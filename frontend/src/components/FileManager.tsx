import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DocumentInfo, Folder, User } from '../api/types'
import { useEditorStore } from '../store/editorStore'

type View = 'grid' | 'list'
type Nav = { kind: 'files'; folderId: string | null } | { kind: 'recent' }

const fmtDate = (s: string) => s ? s.replace('T', ' ').slice(0, 16) : ''

function FolderIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  )
}

function Dots({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded px-1.5 py-0.5"
      onClick={e => { e.stopPropagation(); onClick(e) }}
      aria-label="More actions"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
      </svg>
    </button>
  )
}

interface MenuState {
  x: number
  y: number
  target: { kind: 'doc'; doc: DocumentInfo } | { kind: 'folder'; folder: Folder }
}

interface DialogState {
  kind: 'new-folder' | 'rename-doc' | 'rename-folder' | 'move-doc'
  doc?: DocumentInfo
  folder?: Folder
}

export function FileManager({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [nav, setNav] = useState<Nav>({ kind: 'files', folderId: null })
  const [view, setView] = useState<View>('grid')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogText, setDialogText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const openDocument = useEditorStore(s => s.openDocument)

  const refresh = useCallback(() => {
    Promise.all([api.listDocuments(), api.listFolders()])
      .then(([d, f]) => { setDocs(d); setFolders(f) })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const currentFolderId = nav.kind === 'files' ? nav.folderId : null
  const folderById = useMemo(() => new Map(folders.map(f => [f.id, f])), [folders])

  const breadcrumb = useMemo(() => {
    const path: Folder[] = []
    let id = currentFolderId
    while (id) {
      const f = folderById.get(id)
      if (!f) break
      path.unshift(f)
      id = f.parent_id
    }
    return path
  }, [currentFolderId, folderById])

  const q = query.trim().toLowerCase()
  const visibleFolders = useMemo(() => {
    if (nav.kind === 'recent') return []
    if (q) return folders.filter(f => f.name.toLowerCase().includes(q))
    return folders.filter(f => f.parent_id === currentFolderId)
  }, [folders, nav.kind, currentFolderId, q])

  const visibleDocs = useMemo(() => {
    if (q) return docs.filter(d => d.name.toLowerCase().includes(q))
    if (nav.kind === 'recent') {
      return [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
    }
    return docs.filter(d => (d.folder_id ?? null) === currentFolderId)
  }, [docs, nav, currentFolderId, q])

  const open = async (d: DocumentInfo) => {
    const detail = await api.getDocument(d.id)
    openDocument(detail.id, detail.name, detail.current_version, detail.page_count, detail.max_version)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.pdf')) await api.uploadDocument(file, currentFolderId)
        else await api.wordToPdf(file, currentFolderId)
      }
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn(); refresh() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const submitDialog = async () => {
    if (!dialog) return
    const name = dialogText.trim()
    if (dialog.kind !== 'move-doc' && !name) return
    if (dialog.kind === 'new-folder') await act(() => api.createFolder(name, currentFolderId))
    if (dialog.kind === 'rename-doc' && dialog.doc) await act(() => api.updateDocument(dialog.doc!.id, { name }))
    if (dialog.kind === 'rename-folder' && dialog.folder) await act(() => api.renameFolder(dialog.folder!.id, name))
    setDialog(null)
  }

  const moveDoc = async (docId: string, folderId: string | null) =>
    act(() => api.updateDocument(docId, { folder_id: folderId }))

  const menuFor = (e: React.MouseEvent, target: MenuState['target']) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: Math.min(r.left, window.innerWidth - 180), y: r.bottom + 4, target })
  }

  const docCard = (d: DocumentInfo) => (
    <div key={d.id}
      className="group bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer overflow-hidden transition-all"
      draggable
      onDragStart={e => e.dataTransfer.setData('application/x-doc-id', d.id)}
      onClick={() => open(d)}>
      <div className="h-36 bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
        <img src={api.thumbnailUrl(d.id, 0, d.current_version, 320)} alt=""
          className="max-h-full max-w-full object-contain" loading="lazy" />
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-1">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate" title={d.name}>{d.name}</div>
          <div className="text-xs text-slate-400">{d.page_count} page{d.page_count !== 1 ? 's' : ''} · {fmtDate(d.created_at)}</div>
        </div>
        <Dots onClick={e => menuFor(e, { kind: 'doc', doc: d })} />
      </div>
    </div>
  )

  const folderCard = (f: Folder) => (
    <div key={f.id}
      className="group bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer px-3 py-3 flex items-center gap-3 transition-all"
      onClick={() => { setQuery(''); setNav({ kind: 'files', folderId: f.id }) }}
      onDragOver={e => { if (e.dataTransfer.types.includes('application/x-doc-id')) e.preventDefault() }}
      onDrop={e => {
        const id = e.dataTransfer.getData('application/x-doc-id')
        if (id) { e.preventDefault(); e.stopPropagation(); moveDoc(id, f.id) }
      }}>
      <FolderIcon className="w-8 h-8 text-amber-400 shrink-0" />
      <div className="text-sm font-medium text-slate-800 truncate flex-1" title={f.name}>{f.name}</div>
      <Dots onClick={e => menuFor(e, { kind: 'folder', folder: f })} />
    </div>
  )

  const listRow = (d: DocumentInfo) => (
    <tr key={d.id} className="group hover:bg-blue-50/50 cursor-pointer border-b border-slate-100"
      draggable onDragStart={e => e.dataTransfer.setData('application/x-doc-id', d.id)}
      onClick={() => open(d)}>
      <td className="px-4 py-2.5 flex items-center gap-3">
        <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5z" />
        </svg>
        <span className="text-sm text-slate-800 truncate">{d.name}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">{fmtDate(d.created_at)}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500 whitespace-nowrap">{d.page_count} page{d.page_count !== 1 ? 's' : ''}</td>
      <td className="px-2 py-2.5 text-right"><Dots onClick={e => menuFor(e, { kind: 'doc', doc: d })} /></td>
    </tr>
  )

  return (
    <div className="h-screen flex flex-col bg-white"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDragOver(false) }}
      onDrop={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files)
        }
      }}>

      {/* top bar */}
      <header className="h-12 flex items-center gap-4 px-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 w-52 shrink-0">
          <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm">P</div>
          <span className="font-semibold text-slate-800">PDF Editor</span>
        </div>
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-slate-100 focus:bg-white border border-transparent focus:border-blue-400 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none"
              placeholder="Search everything"
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-500">{user.username}</span>
          <button className="text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* sidebar */}
        <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 py-3 px-2 space-y-0.5">
          {([
            { key: 'files', label: 'My files', icon: <FolderIcon className="w-4.5 h-4.5" /> },
            { key: 'recent', label: 'Recent', icon: (
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
            ) },
          ] as const).map(item => {
            const active = nav.kind === item.key
            return (
              <button key={item.key}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left
                  ${active ? 'bg-blue-100 text-blue-800 font-medium' : 'text-slate-600 hover:bg-slate-200'}`}
                onClick={() => { setQuery(''); setNav(item.key === 'files' ? { kind: 'files', folderId: null } : { kind: 'recent' }) }}>
                {item.icon}{item.label}
              </button>
            )
          })}
        </aside>

        {/* main */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* command bar */}
          <div className="flex items-center gap-2 px-6 pt-4 pb-2 flex-wrap">
            <button
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" />
              </svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            {nav.kind === 'files' && (
              <button
                className="flex items-center gap-2 text-slate-700 hover:bg-slate-100 border border-slate-300 text-sm font-medium rounded-lg px-4 py-2"
                onClick={() => { setDialogText(''); setDialog({ kind: 'new-folder' }) }}>
                <FolderIcon className="w-4 h-4 text-amber-400" /> New folder
              </button>
            )}
            <div className="ml-auto flex items-center border border-slate-300 rounded-lg overflow-hidden">
              {(['grid', 'list'] as const).map(v => (
                <button key={v}
                  className={`px-3 py-1.5 text-sm ${view === v ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  onClick={() => setView(v)} title={`${v} view`}>
                  {v === 'grid' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
                      <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="4" width="18" height="3" rx="1" /><rect x="3" y="10.5" width="18" height="3" rx="1" />
                      <rect x="3" y="17" width="18" height="3" rx="1" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.odt" multiple hidden
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          </div>

          {/* breadcrumb */}
          <div className="px-6 pb-3 flex items-center gap-1 text-xl font-semibold text-slate-800 flex-wrap">
            {q ? (
              <span>Search results for “{query.trim()}”</span>
            ) : nav.kind === 'recent' ? (
              <span>Recent</span>
            ) : (
              <>
                <button
                  className={breadcrumb.length ? 'text-slate-400 hover:text-blue-600 hover:underline' : ''}
                  onClick={() => setNav({ kind: 'files', folderId: null })}
                  onDragOver={e => { if (e.dataTransfer.types.includes('application/x-doc-id')) e.preventDefault() }}
                  onDrop={e => {
                    const id = e.dataTransfer.getData('application/x-doc-id')
                    if (id) { e.preventDefault(); moveDoc(id, null) }
                  }}>
                  My files
                </button>
                {breadcrumb.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-1">
                    <span className="text-slate-300">/</span>
                    <button
                      className={i < breadcrumb.length - 1 ? 'text-slate-400 hover:text-blue-600 hover:underline' : ''}
                      onClick={() => setNav({ kind: 'files', folderId: f.id })}>
                      {f.name}
                    </button>
                  </span>
                ))}
              </>
            )}
          </div>

          {error && (
            <div className="mx-6 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="px-6 pb-10">
            {visibleFolders.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Folders</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
                  {visibleFolders.map(folderCard)}
                </div>
              </>
            )}

            {visibleDocs.length > 0 && visibleFolders.length > 0 && (
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Files</h3>
            )}

            {view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {visibleDocs.map(docCard)}
              </div>
            ) : visibleDocs.length > 0 && (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>{visibleDocs.map(listRow)}</tbody>
              </table>
            )}

            {visibleDocs.length === 0 && visibleFolders.length === 0 && (
              <div className="text-center py-20 text-slate-400">
                <FolderIcon className="w-14 h-14 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">{q ? 'No results' : 'This folder is empty'}</p>
                {!q && <p className="text-sm mt-1">Drag a PDF here or click Upload</p>}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* full-window drop highlight */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-500/10 border-4 border-blue-400 border-dashed rounded-lg pointer-events-none z-40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-blue-700 font-medium">Drop to upload</div>
        </div>
      )}

      {/* context menu */}
      {menu && (
        <div className="fixed z-50 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-sm"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}>
          {menu.target.kind === 'doc' ? (() => {
            const d = menu.target.doc
            return (
              <>
                <MenuItem label="Open" onClick={() => { setMenu(null); open(d) }} />
                <MenuItem label="Rename" onClick={() => { setMenu(null); setDialogText(d.name); setDialog({ kind: 'rename-doc', doc: d }) }} />
                <MenuItem label="Move to…" onClick={() => { setMenu(null); setDialog({ kind: 'move-doc', doc: d }) }} />
                <MenuItem label="Download" onClick={() => { setMenu(null); window.location.href = api.exportUrl(d.id, 'pdf') }} />
                <div className="border-t border-slate-100 my-1" />
                <MenuItem label="Delete" danger onClick={() => { setMenu(null); act(() => api.deleteDocument(d.id)) }} />
              </>
            )
          })() : (() => {
            const f = menu.target.folder
            return (
              <>
                <MenuItem label="Open" onClick={() => { setMenu(null); setQuery(''); setNav({ kind: 'files', folderId: f.id }) }} />
                <MenuItem label="Rename" onClick={() => { setMenu(null); setDialogText(f.name); setDialog({ kind: 'rename-folder', folder: f }) }} />
                <div className="border-t border-slate-100 my-1" />
                <MenuItem label="Delete" danger onClick={() => {
                  setMenu(null)
                  if (confirm(`Delete folder "${f.name}" and everything inside it?`)) act(() => api.deleteFolder(f.id))
                }} />
              </>
            )
          })()}
        </div>
      )}

      {/* dialogs */}
      {dialog && dialog.kind !== 'move-doc' && (
        <Modal onClose={() => setDialog(null)}>
          <h3 className="font-semibold text-slate-800 mb-3">
            {dialog.kind === 'new-folder' ? 'New folder' : 'Rename'}
          </h3>
          <input autoFocus
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            value={dialogText} onChange={e => setDialogText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitDialog() }}
            placeholder={dialog.kind === 'new-folder' ? 'Folder name' : ''}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button className="text-sm px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              onClick={() => setDialog(null)}>Cancel</button>
            <button className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={submitDialog}>
              {dialog.kind === 'new-folder' ? 'Create' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'move-doc' && dialog.doc && (
        <Modal onClose={() => setDialog(null)}>
          <h3 className="font-semibold text-slate-800 mb-3">Move “{dialog.doc.name}”</h3>
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              onClick={() => { moveDoc(dialog.doc!.id, null); setDialog(null) }}>
              <FolderIcon className="w-4 h-4 text-slate-400" /> My files (top level)
            </button>
            {folderTree(folders).map(({ folder, depth }) => (
              <button key={folder.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                style={{ paddingLeft: 12 + depth * 18 }}
                onClick={() => { moveDoc(dialog.doc!.id, folder.id); setDialog(null) }}>
                <FolderIcon className="w-4 h-4 text-amber-400" /> {folder.name}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button className="text-sm px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              onClick={() => setDialog(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MenuItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${danger ? 'text-red-600' : 'text-slate-700'}`}
      onClick={onClick}>
      {label}
    </button>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function folderTree(folders: Folder[]): { folder: Folder; depth: number }[] {
  const byParent = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const key = f.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  const out: { folder: Folder; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const f of byParent.get(parent) ?? []) {
      out.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
