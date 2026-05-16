import { useState } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useAuthStore } from '../store/useAuthStore'
import { hashPassword } from '../utils/auth'
import { X, Plus, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function AdminPanel({ onClose }: Props) {
  const { admins, addAdmin, removeAdmin, updateAdmin } = useTournamentStore()
  const { currentAdmin } = useAuthStore()

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [adding, setAdding] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  const [changePwFor, setChangePwFor] = useState<string | null>(null)
  const [changePwVal, setChangePwVal] = useState('')
  const [showChangePw, setShowChangePw] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword) return
    const alreadyExists = admins.some(a => a.username.toLowerCase() === newUsername.trim().toLowerCase())
    if (alreadyExists) return
    setAdding(true)
    const hash = await hashPassword(newPassword)
    addAdmin({ username: newUsername.trim(), passwordHash: hash })
    setNewUsername('')
    setNewPassword('')
    setAdding(false)
  }

  async function handleChangePassword(username: string) {
    if (!changePwVal) return
    setSaving(true)
    const hash = await hashPassword(changePwVal)
    updateAdmin(username, { passwordHash: hash })
    setChangePwFor(null)
    setChangePwVal('')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-serif font-bold text-lg text-masters-dark">Manage Admins</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current admins list */}
          <div className="space-y-2">
            {admins.length === 0 && (
              <p className="text-sm text-gray-400">No admins configured.</p>
            )}
            {admins.map(a => (
              <div key={a.username} className="flex items-center gap-2 py-2 border-b last:border-0">
                <span className="flex-1 text-sm font-medium text-masters-dark">{a.username}</span>
                {changePwFor === a.username ? (
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <input
                        className="input w-32 pr-7 text-xs"
                        type={showChangePw ? 'text' : 'password'}
                        placeholder="New password"
                        value={changePwVal}
                        onChange={e => setChangePwVal(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400"
                        onClick={() => setShowChangePw(v => !v)}
                        tabIndex={-1}
                      >
                        {showChangePw ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                    <button
                      className="btn-primary text-xs py-1"
                      disabled={!changePwVal || saving}
                      onClick={() => handleChangePassword(a.username)}
                    >
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="btn-ghost text-xs py-1" onClick={() => setChangePwFor(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-ghost text-xs flex items-center gap-1"
                      onClick={() => { setChangePwFor(a.username); setChangePwVal(''); setShowChangePw(false) }}
                    >
                      <KeyRound size={12} /> Change PW
                    </button>
                    <button
                      className="text-red-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-30"
                      title="Remove admin"
                      disabled={a.username === currentAdmin}
                      onClick={() => removeAdmin(a.username)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new admin */}
          <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Admin</p>
            <div className="flex gap-2 flex-wrap">
              <input
                className="input flex-1 min-w-28"
                placeholder="Username"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
              <div className="relative">
                <input
                  className="input w-36 pr-7"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowNewPw(v => !v)}
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <button
                type="submit"
                className="btn-primary flex items-center gap-1"
                disabled={adding || !newUsername.trim() || !newPassword}
              >
                <Plus size={14} />
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
