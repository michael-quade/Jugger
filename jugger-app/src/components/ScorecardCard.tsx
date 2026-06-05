import type { Match, Team, Course, RoundConfig, Player } from '../types'
import { getPlayerCourseHdcp, getStrokeDots, tournamentHdcp } from '../utils/handicap'
import { getPlayerName } from '../utils/pairings'
import { computeMatchPlay, computePointsRound, type MatchPlayResult, type PointsRoundResult } from '../utils/matchplay'

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
  points_round:      'Points Round · Gross Stableford · Bogey=1 Par=2 Birdie=4 Eagle=6 · Closest to Quota wins',
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

  // Use all 12 tournament players for minIndex netting
  const playerHdcps: Record<string, number> = {}
  allPlayerIds.forEach(pid => {
    const player = allPlayers.find(p => p.id === pid)
    if (player) {
      playerHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
    }
  })

  // R5 (Captain's Choice): all 4 match players share the team HDCP = round(Σ individual R5 HDCPs × 15%)
  if (config.format === 'captains_choice') {
    const teeData = course.tees.find(t => t.name === config.tee) ?? course.tees[0]
    const minIndex = allPlayers.length > 0 ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
    const matchPlayerList = allPlayerIds
      .map(pid => allPlayers.find(p => p.id === pid))
      .filter((p): p is Player => !!p)
    const r5Sum = matchPlayerList.reduce(
      (s, p) => s + tournamentHdcp(p.handicapIndex, teeData.slope, teeData.rating, course.par, minIndex, false),
      0,
    )
    const teamHdcp = Math.round(r5Sum * 0.15)
    allPlayerIds.forEach(pid => { playerHdcps[pid] = teamHdcp })
  }

  const front = course.holes.slice(0, 9)
  const back  = course.holes.slice(9, 18)
  const frontPar = front.reduce((s, h) => s + h.par, 0)
  const backPar  = back.reduce((s, h) => s + h.par, 0)
  const frontYds = front.reduce((s, h) => s + (h.yardages[config.tee] ?? 0), 0)
  const backYds  = back.reduce((s, h) => s + (h.yardages[config.tee] ?? 0), 0)

  const isMatchPlay = config.format === 'team_match_play'
  const isPointsRound = config.format === 'points_round'
  const mpResult = isMatchPlay ? computeMatchPlay(match, course.holes, playerHdcps) : null
  const prResult = isPointsRound ? computePointsRound(match, course.holes, playerHdcps) : null

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

          {/* Result row — twosome1 perspective */}
          {isMatchPlay && mpResult ? (
            <MatchPlayResultRow perspective="twosome1" result={mpResult} course={course} twosome={match.twosome1} teams={teams} />
          ) : isPointsRound && prResult ? (
            <PointsRoundRow perspective="twosome1" result={prResult} course={course} twosome={match.twosome1} teams={teams} hasMagicBall={match.magicBall1} />
          ) : (
            <tr className="row-result">
              <td className="player-name text-gray-400">+/− Holes</td>
              {course.holes.map(h => <td key={h.number} />)}
              <td /><td /><td />
            </tr>
          )}

          {/* Twosome 2 players */}
          <PlayerRow twosome={match.twosome2} index={0} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />
          <PlayerRow twosome={match.twosome2} index={1} playerHdcps={playerHdcps} course={course} config={config} teams={teams} match={match} interactive={!!interactive} onScoreChange={onScoreChange} />

          {/* Result row — twosome2 perspective */}
          {isMatchPlay && mpResult ? (
            <MatchPlayResultRow perspective="twosome2" result={mpResult} course={course} twosome={match.twosome2} teams={teams} />
          ) : isPointsRound && prResult ? (
            <PointsRoundRow perspective="twosome2" result={prResult} course={course} twosome={match.twosome2} teams={teams} hasMagicBall={match.magicBall2} />
          ) : (
            <tr className="row-result">
              <td className="player-name text-gray-400">+/− Holes</td>
              {course.holes.map(h => <td key={h.number} />)}
              <td /><td /><td />
            </tr>
          )}
        </tbody>
      </table>

      {/* Winner banners */}
      {isMatchPlay && mpResult?.winner && (
        <MatchWinnerBanner result={mpResult} match={match} teams={teams} />
      )}
      {isPointsRound && prResult?.winner && (
        <PointsRoundWinnerBanner result={prResult} match={match} teams={teams} />
      )}

      {/* Rules note */}
      <div className="mt-1 text-[9px] text-gray-400 italic">
        * {ROUND_LABELS[config.format]}
      </div>
    </div>
  )
}

// ─── Match Play Result Row ────────────────────────────────────────────────────

interface MatchPlayResultRowProps {
  perspective: 'twosome1' | 'twosome2'
  result: MatchPlayResult
  course: Course
  twosome: Match['twosome1']
  teams: Team[]
}

function MatchPlayResultRow({ perspective, result, course, twosome, teams }: MatchPlayResultRowProps) {
  const team = teams.find(t => t.id === twosome.teamId)
  const color = team?.color ?? '#9ca3af'

  function cellContent(i: number) {
    const res = result.holeResults[i]
    if (res === null) return null

    const fromPov = perspective === 'twosome1' ? res : (res === 'w1' ? 'w2' : res === 'w2' ? 'w1' : 'h')
    const r = perspective === 'twosome1' ? result.running[i] : -result.running[i]

    const holeLabel = fromPov === 'w1' ? 'W' : fromPov === 'w2' ? 'L' : '—'
    const holeClass = fromPov === 'w1' ? 'text-masters-green' : fromPov === 'w2' ? 'text-red-500' : 'text-gray-400'

    const cumLabel = r > 0 ? `+${r}` : r < 0 ? `${r}` : 'AS'
    const cumClass = r > 0 ? 'text-masters-green' : r < 0 ? 'text-red-500' : 'text-gray-400'

    return (
      <div className="flex flex-col items-center gap-[1px]">
        <span className={`text-[8px] font-bold leading-none ${holeClass}`}>{holeLabel}</span>
        <span className={`text-[7px] font-semibold leading-none ${cumClass}`}>{cumLabel}</span>
      </div>
    )
  }

  function runningDisplay(runningVal: number) {
    const r = perspective === 'twosome1' ? runningVal : -runningVal
    if (r > 0) return <span className="text-[8px] font-bold text-masters-green leading-none">+{r}</span>
    if (r < 0) return <span className="text-[8px] font-bold text-red-500 leading-none">{r}</span>
    return <span className="text-[8px] text-gray-400 leading-none">AS</span>
  }

  // Cumulative after front 9 (index 8) and after hole 18 (index 17)
  const frontRunning = result.holeResults[8] !== null ? result.running[8] : undefined
  const totalRunning = result.holeResults[17] !== null ? result.running[17] : undefined

  let totDisplay = null
  if (result.winner) {
    const iWon = (perspective === 'twosome1' && result.winner === 'twosome1') ||
                 (perspective === 'twosome2' && result.winner === 'twosome2')
    if (result.winner === 'all_square') {
      totDisplay = <span className="text-[8px] text-gray-500 font-bold leading-none">AS</span>
    } else {
      totDisplay = <span className={`text-[8px] font-bold leading-none ${iWon ? 'text-masters-green' : 'text-red-500'}`}>
        {result.winLabel}
      </span>
    }
  } else if (totalRunning !== undefined) {
    totDisplay = runningDisplay(totalRunning)
  }

  return (
    <tr className="row-result">
      <td className="player-name text-[9px] font-semibold" style={{ color }}>
        {team?.name ?? ''} +/−
      </td>
      {course.holes.map((h, i) => (
        <td key={h.number}>{cellContent(i)}</td>
      ))}
      <td className="hole-out">
        {frontRunning !== undefined && runningDisplay(frontRunning)}
      </td>
      <td className="hole-in" />
      <td className="hole-total">{totDisplay}</td>
    </tr>
  )
}

// ─── Match Winner Banner ──────────────────────────────────────────────────────

function MatchWinnerBanner({ result, match, teams }: { result: MatchPlayResult; match: Match; teams: Team[] }) {
  if (result.winner === 'all_square') {
    return (
      <div className="mt-1.5 py-1 px-2 rounded text-[10px] text-center font-bold bg-gray-50 border border-gray-200 text-gray-600">
        Match All Square after 18
      </div>
    )
  }

  const winnerTwosome = result.winner === 'twosome1' ? match.twosome1 : match.twosome2
  const winnerTeam = teams.find(t => t.id === winnerTwosome.teamId)

  return (
    <div className="mt-1.5 py-1 px-2 rounded text-[10px] text-center font-bold bg-masters-light border border-masters-green/30">
      <span style={{ color: winnerTeam?.color ?? '#006747' }}>{winnerTeam?.name ?? 'Team'}</span>
      <span className="text-masters-dark"> wins {result.winLabel}</span>
    </div>
  )
}

// ─── Points Round Result Row ─────────────────────────────────────────────────

interface PointsRoundRowProps {
  perspective: 'twosome1' | 'twosome2'
  result: PointsRoundResult
  course: Course
  twosome: Match['twosome1']
  teams: Team[]
  hasMagicBall?: boolean
}

function fmtPts(pts: number): string {
  if (pts === 0.5) return '½'
  return String(pts)
}

function PointsRoundRow({ perspective, result, course, twosome, teams, hasMagicBall }: PointsRoundRowProps) {
  const team = teams.find(t => t.id === twosome.teamId)
  const color = team?.color ?? '#9ca3af'

  const holePoints = perspective === 'twosome1' ? result.holePoints1 : result.holePoints2
  const running    = perspective === 'twosome1' ? result.running1    : result.running2
  const total      = perspective === 'twosome1' ? result.total1      : result.total2
  const quota      = perspective === 'twosome1' ? result.quota1      : result.quota2

  const frontPts = holePoints.slice(0, 9).reduce<number>((s, p) => s + (p ?? 0), 0)
  const backPts  = holePoints.slice(9).reduce<number>((s, p) => s + (p ?? 0), 0)
  const hasAnyFront = holePoints.slice(0, 9).some(p => p !== null)
  const hasAnyBack  = holePoints.slice(9).some(p => p !== null)
  const vsQuota  = total - quota
  const metQuota = total >= quota

  return (
    <tr className="row-result">
      <td className="player-name">
        <div className="flex items-center gap-1 text-[9px] font-semibold" style={{ color }}>
          {team?.name ?? ''}
          {hasMagicBall && <span className="text-amber-500 text-[8px]">★MB</span>}
        </div>
        <div className="text-[10px] font-semibold text-gray-500">Quota: {quota}</div>
      </td>
      {course.holes.map((h, i) => {
        const pts = holePoints[i]
        if (pts === null) return <td key={h.number} />
        const run = running[i]
        return (
          <td key={h.number}>
            <div className="flex flex-col items-center gap-[1px]">
              <span className={`text-[8px] font-bold leading-none ${pts === 0 ? 'text-gray-300' : 'text-masters-dark'}`}>
                {fmtPts(pts)}
              </span>
              <span className={`text-[7px] font-semibold leading-none ${run >= quota ? 'text-masters-green' : 'text-gray-500'}`}>
                {run}
              </span>
            </div>
          </td>
        )
      })}
      <td className="hole-out">
        {hasAnyFront && (
          <span className="text-[8px] font-bold text-masters-dark">{fmtPts(frontPts)}</span>
        )}
      </td>
      <td className="hole-in">
        {hasAnyBack && (
          <span className="text-[8px] font-bold text-masters-dark">{fmtPts(backPts)}</span>
        )}
      </td>
      <td className="hole-total">
        {total > 0 && (
          <div className="flex flex-col items-center gap-[1px]">
            <span className={`text-[8px] font-bold leading-none ${metQuota ? 'text-masters-green' : 'text-red-500'}`}>
              {total}
            </span>
            <span className={`text-[7px] leading-none ${metQuota ? 'text-masters-green' : 'text-red-400'}`}>
              {vsQuota >= 0 ? `+${vsQuota}` : `${vsQuota}`}
            </span>
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Points Round Winner Banner ───────────────────────────────────────────────

function PointsRoundWinnerBanner({ result, match, teams }: { result: PointsRoundResult; match: Match; teams: Team[] }) {
  if (result.winner === 'all_square') {
    return (
      <div className="mt-1.5 py-1 px-2 rounded text-[10px] text-center font-bold bg-gray-50 border border-gray-200 text-gray-600">
        {result.winLabel}
      </div>
    )
  }

  const winTwosome = result.winner === 'twosome1' ? match.twosome1 : match.twosome2
  const loseTwosome = result.winner === 'twosome1' ? match.twosome2 : match.twosome1
  const winTotal = result.winner === 'twosome1' ? result.total1 : result.total2
  const loseTotal = result.winner === 'twosome1' ? result.total2 : result.total1
  const winQuota = result.winner === 'twosome1' ? result.quota1 : result.quota2
  const loseQuota = result.winner === 'twosome1' ? result.quota2 : result.quota1
  const winTeam = teams.find(t => t.id === winTwosome.teamId)
  const loseTeam = teams.find(t => t.id === loseTwosome.teamId)
  const winDiff = winTotal - winQuota
  const loseDiff = loseTotal - loseQuota

  return (
    <div className="mt-1.5 py-1 px-2 rounded text-[10px] text-center bg-masters-light border border-masters-green/30 space-y-0.5">
      <div className="font-bold">
        <span style={{ color: winTeam?.color ?? '#006747' }}>{winTeam?.name ?? 'Team'}</span>
        <span className="text-masters-dark"> wins — </span>
        <span className="text-masters-green">{winTotal} pts</span>
        <span className="text-gray-500"> ({winDiff >= 0 ? '+' : ''}{winDiff} vs Q:{winQuota})</span>
      </div>
      <div className="text-gray-500">
        <span style={{ color: loseTeam?.color ?? '#666' }}>{loseTeam?.name ?? 'Team'}</span>
        <span> {loseTotal} pts ({loseDiff >= 0 ? '+' : ''}{loseDiff} vs Q:{loseQuota})</span>
      </div>
    </div>
  )
}

// ─── Player Row ───────────────────────────────────────────────────────────────

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
  // Points round: no per-hole strokes — HDCP only affects quota
  const noPerHoleStrokes = config.format === 'points_round'

  function holeStrokes(h: Course['holes'][number]) {
    if (noPerHoleStrokes) return 0
    const d = getStrokeDots(hdcp, h.hdcpOrder)
    return d === '..' ? 2 : d === '.' ? 1 : 0
  }

  const frontHoles = course.holes.slice(0, 9)
  const backHoles  = course.holes.slice(9)

  const frontGross   = frontHoles.reduce((s, h) => s + (playerScores[h.number] ?? 0), 0)
  const backGross    = backHoles.reduce((s, h) => s + (playerScores[h.number] ?? 0), 0)
  const frontStrokes = frontHoles.reduce((s, h) => s + holeStrokes(h), 0)
  const backStrokes  = backHoles.reduce((s, h) => s + holeStrokes(h), 0)
  const frontNet     = frontGross ? frontGross - frontStrokes : 0
  const backNet      = backGross  ? backGross  - backStrokes  : 0

  return (
    <tr className="row-player">
      <td className="player-name">
        <span style={{ color: team?.color ?? '#333' }} className="font-bold">
          {name.split(' ').map((n, i) => i === 0 ? n[0] + '. ' : n).join('')}
        </span>
        <span className="text-gray-500 ml-1">({hdcp})</span>
      </td>
      {course.holes.map(h => {
        const dots    = noPerHoleStrokes ? '' : getStrokeDots(hdcp, h.hdcpOrder)
        const strokes = holeStrokes(h)
        const score   = playerScores[h.number]
        const net     = score != null && strokes > 0 ? score - strokes : null

        return (
          <td key={h.number} className={dots ? 'dot-cell' : ''}>
            {interactive && onScoreChange ? (
              <div className="flex flex-col items-center leading-none">
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
                {net != null && (
                  <span className="text-[8px] font-bold text-masters-green leading-none">{net}</span>
                )}
              </div>
            ) : score != null ? (
              <div className="flex flex-col items-center leading-none">
                <span>{score}</span>
                {net != null && (
                  <span className="text-[8px] font-bold text-masters-green leading-none">{net}</span>
                )}
              </div>
            ) : (
              <span className="text-masters-green opacity-60">{dots}</span>
            )}
          </td>
        )
      })}
      <td className="hole-out">
        {frontGross ? (
          <div className="flex flex-col items-center leading-none">
            <span>{frontGross}</span>
            {frontStrokes > 0 && <span className="text-[8px] font-bold text-masters-green leading-none">{frontNet}</span>}
          </div>
        ) : ''}
      </td>
      <td className="hole-in">
        {backGross ? (
          <div className="flex flex-col items-center leading-none">
            <span>{backGross}</span>
            {backStrokes > 0 && <span className="text-[8px] font-bold text-masters-green leading-none">{backNet}</span>}
          </div>
        ) : ''}
      </td>
      <td className="hole-total">
        {frontGross + backGross ? (
          <div className="flex flex-col items-center leading-none">
            <span>{frontGross + backGross}</span>
            {(frontStrokes + backStrokes) > 0 && (
              <span className="text-[8px] font-bold text-masters-green leading-none">{frontNet + backNet}</span>
            )}
          </div>
        ) : ''}
      </td>
    </tr>
  )
}
