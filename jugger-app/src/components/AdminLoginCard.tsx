import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { Shield, LogOut, Eye, EyeOff } from 'lucide-react'

interface Props {
  onManageAdmins?: () => void
}

export default function AdminLoginCard({ onManageAdmins }: Props) {
  const { currentAdmin, loggingIn, loginError, login, logout, clearError } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await login(username, password)
    setPassword('')
  }

  if (currentAdmin) {
    return (
      <div className="card border border-masters-green/30 bg-masters-light">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-masters-dark">
            <Shield size={16} className="text-masters-green" />
            <span className="font-semibold text-sm">Admin: {currentAdmin}</span>
          </div>
          <div className="flex items-center gap-2">
            {onManageAdmins && (
              <button className="btn-ghost text-xs" onClick={onManageAdmins}>
                Manage Admins
              </button>
            )}
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
              onClick={logout}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-masters-green" />
        <h3 className="font-semibold text-sm text-masters-dark">Admin Login</h3>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Username</label>
          <input
            className="input w-32"
            value={username}
            onChange={e => { setUsername(e.target.value); clearError() }}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              className="input w-36 pr-8"
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
        <button
          type="submit"
          className="btn-primary text-sm"
          disabled={loggingIn || !username || !password}
        >
          {loggingIn ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {loginError && (
        <p className="text-red-500 text-xs mt-2">{loginError}</p>
      )}
    </div>
  )
}
