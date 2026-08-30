// ─── MOBILE SCORING ────────────────────────────────────────────────────────────
// Full-screen hole-by-hole scoring for mobile. Self-contained in this file.
// To revert: delete this file, remove the route from App.tsx, and remove
// the "Score Hole-by-Hole" link from ScorecardView.tsx.
// ───────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react'
import { useTournamentStore, DEFAULT_GAME_CONFIG } from '../store/useTournamentStore'
import { useCanEnterScores, useIsAdmin, useAuthStore } from '../store/useAuthStore'
import {
  getPlayerCourseHdcp,
  computeAllCourseHdcps,
  getStrokeDots,
  tournamentHdcp,
  getPlayOrderHoles,
} from '../utils/handicap'
import {
  computeMatchPlay,
  computePointsRound,
  computeScramble,
  computeIndividualMatch,
  computeCaptainsChoice,
  computeVegas,
  scrambleBallCount,
  splitFinishPoints,
} from '../utils/matchplay'
import { computeSideBet } from '../utils/sideBets'
import type { Match, Player, Team, CtpEntry, HoleShotStat, ShotDirection } from '../types'

// ─── Score colour helpers ─────────────────────────────────────────────────────

type ScoreCat = 'empty' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'double'

function scoreCat(gross: number | null, par: number): ScoreCat {
  if (gross === null) return 'empty'
  const d = gross - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  return 'double'
}

const SCORE_CELL: Record<ScoreCat, string> = {
  empty:  'bg-gray-100 border-dashed border-gray-300 text-gray-300',
  eagle:  'bg-yellow-100 border-yellow-500 text-yellow-800',
  birdie: 'bg-green-100  border-green-500  text-green-800',
  par:    'bg-gray-100   border-gray-300   text-gray-700',
  bogey:  'bg-red-100    border-red-500    text-red-800',
  double: 'bg-purple-100 border-purple-500 text-purple-800',
}
const SCORE_LABEL: Record<ScoreCat, string> = {
  empty: '', eagle: 'Eagle', birdie: 'Birdie', par: 'Par', bogey: 'Bogey', double: 'Double+',
}
const SCORE_LABEL_CLS: Record<ScoreCat, string> = {
  empty:  '',
  eagle:  'bg-yellow-100 text-yellow-800',
  birdie: 'bg-green-100  text-green-800',
  par:    'bg-gray-100   text-gray-500',
  bogey:  'bg-red-100    text-red-800',
  double: 'bg-purple-100 text-purple-800',
}

function first(name: string) { return name.split(' ')[0] }

// ─── Shot stat direction config ────────────────────────────────────────────────

const SHOT_DIR_ORDER: ShotDirection[] = ['left', 'long', 'hit', 'short', 'right']
const SHOT_DIR_LABEL: Record<ShotDirection, string> = { left: '←', long: '↑', hit: '✓ Hit', short: '↓', right: '→' }
const SHOT_DIR_SYM:   Record<ShotDirection, string> = { left: '←', long: '↑', hit: '✓',    short: '↓', right: '→' }

// ─── Result bar types ─────────────────────────────────────────────────────────

interface IndividualRow { label: string; text: string; color: string }
interface TeamStanding  { teamId: string; name: string; color: string; relToPar: number | null; holesPlayed: number }

type ResultData =
  | { kind: 'individual';     rows: IndividualRow[]; }
  | { kind: 'single';         text: string; color: string; holesPlayed: number }
  | { kind: 'points';         t1Names: string; t2Names: string; t1Color: string; t2Color: string;
                               cur1: number; quota1: number; cur2: number; quota2: number }
  | { kind: 'team_standings'; standings: TeamStanding[]; currentTeamId: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileScoring() {
  const { matchId } = useParams<{ matchId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const canEnterScores = useCanEnterScores()
  const isAdmin       = useIsAdmin()
  const currentAdmin  = useAuthStore(s => s.currentAdmin)
  const currentRole   = useAuthStore(s => s.currentRole)
  const isPlayer      = currentRole === 'player'

  const {
    matches, teams, courses, roundConfigs, year,
    ctpEntries, sideBets, lockedRounds, admins, gameConfig,
    ctpTeamIds, ctpMatchIds,
    setMatchScore, updateMatch, setTeamScore, setTeamScoresBatch, setCtpEntries, setShotStat,
    setTeamHoleScore, setTeeShot,
  } = useTournamentStore()

  const gc = gameConfig ?? DEFAULT_GAME_CONFIG

  // ── URL params
  const roundParam = parseInt(searchParams.get('round') ?? '1')
  const holeParam  = parseInt(searchParams.get('hole')  ?? '1')

  // ── Local state
  const [currentHole, setCurrentHole] = useState(() => {
    // If no hole param given (or param === 1), default to match's starting hole
    if (holeParam && holeParam !== 1) return Math.max(1, Math.min(18, holeParam))
    const m = useTournamentStore.getState().matches.find(m => m.id === matchId)
    return m?.startingHole ?? 1
  })
  const [showNumpad,    setShowNumpad]    = useState(false)
  const [activePid,     setActivePid]     = useState<string | null>(null)
  const [numpadVal,     setNumpadVal]     = useState<number | null>(null)
  const [showCtp,       setShowCtp]       = useState(false)
  const [ctpSelected,   setCtpSelected]   = useState<string | null>(null)
  const [pendingStats,  setPendingStats]  = useState<Partial<HoleShotStat>>({})

  // ── Match & config
  const match = useMemo(() => matches.find(m => m.id === matchId), [matches, matchId])
  const round = match?.round ?? roundParam
  const roundConfig = useMemo(() => roundConfigs.find(rc => rc.round === round), [roundConfigs, round])
  const format = roundConfig?.format ?? 'team_match_play'
  const isTeamFormat      = format === 'texas_scramble' || format === 'captains_choice'
  const isCaptainsChoice  = format === 'captains_choice'
  const CC_TEAM_PID       = '__team__'

  // Is this the designated CTP match for this round?
  const isCtpMatch = useMemo(() => {
    if (!match || match.isBlind) return false
    if (isTeamFormat) {
      const effectiveTeamId = (ctpTeamIds ?? {})[round] ?? teams[teams.length - 1]?.id ?? ''
      return match.id === `${round}-${effectiveTeamId}`
    }
    const effectiveSuffix = (ctpMatchIds ?? {})[round] ?? 'c'
    return match.id === `${round}${effectiveSuffix}`
  }, [match, isTeamFormat, ctpTeamIds, ctpMatchIds, round, teams])

  const course = useMemo(() => courses.find(c => c.id === roundConfig?.courseId) ?? null, [courses, roundConfig])
  const tee    = roundConfig?.tee ?? ''

  const allPlayers = useMemo(() => teams.flatMap(t => t.players), [teams])

  const playerIds = useMemo(() =>
    match ? [...match.twosome1.playerIds, ...match.twosome2.playerIds] : [],
    [match]
  )

  const matchPlayerMap = useMemo(() => {
    const map: Record<string, Player> = {}
    playerIds.forEach(pid => {
      const p = allPlayers.find(pl => pl.id === pid)
      if (p) map[pid] = p
    })
    return map
  }, [playerIds, allPlayers])

  const teamOf = useCallback((pid: string): Team | undefined =>
    teams.find(t => t.players.some(p => p.id === pid)),
    [teams]
  )

  // ── Holes in play order (split-tee support)
  const playOrder = useMemo(() =>
    course ? getPlayOrderHoles(course.holes, match?.startingHole ?? 1) : [],
    [course, match?.startingHole]
  )

  // ── HDCPs for match players
  const hdcps = useMemo(() => {
    if (!course || !match) return {} as Record<string, number>
    const players = playerIds.map(pid => matchPlayerMap[pid]).filter((p): p is Player => !!p)
    return computeAllCourseHdcps(players, course, tee, round, allPlayers, format)
  }, [course, match, playerIds, matchPlayerMap, tee, round, allPlayers, format])

  // ── Hole data
  const holeData = useMemo(() => course?.holes.find(h => h.number === currentHole) ?? null, [course, currentHole])
  const par      = holeData?.par ?? 4
  const isPar3   = par === 3

  // ── Permissions
  const isLocked = lockedRounds.includes(round)
  const canScore = canEnterScores && (!isLocked || isAdmin)

  const playerRosterId = useMemo(() => {
    if (!isPlayer || !currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [isPlayer, currentAdmin, admins])

  const isPlayerInMatch = playerRosterId ? playerIds.includes(playerRosterId) : false
  const canScoreMatch   = canScore && (isAdmin || !isPlayer || isPlayerInMatch)

  // ── Score accessor
  const getScore = useCallback((pid: string, hole = currentHole) =>
    match?.scores[pid]?.[hole] ?? null,
    [match, currentHole]
  )

  // ── All scored on current hole?
  const ccTeamScore  = match?.teamHoleScores?.[currentHole] ?? null
  const allScored    = isCaptainsChoice
    ? ccTeamScore !== null
    : playerIds.length > 0 && playerIds.every(pid => getScore(pid) !== null)

  // ── CTP entry for this hole
  const ctpEntry = useMemo(() =>
    ctpEntries.find(e => e.round === round && e.hole === currentHole && e.year === year),
    [ctpEntries, round, currentHole, year]
  )

  // ── Active side bets for this match
  const activeBets = useMemo(() =>
    (sideBets ?? []).filter(b => b.matchId === matchId && (b.status === 'active' || b.status === 'pending')),
    [sideBets, matchId]
  )

  // ── Auto-show CTP picker when all 4 enter scores on a par 3 (designated CTP match only)
  const prevAllScored = useRef(false)
  useEffect(() => {
    if (isPar3 && allScored && !prevAllScored.current && !ctpEntry?.winnerName && !ctpEntry?.donatedToHio && isCtpMatch) {
      setShowCtp(true)
      setCtpSelected(null)
    }
    prevAllScored.current = allScored
  }, [allScored, isPar3, ctpEntry, isCtpMatch])

  // ── Keep ?hole= in sync with URL
  useEffect(() => {
    setSearchParams(p => {
      const n = new URLSearchParams(p)
      n.set('hole', String(currentHole))
      return n
    }, { replace: true })
  }, [currentHole, setSearchParams])

  // ── Play-order navigation helpers
  const playIdx   = useMemo(() => playOrder.findIndex(h => h.number === currentHole), [playOrder, currentHole])
  const prevHole  = playIdx > 0 ? playOrder[playIdx - 1]?.number ?? null : null
  const nextHole  = playIdx >= 0 && playIdx < playOrder.length - 1 ? playOrder[playIdx + 1]?.number ?? null : null

  // ── Swipe navigation
  const touchX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0 && nextHole !== null) goHole(nextHole)
    if (dx > 0 && prevHole !== null) goHole(prevHole)
  }

  function goHole(n: number) { setShowNumpad(false); setShowCtp(false); setCurrentHole(n) }

  // ── Numpad
  function openNumpad(pid: string) {
    if (!canScoreMatch || match?.isBlind) return
    setActivePid(pid)
    setNumpadVal(getScore(pid))
    const storedStat = match?.shotStats?.[pid]?.[currentHole]
    setPendingStats(storedStat ? { ...storedStat } : {})
    setShowNumpad(true)
    setShowCtp(false)
  }
  function openTeamNumpad() {
    if (!canScoreMatch) return
    setActivePid(CC_TEAM_PID)
    setNumpadVal(ccTeamScore)
    setShowNumpad(true)
    setShowCtp(false)
  }
  function numpadTap(n: number) {
    setNumpadVal(prev => {
      const s = String(prev ?? '') + n
      return s.length > 2 ? n : parseInt(s)
    })
  }
  function numpadDel() {
    setNumpadVal(prev => {
      const s = String(prev ?? '')
      return s.length > 1 ? parseInt(s.slice(0, -1)) : null
    })
  }
  function numpadDone() {
    if (!activePid || !matchId) { setShowNumpad(false); setActivePid(null); return }

    // Captain's Choice: save team hole score then close
    if (activePid === CC_TEAM_PID) {
      setTeamHoleScore(matchId, currentHole, numpadVal)
      setShowNumpad(false)
      setActivePid(null)
      afterScoreChange()
      if (isPar3 && !ctpEntry?.winnerName && !ctpEntry?.donatedToHio && isCtpMatch) {
        setShowCtp(true)
        setCtpSelected(null)
      }
      return
    }

    setMatchScore(matchId, activePid, currentHole, numpadVal)

    // Save shot stats (skip team formats and blind matches)
    if (!isTeamFormat && match && !match.isBlind) {
      const finalStats = { ...pendingStats }
      if (isPar3) finalStats.fairway = null  // par 3: fairway always N/A
      setShotStat(matchId, activePid, currentHole, finalStats)
    }

    afterScoreChange()

    // Auto-advance to next unscored player in sequence; keep numpad open
    const currentIdx = playerIds.indexOf(activePid)
    const nextPid = playerIds.slice(currentIdx + 1).find(pid => {
      const freshMatch = useTournamentStore.getState().matches.find(m => m.id === matchId)
      return freshMatch?.scores[pid]?.[currentHole] == null
    })

    if (nextPid) {
      setActivePid(nextPid)
      setNumpadVal(null)
      const freshMatch = useTournamentStore.getState().matches.find(m => m.id === matchId)
      const nextStored = freshMatch?.shotStats?.[nextPid]?.[currentHole]
      setPendingStats(nextStored ? { ...nextStored } : {})
    } else {
      setShowNumpad(false)
      setActivePid(null)
      setPendingStats({})
      // CTP auto-trigger fires via the allScored useEffect
    }
  }

  // ── Team score recomputation (mirrors ScorecardView logic) ──────────────────

  function afterScoreChange() {
    if (!course || !roundConfig) return
    const updated = useTournamentStore.getState().matches
    const currentMatch = updated.find(m => m.id === matchId)
    if (currentMatch && (format === 'team_match_play' || format === 'individual_match')) {
      autoUpdateResult(currentMatch)
    }
    if (format === 'individual_match') recomputeIndividual(updated)
    if (format === 'texas_scramble')   recomputeScramble(updated)
    if (format === 'captains_choice')  recomputeCaptainsChoice(updated)
    if (format === 'points_round')     recomputePointsRound(updated)
    if (format === 'vegas')            recomputeVegas(updated)
  }

  function localHdcps(m: Match): Record<string, number> {
    if (!course) return {}
    const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
    const out: Record<string, number> = {}
    pids.forEach(pid => {
      const p = allPlayers.find(pl => pl.id === pid)
      if (p) out[pid] = getPlayerCourseHdcp(p, course, tee, round, allPlayers, format)
    })
    return out
  }

  function autoUpdateResult(m: Match) {
    if (!course) return
    const mHoles = getPlayOrderHoles(course.holes, m.startingHole ?? 1)
    const lh = localHdcps(m)
    if (format === 'team_match_play') {
      const res = computeMatchPlay(m, mHoles, lh)
      if (!res.winner) return
      const t1 = teams.find(t => t.id === m.twosome1.teamId)
      const t2 = teams.find(t => t.id === m.twosome2.teamId)
      const result = res.winner === 'all_square'
        ? 'All Square'
        : `${(res.winner === 'twosome1' ? t1 : t2)?.name ?? 'Team'} wins ${res.winLabel}`
      updateMatch(m.id, { result })
    } else if (format === 'individual_match') {
      const imRes = computeIndividualMatch(m, mHoles, lh)
      const parts: string[] = []
      for (const { res, p1Id, p2Id } of [
        { res: imRes.matchA, p1Id: m.twosome1.playerIds[0], p2Id: m.twosome2.playerIds[0] },
        { res: imRes.matchB, p1Id: m.twosome1.playerIds[1], p2Id: m.twosome2.playerIds[1] },
      ]) {
        if (!res.winner) continue
        const p1 = allPlayers.find(p => p.id === p1Id)?.name.split(' ').slice(-1)[0] ?? '?'
        const p2 = allPlayers.find(p => p.id === p2Id)?.name.split(' ').slice(-1)[0] ?? '?'
        if (res.winner === 'all_square') parts.push('AS')
        else if (res.winner === 'p1') parts.push(`${p1} ${res.winLabel}`)
        else parts.push(`${p2} ${res.winLabel}`)
      }
      if (!m.isBlind && imRes.match2v2?.winner) {
        const w  = imRes.match2v2.winner
        const t1 = teams.find(t => t.id === m.twosome1.teamId)
        const t2 = teams.find(t => t.id === m.twosome2.teamId)
        if (w === 'all_square') parts.push('2v2: AS')
        else parts.push(`2v2: ${(w === 'twosome1' ? t1 : t2)?.name ?? 'Team'} ${imRes.match2v2.winLabel}`)
      }
      if (parts.length) updateMatch(m.id, { result: parts.join(' · ') })
    }
  }

  function scoresUnchanged(newScores: { teamId: string; round: number; points: number }[]): boolean {
    const cur = useTournamentStore.getState().teamScores
    return newScores.every(ns => cur.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)
  }

  function recomputeIndividual(updated: Match[]) {
    if (!course) return
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })
    updated.filter(m => m.round === round).forEach(m => {
      const lh = localHdcps(m)
      const im = computeIndividualMatch(m, getPlayOrderHoles(course.holes, m.startingHole ?? 1), lh)
      for (const { res, t1, t2 } of [
        { res: im.matchA, t1: m.twosome1.teamId, t2: m.twosome2.teamId },
        { res: im.matchB, t1: m.twosome1.teamId, t2: m.twosome2.teamId },
      ]) {
        if (!res.winner) continue
        const pts = m.isBlind ? 0.5 : 1
        if (res.winner === 'p1')         teamPts[t1] += pts
        else if (res.winner === 'p2')    teamPts[t2] += pts
        else { teamPts[t1] += pts / 2; teamPts[t2] += pts / 2 }
      }
      if (!m.isBlind && im.match2v2?.winner) {
        const w = im.match2v2.winner
        if (w === 'twosome1')         teamPts[m.twosome1.teamId] += 1
        else if (w === 'twosome2')    teamPts[m.twosome2.teamId] += 1
        else { teamPts[m.twosome1.teamId] += 0.5; teamPts[m.twosome2.teamId] += 0.5 }
      }
    })
    if (Object.values(teamPts).every(p => p === 0)) return
    const ns1 = teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 }))
    if (!scoresUnchanged(ns1)) setTeamScoresBatch(ns1)
  }

  function recomputeScramble(updated: Match[]) {
    if (!course) return
    const ms = updated.filter(m => m.round === round)
    const results = ms.map(m => ({ match: m, result: computeScramble(m, getPlayOrderHoles(course.holes, m.startingHole ?? 1), localHdcps(m)) }))
    if (!results.every(r => r.result.isDone)) return
    const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
    const PTS = [gc.teamFinish1stPts ?? 4, gc.teamFinish2ndPts ?? 2, gc.teamFinish3rdPts ?? 1]
    const split2 = splitFinishPoints(ranked.map(r => r.result.total), PTS)
    const RANK_LABELS = ['1st', '2nd', '3rd']
    ranked.forEach(({ match: m, result: r }, i) => {
      const isTied = ranked.some((o, j) => j !== i && o.result.total === r.total)
      const label = `${isTied ? 'T-' : ''}${RANK_LABELS[i]} · Net ${Math.round(r.total)}`
      if (m.result !== label) updateMatch(m.id, { result: label })
    })
    const ns2 = ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round, points: split2[i] }))
    if (!scoresUnchanged(ns2)) setTeamScoresBatch(ns2)
  }

  function recomputeCaptainsChoice(updated: Match[]) {
    if (!course) return
    const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
    const minIdx  = allPlayers.length ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
    const ms = updated.filter(m => m.round === round)
    const results = ms.map(m => {
      const pids  = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const sum   = pids.reduce((s, pid) => {
        const p = allPlayers.find(pl => pl.id === pid)
        return s + (p ? tournamentHdcp(p.handicapIndex, teeData?.slope ?? 113, teeData?.rating ?? course.par, course.par, minIdx, false) : 0)
      }, 0)
      const teamHdcp = Math.round(sum * (gc.captainsChoiceHdcpPct ?? 0.15))
      return { match: m, result: computeCaptainsChoice(m.teamHoleScores, getPlayOrderHoles(course.holes, m.startingHole ?? 1), teamHdcp) }
    })
    if (!results.every(r => r.result.isDone)) return
    const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
    const PTSC = [gc.teamFinish1stPts ?? 4, gc.teamFinish2ndPts ?? 2, gc.teamFinish3rdPts ?? 1]
    const splitC = splitFinishPoints(ranked.map(r => r.result.total), PTSC)
    const RANK_LABELSC = ['1st', '2nd', '3rd']
    ranked.forEach(({ match: m, result: r }, i) => {
      const isTied = ranked.some((o, j) => j !== i && o.result.total === r.total)
      const label = `${isTied ? 'T-' : ''}${RANK_LABELSC[i]} · Net ${Math.round(r.total)}`
      if (m.result !== label) updateMatch(m.id, { result: label })
    })
    const ns3 = ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round, points: splitC[i] }))
    if (!scoresUnchanged(ns3)) setTeamScoresBatch(ns3)
  }

  function recomputePointsRound(updated: Match[]) {
    if (!course) return
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })
    updated.filter(m => m.round === round).forEach(m => {
      const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const mHoles = getPlayOrderHoles(course.holes, m.startingHole ?? 1)
      const allDone = pids.every(pid => course.holes.every(h => m.scores[pid]?.[h.number] != null))
      if (allDone) {
        const res = computePointsRound(m, mHoles, localHdcps(m))
        const fmtD = (d: number) => d >= 0 ? `+${d}` : `${d}`
        const label = `${fmtD(res.total1 - res.quota1)} / ${fmtD(res.total2 - res.quota2)}`
        if (m.result !== label) updateMatch(m.id, { result: label })
        const pts = m.isBlind ? 1 : 2
        if (res.winner === 'twosome1')      teamPts[m.twosome1.teamId] += pts
        else if (res.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
        else if (res.winner === 'all_square') {
          teamPts[m.twosome1.teamId] += pts / 2
          teamPts[m.twosome2.teamId] += pts / 2
        }
      }
      if (!m.isBlind) {
        if (m.magicBall1) teamPts[m.twosome1.teamId] += 1
        if (m.magicBall2) teamPts[m.twosome2.teamId] += 1
      }
    })
    if (Object.values(teamPts).every(p => p === 0)) return
    const ns4 = teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 }))
    if (!scoresUnchanged(ns4)) setTeamScoresBatch(ns4)
  }

  function recomputeVegas(updated: Match[]) {
    if (!course) return
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })
    updated.filter(m => m.round === round).forEach(m => {
      const pids    = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const allDone = pids.every(pid => course.holes.every(h => m.scores[pid]?.[h.number] != null))
      if (!allDone) return
      const vRes = computeVegas(m, getPlayOrderHoles(course.holes, m.startingHole ?? 1), localHdcps(m), {
        birdieMultiplier:    gc.vegasBirdieMultiplier,
        eagleMultiplier:     gc.vegasEagleMultiplier,
        albatrossMultiplier: gc.vegasAlbatrossMultiplier,
      })
      if (!vRes.winner) return
      const pts = m.isBlind ? gc.vegasBlindMatchPts : gc.vegasRegularMatchPts
      if (vRes.winner === 'twosome1')      teamPts[m.twosome1.teamId] += pts
      else if (vRes.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
      else { teamPts[m.twosome1.teamId] += pts / 2; teamPts[m.twosome2.teamId] += pts / 2 }
    })
    if (Object.values(teamPts).every(p => p === 0)) return
    const ns5 = teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 }))
    if (!scoresUnchanged(ns5)) setTeamScoresBatch(ns5)
  }

  // ── CTP save ─────────────────────────────────────────────────────────────────
  const DONATE_SENTINEL = '__donate_hio__'

  function saveCtp() {
    if (!ctpSelected || !course) { setShowCtp(false); return }
    const base: CtpEntry = ctpEntry ?? {
      id: `ctp-mob-${year}-r${round}-h${currentHole}`,
      year, round, hole: currentHole, courseName: course.name,
    }
    const rest = ctpEntries.filter(e => !(e.round === round && e.hole === currentHole && e.year === year))
    if (ctpSelected === DONATE_SENTINEL) {
      const prizePerHole = allPlayers.length
      setCtpEntries([...rest, { ...base, donatedToHio: true, winnerName: undefined, winnerPaid: undefined, hioDonationAmount: prizePerHole }])
    } else {
      setCtpEntries([...rest, { ...base, winnerName: ctpSelected, donatedToHio: false, hioDonationAmount: undefined }])
    }
    setShowCtp(false)
  }

  // ── Result bar computation ────────────────────────────────────────────────────
  const resultData = useMemo((): ResultData | null => {
    if (!match || !course || !holeData) return null
    const holes  = playOrder.length > 0 ? playOrder : course.holes
    const GRAY   = '#6b7280'

    function runningStatus(
      runArr: number[], holesPlayed: number, winner: string | null, winLabel: string,
      leadName: string, trailName: string, leadColor: string, trailColor: string,
    ): IndividualRow['text'] & { color: string } {
      const cur = runArr[runArr.length - 1] ?? 0
      if (holesPlayed === 0) return Object.assign('Not started', { color: GRAY })
      if (winner === 'all_square' || cur === 0) return Object.assign('All Square', { color: GRAY })
      const isLead = winner === 'p1' || winner === 'twosome1' || (winner === null && cur > 0)
      const name   = isLead ? leadName : trailName
      const color  = isLead ? leadColor : trailColor
      const label  = winLabel || `up ${Math.abs(cur)}`
      return Object.assign(`${name} ${label}`, { color })
    }

    // Helper to build an IndividualRow
    function makeRow(label: string, text: string, color: string): IndividualRow {
      return { label, text, color }
    }

    if (format === 'individual_match') {
      const res  = computeIndividualMatch(match, holes, hdcps)
      const t1   = teams.find(t => t.id === match.twosome1.teamId)
      const t2   = teams.find(t => t.id === match.twosome2.teamId)
      const t1c  = t1?.color ?? '#2563EB'
      const t2c  = t2?.color ?? '#DC2626'

      const p1a  = first(allPlayers.find(p => p.id === match.twosome1.playerIds[0])?.name ?? '')
      const p1b  = first(allPlayers.find(p => p.id === match.twosome1.playerIds[1])?.name ?? '')
      const p2a  = first(allPlayers.find(p => p.id === match.twosome2.playerIds[0])?.name ?? '')
      const p2b  = first(allPlayers.find(p => p.id === match.twosome2.playerIds[1])?.name ?? '')

      const rowA = runningStatus(res.matchA.running, res.matchA.holesPlayed, res.matchA.winner, res.matchA.winLabel, p1a, p2a, t1c, t2c)
      const rowB = runningStatus(res.matchB.running, res.matchB.holesPlayed, res.matchB.winner, res.matchB.winLabel, p1b, p2b, t1c, t2c)

      const rows: IndividualRow[] = [
        makeRow(`${p1a} vs ${p2a}`, rowA, rowA.color),
        makeRow(`${p1b} vs ${p2b}`, rowB, rowB.color),
      ]

      if (!match.isBlind && res.match2v2) {
        const bb = runningStatus(
          res.match2v2.running, res.match2v2.holesPlayed,
          res.match2v2.winner === 'twosome1' ? 'twosome1' : res.match2v2.winner === 'twosome2' ? 'twosome2' : res.match2v2.winner,
          res.match2v2.winLabel,
          t1?.name ?? 'Team 1', t2?.name ?? 'Team 2', t1c, t2c,
        )
        rows.push(makeRow('Best Ball', bb, bb.color))
      }

      return { kind: 'individual', rows }
    }

    if (format === 'team_match_play') {
      const res = computeMatchPlay(match, holes, hdcps)
      const t1  = teams.find(t => t.id === match.twosome1.teamId)
      const t2  = teams.find(t => t.id === match.twosome2.teamId)
      const t1c = t1?.color ?? '#2563EB'
      const t2c = t2?.color ?? '#DC2626'
      const cur = res.running[res.running.length - 1] ?? 0
      const status = runningStatus(res.running, res.holesPlayed, res.winner, res.winLabel, t1?.name ?? 'Team 1', t2?.name ?? 'Team 2', t1c, t2c)
      return { kind: 'single', text: status, color: status.color, holesPlayed: res.holesPlayed }
    }

    if (format === 'vegas') {
      const res = computeVegas(match, holes, hdcps, {
        birdieMultiplier:    gc.vegasBirdieMultiplier,
        eagleMultiplier:     gc.vegasEagleMultiplier,
        albatrossMultiplier: gc.vegasAlbatrossMultiplier,
      })
      const t1  = teams.find(t => t.id === match.twosome1.teamId)
      const t2  = teams.find(t => t.id === match.twosome2.teamId)
      const t1c = t1?.color ?? '#2563EB'
      const t2c = t2?.color ?? '#DC2626'
      const cur = res.running[res.running.length - 1] ?? 0
      const status = runningStatus(res.running, res.holesPlayed, res.winner, res.winLabel, t1?.name ?? 'Team 1', t2?.name ?? 'Team 2', t1c, t2c)
      return { kind: 'single', text: status, color: status.color, holesPlayed: res.holesPlayed }
    }

    if (format === 'points_round') {
      const res    = computePointsRound(match, holes, hdcps)
      const t1c    = teams.find(t => t.id === match.twosome1.teamId)?.color ?? '#2563EB'
      const t2c    = teams.find(t => t.id === match.twosome2.teamId)?.color ?? '#DC2626'
      const t1Name = match.twosome1.playerIds.map(pid => first(allPlayers.find(p => p.id === pid)?.name ?? '')).join(' & ')
      const t2Name = match.twosome2.playerIds.map(pid => first(allPlayers.find(p => p.id === pid)?.name ?? '')).join(' & ')
      return {
        kind: 'points',
        t1Names: t1Name, t2Names: t2Name, t1Color: t1c, t2Color: t2c,
        cur1: res.total1, quota1: res.quota1, cur2: res.total2, quota2: res.quota2,
      }
    }

    if (isTeamFormat) {
      const teamMatches = matches.filter(m => m.round === round && !m.isBlind)
      const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
      const minIdx  = allPlayers.length ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0

      const standings: TeamStanding[] = teamMatches.map(m => {
        const pids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const lh: Record<string, number> = {}
        pids.forEach(pid => {
          const p = allPlayers.find(pl => pl.id === pid)
          if (p) lh[pid] = getPlayerCourseHdcp(p, course, tee, round, allPlayers, format)
        })
        const team = teams.find(t => t.id === m.twosome1.teamId)

        let relToPar: number | null = null
        let holesPlayed = 0

        const mHoles = getPlayOrderHoles(course.holes, m.startingHole ?? 1)
        if (format === 'texas_scramble') {
          const res = computeScramble(m, mHoles, lh)
          holesPlayed = res.holesPlayed
          if (holesPlayed > 0) {
            // Effective par = hole par × ball count (1/2/3/4 by range) since
            // res.total sums best-N scores per hole, not just 1 score per hole
            const parThru = mHoles.slice(0, holesPlayed).reduce((s, h) => s + h.par * scrambleBallCount(h.number), 0)
            relToPar = res.total - parThru
          }
        } else {
          const sum = pids.reduce((s, pid) => {
            const p = allPlayers.find(pl => pl.id === pid)
            return s + (p ? tournamentHdcp(p.handicapIndex, teeData?.slope ?? 113, teeData?.rating ?? course.par, course.par, minIdx, false) : 0)
          }, 0)
          const teamHdcp = Math.round(sum * (gc.captainsChoiceHdcpPct ?? 0.15))
          const res = computeCaptainsChoice(m.teamHoleScores, mHoles, teamHdcp)
          holesPlayed = res.holesPlayed
          if (holesPlayed > 0) {
            const parThru = holes.slice(0, holesPlayed).reduce((s, h) => s + h.par, 0)
            relToPar = res.total - parThru
          }
        }

        return { teamId: m.twosome1.teamId, name: team?.name ?? m.twosome1.teamId, color: team?.color ?? '#006747', relToPar, holesPlayed }
      })

      return { kind: 'team_standings', standings, currentTeamId: match.twosome1.teamId }
    }

    return null
  }, [match, course, holeData, format, hdcps, allPlayers, teams, matches, round, tee, gc, isTeamFormat])

  // ── Side bet strip ────────────────────────────────────────────────────────────
  const sideBetStrip = useMemo(() => {
    if (!activeBets.length || !match || !course) return null
    const bet = activeBets[0]
    const betHdcps: Record<string, number> = {}
    bet.participants.forEach(p => {
      const player = allPlayers.find(pl => pl.id === p.playerId)
      if (player) betHdcps[p.playerId] = getPlayerCourseHdcp(player, course, tee, round, allPlayers)
    })
    try {
      const result = computeSideBet(bet, match, course.holes, betHdcps)
      const sideANames = bet.participants.filter(p => p.side === 'A')
        .map(p => first(allPlayers.find(pl => pl.id === p.playerId)?.name ?? '')).join(' & ')
      const sideBNames = bet.participants.filter(p => p.side === 'B')
        .map(p => first(allPlayers.find(pl => pl.id === p.playerId)?.name ?? '')).join(' & ')

      let summary: string
      if (result.sideANet > 0) {
        summary = result.complete ? `${sideANames} +$${Math.abs(result.sideANet)}` : `${sideANames} leads`
      } else if (result.sideANet < 0) {
        summary = result.complete ? `${sideBNames} +$${Math.abs(result.sideANet)}` : `${sideBNames} leads`
      } else {
        summary = 'All Square'
      }

      return { format: bet.format, summary, betId: bet.id, count: activeBets.length }
    } catch {
      return null
    }
  }, [activeBets, match, course, allPlayers, tee, round])

  // ── CTP: all 12 players grouped by team ──────────────────────────────────────
  const ctpGroups = useMemo(() =>
    teams.map(team => ({
      team,
      players: team.players.map(player => ({
        player,
        score:   match?.scores[player.id]?.[currentHole] ?? null,
        inMatch: playerIds.includes(player.id),
      })),
    })),
    [teams, match, currentHole, playerIds]
  )

  // ── Not found guard ───────────────────────────────────────────────────────────
  if (!match || !course || !roundConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-masters-cream">
        <div className="text-center">
          <p className="text-masters-dark font-semibold mb-2">Match not found</p>
          <Link to="/scorecards" className="text-masters-green text-sm hover:underline">← Back to scorecards</Link>
        </div>
      </div>
    )
  }

  const t1 = teams.find(t => t.id === match.twosome1.teamId)
  const t2 = teams.find(t => t.id === match.twosome2.teamId)

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col min-h-screen bg-masters-cream select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-masters-dark">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            to={`/scorecards?round=${round}&match=${matchId}`}
            className="flex items-center gap-1 text-masters-gold text-sm font-bold shrink-0"
          >
            <ChevronLeft size={16} />{match.label}
          </Link>
          <div className="flex-1 text-center text-white text-sm font-bold font-serif truncate">
            {match.isBlind ? 'Blind · ' : ''}{roundConfig.label ?? `Round ${round}`}
          </div>
          <Link
            to={`/scorecards?round=${round}&match=${matchId}`}
            className="flex items-center gap-1 text-masters-gold text-sm font-bold shrink-0"
          >
            <Table2 size={14} />Table
          </Link>
        </div>
        {/* Hole info bar */}
        <div className="bg-masters-light border-t border-masters-green/20 px-4 py-2 text-center">
          <div className="text-4xl font-black text-masters-dark font-serif leading-none">{currentHole}</div>
          <div className="flex justify-center gap-3 mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <span>Par {par}</span><span>·</span>
            <span>HDCP {holeData?.hdcpOrder ?? '—'}</span><span>·</span>
            <span>{holeData?.yardages[tee] ?? '—'} yd</span>
          </div>
        </div>
      </div>

      {/* ── Hole dot strip ─────────────────────────────────────────── */}
      <div className="flex gap-1.5 justify-center px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        {Array.from({ length: 18 }, (_, i) => {
          const h       = i + 1
          const scored  = isCaptainsChoice
            ? match.teamHoleScores?.[h] != null
            : playerIds.some(pid => match.scores[pid]?.[h] != null)
          const current = h === currentHole
          return (
            <button
              key={h}
              onClick={() => goHole(h)}
              className={`rounded-full flex-shrink-0 transition-all ${
                current ? 'w-5 h-2.5 bg-masters-gold' : scored ? 'w-2.5 h-2.5 bg-masters-green' : 'w-2.5 h-2.5 bg-gray-300'
              }`}
            />
          )
        })}
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Banners */}
        {isLocked && !isAdmin && (
          <div className="mx-3 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
            🔒 Round {round} is locked — scores are read-only.
          </div>
        )}
        {match.isBlind && (
          <div className="mx-3 mt-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
            Blind match — scores sync automatically from the regular match.
          </div>
        )}

        {/* ── Captain's Choice: team score + tee shot picker ─────────── */}
        {isCaptainsChoice ? (() => {
          const team = t1
          const ccCat = scoreCat(ccTeamScore, par)
          const minTee = gc.captainsChoiceMinTeeBalls ?? 3
          const teeCounts: Record<string, number> = {}
          playerIds.forEach(pid => { teeCounts[pid] = 0 })
          if (course) {
            course.holes.forEach(h => {
              const used = match.teeShotsUsed?.[h.number]
              if (used && teeCounts[used] !== undefined) teeCounts[used]++
            })
          }
          return (
            <div className="px-3 pt-3 space-y-3">
              {/* Team score entry */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider px-1 mb-2" style={{ color: team?.color }}>
                  {team?.name} — Team Score
                </div>
                <button
                  onClick={openTeamNumpad}
                  disabled={!canScoreMatch}
                  className={`w-full flex items-center gap-3 bg-white rounded-xl px-3 py-3 border-2 transition-colors ${
                    activePid === CC_TEAM_PID ? 'border-masters-gold' : 'border-transparent'
                  } ${canScoreMatch ? 'active:bg-masters-light' : 'cursor-default'}`}
                  style={{ borderLeftColor: team?.color, borderLeftWidth: 3 }}
                >
                  <div className="flex-1 text-left">
                    <div className="text-xs text-gray-400 font-semibold">Hole {currentHole} · Par {par}</div>
                    {ccTeamScore !== null && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {ccTeamScore - par === 0 ? 'Par' : ccTeamScore - par > 0 ? `+${ccTeamScore - par}` : `${ccTeamScore - par}`}
                      </div>
                    )}
                  </div>
                  <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl font-black font-serif ${
                    ccTeamScore !== null ? SCORE_CELL[ccCat] : 'bg-gray-100 border-dashed border-gray-300 text-gray-300'
                  }`}>
                    {ccTeamScore ?? '—'}
                  </div>
                </button>
              </div>

              {/* Tee shot selector */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tee Shot Used</span>
                  {minTee > 0 && <span className="text-[10px] text-gray-400">Min {minTee} each</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {playerIds.map(pid => {
                    const player = matchPlayerMap[pid]
                    if (!player) return null
                    const selected = match.teeShotsUsed?.[currentHole] === pid
                    const count = teeCounts[pid] ?? 0
                    const met = minTee > 0 && count >= minTee
                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          if (!canScoreMatch || !matchId) return
                          setTeeShot(matchId, currentHole, selected ? '' : pid)
                        }}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border-2 transition-colors ${
                          selected
                            ? 'bg-masters-green/10 border-masters-green'
                            : 'bg-white border-gray-200 active:bg-gray-50'
                        } ${canScoreMatch ? '' : 'cursor-default'}`}
                      >
                        <div className="flex-1 text-left">
                          <div className={`text-sm font-bold ${selected ? 'text-masters-green' : 'text-masters-dark'}`}>
                            {first(player.name)}
                          </div>
                          {minTee > 0 && (
                            <div className={`text-[10px] font-semibold ${met ? 'text-green-600' : count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {count}/{minTee} {met ? '✓' : 'balls'}
                            </div>
                          )}
                        </div>
                        {selected && (
                          <div className="w-4 h-4 rounded-full bg-masters-green flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })() : (
        /* ── Player rows (all other formats) ──────────────────────── */
        <div className="px-3 pt-3 space-y-2">
          {/* Twosome 1 */}
          <div className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: t1?.color }}>
            {t1?.name}
          </div>
          {match.twosome1.playerIds.map(pid => <PlayerRow key={pid} pid={pid} />)}

          <div className="h-px bg-gray-200 mx-1" />

          {/* Twosome 2 */}
          <div className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: t2?.color }}>
            {t2?.name}
          </div>
          {match.twosome2.playerIds.map(pid => <PlayerRow key={pid} pid={pid} />)}
        </div>
        )}

        {/* ── Result bar ─────────────────────────────────────────────── */}
        {resultData && (
          <div className="mx-3 mt-3 bg-masters-light rounded-xl p-3">
            {resultData.kind === 'individual' && (
              <div className="space-y-1.5">
                {resultData.rows.map((row, i) => (
                  <div key={i}>
                    {i > 0 && <div className="h-px bg-black/8 my-1.5" />}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-semibold">{row.label}</span>
                      <span className="text-sm font-black" style={{ color: row.color }}>{row.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultData.kind === 'single' && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-semibold">
                  {resultData.holesPlayed > 0 ? `Through ${resultData.holesPlayed}` : 'Not started'}
                </span>
                <span className="text-sm font-black" style={{ color: resultData.color }}>{resultData.text}</span>
              </div>
            )}

            {resultData.kind === 'points' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold" style={{ color: resultData.t1Color }}>{resultData.t1Names}</span>
                  <span className="text-sm font-black text-masters-dark">
                    {resultData.cur1} <span className="text-xs text-gray-400 font-normal">Q:{resultData.quota1}</span>
                  </span>
                </div>
                <div className="h-px bg-black/8" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold" style={{ color: resultData.t2Color }}>{resultData.t2Names}</span>
                  <span className="text-sm font-black text-masters-dark">
                    {resultData.cur2} <span className="text-xs text-gray-400 font-normal">Q:{resultData.quota2}</span>
                  </span>
                </div>
              </div>
            )}

            {resultData.kind === 'team_standings' && (
              <div className="space-y-1.5">
                {[...resultData.standings]
                  .sort((a, b) => (a.relToPar ?? 999) - (b.relToPar ?? 999))
                  .map((s, i) => (
                    <div key={s.teamId}>
                      {i > 0 && <div className="h-px bg-black/8 my-1" />}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold" style={{ color: s.color, fontWeight: s.teamId === resultData.currentTeamId ? 800 : 600 }}>
                          {s.teamId === resultData.currentTeamId && '▶ '}{s.name}
                        </span>
                        <span className="text-sm font-black text-masters-dark">
                          {s.relToPar === null ? '—' : s.relToPar === 0 ? 'E' : s.relToPar > 0 ? `+${s.relToPar}` : `${s.relToPar}`}
                          {s.holesPlayed > 0 && <span className="text-xs text-gray-400 font-normal ml-1">thru {s.holesPlayed}</span>}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── Side bet strip ─────────────────────────────────────────── */}
        {sideBetStrip && (
          <Link
            to={`/side-bets/${sideBetStrip.betId}`}
            className="mx-3 mt-2 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5"
          >
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
              💰 {sideBetStrip.format.replace(/_/g, ' ')}
              {sideBetStrip.count > 1 ? ` +${sideBetStrip.count - 1} more` : ''}
            </span>
            <span className="text-sm font-black text-amber-900">{sideBetStrip.summary} ›</span>
          </Link>
        )}

        {/* ── CTP picker (inline, appears after all 4 score on par 3) ── */}
        {showCtp && isPar3 && (
          <div className="mx-3 mt-3 bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-100 border-b border-blue-200">
              <span>📍</span>
              <div>
                <div className="text-sm font-bold text-blue-900 font-serif">Closest to the Pin</div>
                <div className="text-xs text-blue-600 font-semibold">Hole {currentHole} · All 12 golfers</div>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {/* No winner — donate to HIO option */}
              {(() => {
                const selected = ctpSelected === DONATE_SENTINEL
                return (
                  <button
                    onClick={() => setCtpSelected(n => n === DONATE_SENTINEL ? null : DONATE_SENTINEL)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-blue-100 transition-colors ${selected ? 'bg-red-50' : 'hover:bg-blue-50'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="flex-1 text-sm font-bold text-red-700">No winner — Donate to HIO pot</span>
                    <span className="text-xs text-red-400 font-semibold">${allPlayers.length}</span>
                  </button>
                )
              })()}
              {ctpGroups.map(({ team, players }) => (
                <div key={team.id}>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: team.color }}>
                    {team.name}
                  </div>
                  {players.map(({ player, score, inMatch }) => {
                    const selected = ctpSelected === player.name
                    const cat      = score !== null ? scoreCat(score, par) : 'empty'
                    return (
                      <button
                        key={player.id}
                        onClick={() => setCtpSelected(n => n === player.name ? null : player.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? 'bg-blue-200' : 'hover:bg-blue-100'}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-blue-700 bg-blue-700' : 'border-gray-300'}`}>
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="flex-1 text-sm font-bold text-masters-dark">{player.name}</span>
                        <span className={`text-xs font-semibold ${inMatch && score !== null ? `px-1.5 py-0.5 rounded ${SCORE_CELL[cat]}` : 'text-gray-400'}`}>
                          {inMatch && score !== null ? score : 'not in this match'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-3 border-t border-blue-200">
              <button onClick={saveCtp} disabled={!ctpSelected} className="flex-1 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-40">
                {ctpSelected === DONATE_SENTINEL ? 'Donate to HIO' : 'Save CTP Winner'}
              </button>
              <button onClick={() => setShowCtp(false)} className="flex-1 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-sm font-bold">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* CTP already set — show chip + tap to change */}
        {!showCtp && isPar3 && (ctpEntry?.winnerName || ctpEntry?.donatedToHio) && (
          <button
            onClick={() => {
              setShowCtp(true)
              setCtpSelected(ctpEntry.donatedToHio ? DONATE_SENTINEL : (ctpEntry.winnerName ?? null))
            }}
            className={`mx-3 mt-2 w-[calc(100%-24px)] flex items-center justify-between border rounded-xl px-3 py-2 ${ctpEntry.donatedToHio ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wide ${ctpEntry.donatedToHio ? 'text-red-600' : 'text-blue-700'}`}>
              {ctpEntry.donatedToHio ? '❤️ Donated to HIO' : '📍 CTP Winner'}
            </span>
            <span className={`text-sm font-bold ${ctpEntry.donatedToHio ? 'text-red-800' : 'text-blue-900'}`}>
              {ctpEntry.donatedToHio
                ? `$${ctpEntry.hioDonationAmount ?? allPlayers.length} → HIO pot`
                : ctpEntry.winnerName}
              {' '}<span className="text-[10px] text-gray-400 font-normal">· tap to change</span>
            </span>
          </button>
        )}

        {/* Bottom spacer for fixed nav */}
        <div className="h-20" />
      </div>

      {/* ── Numpad overlay ─────────────────────────────────────────── */}
      {showNumpad && activePid && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/50" onClick={() => { setShowNumpad(false); setActivePid(null) }} />
          <div className="bg-masters-cream rounded-t-2xl shadow-2xl">
            <div className="bg-masters-dark px-4 py-3 rounded-t-2xl text-center">
              <div className="text-white font-bold font-serif text-base">
                {activePid === CC_TEAM_PID ? (t1?.name ?? 'Team Score') : first(matchPlayerMap[activePid]?.name ?? '')}
              </div>
              <div className="text-white/50 text-xs mt-0.5">Hole {currentHole} · Par {par}</div>
            </div>
            <div className="flex flex-col items-center py-3 gap-1">
              <div className="text-6xl font-black text-masters-gold font-serif leading-none">{numpadVal ?? '—'}</div>
              {numpadVal !== null && (() => {
                const cat = scoreCat(numpadVal, par)
                return cat !== 'empty' && SCORE_LABEL[cat] ? (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_LABEL_CLS[cat]}`}>{SCORE_LABEL[cat]}</span>
                ) : null
              })()}
              <div className="text-xs text-gray-400 font-semibold">Par {par}</div>
            </div>

            {/* Shot stats — skip team formats and blind matches */}
            {!isTeamFormat && match && !match.isBlind && (
              <div className="px-4 pb-1 space-y-1.5">
                <div className="h-px bg-gray-200 mb-1" />

                {/* Fairway — hidden on par 3 */}
                {!isPar3 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">Fairway</span>
                    <div className="flex gap-1 flex-1">
                      {SHOT_DIR_ORDER.map(dir => (
                        <button key={dir}
                          onClick={() => setPendingStats(s => ({ ...s, fairway: s.fairway === dir ? undefined : dir }))}
                          className={`flex-1 h-8 rounded-lg text-[11px] font-bold border-2 transition-colors ${
                            pendingStats.fairway === dir
                              ? dir === 'hit' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'
                              : 'bg-white border-gray-200 text-gray-500 active:bg-gray-50'
                          }`}>
                          {SHOT_DIR_LABEL[dir]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* GIR */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">GIR</span>
                  <div className="flex gap-1 flex-1">
                    {SHOT_DIR_ORDER.map(dir => (
                      <button key={dir}
                        onClick={() => setPendingStats(s => ({ ...s, gir: s.gir === dir ? undefined : dir }))}
                        className={`flex-1 h-8 rounded-lg text-[11px] font-bold border-2 transition-colors ${
                          pendingStats.gir === dir
                            ? dir === 'hit' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'
                            : 'bg-white border-gray-200 text-gray-500 active:bg-gray-50'
                        }`}>
                        {SHOT_DIR_LABEL[dir]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Putts */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 w-14 shrink-0">Putts</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPendingStats(s => ({ ...s, putts: Math.max(0, (s.putts ?? 2) - 1) }))}
                      className="w-8 h-8 bg-white border-2 border-gray-200 rounded-lg text-base font-bold text-masters-green active:bg-gray-50">
                      −
                    </button>
                    <span className="text-xl font-black text-masters-dark font-serif w-6 text-center">
                      {pendingStats.putts ?? '—'}
                    </span>
                    <button
                      onClick={() => setPendingStats(s => ({ ...s, putts: Math.min(5, (s.putts ?? 1) + 1) }))}
                      className="w-8 h-8 bg-white border-2 border-gray-200 rounded-lg text-base font-bold text-masters-green active:bg-gray-50">
                      +
                    </button>
                    {pendingStats.putts !== undefined && (
                      <button
                        onClick={() => setPendingStats(s => { const n = { ...s }; delete n.putts; return n })}
                        className="text-[10px] text-gray-400 active:text-red-500 ml-1">
                        clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 px-4 pb-2">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => numpadTap(n)}
                  className="h-14 bg-white border-2 border-gray-200 rounded-xl text-2xl font-bold text-masters-dark font-serif active:bg-masters-light active:border-masters-green">
                  {n}
                </button>
              ))}
              <button onClick={numpadDel}
                className="h-14 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-500 active:bg-gray-100">
                ⌫
              </button>
              <button onClick={numpadDone}
                className="h-14 col-span-2 bg-masters-green text-white rounded-xl text-base font-bold active:bg-masters-dark">
                Done ›
              </button>
            </div>
            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* ── Fixed hole nav ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-between px-4 py-3">
        <button onClick={() => prevHole !== null && goHole(prevHole)} disabled={prevHole === null}
          className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold text-masters-dark disabled:opacity-30">
          <ChevronLeft size={16} /> H{prevHole ?? currentHole}
        </button>
        <div className="text-xs text-gray-400 font-semibold">{playIdx + 1} / 18</div>
        <button onClick={() => nextHole !== null && goHole(nextHole)} disabled={nextHole === null}
          className="flex items-center gap-1 px-4 py-2 bg-masters-green text-white rounded-lg text-sm font-bold disabled:opacity-30">
          H{nextHole ?? currentHole} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )

  // ── PlayerRow (inner component, reads closure) ────────────────────────────
  function PlayerRow({ pid }: { pid: string }) {
    const player = matchPlayerMap[pid]
    if (!player) return null
    const gross  = getScore(pid)
    const cat    = scoreCat(gross, par)
    const dots   = holeData ? getStrokeDots(hdcps[pid] ?? 0, holeData.hdcpOrder) : ''
    const active = activePid === pid && showNumpad
    const team   = teamOf(pid)
    const stat = (!isTeamFormat && match && !match.isBlind) ? (match.shotStats?.[pid]?.[currentHole] ?? null) : null
    const statParts: string[] = []
    if (stat) {
      if (stat.fairway === null) statParts.push('P3')
      else if (stat.fairway !== undefined) statParts.push(stat.fairway === 'hit' ? 'FW✓' : `FW${SHOT_DIR_SYM[stat.fairway]}`)
      if (stat.gir !== undefined && stat.gir !== null) statParts.push(stat.gir === 'hit' ? 'GIR✓' : `GIR${SHOT_DIR_SYM[stat.gir]}`)
      if (stat.putts !== undefined) statParts.push(`${stat.putts}pt`)
    }
    return (
      <button
        onClick={() => openNumpad(pid)}
        className={`w-full flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border-2 transition-colors ${
          active ? 'border-masters-gold' : 'border-transparent'
        } ${canScoreMatch && !match?.isBlind ? 'active:bg-masters-light' : 'cursor-default'}`}
        style={{ borderLeftColor: team?.color, borderLeftWidth: 3 }}
      >
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-masters-dark">{first(player.name)}</span>
          {statParts.length > 0 && (
            <span className="ml-2 text-[10px] text-gray-400">{statParts.join(' · ')}</span>
          )}
        </div>
        <span className="text-xs text-masters-green font-bold w-4 text-center">{dots}</span>
        <div className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center text-xl font-black font-serif shrink-0 ${SCORE_CELL[cat]}`}>
          {gross !== null ? gross : '—'}
        </div>
      </button>
    )
  }
}
