import { useMemo } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { computeChampion, getDefendingChampionId } from '../utils/champion'
import { computeShotStats, type YearBundle } from '../utils/analytics'
import { getPlayerCourseHdcp } from '../utils/handicap'
import { Trophy, Target, Flag, Star, TrendingUp, TrendingDown } from 'lucide-react'

const FORMAT_LABELS: Record<string, string> = {
  team_match_play:    'Team Match Play',
  points_round:       'Points Round',
  texas_scramble:     'Texas Scramble',
  individual_match:   'Individual Match Play',
  captains_choice:    "Captain's Choice",
  vegas:              'Vegas',
}

const MAX_PTS: Record<number, number> = { 1: 9, 2: 15, 3: 7, 4: 12, 5: 7 }

export default function Summary() {
  const {
    year, liveYear, isViewingHistory, archivedYears,
    teams, courses, roundConfigs, matches, teamScores,
    ctpEntries, holeInOnes, hioDonations,
    sandbaggerPlayerId, toiletAwardPlayerId,
  } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const allPlayers = useMemo(() => teams.flatMap(t => t.players), [teams])

  const rounds = roundConfigs.map(rc => rc.round)
  const defendingId = getDefendingChampionId(archivedYears, year)
  const { champion, isComplete } = computeChampion(teams, teamScores, rounds, defendingId)

  const isPreview = !isComplete && !isViewingHistory

  // Standings
  const standings = useMemo(() => teams.map(t => ({
    team: t,
    byRound: [1, 2, 3, 4, 5].map(r => teamScores.find(s => s.teamId === t.id && s.round === r)?.points ?? 0),
    total: teamScores.filter(s => s.teamId === t.id).reduce((a, b) => a + b.points, 0),
  })).sort((a, b) => b.total - a.total), [teams, teamScores])

  // Bundle for shot stats
  const bundle = useMemo((): YearBundle => ({
    year, teams, matches, teamScores, roundConfigs,
  }), [year, teams, matches, teamScores, roundConfigs])

  const shotStats = useMemo(() => computeShotStats([bundle]), [bundle])

  // Only show shot stats if we have data
  const hasShotStats = shotStats.some(s => s.fwAttempts > 0 || s.girAttempts > 0 || s.puttsHoles > 0)

  const shotLeaders = useMemo(() => {
    if (!hasShotStats) return null
    const withStats = shotStats.filter(s => s.fwAttempts >= 18 || s.girAttempts >= 18 || s.puttsHoles >= 18)
    if (!withStats.length) return null

    const byFw  = [...withStats].filter(s => s.fwAttempts > 0).sort((a, b) => (b.fwHit / b.fwAttempts) - (a.fwHit / a.fwAttempts))
    const byGir = [...withStats].filter(s => s.girAttempts > 0).sort((a, b) => (b.girHit / b.girAttempts) - (a.girHit / a.girAttempts))
    const byPutts = [...withStats].filter(s => s.puttsHoles > 0).sort((a, b) => (a.puttsTotal / a.puttsHoles) - (b.puttsTotal / b.puttsHoles))

    return {
      fwLeader: byFw[0],
      girLeader: byGir[0],
      puttsLeader: byPutts[0],
      all: withStats,
    }
  }, [shotStats, hasShotStats])

  // HDCP performance analysis
  const hdcpPerformance = useMemo(() => {
    const EXCL = new Set(['texas_scramble', 'captains_choice'])
    const playerDeltas: Record<string, { name: string; color: string; deltas: number[]; totalDelta: number }> = {}

    for (const m of matches) {
      if (m.isBlind) continue
      const rc = roundConfigs.find(r => r.round === m.round)
      if (!rc || EXCL.has(rc.format)) continue
      const course = courses.find(c => c.id === rc.courseId)
      if (!course) continue

      const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]

      for (const pid of pids) {
        const scores = m.scores[pid] ?? {}
        const holeScores = course.holes.map(h => scores[h.number] ?? null)
        if (holeScores.some(s => s == null)) continue // incomplete round

        const gross = holeScores.reduce<number>((a, b) => a + (b ?? 0), 0)
        const player = allPlayers.find(p => p.id === pid)
        if (!player) continue

        const hdcp = getPlayerCourseHdcp(player, course, rc.tee, rc.round, allPlayers, rc.format)
        const net = gross - hdcp
        const delta = net - course.par // negative = beating handicap

        if (!playerDeltas[pid]) {
          const team = teams.find(t => t.players.some(p => p.id === pid))
          playerDeltas[pid] = { name: player.name, color: team?.color ?? '#6b7280', deltas: [], totalDelta: 0 }
        }
        playerDeltas[pid].deltas.push(delta)
        playerDeltas[pid].totalDelta += delta
      }
    }

    return Object.entries(playerDeltas)
      .filter(([, v]) => v.deltas.length > 0)
      .map(([pid, v]) => ({
        pid,
        name: v.name,
        color: v.color,
        rounds: v.deltas.length,
        avgDelta: v.totalDelta / v.deltas.length,
        totalDelta: v.totalDelta,
      }))
      .sort((a, b) => a.avgDelta - b.avgDelta)
  }, [matches, roundConfigs, courses, allPlayers, teams])

  // Awards
  const sandbaggerPlayer = allPlayers.find(p => p.id === sandbaggerPlayerId)
  const toiletPlayer = allPlayers.find(p => p.id === toiletAwardPlayerId)

  // CTP winners this year
  const ctpWinners = ctpEntries.filter(e => e.year === year && e.winnerName)

  // Year HIO
  const yearHios = holeInOnes.filter(h => h.year === year)

  // Date range
  const yearPrefix = String(year)
  const dates = roundConfigs.map(rc => rc.date).filter((d): d is string => !!d && d.startsWith(yearPrefix)).sort()
  let dateRange = ''
  if (dates.length) {
    const first = new Date(dates[0] + 'T12:00:00')
    const last  = new Date(dates[dates.length - 1] + 'T12:00:00')
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    dateRange = `${MONTHS[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  }

  // Pot for HIO
  const hioPot = hioDonations
    .filter(d => d.year === year && d.paid && !d.claimedByHioId)
    .reduce((s, d) => s + d.amount, 0)

  const playerName = (pid: string) => allPlayers.find(p => p.id === pid)?.name ?? pid

  if (!isAdmin && isPreview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Tournament Summary</h1>
          <p className="text-gray-500 mt-1">The full summary will be available once all rounds are complete.</p>
        </div>
        <div className="card text-center py-16 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold mb-1">Tournament in progress</p>
          <p className="text-sm">Check back after all 5 rounds are scored.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-masters-dark flex items-center gap-2">
          {year} Tournament Summary
          {isPreview && isAdmin && (
            <span className="text-xs font-sans font-normal bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded ml-2">Admin Preview</span>
          )}
        </h1>
        {dateRange && <p className="text-gray-500 text-sm mt-0.5">{dateRange}</p>}
      </div>

      {/* Champion hero */}
      {champion && isComplete && (
        <div
          className="card text-center py-8 border-2"
          style={{ borderColor: champion.color, background: champion.color + '11' }}
        >
          <div className="text-4xl mb-2">🏆</div>
          <div className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: champion.color }}>
            {year} Champions
          </div>
          <div className="text-3xl font-serif font-bold text-masters-dark">{champion.name}</div>
          <div className="text-gray-500 text-sm mt-1">
            {standings.find(s => s.team.id === champion.id)?.total ?? 0} total points
          </div>
        </div>
      )}

      {/* Final Standings */}
      <div className="card overflow-x-auto">
        <h2 className="section-header">Final Standings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-masters-light">
              <th className="p-2 text-left">Team</th>
              {[1, 2, 3, 4, 5].map(r => (
                <th key={r} className="p-2 text-center">
                  <div>R{r}</div>
                  <div className="text-xs text-gray-400 font-normal">/{MAX_PTS[r]}</div>
                </th>
              ))}
              <th className="p-2 text-center font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map(({ team, byRound, total }, idx) => (
              <tr key={team.id} className={idx === 0 && total > 0 ? 'bg-yellow-50' : ''}>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {idx === 0 && total > 0 && <Trophy size={14} className="text-masters-gold" />}
                    <div className="w-3 h-3 rounded-full" style={{ background: team.color }} />
                    <span className="font-semibold">{team.name}</span>
                  </div>
                </td>
                {byRound.map((pts, ri) => (
                  <td key={ri} className="p-2 text-center font-semibold">{pts || 0}</td>
                ))}
                <td className="p-2 text-center font-bold text-masters-dark">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Round Highlights */}
      <div className="space-y-3">
        <h2 className="section-header">Round Highlights</h2>
        {roundConfigs.slice().sort((a, b) => a.round - b.round).map(rc => {
          const course = courses.find(c => c.id === rc.courseId)
          const roundMatches = matches.filter(m => m.round === rc.round && !m.isBlind)
          const roundPts = teams.map(t => ({
            team: t,
            pts: teamScores.find(s => s.teamId === t.id && s.round === rc.round)?.points ?? 0,
          })).sort((a, b) => b.pts - a.pts)

          const hasScores = roundMatches.some(m => Object.values(m.scores).some(hs => Object.values(hs).some(s => s != null)))

          return (
            <div key={rc.round} className="card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-masters-light text-masters-dark font-bold">Round {rc.round}</span>
                    <span className="text-xs text-gray-500">{FORMAT_LABELS[rc.format] ?? rc.format}</span>
                  </div>
                  {course && (
                    <div className="text-sm font-semibold text-masters-dark mt-1">{course.name}</div>
                  )}
                  {rc.date && (
                    <div className="text-xs text-gray-400">{new Date(rc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                  )}
                </div>
                {/* Team points for this round */}
                <div className="flex items-center gap-3">
                  {roundPts.filter(r => r.pts > 0).map(({ team, pts }) => (
                    <div key={team.id} className="text-center">
                      <div className="text-xs font-bold" style={{ color: team.color }}>{team.name}</div>
                      <div className="text-lg font-bold text-masters-dark">{pts}</div>
                    </div>
                  ))}
                </div>
              </div>
              {hasScores && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {roundMatches.map(m => {
                    if (!m.result) return null
                    const t1pids = m.twosome1.playerIds
                    const t2pids = m.twosome2.playerIds
                    const t1 = teams.find(t => t.players.some(p => t1pids.includes(p.id)))
                    const t2 = teams.find(t => t.players.some(p => t2pids.includes(p.id)))
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                        <span className="font-semibold text-gray-500">{m.label}:</span>
                        <span style={{ color: t1?.color }}>{t1pids.map(id => playerName(id).split(' ')[0]).join('/')}</span>
                        <span className="text-gray-400">vs</span>
                        <span style={{ color: t2?.color }}>{t2pids.map(id => playerName(id).split(' ')[0]).join('/')}</span>
                        <span className="font-semibold text-masters-green">→ {m.result}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Par 3 CTP Results */}
      {ctpWinners.length > 0 && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Flag size={15} /> Par 3 CTP Winners</h2>
          <div className="space-y-1.5">
            {ctpWinners.map((e, i) => {
              const rc = roundConfigs.find(r => r.round === e.round)
              const course = rc ? courses.find(c => c.id === rc.courseId) : null
              return (
                <div key={i} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                  <span className="text-gray-500 text-xs">R{e.round} · Hole {e.hole}</span>
                  {e.yardage && <span className="text-xs text-gray-400">{e.yardage} yds</span>}
                  {course && <span className="text-xs text-gray-400">{course.name}</span>}
                  <span className="font-semibold text-masters-dark ml-auto">{e.winnerName}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hole in One */}
      {yearHios.length > 0 && (
        <div className="card border-2 border-masters-gold">
          <h2 className="section-header text-masters-gold">🏌️ Hole-in-One</h2>
          {yearHios.map(h => (
            <div key={h.id} className="text-sm">
              <span className="font-bold text-masters-dark">{h.playerName}</span>
              <span className="text-gray-500"> — {h.course}, Hole {h.hole}{h.yardage ? ` (${h.yardage} yds)` : ''}</span>
              {h.potClaimed && <span className="ml-2 text-masters-gold font-semibold">${h.potClaimed} pot</span>}
            </div>
          ))}
          {hioPot > 0 && (
            <div className="mt-2 text-sm text-masters-gold font-semibold">
              Current pot: ${hioPot}
            </div>
          )}
        </div>
      )}

      {/* Shot Stat Leaders */}
      {hasShotStats && shotLeaders && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Target size={15} /> Shot Stat Leaders</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {shotLeaders.fwLeader && (
              <div className="text-center p-3 bg-masters-light rounded-lg">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">FW%</div>
                <div className="text-2xl font-bold text-masters-dark">
                  {Math.round(shotLeaders.fwLeader.fwHit / shotLeaders.fwLeader.fwAttempts * 100)}%
                </div>
                <div className="text-xs font-semibold mt-1" style={{ color: teams.find(t => t.players.some(p => p.id === shotLeaders.fwLeader!.playerId))?.color ?? '#1a3a2f' }}>
                  {playerName(shotLeaders.fwLeader.playerId)}
                </div>
              </div>
            )}
            {shotLeaders.girLeader && (
              <div className="text-center p-3 bg-masters-light rounded-lg">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">GIR%</div>
                <div className="text-2xl font-bold text-masters-dark">
                  {Math.round(shotLeaders.girLeader.girHit / shotLeaders.girLeader.girAttempts * 100)}%
                </div>
                <div className="text-xs font-semibold mt-1" style={{ color: teams.find(t => t.players.some(p => p.id === shotLeaders.girLeader!.playerId))?.color ?? '#1a3a2f' }}>
                  {playerName(shotLeaders.girLeader.playerId)}
                </div>
              </div>
            )}
            {shotLeaders.puttsLeader && (
              <div className="text-center p-3 bg-masters-light rounded-lg">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Avg Putts</div>
                <div className="text-2xl font-bold text-masters-dark">
                  {(shotLeaders.puttsLeader.puttsTotal / shotLeaders.puttsLeader.puttsHoles).toFixed(1)}
                </div>
                <div className="text-xs font-semibold mt-1" style={{ color: teams.find(t => t.players.some(p => p.id === shotLeaders.puttsLeader!.playerId))?.color ?? '#1a3a2f' }}>
                  {playerName(shotLeaders.puttsLeader.playerId)}
                </div>
              </div>
            )}
          </div>
          {/* Per-player table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 font-semibold text-gray-500">Player</th>
                <th className="text-center p-2 font-semibold text-gray-500">FW%</th>
                <th className="text-center p-2 font-semibold text-gray-500">GIR%</th>
                <th className="text-center p-2 font-semibold text-gray-500">Avg Putts</th>
              </tr>
            </thead>
            <tbody>
              {shotLeaders.all.map(s => {
                const team = teams.find(t => t.players.some(p => p.id === s.playerId))
                const fwPct = s.fwAttempts ? Math.round(s.fwHit / s.fwAttempts * 100) : null
                const girPct = s.girAttempts ? Math.round(s.girHit / s.girAttempts * 100) : null
                const avgPutts = s.puttsHoles ? (s.puttsTotal / s.puttsHoles).toFixed(1) : null
                return (
                  <tr key={s.playerId} className="border-b last:border-0">
                    <td className="p-2 font-semibold" style={{ color: team?.color ?? '#1a3a2f' }}>
                      {playerName(s.playerId)}
                    </td>
                    <td className="p-2 text-center">{fwPct != null ? `${fwPct}%` : '—'}</td>
                    <td className="p-2 text-center">{girPct != null ? `${girPct}%` : '—'}</td>
                    <td className="p-2 text-center">{avgPutts ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* HDCP Performance */}
      {hdcpPerformance.length > 0 && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><TrendingUp size={15} /> Net Performance vs HDCP</h2>
          <p className="text-xs text-gray-500 mb-3">Average net score vs par across all individual-format rounds. Negative = beating handicap.</p>
          <div className="space-y-2">
            {hdcpPerformance.map(p => {
              const isGood = p.avgDelta < 0
              return (
                <div key={p.pid} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-sm font-semibold truncate" style={{ color: p.color }}>
                    {p.name.split(' ')[0]}
                  </div>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden relative">
                    <div
                      className={`absolute top-0 h-full rounded transition-all ${isGood ? 'right-1/2 bg-green-400' : 'left-1/2 bg-red-400'}`}
                      style={{
                        width: `${Math.min(Math.abs(p.avgDelta) * 5, 50)}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-px h-full bg-gray-300" style={{ marginLeft: '50%' }} />
                    </div>
                  </div>
                  <div className={`text-sm font-bold w-16 text-right flex items-center justify-end gap-1 ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                    {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {p.avgDelta > 0 ? '+' : ''}{p.avgDelta.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-400 w-10 text-right">{p.rounds}R</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
            <span className="text-green-600 font-semibold">← Beating HDCP</span>
            <span className="text-red-500 font-semibold">Behind HDCP →</span>
          </div>
        </div>
      )}

      {/* Awards */}
      {(sandbaggerPlayer || toiletPlayer) && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Star size={15} /> End-of-Year Awards</h2>
          <div className="grid grid-cols-2 gap-4">
            {sandbaggerPlayer && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <img
                  src={`${import.meta.env.BASE_URL}sandbagger.jpg`}
                  alt="Sandbagger Award"
                  className="h-12 w-12 object-cover rounded"
                />
                <div>
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Sandbagger Award</div>
                  <div className="font-semibold text-masters-dark">{sandbaggerPlayer.name}</div>
                </div>
              </div>
            )}
            {toiletPlayer && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <img
                  src={`${import.meta.env.BASE_URL}toilet_award.webp`}
                  alt="Toilet Award"
                  className="h-12 w-12 object-cover rounded"
                />
                <div>
                  <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Toilet Award</div>
                  <div className="font-semibold text-masters-dark">{toiletPlayer.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
