import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { Lock, Unlock, CheckCircle, AlertTriangle, X, Trophy } from 'lucide-react'
import type { Match, Team } from '../types'
import { computeChampion, getDefendingChampionId } from '../utils/champion'

const MAX_PTS: Record<number, number> = { 1: 9, 2: 15, 3: 7, 4: 12, 5: 7 }

const ROUND_FORMATS: Record<string, string> = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice: "Captain's Choice",
}

export default function Dashboard() {
  const { year, liveYear, isViewingHistory, setYear, teams, courses, roundConfigs, matches, teamScores, hdcpLocked, lockHandicaps, finalizeYear, archivedYears } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [showFinalize, setShowFinalize] = useState(false)

  const standings = teams.map(t => ({
    team: t,
    byRound: [1, 2, 3, 4, 5].map(r => teamScores.find(s => s.teamId === t.id && s.round === r)?.points ?? 0),
    total: teamScores.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.points, 0),
  })).sort((a, b) => b.total - a.total)

  const rounds = roundConfigs.map(rc => rc.round)
  const defendingChampionId = getDefendingChampionId(archivedYears, year)
  const { champion, isComplete: tournamentComplete } = computeChampion(teams, teamScores, rounds, defendingChampionId)

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-masters-dark">Tournament Overview</h1>
          <p className="text-gray-500 mt-0.5">A Tradition Unlike Any Other</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className="input w-24"
                value={year}
                onChange={e => setYear(parseInt(e.target.value) || year)}
              />
            </div>
          )}
          {isAdmin && (
            <div className="pt-5">
              <button
                className={hdcpLocked ? 'btn-danger flex items-center gap-1' : 'btn-ghost flex items-center gap-1'}
                onClick={() => lockHandicaps(!hdcpLocked)}
              >
                {hdcpLocked ? <Lock size={14} /> : <Unlock size={14} />}
                {hdcpLocked ? 'HDCP Locked' : 'Lock HDCPs'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Champion hero banner */}
      {champion && <ChampionHero team={champion} year={year} isComplete={tournamentComplete} />}

      {/* Standings */}
      <div className="card overflow-x-auto">
        <h2 className="section-header">Current Standings</h2>
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
            {standings.map(({ team, byRound, total }, idx) => {
              const isChampion = champion?.id === team.id
              return (
              <tr key={team.id} className={isChampion ? 'bg-yellow-50' : idx === 0 && total > 0 ? 'bg-yellow-50/50' : ''}>
                <td className="p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isChampion
                      ? <Trophy size={14} className="text-masters-gold shrink-0" />
                      : idx === 0 && total > 0 && <span className="text-masters-gold">🏆</span>
                    }
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: team.color }} />
                    <span className="font-semibold">{team.name}</span>
                    {isChampion && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: team.color + '22', color: team.color }}>
                        {tournamentComplete ? 'Champions' : 'Clinched'}
                      </span>
                    )}
                  </div>
                </td>
                {byRound.map((pts, ri) => (
                  <td key={ri} className="p-2 text-center font-semibold">{pts || 0}</td>
                ))}
                <td className="p-2 text-center font-bold text-lg text-masters-dark">{total}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Round Schedule & Pairings */}
      <div className="card">
        <h2 className="section-header">Round Schedule &amp; Pairings</h2>
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="border-b bg-masters-light">
                <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Round</th>
                <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Game / Course</th>
                <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Tee Times</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">Match A</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Match B</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Match C</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">Blind 1</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Blind 2</th>
                <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Blind 3</th>
              </tr>
            </thead>
            <tbody>
              {roundConfigs.slice().sort((a, b) => a.round - b.round).map(rc => {
                const course = courses.find(c => c.id === rc.courseId)
                const isTeamFormat = rc.format === 'texas_scramble' || rc.format === 'captains_choice'
                return (
                  <tr
                    key={rc.round}
                    className="border-b last:border-0 hover:bg-masters-green/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/scorecards?round=${rc.round}`)}
                  >
                    <td className="p-2 whitespace-nowrap">
                      <span className="badge bg-masters-green text-white">Round {rc.round}</span>
                    </td>
                    <td className="p-2">
                      <div className="font-semibold text-masters-dark whitespace-nowrap">{ROUND_FORMATS[rc.format] ?? rc.format}</div>
                      <div className="text-gray-400 whitespace-nowrap">{course?.name ?? rc.courseId}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap text-gray-500">
                      {rc.date ? new Date(rc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="p-2">
                      {rc.teeTimes?.some(Boolean) ? (
                        <div className="flex flex-col gap-0.5">
                          {rc.teeTimes!.map((t, i) => {
                            if (!t) return null
                            const [h, min] = t.split(':').map(Number)
                            const ampm = h >= 12 ? 'PM' : 'AM'
                            const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                            return <span key={i} className="text-masters-gold font-semibold whitespace-nowrap">{h12}:{String(min).padStart(2,'0')} {ampm}</span>
                          })}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {isTeamFormat ? (
                      <td colSpan={6} className="p-2 text-center text-gray-400 italic border-l border-gray-200">
                        Team event — all players compete together
                      </td>
                    ) : (
                      <>
                        {(['a','b','c'] as const).map((s, i) => {
                          const m = matches.find(x => x.id === `${rc.round}${s}`)
                          return (
                            <td key={s} className={`p-2${i === 0 ? ' border-l border-gray-200' : ''}`}>
                              {m ? <PairingCell match={m} teams={teams} /> : <span className="text-gray-300 block text-center">—</span>}
                            </td>
                          )
                        })}
                        {([1,2,3] as const).map(n => {
                          const m = matches.find(x => x.id === `${rc.round}blind${n}`)
                          return (
                            <td key={n} className={`p-2${n === 1 ? ' border-l border-gray-200' : ''}`}>
                              {m ? <PairingCell match={m} teams={teams} /> : <span className="text-gray-300 block text-center">—</span>}
                            </td>
                          )
                        })}
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team rosters */}
      <div className="grid md:grid-cols-3 gap-4">
        {teams.map(team => (
          <Link key={team.id} to="/teams" className="card border-t-4 hover:shadow-md transition-shadow" style={{ borderTopColor: team.color }}>
            <h3 className="font-serif font-bold text-lg mb-2" style={{ color: team.color }}>
              {team.name}
            </h3>
            <div className="flex justify-between items-end mb-1 pb-1 border-b border-gray-100">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Player</span>
              <div className="w-16 flex justify-center">
                <img src={`${import.meta.env.BASE_URL}USGA-GHIN-logo-square.webp`} alt="GHIN Handicap Index" className="h-16 opacity-80" />
              </div>
            </div>
            <ul className="space-y-1">
              {team.players.map(p => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <div className="w-16 text-center text-gray-500">{p.handicapIndex.toFixed(1)}</div>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      {/* Finalize tournament (admin, live year only) */}
      {isAdmin && !isViewingHistory && (
        <div className="card border border-dashed border-gray-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif font-bold text-masters-dark">Finalize {year} Tournament</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Archives all {year} data and advances the site to {year + 1}. Rosters and courses are kept as a template.
              </p>
            </div>
            <button
              className="btn-ghost text-xs text-red-600 border-red-200 hover:border-red-400 hover:text-red-700 flex items-center gap-1.5 shrink-0"
              onClick={() => setShowFinalize(true)}
            >
              <CheckCircle size={14} /> Finalize {year}…
            </button>
          </div>

          {showFinalize && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Finalize {year} Juggerknocker Invitational?</p>
                  <ul className="text-xs text-red-700 mt-1.5 space-y-0.5 list-disc list-inside">
                    <li>All {year} data (pairings, scores, results) will be archived</li>
                    <li>The site will advance to {year + 1}</li>
                    <li>Rosters and course configs carry over as a starting template</li>
                    <li>After finalizing, reload the page to start syncing for {year + 1}</li>
                    <li>Previous year data remains viewable and editable by admins</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  className="btn-primary text-xs bg-red-600 border-red-600 hover:bg-red-700 flex items-center gap-1.5"
                  onClick={() => { finalizeYear(); setShowFinalize(false) }}
                >
                  <CheckCircle size={13} /> Confirm — finalize {year} &amp; advance to {year + 1}
                </button>
                <button className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1" onClick={() => setShowFinalize(false)}>
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChampionHero({ team, year, isComplete }: { team: Team; year: number; isComplete: boolean }) {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(180deg, #060d08 0%, #0b1610 100%)', border: `2px solid ${team.color}` }}
    >
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${team.color}, transparent)` }} />

      <div className="px-6 py-8 text-center space-y-2">
        <p className="text-lg font-semibold text-white tracking-wide">
          {year} Juggerknocker Invitational Champions
        </p>
        <div className="py-2 text-8xl leading-none select-none">🏆</div>
        <p
          className="text-5xl font-serif font-bold text-white"
          style={{ textShadow: `0 0 40px ${team.color}` }}
        >
          {team.name}
        </p>
        {!isComplete && (
          <p className="text-sm text-white/60 italic pt-1">Mathematically clinched</p>
        )}
      </div>

      <div className="h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${team.color}, transparent)` }} />
    </div>
  )
}

function PairingCell({ match, teams }: { match: Match; teams: Team[] }) {
  function firstName(id: string) {
    for (const t of teams) {
      const p = t.players.find(p => p.id === id)
      if (p) return p.name.split(' ')[0]
    }
    return id
  }
  const color1 = teams.find(t => t.id === match.twosome1.teamId)?.color ?? '#666'
  const color2 = teams.find(t => t.id === match.twosome2.teamId)?.color ?? '#666'
  return (
    <div className="text-center leading-tight">
      <div className="font-medium" style={{ color: color1 }}>
        {firstName(match.twosome1.playerIds[0])} &amp; {firstName(match.twosome1.playerIds[1])}
      </div>
      <div className="text-[9px] text-gray-400">vs</div>
      <div className="font-medium" style={{ color: color2 }}>
        {firstName(match.twosome2.playerIds[0])} &amp; {firstName(match.twosome2.playerIds[1])}
      </div>
    </div>
  )
}

