import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useTournamentStore } from '../store/useTournamentStore'
import { PLAYER_HDCP_HISTORY, HDCP_YEARS, buildHdcpChartData } from '../data/hdcpHistory'

// ── Palette: lighter/darker within each team color ───────────────────────────
const PLAYER_COLORS: Record<string, string> = {
  // Billy Baroo — blues
  quade:       '#1e40af',
  holcomb:     '#3b82f6',
  butterworth: '#60a5fa',
  whitman:     '#93c5fd',
  // #ballgame — reds
  pitts:       '#b91c1c',
  gunter:      '#ef4444',
  oxford:      '#f87171',
  oncavage:    '#fca5a5',
  // Silverbacks — greens
  woyahn:      '#15803d',
  skidmore:    '#22c55e',
  bender:      '#4ade80',
  morris:      '#86efac',
}

const TEAM_GROUPS = [
  { label: 'Billy Baroo', ids: ['quade', 'holcomb', 'butterworth', 'whitman'] },
  { label: '#ballgame',   ids: ['pitts', 'gunter', 'oxford', 'oncavage'] },
  { label: 'Silverbacks', ids: ['woyahn', 'skidmore', 'bender', 'morris'] },
]

// Tooltip that shows hdcp for every visible player at the hovered year
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number | null; color: string }[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  const present = payload.filter(p => p.value !== null && p.value !== undefined)
  return (
    <div className="bg-white border border-gray-200 rounded shadow-lg p-3 text-xs min-w-36">
      <p className="font-bold text-masters-dark mb-1">{label}</p>
      {present.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Stats() {
  const { teams } = useTournamentStore()
  const allPlayers = teams.flatMap(t => t.players)

  // Build display names from store
  const playerName = (id: string) => allPlayers.find(p => p.id === id)?.name ?? id

  // Visible player IDs
  const [visible, setVisible] = useState<Set<string>>(
    new Set(Object.keys(PLAYER_HDCP_HISTORY))
  )

  // Year range filter
  const [yearFrom, setYearFrom] = useState(2006)
  const [yearTo,   setYearTo]   = useState(2026)

  function togglePlayer(id: string) {
    setVisible(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTeam(ids: string[]) {
    const allOn = ids.every(id => visible.has(id))
    setVisible(prev => {
      const next = new Set(prev)
      ids.forEach(id => allOn ? next.delete(id) : next.add(id))
      return next
    })
  }

  function selectOnly(ids: string[]) {
    setVisible(new Set(ids))
  }

  const chartData = useMemo(() =>
    buildHdcpChartData().filter(d => (d.year as number) >= yearFrom && (d.year as number) <= yearTo),
    [yearFrom, yearTo]
  )

  // Single-player spotlight: click a player in legend to see their year-by-year table
  const [spotlight, setSpotlight] = useState<string | null>(null)

  const spotlightData = useMemo(() => {
    if (!spotlight) return null
    const values = PLAYER_HDCP_HISTORY[spotlight]
    return HDCP_YEARS
      .map((year, i) => ({ year, hdcp: values[i] }))
      .filter(r => r.hdcp !== null && r.year >= yearFrom && r.year <= yearTo) as { year: number; hdcp: number }[]
  }, [spotlight, yearFrom, yearTo])

  const allIds = Object.keys(PLAYER_HDCP_HISTORY)
  const allVisible = allIds.every(id => visible.has(id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Handicap Trends</h1>
          <p className="text-sm text-gray-500 mt-0.5">Index history sourced from annual tournament XLSM files.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">From</label>
          <select className="input py-1 w-20" value={yearFrom} onChange={e => setYearFrom(+e.target.value)}>
            {HDCP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="text-gray-500">To</label>
          <select className="input py-1 w-20" value={yearTo} onChange={e => setYearTo(+e.target.value)}>
            {HDCP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Player toggle controls */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Show / Hide Players</p>
          <button
            className="text-xs text-masters-green hover:underline"
            onClick={() => setVisible(allVisible ? new Set() : new Set(allIds))}
          >
            {allVisible ? 'Hide all' : 'Show all'}
          </button>
        </div>
        <div className="space-y-3">
          {TEAM_GROUPS.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-gray-600">{group.label}</span>
                <button
                  className="text-xs text-gray-400 hover:text-masters-green"
                  onClick={() => toggleTeam(group.ids)}
                >
                  {group.ids.every(id => visible.has(id)) ? 'hide team' : 'show team'}
                </button>
                <button
                  className="text-xs text-gray-400 hover:text-masters-green"
                  onClick={() => selectOnly(group.ids)}
                >
                  only this team
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.ids.map(id => (
                  <button
                    key={id}
                    onClick={() => togglePlayer(id)}
                    onDoubleClick={() => setSpotlight(spotlight === id ? null : id)}
                    title="Double-click for individual table"
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all border ${
                      visible.has(id)
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-400 border-gray-200'
                    }`}
                    style={visible.has(id) ? { background: PLAYER_COLORS[id], borderColor: PLAYER_COLORS[id] } : {}}
                  >
                    {playerName(id)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Double-click a player to see their individual year-by-year table below.</p>
      </div>

      {/* Main chart */}
      <div className="card">
        <h2 className="section-header">Handicap Index Over Time</h2>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis
              domain={[0, 36]}
              ticks={[0, 5, 10, 15, 20, 25, 30, 35]}
              tick={{ fontSize: 11 }}
              label={{ value: 'Index', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={18} stroke="#c9a84c" strokeDasharray="4 4" label={{ value: 'HI 18', fontSize: 10, fill: '#c9a84c' }} />
            {allIds.filter(id => visible.has(id)).map(id => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={playerName(id)}
                stroke={PLAYER_COLORS[id]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Gaps indicate years the player did not participate. Gold dashed line = HI 18 reference.
        </p>
      </div>

      {/* Spotlight: individual player table */}
      {spotlight && spotlightData && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header mb-0" style={{ color: PLAYER_COLORS[spotlight] }}>
              {playerName(spotlight)} — Year-by-Year Index
            </h3>
            <button className="text-xs text-gray-400 hover:text-masters-green" onClick={() => setSpotlight(null)}>
              Close ✕
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-masters-light">
                  {spotlightData.map(r => (
                    <th key={r.year} className="border p-1.5 text-center font-semibold">{r.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {spotlightData.map(r => (
                    <td key={r.year} className="border p-1.5 text-center font-mono tabular-nums">
                      {r.hdcp.toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {/* Mini sparkline chart for the single player */}
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={spotlightData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={25} />
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, 'Index']} />
                <Line
                  type="monotone"
                  dataKey="hdcp"
                  stroke={PLAYER_COLORS[spotlight]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: PLAYER_COLORS[spotlight], strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary table: everyone's current index vs all-time low */}
      <div className="card">
        <h3 className="section-header">Career Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-masters-light">
                <th className="border p-2 text-left">Player</th>
                <th className="border p-2 text-center">Team</th>
                <th className="border p-2 text-center">First Year</th>
                <th className="border p-2 text-center">Rounds Played</th>
                <th className="border p-2 text-center">All-Time Low</th>
                <th className="border p-2 text-center">All-Time High</th>
                <th className="border p-2 text-center">2026 Index</th>
                <th className="border p-2 text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_GROUPS.flatMap(group =>
                group.ids.map(id => {
                  const values = PLAYER_HDCP_HISTORY[id].filter((v): v is number => v !== null)
                  const allEntries = PLAYER_HDCP_HISTORY[id]
                    .map((v, i) => ({ year: HDCP_YEARS[i], v }))
                    .filter(e => e.v !== null) as { year: number; v: number }[]
                  const firstYear = allEntries[0]?.year
                  const low  = Math.min(...values)
                  const high = Math.max(...values)
                  const current = allEntries[allEntries.length - 1]?.v ?? null
                  const prev    = allEntries[allEntries.length - 2]?.v ?? null
                  const trend = current !== null && prev !== null
                    ? current < prev ? '↓' : current > prev ? '↑' : '→'
                    : '—'
                  const trendColor = trend === '↓' ? '#16a34a' : trend === '↑' ? '#dc2626' : '#6b7280'

                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold" style={{ color: PLAYER_COLORS[id] }}>
                        {playerName(id)}
                      </td>
                      <td className="border p-2 text-center text-gray-500">{group.label}</td>
                      <td className="border p-2 text-center">{firstYear ?? '—'}</td>
                      <td className="border p-2 text-center">{values.length}</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">{low.toFixed(1)}</td>
                      <td className="border p-2 text-center font-semibold text-red-500">{high.toFixed(1)}</td>
                      <td className="border p-2 text-center font-bold">{current?.toFixed(1) ?? '—'}</td>
                      <td className="border p-2 text-center font-bold text-lg" style={{ color: trendColor }}>{trend}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">↓ lower is better. Trend compares 2026 vs 2025.</p>
      </div>
    </div>
  )
}
