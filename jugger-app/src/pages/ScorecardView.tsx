import { useState } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import ScorecardCard from '../components/ScorecardCard'
import { getMatchesForRound } from '../utils/pairings'
import { getPlayerCourseHdcp, stablefordPoints, getStrokeDots } from '../utils/handicap'

const ROUND_NAMES: Record<number, string> = {
  1: 'Round 1 — Team Match Play',
  2: 'Round 2 — Points Round',
  3: 'Round 3 — Texas Scramble',
  4: 'Round 4 — Individual Match Play',
  5: "Round 5 — Captain's Choice",
}

export default function ScorecardView() {
  const { teams, matches, courses, roundConfigs, setMatchScore, updateMatch } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [activeRound, setActiveRound] = useState(1)
  const [activeMatch, setActiveMatch] = useState<string | null>(null)

  const roundMatches = getMatchesForRound(matches, activeRound)
  const config = roundConfigs.find(r => r.round === activeRound)
  const course = courses.find(c => c.id === config?.courseId)
  const match = matches.find(m => m.id === activeMatch)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-masters-dark">Scorecards</h1>

      {/* Round tabs */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map(r => (
          <button
            key={r}
            onClick={() => { setActiveRound(r); setActiveMatch(null) }}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              activeRound === r ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green'
            }`}
          >
            Round {r}
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Generate pairings first to view scorecards.
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-4">
          {/* Match list */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{ROUND_NAMES[activeRound]}</p>
            {roundMatches.length === 0 && (
              <p className="text-sm text-gray-400">No matches for this round.</p>
            )}
            {roundMatches.map(m => {
              const scored = Object.keys(m.scores).length > 0
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMatch(m.id)}
                  className={`w-full text-left rounded border p-2 text-sm transition-colors ${
                    activeMatch === m.id
                      ? 'border-masters-green bg-masters-light'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.label}</span>
                    {m.isBlind && <span className="badge bg-gray-100 text-gray-500">Blind</span>}
                    {scored && <span className="badge bg-masters-light text-masters-green">●</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {m.twosome1.playerIds.map(id => teams.flatMap(t => t.players).find(p => p.id === id)?.name.split(' ')[0] ?? id).join('/')}
                    {' vs '}
                    {m.twosome2.playerIds.map(id => teams.flatMap(t => t.players).find(p => p.id === id)?.name.split(' ')[0] ?? id).join('/')}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Scorecard detail */}
          <div className="lg:col-span-3">
            {!match || !config || !course ? (
              <div className="card text-center py-12 text-gray-400">
                Select a match to view/enter scores.
              </div>
            ) : (
              <div className="space-y-4">
                <ScorecardCard
                  match={match}
                  teams={teams}
                  course={course}
                  config={config}
                  interactive={isAdmin}
                  onScoreChange={(pid, hole, val) => setMatchScore(match.id, pid, hole, val)}
                />
                <ScoreSummary match={match} teams={teams} course={course} config={config} />
                {isAdmin ? (
                  <div className="card">
                    <label className="label">Match Result</label>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="e.g. Billy Baroo wins 3&2"
                        value={match.result ?? ''}
                        onChange={e => updateMatch(match.id, { result: e.target.value })}
                      />
                    </div>
                  </div>
                ) : match.result ? (
                  <div className="card">
                    <label className="label">Match Result</label>
                    <p className="text-sm font-semibold text-masters-dark">{match.result}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreSummary({ match, teams, course, config }: { match: any, teams: any, course: any, config: any }) {
  const allPlayers = teams.flatMap((t: any) => t.players)

  const allPlayerIds = [
    ...match.twosome1.playerIds,
    ...match.twosome2.playerIds,
  ]

  return (
    <div className="card">
      <h3 className="section-header text-base">Score Summary</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-masters-light">
              <th className="p-2 text-left">Player</th>
              <th className="p-2">HDCP</th>
              <th className="p-2">Gross</th>
              <th className="p-2">Net</th>
              {config.format === 'points_round' && <th className="p-2">Points</th>}
              {config.format === 'points_round' && <th className="p-2">Quota</th>}
            </tr>
          </thead>
          <tbody>
            {allPlayerIds.map((pid: string) => {
              const player = allPlayers.find((p: any) => p.id === pid)
              if (!player) return null
              const hdcp = getPlayerCourseHdcp(player, course, config.tee, config.round)
              const scores = match.scores[pid] ?? {}
              const gross = Object.values(scores).reduce((s: number, v: any) => s + (v ?? 0), 0) as number
              const net = gross - hdcp

              let pts = 0
              if (config.format === 'points_round') {
                course.holes.forEach((h: any) => {
                  const g = scores[h.number]
                  if (g != null) {
                    const dots = getStrokeDots(hdcp, h.hdcpOrder)
                    const strokes = dots === '..' ? 2 : dots === '.' ? 1 : 0
                    const p = stablefordPoints(g, h.par, strokes)
                    pts += p
                  }
                })
              }

              const quota = 36 - hdcp

              return (
                <tr key={pid} className="border-t">
                  <td className="p-2 font-semibold">{player.name}</td>
                  <td className="p-2 text-center">{hdcp}</td>
                  <td className="p-2 text-center">{gross || '–'}</td>
                  <td className="p-2 text-center">{gross ? net : '–'}</td>
                  {config.format === 'points_round' && <td className="p-2 text-center font-bold text-masters-green">{pts.toFixed(1)}</td>}
                  {config.format === 'points_round' && <td className="p-2 text-center">{quota}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
