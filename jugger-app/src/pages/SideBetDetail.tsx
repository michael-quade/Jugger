import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useIsPlayer, useAuthStore } from '../store/useAuthStore'
import { getPlayerCourseHdcp } from '../utils/handicap'
import {
  computeSideBet, holeWinner, sideNetOnHole, FORMAT_DISPLAY_NAMES, fmt,
  type SettlementResult,
} from '../utils/sideBets'
import type {
  SideBet, SideBetHoleEntry, SideBetParticipant,
  DotsConfig, BingoBangoBongoConfig, WolfConfig,
  Match, HoleData,
} from '../types'

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  active:    'text-green-700 bg-green-50 border-green-200',
  complete:  'text-blue-700 bg-blue-50 border-blue-200',
  cancelled: 'text-gray-400 bg-gray-50 border-gray-200',
}

const AUTO_FORMATS = new Set(['nassau', 'skins', 'match_money', 'stroke_play', 'gruesomes', 'vegas_side'])

// ── Hole entry modal for manual formats ──────────────────────────────────────

function DotsModal({
  hole, participants, holeEntry, onSave, onClose, config,
}: {
  hole: number
  participants: SideBetParticipant[]
  holeEntry: SideBetHoleEntry | undefined
  onSave: (entry: SideBetHoleEntry) => void
  onClose: () => void
  config: DotsConfig
}) {
  const dotTypes = [
    ...(config.birdie ? ['Birdie'] : []),
    ...(config.eagle ? ['Eagle'] : []),
    ...(config.sandy ? ['Sandy'] : []),
    ...(config.greenie ? ['Greenie'] : []),
    ...(config.ferret ? ['Ferret'] : []),
    ...(config.poley ? ['Poley'] : []),
    ...(config.barky ? ['Barky'] : []),
    ...config.customDots,
  ]
  const [dots, setDots] = useState<Record<string, string[]>>(holeEntry?.dots ?? {})

  function toggle(pid: string, dot: string) {
    setDots(prev => {
      const cur = prev[pid] ?? []
      return { ...prev, [pid]: cur.includes(dot) ? cur.filter(d => d !== dot) : [...cur, dot] }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-serif font-bold text-masters-dark text-lg mb-4">Hole {hole} Dots</h3>
        <div className="space-y-3 mb-6">
          {participants.map(p => (
            <div key={p.playerId}>
              <p className="text-sm font-semibold mb-1">{p.playerName} <span className={`text-xs ${p.side === 'A' ? 'text-blue-500' : 'text-red-500'}`}>(Side {p.side})</span></p>
              <div className="flex flex-wrap gap-2">
                {dotTypes.map(dot => (
                  <button
                    key={dot}
                    onClick={() => toggle(p.playerId, dot)}
                    className={`px-2 py-1 rounded text-xs border font-medium transition-colors ${
                      (dots[p.playerId] ?? []).includes(dot)
                        ? 'bg-masters-green text-white border-masters-green'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-masters-green'
                    }`}
                  >
                    {dot}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave({ hole, dots })} className="btn-primary flex-1">Save</button>
        </div>
      </div>
    </div>
  )
}

function BBBModal({
  hole, participants, holeEntry, onSave, onClose,
}: {
  hole: number
  participants: SideBetParticipant[]
  holeEntry: SideBetHoleEntry | undefined
  onSave: (entry: SideBetHoleEntry) => void
  onClose: () => void
}) {
  const [bingo, setBingo] = useState(holeEntry?.bbb?.bingo ?? '')
  const [bango, setBango] = useState(holeEntry?.bbb?.bango ?? '')
  const [bongo, setBongo] = useState(holeEntry?.bbb?.bongo ?? '')

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-serif font-bold text-masters-dark text-lg mb-4">Hole {hole} — Bingo Bango Bongo</h3>
        <div className="space-y-4 mb-6">
          {(['bingo', 'bango', 'bongo'] as const).map((type, i) => {
            const labels = ['Bingo (first on green)', 'Bango (closest to pin)', 'Bongo (first in hole)']
            const vals = [bingo, bango, bongo]
            const setters = [setBingo, setBango, setBongo]
            return (
              <div key={type}>
                <p className="label mb-1">{labels[i]}</p>
                <select
                  className="input w-full"
                  value={vals[i]}
                  onChange={e => setters[i](e.target.value)}
                >
                  <option value="">— None —</option>
                  {participants.map(p => (
                    <option key={p.playerId} value={p.playerId}>{p.playerName} (Side {p.side})</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave({ hole, bbb: { bingo, bango, bongo } })} className="btn-primary flex-1">Save</button>
        </div>
      </div>
    </div>
  )
}

function WolfModal({
  hole, participants, holeEntry, onSave, onClose,
}: {
  hole: number
  participants: SideBetParticipant[]
  holeEntry: SideBetHoleEntry | undefined
  onSave: (entry: SideBetHoleEntry) => void
  onClose: () => void
}) {
  const [wolfId, setWolfId] = useState(holeEntry?.wolfChoice?.wolfId ?? '')
  const [partnerId, setPartnerId] = useState(holeEntry?.wolfChoice?.partnerId ?? '')
  const [alone, setAlone] = useState(holeEntry?.wolfChoice?.alone ?? false)
  const [winnerSide, setWinnerSide] = useState<'A' | 'B' | null>(holeEntry?.wolfWinnerSide ?? null)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-serif font-bold text-masters-dark text-lg mb-4">Hole {hole} — Wolf</h3>
        <div className="space-y-4 mb-6">
          <div>
            <p className="label mb-1">Wolf (who chose)</p>
            <select className="input w-full" value={wolfId} onChange={e => setWolfId(e.target.value)}>
              <option value="">— Select Wolf —</option>
              {participants.map(p => (
                <option key={p.playerId} value={p.playerId}>{p.playerName} (Side {p.side})</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-masters-green" checked={alone} onChange={e => setAlone(e.target.checked)} />
            <span className="text-sm font-medium">Wolf going alone</span>
          </label>
          {!alone && (
            <div>
              <p className="label mb-1">Partner</p>
              <select className="input w-full" value={partnerId} onChange={e => setPartnerId(e.target.value)}>
                <option value="">— Select Partner —</option>
                {participants.filter(p => p.playerId !== wolfId).map(p => (
                  <option key={p.playerId} value={p.playerId}>{p.playerName} (Side {p.side})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <p className="label mb-1">Winning side</p>
            <div className="flex gap-2">
              {(['A', 'B', null] as const).map(side => (
                <button
                  key={String(side)}
                  onClick={() => setWinnerSide(side)}
                  className={`flex-1 py-2 rounded font-semibold text-sm border-2 transition-colors ${
                    winnerSide === side
                      ? side === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : side === 'B' ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-400 bg-gray-100 text-gray-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {side ?? 'TBD'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={!wolfId}
            onClick={() => onSave({ hole, wolfChoice: { wolfId, partnerId: partnerId || undefined, alone }, wolfWinnerSide: winnerSide })}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hole table (auto-computed formats) ────────────────────────────────────────

function AutoHoleTable({ bet, match, holes, hdcps }: {
  bet: SideBet
  match: Match
  holes: HoleData[]
  hdcps: Record<string, number>
}) {
  const sideANames = bet.participants.filter(p => p.side === 'A').map(p => p.playerName).join(' & ')
  const sideBNames = bet.participants.filter(p => p.side === 'B').map(p => p.playerName).join(' & ')

  let runningMargin = 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-center">
        <thead>
          <tr className="bg-masters-light">
            <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-500">Hole</th>
            <th className="px-2 py-1.5 text-xs font-semibold text-gray-500">Par</th>
            <th className="px-2 py-1.5 text-xs font-semibold text-blue-600">{sideANames}</th>
            <th className="px-2 py-1.5 text-xs font-semibold text-red-600">{sideBNames}</th>
            <th className="px-2 py-1.5 text-xs font-semibold text-gray-500">Result</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((hole: any) => {
            const w = holeWinner(hole.number, bet.participants, match, hdcps, holes)
            const aNet = sideNetOnHole('A', bet.participants, hole.number, match, hdcps, holes)
            const bNet = sideNetOnHole('B', bet.participants, hole.number, match, hdcps, holes)

            if (w === 'A') runningMargin++
            else if (w === 'B') runningMargin--

            return (
              <tr key={hole.number} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-left font-medium">{hole.number}</td>
                <td className="px-2 py-1.5 text-gray-500">{hole.par}</td>
                <td className={`px-2 py-1.5 font-medium ${w === 'A' ? 'text-blue-600' : 'text-gray-700'}`}>
                  {aNet ?? '—'}
                </td>
                <td className={`px-2 py-1.5 font-medium ${w === 'B' ? 'text-red-600' : 'text-gray-700'}`}>
                  {bNet ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-xs">
                  {w === null ? (
                    <span className="text-gray-300">—</span>
                  ) : w === 'tied' ? (
                    <span className="text-gray-500">Tie</span>
                  ) : (
                    <span className={w === 'A' ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {w} {runningMargin !== 0 ? `(${runningMargin > 0 ? '+' : ''}${runningMargin})` : ''}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Line items panel ──────────────────────────────────────────────────────────

function LineItemsPanel({ result }: { result: SettlementResult }) {
  const [expanded, setExpanded] = useState(false)

  if (result.lineItems.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No data yet.</p>
  }

  const preview = result.lineItems.slice(0, 4)
  const items = expanded ? result.lineItems : preview

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-masters-light text-xs">
            <th className="px-3 py-1.5 text-left text-gray-500">Item</th>
            <th className="px-3 py-1.5 text-gray-500">Result</th>
            <th className="px-3 py-1.5 text-right text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-3 py-1.5">
                <div className="font-medium text-masters-dark">{item.label}</div>
                {item.detail && <div className="text-xs text-gray-400">{item.detail}</div>}
              </td>
              <td className="px-3 py-1.5 text-center">
                {item.status === 'pending' ? (
                  <span className="text-gray-300 text-xs">—</span>
                ) : item.status === 'tied' ? (
                  <span className="text-gray-500 text-xs">Tie</span>
                ) : (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${item.status === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    Side {item.status}
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right text-gray-600">{fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.lineItems.length > 4 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-xs text-gray-400 hover:text-masters-dark py-2 flex items-center justify-center gap-1"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Show less' : `Show all ${result.lineItems.length} items`}
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SideBetDetail() {
  const { betId } = useParams<{ betId: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const isPlayer = useIsPlayer()
  const currentAdmin = useAuthStore(s => s.currentAdmin)

  const { sideBets = [], teams, matches, courses, roundConfigs, admins, completeSideBet, cancelSideBet, deleteSideBet, updateSideBetHole } = useTournamentStore()

  const bet = sideBets.find(b => b.id === betId)

  const playerRosterId = useMemo(() => {
    if (!currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [currentAdmin, admins])

  const match = bet ? matches.find(m => m.id === bet.matchId) : null
  const rc = bet ? roundConfigs.find(r => r.round === bet.round) : null
  const course = rc ? courses.find(c => c.id === rc.courseId) : null
  const holes = course?.holes ?? []

  // Compute HDCPs for participants
  const hdcps = useMemo(() => {
    if (!bet || !course || !rc) return {}
    const allPlayers = teams.flatMap(t => t.players)
    const result: Record<string, number> = {}
    for (const p of bet.participants) {
      const player = allPlayers.find(pl => pl.id === p.playerId)
      if (player) result[p.playerId] = getPlayerCourseHdcp(player, course, rc.tee, bet.round, allPlayers)
    }
    return result
  }, [bet, course, rc, teams])

  // Settlement
  const settlement: SettlementResult | null = useMemo(() => {
    if (!bet || !match || holes.length === 0) return null
    try {
      return computeSideBet(bet, match, holes, hdcps)
    } catch {
      return null
    }
  }, [bet, match, holes, hdcps])

  // Determine if current user is a participant
  const isParticipant = bet?.participants.some(p => p.playerId === playerRosterId)
  const isCreator = bet?.createdBy === currentAdmin

  // Manual hole entry state
  const [editHole, setEditHole] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!bet) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Side bet not found.</p>
        <button onClick={() => navigate('/side-bets')} className="btn-secondary mt-4 mx-auto flex items-center gap-2">
          <ChevronLeft size={16} />
          Back to Side Bets
        </button>
      </div>
    )
  }

  const isManual = !AUTO_FORMATS.has(bet.format)
  const isActive = bet.status === 'pending' || bet.status === 'active'
  const canEdit = isActive && (isAdmin || isParticipant)

  function handleSaveHole(entry: SideBetHoleEntry) {
    updateSideBetHole(bet!.id, entry)
    setEditHole(null)
  }

  function handleDelete() {
    deleteSideBet(bet!.id)
    navigate('/side-bets')
  }

  const sideANames = bet.participants.filter(p => p.side === 'A').map(p => p.playerName).join(' & ')
  const sideBNames = bet.participants.filter(p => p.side === 'B').map(p => p.playerName).join(' & ')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/side-bets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-masters-dark">
        <ChevronLeft size={16} />
        Side Bets
      </button>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h1 className="text-xl font-serif font-bold text-masters-dark">
              {FORMAT_DISPLAY_NAMES[bet.format] ?? bet.format}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {match?.label ?? '—'} · Round {bet.round}
              {rc && ` · ${rc.tee} tees`}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded border text-xs font-semibold capitalize ${STATUS_COLORS[bet.status]}`}>
            {bet.status}
          </span>
        </div>

        {/* Sticky settlement bar */}
        {settlement && (
          <div className={`rounded-lg px-4 py-3 text-center font-semibold text-sm mb-3 ${
            settlement.sideANet === 0 ? 'bg-gray-50 text-gray-600'
            : settlement.sideANet > 0 ? 'bg-blue-50 text-blue-700'
            : 'bg-red-50 text-red-700'
          }`}>
            {settlement.summary}
            {!settlement.complete && (
              <span className="ml-2 text-xs opacity-60">(in progress)</span>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="flex items-center justify-center gap-4 text-sm py-2 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-0.5">Side A</div>
            <div className="font-medium">{sideANames}</div>
          </div>
          <div className="text-gray-300 font-bold">vs</div>
          <div className="text-center">
            <div className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-0.5">Side B</div>
            <div className="font-medium">{sideBNames}</div>
          </div>
        </div>
      </div>

      {/* Hole section */}
      {match && holes.length > 0 && (
        <div className="card overflow-hidden">
          <h2 className="section-header mb-3">
            {isManual ? 'Hole Entries' : 'Hole-by-Hole'}
          </h2>

          {isManual ? (
            // Manual formats: per-hole entry rows
            <div className="space-y-1">
              {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
                const entry = bet.holes.find(e => e.hole === h)
                let summary = '—'
                if (bet.format === 'dots' && entry?.dots) {
                  const total = Object.values(entry.dots).reduce((s, arr) => s + arr.length, 0)
                  summary = total > 0 ? `${total} dot${total !== 1 ? 's' : ''}` : 'No dots'
                } else if (bet.format === 'bingo_bango_bongo' && entry?.bbb) {
                  const pts = [entry.bbb.bingo, entry.bbb.bango, entry.bbb.bongo].filter(Boolean).length
                  summary = `${pts}/3 pts`
                } else if (bet.format === 'wolf' && entry?.wolfChoice) {
                  const wolf = bet.participants.find(p => p.playerId === entry.wolfChoice!.wolfId)
                  summary = wolf ? `${wolf.playerName}${entry.wolfChoice.alone ? ' (alone)' : ''}${entry.wolfWinnerSide ? ` → Side ${entry.wolfWinnerSide}` : ''}` : '—'
                }

                return (
                  <div key={h} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium w-14">Hole {h}</span>
                    <span className="text-sm text-gray-500 flex-1 text-center">{summary}</span>
                    {canEdit && (
                      <button
                        onClick={() => setEditHole(h)}
                        className="text-masters-green hover:text-masters-dark"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // Auto-computed formats: read-only hole table
            <AutoHoleTable bet={bet} match={match as any} holes={holes} hdcps={hdcps} />
          )}
        </div>
      )}

      {/* Line items */}
      {settlement && (
        <div className="card overflow-hidden">
          <h2 className="section-header mb-3">Settlement Detail</h2>
          <LineItemsPanel result={settlement} />
          {settlement.complete && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-right font-semibold text-sm">
              Net: <span className={settlement.sideANet >= 0 ? 'text-blue-600' : 'text-red-600'}>
                {settlement.sideANet === 0 ? 'Even' : settlement.sideANet > 0
                  ? `Side A +${fmt(Math.abs(settlement.sideANet))}`
                  : `Side B +${fmt(Math.abs(settlement.sideANet))}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="card flex flex-wrap gap-3">
        {isActive && (isAdmin || isParticipant) && (
          <button
            onClick={() => completeSideBet(bet.id)}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle size={16} />
            Mark Complete
          </button>
        )}
        {isActive && (isCreator || isAdmin) && (
          <button
            onClick={() => cancelSideBet(bet.id)}
            className="btn-secondary flex items-center gap-2"
          >
            <XCircle size={16} />
            Cancel
          </button>
        )}
        {isAdmin && (
          <>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="btn-danger flex items-center gap-2 ml-auto">
                <Trash2 size={16} />
                Delete
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button onClick={handleDelete} className="btn-danger text-sm px-3 py-1.5">Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for hole entry */}
      {editHole !== null && bet.format === 'dots' && (
        <DotsModal
          hole={editHole}
          participants={bet.participants}
          holeEntry={bet.holes.find(e => e.hole === editHole)}
          onSave={handleSaveHole}
          onClose={() => setEditHole(null)}
          config={bet.config as DotsConfig}
        />
      )}
      {editHole !== null && bet.format === 'bingo_bango_bongo' && (
        <BBBModal
          hole={editHole}
          participants={bet.participants}
          holeEntry={bet.holes.find(e => e.hole === editHole)}
          onSave={handleSaveHole}
          onClose={() => setEditHole(null)}
        />
      )}
      {editHole !== null && bet.format === 'wolf' && (
        <WolfModal
          hole={editHole}
          participants={bet.participants}
          holeEntry={bet.holes.find(e => e.hole === editHole)}
          onSave={handleSaveHole}
          onClose={() => setEditHole(null)}
        />
      )}
    </div>
  )
}
