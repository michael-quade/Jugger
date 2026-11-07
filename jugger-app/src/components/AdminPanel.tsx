import { useState, useEffect, useCallback } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import {
  X, Plus, Trash2, Shield, ClipboardList,
  Users, Mail, Send, RefreshCw, ClipboardCheck, ClipboardX, Wallet,
} from 'lucide-react'
import ComposeEmailModal from './ComposeEmailModal'

interface Props {
  onClose: () => void
}

interface Profile {
  id: string
  email: string
  username: string
  display_name: string | null
  role: 'admin' | 'scorer' | 'player' | 'treasurer'
  can_score: boolean
  can_treasure: boolean
  player_id: string | null
  is_sub_account: boolean
  created_at: string
}

export default function AdminPanel({ onClose }: Props) {
  const { teams, updatePlayer } = useTournamentStore()
  const { currentAdmin } = useAuthStore()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Add-account forms
  const [newEmail,  setNewEmail]  = useState('')
  const [newName,   setNewName]   = useState('')
  const [addingAccount, setAddingAccount] = useState(false)
  const [addError, setAddError] = useState('')
  const [addNotice, setAddNotice] = useState('')
  const [addSection, setAddSection] = useState<'player' | 'admin' | 'scorer' | null>(null)

  // Per-row working state
  const [working, setWorking] = useState<Record<string, string>>({})  // profileId → action string

  const [showCompose,  setShowCompose]  = useState(false)
  const [editEmailFor, setEditEmailFor] = useState<string | null>(null)
  const [editEmailVal, setEditEmailVal] = useState('')

  const allPlayers = teams.flatMap(t => t.players)

  const loadProfiles = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at')
    setLoading(false)
    if (err) { setError(err.message); return }
    setProfiles((data ?? []) as Profile[])
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const playerAccounts = profiles.filter(p => p.role === 'player')
  const adminAccounts  = profiles.filter(p => p.role === 'admin')
  const scorerAccounts = profiles.filter(p => p.role === 'scorer')

  async function callEdge(body: Record<string, unknown>): Promise<{ error?: string }> {
    if (!supabase) return { error: 'Not connected' }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Not authenticated' }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return json
  }

  async function handleInvite(role: 'player' | 'admin' | 'scorer') {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAddingAccount(true); setAddError('')
    const result = await callEdge({ action: 'invite', email, displayName: newName.trim() || undefined, role })
    setAddingAccount(false)
    if (result.error) { setAddError(result.error); return }
    setAddNotice(`Added ${email}. They sign in at juggerknockerinvitational.com with that email and a 6-digit code.`)
    setNewEmail(''); setNewName(''); setAddSection(null)
    await loadProfiles()
  }

  async function handleDelete(profile: Profile) {
    if (!confirm(`Delete account for ${profile.display_name || profile.email}? This cannot be undone.`)) return
    setWorking(w => ({ ...w, [profile.id]: 'delete' }))
    const result = await callEdge({ action: 'delete', userId: profile.id })
    if (result.error) { alert(result.error) }
    setWorking(w => { const n = { ...w }; delete n[profile.id]; return n })
    await loadProfiles()
  }

  async function toggleScorer(profile: Profile) {
    if (!supabase) return
    const newVal = !profile.can_score
    setWorking(w => ({ ...w, [profile.id]: 'scorer' }))
    await supabase.from('profiles').update({ can_score: newVal }).eq('id', profile.id)
    setWorking(w => { const n = { ...w }; delete n[profile.id]; return n })
    setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, can_score: newVal } : p))
  }

  async function toggleTreasurer(profile: Profile) {
    if (!supabase) return
    const newVal = !profile.can_treasure
    setWorking(w => ({ ...w, [profile.id]: 'treasurer' }))
    await supabase.from('profiles').update({ can_treasure: newVal }).eq('id', profile.id)
    setWorking(w => { const n = { ...w }; delete n[profile.id]; return n })
    setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, can_treasure: newVal } : p))
  }

  function handleSaveEmail(profile: Profile) {
    const pid = profile.player_id
    if (!pid) return
    const team = teams.find(t => t.players.some(p => p.id === pid))
    if (!team) return
    updatePlayer(team.id, pid, { playerEmail: editEmailVal.trim() || undefined })
    setEditEmailFor(null)
  }

  function PlayerRow({ profile }: { profile: Profile }) {
    const busy = !!working[profile.id]
    const linkedPlayer = allPlayers.find(p => p.id === profile.player_id)
    const playerEmail = linkedPlayer?.playerEmail

    return (
      <div className="border-b last:border-0 pb-2 last:pb-0 pt-2">
        {/* Row 1: identity */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="text-sm font-semibold text-masters-dark">{profile.display_name || profile.username}</span>
          <span className="text-xs text-gray-400">{profile.email}</span>
          {profile.is_sub_account && (
            <span className="badge bg-amber-100 text-amber-700 text-[10px]">SUB</span>
          )}
        </div>
        {/* Row 2: actions */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => toggleScorer(profile)}
            disabled={busy}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
              profile.can_score
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {profile.can_score ? <ClipboardCheck size={11} /> : <ClipboardX size={11} />}
            Scorer
          </button>
          <button
            onClick={() => toggleTreasurer(profile)}
            disabled={busy}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
              profile.can_treasure
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Wallet size={11} />
            Treasurer
          </button>
          {/* Email edit for group compose */}
          {profile.player_id && (
            editEmailFor === profile.id ? (
              <div className="flex items-center gap-1">
                <input
                  className="input text-xs py-0.5 w-40"
                  placeholder="player@email.com"
                  value={editEmailVal}
                  onChange={e => setEditEmailVal(e.target.value)}
                  autoFocus
                />
                <button onClick={() => handleSaveEmail(profile)} className="btn-primary text-xs py-0.5 px-2">Save</button>
                <button onClick={() => setEditEmailFor(null)} className="btn-ghost text-xs py-0.5 px-1">×</button>
              </div>
            ) : (
              <button
                onClick={() => { setEditEmailFor(profile.id); setEditEmailVal(playerEmail ?? '') }}
                title="Set email for group compose"
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Mail size={11} />
                {playerEmail ? 'Edit email' : 'Set email'}
              </button>
            )
          )}
          <button
            onClick={() => handleDelete(profile)}
            disabled={busy}
            title="Delete account"
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 size={11} />
            {working[profile.id] === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  function AdminRow({ profile }: { profile: Profile }) {
    const busy = !!working[profile.id]
    const isSelf = profile.display_name === currentAdmin || profile.username === currentAdmin

    return (
      <div className="flex items-center gap-2 py-2 border-b last:border-0">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-masters-dark">{profile.display_name || profile.username}</span>
          <span className="text-xs text-gray-400 ml-2 truncate">{profile.email}</span>
        </div>
        {!isSelf && (
          <button
            onClick={() => handleDelete(profile)}
            disabled={busy}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={11} />
            {working[profile.id] === 'delete' ? '…' : 'Delete'}
          </button>
        )}
      </div>
    )
  }

  function AddForm({ role, label }: { role: 'player' | 'admin' | 'scorer'; label: string }) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-2">Add {label}</p>
        <div className="space-y-2">
          <div>
            <label className="label">Email</label>
            <input
              className="input w-full text-sm"
              type="email"
              placeholder="golfer@email.com"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setAddError('') }}
            />
          </div>
          <div>
            <label className="label">Display Name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              className="input w-full text-sm"
              placeholder="First Last"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          {addError && <p className="text-red-500 text-xs">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleInvite(role)}
              disabled={addingAccount || !newEmail.trim()}
              className="btn-primary text-sm flex items-center gap-1 flex-1"
            >
              <Send size={12} />
              {addingAccount ? 'Adding…' : 'Add Account'}
            </button>
            <button onClick={() => { setAddSection(null); setAddError('') }} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    {showCompose && <ComposeEmailModal teams={teams} onClose={() => setShowCompose(false)} />}
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-masters-green" />
            <h2 className="font-semibold text-masters-dark">Manage Accounts</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1 text-xs text-masters-green hover:text-masters-dark transition-colors"
            >
              <Mail size={13} />
              <span className="hidden sm:inline">Group Email</span>
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
          {addNotice && <p className="text-green-700 text-sm bg-green-50 p-2 rounded">{addNotice}</p>}
          {loading && <p className="text-gray-400 text-sm text-center py-4">Loading accounts…</p>}

          {/* ── Players ─────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-masters-green" />
              <h3 className="section-header text-sm">Players</h3>
              <span className="text-xs text-gray-400 ml-auto">{playerAccounts.length} accounts</span>
            </div>
            {playerAccounts.length === 0 && !loading && (
              <p className="text-gray-400 text-xs py-2">No player accounts yet.</p>
            )}
            {playerAccounts.map(p => <div key={p.id}>{PlayerRow({ profile: p })}</div>)}
            {addSection === 'player'
              ? AddForm({ role: 'player', label: 'Player' })
              : (
                <button
                  onClick={() => { setAddSection('player'); setAddNotice('') }}
                  className="mt-2 flex items-center gap-1 text-xs text-masters-green hover:text-masters-dark transition-colors"
                >
                  <Plus size={13} /> Add Player Account
                </button>
              )
            }
          </section>

          {/* ── Admins ──────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-masters-green" />
              <h3 className="section-header text-sm">Admins</h3>
            </div>
            {adminAccounts.length === 0 && !loading && (
              <p className="text-gray-400 text-xs py-2">No admin accounts.</p>
            )}
            {adminAccounts.map(p => <div key={p.id}>{AdminRow({ profile: p })}</div>)}
            {addSection === 'admin'
              ? AddForm({ role: 'admin', label: 'Admin' })
              : (
                <button
                  onClick={() => { setAddSection('admin'); setAddNotice('') }}
                  className="mt-2 flex items-center gap-1 text-xs text-masters-green hover:text-masters-dark transition-colors"
                >
                  <Plus size={13} /> Add Admin Account
                </button>
              )
            }
          </section>

          {/* ── Scorers ─────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={14} className="text-masters-green" />
              <h3 className="section-header text-sm">Scorers</h3>
            </div>
            {scorerAccounts.length === 0 && !loading && (
              <p className="text-gray-400 text-xs py-2">No scorer accounts.</p>
            )}
            {scorerAccounts.map(p => <div key={p.id}>{AdminRow({ profile: p })}</div>)}
            {addSection === 'scorer'
              ? AddForm({ role: 'scorer', label: 'Scorer' })
              : (
                <button
                  onClick={() => { setAddSection('scorer'); setAddNotice('') }}
                  className="mt-2 flex items-center gap-1 text-xs text-masters-green hover:text-masters-dark transition-colors"
                >
                  <Plus size={13} /> Add Scorer Account
                </button>
              )
            }
          </section>
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-between items-center">
          <button
            onClick={loadProfiles}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button onClick={onClose} className="btn-secondary text-sm">Done</button>
        </div>
      </div>
    </div>
    </>
  )
}
