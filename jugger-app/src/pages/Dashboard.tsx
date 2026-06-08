import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { Users, MapPin, Shuffle, Trophy, Lock, Unlock, CheckCircle, AlertTriangle, X } from 'lucide-react'
import type { Match, Team } from '../types'

const ROUND_FORMATS: Record<string, string> = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice: "Captain's Choice",
}

export default function Dashboard() {
  const { year, liveYear, isViewingHistory, setYear, teams, courses, roundConfigs, matches, teamScores, hdcpLocked, lockHandicaps, finalizeYear } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [showFinalize, setShowFinalize] = useState(false)

  const totalMatches = matches.length
  const scoredMatches = matches.filter(m => Object.keys(m.scores).length > 0).length

  const standings = teams.map(t => {
    const pts = teamScores.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.points, 0)
    return { team: t, points: pts }
  }).sort((a, b) => b.points - a.points)

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

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label="Players" value={teams.reduce((s, t) => s + t.players.length, 0)} to="/teams" />
        <StatCard icon={<MapPin size={20} />} label="Courses" value={4} to="/courses" />
        <StatCard icon={<Shuffle size={20} />} label="Matches" value={`${scoredMatches}/${totalMatches}`} to="/schedule" sub={totalMatches === 0 ? 'Not generated' : undefined} />
        <StatCard icon={<Trophy size={20} />} label="Rounds" value={roundConfigs.length} to="/results" />
      </div>

      {/* Standings */}
      <div className="card">
        <h2 className="section-header">Current Standings</h2>
        {teamScores.length === 0 ? (
          <p className="text-gray-400 text-sm">No scores entered yet.</p>
        ) : (
          <div className="space-y-2">
            {standings.map(({ team, points }, i) => (
              <div key={team.id} className="flex items-center gap-3">
                <span className="text-2xl font-serif font-bold text-masters-gold w-6">{i + 1}</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: team.color }}
                />
                <span className="font-semibold flex-1">{team.name}</span>
                <span className="text-lg font-bold text-masters-dark">{points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Round schedule */}
      <div className="card">
        <h2 className="section-header">Round Schedule</h2>
        <div className="divide-y">
          {roundConfigs
            .slice()
            .sort((a, b) => a.round - b.round)
            .map(rc => (
              <Link key={rc.round} to="/schedule" className="flex items-center gap-3 py-2 hover:bg-masters-green/5 -mx-4 px-4 transition-colors">
                <span className="badge bg-masters-green text-white w-16 text-center">
                  Round {rc.round}
                </span>
                <div className="flex-1">
                  <span className="font-semibold text-sm">{ROUND_FORMATS[rc.format] ?? rc.format}</span>
                  <span className="text-gray-400 text-xs ml-2">{rc.courseId.replace(/-/g, ' ')}</span>
                </div>
                {rc.date && <span className="text-xs text-gray-500 shrink-0">{new Date(rc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
                {rc.teeTimes && rc.teeTimes.some(Boolean) && (
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {rc.teeTimes.map((t, i) => {
                      if (!t) return null
                      const [h, m] = t.split(':').map(Number)
                      const ampm = h >= 12 ? 'PM' : 'AM'
                      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                      return (
                        <span key={i} className="text-xs text-masters-gold font-semibold">
                          {h12}:{String(m).padStart(2,'0')} {ampm}
                        </span>
                      )
                    })}
                  </div>
                )}
              </Link>
            ))}
        </div>
      </div>

      {/* Team rosters */}
      <div className="grid md:grid-cols-3 gap-4">
        {teams.map(team => (
          <Link key={team.id} to="/teams" className="card border-t-4 hover:shadow-md transition-shadow" style={{ borderTopColor: team.color }}>
            <h3 className="font-serif font-bold text-lg mb-2" style={{ color: team.color }}>
              {team.name}
            </h3>
            <ul className="space-y-1">
              {team.players.map(p => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-gray-500">{p.handicapIndex.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      {/* Pairings summary */}
      <div className="card">
        <h2 className="section-header">Pairings Summary</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-400">Pairings not yet generated.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b bg-masters-light">
                  <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Round</th>
                  <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Course</th>
                  <th className="text-left p-2 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Format</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide">Match A</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide">Match B</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide">Match C</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200">Blind 1</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide">Blind 2</th>
                  <th className="text-center p-2 font-semibold text-gray-500 uppercase tracking-wide">Blind 3</th>
                </tr>
              </thead>
              <tbody>
                {roundConfigs.slice().sort((a, b) => a.round - b.round).map(rc => {
                  const course = courses.find(c => c.id === rc.courseId)
                  const isTeamFormat = rc.format === 'texas_scramble' || rc.format === 'captains_choice'
                  return (
                    <tr key={rc.round} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">
                        <span className="badge bg-masters-green text-white">Round {rc.round}</span>
                      </td>
                      <td className="p-2 whitespace-nowrap font-medium text-masters-dark">{course?.name ?? rc.courseId}</td>
                      <td className="p-2 whitespace-nowrap text-gray-500">{ROUND_FORMATS[rc.format] ?? rc.format}</td>
                      {isTeamFormat ? (
                        <td colSpan={6} className="p-2 text-center text-gray-400 italic">
                          Team event — all players compete together
                        </td>
                      ) : (
                        <>
                          {(['a','b','c'] as const).map(s => {
                            const m = matches.find(x => x.id === `${rc.round}${s}`)
                            return <td key={s} className="p-2">{m ? <PairingCell match={m} teams={teams} /> : <span className="text-gray-300 block text-center">—</span>}</td>
                          })}
                          {([1,2,3] as const).map(n => {
                            const m = matches.find(x => x.id === `${rc.round}blind${n}`)
                            return <td key={n} className={`p-2${n === 1 ? ' border-l border-gray-200' : ''}`}>{m ? <PairingCell match={m} teams={teams} /> : <span className="text-gray-300 block text-center">—</span>}</td>
                          })}
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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

function StatCard({ icon, label, value, to, sub }: { icon: React.ReactNode, label: string, value: string | number, to: string, sub?: string }) {
  return (
    <Link to={to} className="card hover:border-masters-green hover:shadow transition-all">
      <div className="flex items-start justify-between">
        <div className="text-masters-green">{icon}</div>
      </div>
      <div className="mt-2">
        <div className="text-2xl font-serif font-bold text-masters-dark">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
        {sub && <div className="text-xs text-masters-gold mt-0.5">{sub}</div>}
      </div>
    </Link>
  )
}
