import { useState } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = mode === 'login'
        ? await api.login(username, password)
        : await api.register(username, password)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold text-slate-800 mb-1">PDF Editor</h1>
      <p className="text-slate-500 mb-8">Sign in to access your documents</p>

      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Username</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
            value={username} onChange={e => setUsername(e.target.value)}
            autoFocus autoComplete="username" required minLength={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
            value={password} onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          {mode === 'login' ? (
            <>No account?{' '}
              <button type="button" className="text-blue-600 hover:underline"
                onClick={() => { setMode('register'); setError(null) }}>
                Create one
              </button>
            </>
          ) : (
            <>Have an account?{' '}
              <button type="button" className="text-blue-600 hover:underline"
                onClick={() => { setMode('login'); setError(null) }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
