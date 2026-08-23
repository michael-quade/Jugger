import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, DollarSign, CheckCircle, XCircle, Clock, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useIsPlayer, useAuthStore } from '../store/useAuthStore'
import { getPlayerCourseHdcp } from '../utils/handicap'
import { computeSideBet, FORMAT_DISPLAY_NAMES, fmt, type SettlementResult } from '../utils/sideBets'
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
  const { sideBets = [], teams, matches, courses, roundConfigs, admins, acceptSideBet, declineSideBet } = useTournamentStore()

  const [tab, setTab] = useState<'active' | 'history' | 'stats'>('active')

  const playerRosterId = useMemo(() => {
    if (!currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [currentAdmin, admins])

  const canAccess = isAdmin || isPlayer

  // Build hdcps + settlement for a single bet
  function resolveSettlement(bet: SideBet): SettlementResult | null {
    const match = matches.find(m => m.id === bet.matchId)
    const rc = roundConfigs.find(r => r.round === bet.round)
    const course = rc ? courses.find(c => c.id === rc.courseId) : null
    if (!match || !course || !rc) return null
    const allPlayers = teams.flatMap(t => t.players)
    const hdcps: Record<string, number> = {}
    for (const p of bet.participants) {
      const player = allPlayers.find(pl => pl.id === p.playerId)
      if (player) hdcps[p.playerId] = getPlayerCourseHdcp(player, course, rc.tee, bet.round, allPlayers)
    }
    try { return computeSideBet(bet, match, course.holes, hdcps) } catch { return null }
  }

  const visibleBets = useMemo(() => {
    if (isAdmin) return sideBets
    if (isPlayer && playerRosterId) {
      return sideBets.filter(b => b.participants.some(p => p.playerId === playerRosterId))
    }
    return []
  }, [sideBets, isAdmin, isPlayer, playerRosterId])

  const activeBets  = visibleBets.filter(b => b.status === 'pending' || b.status === 'active')
  const historyBets = visibleBets.filter(b => b.status === 'complete' || b.status === 'cancelled')

  // Pre-compute settlements for all completed bets (used by both History and Stats tabs)
  const completedSettlements = useMemo<{ bet: SideBet; settlement: SettlementResult | null }[]>(() => {
    return historyBets
      .filter(b => b.status === 'complete')
      .map(bet => ({ bet, settlement: resolveSettlement(bet) }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyBets, matches, roundConfigs, courses, teams])

  // Determine result & net for the current player on a completed bet
  function playerResult(bet: SideBet, settlement: SettlementResult): { result: 'win' | 'loss' | 'tie'; net: number } | null {
    if (!playerRosterId) return null
    const participant = bet.participants.find(p => p.playerId === playerRosterId)
    if (!participant) return null

    if (settlement.playerTotals) {
      const pt = settlement.playerTotals.find(p => p.playerId === playerRosterId)
      if (!pt) return null
      return { result: pt.net > 0 ? 'win' : pt.net < 0 ? 'loss' : 'tie', net: pt.net }
    }

    const net = participant.side === 'A' ? settlement.sideANet : -settlement.sideANet
    return { result: net > 0 ? 'win' : net < 0 ? 'loss' : 'tie', net }
  }

  // Aggregate stats for the Stats tab
  const stats = useMemo(() => {
    if (!playerRosterId) return null
    let wins = 0, losses = 0, ties = 0, totalNet = 0
    let biggestWin  = { amount: 0, label: '' }
    let biggestLoss = { amount: 0, label: '' }
    const byFormat: Record<string, { played: number; wins: number; losses: number; ties: number; net: number }> = {}
    const h2h: Record<string, { played: number; wins: number; losses: number; ties: number; net: number }> = {}

    for (const { bet, settlement } of completedSettlements) {
      if (!settlement) continue
      const pr = playerResult(bet, settlement)
      if (!pr) continue
      const { result, net } = pr

      // Overall
      if (result === 'win') wins++
      else if (result === 'loss') losses++
      else ties++
      totalNet += net
      if (net > biggestWin.amount) biggestWin = { amount: net, label: `${FORMAT_DISPLAY_NAMES[bet.format]} (R${bet.round})` }
      if (net < -biggestLoss.amount) biggestLoss = { amount: -net, label: `${FORMAT_DISPLAY_NAMES[bet.format]} (R${bet.round})` }

      // By format
      if (!byFormat[bet.format]) byFormat[bet.format] = { played: 0, wins: 0, losses: 0, ties: 0, net: 0 }
      byFormat[bet.format].played++
      byFormat[bet.format][result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'ties']++
      byFormat[bet.format].net += net

      // Head-to-head (one record per opponent per bet)
      const opponents = settlement.playerTotals
        ? bet.participants.filter(p => p.playerId !== playerRosterId)
        : bet.participants.filter(p => p.side !== bet.participants.find(pp => pp.playerId === playerRosterId)?.side)
      for (const opp of opponents) {
        if (!h2h[opp.playerName]) h2h[opp.playerName] = { played: 0, wins: 0, losses: 0, ties: 0, net: 0 }
        h2h[opp.playerName].played++
        h2h[opp.playerName][result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'ties']++
        h2h[opp.playerName].net += net
      }
    }

    return { wins, losses, ties, totalNet, biggestWin, biggestLoss, byFormat, h2h }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSettlements, playerRosterId])

  if (!canAccess) {
    return (
      <div className="card text-center py-12">
        <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-serif font-bold text-masters-dark mb-2">Players Only</h2>
        <p className="text-gray-500">Sign in as a player or admin to view and manage side bets.</p>
      </div>
    )
  }

  const hasStats = !!playerRosterId && completedSettlements.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Side Bets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin && !isPlayer ? 'All bets across all players' : 'Your active wagers'}
          </p>
        </div>
        <button onClick={() => navigate('/side-bets/new')} className="btn-primary flex items-center gap-2">
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
              tab === t ? 'border-masters-green text-masters-dark' : 'border-transparent text-gray-500 hover:text-masters-dark'
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
        {hasStats && (
          <button
            onClick={() => setTab('stats')}
            className={`px-4 py-2 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === 'stats' ? 'border-masters-gold text-masters-dark' : 'border-transparent text-gray-500 hover:text-masters-dark'
            }`}
          >
            <TrendingUp size={13} />
            Stats
          </button>
        )}
      </div>

      {/* ── Active / History tabs ── */}
      {tab !== 'stats' && (() => {
        const displayBets = tab === 'active' ? activeBets : historyBets
        return displayBets.length === 0 ? (
          <div className="card text-center py-10">
            <DollarSign size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">
              {tab === 'active' ? 'No active bets. Create one to get started!' : 'No completed or cancelled bets.'}
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
              const settlement = resolveSettlement(bet)
              const summary = settlement?.summary ?? '—'
              const isIndividual = !!settlement?.playerTotals

              // Determine this player's acceptance state
              const myAcceptance = playerRosterId ? (bet.acceptances ?? {})[playerRosterId] : undefined
              const needsMyResponse = playerRosterId &&
                bet.status === 'pending' &&
                bet.participants.some(p => p.playerId === playerRosterId) &&
                !myAcceptance

              return (
                <div key={bet.id} className="card space-y-3">
                  {/* Top row: format + status + meta */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-masters-dark">{FORMAT_DISPLAY_NAMES[bet.format] ?? bet.format}</span>
                        <StatusBadge status={bet.status} />
                      </div>
                      <p className="text-sm text-gray-500">Round {bet.round}{match ? ` · ${match.label}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-masters-dark">{summary}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(bet.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}by {admins.find(a => a.username === bet.createdBy)?.displayName ?? bet.createdBy}
                      </p>
                    </div>
                  </div>

                  {/* Participants with acceptance status */}
                  <div className="flex flex-wrap gap-1.5">
                    {bet.participants.map(p => {
                      const resp = (bet.acceptances ?? {})[p.playerId]
                      return (
                        <span
                          key={p.playerId}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                            resp === 'accepted'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : resp === 'declined'
                              ? 'bg-red-50 text-red-500 border-red-200 line-through'
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}
                        >
                          {resp === 'accepted' && <CheckCircle size={10} />}
                          {resp === 'declined' && <XCircle size={10} />}
                          {resp === undefined && <Clock size={10} className="text-gray-400" />}
                          {p.playerName.split(' ')[0]}
                        </span>
                      )
                    })}
                  </div>

                  {/* Accept / Decline buttons — shown when this player hasn't responded */}
                  {(() => {
                    const unaccepted = bet.participants.filter(p => (bet.acceptances ?? {})[p.playerId] !== 'accepted')
                    const showAdminApprove = isAdmin && unaccepted.length > 0 && bet.status !== 'complete' && bet.status !== 'cancelled'
                    if (!needsMyResponse && !showAdminApprove) return null
                    return (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 flex-wrap">
                        {needsMyResponse && (
                          <>
                            <span className="text-xs text-amber-700 font-medium">Your response needed:</span>
                            <button
                              className="flex items-center gap-1 px-3 py-1 rounded border border-green-300 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                              onClick={() => acceptSideBet(bet.id, playerRosterId!)}
                            >
                              <ThumbsUp size={11} /> Accept
                            </button>
                            <button
                              className="flex items-center gap-1 px-3 py-1 rounded border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                              onClick={() => declineSideBet(bet.id, playerRosterId!)}
                            >
                              <ThumbsDown size={11} /> Decline
                            </button>
                          </>
                        )}
                        {showAdminApprove && (
                          <div className="ml-auto flex flex-wrap gap-1">
                            {unaccepted.map(p => (
                              <button
                                key={p.playerId}
                                className="px-2 py-0.5 rounded border border-masters-green/40 text-masters-green text-[11px] font-semibold hover:bg-masters-green hover:text-white transition-colors"
                                onClick={() => acceptSideBet(bet.id, p.playerId)}
                              >
                                Approve {p.playerName.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Link to detail */}
                  <Link
                    to={`/side-bets/${bet.id}`}
                    className="text-xs text-masters-green font-semibold hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Stats tab ── */}
      {tab === 'stats' && stats && (
        <div className="space-y-5">
          {/* Overall summary */}
          <div className="card">
            <h2 className="section-header mb-4">Overall Record</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold font-serif text-masters-dark">{stats.wins}–{stats.losses}{stats.ties > 0 ? `–${stats.ties}` : ''}</div>
                <div className="text-xs text-gray-500 mt-0.5">W–L{stats.ties > 0 ? '–T' : ''}</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold font-serif ${stats.totalNet > 0 ? 'text-green-600' : stats.totalNet < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {stats.totalNet > 0 ? `+${fmt(stats.totalNet)}` : stats.totalNet < 0 ? `-${fmt(-stats.totalNet)}` : 'Even'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Net</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-serif text-green-600">
                  {stats.biggestWin.amount > 0 ? `+${fmt(stats.biggestWin.amount)}` : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{stats.biggestWin.label || 'Biggest Win'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-serif text-red-600">
                  {stats.biggestLoss.amount > 0 ? `-${fmt(stats.biggestLoss.amount)}` : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{stats.biggestLoss.label || 'Biggest Loss'}</div>
              </div>
            </div>
            {/* Win rate bar */}
            {stats.wins + stats.losses + stats.ties > 0 && (() => {
              const total = stats.wins + stats.losses + stats.ties
              const winPct = Math.round((stats.wins / total) * 100)
              return (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Win rate</span><span>{winPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-masters-green rounded-full" style={{ width: `${winPct}%` }} />
                  </div>
                </div>
              )
            })()}
          </div>

          {/* By format */}
          {Object.keys(stats.byFormat).length > 0 && (
            <div className="card overflow-hidden">
              <h2 className="section-header mb-3">By Format</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-masters-light text-xs">
                      <th className="px-3 py-1.5 text-left text-gray-500">Format</th>
                      <th className="px-3 py-1.5 text-center text-gray-500">Played</th>
                      <th className="px-3 py-1.5 text-center text-gray-500">W–L–T</th>
                      <th className="px-3 py-1.5 text-right text-gray-500">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byFormat)
                      .sort((a, b) => b[1].played - a[1].played)
                      .map(([format, f]) => (
                        <tr key={format} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 font-medium text-masters-dark">{FORMAT_DISPLAY_NAMES[format as keyof typeof FORMAT_DISPLAY_NAMES] ?? format}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{f.played}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{f.wins}–{f.losses}–{f.ties}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${f.net > 0 ? 'text-green-600' : f.net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {f.net > 0 ? `+${fmt(f.net)}` : f.net < 0 ? `-${fmt(-f.net)}` : 'Even'}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Head-to-head */}
          {Object.keys(stats.h2h).length > 0 && (
            <div className="card overflow-hidden">
              <h2 className="section-header mb-3">Head-to-Head</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-masters-light text-xs">
                      <th className="px-3 py-1.5 text-left text-gray-500">Opponent</th>
                      <th className="px-3 py-1.5 text-center text-gray-500">Bets</th>
                      <th className="px-3 py-1.5 text-center text-gray-500">W–L–T</th>
                      <th className="px-3 py-1.5 text-right text-gray-500">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.h2h)
                      .sort((a, b) => b[1].net - a[1].net)
                      .map(([name, h]) => (
                        <tr key={name} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 font-medium text-masters-dark">{name}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{h.played}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{h.wins}–{h.losses}–{h.ties}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${h.net > 0 ? 'text-green-600' : h.net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {h.net > 0 ? `+${fmt(h.net)}` : h.net < 0 ? `-${fmt(-h.net)}` : 'Even'}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
