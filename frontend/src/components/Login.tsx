import { useState } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { Icon } from './icons'

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

  const switchMode = (m: 'login' | 'register') => { setMode(m); setError(null) }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr]" style={{ background: 'var(--paper)' }}>
      {/* pitch panel */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden px-13 py-14"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
        <div className="absolute rounded-full opacity-90"
          style={{ right: -90, bottom: -90, width: 320, height: 320, background: 'var(--accent)' }} />
        <div className="absolute"
          style={{ left: 44, top: 220, width: 120, height: 120, background: 'var(--pop)', border: '3px solid var(--paper)', transform: 'rotate(-9deg)' }} />

        <div className="relative z-10 grid place-items-center"
          style={{ width: 56, height: 56, borderRadius: 13, background: 'var(--pop)', border: '2px solid var(--paper)', color: 'var(--ink)' }}>
          <Icon id="doc" className="w-[30px] h-[30px]" />
        </div>

        <div className="relative z-10">
          <h2 className="f-disp font-bold m-0 mb-4" style={{ fontSize: 46, lineHeight: .98, letterSpacing: '-.02em', maxWidth: '12ch' }}>
            Edit any PDF. No fuss.
          </h2>
          <p className="m-0" style={{ fontSize: 17, lineHeight: 1.55, color: 'rgba(242,238,227,.72)', maxWidth: '34ch' }}>
            Sign, fill, merge, and tidy your documents — with controls big enough to actually see.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3.5">
          {['Type directly onto the page', 'Drop in a signature in seconds', 'Every version saved, nothing lost'].map(t => (
            <div key={t} className="flex items-center gap-3 font-semibold" style={{ fontSize: 16 }}>
              <span className="grid place-items-center shrink-0"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--paper)', color: 'var(--ink)' }}>
                <Icon id="check" className="w-[18px] h-[18px]" />
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* form side */}
      <div className="flex flex-col justify-center px-8 sm:px-13 py-14 max-w-xl w-full mx-auto">
        <div className="inline-flex self-start overflow-hidden mb-7"
          style={{ border: 'var(--bd)', borderRadius: 9, boxShadow: 'var(--sh-sm)' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} type="button"
              className="font-bold cursor-pointer"
              style={{
                fontSize: 15, padding: '10px 22px', border: 'none',
                background: mode === m ? 'var(--ink)' : 'var(--surface)',
                color: mode === m ? 'var(--paper)' : 'var(--ink-soft)',
              }}
              onClick={() => switchMode(m)}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h3 className="f-disp font-bold m-0 mb-1.5" style={{ fontSize: 30, letterSpacing: '-.01em' }}>
          {mode === 'login' ? 'Welcome back' : 'Get started'}
        </h3>
        <p className="m-0 mb-7" style={{ color: 'var(--ink-soft)', fontSize: 16 }}>
          {mode === 'login' ? 'Sign in to get to your documents.' : 'Pick a username and password — that’s it.'}
        </p>

        <form onSubmit={submit}>
          <div className="mb-4.5">
            <label className="bp-label">Username</label>
            <div className="bp-field-wrap">
              <Icon id="user" />
              <input className="bp-field" type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus autoComplete="username" required minLength={3} />
            </div>
          </div>
          <div className="mb-4.5">
            <label className="bp-label">Password</label>
            <div className="bp-field-wrap">
              <Icon id="lock" />
              <input className="bp-field" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} />
            </div>
          </div>

          {error && (
            <div className="mb-4 font-bold text-sm px-3.5 py-2.5"
              style={{ background: '#fff', border: '2px solid var(--danger)', borderRadius: 'var(--r-sm)', color: 'var(--danger)', boxShadow: '3px 3px 0 var(--danger)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="bp-btn accent lg w-full justify-center mt-2">
            <Icon id="signout" />
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center mt-4.5" style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
          {mode === 'login' ? (
            <>No account yet?{' '}
              <button type="button" className="font-bold cursor-pointer bg-transparent border-none p-0"
                style={{ color: 'var(--accent)' }} onClick={() => switchMode('register')}>Create one</button>
            </>
          ) : (
            <>Have an account?{' '}
              <button type="button" className="font-bold cursor-pointer bg-transparent border-none p-0"
                style={{ color: 'var(--accent)' }} onClick={() => switchMode('login')}>Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
