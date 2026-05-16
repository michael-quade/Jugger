import type { Match, Team, Course, RoundConfig } from '../types'
import { getPlayerCourseHdcp, getStrokeDots } from '../utils/handicap'
import { getPlayerName } from '../utils/pairings'

interface Props {
  match: Match
  teams: Team[]
  course: Course
  config: RoundConfig
  interactive?: boolean
  onScoreChange?: (playerId: string, hole: number, val: number | null) => void
}

const ROUND_LABELS: Record<string, string> = {
  team_match_play:   'Team Match Play · Two vs Two · Best Ball Net',
  points_round:      'Points Round · Gross Stableford · Dbl Bogey=½ Bogey=1 Par=2 Birdie=4 Eagle=6',
  texas_scramble:    'Texas Scramble · 60% HDCP · Best 1/2/3/4 balls by hole range',
  individual_match:  'Individual Match Play · Net Scoring · Each match = 1pt',
  captains_choice:   "Captain's Choice · 15% Team HDCP · Min 3 tee balls per player",
}

export default function ScorecardCard({ match, teams, course, config, interactive, onScoreChange }: Props) {
  const allPlayers = teams.flatMap(t => t.players)
  const teeData = course.tees.find(t => t.name === config.tee) ?? course.tees[0]

  const allPlayerIds = [
    ...match.twosome1.playerIds,
    ...match.twosome2.playerIds,
  ]

  const playerHdcps: Record<string, number> = {}
  allPlayerIds.forEach(pid => {
    const player = allPlayers.find(p => p.id === pid)
    if (player) {
      playerHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round)
    }
  })

  const front = course.holes.slice(0, 9)
  const back  = course.holes.slice(9, 18)
  const frontPar = front.reduce((s, h) => s + h.par, 0)
  const backPar  = back.reduce((s, h) => s + h.par, 0)
  const frontYds = front.reduce((s, h) => s + (h.yardages[config.tee] ?? 0), 0)
  const backYds  = back.reduce((s, h) => s + (h.yardages[config.tee] ?? 0), 0)

  function teamLabel(twosome: typeof match.twosome1) {
    const team = teams.find(t => t.id === twosome.teamId)
    return team?.name ?? twosome.teamId
  }

  return (
    <div className="scorecard-half bg-white p-2 text-xs">
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <span className="font-serif font-bold text-sm text-masters-dark">{course.name}</span>
          {config.date && <span className="ml-2 text-gray-500">{config.date}</span>}
          {config.teeTimes && (() => {
            const matchIdx = match.label === 'Match A' ? 0 : match.label === 'Match B' ? 1 : match.label === 'Match C' ? 2 : 0
            const t = config.teeTimes![matchIdx as 0 | 1 | 2]
            if (!t) return null
            const [h, m] = t.split(':').map(Number)
            const ampm = h >= 12 ? 'PM' : 'AM'
            const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
            return <span className="ml-2 text-gray-500">{h12}:{String(m).padStart(2,'0')} {ampm}</span>
          })()}
        </div>
        <div className="text-right">
          <div className="font-semibold text-masters-green">{match.label}{match.isBlind ? ' (Blind)' : ''}</div>
          <div className="text-gray-500 text-[10px]">
            {teamLabel(match.twosome1)} vs {teamLabel(match.twosome2)}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-gray-500 italic mb-1">{ROUND_LABELS[config.format]}</div>

      {/* Scorecard table */}
      <table className="scorecard-table">
        <thead>
          <tr>
            <th className="player-name">Hole</th>
            {course.holes.map(h => (
              <th key={h.number} className={h.number === 9 || h.number === 18 ? 'hole-out' : ''}>
                {h.number}
              </th>
            ))}
            <th className="hole-out">Out</th>
            <th className="hole-in">In</th>
            <th className="hole-total">Tot</th>
          </tr>
        </thead>
        <tbody>
          {/* Par row */}
          <tr className="row-par">
            <td className="player-name text-gray-500">Par</td>
            {course.holes.map(h => <td key={h.number}>{h.par}</td>)}
            <td className="hole-out">{frontPar}</td>
            <td className="hole-in">{backPar}</td>
            <td className="hole-total">{frontPar + backPar}</td>
          </tr>

          {/* Yardage row */}
          <tr>
            <td className="player-name text-gray-400">{teeData.name} {teeData.rating}/{teeData.slope}</td>
            {course.holes.map(h => <td key={h.number} className="text-gray-500">{h.yardages[config.tee] ?? '–'}</td>)}
            <td className="hole-out text-gray-500">{frontYds || '–'}</td>
            <td className="hole-in text-gray-500">{backYds || '–'}</td>
            <td className="hole-total text-gray-500">{frontYds + backYds || '–'}</td>
          </tr>

          {/* HDCP order row */}
          <tr className="row-hdcp">
            <td className="player-name">HDCP</td>
            {course.holes.map(h => <td key={h.number}>{h.hdcpOrder}</td>)}
            <td /><td /><td />
          </tr>

          {/* Twosome 1 players */}
          <PlayerRow twosome={match.twosome1} index={0} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />
          <PlayerRow twosome={match.twosome1} index={1} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />

          {/* Match result row */}
          <tr className="row-result">
            <td className="player-name text-gray-400">+/− Holes</td>
            {course.holes.map(h => <td key={h.number} />)}
            <td /><td /><td />
          </tr>

          {/* Twosome 2 players */}
          <PlayerRow twosome={match.twosome2} index={0} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />
          <PlayerRow twosome={match.twosome2} index={1} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />

          {/* Match result row */}
          <tr className="row-result">
            <td className="player-name text-gray-400">+/− Holes</td>
            {course.holes.map(h => <td key={h.number} />)}
            <td /><td /><td />
          </tr>
        </tbody>
      </table>

      {/* Rules note */}
      <div className="mt-1 text-[9px] text-gray-400 italic">
        * {ROUND_LABELS[config.format]}
      </div>
    </div>
  )
}

interface PlayerRowProps {
  twosome: Match['twosome1']
  index: 0 | 1
  playerHdcps: Record<string, number>
  course: Course
  config: RoundConfig
  teams: Team[]
  match: Match
  interactive: boolean
  onScoreChange?: (playerId: string, hole: number, val: number | null) => void
}

function PlayerRow({ twosome, index, playerHdcps, course, config, teams, match, interactive, onScoreChange }: PlayerRowProps) {
  const pid = twosome.playerIds[index]
  const hdcp = playerHdcps[pid] ?? 0
  const name = getPlayerName(teams, pid)
  const team = teams.find(t => t.id === twosome.teamId)
  const playerScores = match.scores[pid] ?? {}

  const frontGross = course.holes.slice(0, 9).reduce((s, h) => s + (playerScores[h.number] ?? 0), 0)
  const backGross  = course.holes.slice(9).reduce((s, h) => s + (playerScores[h.number] ?? 0), 0)

  return (
    <tr className="row-player">
      <td className="player-name">
        <span style={{ color: team?.color ?? '#333' }} className="font-bold">
          {name.split(' ').map((n, i) => i === 0 ? n[0] + '. ' : n).join('')}
        </span>
        <span className="text-gray-500 ml-1">({hdcp})</span>
      </td>
      {course.holes.map(h => {
        const dots = getStrokeDots(hdcp, h.hdcpOrder)
        const score = playerScores[h.number]
        return (
          <td key={h.number} className={dots ? 'dot-cell' : ''}>
            {interactive && onScoreChange ? (
              <input
                type="number"
                min={1}
                max={12}
                value={score ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value)
                  onScoreChange(pid, h.number, v)
                }}
                className="w-full border-none text-center text-xs bg-transparent"
                placeholder={dots || ''}
              />
            ) : (
              score !== undefined && score !== null
                ? String(score)
                : <span className="text-masters-green opacity-60">{dots}</span>
            )}
          </td>
        )
      })}
      <td className="hole-out">{frontGross || ''}</td>
      <td className="hole-in">{backGross || ''}</td>
      <td className="hole-total">{frontGross + backGross || ''}</td>
    </tr>
  )
}
