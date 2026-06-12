import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DocumentInfo, Folder, User } from '../api/types'
import { useEditorStore } from '../store/editorStore'
import { Icon } from './icons'

type View = 'grid' | 'list'
type Nav = { kind: 'files'; folderId: string | null } | { kind: 'recent' }

const fmtDate = (s: string) => s ? s.replace('T', ' ').slice(0, 16) : ''

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
  const docCountByFolder = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of docs) if (d.folder_id) m.set(d.folder_id, (m.get(d.folder_id) ?? 0) + 1)
    return m
  }, [docs])

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

  const itemCount = visibleFolders.length + visibleDocs.length

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
    setMenu({ x: Math.min(r.left, window.innerWidth - 200), y: r.bottom + 6, target })
  }

  const docCard = (d: DocumentInfo) => (
    <div key={d.id}
      className="bp-card bp-card-hover overflow-hidden cursor-pointer transition-transform"
      draggable
      onDragStart={e => e.dataTransfer.setData('application/x-doc-id', d.id)}
      onClick={() => open(d)}>
      <div className="relative flex items-center justify-center overflow-hidden p-4"
        style={{ height: 168, background: 'var(--paper-2)', borderBottom: 'var(--bd)' }}>
        <img src={api.thumbnailUrl(d.id, 0, d.current_version, 320)} alt=""
          className="bg-white"
          style={{ maxHeight: 132, maxWidth: '100%', objectFit: 'contain', border: 'var(--bd)', borderRadius: 4, boxShadow: 'var(--sh-sm)' }}
          loading="lazy" />
        <span className="absolute font-extrabold text-white"
          style={{ top: 10, left: 10, fontSize: 10, letterSpacing: '.08em', background: 'var(--danger)', border: '2px solid var(--ink)', borderRadius: 5, padding: '2px 6px' }}>
          PDF
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <div className="font-bold leading-tight truncate" style={{ fontSize: 15 }} title={d.name}>{d.name}</div>
          <div className="font-semibold mt-1" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {d.page_count} page{d.page_count !== 1 ? 's' : ''} · {fmtDate(d.created_at)}
          </div>
        </div>
        <button className="shrink-0 cursor-pointer bg-transparent border-none p-1 rounded hover:bg-black/5"
          style={{ color: 'var(--ink-soft)' }}
          onClick={e => { e.stopPropagation(); menuFor(e, { kind: 'doc', doc: d }) }} aria-label="More actions">
          <Icon id="dots" className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  )

  const folderCard = (f: Folder) => (
    <div key={f.id}
      className="bp-card bp-card-hover flex items-center gap-3.5 p-4 cursor-pointer font-bold transition-transform"
      style={{ fontSize: 16 }}
      onClick={() => { setQuery(''); setNav({ kind: 'files', folderId: f.id }) }}
      onDragOver={e => { if (e.dataTransfer.types.includes('application/x-doc-id')) e.preventDefault() }}
      onDrop={e => {
        const id = e.dataTransfer.getData('application/x-doc-id')
        if (id) { e.preventDefault(); e.stopPropagation(); moveDoc(id, f.id) }
      }}>
      <span className="grid place-items-center shrink-0"
        style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--pop)', border: 'var(--bd)' }}>
        <Icon id="folder" className="w-[22px] h-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate" title={f.name}>{f.name}</div>
        <div className="font-semibold mt-0.5" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {docCountByFolder.get(f.id) ?? 0} file{(docCountByFolder.get(f.id) ?? 0) !== 1 ? 's' : ''}
        </div>
      </div>
      <button className="shrink-0 cursor-pointer bg-transparent border-none p-1 rounded hover:bg-black/5"
        style={{ color: 'var(--ink-soft)' }}
        onClick={e => { e.stopPropagation(); menuFor(e, { kind: 'folder', folder: f }) }} aria-label="More actions">
        <Icon id="dots" className="w-[18px] h-[18px]" />
      </button>
    </div>
  )

  const listRow = (d: DocumentInfo) => (
    <tr key={d.id} className="cursor-pointer hover:bg-black/5"
      style={{ borderBottom: '2px solid var(--paper-2)' }}
      draggable onDragStart={e => e.dataTransfer.setData('application/x-doc-id', d.id)}
      onClick={() => open(d)}>
      <td className="px-4 py-3 flex items-center gap-3">
        <Icon id="doc" className="w-5 h-5 shrink-0" />
        <span className="font-bold truncate" style={{ fontSize: 15 }}>{d.name}</span>
      </td>
      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{fmtDate(d.created_at)}</td>
      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{d.page_count} page{d.page_count !== 1 ? 's' : ''}</td>
      <td className="px-2 py-3 text-right">
        <button className="cursor-pointer bg-transparent border-none p-1 rounded hover:bg-black/5"
          style={{ color: 'var(--ink-soft)' }}
          onClick={e => { e.stopPropagation(); menuFor(e, { kind: 'doc', doc: d }) }} aria-label="More actions">
          <Icon id="dots" className="w-[18px] h-[18px]" />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--paper)' }}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDragOver(false) }}
      onDrop={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files)
        }
      }}>

      {/* top bar */}
      <header className="flex items-center gap-4 px-5 py-3.5 shrink-0"
        style={{ background: 'var(--surface)', borderBottom: 'var(--bd-3)' }}>
        <div className="flex items-center gap-3 shrink-0">
          <div className="bp-mark" style={{ width: 42, height: 42 }}>
            <Icon id="doc" className="w-6 h-6" />
          </div>
          <span className="f-disp font-bold leading-none" style={{ fontSize: 21, letterSpacing: '-.01em' }}>PDF Editor</span>
        </div>
        <div className="bp-field-wrap flex-1 max-w-[560px]">
          <Icon id="search" />
          <input className="bp-field" style={{ padding: '11px 14px 11px 44px' }}
            placeholder="Search all documents and folders"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 shrink-0">
          <button className="bp-btn sm ghost" onClick={onLogout}>
            <Icon id="signout" /> Sign out
          </button>
          <div className="f-disp font-bold grid place-items-center rounded-full"
            style={{ width: 38, height: 38, background: 'var(--pop)', border: 'var(--bd)' }}
            title={user.username}>
            {user.username.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* sidebar */}
        <aside className="flex flex-col gap-1.5 shrink-0 p-3.5"
          style={{ width: 230, background: 'var(--surface)', borderRight: 'var(--bd-3)' }}>
          <button className={`bp-nav ${nav.kind === 'files' ? 'on' : ''}`}
            onClick={() => { setQuery(''); setNav({ kind: 'files', folderId: null }) }}>
            <Icon id="folder" /> My files
          </button>
          <button className={`bp-nav ${nav.kind === 'recent' ? 'on' : ''}`}
            onClick={() => { setQuery(''); setNav({ kind: 'recent' }) }}>
            <Icon id="clock" /> Recent
          </button>
          <div className="mt-auto p-3.5" style={{ border: 'var(--bd)', borderRadius: 'var(--r)', background: 'var(--paper)' }}>
            <div className="font-semibold" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''} · {folders.length} folder{folders.length !== 1 ? 's' : ''}
            </div>
            <div className="font-semibold mt-1" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Signed in as <strong style={{ color: 'var(--ink)' }}>{user.username}</strong>
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* command bar */}
          <div className="flex items-center gap-3 px-7 pt-5 pb-3 flex-wrap">
            <button className="bp-btn accent lg" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Icon id="upload" /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
            {nav.kind === 'files' && (
              <button className="bp-btn" onClick={() => { setDialogText(''); setDialog({ kind: 'new-folder' }) }}>
                <Icon id="folder" /> New folder
              </button>
            )}
            <div className="bp-seg ml-auto">
              <button className={view === 'grid' ? 'on' : ''} title="Grid view" onClick={() => setView('grid')}>
                <Icon id="grid" />
              </button>
              <button className={view === 'list' ? 'on' : ''} title="List view" onClick={() => setView('list')}>
                <Icon id="list" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.odt" multiple hidden
              onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          </div>

          {/* crumb */}
          <div className="f-disp font-bold flex items-center gap-3 px-7 pb-4 flex-wrap"
            style={{ fontSize: 30, letterSpacing: '-.01em' }}>
            {q ? (
              <span>Search results</span>
            ) : nav.kind === 'recent' ? (
              <span>Recent</span>
            ) : (
              <span className="flex items-center gap-2 flex-wrap">
                <button
                  className={`f-disp font-bold bg-transparent border-none p-0 cursor-pointer ${breadcrumb.length ? 'hover:underline' : ''}`}
                  style={{ fontSize: 30, letterSpacing: '-.01em', color: breadcrumb.length ? 'var(--ink-soft)' : 'var(--ink)' }}
                  onClick={() => setNav({ kind: 'files', folderId: null })}
                  onDragOver={e => { if (e.dataTransfer.types.includes('application/x-doc-id')) e.preventDefault() }}
                  onDrop={e => {
                    const id = e.dataTransfer.getData('application/x-doc-id')
                    if (id) { e.preventDefault(); moveDoc(id, null) }
                  }}>
                  My files
                </button>
                {breadcrumb.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-2">
                    <span style={{ color: 'var(--ink-soft)', opacity: .4 }}>/</span>
                    <button
                      className={`f-disp font-bold bg-transparent border-none p-0 cursor-pointer ${i < breadcrumb.length - 1 ? 'hover:underline' : ''}`}
                      style={{ fontSize: 30, letterSpacing: '-.01em', color: i < breadcrumb.length - 1 ? 'var(--ink-soft)' : 'var(--ink)' }}
                      onClick={() => setNav({ kind: 'files', folderId: f.id })}>
                      {f.name}
                    </button>
                  </span>
                ))}
              </span>
            )}
            <span className="bp-pill">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          </div>

          {error && (
            <div className="mx-7 mb-3 font-bold text-sm px-4 py-2.5"
              style={{ background: '#fff', border: '2px solid var(--danger)', borderRadius: 'var(--r-sm)', color: 'var(--danger)', boxShadow: '3px 3px 0 var(--danger)' }}>
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-7 pb-8">
            {visibleFolders.length > 0 && (
              <>
                <h5 className="bp-sec mt-1.5 mb-3.5">Folders</h5>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-7">
                  {visibleFolders.map(folderCard)}
                </div>
              </>
            )}

            {visibleDocs.length > 0 && visibleFolders.length > 0 && (
              <h5 className="bp-sec mb-3.5">Files</h5>
            )}

            {view === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleDocs.map(docCard)}
              </div>
            ) : visibleDocs.length > 0 && (
              <div className="bp-card overflow-hidden" style={{ boxShadow: 'var(--sh-sm)' }}>
                <table className="w-full">
                  <thead>
                    <tr className="text-left bp-sec" style={{ borderBottom: 'var(--bd)' }}>
                      <th className="px-4 py-2.5 font-extrabold">Name</th>
                      <th className="px-4 py-2.5 font-extrabold">Created</th>
                      <th className="px-4 py-2.5 font-extrabold">Pages</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>{visibleDocs.map(listRow)}</tbody>
                </table>
              </div>
            )}

            {visibleDocs.length === 0 && visibleFolders.length === 0 && (
              <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>
                <Icon id="folder" className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="font-bold m-0" style={{ fontSize: 17 }}>{q ? 'No results' : 'This folder is empty'}</p>
                {!q && <p className="text-sm mt-1.5 font-semibold">Drag a PDF here or click Upload</p>}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* full-window drop highlight */}
      {dragOver && (
        <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
          style={{ background: 'rgba(39,66,240,.08)', border: '4px dashed var(--accent)' }}>
          <div className="bp-card font-bold px-6 py-4" style={{ fontSize: 17, boxShadow: 'var(--sh)' }}>
            Drop to upload
          </div>
        </div>
      )}

      {/* context menu */}
      {menu && (
        <div className="bp-menu fixed w-48" style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}>
          {menu.target.kind === 'doc' ? (() => {
            const d = menu.target.doc
            return (
              <>
                <button onClick={() => { setMenu(null); open(d) }}><Icon id="doc" className="w-4 h-4" />Open</button>
                <button onClick={() => { setMenu(null); setDialogText(d.name); setDialog({ kind: 'rename-doc', doc: d }) }}><Icon id="text" className="w-4 h-4" />Rename</button>
                <button onClick={() => { setMenu(null); setDialog({ kind: 'move-doc', doc: d }) }}><Icon id="folder" className="w-4 h-4" />Move to…</button>
                <button onClick={() => { setMenu(null); window.location.href = api.exportUrl(d.id, 'pdf') }}><Icon id="export" className="w-4 h-4" />Download</button>
                <div className="sep" />
                <button className="danger" onClick={() => { setMenu(null); act(() => api.deleteDocument(d.id)) }}><Icon id="trash" className="w-4 h-4" />Delete</button>
              </>
            )
          })() : (() => {
            const f = menu.target.folder
            return (
              <>
                <button onClick={() => { setMenu(null); setQuery(''); setNav({ kind: 'files', folderId: f.id }) }}><Icon id="folder" className="w-4 h-4" />Open</button>
                <button onClick={() => { setMenu(null); setDialogText(f.name); setDialog({ kind: 'rename-folder', folder: f }) }}><Icon id="text" className="w-4 h-4" />Rename</button>
                <div className="sep" />
                <button className="danger" onClick={() => {
                  setMenu(null)
                  if (confirm(`Delete folder "${f.name}" and everything inside it?`)) act(() => api.deleteFolder(f.id))
                }}><Icon id="trash" className="w-4 h-4" />Delete</button>
              </>
            )
          })()}
        </div>
      )}

      {/* dialogs */}
      {dialog && dialog.kind !== 'move-doc' && (
        <Modal onClose={() => setDialog(null)}>
          <h3>{dialog.kind === 'new-folder' ? 'New folder' : 'Rename'}</h3>
          <input autoFocus className="bp-field"
            value={dialogText} onChange={e => setDialogText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitDialog() }}
            placeholder={dialog.kind === 'new-folder' ? 'Folder name' : ''}
          />
          <div className="flex justify-end gap-2.5 mt-5">
            <button className="bp-btn" onClick={() => setDialog(null)}>Cancel</button>
            <button className="bp-btn accent" onClick={submitDialog}>
              <Icon id="check" /> {dialog.kind === 'new-folder' ? 'Create' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'move-doc' && dialog.doc && (
        <Modal onClose={() => setDialog(null)}>
          <h3>Move “{dialog.doc.name}”</h3>
          <div className="max-h-64 overflow-y-auto" style={{ border: 'var(--bd)', borderRadius: 'var(--r-sm)', background: 'var(--surface)' }}>
            <button className="w-full text-left px-3.5 py-2.5 font-bold text-sm cursor-pointer bg-transparent border-none flex items-center gap-2.5 hover:bg-black/5"
              onClick={() => { moveDoc(dialog.doc!.id, null); setDialog(null) }}>
              <Icon id="back" className="w-4 h-4" /> My files (top level)
            </button>
            {folderTree(folders).map(({ folder, depth }) => (
              <button key={folder.id}
                className="w-full text-left px-3.5 py-2.5 font-bold text-sm cursor-pointer bg-transparent border-none flex items-center gap-2.5 hover:bg-black/5"
                style={{ paddingLeft: 14 + depth * 20, borderTop: '2px solid var(--paper-2)' }}
                onClick={() => { moveDoc(dialog.doc!.id, folder.id); setDialog(null) }}>
                <Icon id="folder" className="w-4 h-4" /> {folder.name}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-5">
            <button className="bp-btn" onClick={() => setDialog(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="bp-overlay" onClick={onClose}>
      <div className="bp-modal w-full max-w-sm" onClick={e => e.stopPropagation()}>
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
