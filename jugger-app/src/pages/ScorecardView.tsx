import { useState, useRef, useMemo, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useIsPlayer, useCanEnterScores, useAuthStore } from '../store/useAuthStore'
import ScorecardCard from '../components/ScorecardCard'
import { CtpPanel, getPar3Holes } from '../components/CtpPanel'
import { getMatchesForRound } from '../utils/pairings'
import { getPlayerCourseHdcp, tournamentHdcp, stablefordPoints, getStrokeDots } from '../utils/handicap'
import { computeMatchPlay, computePointsRound, computeScramble, computeCaptainsChoice, computeIndividualMatch, computeVegas } from '../utils/matchplay'
import { computeSideBet, FORMAT_DISPLAY_NAMES as SIDE_BET_FORMAT_NAMES } from '../utils/sideBets'
import { Printer, Dices, Trash2, Flag, Trophy, Lock, LockOpen, ChevronDown, Smartphone, Mail, RefreshCw } from 'lucide-react'
import { sendEmail, buildMatchEmail, buildRoundEmail, getMatchRecipients, getRoundRecipients } from '../lib/email'
import type { Match, Course, RoundConfig, Team, CtpEntry, GameConfig, HoleData, ShotDirection } from '../types'
import { DEFAULT_GAME_CONFIG } from '../store/useTournamentStore'
import { computeChampion, getDefendingChampionId } from '../utils/champion'

const MISS_DIR_POOL: ShotDirection[] = ['left', 'right', 'left', 'right', 'long', 'short']
function randMissDir(): ShotDirection {
  return MISS_DIR_POOL[Math.floor(Math.random() * MISS_DIR_POOL.length)]
}

function buildSimShotStats(match: Match, holes: HoleData[]): NonNullable<Match['shotStats']> {
  const stats: NonNullable<Match['shotStats']> = {}
  const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
  for (const pid of allPids) {
    stats[pid] = {}
    for (const hole of holes) {
      const isPar3 = hole.par === 3
      const r1 = Math.random(), r2 = Math.random(), r3 = Math.random()
      stats[pid][hole.number] = {
        fairway: isPar3 ? null : (r1 < 0.50 ? 'hit' : randMissDir()),
        gir: r2 < (isPar3 ? 0.38 : 0.33) ? 'hit' : randMissDir(),
        putts: r3 < 0.14 ? 1 : r3 < 0.73 ? 2 : 3,
      }
    }
  }
  return stats
}

const FORMAT_DISPLAY: Record<string, string> = {
  team_match_play:  'Team Match Play',
  points_round:     'Points Round',
  texas_scramble:   'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice:  "Captain's Choice",
  vegas:            'Vegas',
}

function getRoundName(round: number, configs: RoundConfig[]): string {
  const rc = configs.find(r => r.round === round)
  return rc ? `Round ${round} — ${FORMAT_DISPLAY[rc.format] ?? rc.format}` : `Round ${round}`
}

export default function ScorecardView() {
  const { teams, matches, courses, roundConfigs, year, admins, setMatchScore, setMatchScoresBatch, updateMatch, clearMatchScores, clearAllMatchScores, teamScores, setTeamScore, setTeamScoresBatch, clearAllTeamScores, clearTeamScoresForRound, setTeamHoleScore, setTeeShot, ctpEntries, updateCtpEntry, setCtpEntries, archivedYears, lockedRounds, lockRound, unlockRound, sideBets = [] } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const isPlayer = useIsPlayer()
  const canEnterScores = useCanEnterScores()
  const currentAdmin = useAuthStore(s => s.currentAdmin)
  const isRoundLocked = (round: number) => lockedRounds.includes(round)
  // Scorers cannot edit a locked round; admins always can
  const canEdit = (round: number) => canEnterScores && (!isRoundLocked(round) || isAdmin)

  // Player-linked roster ID (covers regular player accounts and sub accounts)
  const playerRosterId = useMemo(() => {
    if (!isPlayer || !currentAdmin) return null
    const cred = admins.find(a => a.username === currentAdmin)
    return cred?.playerId ?? cred?.subForPlayerId ?? null
  }, [isPlayer, currentAdmin, admins])

  // Is this player one of the four players in the given match?
  function isPlayerInMatch(m: Match): boolean {
    if (!playerRosterId) return false
    return m.twosome1.playerIds.includes(playerRosterId) || m.twosome2.playerIds.includes(playerRosterId)
  }

  // Does today (local time) match the scheduled date for this round?
  function isMatchDate(round: number): boolean {
    const rc = roundConfigs.find(r => r.round === round)
    if (!rc?.date) return false
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return rc.date === today
  }

  // Full edit permission: base canEdit + player-scorer match/date restriction.
  // Admins and pure scorers (role !== 'player') pass through canEdit unchanged.
  const canEditMatch = (round: number, m: Match): boolean => {
    if (!canEdit(round)) return false
    if (!isPlayer) return true
    return isMatchDate(round) && isPlayerInMatch(m)
  }
  const [searchParams] = useSearchParams()
  const [activeRound, setActiveRound] = useState(() => Number(searchParams.get('round')) || 1)
  const [activeMatch, setActiveMatch] = useState<string | null>(() =>
    searchParams.get('match') ?? getMatchesForRound(matches, Number(searchParams.get('round')) || 1)[0]?.id ?? null
  )
  const printRef = useRef<HTMLDivElement>(null)
  const printRoundRef = useRef<HTMLDivElement>(null)
  const [emailStatus, setEmailStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  const [championModal, setChampionModal] = useState<{ team: Team; isComplete: boolean } | null>(null)

  const defaultCtpTeamId = teams[teams.length - 1]?.id ?? ''
  const ctpTeamIds = useTournamentStore(s => s.ctpTeamIds ?? {})
  const setCtpTeamIdStore = useTournamentStore(s => s.setCtpTeamId)
  const ctpMatchIds = useTournamentStore(s => s.ctpMatchIds ?? {})
  const setCtpMatchIdStore = useTournamentStore(s => s.setCtpMatchId)

  const roundMatches = getMatchesForRound(matches, activeRound)
  const config = roundConfigs.find(r => r.round === activeRound)
  const course = courses.find(c => c.id === config?.courseId)
  const match = matches.find(m => m.id === activeMatch)

  const isTeamFmt = config?.format === 'texas_scramble' || config?.format === 'captains_choice'
  const effectiveCtpTeamId = ctpTeamIds[activeRound] ?? defaultCtpTeamId
  const effectiveCtpMatchSuffix = ctpMatchIds[activeRound] ?? 'c'
  const showCtpPanel = !!(match && !match.isBlind && (
    (!isTeamFmt && match.id === `${activeRound}${effectiveCtpMatchSuffix}`) ||
    (isTeamFmt && match.id === `${activeRound}-${effectiveCtpTeamId}`)
  ))

  const PRINT_STYLE = `@page { size: letter landscape; margin: 0.35in; } body { font-size: 8pt; background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }`

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: PRINT_STYLE,
    documentTitle: match ? `Jugger ${year} — ${match.label}` : `Jugger ${year} Scorecard`,
  })

  const handlePrintRound = useReactToPrint({
    content: () => printRoundRef.current,
    pageStyle: PRINT_STYLE,
    documentTitle: `Jugger ${year} — ${getRoundName(activeRound, roundConfigs)}`,
  })

  async function handleSendMatchEmail() {
    if (!match || !course || !config) return
    setSendingEmail(true)
    setEmailStatus(null)
    const recipients = getMatchRecipients(match, teams)
    const { subject, html } = buildMatchEmail(match, teams, course, config, year, ctpEntries)
    const result = await sendEmail(subject, html, recipients)
    setSendingEmail(false)
    setEmailStatus(result.success
      ? { msg: `Sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`, ok: true }
      : { msg: result.error ?? 'Send failed', ok: false })
    setTimeout(() => setEmailStatus(null), 5000)
  }

  async function handleSendRoundEmail() {
    if (!course || !config) return
    setSendingEmail(true)
    setEmailStatus(null)
    const recipients = getRoundRecipients(activeRound, matches, teams)
    const { subject, html } = buildRoundEmail(activeRound, matches, teams, course, config, teamScores, year, ctpEntries)
    const result = await sendEmail(subject, html, recipients)
    setSendingEmail(false)
    setEmailStatus(result.success
      ? { msg: `Sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`, ok: true }
      : { msg: result.error ?? 'Send failed', ok: false })
    setTimeout(() => setEmailStatus(null), 5000)
  }

  // Shared team score computation for points_round — call after any MB toggle.
  // Pass updatedMatches to incorporate an in-flight match update not yet in store.
  function recomputeMatchPlayTeamScores(updatedMatches: typeof matches) {
    if (!course || !config) return
    const allPlayers = teams.flatMap(t => t.players)
    const roundMatchesList = updatedMatches.filter(m => m.round === config.round)
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })

    for (const m of roundMatchesList) {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const allFullyScored = allPids.every(pid =>
        course.holes.every(h => m.scores[pid]?.[h.number] != null)
      )
      if (!allFullyScored) continue
      const localHdcps: Record<string, number> = {}
      allPids.forEach(pid => {
        const player = allPlayers.find(p => p.id === pid)
        if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
      })
      const mpRes = computeMatchPlay(m, course.holes, localHdcps)
      const pts = m.isBlind ? (useTournamentStore.getState().gameConfig?.blindMatchPts ?? 1)
                            : (useTournamentStore.getState().gameConfig?.regularMatchPts ?? 2)
      if (mpRes.winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
      else if (mpRes.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
      else if (mpRes.winner === 'all_square') {
        teamPts[m.twosome1.teamId] += pts / 2
        teamPts[m.twosome2.teamId] += pts / 2
      }
    }

    if (Object.values(teamPts).every(p => p === 0)) return
    const newScores = teams.map(t => ({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 }))
    if (newScores.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores)
  }

  function recomputePointsRoundTeamScores(updatedMatches: typeof matches) {
    if (!course || !config) return
    const allPlayers = teams.flatMap(t => t.players)
    const roundMatchesList = updatedMatches.filter(m => m.round === config.round)
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })

    for (const m of roundMatchesList) {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const allFullyScored = allPids.every(pid =>
        course.holes.every(h => m.scores[pid]?.[h.number] != null)
      )
      if (allFullyScored) {
        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
        })
        const prRes = computePointsRound(m, course.holes, localHdcps)
        const pts = m.isBlind ? (useTournamentStore.getState().gameConfig?.blindMatchPts ?? 1)
                              : (useTournamentStore.getState().gameConfig?.regularMatchPts ?? 2)
        if (prRes.winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
        else if (prRes.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
        else if (prRes.winner === 'all_square') {
          teamPts[m.twosome1.teamId] += pts / 2
          teamPts[m.twosome2.teamId] += pts / 2
        }
      }
      // Magic Ball: non-blind matches only, +1 per twosome that finished with it
      if (!m.isBlind) {
        if (m.magicBall1) teamPts[m.twosome1.teamId] += 1
        if (m.magicBall2) teamPts[m.twosome2.teamId] += 1
      }
    }

    if (Object.values(teamPts).every(p => p === 0)) return
    const newScores2 = teams.map(t => ({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 }))
    if (newScores2.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores2)
  }

  function recomputeScrambleTeamScores(currentMatches: typeof matches) {
    if (!course || !config || config.format !== 'texas_scramble') return
    const allPlayers = teams.flatMap(t => t.players)
    const scrambleMatches = currentMatches.filter(m => m.round === config.round)

    const results = scrambleMatches.map(m => {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const hdcps: Record<string, number> = {}
      allPids.forEach(pid => {
        const player = allPlayers.find(p => p.id === pid)
        if (player) hdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
      })
      return { match: m, result: computeScramble(m, course.holes, hdcps) }
    })

    // Only award points once all 3 teams are done
    if (!results.every(r => r.result.isDone)) return

    const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
    const RANK_LABELS = ['1st', '2nd', '3rd']
    ranked.forEach(({ match: m, result: r }, i) => {
      const label = `${RANK_LABELS[i]} · Net ${Math.round(r.total)}`
      if (m.result !== label) updateMatch(m.id, { result: label })
    })
    const gc3 = useTournamentStore.getState().gameConfig
    const POINTS = [gc3.teamFinish1stPts ?? 4, gc3.teamFinish2ndPts ?? 2, gc3.teamFinish3rdPts ?? 1]
    const newScores3 = ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round: config.round, points: POINTS[i] ?? 1 }))
    if (newScores3.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores3)
  }

  function recomputeCaptainsChoiceTeamScores(currentMatches: typeof matches) {
    if (!course || !config || config.format !== 'captains_choice') return
    const allPlayers = teams.flatMap(t => t.players)
    const ccMatches = currentMatches.filter(m => m.round === config.round)

    const results = ccMatches.map(m => {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const teeData = course.tees.find(t => t.name === config.tee) ?? course.tees[0]
      const minIndex = allPlayers.length > 0 ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
      const r5Sum = allPids.reduce((s, pid) => {
        const player = allPlayers.find(p => p.id === pid)
        return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, false) : 0)
      }, 0)
      const teamHdcp = Math.round(r5Sum * 0.15)
      const ccRes = computeCaptainsChoice(m.teamHoleScores, course.holes, teamHdcp)
      return { match: m, ccRes, teamHdcp }
    })

    if (!results.every(r => r.ccRes.isDone)) return

    const ranked = [...results].sort((a, b) => a.ccRes.total - b.ccRes.total)
    const RANK_LABELS4 = ['1st', '2nd', '3rd']
    ranked.forEach(({ match: m, ccRes }, i) => {
      const label = `${RANK_LABELS4[i]} · Net ${Math.round(ccRes.total)}`
      if (m.result !== label) updateMatch(m.id, { result: label })
    })
    const gc4 = useTournamentStore.getState().gameConfig
    const POINTS4 = [gc4.teamFinish1stPts ?? 4, gc4.teamFinish2ndPts ?? 2, gc4.teamFinish3rdPts ?? 1]
    const newScores4 = ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round: config.round, points: POINTS4[i] ?? 1 }))
    if (newScores4.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores4)
  }

  function recomputeIndividualMatchTeamScores(currentMatches: typeof matches) {
    if (!course || !config || config.format !== 'individual_match') return
    const allPlayers = teams.flatMap(t => t.players)
    const r4Matches = currentMatches.filter(m => m.round === config.round)
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })

    for (const m of r4Matches) {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const localHdcps: Record<string, number> = {}
      allPids.forEach(pid => {
        const player = allPlayers.find(p => p.id === pid)
        if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
      })

      const imRes = computeIndividualMatch(m, course.holes, localHdcps)

      // 1v1 points: 1pt per win (regular) or 0.5pt (blind)
      for (const { result, p1TeamId, p2TeamId } of [
        { result: imRes.matchA, p1TeamId: m.twosome1.teamId, p2TeamId: m.twosome2.teamId },
        { result: imRes.matchB, p1TeamId: m.twosome1.teamId, p2TeamId: m.twosome2.teamId },
      ]) {
        if (!result.winner) continue
        const pts = m.isBlind ? 0.5 : 1
        if (result.winner === 'p1') teamPts[p1TeamId] += pts
        else if (result.winner === 'p2') teamPts[p2TeamId] += pts
        else { teamPts[p1TeamId] += pts / 2; teamPts[p2TeamId] += pts / 2 }
      }

      // 2v2 point: 1pt for winner (regular only)
      if (!m.isBlind && imRes.match2v2?.winner) {
        const w = imRes.match2v2.winner
        if (w === 'twosome1') teamPts[m.twosome1.teamId] += 1
        else if (w === 'twosome2') teamPts[m.twosome2.teamId] += 1
        else { teamPts[m.twosome1.teamId] += 0.5; teamPts[m.twosome2.teamId] += 0.5 }
      }
    }

    if (Object.values(teamPts).every(p => p === 0)) return
    const newScores5 = teams.map(t => ({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 }))
    if (newScores5.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores5)
  }

  function recomputeVegasTeamScores(currentMatches: typeof matches) {
    if (!course || !config || config.format !== 'vegas') return
    const allPlayers = teams.flatMap(t => t.players)
    const vegasMatches = currentMatches.filter(m => m.round === config.round)
    const teamPts: Record<string, number> = {}
    teams.forEach(t => { teamPts[t.id] = 0 })

    for (const m of vegasMatches) {
      const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
      const allFullyScored = allPids.every(pid =>
        course.holes.every(h => m.scores[pid]?.[h.number] != null)
      )
      if (!allFullyScored) continue
      const localHdcps: Record<string, number> = {}
      allPids.forEach(pid => {
        const player = allPlayers.find(p => p.id === pid)
        if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
      })
      const gc = useTournamentStore.getState().gameConfig ?? DEFAULT_GAME_CONFIG
      const vRes = computeVegas(m, course.holes, localHdcps, {
        birdieMultiplier: gc.vegasBirdieMultiplier,
        eagleMultiplier: gc.vegasEagleMultiplier,
        albatrossMultiplier: gc.vegasAlbatrossMultiplier,
      })
      if (!vRes.winner) continue
      const pts = m.isBlind ? gc.vegasBlindMatchPts : gc.vegasRegularMatchPts
      if (vRes.winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
      else if (vRes.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
      else { teamPts[m.twosome1.teamId] += pts / 2; teamPts[m.twosome2.teamId] += pts / 2 }
    }

    if (Object.values(teamPts).every(p => p === 0)) return
    const newScores6 = teams.map(t => ({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 }))
    if (newScores6.every(ns => teamScores.find(ts => ts.teamId === ns.teamId && ts.round === ns.round)?.points === ns.points)) return
    setTeamScoresBatch(newScores6)
  }

  // On tab change: update result strings for completed matches, and recompute team
  // scores for team-format rounds so standings reflect current match data.
  // Fires only on explicit tab navigation — not on remote match updates.
  useEffect(() => {
    if (!course || !config) return
    if (config.format === 'texas_scramble') {
      recomputeScrambleTeamScores(matches)
    } else if (config.format === 'captains_choice') {
      recomputeCaptainsChoiceTeamScores(matches)
    } else {
      const roundMatches = matches.filter(m => m.round === config.round)
      for (const m of roundMatches) autoUpdateMatchResult(m)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRound])

  function autoUpdateMatchResult(currentMatch: Match) {
    if (!course || !config) return
    if (config.format !== 'team_match_play' && config.format !== 'individual_match' && config.format !== 'vegas' && config.format !== 'points_round') return

    const allPlayers = teams.flatMap(t => t.players)
    const allPids = [...currentMatch.twosome1.playerIds, ...currentMatch.twosome2.playerIds]
    const localHdcps: Record<string, number> = {}
    allPids.forEach(pid => {
      const player = allPlayers.find(p => p.id === pid)
      if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
    })

    if (config.format === 'team_match_play') {
      const mpRes = computeMatchPlay(currentMatch, course.holes, localHdcps)
      if (!mpRes.winner) return
      const t1 = teams.find(t => t.id === currentMatch.twosome1.teamId)
      const t2 = teams.find(t => t.id === currentMatch.twosome2.teamId)
      const result = mpRes.winner === 'all_square'
        ? 'All Square'
        : `${(mpRes.winner === 'twosome1' ? t1 : t2)?.name ?? 'Team'} wins ${mpRes.winLabel}`
      updateMatch(currentMatch.id, { result })

    } else if (config.format === 'individual_match') {
      const imRes = computeIndividualMatch(currentMatch, course.holes, localHdcps)
      const parts: string[] = []

      for (const { res, p1Id, p2Id, label } of [
        { res: imRes.matchA, p1Id: currentMatch.twosome1.playerIds[0], p2Id: currentMatch.twosome2.playerIds[0], label: 'A' },
        { res: imRes.matchB, p1Id: currentMatch.twosome1.playerIds[1], p2Id: currentMatch.twosome2.playerIds[1], label: 'B' },
      ]) {
        if (!res.winner) continue
        const p1Last = allPlayers.find(p => p.id === p1Id)?.name.split(' ').slice(-1)[0] ?? '?'
        const p2Last = allPlayers.find(p => p.id === p2Id)?.name.split(' ').slice(-1)[0] ?? '?'
        if (res.winner === 'all_square') parts.push(`${label}: AS`)
        else if (res.winner === 'p1') parts.push(`${label}: ${p1Last} ${res.winLabel}`)
        else parts.push(`${label}: ${p2Last} ${res.winLabel}`)
      }

      if (!currentMatch.isBlind && imRes.match2v2?.winner) {
        const w = imRes.match2v2.winner
        const t1 = teams.find(t => t.id === currentMatch.twosome1.teamId)
        const t2 = teams.find(t => t.id === currentMatch.twosome2.teamId)
        if (w === 'all_square') parts.push('2v2: AS')
        else parts.push(`2v2: ${(w === 'twosome1' ? t1 : t2)?.name ?? 'Team'} ${imRes.match2v2.winLabel}`)
      }

      if (parts.length > 0) updateMatch(currentMatch.id, { result: parts.join(' · ') })

    } else if (config.format === 'vegas') {
      const allPids = [...currentMatch.twosome1.playerIds, ...currentMatch.twosome2.playerIds]
      const localHdcps: Record<string, number> = {}
      allPids.forEach(pid => {
        const player = allPlayers.find(p => p.id === pid)
        if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
      })
      const gc = useTournamentStore.getState().gameConfig ?? DEFAULT_GAME_CONFIG
      const vRes = computeVegas(currentMatch, course.holes, localHdcps, {
        birdieMultiplier: gc.vegasBirdieMultiplier,
        eagleMultiplier: gc.vegasEagleMultiplier,
        albatrossMultiplier: gc.vegasAlbatrossMultiplier,
      })
      if (!vRes.winner) return
      const t1 = teams.find(t => t.id === currentMatch.twosome1.teamId)
      const t2 = teams.find(t => t.id === currentMatch.twosome2.teamId)
      const result = vRes.winner === 'all_square'
        ? `All Square — ${vRes.total1} pts each`
        : `${(vRes.winner === 'twosome1' ? t1 : t2)?.name ?? 'Team'} wins ${vRes.winLabel}`
      updateMatch(currentMatch.id, { result })

    } else if (config.format === 'points_round') {
      const prRes = computePointsRound(currentMatch, course.holes, localHdcps)
      if (!prRes.winner) return
      const fmtDelta = (d: number) => d >= 0 ? `+${d}` : `${d}`
      const d1 = prRes.total1 - prRes.quota1
      const d2 = prRes.total2 - prRes.quota2
      updateMatch(currentMatch.id, { result: `${fmtDelta(d1)} / ${fmtDelta(d2)}` })
    }
  }

  function handleMBToggle(field: 'magicBall1' | 'magicBall2', val: boolean) {
    if (!match || !config || config.format !== 'points_round' || match.isBlind) return
    updateMatch(match.id, { [field]: val })
    // Build updated match list in-closure (store update batches, can't re-read yet)
    const updatedMatches = matches.map(m => m.id === match.id ? { ...m, [field]: val } : m)
    recomputePointsRoundTeamScores(updatedMatches)
  }

  function handleSimulate() {
    if (!match || !course || !config) return
    const simScores = simulateMatchScores(match, course, config, teams)
    // Batch all scores into one store update to avoid Supabase realtime feedback
    // mid-loop that would overwrite scores set earlier in the iteration.
    setMatchScoresBatch(match.id, simScores as Match['scores'])
    // Randomly assign Magic Ball for Round 2 regular matches
    let simMb1 = match.magicBall1
    let simMb2 = match.magicBall2
    if (config.format === 'points_round' && !match.isBlind) {
      simMb1 = Math.random() < 0.5
      simMb2 = Math.random() < 0.5
      updateMatch(match.id, { magicBall1: simMb1, magicBall2: simMb2 })
    }

    // Simulate shot stats for non-blind, non-team-format matches
    const noShotStatFmts = new Set(['texas_scramble', 'captains_choice'])
    if (!match.isBlind && !noShotStatFmts.has(config.format)) {
      updateMatch(match.id, { shotStats: buildSimShotStats(match, course.holes) })
    }

    // Simulate CTP winners for any non-blind match (keyed by round+hole, not match)
    if (!match.isBlind) {
      const par3Holes = getPar3Holes(roundConfigs, courses).filter(h => h.round === activeRound)
      const allPlayerNames = teams.flatMap(t => t.players).map(p => p.name)
      const prizePerHole = allPlayerNames.length
      for (const h of par3Holes) {
        const currentEntries = useTournamentStore.getState().ctpEntries
        const existing = currentEntries.find(e => e.year === year && e.round === h.round && e.hole === h.hole)
        const donateToHio = Math.random() < 0.15
        const updates: Partial<CtpEntry> = donateToHio
          ? { donatedToHio: true, winnerName: undefined, winnerPaid: undefined, hioDonationAmount: prizePerHole }
          : { winnerName: allPlayerNames[Math.floor(Math.random() * allPlayerNames.length)], donatedToHio: false, hioDonationAmount: undefined }
        if (existing) {
          updateCtpEntry(existing.id, updates)
        } else {
          setCtpEntries([...useTournamentStore.getState().ctpEntries, {
            id: `ctp-${year}-r${h.round}-h${h.hole}`,
            year, round: h.round, hole: h.hole,
            courseName: h.courseName, yardage: h.yardage,
            ...updates,
          }])
        }
      }
    }

    if (config.format === 'texas_scramble') {
      const latestMatches = useTournamentStore.getState().matches
      recomputeScrambleTeamScores(latestMatches)
    } else if (config.format === 'captains_choice') {
      // Simulate one team score per hole and random tee shot allocations
      const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
      const allPlayers = teams.flatMap(t => t.players)
      const teeData = course.tees.find(t => t.name === config.tee) ?? course.tees[0]
      const minIndex = allPlayers.length > 0 ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
      const r5Sum = allPids.reduce((s, pid) => {
        const player = allPlayers.find(p => p.id === pid)
        return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, false) : 0)
      }, 0)
      const teamHdcp = Math.round(r5Sum * 0.15)

      // Simulate team scores — around par + expected net from hdcp
      const simTeeShots: Record<number, string> = {}
      // Distribute tee shots: each player must get at least 3; distribute randomly
      const teeShotCounts: Record<string, number> = {}
      allPids.forEach(pid => { teeShotCounts[pid] = 0 })
      for (const hole of course.holes) {
        // Prefer players who haven't hit 3 yet
        const needMore = allPids.filter(pid => teeShotCounts[pid] < 3)
        const pool = needMore.length > 0 ? needMore : allPids
        const chosen = pool[Math.floor(Math.random() * pool.length)]
        simTeeShots[hole.number] = chosen
        teeShotCounts[chosen]++
      }

      for (const hole of course.holes) {
        const d = getStrokeDots(teamHdcp, hole.hdcpOrder)
        const strokes = d === '..' ? 2 : d === '.' ? 1 : 0
        const r = Math.random()
        const variance = r < 0.05 ? -1 : r < 0.25 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3
        const gross = Math.max(1, hole.par + strokes + variance)
        setTeamHoleScore(match.id, hole.number, gross)
        setTeeShot(match.id, hole.number, simTeeShots[hole.number])
      }
      const latestMatchesCC = useTournamentStore.getState().matches
      recomputeCaptainsChoiceTeamScores(latestMatchesCC)
    } else if (config.format === 'individual_match') {
      const latestMatches = useTournamentStore.getState().matches
      recomputeIndividualMatchTeamScores(latestMatches)
    } else if (config.format === 'vegas') {
      const latestMatches = useTournamentStore.getState().matches
      recomputeVegasTeamScores(latestMatches)
    } else if (config.format === 'team_match_play' || config.format === 'points_round') {
      // Recompute team scores for this round from ALL scored matches.
      // simScores covers the current match's players; blind matches that share
      // those players also get the fresh scores overlaid.
      const allPlayers = teams.flatMap(t => t.players)
      const roundMatches = getMatchesForRound(matches, config.round)
      const teamPts: Record<string, number> = {}
      teams.forEach(t => { teamPts[t.id] = 0 })
      const simPids = new Set([...match.twosome1.playerIds, ...match.twosome2.playerIds])

      for (const m of roundMatches) {
        // Build effective scores: current match → simScores; others → stored scores
        // with any simulated players overlaid (handles blind match score sync).
        let effectiveScores: Match['scores']
        if (m.id === match.id) {
          effectiveScores = simScores as Match['scores']
        } else {
          effectiveScores = { ...m.scores }
          ;[...m.twosome1.playerIds, ...m.twosome2.playerIds].forEach(pid => {
            if (simPids.has(pid) && simScores[pid]) {
              effectiveScores[pid] = simScores[pid] as Record<number, number>
            }
          })
        }

        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const allFullyScored = allPids.every(pid =>
          course.holes.every(h => effectiveScores[pid]?.[h.number] != null)
        )
        if (!allFullyScored) continue

        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
        })

        const tempM = { ...m, scores: effectiveScores }
        const winner = config.format === 'points_round'
          ? computePointsRound(tempM, course.holes, localHdcps).winner
          : computeMatchPlay(tempM, course.holes, localHdcps).winner
        const pts = m.isBlind ? 1 : 2

        if (winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
        else if (winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
        else if (winner === 'all_square') {
          teamPts[m.twosome1.teamId] += pts / 2
          teamPts[m.twosome2.teamId] += pts / 2
        }

        // Magic Ball: non-blind only; use simulated values for current match
        if (config.format === 'points_round' && !m.isBlind) {
          const mb1 = m.id === match.id ? simMb1 : m.magicBall1
          const mb2 = m.id === match.id ? simMb2 : m.magicBall2
          if (mb1) teamPts[m.twosome1.teamId] += 1
          if (mb2) teamPts[m.twosome2.teamId] += 1
        }
      }

      setTeamScoresBatch(teams.map(t => ({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 })))
    }

    checkAndShowChampion()

    if (config.format === 'team_match_play' || config.format === 'individual_match' || config.format === 'vegas' || config.format === 'points_round') {
      const cur = useTournamentStore.getState().matches.find(m => m.id === match.id)
      if (cur) autoUpdateMatchResult(cur)
    }
  }

  function checkAndShowChampion() {
    const latestScores = useTournamentStore.getState().teamScores
    const defendingId = getDefendingChampionId(archivedYears, year)
    const { champion, isComplete } = computeChampion(teams, latestScores, roundConfigs.map(rc => rc.round), defendingId)
    if (champion) setChampionModal({ team: champion, isComplete })
  }

  // ── Simulate an entire round (all matches) ──────────────────────────────

  function simulateAndScoreRound(round: number) {
    const rc = roundConfigs.find(cfg => cfg.round === round)
    const crs = courses.find(c => c.id === rc?.courseId)
    if (!rc || !crs) return

    const allPlayers = teams.flatMap(t => t.players)
    const regularMatches = getMatchesForRound(matches, round).filter(m => !m.isBlind)

    // Score each match
    for (const m of regularMatches) {
      if (rc.format === 'captains_choice') {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const teeData = crs.tees.find(t => t.name === rc.tee) ?? crs.tees[0]
        const minIdx = allPlayers.length ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
        const r5Sum = allPids.reduce((s, pid) => {
          const player = allPlayers.find(p => p.id === pid)
          return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? crs.par, crs.par, minIdx, false) : 0)
        }, 0)
        const teamHdcp = Math.round(r5Sum * 0.15)
        const teeShotCounts: Record<string, number> = {}
        allPids.forEach(pid => { teeShotCounts[pid] = 0 })
        for (const hole of crs.holes) {
          const needMore = allPids.filter(pid => teeShotCounts[pid] < 3)
          const pool = needMore.length ? needMore : allPids
          const chosen = pool[Math.floor(Math.random() * pool.length)]
          setTeeShot(m.id, hole.number, chosen)
          teeShotCounts[chosen]++
          const d = getStrokeDots(teamHdcp, hole.hdcpOrder)
          const strokes = d === '..' ? 2 : d === '.' ? 1 : 0
          const r = Math.random()
          const variance = r < 0.05 ? -1 : r < 0.25 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3
          setTeamHoleScore(m.id, hole.number, Math.max(1, hole.par + strokes + variance))
        }
      } else {
        const simScores = simulateMatchScores(m, crs, rc, teams)
        setMatchScoresBatch(m.id, simScores as Match['scores'])
        const roundUpdates: Partial<Match> = {}
        if (rc.format === 'points_round') {
          roundUpdates.magicBall1 = Math.random() < 0.5
          roundUpdates.magicBall2 = Math.random() < 0.5
        }
        const noShotStatFmts = new Set(['texas_scramble', 'captains_choice'])
        if (!noShotStatFmts.has(rc.format)) {
          roundUpdates.shotStats = buildSimShotStats(m, crs.holes)
        }
        if (Object.keys(roundUpdates).length > 0) updateMatch(m.id, roundUpdates)
      }
    }

    // CTP
    const par3Holes = getPar3Holes(roundConfigs, courses).filter(h => h.round === round)
    const allPlayerNames = allPlayers.map(p => p.name)
    for (const h of par3Holes) {
      const existing = useTournamentStore.getState().ctpEntries.find(
        e => e.year === year && e.round === h.round && e.hole === h.hole
      )
      const donateToHio = Math.random() < 0.15
      const updates: Partial<CtpEntry> = donateToHio
        ? { donatedToHio: true, winnerName: undefined, winnerPaid: undefined, hioDonationAmount: allPlayerNames.length }
        : { winnerName: allPlayerNames[Math.floor(Math.random() * allPlayerNames.length)], donatedToHio: false, hioDonationAmount: undefined }
      if (existing) {
        updateCtpEntry(existing.id, updates)
      } else {
        setCtpEntries([...useTournamentStore.getState().ctpEntries, {
          id: `ctp-${year}-r${h.round}-h${h.hole}`, year, round: h.round, hole: h.hole,
          courseName: h.courseName, yardage: h.yardage, ...updates,
        }])
      }
    }

    // Recompute team scores
    const latestMatches = useTournamentStore.getState().matches
    const roundMatchesAll = latestMatches.filter(m => m.round === round)

    if (rc.format === 'texas_scramble') {
      const results = roundMatchesAll.map(m => {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const hdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) hdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers, rc.format)
        })
        return { match: m, result: computeScramble(m, crs.holes, hdcps) }
      })
      if (results.every(r => r.result.isDone)) {
        const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
        const simGc = useTournamentStore.getState().gameConfig
        const SIMPTS = [simGc.teamFinish1stPts ?? 4, simGc.teamFinish2ndPts ?? 2, simGc.teamFinish3rdPts ?? 1]
        setTeamScoresBatch(ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round, points: SIMPTS[i] ?? 1 })))
      }
    } else if (rc.format === 'captains_choice') {
      const results = roundMatchesAll.map(m => {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const teeData = crs.tees.find(t => t.name === rc.tee) ?? crs.tees[0]
        const minIdx = allPlayers.length ? Math.min(...allPlayers.map(p => p.handicapIndex)) : 0
        const r5Sum = allPids.reduce((s, pid) => {
          const player = allPlayers.find(p => p.id === pid)
          return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? crs.par, crs.par, minIdx, false) : 0)
        }, 0)
        return { match: m, ccRes: computeCaptainsChoice(m.teamHoleScores, crs.holes, Math.round(r5Sum * 0.15)) }
      })
      if (results.every(r => r.ccRes.isDone)) {
        const ranked = [...results].sort((a, b) => a.ccRes.total - b.ccRes.total)
        const simGc2 = useTournamentStore.getState().gameConfig
        const SIMPTS2 = [simGc2.teamFinish1stPts ?? 4, simGc2.teamFinish2ndPts ?? 2, simGc2.teamFinish3rdPts ?? 1]
        setTeamScoresBatch(ranked.map(({ match: m }, i) => ({ teamId: m.twosome1.teamId, round, points: SIMPTS2[i] ?? 1 })))
      }
    } else if (rc.format === 'individual_match') {
      const teamPts: Record<string, number> = {}
      teams.forEach(t => { teamPts[t.id] = 0 })
      for (const m of roundMatchesAll) {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers, rc.format)
        })
        const imRes = computeIndividualMatch(m, crs.holes, localHdcps)
        for (const { result, p1TeamId, p2TeamId } of [
          { result: imRes.matchA, p1TeamId: m.twosome1.teamId, p2TeamId: m.twosome2.teamId },
          { result: imRes.matchB, p1TeamId: m.twosome1.teamId, p2TeamId: m.twosome2.teamId },
        ]) {
          if (!result.winner) continue
          const pts = m.isBlind ? 0.5 : 1
          if (result.winner === 'p1') teamPts[p1TeamId] += pts
          else if (result.winner === 'p2') teamPts[p2TeamId] += pts
          else { teamPts[p1TeamId] += pts / 2; teamPts[p2TeamId] += pts / 2 }
        }
        if (!m.isBlind && imRes.match2v2?.winner) {
          const w = imRes.match2v2.winner
          if (w === 'twosome1') teamPts[m.twosome1.teamId] += 1
          else if (w === 'twosome2') teamPts[m.twosome2.teamId] += 1
          else { teamPts[m.twosome1.teamId] += 0.5; teamPts[m.twosome2.teamId] += 0.5 }
        }
      }
      setTeamScoresBatch(teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 })))
    } else if (rc.format === 'vegas') {
      const roundGc = useTournamentStore.getState().gameConfig ?? DEFAULT_GAME_CONFIG
      const teamPts: Record<string, number> = {}
      teams.forEach(t => { teamPts[t.id] = 0 })
      for (const m of roundMatchesAll) {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const allFullyScored = allPids.every(pid => crs.holes.every(h => m.scores[pid]?.[h.number] != null))
        if (!allFullyScored) continue
        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers, rc.format)
        })
        const vRes = computeVegas(m, crs.holes, localHdcps, {
          birdieMultiplier: roundGc.vegasBirdieMultiplier,
          eagleMultiplier: roundGc.vegasEagleMultiplier,
          albatrossMultiplier: roundGc.vegasAlbatrossMultiplier,
        })
        if (!vRes.winner) continue
        const pts = m.isBlind ? roundGc.vegasBlindMatchPts : roundGc.vegasRegularMatchPts
        if (vRes.winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
        else if (vRes.winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
        else { teamPts[m.twosome1.teamId] += pts / 2; teamPts[m.twosome2.teamId] += pts / 2 }
      }
      setTeamScoresBatch(teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 })))
    } else {
      // team_match_play or points_round
      const teamPts: Record<string, number> = {}
      teams.forEach(t => { teamPts[t.id] = 0 })
      for (const m of roundMatchesAll) {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const allFullyScored = allPids.every(pid => crs.holes.every(h => m.scores[pid]?.[h.number] != null))
        if (!allFullyScored) continue
        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers, rc.format)
        })
        const winner = rc.format === 'points_round'
          ? computePointsRound(m, crs.holes, localHdcps).winner
          : computeMatchPlay(m, crs.holes, localHdcps).winner
        const pts = m.isBlind ? 1 : 2
        if (winner === 'twosome1') teamPts[m.twosome1.teamId] += pts
        else if (winner === 'twosome2') teamPts[m.twosome2.teamId] += pts
        else if (winner === 'all_square') {
          teamPts[m.twosome1.teamId] += pts / 2; teamPts[m.twosome2.teamId] += pts / 2
        }
        if (rc.format === 'points_round' && !m.isBlind) {
          if (m.magicBall1) teamPts[m.twosome1.teamId] += 1
          if (m.magicBall2) teamPts[m.twosome2.teamId] += 1
        }
      }
      setTeamScoresBatch(teams.map(t => ({ teamId: t.id, round, points: teamPts[t.id] ?? 0 })))
    }
  }

  function handleSimulateRound(round: number) {
    simulateAndScoreRound(round)
    checkAndShowChampion()
  }

  function handleSimulateAll() {
    for (const rc of roundConfigs) {
      if (matches.some(m => m.round === rc.round)) simulateAndScoreRound(rc.round)
    }
    checkAndShowChampion()
  }

  function handleRefreshBlindScores(round: number) {
    const current = useTournamentStore.getState().matches
    const regularMatches = current.filter(m => m.round === round && !m.isBlind)
    const blindMatches = current.filter(m => m.round === round && m.isBlind)
    for (const blind of blindMatches) {
      const blindPids = [...blind.twosome1.playerIds, ...blind.twosome2.playerIds]
      let merged = { ...blind.scores }
      for (const reg of regularMatches) {
        const regPids = [...reg.twosome1.playerIds, ...reg.twosome2.playerIds]
        for (const pid of regPids) {
          if (blindPids.includes(pid) && reg.scores[pid]) {
            merged[pid] = { ...(merged[pid] ?? {}), ...reg.scores[pid] }
          }
        }
      }
      updateMatch(blind.id, { scores: merged })
    }
    // Recompute results for blind matches after scores are refreshed
    const refreshed = useTournamentStore.getState().matches
    for (const bm of refreshed.filter(m => m.round === round && m.isBlind)) {
      autoUpdateMatchResult(bm)
    }
  }

  return (
    <>
    {championModal && (
      <ChampionModal
        team={championModal.team}
        year={year}
        isComplete={championModal.isComplete}
        onClose={() => setChampionModal(null)}
      />
    )}
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Scorecards</h1>
        {isAdmin && matches.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['team_match_play', 'points_round', 'texas_scramble', 'individual_match', 'captains_choice'] as string[]).includes(config?.format ?? '') && teamScores.some(s => s.round === activeRound) && (
              <button
                onClick={() => { if (confirm('Clear team points for this round? Match scores are kept.')) clearTeamScoresForRound(activeRound) }}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 rounded px-3 py-1.5 transition-colors"
              >
                <Trash2 size={12} /> Clear Team Pts
              </button>
            )}
            <button
              onClick={handleSimulateAll}
              className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 rounded px-3 py-1.5 font-semibold transition-colors"
            >
              <Dices size={13} /> Simulate All Rounds
            </button>
            <button
              onClick={() => {
                if (confirm('Clear ALL scores and results from every match?')) {
                  clearAllMatchScores()
                  clearAllTeamScores()
                  setCtpEntries(ctpEntries.map(e => ({
                    id: e.id, year: e.year, round: e.round, hole: e.hole,
                    courseName: e.courseName, yardage: e.yardage,
                  })))
                }
              }}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded px-3 py-1.5 transition-colors"
            >
              <Trash2 size={12} /> Clear All Scores
            </button>
          </div>
        )}
      </div>

      {/* Round tabs */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map(r => {
          const hasRoundMatches = matches.some(m => m.round === r)
          const locked = isRoundLocked(r)
          return (
            <div key={r} className="flex items-center gap-0.5">
              <button
                onClick={() => { setActiveRound(r); setActiveMatch(getMatchesForRound(matches, r)[0]?.id ?? null) }}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  activeRound === r ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green'
                }`}
              >
                {locked && <Lock size={11} className={activeRound === r ? 'text-white/70' : 'text-amber-500'} />}
                Round {r}
              </button>
              {isAdmin && hasRoundMatches && (
                <>
                  <button
                    onClick={() => locked ? unlockRound(r) : lockRound(r)}
                    title={locked ? `Unlock Round ${r} scores` : `Lock Round ${r} scores`}
                    className={`p-1 rounded transition-colors ${
                      locked
                        ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'
                        : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
                    }`}
                  >
                    {locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </button>
                  {roundConfigs.find(rc => rc.round === r && !['texas_scramble','captains_choice'].includes(rc.format)) && (
                    <button
                      onClick={() => handleRefreshBlindScores(r)}
                      title={`Re-sync blind match scores from regular matches (Round ${r})`}
                      className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <RefreshCw size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => handleSimulateRound(r)}
                    title={`Simulate all Round ${r} matches`}
                    className="p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <Dices size={13} />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* CTP team selector — visible at round level for admin on team formats */}
      {isAdmin && isTeamFmt && roundMatches.length > 0 && (
        <div className="flex items-center gap-2 text-xs bg-gray-50 border border-dashed border-gray-200 rounded p-2">
          <Flag size={12} className="text-masters-green shrink-0" />
          <span className="text-gray-500">CTP entry shown on team playing last:</span>
          <select
            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white"
            value={ctpTeamIds[activeRound] ?? ''}
            onChange={e => setCtpTeamIdStore(activeRound, e.target.value)}
          >
            {roundMatches.map(m => {
              const teamId = m.id.replace(`${activeRound}-`, '')
              const team = teams.find(t => t.id === teamId)
              return <option key={m.id} value={teamId}>{team?.name ?? teamId}</option>
            })}
          </select>
        </div>
      )}

      {/* CTP match selector — visible at round level for admin on non-team formats */}
      {isAdmin && !isTeamFmt && roundMatches.filter(m => !m.isBlind).length > 0 && (
        <div className="flex items-center gap-2 text-xs bg-gray-50 border border-dashed border-gray-200 rounded p-2">
          <Flag size={12} className="text-masters-green shrink-0" />
          <span className="text-gray-500">CTP entry recorded for:</span>
          <select
            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white"
            value={ctpMatchIds[activeRound] ?? 'c'}
            onChange={e => setCtpMatchIdStore(activeRound, e.target.value)}
          >
            {roundMatches.filter(m => !m.isBlind).map(m => {
              const suffix = m.id.replace(`${activeRound}`, '')
              return <option key={m.id} value={suffix}>{m.label}</option>
            })}
          </select>
        </div>
      )}

      <RoundInfoBanner round={activeRound} />

      {isRoundLocked(activeRound) && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
          <Lock size={14} className="shrink-0 text-amber-500" />
          <span>
            <strong>Round {activeRound} is locked.</strong>
            {isAdmin
              ? ' Scores can still be edited — only Scorer logins are restricted.'
              : ' Score entry is disabled. Contact an admin to make changes.'}
          </span>
        </div>
      )}

      {isPlayer && canEnterScores && match && !canEditMatch(activeRound, match) && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          <Lock size={14} className="shrink-0 text-blue-400" />
          <span>Score entry is limited to your own matches on the day they are scheduled.</span>
        </div>
      )}

      {/* Side bets for this match */}
      {match && (() => {
        const activeSideBetsForMatch = sideBets.filter(b => b.matchId === match.id && (b.status === 'pending' || b.status === 'active'))
        if (activeSideBetsForMatch.length === 0 && !isAdmin && !isPlayer) return null
        if (activeSideBetsForMatch.length === 0) return null

        function betSummaryStr(bet: typeof sideBets[0]): string {
          const rc2 = roundConfigs.find(r => r.round === bet.round)
          const crs2 = rc2 ? courses.find(c => c.id === rc2.courseId) : null
          if (!crs2) return '—'
          const allPlayers = teams.flatMap(t => t.players)
          const hdcps: Record<string, number> = {}
          for (const p of bet.participants) {
            const player = allPlayers.find(pl => pl.id === p.playerId)
            if (player) hdcps[p.playerId] = getPlayerCourseHdcp(player, crs2, rc2!.tee, bet.round, allPlayers)
          }
          try { return computeSideBet(bet, match!, crs2.holes, hdcps).summary } catch { return '—' }
        }

        return (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-header text-sm mb-0">Side Bets</h3>
              <Link to="/side-bets" className="text-xs text-masters-green hover:underline">View all</Link>
            </div>
            <div className="space-y-1">
              {activeSideBetsForMatch.map(bet => (
                <Link key={bet.id} to={`/side-bets/${bet.id}`} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0 hover:text-masters-green">
                  <span className="font-medium">{SIDE_BET_FORMAT_NAMES[bet.format] ?? bet.format}</span>
                  <span className="text-gray-500 text-xs">{betSummaryStr(bet)}</span>
                </Link>
              ))}
            </div>
            {(isAdmin || isPlayer) && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <Link
                  to="/side-bets/new"
                  className="text-xs text-masters-green hover:underline flex items-center gap-1"
                >
                  + New side bet for this match
                </Link>
              </div>
            )}
          </div>
        )
      })()}

      {matches.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Generate pairings first to view scorecards.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Match list — horizontal pill row on mobile/landscape, sidebar on desktop */}
          <div className="
            flex flex-row overflow-x-auto no-scrollbar gap-2 pb-1 -mx-4 px-4
            lg:flex-col lg:overflow-visible lg:shrink-0 lg:w-40 lg:gap-0 lg:space-y-2 lg:pb-0 lg:mx-0 lg:px-0
          ">
            <p className="hidden lg:block text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">{getRoundName(activeRound, roundConfigs)}</p>
            {roundMatches.length === 0 && (
              <p className="text-sm text-gray-400 shrink-0">No matches for this round.</p>
            )}
            {(() => {
              const regularMatches = roundMatches.filter(m => !m.isBlind)
              return roundMatches.map(m => {
                const scored = Object.keys(m.scores).length > 0
                const teeTimeRaw = !m.isBlind ? config?.teeTimes?.[regularMatches.indexOf(m)] : undefined
                const teeTime = teeTimeRaw ? (() => {
                  const [h, min] = teeTimeRaw.split(':').map(Number)
                  const ampm = h >= 12 ? 'PM' : 'AM'
                  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                  return `${h12}:${String(min).padStart(2,'0')} ${ampm}`
                })() : null
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMatch(m.id)}
                    className={`shrink-0 lg:w-full text-left rounded border p-2 text-sm transition-colors ${
                      activeMatch === m.id
                        ? 'border-masters-green bg-masters-light'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold">{m.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {teeTime && <span className="text-[10px] text-masters-gold font-semibold">{teeTime}</span>}
                        {m.isBlind && <span className="badge bg-gray-100 text-gray-500">Blind</span>}
                        {scored && <span className="badge bg-masters-light text-masters-green">●</span>}
                      </div>
                    </div>
                    {/* Player names: visible on desktop, hidden on mobile to keep pills compact */}
                    <div className="hidden lg:block text-xs text-gray-500 mt-0.5">
                      {(config?.format === 'texas_scramble' || config?.format === 'captains_choice')
                        ? [...m.twosome1.playerIds, ...m.twosome2.playerIds]
                            .map(id => teams.flatMap(t => t.players).find(p => p.id === id)?.name.split(' ')[0] ?? id)
                            .join(', ')
                        : <>
                            {m.twosome1.playerIds.map(id => teams.flatMap(t => t.players).find(p => p.id === id)?.name.split(' ')[0] ?? id).join('/')}
                            {' vs '}
                            {m.twosome2.playerIds.map(id => teams.flatMap(t => t.players).find(p => p.id === id)?.name.split(' ')[0] ?? id).join('/')}
                          </>
                      }
                    </div>
                  </button>
                )
              })
            })()}
          </div>

          {/* Scorecard detail */}
          <div className="flex-1 min-w-0">
            {!match || !config || !course ? (
              <div className="card text-center py-12 text-gray-400">
                Select a match to view/enter scores.
              </div>
            ) : (
              <div className="space-y-4">
                {match.isBlind && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700 flex items-center gap-2">
                    <span className="font-semibold">Blind Match</span>
                    <span className="text-blue-500">—</span>
                    <span>Scores sync automatically from the corresponding regular matches. Worth <strong>1 pt</strong> (or ½ each if tied).</span>
                  </div>
                )}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {/* --- MOBILE SCORING FEATURE (remove this block + Smartphone import to revert) --- */}
                  {(() => {
                    // Find the first hole where any player has no score yet
                    let startHole = 1
                    if (match) {
                      if (config?.format === 'captains_choice' && match.teamHoleScores) {
                        for (let h = 1; h <= 18; h++) {
                          if (match.teamHoleScores[h] == null) { startHole = h; break }
                        }
                      } else {
                        const pids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
                        for (let h = 1; h <= 18; h++) {
                          if (!pids.every(pid => match.scores[pid]?.[h] != null)) { startHole = h; break }
                        }
                      }
                    }
                    return (
                      <Link
                        to={`/scorecards/${match.id}/mobile?round=${activeRound}&hole=${startHole}`}
                        className="flex items-center gap-1.5 text-xs bg-masters-green text-white border border-masters-green hover:bg-masters-dark rounded px-3 py-1.5 font-semibold transition-colors lg:hidden"
                      >
                        <Smartphone size={13} /> Score Hole-by-Hole
                      </Link>
                    )
                  })()}
                  {/* --- END MOBILE SCORING --- */}
                  {isAdmin && !match.isBlind && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleSimulate}
                        className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 rounded px-3 py-1.5 font-semibold transition-colors"
                      >
                        <Dices size={13} /> Simulate Scores
                      </button>
                      <button
                        onClick={() => {
                          clearMatchScores(match.id)
                          clearTeamScoresForRound(match.round)
                          if (showCtpPanel) {
                            setCtpEntries(useTournamentStore.getState().ctpEntries.filter(
                              e => !(e.year === year && e.round === activeRound)
                            ))
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded px-3 py-1.5 transition-colors"
                      >
                        <Trash2 size={12} /> Clear Scores
                      </button>
                    </div>
                  )}
                  {(isAdmin || (isPlayer && match && isPlayerInMatch(match))) && (
                    <button
                      onClick={handleSendMatchEmail}
                      disabled={sendingEmail}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      <Mail size={13} /> Email Match
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={handleSendRoundEmail}
                      disabled={sendingEmail}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      <Mail size={13} /> Email Round
                    </button>
                  )}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrint}
                        className="btn-secondary flex items-center gap-1.5 text-sm"
                      >
                        <Printer size={14} /> Print Scorecard
                      </button>
                      <button
                        onClick={handlePrintRound}
                        className="btn-ghost flex items-center gap-1.5 text-sm"
                      >
                        <Printer size={14} /> Print Round
                      </button>
                    </div>
                  )}
                </div>

                {emailStatus && (
                  <div className={`text-xs px-3 py-2 rounded flex items-center gap-2 ${emailStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <Mail size={12} /> {emailStatus.msg}
                  </div>
                )}

                <div ref={printRef}>
                  <ScorecardCard
                    match={match}
                    teams={teams}
                    course={course}
                    config={config}
                    interactive={canEditMatch(activeRound, match) && !match.isBlind}
                    onScoreChange={(pid, hole, val) => {
                      setMatchScore(match.id, pid, hole, val)
                      const latestMatches = useTournamentStore.getState().matches
                      if (config.format === 'team_match_play') {
                        recomputeMatchPlayTeamScores(latestMatches)
                      }
                      if (config.format === 'points_round') {
                        recomputePointsRoundTeamScores(latestMatches)
                      }
                      if (config.format === 'texas_scramble') {
                        recomputeScrambleTeamScores(latestMatches)
                      }
                      if (config.format === 'individual_match') {
                        recomputeIndividualMatchTeamScores(latestMatches)
                      }
                      if (config.format === 'vegas') {
                        recomputeVegasTeamScores(latestMatches)
                      }
                      if (config.format === 'team_match_play' || config.format === 'individual_match' || config.format === 'vegas' || config.format === 'points_round') {
                        const cur = latestMatches.find(m => m.id === match.id)
                        if (cur) autoUpdateMatchResult(cur)
                        // Also update result for blind matches in this round (scores just propagated)
                        for (const bm of latestMatches.filter(m => m.round === activeRound && m.isBlind)) {
                          autoUpdateMatchResult(bm)
                        }
                      }
                    }}
                    onTeamHoleScoreChange={(hole, val) => {
                      setTeamHoleScore(match.id, hole, val)
                      recomputeCaptainsChoiceTeamScores(useTournamentStore.getState().matches)
                    }}
                    onTeeShotChange={(hole, pid) => setTeeShot(match.id, hole, pid)}
                  />
                </div>
                {/* Par 3 CTP entry — Match C for twosome rounds, last team for team rounds */}
                {showCtpPanel && (
                  <CtpPanel
                    round={activeRound}
                    canEdit={canEditMatch(activeRound, match)}
                    canMarkPaid={isAdmin}
                  />
                )}

                {/* Magic Ball (Round 2 regular matches only) */}
                {config.format === 'points_round' && !match.isBlind && (
                  <div className="card space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="section-header text-sm mb-0">Magic Ball</h3>
                      <span className="text-[10px] text-gray-400">+1 pt per twosome · 6 pts total available</span>
                    </div>
                    <p className="text-xs text-gray-500">Did each twosome finish the round holding the Magic Ball?</p>
                    <div className="flex gap-3 flex-wrap">
                      {([
                        { field: 'magicBall1' as const, twosome: match.twosome1, val: match.magicBall1 },
                        { field: 'magicBall2' as const, twosome: match.twosome2, val: match.magicBall2 },
                      ]).map(({ field, twosome, val }) => {
                        const team = teams.find(t => t.id === twosome.teamId)
                        return (
                          <div key={field} className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: team?.color ?? '#666' }}>
                              {team?.name ?? 'Team'}
                            </span>
                            {canEditMatch(activeRound, match) ? (
                              <button
                                onClick={() => handleMBToggle(field, !val)}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-semibold transition-colors ${
                                  val
                                    ? 'bg-amber-100 border-amber-400 text-amber-700'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                ★ {val ? 'Has MB' : 'No MB'}
                              </button>
                            ) : (
                              <span className={`text-xs font-semibold ${val ? 'text-amber-600' : 'text-gray-400'}`}>
                                {val ? '★ Has MB' : 'No MB'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <ScoreSummary match={match} teams={teams} course={course} config={config} />

                {canEditMatch(activeRound, match) ? (
                  <div className="card">
                    <label className="label">
                      Match Result
                      {(config?.format === 'team_match_play' || config?.format === 'individual_match') && (
                        <span className="ml-1 text-[10px] text-gray-400 normal-case font-normal">(auto-updated)</span>
                      )}
                    </label>
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

    {/* Round print content — hidden on screen via @media screen; renders normally in react-to-print's print iframe */}
    <div ref={printRoundRef} className="print-round-preview" aria-hidden="true">
      {config && course && chunk(roundMatches, 2).map((pair, pi) => (
        <div key={pi} className="print-page-break bg-white">
          <div className="scorecard-half">
            <ScorecardCard match={pair[0]} teams={teams} course={course} config={config} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', margin: '0 12px', gap: 6, color: '#9ca3af' }}>
            <span style={{ fontSize: 13, lineHeight: 1, transform: 'rotate(270deg)', display: 'inline-block', flexShrink: 0 }}>✂</span>
            <div style={{ flex: 1, borderTop: '1.5px dashed #d1d5db' }} />
            <span style={{ fontSize: 9, letterSpacing: '0.08em', flexShrink: 0, userSelect: 'none' }}>CUT</span>
            <div style={{ flex: 1, borderTop: '1.5px dashed #d1d5db' }} />
          </div>
          {pair[1] ? (
            <div className="scorecard-half">
              <ScorecardCard match={pair[1]} teams={teams} course={course} config={config} />
            </div>
          ) : (
            <div className="scorecard-half flex items-center justify-center text-gray-200">
              <span className="font-serif text-sm">Juggerknocker Invitational {year}</span>
            </div>
          )}
        </div>
      ))}
    </div>
    </>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function ChampionModal({ team, year, isComplete, onClose }: { team: Team; year: number; isComplete: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="rounded-xl overflow-hidden shadow-2xl max-w-sm w-full"
        style={{ background: 'linear-gradient(180deg, #060d08 0%, #0b1610 100%)', border: `2px solid ${team.color}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${team.color}, transparent)` }} />

        <div className="px-6 py-7 text-center space-y-2">
          <p className="text-base font-semibold text-white tracking-wide">
            {year} Juggerknocker Invitational Champions
          </p>
          <div className="py-2 text-7xl leading-none select-none">🏆</div>
          <p
            className="text-4xl font-serif font-bold text-white"
            style={{ textShadow: `0 0 30px ${team.color}` }}
          >
            {team.name}
          </p>
          {!isComplete && (
            <p className="text-xs text-white/60 italic">Mathematically clinched</p>
          )}
        </div>

        <div className="h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${team.color}, transparent)` }} />

        <div className="px-6 py-4 flex gap-3 justify-center bg-black/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-white/25 text-white/80 text-sm hover:border-white/50 hover:text-white transition-colors"
          >
            Dismiss
          </button>
          <Link
            to="/"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: team.color }}
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function ScoreSummary({ match, teams, course, config }: { match: any, teams: any, course: any, config: any }) {
  const allPlayers = teams.flatMap((t: any) => t.players)

  const allPlayerIds = [
    ...match.twosome1.playerIds,
    ...match.twosome2.playerIds,
  ]

  // Build HDCPs using full tournament netting (same logic as ScorecardCard)
  const playerHdcps: Record<string, number> = {}
  allPlayerIds.forEach((pid: string) => {
    const player = allPlayers.find((p: any) => p.id === pid)
    if (player) playerHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
  })
  if (config.format === 'captains_choice') {
    const teeData = course.tees.find((t: any) => t.name === config.tee) ?? course.tees[0]
    const minIndex = allPlayers.length > 0 ? Math.min(...allPlayers.map((p: any) => p.handicapIndex)) : 0
    const r5Sum = allPlayerIds.reduce((s: number, pid: string) => {
      const player = allPlayers.find((p: any) => p.id === pid)
      return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, false) : 0)
    }, 0)
    const teamHdcp = Math.round(r5Sum * 0.15)
    allPlayerIds.forEach((pid: string) => { playerHdcps[pid] = teamHdcp })
  }

  // Individual Match Play: show per-player HDCP/gross/net + 1v1 and 2v2 match results
  if (config.format === 'individual_match') {
    const allPlayers = teams.flatMap((t: any) => t.players)
    const imRes = computeIndividualMatch(match, course.holes, playerHdcps)

    function get1v1Status(result: ReturnType<typeof computeIndividualMatch>['matchA'], p1Id: string, p2Id: string): { text: string; color: string } {
      const p1Last = allPlayers.find((p: any) => p.id === p1Id)?.name.split(' ').slice(-1)[0] ?? '?'
      const p2Last = allPlayers.find((p: any) => p.id === p2Id)?.name.split(' ').slice(-1)[0] ?? '?'
      if (result.winner === 'all_square') return { text: 'All Square', color: 'text-gray-600' }
      if (result.winner === 'p1') return { text: `${p1Last} wins ${result.winLabel}`, color: 'text-masters-green' }
      if (result.winner === 'p2') return { text: `${p2Last} wins ${result.winLabel}`, color: 'text-masters-green' }
      if (result.holesPlayed === 0) return { text: '—', color: 'text-gray-400' }
      const r = result.running[result.holesPlayed - 1]
      if (r === 0) return { text: `All Square thru ${result.holesPlayed}`, color: 'text-gray-600' }
      const upLast = r > 0 ? p1Last : p2Last
      return { text: `${upLast} +${Math.abs(r)} thru ${result.holesPlayed}`, color: 'text-masters-green' }
    }

    const t1Team = teams.find((t: any) => t.id === match.twosome1.teamId)
    const t2Team = teams.find((t: any) => t.id === match.twosome2.teamId)

    return (
      <div className="card space-y-3">
        <h3 className="section-header text-base">Score Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-masters-light">
                <th className="p-2 text-left">Player</th>
                <th className="p-2">HDCP</th>
                <th className="p-2">Gross</th>
                <th className="p-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {allPlayerIds.map((pid: string) => {
                const player = allPlayers.find((p: any) => p.id === pid)
                if (!player) return null
                const hdcp = playerHdcps[pid] ?? 0
                const scores = match.scores[pid] ?? {}
                const gross = Object.values(scores).reduce((s: number, v: any) => s + (v ?? 0), 0) as number
                const net = gross - hdcp
                const playerTeam = teams.find((t: any) => t.players.some((p: any) => p.id === pid))
                return (
                  <tr key={pid} className="border-t">
                    <td className="p-2 font-semibold" style={{ color: playerTeam?.color ?? '#333' }}>{player.name}</td>
                    <td className="p-2 text-center">{hdcp}</td>
                    <td className="p-2 text-center">{gross || '–'}</td>
                    <td className="p-2 text-center">{gross ? net : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5">
          {([
            { label: '1v1 Match A', result: imRes.matchA, p1Id: match.twosome1.playerIds[0], p2Id: match.twosome2.playerIds[0] },
            { label: '1v1 Match B', result: imRes.matchB, p1Id: match.twosome1.playerIds[1], p2Id: match.twosome2.playerIds[1] },
          ] as const).map(({ label, result, p1Id, p2Id }) => {
            const p1Last = allPlayers.find((p: any) => p.id === p1Id)?.name.split(' ').slice(-1)[0] ?? '?'
            const p2Last = allPlayers.find((p: any) => p.id === p2Id)?.name.split(' ').slice(-1)[0] ?? '?'
            const { text, color } = get1v1Status(result, p1Id, p2Id)
            return (
              <div key={label} className="flex items-center justify-between bg-masters-light rounded p-2 text-xs">
                <span className="font-semibold text-masters-dark">
                  {label}: <span style={{ color: t1Team?.color }}>{p1Last}</span> vs <span style={{ color: t2Team?.color }}>{p2Last}</span>
                </span>
                <span className={`font-bold ${color}`}>{text}</span>
              </div>
            )
          })}
          {!match.isBlind && imRes.match2v2 && (() => {
            const w = imRes.match2v2.winner
            const status = !w ? '—'
              : w === 'all_square' ? 'All Square'
              : `${teams.find((t: any) => t.id === (w === 'twosome1' ? match.twosome1.teamId : match.twosome2.teamId))?.name} wins ${imRes.match2v2.winLabel}`
            return (
              <div className="flex items-center justify-between bg-masters-light rounded p-2 text-xs">
                <span className="font-semibold text-masters-dark">
                  2v2 Best Ball: <span style={{ color: t1Team?.color }}>{t1Team?.name}</span> vs <span style={{ color: t2Team?.color }}>{t2Team?.name}</span>
                </span>
                <span className={`font-bold ${w && w !== 'all_square' ? 'text-masters-green' : 'text-gray-600'}`}>{status}</span>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // Captain's Choice: show team total and tee shot counts
  if (config.format === 'captains_choice') {
    const teeData = course.tees.find((t: any) => t.name === config.tee) ?? course.tees[0]
    const minIndex = allPlayers.length > 0 ? Math.min(...allPlayers.map((p: any) => p.handicapIndex)) : 0
    const r5Sum = allPlayerIds.reduce((s: number, pid: string) => {
      const player = allPlayers.find((p: any) => p.id === pid)
      return s + (player ? tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, false) : 0)
    }, 0)
    const teamHdcp = Math.round(r5Sum * 0.15)
    const ccResult = computeCaptainsChoice(match.teamHoleScores, course.holes, teamHdcp)
    const teeShotsUsed = match.teeShotsUsed ?? {}

    return (
      <div className="card space-y-3">
        <h3 className="section-header text-base">Score Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-masters-light">
                <th className="p-2 text-left">Player</th>
                <th className="p-2">Tee Shots Used</th>
                <th className="p-2">Min Met</th>
              </tr>
            </thead>
            <tbody>
              {allPlayerIds.map((pid: string) => {
                const player = allPlayers.find((p: any) => p.id === pid)
                if (!player) return null
                const count = Object.values(teeShotsUsed).filter(p => p === pid).length
                const met = count >= 3
                return (
                  <tr key={pid} className="border-t">
                    <td className="p-2 font-semibold">{player.name}</td>
                    <td className="p-2 text-center font-bold">{count}</td>
                    <td className={`p-2 text-center font-bold ${met ? 'text-masters-green' : 'text-red-500'}`}>
                      {met ? '✓' : '✗'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between bg-masters-light rounded p-3">
          <div>
            <span className="text-sm font-semibold text-masters-dark">Team HDCP</span>
            <span className="ml-2 text-sm font-bold text-masters-green">{teamHdcp}</span>
          </div>
          {ccResult.total !== 0 && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Net Total</div>
              <div className="text-2xl font-serif font-bold text-masters-green">{ccResult.total}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Scramble: show team total and per-player gross
  if (config.format === 'texas_scramble') {
    const srResult = computeScramble(match, course.holes, playerHdcps)
    return (
      <div className="card space-y-3">
        <h3 className="section-header text-base">Score Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-masters-light">
                <th className="p-2 text-left">Player</th>
                <th className="p-2">HDCP (60%)</th>
                <th className="p-2">Gross</th>
              </tr>
            </thead>
            <tbody>
              {allPlayerIds.map((pid: string) => {
                const player = allPlayers.find((p: any) => p.id === pid)
                if (!player) return null
                const hdcp = playerHdcps[pid] ?? 0
                const scores = match.scores[pid] ?? {}
                const gross = Object.values(scores).reduce((s: number, v: any) => s + (v ?? 0), 0) as number
                return (
                  <tr key={pid} className="border-t">
                    <td className="p-2 font-semibold">{player.name}</td>
                    <td className="p-2 text-center">{hdcp}</td>
                    <td className="p-2 text-center">{gross || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {srResult.total > 0 && (
          <div className="bg-masters-light rounded p-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-masters-dark">Team Net Total</span>
            <span className="text-2xl font-serif font-bold text-masters-green">{srResult.total}</span>
          </div>
        )}
      </div>
    )
  }

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
              const hdcp = playerHdcps[pid] ?? 0
              const scores = match.scores[pid] ?? {}
              const gross = Object.values(scores).reduce((s: number, v: any) => s + (v ?? 0), 0) as number
              const net = gross - hdcp

              let pts = 0
              if (config.format === 'points_round') {
                course.holes.forEach((h: any) => {
                  const g = scores[h.number]
                  if (g != null) pts += stablefordPoints(g, h.par, 0)
                })
              }

              const coursePar = course.holes.reduce((s: number, h: any) => s + h.par, 0)
              const quota = Math.round(coursePar / 2) - hdcp

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

// Generates realistic random gross scores for all 4 players in a match.
// ─── Round info banner ────────────────────────────────────────────────────────

interface FormatInfo {
  label: string
  totalPoints: number
  description: string
  scoring: { label: string; detail: string }[]
  points: { label: string; value: string }[]
}

function getFormatInfo(gc: GameConfig): Record<string, FormatInfo> {
  const scrPct = Math.round(gc.texasScrambleHdcpPct * 100)
  const ccPct  = Math.round(gc.captainsChoiceHdcpPct * 100)
  const minTees = gc.captainsChoiceMinTeeBalls
  const fmt = (n: number) => n % 1 === 0 ? `${n}` : `${n}`
  return {
    team_match_play: {
      label: 'Team Match Play',
      totalPoints: 9,
      description: 'Two-vs-two twosome format. Each team puts up their best NET score per hole. The twosome with the lowest net wins the hole. Most holes won wins the match.',
      scoring: [
        { label: 'NET scoring', detail: 'Gross score minus per-hole handicap strokes' },
        { label: 'Best ball', detail: 'Each twosome counts only their better net score per hole' },
        { label: 'Hole win', detail: 'Low net wins the hole; tie = halved' },
      ],
      points: [
        { label: 'Regular match', value: `${gc.regularMatchPts} pts` },
        { label: 'Blind match', value: `${gc.blindMatchPts} pt` },
      ],
    },
    points_round: {
      label: 'Points Round (Stableford)',
      totalPoints: 15,
      description: 'Each player earns gross Stableford points on every hole. The goal is to accumulate as many points as possible relative to your twosome\'s combined Quota. Twosome Quota = course par − (HDCP_A + HDCP_B). Example: par 72, HDCPs 10+10 → Quota = 52. The twosome furthest above their Quota wins.',
      scoring: [
        { label: 'Albatross (−3)', detail: `${fmt(gc.stablefordAlbatross)} pts` },
        { label: 'Eagle (−2)', detail: `${fmt(gc.stablefordEagle)} pts` },
        { label: 'Birdie (−1)', detail: `${fmt(gc.stablefordBirdie)} pts` },
        { label: 'Par (E)', detail: `${fmt(gc.stablefordPar)} pts` },
        { label: 'Bogey (+1)', detail: `${fmt(gc.stablefordBogey)} pt` },
        { label: 'Double bogey (+2)', detail: `${gc.stablefordDouble === 0.5 ? '½' : fmt(gc.stablefordDouble)} pt` },
        { label: 'Worse', detail: '0 pts' },
      ],
      points: [
        { label: 'Regular match', value: `${gc.regularMatchPts} pts` },
        { label: 'Blind match', value: `${gc.blindMatchPts} pt` },
        ...(gc.enableMagicBall ? [{ label: 'Magic Ball — special ball assigned to each twosome; players alternate using it for entire holes (A on hole 1, B on hole 2, etc.); twosome still holding it at finish earns the bonus', value: '1 pt' }] : []),
      ],
    },
    texas_scramble: {
      label: 'Texas Scramble',
      totalPoints: gc.teamFinish1stPts + gc.teamFinish2ndPts + gc.teamFinish3rdPts,
      description: `All 4 players tee off, choose the best drive, then each plays from that spot. ${scrPct}% of each player's course HDCP applied. Best-ball count increases as the round progresses.`,
      scoring: [
        { label: 'Holes 1–6', detail: 'Best 1 ball' },
        { label: 'Holes 7–12', detail: 'Best 2 balls' },
        { label: 'Holes 13–15', detail: 'Best 3 balls' },
        { label: 'Holes 16–18', detail: 'Best 4 balls (all players)' },
      ],
      points: [
        { label: '1st place', value: `${gc.teamFinish1stPts} pts` },
        { label: '2nd place', value: `${gc.teamFinish2ndPts} pts` },
        { label: '3rd place', value: `${gc.teamFinish3rdPts} pt` },
      ],
    },
    individual_match: {
      label: 'Individual Match Play',
      totalPoints: 12,
      description: 'Each player plays their own ball with NET scoring. Two sub-matches run simultaneously: each player\'s individual result plus a twosome best-ball result per pairing.',
      scoring: [
        { label: 'NET scoring', detail: 'Gross minus full course HDCP strokes per hole' },
        { label: 'Individual match', detail: 'Each of the 4 players plays straight match play vs. their opponent' },
        { label: 'Twosome match', detail: 'Each twosome\'s best net score competes vs. the opposing twosome' },
      ],
      points: [
        { label: 'Individual match', value: '1 pt' },
        { label: 'Twosome best-ball', value: '1 pt' },
        { label: 'Blind match', value: `${gc.blindMatchPts} pt` },
      ],
    },
    captains_choice: {
      label: "Captain's Choice",
      totalPoints: gc.teamFinish1stPts + gc.teamFinish2ndPts + gc.teamFinish3rdPts,
      description: `The team captain selects which shot to play after all players tee off. HDCP is ${ccPct}% of the combined team handicap.${minTees > 0 ? ` Minimum ${minTees} tee shots per player must be used across the round.` : ''}`,
      scoring: [
        { label: 'Team HDCP', detail: `floor(sum of all 4 player course HDCPs × ${ccPct}%)` },
        ...(minTees > 0 ? [{ label: 'Min tee balls', detail: `Each player's drive must be selected at least ${minTees} times` }] : []),
        { label: 'Net score', detail: 'Team gross minus HDCP; lowest net wins' },
      ],
      points: [
        { label: '1st place', value: `${gc.teamFinish1stPts} pts` },
        { label: '2nd place', value: `${gc.teamFinish2ndPts} pts` },
        { label: '3rd place', value: `${gc.teamFinish3rdPts} pt` },
      ],
    },
    vegas: {
      label: 'Vegas',
      totalPoints: gc.vegasRegularMatchPts * 3 + gc.vegasBlindMatchPts * 3,
      description: 'Each twosome combines their net scores into a two-digit Vegas number. Lower number wins the hole and earns points equal to the difference. Birdie, eagle, and albatross by the winning team multiply those points.',
      scoring: [
        { label: 'Net scoring', detail: 'Gross minus per-hole handicap strokes' },
        { label: 'Vegas number', detail: 'Lower net as tens digit, higher net as units digit (e.g., net 4+5 → 45)' },
        { label: 'Hole pts', detail: '|t1 Vegas − t2 Vegas|; lower number wins' },
        { label: `Birdie multiplier`, detail: `${gc.vegasBirdieMultiplier}× hole points` },
        { label: `Eagle multiplier`, detail: `${gc.vegasEagleMultiplier}× hole points` },
        { label: `Albatross multiplier`, detail: `${gc.vegasAlbatrossMultiplier}× hole points` },
      ],
      points: [
        { label: 'Regular match', value: `${gc.vegasRegularMatchPts} pts` },
        { label: 'Blind match', value: `${gc.vegasBlindMatchPts} pt` },
      ],
    },
  }
}

function RoundInfoBanner({ round }: { round: number }) {
  const [expanded, setExpanded] = useState(false)
  const { roundConfigs, courses, gameConfig } = useTournamentStore(s => ({
    roundConfigs: s.roundConfigs, courses: s.courses, gameConfig: s.gameConfig,
  }))
  const rc = roundConfigs.find(r => r.round === round)
  const info = rc ? getFormatInfo(gameConfig ?? DEFAULT_GAME_CONFIG)[rc.format] : undefined
  if (!info || !rc) return null

  const courseName = courses.find(c => c.id === rc.courseId)?.name
  const courseLabel = [courseName, rc.date].filter(Boolean).join(' · ')

  return (
    <div className="bg-masters-light border border-masters-green/20 rounded-lg p-4 space-y-3">
      {/* Header row — tappable on mobile to toggle details */}
      <div
        className="flex items-center justify-between gap-2 lg:cursor-default cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-serif font-bold text-masters-dark text-base">{info.label}</h2>
          {courseLabel && <span className="text-xs text-gray-500">{courseLabel}</span>}
        </div>
        <ChevronDown
          size={16}
          className={`lg:hidden shrink-0 text-masters-dark transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {/* Expandable body — always visible on desktop, toggle on mobile */}
      <div className={`space-y-3 ${expanded ? 'block' : 'hidden'} lg:block`}>
        <p className="text-sm text-gray-700">{info.description}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Scoring</p>
            <ul className="space-y-1">
              {info.scoring.map(s => (
                <li key={s.label} className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-masters-dark shrink-0">{s.label}</span>
                  <span className="text-gray-500">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{info.totalPoints} Team Points Available</p>
            <div className="flex flex-wrap gap-2">
              {info.points.map(p => (
                <div key={p.label} className="bg-white border border-masters-green/30 rounded px-2 py-1 text-xs">
                  <span className="font-bold text-masters-green">{p.value}</span>
                  <span className="text-gray-500 ml-1">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Score simulation ─────────────────────────────────────────────────────────

// Each player's scores are weighted around their expected net (par + strokes received),
// producing a distribution from occasional birdie to triple bogey.
function simulateMatchScores(
  match: Match,
  course: Course,
  config: RoundConfig,
  teams: Team[],
): Record<string, Record<number, number>> {
  const allPlayers = teams.flatMap(t => t.players)
  const playerIds = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
  const result: Record<string, Record<number, number>> = {}

  for (const pid of playerIds) {
    const player = allPlayers.find(p => p.id === pid)
    if (!player) continue
    const hdcp = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers, config.format)
    result[pid] = {}
    for (const hole of course.holes) {
      const dotsStr = getStrokeDots(hdcp, hole.hdcpOrder)
      const strokes = dotsStr === '..' ? 2 : dotsStr === '.' ? 1 : 0
      // Weight: 5% birdie, 20% par, 35% bogey, 25% double, 15% triple
      const r = Math.random()
      const variance = r < 0.05 ? -1 : r < 0.25 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3
      result[pid][hole.number] = Math.max(1, hole.par + strokes + variance)
    }
  }
  return result
}
