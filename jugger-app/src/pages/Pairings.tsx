import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { generateAllPairings, getMatchesForRound, getPlayerName } from '../utils/pairings'
import { Shuffle, Edit2, Check, X, Lock, Unlock, ClipboardList } from 'lucide-react'
import type { Match, Team } from '../types'

const FORMAT_LABELS: Record<string, string> = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice: "Captain's Choice",
}

export default function Pairings() {
  const { teams, matches, roundConfigs, courses, pairingsLocked, setMatches, updateMatch, setPairingsLocked } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [editMatch, setEditMatch] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Match | null>(null)

  function handleGenerate() {
    if (!isAdmin) return
    if (matches.length > 0 && !confirm('This will replace existing pairings. Proceed?')) return
    setMatches(generateAllPairings(teams, roundConfigs))
  }

  function startEdit(match: Match) {
    if (!isAdmin || pairingsLocked) return
    setEditMatch(match.id)
    setEditDraft({ ...match })
  }

  function saveEdit() {
    if (!editDraft) return
    updateMatch(editDraft.id, editDraft)
    setEditMatch(null)
    setEditDraft(null)
  }

  if (!isAdmin) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <Lock size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold">Pairings are managed by the administrator.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Match Pairings</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {matches.length > 0 && (
              <button
                className={`flex items-center gap-1 ${pairingsLocked ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => setPairingsLocked(!pairingsLocked)}
              >
                {pairingsLocked ? <Lock size={14} /> : <Unlock size={14} />}
                {pairingsLocked ? 'Pairings Locked' : 'Lock Pairings'}
              </button>
            )}
            {!pairingsLocked && (
              <button className="btn-primary flex items-center gap-2" onClick={handleGenerate}>
                <Shuffle size={16} />
                {matches.length === 0 ? 'Generate Pairings' : 'Re-generate Pairings'}
              </button>
            )}
          </div>
        )}
      </div>

      {pairingsLocked && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800 flex items-center gap-2">
          <Lock size={16} />
          {isAdmin ? 'Pairings are locked. Click the lock button to unlock and edit.' : 'Pairings are locked by the administrator.'}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card text-center py-12">
          <Shuffle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-semibold">No pairings generated yet.</p>
          {isAdmin
            ? <p className="text-gray-300 text-sm mt-1">Click Generate Pairings to randomly create all matches for all rounds.</p>
            : <p className="text-gray-300 text-sm mt-1">An admin will generate pairings before the event.</p>
          }
        </div>
      ) : (
        <div className="space-y-8">
          {[1, 2, 3, 4, 5].map(round => {
            const roundMatches = getMatchesForRound(matches, round)
            if (roundMatches.length === 0) return null
            const regular = roundMatches.filter(m => !m.isBlind)
            const blind    = roundMatches.filter(m => m.isBlind)
            return (
              <div key={round}>
                <h2 className="section-header">{(() => {
                  const rc = roundConfigs.find(r => r.round === round)
                  const course = courses.find(c => c.id === rc?.courseId)
                  return `Round ${round} — ${FORMAT_LABELS[rc?.format ?? ''] ?? rc?.format ?? ''}${course ? ` (${course.name})` : ''}`
                })()}</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {regular.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Regular Matches (2 pts each)</p>
                      {regular.map(m => (
                        <MatchCard key={m.id} match={m} teams={teams} editing={editMatch === m.id} editDraft={editDraft} canEdit={isAdmin && !pairingsLocked} onEdit={() => startEdit(m)} onSave={saveEdit} onCancel={() => { setEditMatch(null); setEditDraft(null) }} onViewScorecard={() => navigate(`/scorecards?match=${m.id}&round=${m.round}`)} setEditDraft={setEditDraft} />
                      ))}
                    </div>
                  )}
                  {blind.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Blind Matches (1 pt each)</p>
                      {blind.map(m => (
                        <MatchCard key={m.id} match={m} teams={teams} editing={editMatch === m.id} editDraft={editDraft} canEdit={isAdmin && !pairingsLocked} onEdit={() => startEdit(m)} onSave={saveEdit} onCancel={() => { setEditMatch(null); setEditDraft(null) }} onViewScorecard={() => navigate(`/scorecards?match=${m.id}&round=${m.round}`)} setEditDraft={setEditDraft} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface MatchCardProps {
  match: Match
  teams: Team[]
  editing: boolean
  editDraft: Match | null
  canEdit: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onViewScorecard: () => void
  setEditDraft: (m: Match | null) => void
}

function MatchCard({ match, teams, editing, editDraft, canEdit, onEdit, onSave, onCancel, onViewScorecard, setEditDraft }: MatchCardProps) {
  const allPlayers = teams.flatMap(t => t.players)

  function getTeamColor(teamId: string) {
    return teams.find(t => t.id === teamId)?.color ?? '#666'
  }
  function getTeamName(teamId: string) {
    return teams.find(t => t.id === teamId)?.name ?? teamId
  }

  const t1 = match.twosome1
  const t2 = match.twosome2

  if (editing && editDraft) {
    const draft = editDraft
    return (
      <div className="border-2 border-masters-green rounded p-3 space-y-2 bg-masters-light">
        <p className="text-xs font-semibold text-masters-dark">Edit {match.label}</p>
        {[draft.twosome1, draft.twosome2].map((tw, ti) => (
          <div key={ti} className="space-y-1">
            <p className="text-xs text-gray-500">Side {ti + 1} — Team:
              <select
                className="ml-1 border border-gray-300 rounded text-xs px-1"
                value={tw.teamId}
                onChange={e => {
                  const updated = { ...draft }
                  if (ti === 0) updated.twosome1 = { ...tw, teamId: e.target.value }
                  else updated.twosome2 = { ...tw, teamId: e.target.value }
                  setEditDraft(updated)
                }}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </p>
            {tw.playerIds.map((pid, pi) => (
              <select
                key={pi}
                className="input text-xs"
                value={pid}
                onChange={e => {
                  const newIds = [...tw.playerIds] as [string, string]
                  newIds[pi] = e.target.value
                  const updated = { ...draft }
                  if (ti === 0) updated.twosome1 = { ...tw, playerIds: newIds }
                  else updated.twosome2 = { ...tw, playerIds: newIds }
                  setEditDraft(updated)
                }}
              >
                {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <button className="btn-primary text-xs flex items-center gap-1" onClick={onSave}><Check size={12} /> Save</button>
          <button className="btn-ghost text-xs flex items-center gap-1" onClick={onCancel}><X size={12} /> Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded p-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <TwosomeRow twosome={t1} teams={teams} />
          <div className="text-xs text-center text-masters-gold font-bold">vs</div>
          <TwosomeRow twosome={t2} teams={teams} />
        </div>
        {canEdit && (
          <button className="ml-2 mt-1" onClick={onEdit}>
            <Edit2 size={13} className="text-gray-400 hover:text-masters-green" />
          </button>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
        <button
          onClick={onViewScorecard}
          className="flex items-center gap-1 text-xs text-masters-green hover:text-masters-dark font-semibold transition-colors"
        >
          <ClipboardList size={11} /> Scorecard
        </button>
        {match.result && (
          <span className="text-xs text-gray-500 truncate">Result: {match.result}</span>
        )}
      </div>
    </div>
  )
}

function TwosomeRow({ twosome, teams }: { twosome: Match['twosome1']; teams: Team[] }) {
  const team = teams.find(t => t.id === twosome.teamId)
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ background: team?.color ?? '#ccc' }} />
      <span className="text-xs font-semibold" style={{ color: team?.color ?? '#333' }}>{team?.name}</span>
      <span className="text-xs text-gray-600">
        {twosome.playerIds.map(pid => getPlayerName(teams, pid)).join(' & ')}
      </span>
    </div>
  )
}
