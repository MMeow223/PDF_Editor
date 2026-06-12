import { useEffect, useState } from 'react'
import { api } from './api/client'
import type { User } from './api/types'
import { FileManager } from './components/FileManager'
import { Login } from './components/Login'
import { EditorLayout } from './components/editor/EditorLayout'
import { IconSprite } from './components/icons'
import { useEditorStore } from './store/editorStore'

export default function App() {
  const docId = useEditorStore(s => s.docId)
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null))
  }, [])

  if (user === undefined) return null

  const logout = async () => {
    await api.logout()
    setUser(null)
  }

  return (
    <>
      <IconSprite />
      {!user ? (
        <Login onLogin={setUser} />
      ) : docId ? (
        <EditorLayout />
      ) : (
        <FileManager user={user} onLogout={logout} />
      )}
    </>
  )
}
