import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import AdminLoginCard from '../components/AdminLoginCard'
import AdminPanel from '../components/AdminPanel'
import { Users, MapPin, Shuffle, Trophy, Lock, Unlock } from 'lucide-react'

const ROUND_FORMATS: Record<string, string> = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice: "Captain's Choice",
}

export default function Dashboard() {
  const { year, setYear, teams, roundConfigs, matches, teamScores, hdcpLocked, lockHandicaps } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  const totalMatches = matches.length
  const scoredMatches = matches.filter(m => Object.keys(m.scores).length > 0).length

  const standings = teams.map(t => {
    const pts = teamScores.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.points, 0)
    return { team: t, points: pts }
  }).sort((a, b) => b.points - a.points)

  return (
    <div className="space-y-6">
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

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

      {/* Admin login card */}
      <AdminLoginCard onManageAdmins={() => setShowAdminPanel(true)} />

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label="Players" value={teams.reduce((s, t) => s + t.players.length, 0)} to="/teams" />
        <StatCard icon={<MapPin size={20} />} label="Courses" value={4} to="/courses" />
        <StatCard icon={<Shuffle size={20} />} label="Matches" value={`${scoredMatches}/${totalMatches}`} to="/pairings" sub={totalMatches === 0 ? 'Not generated' : undefined} />
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
              <div key={rc.round} className="flex items-center gap-3 py-2">
                <span className="badge bg-masters-green text-white w-16 text-center">
                  Round {rc.round}
                </span>
                <div className="flex-1">
                  <span className="font-semibold text-sm">{ROUND_FORMATS[rc.format] ?? rc.format}</span>
                  <span className="text-gray-400 text-xs ml-2">{rc.courseId.replace(/-/g, ' ')}</span>
                </div>
                {rc.date && <span className="text-xs text-gray-500">{new Date(rc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
                {rc.teeTimes?.[0] && (() => {
                  const [h, m] = rc.teeTimes![0].split(':').map(Number)
                  const ampm = h >= 12 ? 'PM' : 'AM'
                  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                  return <span className="text-xs text-masters-gold font-semibold">{h12}:{String(m).padStart(2,'0')} {ampm}</span>
                })()}
              </div>
            ))}
        </div>
      </div>

      {/* Team rosters */}
      <div className="grid md:grid-cols-3 gap-4">
        {teams.map(team => (
          <div key={team.id} className="card border-t-4" style={{ borderTopColor: team.color }}>
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
          </div>
        ))}
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
