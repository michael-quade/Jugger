import { useState } from 'react'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useTournamentStore } from '../store/useTournamentStore'
import { hashPassword, validatePassword } from '../utils/auth'

export default function ForcePasswordChange() {
  const { currentAdmin, clearMustChangePassword, logout } = useAuthStore()
  const { updateAdmin } = useTournamentStore()

  const [pw,      setPw]      = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validatePassword(pw)
    if (validationError) { setError(validationError); return }
    if (pw !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    const hash = await hashPassword(pw)
    updateAdmin(currentAdmin!, {
      passwordHash: hash,
      isDefaultPassword: false,
      mustChangePassword: false,
    })
    clearMustChangePassword()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-masters-green" />
            <h2 className="font-serif font-bold text-lg text-masters-dark">Set Your Password</h2>
          </div>
          <p className="text-sm text-gray-500">
            You're using a default password. Create a new password to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                className="input w-full pr-9"
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setError(null) }}
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Min 8 characters, 1 number, 1 special character</p>
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input
              className="input w-full"
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null) }}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving || !pw || !confirm}
            >
              {saving ? 'Saving…' : 'Set Password'}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={logout}
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
