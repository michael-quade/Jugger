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
  const { admins, addAdmin, removeAdmin, updateAdmin, promotePlayerToScorer, demotePlayerFromScorer, promotePlayerToTreasurer, demotePlayerFromTreasurer, resetPlayerPassword, teams, updatePlayer } = useTournamentStore()
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
  const [editEmailFor, setEditEmailFor] = useState<string | null>(null)
  const [editEmailVal, setEditEmailVal] = useState('')

  const allPlayers = teams.flatMap(t => t.players)

  function handleSaveEmail(cred: AdminCredential) {
    const pid = cred.playerId ?? (cred.subForPlayerId)
    if (!pid) return
    const team = teams.find(t => t.players.some(p => p.id === pid))
    if (!team) return
    updatePlayer(team.id, pid, { playerEmail: editEmailVal.trim() || undefined })
    setEditEmailFor(null)
  }

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
      <div className="py-2.5 border-b last:border-0 space-y-1.5">
        {/* Row 1: name + username + badges — wraps cleanly, no collision with buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-masters-dark leading-tight">
            {cred.displayName ?? cred.username}
          </span>
          <span className="text-xs text-gray-400">({cred.username})</span>
          {cred.isSubAccount && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded px-1.5 py-0.5 leading-none">
              SUB
            </span>
          )}
          {cred.isDefaultPassword && (
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 leading-none">
              PW: {DEFAULT_PASSWORD}
            </span>
          )}
        </div>
        {/* Row 2: action buttons — consistent pill style, state shown by color + icon */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
              cred.canScore
                ? 'text-masters-green border-masters-green/40 bg-green-50 hover:text-red-500 hover:border-red-300 hover:bg-red-50'
                : 'text-gray-400 border-gray-200 hover:text-masters-green hover:border-masters-green/40'
            }`}
            title={cred.canScore ? 'Revoke scorer rights' : 'Grant scorer rights'}
            onClick={() => cred.canScore ? demotePlayerFromScorer(cred.username) : promotePlayerToScorer(cred.username)}
          >
            {cred.canScore ? <ClipboardX size={11} /> : <ClipboardCheck size={11} />}
            Scorer{cred.canScore ? ' ✓' : ''}
          </button>
          <button
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
              cred.canTreasure
                ? 'text-amber-600 border-amber-300 bg-amber-50 hover:text-red-500 hover:border-red-300 hover:bg-red-50'
                : 'text-gray-400 border-gray-200 hover:text-amber-600 hover:border-amber-300'
            }`}
            title={cred.canTreasure ? 'Revoke treasurer rights' : 'Grant treasurer rights — can mark CTP and HIO payments as paid'}
            onClick={() => cred.canTreasure ? demotePlayerFromTreasurer(cred.username) : promotePlayerToTreasurer(cred.username)}
          >
            <Wallet size={11} />
            Treasurer{cred.canTreasure ? ' ✓' : ''}
          </button>
          <button
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-masters-dark hover:border-gray-400 transition-colors ml-auto"
            title="Reset to default password"
            disabled={resettingPw === cred.username}
            onClick={() => handleResetPlayerPassword(cred.username)}
          >
            <RotateCcw size={11} />
            Reset PW
          </button>
        </div>
        {/* Row 3: email field */}
        {(() => {
          const pid = cred.playerId ?? cred.subForPlayerId
          const player = pid ? allPlayers.find(p => p.id === pid) : null
          const currentEmail = player?.playerEmail ?? ''
          if (editEmailFor === cred.username) {
            return (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="email"
                  className="input text-xs flex-1 py-0.5"
                  placeholder="Email address"
                  value={editEmailVal}
                  onChange={e => setEditEmailVal(e.target.value)}
                  autoFocus
                />
                <button className="btn-primary text-xs py-1" onClick={() => handleSaveEmail(cred)}>Save</button>
                <button className="btn-ghost text-xs py-1" onClick={() => setEditEmailFor(null)}>Cancel</button>
              </div>
            )
          }
          return (
            <button
              className="text-[10px] text-gray-400 hover:text-masters-green transition-colors flex items-center gap-1 mt-0.5"
              onClick={() => { setEditEmailFor(cred.username); setEditEmailVal(currentEmail) }}
            >
              {currentEmail
                ? <span className="truncate max-w-[200px]">✉ {currentEmail}</span>
                : <span>+ Add email</span>}
            </button>
          )
        })()}
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
