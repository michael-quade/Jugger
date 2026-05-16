import { useState, useMemo } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { CtpEntry, CtpDonation, Course, RoundConfig } from '../types'
import {
  Flag, Check, X, ChevronDown, ChevronRight, DollarSign,
  Trophy, Heart, User,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDollars(n: number) {
  return `$${n.toLocaleString()}`
}

interface Par3Hole {
  round: number
  hole: number
  courseName: string
  courseId: string
  yardage?: number
}

function getPar3Holes(roundConfigs: RoundConfig[], courses: Course[]): Par3Hole[] {
  const holes: Par3Hole[] = []
  const sorted = [...roundConfigs].sort((a, b) => a.round - b.round)
  for (const rc of sorted) {
    const course = courses.find(c => c.id === rc.courseId)
    if (!course) continue
    course.holes
      .filter(h => h.par === 3)
      .sort((a, b) => a.number - b.number)
      .forEach(h => {
        holes.push({
          round: rc.round,
          hole: h.number,
          courseName: course.name,
          courseId: course.id,
          yardage: h.yardages[rc.tee],
        })
      })
  }
  return holes
}

function entryKey(round: number, hole: number) {
  return `${round}-${hole}`
}

// ── Pot summary banner ────────────────────────────────────────────────────────

function CtpPotBanner({
  par3Count, playerCount, totalPot, paidCount, totalDonors,
}: {
  par3Count: number
  playerCount: number
  totalPot: number
  paidCount: number
  totalDonors: number
}) {
  const prizePerHole = playerCount
  const pendingPot = (totalDonors - paidCount) * par3Count
  return (
    <div
      className="relative rounded-2xl overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #1e3a2f 0%, #004D35 60%, #006747 100%)' }}
    >
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="relative px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="text-center">
            <p className="text-masters-gold font-bold uppercase tracking-widest text-xs mb-1">⛳ Par 3 CTP</p>
            <div className="font-serif font-bold" style={{ fontSize: 'clamp(2.5rem,8vw,5rem)', color: '#f5d87a' }}>
              {par3Count}
            </div>
            <p className="text-white/70 text-xs">par 3 holes this year</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs mb-1">Prize per hole</p>
            <div className="text-3xl font-serif font-bold text-masters-gold">{fmtDollars(prizePerHole)}</div>
            <p className="text-white/50 text-xs">${playerCount} players × $1</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs mb-1">Total pot</p>
            <div className="text-3xl font-serif font-bold text-white">{fmtDollars(totalPot)}</div>
            <p className="text-white/50 text-xs">
              {paidCount}/{totalDonors} paid
              {pendingPot > 0 && ` · ${fmtDollars(pendingPot)} pending`}
            </p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs mb-1">Each player owes</p>
            <div className="text-3xl font-serif font-bold text-white">{fmtDollars(par3Count)}</div>
            <p className="text-white/50 text-xs">{par3Count} holes × $1</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Player payment grid ───────────────────────────────────────────────────────

function PaymentGrid({
  donations, isAdmin, par3Count, onToggle,
}: {
  donations: CtpDonation[]
  isAdmin: boolean
  par3Count: number
  onToggle: (id: string, paid: boolean) => void
}) {
  const paidCount = donations.filter(d => d.paid).length
  const collected = donations.filter(d => d.paid).reduce((s, d) => s + d.amount, 0)
  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="section-header mb-0">Player Contributions</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {paidCount} of {donations.length} paid · {fmtDollars(collected)} of {fmtDollars(donations.length * par3Count)} collected
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-masters-green inline-block" /> Paid {fmtDollars(par3Count)}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" /> Pending
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {donations.map(d => (
          <button
            key={d.id}
            disabled={!isAdmin}
            onClick={() => isAdmin && onToggle(d.id, !d.paid)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left
              ${d.paid
                ? 'bg-masters-green/10 border-masters-green/30 text-masters-dark'
                : 'bg-gray-50 border-gray-200 text-gray-500'}
              ${isAdmin ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${d.paid ? 'bg-masters-green' : 'bg-gray-200'}`}>
              {d.paid && <Check size={11} className="text-white" />}
            </span>
            <span className="truncate text-xs">{d.playerName.split(' ').slice(-1)[0]}</span>
            {d.paid && <span className="ml-auto text-[10px] text-masters-green font-bold">{fmtDollars(d.amount)}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── CTP hole result row ───────────────────────────────────────────────────────

function HoleRow({
  par3, entry, allPlayerNames, prizePerHole, isAdmin, onUpdate,
}: {
  par3: Par3Hole
  entry: CtpEntry | undefined
  allPlayerNames: string[]
  prizePerHole: number
  isAdmin: boolean
  onUpdate: (updates: Partial<CtpEntry>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [winnerDraft, setWinnerDraft] = useState(entry?.winnerName ?? '')
  const [donateDraft, setDonateDraft] = useState(false)

  const hasResult = entry && (entry.winnerName || entry.donatedToHio)
  const statusColor = !hasResult ? 'border-gray-200 bg-gray-50' :
    entry.donatedToHio ? 'border-orange-200 bg-orange-50' : 'border-masters-green/30 bg-masters-green/5'

  function saveWinner() {
    if (winnerDraft.trim()) {
      onUpdate({ winnerName: winnerDraft.trim(), donatedToHio: false, hioDonationAmount: undefined })
    }
    setEditing(false)
  }

  function saveDonate() {
    onUpdate({ donatedToHio: true, winnerName: undefined, winnerPaid: undefined, hioDonationAmount: prizePerHole })
    setDonateDraft(false)
    setEditing(false)
  }

  function clearResult() {
    onUpdate({ winnerName: undefined, winnerPaid: undefined, donatedToHio: false, hioDonationAmount: undefined })
    setEditing(false)
  }

  return (
    <div className={`border rounded-lg p-3 transition-colors ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Hole info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center shrink-0">
            <div className="text-xs text-gray-400 font-medium">R{par3.round}</div>
            <div className="font-bold text-masters-dark text-lg leading-none">#{par3.hole}</div>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-masters-dark truncate">{par3.courseName}</div>
            {par3.yardage ? (
              <div className="text-xs text-gray-400">{par3.yardage} yds</div>
            ) : (
              <div className="text-xs text-gray-300">yardage unknown</div>
            )}
          </div>
        </div>

        {/* Prize badge */}
        <div className="shrink-0 text-xs font-bold text-masters-gold bg-masters-gold/10 rounded-full px-2 py-0.5">
          {fmtDollars(prizePerHole)}
        </div>
      </div>

      {/* Result area */}
      <div className="mt-2">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            {hasResult ? (
              entry.donatedToHio ? (
                <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold">
                  <Heart size={12} /> Donated {fmtDollars(entry.hioDonationAmount ?? prizePerHole)} to HIO pot
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-masters-green text-xs font-semibold">
                    <Trophy size={12} /> {entry.winnerName}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => onUpdate({ winnerPaid: !entry.winnerPaid })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                        entry.winnerPaid
                          ? 'bg-masters-green/15 border-masters-green/30 text-masters-green'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-masters-green'
                      }`}
                    >
                      {entry.winnerPaid ? '✓ Paid' : 'Mark paid'}
                    </button>
                  )}
                </div>
              )
            ) : (
              <span className="text-xs text-gray-300 italic">No result yet</span>
            )}
            {isAdmin && (
              <button
                className="text-xs text-gray-400 hover:text-masters-green shrink-0"
                onClick={() => { setEditing(true); setWinnerDraft(entry?.winnerName ?? '') }}
              >
                {hasResult ? 'Edit' : 'Record'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {!donateDraft ? (
              <>
                <div className="flex gap-2">
                  <select
                    className="input flex-1 text-sm"
                    value={winnerDraft}
                    onChange={e => setWinnerDraft(e.target.value)}
                  >
                    <option value="">— Select CTP winner —</option>
                    {allPlayerNames.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="__other__">Other…</option>
                  </select>
                  {winnerDraft === '__other__' && (
                    <input className="input w-36 text-sm" placeholder="Name" onChange={e => setWinnerDraft(e.target.value)} autoFocus />
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-primary text-xs flex items-center gap-1" disabled={!winnerDraft || winnerDraft === '__other__'} onClick={saveWinner}>
                    <Check size={12} /> Save winner
                  </button>
                  <button className="btn-ghost text-xs flex items-center gap-1 text-orange-600 border-orange-300" onClick={() => setDonateDraft(true)}>
                    <Heart size={12} /> No one on green → HIO
                  </button>
                  {hasResult && (
                    <button className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1" onClick={clearResult}>
                      <X size={12} /> Clear
                    </button>
                  )}
                  <button className="text-xs text-gray-400" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                  <Heart size={12} /> Donate {fmtDollars(prizePerHole)} to HIO pot?
                </p>
                <p className="text-xs text-gray-500">No player landed on the green — this hole's prize goes to the Hole in One pot.</p>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs flex items-center gap-1 bg-orange-500 border-orange-500 hover:bg-orange-600" onClick={saveDonate}>
                    <Check size={12} /> Confirm donation
                  </button>
                  <button className="text-xs text-gray-400" onClick={() => setDonateDraft(false)}>Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Winners history chart ─────────────────────────────────────────────────────

const CHART_COLORS = [
  '#1e40af','#dc2626','#16a34a','#9333ea','#ea580c',
  '#0891b2','#be185d','#65a30d','#b45309','#6366f1',
  '#047857','#c2410c',
]

function WinnersChart({ entries, allPlayerNames }: { entries: CtpEntry[]; allPlayerNames: string[] }) {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())

  const winners = entries.filter(e => e.winnerName)
  const winnerNames = [...new Set(winners.map(e => e.winnerName!))]

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {}
    allPlayerNames.forEach((n, i) => { map[n] = CHART_COLORS[i % CHART_COLORS.length] })
    return map
  }, [allPlayerNames])

  const activeNames = selectedPlayers.size > 0
    ? winnerNames.filter(n => selectedPlayers.has(n))
    : winnerNames

  const chartData = useMemo(() => {
    const byPlayer: Record<string, number> = {}
    for (const name of activeNames) {
      byPlayer[name] = winners.filter(e => e.winnerName === name).length
    }
    return Object.entries(byPlayer)
      .sort(([, a], [, b]) => b - a)
      .map(([name, wins]) => ({ name: name.split(' ').slice(-1)[0], fullName: name, wins }))
  }, [winners, activeNames])

  if (winners.length === 0) {
    return (
      <div className="text-center py-10 text-gray-300">
        <Flag size={32} className="mx-auto mb-2" />
        <p className="text-sm">No CTP winners recorded yet for 2026+</p>
      </div>
    )
  }

  function togglePlayer(name: string) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Player filter toggles */}
      <div className="flex flex-wrap gap-2">
        {winnerNames.map(name => {
          const active = selectedPlayers.size === 0 || selectedPlayers.has(name)
          return (
            <button
              key={name}
              onClick={() => togglePlayer(name)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold transition-all ${
                active ? 'border-transparent text-white' : 'bg-white border-gray-200 text-gray-400'
              }`}
              style={active ? { background: colorMap[name] ?? '#666' } : {}}
            >
              <User size={10} />
              {name.split(' ').slice(-1)[0]}
              <span className="opacity-70">({winners.filter(e => e.winnerName === name).length})</span>
            </button>
          )
        })}
        {selectedPlayers.size > 0 && (
          <button className="text-xs text-gray-400 hover:text-masters-green px-2" onClick={() => setSelectedPlayers(new Set())}>
            Show all
          </button>
        )}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => [`${v} win${v !== 1 ? 's' : ''}`, 'CTP wins']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
          />
          <Bar dataKey="wins" radius={[4, 4, 0, 0]}>
            {chartData.map(d => (
              <Cell key={d.fullName} fill={colorMap[d.fullName] ?? '#006747'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Winners history table ─────────────────────────────────────────────────────

function WinnersTable({ entries, allPlayerNames }: { entries: CtpEntry[]; allPlayerNames: string[] }) {
  const [filterPlayer, setFilterPlayer] = useState('')
  const [sortKey, setSortKey] = useState<'year' | 'player' | 'hole'>('year')

  const winners = entries.filter(e => e.winnerName)
  const winnerNames = [...new Set(winners.map(e => e.winnerName!))]

  const filtered = winners
    .filter(e => !filterPlayer || e.winnerName === filterPlayer)
    .sort((a, b) => {
      if (sortKey === 'year') return b.year - a.year || a.round - b.round || a.hole - b.hole
      if (sortKey === 'player') return (a.winnerName ?? '').localeCompare(b.winnerName ?? '')
      return a.hole - b.hole
    })

  if (winners.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="input text-sm w-44"
          value={filterPlayer}
          onChange={e => setFilterPlayer(e.target.value)}
        >
          <option value="">All players</option>
          {winnerNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex gap-1 text-xs">
          <span className="text-gray-400 self-center">Sort:</span>
          {(['year', 'player', 'hole'] as const).map(k => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded border text-xs capitalize ${sortKey === k ? 'bg-masters-green text-white border-masters-green' : 'border-gray-200 text-gray-500'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-masters-light">
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">Player</th>
              <th className="p-2 text-center">Round</th>
              <th className="p-2 text-center">Hole</th>
              <th className="p-2 text-left">Course</th>
              <th className="p-2 text-center">Yardage</th>
              <th className="p-2 text-center">Paid</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-semibold">{e.year}</td>
                <td className="p-2 font-medium text-masters-dark">{e.winnerName}</td>
                <td className="p-2 text-center">R{e.round}</td>
                <td className="p-2 text-center font-bold">#{e.hole}</td>
                <td className="p-2 text-gray-500">{e.courseName}</td>
                <td className="p-2 text-center">{e.yardage ? `${e.yardage} yds` : '—'}</td>
                <td className="p-2 text-center">
                  {e.winnerPaid
                    ? <Check size={12} className="inline text-masters-green" />
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── HIO donation summary ──────────────────────────────────────────────────────

function HioDonationSummary({
  ctpHioHistory, currentYearDonations, currentYear,
}: {
  ctpHioHistory: { year: number; amount: number }[]
  currentYearDonations: number
  currentYear: number
}) {
  const historicalTotal = ctpHioHistory.reduce((s, h) => s + h.amount, 0)
  const grandTotal = historicalTotal + currentYearDonations
  const allYears = [
    ...ctpHioHistory,
    ...(currentYearDonations > 0 ? [{ year: currentYear, amount: currentYearDonations }] : []),
  ].sort((a, b) => b.year - a.year)

  return (
    <div className="card border border-orange-200 bg-orange-50/50">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-orange-500" />
          <h2 className="font-serif font-bold text-masters-dark">CTP → HIO Pot Donations</h2>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-orange-600">{fmtDollars(grandTotal)} total</div>
          <div className="text-xs text-gray-400">added to Hole in One pot</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {allYears.map(({ year, amount }) => (
          <div key={year} className="flex flex-col items-center bg-white rounded-lg border border-orange-200 px-4 py-2 min-w-20">
            <span className="text-xs text-gray-400">{year}</span>
            <span className="font-bold text-orange-600">{fmtDollars(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CtpPage() {
  const {
    year, teams, courses, roundConfigs,
    ctpEntries, ctpDonations, ctpHioHistory,
    setCtpEntries, updateCtpEntry, addCtpDonation, setCtpDonationPaid,
  } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const [showHistory, setShowHistory] = useState(false)
  const [activeRound, setActiveRound] = useState<number | 'all'>('all')

  const allPlayers = teams.flatMap(t => t.players)
  const allPlayerNames = allPlayers.map(p => p.name)
  const playerCount = allPlayers.length

  // All par 3 holes for this year's rounds
  const par3Holes = useMemo(() => getPar3Holes(roundConfigs, courses), [roundConfigs, courses])
  const par3Count = par3Holes.length

  // Per-hole prize = one dollar per player
  const prizePerHole = playerCount

  // This year's CTP entries (keyed by round-hole)
  const thisYearEntries = ctpEntries.filter(e => e.year === year)
  const entryMap = useMemo(() => {
    const m: Record<string, CtpEntry> = {}
    for (const e of thisYearEntries) m[entryKey(e.round, e.hole)] = e
    return m
  }, [thisYearEntries])

  // This year's donations
  const thisYearDonations = ctpDonations.filter(d => d.year === year)
  const paidCount = thisYearDonations.filter(d => d.paid).length
  const totalCollected = thisYearDonations.filter(d => d.paid).reduce((s, d) => s + d.amount, 0)

  // CTP→HIO from this year's entries
  const thisYearHioDonations = thisYearEntries
    .filter(e => e.donatedToHio)
    .reduce((s, e) => s + (e.hioDonationAmount ?? 0), 0)

  // Rounds available for filtering
  const roundsUsed = [...new Set(par3Holes.map(h => h.round))].sort()

  const visibleHoles = activeRound === 'all'
    ? par3Holes
    : par3Holes.filter(h => h.round === activeRound)

  // Initialize year — create CTP entries + donation records
  function initYear() {
    if (par3Count === 0) return

    // Create CtpEntry stubs for each par 3 hole
    const existingKeys = new Set(thisYearEntries.map(e => entryKey(e.round, e.hole)))
    const newEntries: CtpEntry[] = par3Holes
      .filter(h => !existingKeys.has(entryKey(h.round, h.hole)))
      .map(h => ({
        id: `ctp-${year}-r${h.round}-h${h.hole}`,
        year,
        round: h.round,
        hole: h.hole,
        courseName: h.courseName,
        yardage: h.yardage,
      }))
    if (newEntries.length > 0) {
      setCtpEntries([...ctpEntries, ...newEntries])
    }

    // Create donation records for each player
    const existingDonors = new Set(thisYearDonations.map(d => d.playerName))
    allPlayers
      .filter(p => !existingDonors.has(p.name))
      .forEach(p => {
        addCtpDonation({
          id: `ctpdon-${year}-${p.id}`,
          year,
          playerName: p.name,
          amount: par3Count,
          paid: false,
        })
      })
  }

  function handleUpdateEntry(round: number, hole: number, updates: Partial<CtpEntry>) {
    const key = entryKey(round, hole)
    const existing = entryMap[key]
    if (existing) {
      updateCtpEntry(existing.id, updates)
    } else {
      const par3 = par3Holes.find(h => h.round === round && h.hole === hole)!
      const newEntry: CtpEntry = {
        id: `ctp-${year}-r${round}-h${hole}`,
        year,
        round,
        hole,
        courseName: par3.courseName,
        yardage: par3.yardage,
        ...updates,
      }
      setCtpEntries([...ctpEntries, newEntry])
    }
  }

  const isInitialized = thisYearDonations.length > 0 || thisYearEntries.length > 0

  // History entries (all years with winners)
  const allWinnerEntries = ctpEntries.filter(e => e.winnerName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif font-bold text-masters-dark flex items-center gap-2">
          <Flag size={22} className="text-masters-green" />
          Par 3 Closest to the Pin
        </h1>
        {isAdmin && !isInitialized && par3Count > 0 && (
          <button className="btn-primary flex items-center gap-1.5" onClick={initYear}>
            <Check size={14} /> Set Up CTP for {year}
          </button>
        )}
        {isAdmin && isInitialized && (
          <button className="btn-ghost text-xs" onClick={initYear} title="Add any new players or holes missing from this year">
            Sync players / holes
          </button>
        )}
      </div>

      {par3Count === 0 ? (
        <div className="card text-center py-12">
          <Flag size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-semibold">No par 3 holes found for {year}</p>
          <p className="text-gray-300 text-sm mt-1">Add courses and round configurations in the Schedule and Courses pages.</p>
        </div>
      ) : (
        <>
          {/* Pot banner */}
          <CtpPotBanner
            par3Count={par3Count}
            playerCount={playerCount}
            totalPot={totalCollected}
            paidCount={paidCount}
            totalDonors={thisYearDonations.length}
          />

          {/* Payment grid */}
          {isInitialized && thisYearDonations.length > 0 && (
            <PaymentGrid
              donations={thisYearDonations}
              isAdmin={isAdmin}
              par3Count={par3Count}
              onToggle={setCtpDonationPaid}
            />
          )}

          {!isInitialized && isAdmin && (
            <div className="card border-dashed border-2 border-gray-200 text-center py-8">
              <p className="text-gray-400 text-sm">
                Click <strong>"Set Up CTP for {year}"</strong> above to initialize player contribution tracking and hole results.
              </p>
            </div>
          )}

          {/* Round filter tabs */}
          {roundsUsed.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveRound('all')}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  activeRound === 'all' ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green'
                }`}
              >
                All Rounds
              </button>
              {roundsUsed.map(r => (
                <button
                  key={r}
                  onClick={() => setActiveRound(r)}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                    activeRound === r ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green'
                  }`}
                >
                  Round {r}
                </button>
              ))}
            </div>
          )}

          {/* Hole-by-hole results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-header mb-0">
                {visibleHoles.length} Par 3{visibleHoles.length !== 1 ? 's' : ''}
                {activeRound !== 'all' ? ` · Round ${activeRound}` : ''}
              </h2>
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Trophy size={11} className="text-masters-green" /> Winner</span>
                <span className="flex items-center gap-1"><Heart size={11} className="text-orange-400" /> → HIO pot</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleHoles.map(h => (
                <HoleRow
                  key={entryKey(h.round, h.hole)}
                  par3={h}
                  entry={entryMap[entryKey(h.round, h.hole)]}
                  allPlayerNames={allPlayerNames}
                  prizePerHole={prizePerHole}
                  isAdmin={isAdmin}
                  onUpdate={updates => handleUpdateEntry(h.round, h.hole, updates)}
                />
              ))}
            </div>
          </div>

          {/* CTP → HIO summary */}
          <HioDonationSummary
            ctpHioHistory={ctpHioHistory}
            currentYearDonations={thisYearHioDonations}
            currentYear={year}
          />
        </>
      )}

      {/* History section */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setShowHistory(v => !v)}
        >
          <div>
            <h2 className="font-serif font-bold text-lg text-masters-dark">CTP History (2026+)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {allWinnerEntries.length} recorded win{allWinnerEntries.length !== 1 ? 's' : ''}
            </p>
          </div>
          {showHistory
            ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
            : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
        </button>

        {showHistory && (
          <div className="mt-4 space-y-4">
            <WinnersChart entries={ctpEntries} allPlayerNames={allPlayerNames} />
            <WinnersTable entries={ctpEntries} allPlayerNames={allPlayerNames} />
          </div>
        )}
      </div>
    </div>
  )
}
