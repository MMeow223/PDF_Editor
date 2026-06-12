import { useEffect, useState } from 'react'
import { api } from './api/client'
import type { User } from './api/types'
import { FileManager } from './components/FileManager'
import { Login } from './components/Login'
import { EditorLayout } from './components/editor/EditorLayout'
import { useEditorStore } from './store/editorStore'

export default function App() {
  const docId = useEditorStore(s => s.docId)
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null))
  }, [])

  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />
  if (docId) return <EditorLayout />

  const logout = async () => {
    await api.logout()
    setUser(null)
  }

  return <FileManager user={user} onLogout={logout} />
}
