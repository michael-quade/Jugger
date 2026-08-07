import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useIsPlayer, useAuthStore } from '../store/useAuthStore'
import { getPlayerCourseHdcp } from '../utils/handicap'
import { computeSideBet, FORMAT_DISPLAY_NAMES } from '../utils/sideBets'
import type { SideBet } from '../types'

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  active:    { label: 'Active',    color: 'text-green-700 bg-green-50 border-green-200' },
  complete:  { label: 'Complete',  color: 'text-blue-700 bg-blue-50 border-blue-200' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 bg-gray-50 border-gray-200' },
}

function StatusBadge({ status }: { status: SideBet['status'] }) {
  const { label, color } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${color}`}>
      {status === 'active' && <Clock size={10} />}
      {status === 'complete' && <CheckCircle size={10} />}
      {status === 'cancelled' && <XCircle size={10} />}
      {label}
    </span>
  )
}

export default function SideBets() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const isPlayer = useIsPlayer()
  const currentAdmin = useAuthStore(s => s.currentAdmin)
  const { sideBets = [], teams, matches, courses, roundConfigs, admins } = useTournamentStore()

  const [tab, setTab] = useState<'active' | 'history'>('active')

  // Determine the logged-in player's roster ID
  const playerRosterId = useMemo(() => {
    if (!currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [currentAdmin, admins])

  const canAccess = isAdmin || isPlayer

  // Compute settlement summary for a bet
  function betSummary(bet: SideBet): string {
    const match = matches.find(m => m.id === bet.matchId)
    if (!match) return '—'
    const rc = roundConfigs.find(r => r.round === bet.round)
    if (!rc) return '—'
    const course = courses.find(c => c.id === rc.courseId)
    if (!course) return '—'

    const allPlayers = teams.flatMap(t => t.players)
    const hdcps: Record<string, number> = {}
    for (const p of bet.participants) {
      const player = allPlayers.find(pl => pl.id === p.playerId)
      if (player) hdcps[p.playerId] = getPlayerCourseHdcp(player, course, rc.tee, bet.round, allPlayers)
    }

    try {
      return computeSideBet(bet, match, course.holes, hdcps).summary
    } catch {
      return '—'
    }
  }

  // Filter bets based on access level
  const visibleBets = useMemo(() => {
    if (isAdmin) return sideBets
    if (isPlayer && playerRosterId) {
      return sideBets.filter(b => b.participants.some(p => p.playerId === playerRosterId))
    }
    return []
  }, [sideBets, isAdmin, isPlayer, playerRosterId])

  const activeBets   = visibleBets.filter(b => b.status === 'pending' || b.status === 'active')
  const historyBets  = visibleBets.filter(b => b.status === 'complete' || b.status === 'cancelled')

  if (!canAccess) {
    return (
      <div className="card text-center py-12">
        <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-serif font-bold text-masters-dark mb-2">Players Only</h2>
        <p className="text-gray-500">Sign in as a player or admin to view and manage side bets.</p>
      </div>
    )
  }

  const displayBets = tab === 'active' ? activeBets : historyBets

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Side Bets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'All bets across all players' : 'Your active wagers'}
          </p>
        </div>
        <button
          onClick={() => navigate('/side-bets/new')}
          className="btn-primary flex items-center gap-2"
        >
          <PlusCircle size={16} />
          New Bet
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['active', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-masters-green text-masters-dark'
                : 'border-transparent text-gray-500 hover:text-masters-dark'
            }`}
          >
            {t === 'active' ? 'Active' : 'History'}
            <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
              tab === t ? 'bg-masters-green text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {t === 'active' ? activeBets.length : historyBets.length}
            </span>
          </button>
        ))}
      </div>

      {/* Bet list */}
      {displayBets.length === 0 ? (
        <div className="card text-center py-10">
          <DollarSign size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">
            {tab === 'active'
              ? 'No active bets. Create one to get started!'
              : 'No completed or cancelled bets.'}
          </p>
          {tab === 'active' && (
            <button onClick={() => navigate('/side-bets/new')} className="btn-primary mt-4 mx-auto flex items-center gap-2 text-sm">
              <PlusCircle size={14} />
              New Bet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayBets.map(bet => {
            const match = matches.find(m => m.id === bet.matchId)
            const rc = roundConfigs.find(r => r.round === bet.round)
            const summary = betSummary(bet)

            return (
              <Link
                key={bet.id}
                to={`/side-bets/${bet.id}`}
                className="card flex items-start justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer no-underline"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-masters-dark">
                      {FORMAT_DISPLAY_NAMES[bet.format] ?? bet.format}
                    </span>
                    <StatusBadge status={bet.status} />
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {rc ? `Round ${bet.round}` : `Round ${bet.round}`}
                    {match ? ` · ${match.label}` : ''}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {/* Participants */}
                    {['A', 'B'].map(side => {
                      const sidePlayers = bet.participants.filter(p => p.side === side)
                      return (
                        <span key={side} className="text-xs text-gray-600">
                          <span className={`font-semibold ${side === 'A' ? 'text-blue-600' : 'text-red-600'}`}>
                            {side}:
                          </span>{' '}
                          {sidePlayers.map(p => p.playerName).join(' & ')}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-masters-dark">{summary}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(bet.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
