import { useState } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useAuthStore } from '../store/useAuthStore'
import { hashPassword, DEFAULT_PASSWORD } from '../utils/auth'
import {
  X, Plus, Trash2, KeyRound, Eye, EyeOff, Shield, ClipboardList,
  Users, RotateCcw, ClipboardCheck, ClipboardX, Wallet,
} from 'lucide-react'
import type { AdminCredential } from '../types'

interface Props {
  onClose: () => void
}

export default function AdminPanel({ onClose }: Props) {
  const { admins, addAdmin, removeAdmin, updateAdmin, promotePlayerToScorer, demotePlayerFromScorer, promotePlayerToTreasurer, demotePlayerFromTreasurer, resetPlayerPassword } = useTournamentStore()
  const { currentAdmin } = useAuthStore()

  const adminAccounts  = admins.filter(a => !a.role || a.role === 'admin')
  const scorerAccounts = admins.filter(a => a.role === 'scorer')
  const playerAccounts = admins.filter(a => a.role === 'player')

  // Shared change-password state (only one row open at a time)
  const [changePwFor, setChangePwFor] = useState<string | null>(null)
  const [changePwVal, setChangePwVal] = useState('')
  const [showChangePw, setShowChangePw] = useState(false)
  const [saving, setSaving] = useState(false)

  // Admin add form
  const [newAdminUser, setNewAdminUser] = useState('')
  const [newAdminPw,   setNewAdminPw]   = useState('')
  const [showAdminPw,  setShowAdminPw]  = useState(false)
  const [addingAdmin,  setAddingAdmin]  = useState(false)

  // Scorer add form
  const [newScorerUser, setNewScorerUser] = useState('')
  const [newScorerPw,   setNewScorerPw]   = useState('')
  const [showScorerPw,  setShowScorerPw]  = useState(false)
  const [addingScorer,  setAddingScorer]  = useState(false)

  const [resettingPw, setResettingPw] = useState<string | null>(null)

  async function handleAdd(username: string, password: string, role: AdminCredential['role'],
    setAdding: (v: boolean) => void, resetForm: () => void) {
    if (!username.trim() || !password) return
    if (admins.some(a => a.username.toLowerCase() === username.trim().toLowerCase())) return
    setAdding(true)
    const hash = await hashPassword(password)
    addAdmin({ username: username.trim(), passwordHash: hash, role })
    resetForm()
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

  async function handleResetPlayerPassword(username: string) {
    setResettingPw(username)
    const hash = await hashPassword(DEFAULT_PASSWORD)
    resetPlayerPassword(username, hash)
    setResettingPw(null)
  }

  function openChangePw(username: string) {
    setChangePwFor(username)
    setChangePwVal('')
    setShowChangePw(false)
  }

  function CredentialRow({ cred }: { cred: AdminCredential }) {
    return (
      <div className="flex items-center gap-2 py-2 border-b last:border-0">
        <span className="flex-1 text-sm font-medium text-masters-dark">{cred.username}</span>
        {changePwFor === cred.username ? (
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
              onClick={() => handleChangePassword(cred.username)}
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
              onClick={() => openChangePw(cred.username)}
            >
              <KeyRound size={12} /> Change PW
            </button>
            <button
              className="text-red-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-30"
              title="Remove account"
              disabled={cred.username === currentAdmin}
              onClick={() => removeAdmin(cred.username)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  function PlayerRow({ cred }: { cred: AdminCredential }) {
    return (
      <div className="flex items-center gap-2 py-2 border-b last:border-0">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-masters-dark">
            {cred.displayName ?? cred.username}
          </span>
          {cred.isSubAccount && (
            <span className="ml-1.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded px-1.5 py-0.5">
              SUB
            </span>
          )}
          <span className="text-xs text-gray-400 ml-1.5">({cred.username})</span>
          {cred.isDefaultPassword && (
            <span className="ml-1.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
              Default PW: {DEFAULT_PASSWORD}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {cred.canScore ? (
            <button
              className="flex items-center gap-1 text-xs text-masters-green hover:text-red-500 transition-colors"
              title="Revoke scorer rights"
              onClick={() => demotePlayerFromScorer(cred.username)}
            >
              <ClipboardX size={13} />
              <span className="hidden sm:inline">Revoke Scorer</span>
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-masters-green transition-colors"
              title="Grant scorer rights"
              onClick={() => promotePlayerToScorer(cred.username)}
            >
              <ClipboardCheck size={13} />
              <span className="hidden sm:inline">Grant Scorer</span>
            </button>
          )}
          {cred.canTreasure ? (
            <button
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-red-500 transition-colors ml-1"
              title="Revoke treasurer rights"
              onClick={() => demotePlayerFromTreasurer(cred.username)}
            >
              <Wallet size={13} />
              <span className="hidden sm:inline">Revoke Treasurer</span>
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors ml-1"
              title="Grant treasurer rights — can mark CTP and HIO payments as paid"
              onClick={() => promotePlayerToTreasurer(cred.username)}
            >
              <Wallet size={13} />
              <span className="hidden sm:inline">Grant Treasurer</span>
            </button>
          )}
          <button
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-masters-dark transition-colors ml-1"
            title="Reset to default password"
            disabled={resettingPw === cred.username}
            onClick={() => handleResetPlayerPassword(cred.username)}
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset PW</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-serif font-bold text-lg text-masters-dark">Manage Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Players section */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-blue-500" />
              <h3 className="text-sm font-bold text-masters-dark uppercase tracking-wide">Players</h3>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Auto-created from roster. Subs labeled <span className="font-bold text-amber-700">SUB</span> — grant scorer rights individually. Default password shown until changed.
            </p>
            <div className="space-y-0">
              {playerAccounts.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No player accounts yet.</p>
              )}
              {playerAccounts.map(a => <PlayerRow key={a.username} cred={a} />)}
            </div>
          </div>

          {/* Admins section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-masters-green" />
              <h3 className="text-sm font-bold text-masters-dark uppercase tracking-wide">Admins</h3>
            </div>
            <div className="space-y-0">
              {adminAccounts.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No admins configured.</p>
              )}
              {adminAccounts.map(a => <CredentialRow key={a.username} cred={a} />)}
            </div>
            <form
              className="space-y-2 pt-3 mt-2 border-t"
              onSubmit={e => { e.preventDefault(); handleAdd(newAdminUser, newAdminPw, 'admin', setAddingAdmin, () => { setNewAdminUser(''); setNewAdminPw('') }) }}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Admin</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  className="input flex-1 min-w-28"
                  placeholder="Username"
                  value={newAdminUser}
                  onChange={e => setNewAdminUser(e.target.value)}
                />
                <div className="relative">
                  <input
                    className="input w-36 pr-7"
                    type={showAdminPw ? 'text' : 'password'}
                    placeholder="Password"
                    value={newAdminPw}
                    onChange={e => setNewAdminPw(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowAdminPw(v => !v)}
                    tabIndex={-1}
                  >
                    {showAdminPw ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1"
                  disabled={addingAdmin || !newAdminUser.trim() || !newAdminPw}
                >
                  <Plus size={14} />
                  {addingAdmin ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>

          {/* Scorers section */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={14} className="text-masters-gold" />
              <h3 className="text-sm font-bold text-masters-dark uppercase tracking-wide">Scorers</h3>
            </div>
            <p className="text-xs text-gray-400 mb-2">Standalone scorer accounts (non-player volunteers).</p>
            <div className="space-y-0">
              {scorerAccounts.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No scorer accounts yet.</p>
              )}
              {scorerAccounts.map(a => <CredentialRow key={a.username} cred={a} />)}
            </div>
            <form
              className="space-y-2 pt-3 mt-2 border-t"
              onSubmit={e => { e.preventDefault(); handleAdd(newScorerUser, newScorerPw, 'scorer', setAddingScorer, () => { setNewScorerUser(''); setNewScorerPw('') }) }}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Scorer</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  className="input flex-1 min-w-28"
                  placeholder="Username"
                  value={newScorerUser}
                  onChange={e => setNewScorerUser(e.target.value)}
                />
                <div className="relative">
                  <input
                    className="input w-36 pr-7"
                    type={showScorerPw ? 'text' : 'password'}
                    placeholder="Password"
                    value={newScorerPw}
                    onChange={e => setNewScorerPw(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowScorerPw(v => !v)}
                    tabIndex={-1}
                  >
                    {showScorerPw ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1"
                  disabled={addingScorer || !newScorerUser.trim() || !newScorerPw}
                >
                  <Plus size={14} />
                  {addingScorer ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
