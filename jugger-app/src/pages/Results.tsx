import { Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { Flag } from 'lucide-react'

const ROUND_LABELS: Record<number, string> = {
  1: 'Round 1 – Team Match Play',
  2: 'Round 2 – Points Round',
  3: 'Round 3 – Texas Scramble',
  4: 'Round 4 – Individual Match Play',
  5: "Round 5 – Captain's Choice",
}

const MAX_PTS: Record<number, number> = { 1: 9, 2: 15, 3: 7, 4: 12, 5: 7 }

export default function Results() {
  const { teams, teamScores, setTeamScore } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const totals = teams.map(t => ({
    team: t,
    byRound: [1, 2, 3, 4, 5].map(r => teamScores.find(s => s.teamId === t.id && s.round === r)?.points ?? 0),
    total: teamScores.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.points, 0),
  })).sort((a, b) => b.total - a.total)

  function setScore(teamId: string, round: number, pts: number) {
    if (!isAdmin) return
    setTeamScore({ teamId, round, points: pts })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Team Results</h1>
        <Link to="/ctp" className="flex items-center gap-1.5 btn-ghost text-sm">
          <Flag size={14} /> Par 3 CTP →
        </Link>
      </div>

      {/* Standings table */}
      <div className="card overflow-x-auto">
        <h2 className="section-header">Team Standings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-masters-light">
              <th className="p-2 text-left">Team</th>
              {[1, 2, 3, 4, 5].map(r => (
                <th key={r} className="p-2 text-center">
                  <div>R{r}</div>
                  <div className="text-xs text-gray-400 font-normal">/{MAX_PTS[r] ?? '?'}</div>
                </th>
              ))}
              <th className="p-2 text-center font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.map(({ team, byRound, total }, idx) => (
              <tr key={team.id} className={idx === 0 ? 'bg-yellow-50' : ''}>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {idx === 0 && <span className="text-masters-gold">🏆</span>}
                    <div className="w-3 h-3 rounded-full" style={{ background: team.color }} />
                    <span className="font-semibold">{team.name}</span>
                  </div>
                </td>
                {[1, 2, 3, 4, 5].map((r, ri) => (
                  <td key={r} className="p-2 text-center">
                    {isAdmin ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-14 border border-gray-200 rounded text-center text-sm px-1 py-0.5"
                        value={byRound[ri] || ''}
                        placeholder="0"
                        onChange={e => setScore(team.id, r, parseFloat(e.target.value) || 0)}
                      />
                    ) : (
                      <span className="font-semibold">{byRound[ri] || 0}</span>
                    )}
                  </td>
                ))}
                <td className="p-2 text-center font-bold text-lg text-masters-dark">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
