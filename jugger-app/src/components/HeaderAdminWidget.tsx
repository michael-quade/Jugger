import { useState, useRef, useEffect } from 'react'
import { Shield, LogOut, Eye, EyeOff, Settings } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import AdminPanel from './AdminPanel'

export default function HeaderAdminWidget() {
  const { currentAdmin, loggingIn, loginError, login, logout, clearError } = useAuthStore()
  const [open,      setOpen]      = useState(false)
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await login(username, password)
    if (ok) { setOpen(false); setUsername(''); setPassword('') }
  }

  if (currentAdmin) {
    return (
      <>
        {showPanel && <AdminPanel onClose={() => setShowPanel(false)} />}
        <div className="ml-auto flex items-center gap-3">
          <Shield size={14} className="text-masters-gold shrink-0" />
          <span className="text-white text-sm font-semibold hidden sm:inline">{currentAdmin}</span>
          <button
            className="hidden sm:flex items-center gap-1 text-xs text-white/70 hover:text-masters-gold transition-colors"
            onClick={() => setShowPanel(true)}
          >
            <Settings size={12} />
            Manage
          </button>
          <button
            className="flex items-center gap-1 text-xs text-white/70 hover:text-red-400 transition-colors"
            onClick={logout}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div ref={ref} className="ml-auto relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors ${
          open
            ? 'bg-masters-gold text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        <Shield size={14} />
        <span className="hidden sm:inline">Admin</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72 z-50 text-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={15} className="text-masters-green" />
            <h3 className="font-semibold text-sm text-masters-dark">Admin Login</h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="label">Username</label>
              <input
                className="input w-full"
                value={username}
                onChange={e => { setUsername(e.target.value); clearError() }}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input w-full pr-8"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError() }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
            <button
              type="submit"
              className="btn-primary w-full text-sm"
              disabled={loggingIn || !username || !password}
            >
              {loggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
