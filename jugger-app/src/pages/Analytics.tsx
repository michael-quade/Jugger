import { useState, useMemo, useEffect, useContext, useCallback, createContext } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts'
import { Trophy, TrendingUp, Users, Crosshair, BarChart2, BookOpen, Star, Flag } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { PLAYER_HDCP_HISTORY, HDCP_YEARS } from '../data/hdcpHistory'
import type { Team, ArchivedYear, CtpEntry, CtpDonation } from '../types'
import {
  computeScoringProfiles, computeH2H, computePartnerRecords,
  computeTeamResults, computeFormatStats, computeCourseStats,
  computeRecords, computePlayerFormatStats,
  type YearBundle, type RndFormat, type CourseLike,
} from '../utils/analytics'

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_PLAYER_COLORS: Record<string, string> = {
  quade: '#1e40af', holcomb: '#3b82f6', butterworth: '#60a5fa', whitman: '#93c5fd',
  pitts: '#b91c1c', gunter: '#ef4444', oxford: '#f87171', oncavage: '#fca5a5',
  woyahn: '#15803d', skidmore: '#22c55e', bender: '#4ade80', morris: '#86efac',
}

// Extra shades for historical subs/replacements — assigned in order per team slot
const TEAM_EXTRA_SHADES: Record<string, string[]> = {
  '#2563EB': ['#1d4ed8', '#1e3a8a', '#7dd3fc', '#bfdbfe'],
  '#DC2626': ['#b91c1c', '#991b1b', '#fc8181', '#fecdd3'],
  '#059669': ['#047857', '#065f46', '#6ee7b7', '#d1fae5'],
}

const BASE_TEAM_GROUPS = [
  { label: 'Billy Baroo', ids: ['quade', 'holcomb', 'butterworth', 'whitman'],  color: '#2563EB' },
  { label: '#ballgame',   ids: ['pitts', 'gunter', 'oxford', 'oncavage'],        color: '#DC2626' },
  { label: 'Silverbacks', ids: ['woyahn', 'skidmore', 'bender', 'morris'],       color: '#059669' },
]

interface RosterGroup { label: string; ids: string[]; color: string; teamId: string }
interface RosterContextValue {
  teamGroups: RosterGroup[]
  playerColors: Record<string, string>
  playerName: (id: string) => string
}

const RosterContext = createContext<RosterContextValue>({
  teamGroups: BASE_TEAM_GROUPS.map(g => ({ ...g, teamId: '' })),
  playerColors: BASE_PLAYER_COLORS,
  playerName: id => id,
})

const FORMAT_LABELS: Record<string, string> = {
  team_match_play:  'Team Match Play',
  points_round:     'Points Round',
  texas_scramble:   'Scramble',
  individual_match: 'Individual Match',
  captains_choice:  "Captain's Choice",
}

const SCORE_COLORS = {
  eagle:  '#c9a84c',
  birdie: '#22c55e',
  par:    '#60a5fa',
  bogey:  '#f97316',
  double: '#ef4444',
  worse:  '#7f1d1d',
}

type Tab = 'team' | 'scoring' | 'h2h' | 'format' | 'course' | 'hdcp' | 'records' | 'ctp'

// ─── Root page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<Tab>('team')
  const [stickyTop, setStickyTop] = useState(220)

  useEffect(() => {
    const header = document.getElementById('site-header')
    if (!header) return
    const update = () => setStickyTop(header.offsetHeight)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(header)
    return () => obs.disconnect()
  }, [])

  const {
    teams, matches, teamScores, roundConfigs, courses,
    archivedYears, liveYear, liveCache, isViewingHistory, courseHistory,
    ctpEntries, ctpDonations,
  } = useTournamentStore()

  const liveTeams = isViewingHistory ? (liveCache?.teams ?? teams) : teams

  const courseHistoryTyped: CourseLike[] = courseHistory
    .filter(c => Array.isArray(c.holes) && c.holes.length > 0 && c.par != null && Array.isArray(c.tees) && c.tees.length > 0)
    .map(c => ({ id: c.id, name: c.name, par: c.par!, tees: c.tees!, holes: c.holes! }))

  // Build unified year bundles (archived + live)
  const bundles = useMemo((): YearBundle[] => {
    const result: YearBundle[] = []
    for (const ay of archivedYears) {
      result.push({ year: ay.year, teams: ay.teams, matches: ay.matches, teamScores: ay.teamScores, roundConfigs: ay.roundConfigs })
    }
    result.push({ year: liveYear, teams: liveTeams, matches, teamScores, roundConfigs })
    return result.sort((a, b) => a.year - b.year)
  }, [archivedYears, liveTeams, liveYear, matches, teamScores, roundConfigs])

  // Build dynamic roster from all bundles — handles subs, permanent replacements, historical roster changes
  const { resolvedTeamGroups, resolvedPlayerColors, historicalPlayerMap } = useMemo(() => {
    // Map: player ID → actual name (never originalName — subs played under their own name)
    const nameMap = new Map<string, string>()
    for (const bundle of bundles) {
      for (const team of bundle.teams) {
        for (const player of team.players) {
          if (!nameMap.has(player.id)) nameMap.set(player.id, player.name)
        }
      }
    }

    // Start with base groups, extend with any extra IDs found in bundles
    const extGroups: RosterGroup[] = BASE_TEAM_GROUPS.map(g => ({ ...g, ids: [...g.ids], teamId: '' }))
    const extColors: Record<string, string> = { ...BASE_PLAYER_COLORS }
    const extraCountByTeam = [0, 0, 0]

    for (const [id] of nameMap) {
      const inBase = extGroups.findIndex(g => g.ids.includes(id))
      if (inBase !== -1) continue // already in base roster

      // Find which team this player belongs to across all bundles
      let foundTeamIdx = -1
      outer: for (const bundle of bundles) {
        for (const team of bundle.teams) {
          if (team.players.some(p => p.id === id)) {
            foundTeamIdx = BASE_TEAM_GROUPS.findIndex(g => g.label === team.name)
            break outer
          }
        }
      }
      if (foundTeamIdx === -1) continue
      extGroups[foundTeamIdx].ids.push(id)
      const shades = TEAM_EXTRA_SHADES[BASE_TEAM_GROUPS[foundTeamIdx].color] ?? []
      extColors[id] = shades[extraCountByTeam[foundTeamIdx] % Math.max(1, shades.length)] ?? BASE_TEAM_GROUPS[foundTeamIdx].color
      extraCountByTeam[foundTeamIdx]++
    }

    // Resolve teamId from live teams by name match
    extGroups.forEach(g => {
      g.teamId = liveTeams.find(t => t.name === g.label)?.id ?? ''
    })

    return { resolvedTeamGroups: extGroups, resolvedPlayerColors: extColors, historicalPlayerMap: nameMap }
  }, [bundles, liveTeams])

  const playerName = useCallback((id: string): string => historicalPlayerMap.get(id) ?? id, [historicalPlayerMap])

  const hasMatchData = bundles.some(b => b.matches.some(m => Object.values(m.scores).some(hs => Object.values(hs).some(s => s != null))))

  // Pre-compute all analytics
  const scoring    = useMemo(() => computeScoringProfiles(bundles, courses, courseHistoryTyped), [bundles, courses, courseHistoryTyped])
  const h2h        = useMemo(() => computeH2H(bundles, courses, courseHistoryTyped), [bundles, courses, courseHistoryTyped])
  const partners   = useMemo(() => computePartnerRecords(bundles, courses, courseHistoryTyped), [bundles, courses, courseHistoryTyped])
  const teamRes    = useMemo(() => computeTeamResults(bundles), [bundles])
  const formatStat = useMemo(() => computeFormatStats(bundles), [bundles])
  const courseStat = useMemo(() => computeCourseStats(bundles, courses, courseHistoryTyped), [bundles, courses, courseHistoryTyped])
  const records    = useMemo(() => computeRecords(bundles, playerName, courses, courseHistoryTyped), [bundles, playerName, courses, courseHistoryTyped])
  const pfmt       = useMemo(() => computePlayerFormatStats(bundles, courses, courseHistoryTyped), [bundles, courses, courseHistoryTyped])

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'team',    label: 'Team Results',     icon: Trophy },
    { id: 'scoring', label: 'Player Scoring',   icon: BarChart2 },
    { id: 'h2h',     label: 'Head-to-Head',     icon: Crosshair },
    { id: 'format',  label: 'Format Stats',     icon: Star },
    { id: 'course',  label: 'Course Stats',     icon: BookOpen },
    { id: 'hdcp',    label: 'HDCP Trends',      icon: TrendingUp },
    { id: 'records', label: 'Records',          icon: Users },
    { id: 'ctp',     label: 'Par 3 CTP',        icon: Flag },
  ]

  return (
    <RosterContext.Provider value={{ teamGroups: resolvedTeamGroups, playerColors: resolvedPlayerColors, playerName }}>
      <div className="space-y-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Analytics</h1>
          {!hasMatchData && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Hole-score data not yet available — finalize a year to unlock scoring analytics
            </span>
          )}
        </div>

        {/* Tab bar — sticky below the measured site header */}
        <div className="sticky z-10 -mx-4 px-4 bg-masters-cream border-b border-gray-200 flex flex-wrap gap-1 pt-1 pb-2"
             style={{ top: stickyTop }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-semibold transition-colors ${
                activeTab === id
                  ? 'bg-masters-green text-white'
                  : 'text-gray-500 hover:text-masters-dark hover:bg-masters-light'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'team'    && <TeamResults    teamRes={teamRes} formatStat={formatStat} bundles={bundles} />}
        {activeTab === 'scoring' && <PlayerScoring  scoring={scoring} />}
        {activeTab === 'h2h'     && <HeadToHead     h2h={h2h} partners={partners} />}
        {activeTab === 'format'  && <FormatStats    pfmt={pfmt} formatStat={formatStat} />}
        {activeTab === 'course'  && <CourseStatsTab courseStat={courseStat} />}
        {activeTab === 'hdcp'    && <HdcpTrends     liveTeams={liveTeams} archivedYears={archivedYears} liveYear={liveYear} />}
        {activeTab === 'records' && <RecordsTab     records={records} />}
        {activeTab === 'ctp'     && <CtpAnalyticsTab ctpEntries={ctpEntries} ctpDonations={ctpDonations} scoring={scoring} />}
      </div>
    </RosterContext.Provider>
  )
}

// ─── Team Results tab ─────────────────────────────────────────────────────────

function TeamResults({ teamRes, formatStat, bundles }: {
  teamRes: ReturnType<typeof computeTeamResults>
  formatStat: ReturnType<typeof computeFormatStats>
  bundles: YearBundle[]
}) {
  const { teamGroups } = useContext(RosterContext)
  const allYears = [...new Set(bundles.map(b => b.year))].sort()

  return (
    <div className="space-y-6">
      {/* Championship tally */}
      <div className="grid grid-cols-3 gap-4">
        {teamGroups.map(grp => {
          const results = teamRes[grp.teamId] ?? []
          const champs  = results.filter(r => r.isChampion).length
          const wins1st = results.filter(r => r.finish === 1).length
          const years   = results.length
          return (
            <div key={grp.label} className="card text-center">
              <div className="text-3xl font-serif font-bold" style={{ color: grp.color }}>{champs}</div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Championships</div>
              <div className="font-semibold text-masters-dark mt-2" style={{ color: grp.color }}>{grp.label}</div>
              <div className="text-xs text-gray-400 mt-1">{wins1st} 1st-place finish{wins1st !== 1 ? 'es' : ''} in {years} year{years !== 1 ? 's' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* Year-by-year finish table */}
      <div className="card">
        <h2 className="section-header">Year-by-Year Finish</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-masters-light">
                <th className="border p-2 text-left">Team</th>
                {allYears.map(y => <th key={y} className="border p-2 text-center">{y}</th>)}
                <th className="border p-2 text-center">Total Pts</th>
                <th className="border p-2 text-center">Best</th>
              </tr>
            </thead>
            <tbody>
              {teamGroups.map(grp => {
                const results = teamRes[grp.teamId] ?? []
                const byYear = Object.fromEntries(results.map(r => [r.year, r]))
                const totalAll = results.reduce((s, r) => s + r.totalPoints, 0)
                const best = results.length ? Math.max(...results.map(r => r.totalPoints)) : null
                return (
                  <tr key={grp.label} className="hover:bg-gray-50">
                    <td className="border p-2 font-semibold" style={{ color: grp.color }}>{grp.label}</td>
                    {allYears.map(y => {
                      const r = byYear[y]
                      const medal = r?.isChampion ? '🏆' : r?.finish === 2 ? '🥈' : r?.finish === 3 ? '🥉' : ''
                      return (
                        <td key={y} className="border p-2 text-center">
                          {r ? (
                            <div>
                              <span>{medal} {r.totalPoints}pts</span>
                            </div>
                          ) : '—'}
                        </td>
                      )
                    })}
                    <td className="border p-2 text-center font-bold">{totalAll}</td>
                    <td className="border p-2 text-center font-semibold text-masters-green">{best ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Points trend chart */}
      {allYears.length > 1 && (
        <div className="card">
          <h2 className="section-header">Points Per Year</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" type="number" domain={[allYears[0], allYears[allYears.length - 1]]} ticks={allYears} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {teamGroups.map(grp => {
                const results = teamRes[grp.teamId] ?? []
                const data = results.map(r => ({ year: r.year, points: r.totalPoints }))
                return (
                  <Line key={grp.label} data={data} type="monotone" dataKey="points" name={grp.label}
                    stroke={grp.color} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Format dominance */}
      <div className="card">
        <h2 className="section-header">Points by Format</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-masters-light">
                <th className="border p-2 text-left">Team</th>
                {Object.keys(FORMAT_LABELS).map(f => (
                  <th key={f} className="border p-2 text-center">{FORMAT_LABELS[f]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamGroups.map(grp => {
                const fmts = formatStat[grp.teamId] ?? {}
                return (
                  <tr key={grp.label} className="hover:bg-gray-50">
                    <td className="border p-2 font-semibold" style={{ color: grp.color }}>{grp.label}</td>
                    {Object.keys(FORMAT_LABELS).map(f => {
                      const s = fmts[f as RndFormat]
                      return (
                        <td key={f} className="border p-2 text-center">
                          {s ? <span>{s.points}pts<br /><span className="text-gray-400">{s.wins}W-{s.losses}L</span></span> : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round-by-round points per year */}
      {allYears.length > 0 && (
        <div className="card">
          <h2 className="section-header">Points by Round — All Years</h2>
          {allYears.map(year => {
            const yearBundle = bundles.find(b => b.year === year)
            if (!yearBundle?.teamScores.length) return null
            const rounds = [...new Set(yearBundle.teamScores.map(ts => ts.round))].sort()
            return (
              <div key={year} className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{year}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-masters-light">
                        <th className="border p-1.5 text-left">Team</th>
                        {rounds.map(r => <th key={r} className="border p-1.5 text-center">R{r}</th>)}
                        <th className="border p-1.5 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamGroups.map(grp => {
                        const team = yearBundle.teams.find(t => t.name === grp.label)
                        if (!team) return null
                        const byRound: Record<number, number> = {}
                        yearBundle.teamScores.filter(ts => ts.teamId === team.id).forEach(ts => { byRound[ts.round] = ts.points })
                        const total = Object.values(byRound).reduce((s, v) => s + v, 0)
                        return (
                          <tr key={grp.label} className="hover:bg-gray-50">
                            <td className="border p-1.5 font-semibold" style={{ color: grp.color }}>{grp.label}</td>
                            {rounds.map(r => <td key={r} className="border p-1.5 text-center">{byRound[r] ?? '—'}</td>)}
                            <td className="border p-1.5 text-center font-bold">{total}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Player Scoring tab ───────────────────────────────────────────────────────

function PlayerScoring({ scoring }: {
  scoring: ReturnType<typeof computeScoringProfiles>
}) {
  const { teamGroups, playerColors, playerName } = useContext(RosterContext)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  const allIds = teamGroups.flatMap(g => g.ids)
  const withData = allIds.filter(id => (scoring[id]?.dist.total ?? 0) > 0)

  if (withData.length === 0) {
    return <EmptyState msg="Scoring data will appear after match scores are entered and the year is finalized." />
  }

  // Distribution bar chart data (stacked % per player)
  const barData = withData.map(id => {
    const d = scoring[id].dist
    const t = d.total || 1
    return {
      name: playerName(id).split(' ')[0],
      Eagle: +((d.eagle / t) * 100).toFixed(1),
      Birdie: +((d.birdie / t) * 100).toFixed(1),
      Par: +((d.par / t) * 100).toFixed(1),
      Bogey: +((d.bogey / t) * 100).toFixed(1),
      Double: +((d.double / t) * 100).toFixed(1),
      Worse: +((d.worse / t) * 100).toFixed(1),
    }
  })

  return (
    <div className="space-y-6">
      {/* Stacked bar: scoring distribution */}
      <div className="card">
        <h2 className="section-header">Scoring Distribution (% of Holes)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis unit="%" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: unknown) => `${Number(v)}%`} />
            <Legend />
            {Object.entries(SCORE_COLORS).map(([k, col]) => (
              <Bar key={k} dataKey={k.charAt(0).toUpperCase() + k.slice(1)} stackId="a" fill={col} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Par-type averages table */}
      <div className="card">
        <h2 className="section-header">Scoring Averages by Par Type</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-masters-light">
                <th className="border p-2 text-left">Player</th>
                <th className="border p-2 text-center">Par 3 Avg</th>
                <th className="border p-2 text-center">Par 4 Avg</th>
                <th className="border p-2 text-center">Par 5 Avg</th>
                <th className="border p-2 text-center">Front 9 Avg</th>
                <th className="border p-2 text-center">Back 9 Avg</th>
                <th className="border p-2 text-center">Holes</th>
                <th className="border p-2 text-center">Birdie%</th>
                <th className="border p-2 text-center">Par%</th>
                <th className="border p-2 text-center">Bogey+%</th>
              </tr>
            </thead>
            <tbody>
              {teamGroups.flatMap(grp =>
                grp.ids.filter(id => scoring[id]?.dist.total > 0).map(id => {
                  const p = scoring[id]
                  const d = p.dist
                  const t = d.total || 1
                  const avg3 = p.par3.holes > 0 ? p.par3.totalScore / p.par3.holes : null
                  const avg4 = p.par4.holes > 0 ? p.par4.totalScore / p.par4.holes : null
                  const avg5 = p.par5.holes > 0 ? p.par5.totalScore / p.par5.holes : null
                  const avgF = p.front.holes > 0 ? p.front.totalScore / p.front.holes : null
                  const avgB = p.back.holes  > 0 ? p.back.totalScore  / p.back.holes  : null
                  const birdiePct = ((d.eagle + d.birdie) / t * 100).toFixed(0)
                  const parPct    = (d.par / t * 100).toFixed(0)
                  const bogeyPct  = ((d.bogey + d.double + d.worse) / t * 100).toFixed(0)
                  return (
                    <tr
                      key={id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedPlayer === id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedPlayer(selectedPlayer === id ? null : id)}
                    >
                      <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                      <td className="border p-2 text-center">{avg3?.toFixed(2) ?? '—'}</td>
                      <td className="border p-2 text-center">{avg4?.toFixed(2) ?? '—'}</td>
                      <td className="border p-2 text-center">{avg5?.toFixed(2) ?? '—'}</td>
                      <td className="border p-2 text-center">{avgF?.toFixed(2) ?? '—'}</td>
                      <td className="border p-2 text-center">{avgB?.toFixed(2) ?? '—'}</td>
                      <td className="border p-2 text-center text-gray-500">{d.total}</td>
                      <td className="border p-2 text-center text-masters-green font-semibold">{birdiePct}%</td>
                      <td className="border p-2 text-center text-blue-500">{parPct}%</td>
                      <td className="border p-2 text-center text-red-500">{bogeyPct}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">Click a player row to see their scoring trend below.</p>
      </div>

      {/* Player spotlight — round-by-round gross */}
      {selectedPlayer && scoring[selectedPlayer] && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header mb-0" style={{ color: playerColors[selectedPlayer] }}>
              {playerName(selectedPlayer)} — Round Scores
            </h3>
            <button className="text-xs text-gray-400 hover:text-masters-green" onClick={() => setSelectedPlayer(null)}>Close ✕</button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Distribution detail */}
            {(() => {
              const d = scoring[selectedPlayer].dist
              return (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hole Breakdown ({d.total} holes)</p>
                  {[
                    { label: 'Eagle or better', val: d.eagle, color: SCORE_COLORS.eagle },
                    { label: 'Birdie',          val: d.birdie, color: SCORE_COLORS.birdie },
                    { label: 'Par',             val: d.par,    color: SCORE_COLORS.par },
                    { label: 'Bogey',           val: d.bogey,  color: SCORE_COLORS.bogey },
                    { label: 'Double Bogey',    val: d.double, color: SCORE_COLORS.double },
                    { label: 'Worse',           val: d.worse,  color: SCORE_COLORS.worse },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs mb-1">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
                      <span className="w-32 text-gray-600">{label}</span>
                      <div className="flex-1 bg-gray-100 rounded h-2">
                        <div className="h-2 rounded" style={{ width: `${(val / (d.total || 1)) * 100}%`, background: color }} />
                      </div>
                      <span className="w-16 text-right font-semibold">{val} ({((val / (d.total || 1)) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            {/* Round scores chart */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Round Gross Scores</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={scoring[selectedPlayer].roundScores.map(r => ({
                  name: `${r.year} R${FORMAT_LABELS[r.format]?.[0] ?? '?'}`,
                  gross: r.gross,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Bar dataKey="gross" fill={playerColors[selectedPlayer]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Radar comparison */}
      {withData.length >= 3 && (
        <div className="card">
          <h2 className="section-header">Birdie Rate Radar</h2>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={[
              { stat: 'Eagle%',  ...Object.fromEntries(withData.map(id => [playerName(id).split(' ')[0], +((scoring[id].dist.eagle / (scoring[id].dist.total || 1)) * 100).toFixed(1)])) },
              { stat: 'Birdie%', ...Object.fromEntries(withData.map(id => [playerName(id).split(' ')[0], +((scoring[id].dist.birdie / (scoring[id].dist.total || 1)) * 100).toFixed(1)])) },
              { stat: 'Par%',    ...Object.fromEntries(withData.map(id => [playerName(id).split(' ')[0], +((scoring[id].dist.par / (scoring[id].dist.total || 1)) * 100).toFixed(1)])) },
              { stat: 'Bogey%',  ...Object.fromEntries(withData.map(id => [playerName(id).split(' ')[0], +((scoring[id].dist.bogey / (scoring[id].dist.total || 1)) * 100).toFixed(1)])) },
              { stat: 'Dbl+%',   ...Object.fromEntries(withData.map(id => [playerName(id).split(' ')[0], +(((scoring[id].dist.double + scoring[id].dist.worse) / (scoring[id].dist.total || 1)) * 100).toFixed(1)])) },
            ]}>
              <PolarGrid />
              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 9 }} />
              {withData.slice(0, 6).map(id => (
                <Radar key={id} name={playerName(id).split(' ')[0]} dataKey={playerName(id).split(' ')[0]}
                  stroke={playerColors[id]} fill={playerColors[id]} fillOpacity={0.1} />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Head-to-Head tab ─────────────────────────────────────────────────────────

function HeadToHead({ h2h, partners }: {
  h2h: ReturnType<typeof computeH2H>
  partners: ReturnType<typeof computePartnerRecords>
}) {
  const { teamGroups, playerColors, playerName } = useContext(RosterContext)
  const allIds = teamGroups.flatMap(g => g.ids)
  const [p1, setP1] = useState(allIds[0])
  const [p2, setP2] = useState(allIds[4])

  const rec12 = h2h[p1]?.[p2] ?? { wins: 0, losses: 0, halves: 0, matchesPlayed: 0, byFormat: {} }
  const hasH2H = rec12.matchesPlayed > 0

  return (
    <div className="space-y-6">
      {/* Player selector */}
      <div className="card">
        <h2 className="section-header">1-on-1 Record</h2>
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <select className="input py-1" value={p1} onChange={e => setP1(e.target.value)}>
            {teamGroups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.ids.map(id => <option key={id} value={id}>{playerName(id)}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="font-bold text-masters-dark text-lg">vs</span>
          <select className="input py-1" value={p2} onChange={e => setP2(e.target.value)}>
            {teamGroups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.ids.map(id => <option key={id} value={id}>{playerName(id)}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {hasH2H ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-bold gap-2">
              <span style={{ color: playerColors[p1] }}>{playerName(p1)}</span>
              <span className="text-2xl font-serif text-masters-dark">
                {rec12.wins} – {rec12.halves} – {rec12.losses}
              </span>
              <span style={{ color: playerColors[p2] }}>{playerName(p2)}</span>
            </div>
            <p className="text-xs text-center text-gray-400">{rec12.matchesPlayed} match{rec12.matchesPlayed !== 1 ? 'es' : ''} · W-H-L from {playerName(p1)}'s perspective</p>

            {Object.entries(rec12.byFormat).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse mt-2">
                  <thead><tr className="bg-masters-light">
                    <th className="border p-1.5 text-left">Format</th>
                    <th className="border p-1.5 text-center">W</th>
                    <th className="border p-1.5 text-center">H</th>
                    <th className="border p-1.5 text-center">L</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(rec12.byFormat).map(([fmt, r]) => (
                      <tr key={fmt} className="hover:bg-gray-50">
                        <td className="border p-1.5">{FORMAT_LABELS[fmt] ?? fmt}</td>
                        <td className="border p-1.5 text-center font-semibold text-masters-green">{r.wins}</td>
                        <td className="border p-1.5 text-center text-gray-500">{r.halves}</td>
                        <td className="border p-1.5 text-center font-semibold text-red-500">{r.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No completed matches found between these two players.</p>
        )}
      </div>

      {/* Full H2H matrix */}
      {Object.keys(h2h).length > 0 && (
        <div className="card">
          <h2 className="section-header">All-Play Record Matrix <span className="text-xs font-normal text-gray-400">(W-L from row player's view)</span></h2>
          <div className="overflow-x-auto">
            <table className="text-[10px] border-collapse">
              <thead>
                <tr className="bg-masters-light">
                  <th className="border p-1.5 text-left min-w-24">vs →</th>
                  {allIds.map(id => (
                    <th key={id} className="border p-1 text-center" style={{ color: playerColors[id] }}>
                      {playerName(id).split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allIds.map(rowId => (
                  <tr key={rowId} className="hover:bg-gray-50">
                    <td className="border p-1.5 font-semibold" style={{ color: playerColors[rowId] }}>
                      {playerName(rowId).split(' ')[0]}
                    </td>
                    {allIds.map(colId => {
                      if (rowId === colId) return <td key={colId} className="border p-1 text-center bg-gray-100">—</td>
                      const r = h2h[rowId]?.[colId]
                      if (!r || r.matchesPlayed === 0) return <td key={colId} className="border p-1 text-center text-gray-300">·</td>
                      const pct = r.matchesPlayed > 0 ? ((r.wins + r.halves * 0.5) / r.matchesPlayed * 100).toFixed(0) : '—'
                      const bg = r.wins > r.losses ? '#f0fdf4' : r.losses > r.wins ? '#fef2f2' : '#fefce8'
                      return (
                        <td key={colId} className="border p-1 text-center" style={{ background: bg }}>
                          <div>{r.wins}-{r.losses}</div>
                          <div className="text-gray-400">{pct}%</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partnership records */}
      {Object.keys(partners).length > 0 && (
        <div className="card">
          <h2 className="section-header">Partnership Records <span className="text-xs font-normal text-gray-400">(best-ball twosome results)</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-masters-light">
                <th className="border p-2 text-left">Player</th>
                <th className="border p-2 text-left">Partner</th>
                <th className="border p-2 text-center">W</th>
                <th className="border p-2 text-center">T</th>
                <th className="border p-2 text-center">L</th>
                <th className="border p-2 text-center">Matches</th>
                <th className="border p-2 text-center">Win%</th>
              </tr></thead>
              <tbody>
                {allIds.flatMap(id => {
                  const recs = partners[id]
                  if (!recs) return []
                  return Object.values(recs)
                    .filter(r => r.matches > 0)
                    .sort((a, b) => b.wins - a.wins)
                    .map(r => (
                      <tr key={`${id}-${r.partnerId}`} className="hover:bg-gray-50">
                        <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                        <td className="border p-2" style={{ color: playerColors[r.partnerId] }}>{playerName(r.partnerId)}</td>
                        <td className="border p-2 text-center font-semibold text-masters-green">{r.wins}</td>
                        <td className="border p-2 text-center text-gray-500">{r.ties}</td>
                        <td className="border p-2 text-center font-semibold text-red-500">{r.losses}</td>
                        <td className="border p-2 text-center text-gray-400">{r.matches}</td>
                        <td className="border p-2 text-center font-semibold">
                          {r.matches > 0 ? ((r.wins + r.ties * 0.5) / r.matches * 100).toFixed(0) + '%' : '—'}
                        </td>
                      </tr>
                    ))
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasH2H && Object.keys(h2h).length === 0 && (
        <EmptyState msg="Head-to-head data will appear once match scores have been computed from completed rounds." />
      )}
    </div>
  )
}

// ─── Format Stats tab ─────────────────────────────────────────────────────────

function FormatStats({ pfmt, formatStat }: {
  pfmt: ReturnType<typeof computePlayerFormatStats>
  formatStat: ReturnType<typeof computeFormatStats>
}) {
  const { teamGroups, playerColors, playerName } = useContext(RosterContext)
  const allIds = teamGroups.flatMap(g => g.ids)
  const withData = allIds.filter(id => pfmt[id])

  if (withData.length === 0) {
    return <EmptyState msg="Format stats will appear once match scores have been computed." />
  }

  return (
    <div className="space-y-6">
      {/* Match Play record per player */}
      <div className="card">
        <h2 className="section-header">Match Play Records (R1 Best-Ball + R4 Individual)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2 text-left">Player</th>
              <th className="border p-2 text-center" colSpan={3}>Overall Match Play</th>
              <th className="border p-2 text-center" colSpan={3}>Individual (R4 only)</th>
              <th className="border p-2 text-center">Best Quota</th>
              <th className="border p-2 text-center">Scramble Avg</th>
            </tr>
            <tr className="bg-masters-light">
              <th className="border p-1" />
              <th className="border p-1 text-center text-masters-green">W</th>
              <th className="border p-1 text-center text-gray-500">H</th>
              <th className="border p-1 text-center text-red-500">L</th>
              <th className="border p-1 text-center text-masters-green">W</th>
              <th className="border p-1 text-center text-gray-500">H</th>
              <th className="border p-1 text-center text-red-500">L</th>
              <th className="border p-1" />
              <th className="border p-1" />
            </tr></thead>
            <tbody>
              {teamGroups.flatMap(grp =>
                grp.ids.filter(id => pfmt[id]).map(id => {
                  const s = pfmt[id]
                  const mp = s.matchPlayRecord
                  const iv = s.indivRecord
                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">{mp.wins}</td>
                      <td className="border p-2 text-center text-gray-500">{mp.halves}</td>
                      <td className="border p-2 text-center font-semibold text-red-500">{mp.losses}</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">{iv.wins}</td>
                      <td className="border p-2 text-center text-gray-500">{iv.halves}</td>
                      <td className="border p-2 text-center font-semibold text-red-500">{iv.losses}</td>
                      <td className="border p-2 text-center">{s.bestQuotaDiff !== null ? (s.bestQuotaDiff >= 0 ? '+' : '') + s.bestQuotaDiff : '—'}</td>
                      <td className="border p-2 text-center">{s.scrambleAvg !== null ? s.scrambleAvg.toFixed(1) : '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ryder Cup style team format record */}
      <div className="card">
        <h2 className="section-header">Ryder Cup — Team Format Record</h2>
        <p className="text-xs text-gray-500 mb-3">Aggregate match play results across all years, by format</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2 text-left">Team</th>
              <th className="border p-2 text-center">Team Match Play</th>
              <th className="border p-2 text-center">Individual Match</th>
              <th className="border p-2 text-center">Points Round</th>
              <th className="border p-2 text-center">Scramble</th>
              <th className="border p-2 text-center">Captain's Choice</th>
            </tr></thead>
            <tbody>
              {teamGroups.map(grp => {
                const fmts = formatStat[grp.teamId] ?? {}
                const fmtKeys: RndFormat[] = ['team_match_play', 'individual_match', 'points_round', 'texas_scramble', 'captains_choice']
                return (
                  <tr key={grp.label} className="hover:bg-gray-50">
                    <td className="border p-2 font-semibold" style={{ color: grp.color }}>{grp.label}</td>
                    {fmtKeys.map(f => {
                      const s = fmts[f]
                      if (!s || s.matches === 0) return <td key={f} className="border p-2 text-center text-gray-300">—</td>
                      const pct = ((s.wins + s.ties * 0.5) / s.matches * 100).toFixed(0)
                      const bg  = s.wins > s.losses ? '#f0fdf4' : s.losses > s.wins ? '#fef2f2' : undefined
                      return (
                        <td key={f} className="border p-2 text-center" style={bg ? { background: bg } : {}}>
                          <div className="font-semibold">{s.wins}W-{s.losses}L</div>
                          <div className="text-gray-400">{pct}% · {s.points}pts</div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Course Stats tab ─────────────────────────────────────────────────────────

function CourseStatsTab({ courseStat }: { courseStat: ReturnType<typeof computeCourseStats> }) {
  const [selectedCourse, setSelectedCourse] = useState(0)

  if (courseStat.length === 0) {
    return <EmptyState msg="Course statistics will appear once hole scores have been entered." />
  }

  const ca = courseStat[selectedCourse]
  const maxAvgVsPar = Math.max(...ca.holes.map(h => h.avgVsPar))
  const minAvgVsPar = Math.min(...ca.holes.map(h => h.avgVsPar))

  function holeColor(vp: number) {
    if (vp <= -0.1) return '#22c55e'   // under par — green
    if (vp <=  0.1) return '#60a5fa'   // near par — blue
    if (vp <=  0.5) return '#f97316'   // bogey range — orange
    if (vp <=  1.0) return '#ef4444'   // tough — red
    return '#7f1d1d'                   // very hard — dark red
  }

  const barData = ca.holes.map(h => ({
    hole: `H${h.holeNumber}`,
    avgVsPar: +h.avgVsPar.toFixed(2),
    par: h.par,
  }))

  return (
    <div className="space-y-6">
      {courseStat.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {courseStat.map((c, i) => (
            <button key={c.courseId} onClick={() => setSelectedCourse(i)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                selectedCourse === i ? 'bg-masters-green text-white' : 'bg-masters-light text-masters-dark hover:bg-masters-green/20'
              }`}>
              {c.courseName}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="section-header">{ca.courseName} — Average Score vs Par</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hole" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: unknown) => { const n = Number(v); return n >= 0 ? `+${n}` : `${n}` }} />
            <ReferenceLine y={0} stroke="#6b7280" />
            <Tooltip formatter={(v: unknown) => { const n = Number(v); return [n >= 0 ? `+${n}` : String(n), 'Avg vs Par'] }} />
            <Bar dataKey="avgVsPar" name="Avg vs Par">
              {barData.map((entry, idx) => (
                <Cell key={idx} fill={holeColor(entry.avgVsPar)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-3 justify-center mt-1 flex-wrap text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#22c55e' }} />Under par</span>
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#60a5fa' }} />Near par</span>
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#f97316' }} />+0.1 to +0.5</span>
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#ef4444' }} />+0.5 to +1.0</span>
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#7f1d1d' }} />+1.0+</span>
        </div>
      </div>

      {/* Hole detail table */}
      <div className="card">
        <h2 className="section-header">Hole-by-Hole Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2">Hole</th>
              <th className="border p-2">Par</th>
              <th className="border p-2">HDCP</th>
              <th className="border p-2">Samples</th>
              <th className="border p-2">Avg</th>
              <th className="border p-2">vs Par</th>
              <th className="border p-2 text-[10px]" style={{ color: SCORE_COLORS.eagle }}>Eagle</th>
              <th className="border p-2 text-[10px]" style={{ color: SCORE_COLORS.birdie }}>Birdie</th>
              <th className="border p-2 text-[10px]" style={{ color: SCORE_COLORS.par }}>Par</th>
              <th className="border p-2 text-[10px]" style={{ color: SCORE_COLORS.bogey }}>Bogey</th>
              <th className="border p-2 text-[10px]" style={{ color: SCORE_COLORS.double }}>Dbl+</th>
            </tr></thead>
            <tbody>
              {ca.holes.map(h => {
                const t = h.samples || 1
                const dblWorse = h.double + h.worse
                return (
                  <tr key={h.holeNumber} className="hover:bg-gray-50">
                    <td className="border p-2 text-center font-bold">{h.holeNumber}</td>
                    <td className="border p-2 text-center">{h.par}</td>
                    <td className="border p-2 text-center text-gray-400">{h.hdcpOrder}</td>
                    <td className="border p-2 text-center text-gray-400">{h.samples}</td>
                    <td className="border p-2 text-center font-semibold">{h.samples > 0 ? h.avgScore.toFixed(2) : '—'}</td>
                    <td className="border p-2 text-center font-semibold" style={{ color: holeColor(h.avgVsPar) }}>
                      {h.samples > 0 ? (h.avgVsPar >= 0 ? '+' : '') + h.avgVsPar.toFixed(2) : '—'}
                    </td>
                    <td className="border p-2 text-center">{h.eagle > 0 ? `${h.eagle} (${(h.eagle/t*100).toFixed(0)}%)` : '—'}</td>
                    <td className="border p-2 text-center">{h.birdie} ({(h.birdie/t*100).toFixed(0)}%)</td>
                    <td className="border p-2 text-center">{h.parCount} ({(h.parCount/t*100).toFixed(0)}%)</td>
                    <td className="border p-2 text-center">{h.bogey} ({(h.bogey/t*100).toFixed(0)}%)</td>
                    <td className="border p-2 text-center">{dblWorse > 0 ? `${dblWorse} (${(dblWorse/t*100).toFixed(0)}%)` : '—'}</td>
                  </tr>
                )
              })}
              {/* Summary row */}
              <tr className="font-bold bg-masters-light">
                <td className="border p-2 text-center" colSpan={3}>Total</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.samples, 0)}</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.avgScore, 0).toFixed(1)}</td>
                <td className="border p-2 text-center" style={{ color: holeColor((maxAvgVsPar + minAvgVsPar) / 2) }}>
                  {(ca.holes.reduce((s, h) => s + h.avgVsPar, 0)).toFixed(1)} vs par
                </td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.eagle, 0)}</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.birdie, 0)}</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.parCount, 0)}</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.bogey, 0)}</td>
                <td className="border p-2 text-center">{ca.holes.reduce((s, h) => s + h.double + h.worse, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── HDCP Trends tab (carried from original Stats.tsx) ────────────────────────

function HdcpTrends({ liveTeams, archivedYears, liveYear }: {
  liveTeams: Team[]
  archivedYears: ArchivedYear[]
  liveYear: number
}) {
  const { teamGroups, playerColors, playerName } = useContext(RosterContext)
  const allIds = teamGroups.flatMap(g => g.ids)
  const [visible, setVisible] = useState<Set<string>>(new Set(allIds))
  const [spotlight, setSpotlight] = useState<string | null>(null)

  const { allYears, allHistory, chartData } = useMemo(() => {
    const staticYearSet = new Set(HDCP_YEARS)
    const years = [...HDCP_YEARS]
    const history: Record<string, (number | null)[]> = {}
    allIds.forEach(id => { history[id] = [...(PLAYER_HDCP_HISTORY[id] ?? new Array(HDCP_YEARS.length).fill(null))] })

    const newArchived = [...archivedYears]
      .filter(a => !staticYearSet.has(a.year))
      .sort((a, b) => a.year - b.year)

    for (const archived of newArchived) {
      years.push(archived.year)
      const players = archived.teams.flatMap(t => t.players)
      for (const id of allIds) {
        const p = players.find(p => p.id === id)
        history[id].push(!p || p.isSubstitute ? null : p.handicapIndex)
      }
    }

    const covered = new Set([...HDCP_YEARS, ...newArchived.map(a => a.year)])
    if (!covered.has(liveYear)) {
      years.push(liveYear)
      const players = liveTeams.flatMap(t => t.players)
      for (const id of allIds) {
        const p = players.find(p => p.id === id)
        history[id].push(!p || p.isSubstitute ? null : p.handicapIndex)
      }
    }

    const data = years.map((year, i) => {
      const row: Record<string, number | string | null> = { year }
      for (const id of allIds) row[id] = history[id][i] ?? null
      return row
    })

    return { allYears: years, allHistory: history, chartData: data }
  }, [archivedYears, liveTeams, liveYear])

  const [yearFrom, setYearFrom] = useState(allYears[0])
  const [yearTo,   setYearTo]   = useState(allYears[allYears.length - 1])
  const filtered = chartData.filter(d => (d.year as number) >= yearFrom && (d.year as number) <= yearTo)

  const latestYear = allYears[allYears.length - 1]
  const prevYear   = allYears[allYears.length - 2]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">From</label>
          <select className="input py-1 w-20" value={yearFrom} onChange={e => setYearFrom(+e.target.value)}>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="text-gray-500">To</label>
          <select className="input py-1 w-20" value={yearTo} onChange={e => setYearTo(+e.target.value)}>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Player toggles */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Show / Hide Players</p>
          <button className="text-xs text-masters-green hover:underline"
            onClick={() => setVisible(visible.size === allIds.length ? new Set() : new Set(allIds))}>
            {visible.size === allIds.length ? 'Hide all' : 'Show all'}
          </button>
        </div>
        <div className="space-y-2">
          {teamGroups.map(grp => (
            <div key={grp.label} className="flex flex-wrap gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-1 self-center">{grp.label}</span>
              {grp.ids.map(id => (
                <button key={id}
                  onClick={() => setVisible(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                  onDoubleClick={() => setSpotlight(spotlight === id ? null : id)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-all ${
                    visible.has(id) ? 'text-white border-transparent' : 'bg-white text-gray-400 border-gray-200'
                  }`}
                  style={visible.has(id) ? { background: playerColors[id], borderColor: playerColors[id] } : {}}
                >
                  {playerName(id)}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Double-click a player for their individual table.</p>
      </div>

      <div className="card">
        <h2 className="section-header">Handicap Index Over Time</h2>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={filtered} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 36]} ticks={[0, 5, 10, 15, 20, 25, 30, 35]} tick={{ fontSize: 11 }}
              label={{ value: 'Index', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }} />
            <Tooltip />
            <ReferenceLine y={18} stroke="#c9a84c" strokeDasharray="4 4"
              label={{ value: 'HI 18', fontSize: 10, fill: '#c9a84c' }} />
            {allIds.filter(id => visible.has(id)).map(id => (
              <Line key={id} type="monotone" dataKey={id} name={playerName(id)} stroke={playerColors[id]}
                strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {spotlight && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header mb-0" style={{ color: playerColors[spotlight] }}>
              {playerName(spotlight)} — Year-by-Year Index
            </h3>
            <button className="text-xs text-gray-400 hover:text-masters-green" onClick={() => setSpotlight(null)}>Close ✕</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-masters-light">
                {allYears.filter(y => y >= yearFrom && y <= yearTo && allHistory[spotlight][allYears.indexOf(y)] !== null).map(y => (
                  <th key={y} className="border p-1.5 text-center">{y}</th>
                ))}
              </tr></thead>
              <tbody><tr>
                {allYears.filter(y => y >= yearFrom && y <= yearTo).map(y => {
                  const v = allHistory[spotlight][allYears.indexOf(y)]
                  return v !== null ? <td key={y} className="border p-1.5 text-center font-mono">{v.toFixed(1)}</td> : null
                })}
              </tr></tbody>
            </table>
          </div>
        </div>
      )}

      {/* Career summary */}
      <div className="card">
        <h3 className="section-header">Career Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2 text-left">Player</th>
              <th className="border p-2 text-center">Team</th>
              <th className="border p-2 text-center">First Year</th>
              <th className="border p-2 text-center">Years</th>
              <th className="border p-2 text-center">All-Time Low</th>
              <th className="border p-2 text-center">All-Time High</th>
              <th className="border p-2 text-center">{latestYear} Index</th>
              <th className="border p-2 text-center">YoY</th>
            </tr></thead>
            <tbody>
              {teamGroups.flatMap(grp =>
                grp.ids.map(id => {
                  const vals = allHistory[id].filter((v): v is number => v !== null)
                  const entries = allHistory[id].map((v, i) => ({ year: allYears[i], v })).filter(e => e.v !== null) as { year: number; v: number }[]
                  const low  = vals.length ? Math.min(...vals) : null
                  const high = vals.length ? Math.max(...vals) : null
                  const cur  = entries[entries.length - 1]?.v ?? null
                  const prev = entries[entries.length - 2]?.v ?? null
                  const trend = cur !== null && prev !== null ? (cur < prev ? '↓' : cur > prev ? '↑' : '→') : '—'
                  const trendColor = trend === '↓' ? '#16a34a' : trend === '↑' ? '#dc2626' : '#6b7280'
                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                      <td className="border p-2 text-center text-gray-500">{grp.label}</td>
                      <td className="border p-2 text-center">{entries[0]?.year ?? '—'}</td>
                      <td className="border p-2 text-center">{vals.length}</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">{low?.toFixed(1) ?? '—'}</td>
                      <td className="border p-2 text-center font-semibold text-red-500">{high?.toFixed(1) ?? '—'}</td>
                      <td className="border p-2 text-center font-bold">{cur?.toFixed(1) ?? '—'}</td>
                      <td className="border p-2 text-center text-lg font-bold" style={{ color: trendColor }}>{trend}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">↓ = improving. Trend compares {latestYear} vs {prevYear}.</p>
      </div>
    </div>
  )
}

// ─── Records tab ──────────────────────────────────────────────────────────────

function RecordsTab({ records }: { records: ReturnType<typeof computeRecords> }) {
  const cats: { key: keyof typeof records; label: string; icon: string; desc: string }[] = [
    { key: 'lowestGross',     label: 'Lowest Gross Round',      icon: '🏌️', desc: 'Best 18-hole gross score' },
    { key: 'mostBirdies',     label: 'Most Birdies in a Round', icon: '🐦', desc: 'Most birdies in a single 18-hole round' },
    { key: 'mostEagles',      label: 'Most Eagles in a Round',  icon: '🦅', desc: 'Most eagles/better in a single round' },
    { key: 'biggestMatchWin', label: 'Biggest Match Play Win',  icon: '⚔️', desc: 'Largest hole margin in match play' },
    { key: 'bestQuotaBeat',   label: 'Best Quota Beat',         icon: '📊', desc: 'Most points above twosome quota in Points Round' },
    { key: 'mostParsFront',   label: 'Most Pars — Front Nine',  icon: '🎯', desc: 'Most par or better holes on the front 9' },
  ]

  const hasAny = cats.some(c => records[c.key] !== null)

  if (!hasAny) {
    return <EmptyState msg="Records will populate once match score data is available." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cats.map(({ key, label, icon, desc }) => {
          const rec = records[key]
          return (
            <div key={key} className="card">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-bold text-masters-dark text-sm">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              {rec ? (
                <div className="mt-2 border-t pt-2">
                  <div className="text-2xl font-serif font-bold text-masters-gold">{rec.value}</div>
                  <div className="text-sm font-semibold text-masters-dark mt-0.5">{rec.holder}</div>
                  <div className="text-xs text-gray-400">{rec.year}</div>
                  {rec.detail && <div className="text-xs text-gray-500 mt-1">{rec.detail}</div>}
                </div>
              ) : (
                <p className="text-xs text-gray-300 mt-2 border-t pt-2">No data yet</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="card">
        <h2 className="section-header">🏆 All-Time Records Summary</h2>
        <p className="text-xs text-gray-500">Records computed from all finalized tournament years with hole-by-hole score data.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2 text-left">Record</th>
              <th className="border p-2 text-center">Value</th>
              <th className="border p-2 text-left">Holder</th>
              <th className="border p-2 text-center">Year</th>
              <th className="border p-2 text-left">Detail</th>
            </tr></thead>
            <tbody>
              {cats.map(({ key, label, icon }) => {
                const rec = records[key]
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="border p-2">{icon} {label}</td>
                    <td className="border p-2 text-center font-bold text-masters-gold">{rec?.value ?? '—'}</td>
                    <td className="border p-2 font-semibold">{rec?.holder ?? '—'}</td>
                    <td className="border p-2 text-center text-gray-500">{rec?.year ?? '—'}</td>
                    <td className="border p-2 text-gray-400">{rec?.detail ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Par 3 CTP tab ───────────────────────────────────────────────────────────

function CtpAnalyticsTab({ ctpEntries, ctpDonations, scoring }: {
  ctpEntries: CtpEntry[]
  ctpDonations: CtpDonation[]
  scoring: ReturnType<typeof computeScoringProfiles>
}) {
  const { teamGroups, playerColors, playerName } = useContext(RosterContext)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')

  const years = [...new Set(ctpEntries.map(e => e.year))].sort()

  // Prize per hole per year: total paid donations ÷ number of CTP holes that year
  const yearPrize: Record<number, number> = {}
  for (const yr of years) {
    const paid = ctpDonations.filter(d => d.year === yr && d.paid).reduce((s, d) => s + d.amount, 0)
    const holes = ctpEntries.filter(e => e.year === yr).length
    yearPrize[yr] = holes > 0 ? paid / holes : 0
  }

  const filtered = selectedYear === 'all'
    ? [...ctpEntries].sort((a, b) => b.year - a.year || a.round - b.round || a.hole - b.hole)
    : ctpEntries.filter(e => e.year === selectedYear).sort((a, b) => a.round - b.round || a.hole - b.hole)

  // Leaderboard — keyed by winnerName string (CTP stores names, not IDs)
  const winMap: Record<string, { count: number; earnings: number; holes: string[] }> = {}
  for (const e of ctpEntries) {
    if (e.winnerName) {
      if (!winMap[e.winnerName]) winMap[e.winnerName] = { count: 0, earnings: 0, holes: [] }
      winMap[e.winnerName].count++
      winMap[e.winnerName].earnings += yearPrize[e.year] ?? 0
      winMap[e.winnerName].holes.push(`${e.courseName} H${e.hole}`)
    }
  }
  const leaderboard = Object.entries(winMap).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))

  // Hole frequency across all years
  const holeFreq: Record<string, { courseName: string; hole: number; yardage?: number; timesPlayed: number; timesWon: number }> = {}
  for (const e of ctpEntries) {
    const key = `${e.courseName}-${e.hole}`
    if (!holeFreq[key]) holeFreq[key] = { courseName: e.courseName, hole: e.hole, yardage: e.yardage, timesPlayed: 0, timesWon: 0 }
    holeFreq[key].timesPlayed++
    if (e.winnerName) holeFreq[key].timesWon++
    if (e.yardage && !holeFreq[key].yardage) holeFreq[key].yardage = e.yardage
  }
  const holeList = Object.values(holeFreq).sort((a, b) => b.timesPlayed - a.timesPlayed || a.hole - b.hole)

  const totalHoles    = ctpEntries.length
  const noWinner      = ctpEntries.filter(e => !e.winnerName).length
  const totalPrize    = leaderboard.reduce((s, [, d]) => s + d.earnings, 0)
  const allIds        = teamGroups.flatMap(g => g.ids)

  // Match player ID → CTP win count by resolving name
  function ctpWinsById(id: string): number {
    return winMap[playerName(id)]?.count ?? 0
  }

  if (ctpEntries.length === 0) {
    return <EmptyState msg="CTP data will appear once Par 3 CTP entries are recorded on the Par 3 CTP page." />
  }

  return (
    <div className="space-y-6">
      {/* Year filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Year</span>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setSelectedYear('all')}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${selectedYear === 'all' ? 'bg-masters-green text-white' : 'bg-masters-light text-masters-dark hover:bg-masters-green/20'}`}>
            All
          </button>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${selectedYear === y ? 'bg-masters-green text-white' : 'bg-masters-light text-masters-dark hover:bg-masters-green/20'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-serif font-bold text-masters-dark">{totalHoles}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">CTP Holes Played</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-serif font-bold text-amber-600">{noWinner}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">No Winner</div>
          <div className="text-xs text-gray-400 mt-0.5">{totalHoles > 0 ? ((noWinner / totalHoles) * 100).toFixed(0) : 0}% of holes</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-serif font-bold text-masters-green">${totalPrize.toFixed(0)}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Total Prize Distributed</div>
        </div>
      </div>

      {/* Player leaderboard */}
      {leaderboard.length > 0 && (
        <div className="card">
          <h2 className="section-header">All-Time CTP Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-masters-light">
                <th className="border p-2 text-center w-8">#</th>
                <th className="border p-2 text-left">Player</th>
                <th className="border p-2 text-center">Wins</th>
                <th className="border p-2 text-center">Win Rate</th>
                <th className="border p-2 text-center">Est. Earnings</th>
                <th className="border p-2 text-left">Holes Won</th>
              </tr></thead>
              <tbody>
                {leaderboard.map(([name, data], i) => {
                  const id = allIds.find(id => playerName(id) === name)
                  const winRate = totalHoles > 0 ? ((data.count / totalHoles) * 100).toFixed(1) : '—'
                  return (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="border p-2 text-center font-bold text-gray-400">{i + 1}</td>
                      <td className="border p-2 font-semibold" style={{ color: id ? playerColors[id] : undefined }}>{name}</td>
                      <td className="border p-2 text-center text-xl font-serif font-bold text-masters-gold">{data.count}</td>
                      <td className="border p-2 text-center">{winRate}%</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">${data.earnings.toFixed(0)}</td>
                      <td className="border p-2 text-gray-500 text-[11px]">
                        {data.holes.slice(0, 4).join(' · ')}
                        {data.holes.length > 4 && <span className="text-gray-400"> +{data.holes.length - 4} more</span>}
                      </td>
                    </tr>
                  )
                })}
                {/* Players with zero wins */}
                {allIds
                  .filter(id => !winMap[playerName(id)])
                  .map(id => (
                    <tr key={id} className="hover:bg-gray-50 text-gray-400">
                      <td className="border p-2 text-center">—</td>
                      <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                      <td className="border p-2 text-center">0</td>
                      <td className="border p-2 text-center">0%</td>
                      <td className="border p-2 text-center">$0</td>
                      <td className="border p-2">—</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full CTP results log */}
      <div className="card">
        <h2 className="section-header">CTP Results Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-masters-light">
              <th className="border p-2 text-center">Year</th>
              <th className="border p-2 text-center">Round</th>
              <th className="border p-2 text-left">Course</th>
              <th className="border p-2 text-center">Hole</th>
              <th className="border p-2 text-center">Yardage</th>
              <th className="border p-2 text-left">Winner</th>
              <th className="border p-2 text-center">Paid</th>
              <th className="border p-2 text-center">→ HIO</th>
              <th className="border p-2 text-center">Prize</th>
            </tr></thead>
            <tbody>
              {filtered.map(e => {
                const id = allIds.find(id => playerName(id) === e.winnerName)
                const prize = e.winnerName && yearPrize[e.year] ? `$${yearPrize[e.year].toFixed(0)}` : '—'
                return (
                  <tr key={e.id} className={`hover:bg-gray-50 ${!e.winnerName ? 'opacity-60' : ''}`}>
                    <td className="border p-2 text-center text-gray-500">{e.year}</td>
                    <td className="border p-2 text-center">R{e.round}</td>
                    <td className="border p-2">{e.courseName}</td>
                    <td className="border p-2 text-center font-bold">{e.hole}</td>
                    <td className="border p-2 text-center text-gray-400">{e.yardage ? `${e.yardage}y` : '—'}</td>
                    <td className="border p-2 font-semibold" style={{ color: id ? playerColors[id] : undefined }}>
                      {e.winnerName ?? <span className="text-gray-300 italic font-normal">No winner</span>}
                    </td>
                    <td className="border p-2 text-center">
                      {e.winnerName ? (e.winnerPaid ? <span className="text-masters-green font-bold">✓</span> : <span className="text-gray-400">○</span>) : '—'}
                    </td>
                    <td className="border p-2 text-center">
                      {e.donatedToHio ? <span className="text-masters-gold font-semibold">${e.hioDonationAmount ?? '?'}</span> : '—'}
                    </td>
                    <td className="border p-2 text-center font-semibold text-masters-green">{prize}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="border p-4 text-center text-gray-400 italic">No entries for this year</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hole frequency */}
      {holeList.length > 0 && (
        <div className="card">
          <h2 className="section-header">CTP Holes — Frequency &amp; Difficulty</h2>
          <p className="text-xs text-gray-400 mb-3">How often each par 3 hole has been played as a CTP hole, and whether it produces a winner</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-masters-light">
                <th className="border p-2 text-left">Course</th>
                <th className="border p-2 text-center">Hole</th>
                <th className="border p-2 text-center">Yardage</th>
                <th className="border p-2 text-center">Times as CTP</th>
                <th className="border p-2 text-center">With Winner</th>
                <th className="border p-2 text-center">No Winner</th>
                <th className="border p-2 text-center">Winner Rate</th>
              </tr></thead>
              <tbody>
                {holeList.map((h, i) => {
                  const noWin = h.timesPlayed - h.timesWon
                  const rate = h.timesPlayed > 0 ? (h.timesWon / h.timesPlayed) * 100 : 0
                  const rateColor = rate >= 80 ? '#22c55e' : rate >= 50 ? '#60a5fa' : '#f97316'
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border p-2">{h.courseName}</td>
                      <td className="border p-2 text-center font-bold">{h.hole}</td>
                      <td className="border p-2 text-center text-gray-400">{h.yardage ? `${h.yardage}y` : '—'}</td>
                      <td className="border p-2 text-center">{h.timesPlayed}</td>
                      <td className="border p-2 text-center font-semibold text-masters-green">{h.timesWon}</td>
                      <td className="border p-2 text-center text-amber-600">{noWin}</td>
                      <td className="border p-2 text-center font-semibold" style={{ color: rateColor }}>
                        {h.timesPlayed > 0 ? `${rate.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Par 3 scoring from match data */}
      {allIds.some(id => (scoring[id]?.par3?.holes ?? 0) > 0) && (
        <div className="card">
          <h2 className="section-header">Par 3 Scoring from Match Data</h2>
          <p className="text-xs text-gray-400 mb-3">Average gross score per par 3 hole from all scored matches. Lower = better.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-masters-light">
                <th className="border p-2 text-left">Player</th>
                <th className="border p-2 text-center">Par 3 Avg</th>
                <th className="border p-2 text-center">vs Par</th>
                <th className="border p-2 text-center">Holes Played</th>
                <th className="border p-2 text-center">CTP Wins</th>
              </tr></thead>
              <tbody>
                {allIds
                  .filter(id => (scoring[id]?.par3?.holes ?? 0) > 0)
                  .sort((a, b) => {
                    const avgA = scoring[a].par3.totalScore / scoring[a].par3.holes
                    const avgB = scoring[b].par3.totalScore / scoring[b].par3.holes
                    return avgA - avgB
                  })
                  .map(id => {
                    const p3  = scoring[id].par3
                    const avg = p3.totalScore / p3.holes
                    const vp  = avg - 3
                    return (
                      <tr key={id} className="hover:bg-gray-50">
                        <td className="border p-2 font-semibold" style={{ color: playerColors[id] }}>{playerName(id)}</td>
                        <td className="border p-2 text-center font-bold">{avg.toFixed(2)}</td>
                        <td className="border p-2 text-center font-semibold"
                          style={{ color: vp < 0 ? '#22c55e' : vp > 0.5 ? '#ef4444' : '#6b7280' }}>
                          {vp >= 0 ? '+' : ''}{vp.toFixed(2)}
                        </td>
                        <td className="border p-2 text-center text-gray-400">{p3.holes}</td>
                        <td className="border p-2 text-center font-bold text-masters-gold">
                          {ctpWinsById(id) > 0 ? ctpWinsById(id) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="card border-l-4 border-masters-gold bg-amber-50/30">
        <h2 className="text-sm font-bold text-masters-dark mb-2">Additional Par 3 Stats — Not Yet Tracked</h2>
        <ul className="text-xs text-gray-600 space-y-1.5">
          <li><span className="font-semibold">Proximity to pin</span> — Distance of tee shot from the cup; requires a new yardage-remaining field per entry</li>
          <li><span className="font-semibold">Par 3 birdie/bogey rate</span> — Scoring distribution split by par type (par 3 vs par 4/5); analytics currently aggregate all holes together</li>
          <li><span className="font-semibold">Round-by-round CTP frequency</span> — Breakdown of CTP holes by format (R2 Points Round has the most par 3s per round)</li>
          <li><span className="font-semibold">CTP→HIO donation history</span> — Year-over-year chart of how CTP winnings flow into the HIO pot</li>
          <li><span className="font-semibold">Hole-in-one on CTP holes</span> — Whether any CTP holes have produced HIOs historically</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="card text-center py-12">
      <div className="text-4xl mb-3">📊</div>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">{msg}</p>
    </div>
  )
}
