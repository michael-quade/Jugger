import { useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin, useCanEnterScores } from '../store/useAuthStore'
import ScorecardCard from '../components/ScorecardCard'
import { CtpPanel, getPar3Holes } from '../components/CtpPanel'
import { getMatchesForRound } from '../utils/pairings'
import { getPlayerCourseHdcp, tournamentHdcp, stablefordPoints, getStrokeDots } from '../utils/handicap'
import { computeMatchPlay, computePointsRound, computeScramble, computeCaptainsChoice, computeIndividualMatch } from '../utils/matchplay'
import { Printer, Dices, Trash2, Flag, Trophy } from 'lucide-react'
import type { Match, Course, RoundConfig, Team, CtpEntry } from '../types'
import { computeChampion, getDefendingChampionId } from '../utils/champion'

const ROUND_NAMES: Record<number, string> = {
  1: 'Round 1 — Team Match Play',
  2: 'Round 2 — Points Round',
  3: 'Round 3 — Texas Scramble',
  4: 'Round 4 — Individual Match Play',
  5: "Round 5 — Captain's Choice",
}

export default function ScorecardView() {
  const { teams, matches, courses, roundConfigs, year, setMatchScore, updateMatch, clearMatchScores, clearAllMatchScores, teamScores, setTeamScore, clearAllTeamScores, clearTeamScoresForRound, setTeamHoleScore, setTeeShot, ctpEntries, updateCtpEntry, setCtpEntries, archivedYears } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const canEnterScores = useCanEnterScores()
  const [searchParams] = useSearchParams()
  const [activeRound, setActiveRound] = useState(() => Number(searchParams.get('round')) || 1)
  const [activeMatch, setActiveMatch] = useState<string | null>(() => searchParams.get('match'))
  const printRef = useRef<HTMLDivElement>(null)

  const [championModal, setChampionModal] = useState<{ team: Team; isComplete: boolean } | null>(null)

  const defaultCtpTeamId = teams[teams.length - 1]?.id ?? ''
  const [ctpTeamIds, setCtpTeamIds] = useState<Record<number, string>>({ 3: defaultCtpTeamId, 5: defaultCtpTeamId })

  const roundMatches = getMatchesForRound(matches, activeRound)
  const config = roundConfigs.find(r => r.round === activeRound)
  const course = courses.find(c => c.id === config?.courseId)
  const match = matches.find(m => m.id === activeMatch)

  const isTeamFmt = config?.format === 'texas_scramble' || config?.format === 'captains_choice'
  const effectiveCtpTeamId = ctpTeamIds[activeRound] ?? defaultCtpTeamId
  const showCtpPanel = !!(match && !match.isBlind && (
    (!isTeamFmt && match.id === `${activeRound}c`) ||
    (isTeamFmt && match.id === `${activeRound}-${effectiveCtpTeamId}`)
  ))

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `@page { size: letter; margin: 0.35in; } body { font-size: 8pt; background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }`,
    documentTitle: match ? `Jugger ${year} — ${match.label}` : `Jugger ${year} Scorecard`,
  })

  // Shared team score computation for points_round — call after any MB toggle.
  // Pass updatedMatches to incorporate an in-flight match update not yet in store.
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
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
        })
        const prRes = computePointsRound(m, course.holes, localHdcps)
        const pts = m.isBlind ? 1 : 2
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

    teams.forEach(t => {
      setTeamScore({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 })
    })
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
        if (player) hdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
      })
      return { match: m, result: computeScramble(m, course.holes, hdcps) }
    })

    // Only award points once all 3 teams are done
    if (!results.every(r => r.result.isDone)) return

    const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
    const POINTS = [4, 2, 1]
    teams.forEach(t => setTeamScore({ teamId: t.id, round: config.round, points: 0 }))
    ranked.forEach(({ match: m }, i) => {
      setTeamScore({ teamId: m.twosome1.teamId, round: config.round, points: POINTS[i] ?? 1 })
    })
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
    const POINTS = [4, 2, 1]
    teams.forEach(t => setTeamScore({ teamId: t.id, round: config.round, points: 0 }))
    ranked.forEach(({ match: m }, i) => {
      setTeamScore({ teamId: m.twosome1.teamId, round: config.round, points: POINTS[i] ?? 1 })
    })
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
        if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
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

    teams.forEach(t => {
      setTeamScore({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 })
    })
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
    Object.entries(simScores).forEach(([pid, holes]) => {
      Object.entries(holes).forEach(([hole, score]) => {
        setMatchScore(match.id, pid, Number(hole), score)
      })
    })
    // Randomly assign Magic Ball for Round 2 regular matches
    let simMb1 = match.magicBall1
    let simMb2 = match.magicBall2
    if (config.format === 'points_round' && !match.isBlind) {
      simMb1 = Math.random() < 0.5
      simMb2 = Math.random() < 0.5
      updateMatch(match.id, { magicBall1: simMb1, magicBall2: simMb2 })
    }

    // Simulate CTP winners for eligible matches (all formats)
    if (showCtpPanel) {
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
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
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

      teams.forEach(t => {
        setTeamScore({ teamId: t.id, round: config.round, points: teamPts[t.id] ?? 0 })
      })
    }

    checkAndShowChampion()
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
        Object.entries(simScores).forEach(([pid, holes]) => {
          Object.entries(holes).forEach(([hole, score]) => setMatchScore(m.id, pid, Number(hole), score))
        })
        if (rc.format === 'points_round') {
          updateMatch(m.id, { magicBall1: Math.random() < 0.5, magicBall2: Math.random() < 0.5 })
        }
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
          if (player) hdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers)
        })
        return { match: m, result: computeScramble(m, crs.holes, hdcps) }
      })
      if (results.every(r => r.result.isDone)) {
        const ranked = [...results].sort((a, b) => a.result.total - b.result.total)
        teams.forEach(t => setTeamScore({ teamId: t.id, round, points: 0 }))
        ranked.forEach(({ match: m }, i) => setTeamScore({ teamId: m.twosome1.teamId, round, points: [4, 2, 1][i] ?? 1 }))
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
        teams.forEach(t => setTeamScore({ teamId: t.id, round, points: 0 }))
        ranked.forEach(({ match: m }, i) => setTeamScore({ teamId: m.twosome1.teamId, round, points: [4, 2, 1][i] ?? 1 }))
      }
    } else if (rc.format === 'individual_match') {
      const teamPts: Record<string, number> = {}
      teams.forEach(t => { teamPts[t.id] = 0 })
      for (const m of roundMatchesAll) {
        const allPids = [...m.twosome1.playerIds, ...m.twosome2.playerIds]
        const localHdcps: Record<string, number> = {}
        allPids.forEach(pid => {
          const player = allPlayers.find(p => p.id === pid)
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers)
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
      teams.forEach(t => setTeamScore({ teamId: t.id, round, points: teamPts[t.id] ?? 0 }))
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
          if (player) localHdcps[pid] = getPlayerCourseHdcp(player, crs, rc.tee, rc.round, allPlayers)
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
      teams.forEach(t => setTeamScore({ teamId: t.id, round, points: teamPts[t.id] ?? 0 }))
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
                onClick={() => { if (confirm('Clear team points for this round? Match scores are kept.')) clearAllTeamScores() }}
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
              onClick={() => { if (confirm('Clear ALL scores and results from every match?')) { clearAllMatchScores(); clearAllTeamScores() } }}
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
          return (
            <div key={r} className="flex items-center gap-0.5">
              <button
                onClick={() => { setActiveRound(r); setActiveMatch(null) }}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  activeRound === r ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green'
                }`}
              >
                Round {r}
              </button>
              {isAdmin && hasRoundMatches && (
                <button
                  onClick={() => handleSimulateRound(r)}
                  title={`Simulate all Round ${r} matches`}
                  className="p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  <Dices size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <RoundInfoBanner round={activeRound} />

      {matches.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          Generate pairings first to view scorecards.
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Match list — fixed narrow sidebar */}
          <div className="shrink-0 w-40 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{ROUND_NAMES[activeRound]}</p>
            {roundMatches.length === 0 && (
              <p className="text-sm text-gray-400">No matches for this round.</p>
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
                    className={`w-full text-left rounded border p-2 text-sm transition-colors ${
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
                    <div className="text-xs text-gray-500 mt-0.5">
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
                  <button
                    onClick={handlePrint}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Printer size={14} /> Print Scorecard
                  </button>
                </div>

                {/* Admin: assign which team's scorecard shows CTP entry (team formats) */}
                {isAdmin && isTeamFmt && (
                  <div className="flex items-center gap-2 text-xs bg-gray-50 border border-dashed border-gray-200 rounded p-2">
                    <Flag size={12} className="text-masters-green shrink-0" />
                    <span className="text-gray-500">CTP entry shown on team playing last:</span>
                    <select
                      className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white"
                      value={ctpTeamIds[activeRound] ?? ''}
                      onChange={e => setCtpTeamIds(prev => ({ ...prev, [activeRound]: e.target.value }))}
                    >
                      {roundMatches.map(m => {
                        const teamId = m.id.replace(`${activeRound}-`, '')
                        const team = teams.find(t => t.id === teamId)
                        return <option key={m.id} value={teamId}>{team?.name ?? teamId}</option>
                      })}
                    </select>
                  </div>
                )}
                <div ref={printRef}>
                  <ScorecardCard
                    match={match}
                    teams={teams}
                    course={course}
                    config={config}
                    interactive={canEnterScores && !match.isBlind}
                    onScoreChange={(pid, hole, val) => {
                      setMatchScore(match.id, pid, hole, val)
                      if (config.format === 'texas_scramble') {
                        recomputeScrambleTeamScores(useTournamentStore.getState().matches)
                      }
                      if (config.format === 'individual_match') {
                        recomputeIndividualMatchTeamScores(useTournamentStore.getState().matches)
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
                    canEdit={canEnterScores}
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
                            {canEnterScores ? (
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

                {canEnterScores ? (
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
    </>
  )
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
    if (player) playerHdcps[pid] = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
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

// Generates realistic random gross scores for all 4 players in a match.
// ─── Round info banner ────────────────────────────────────────────────────────

interface RoundInfo {
  format: string
  course: string
  description: string
  totalPoints: number
  scoring: { label: string; detail: string }[]
  points: { label: string; value: string }[]
}

const ROUND_INFO: Record<number, RoundInfo> = {
  1: {
    format: 'Team Match Play',
    course: 'Pine Needles · Thursday PM',
    totalPoints: 9,
    description: 'Two-vs-two twosome format. Each team puts up their best NET score per hole. The twosome with the lowest net wins the hole. Most holes won wins the match.',
    scoring: [
      { label: 'NET scoring', detail: 'Gross score minus per-hole handicap strokes' },
      { label: 'Best ball', detail: 'Each twosome counts only their better net score per hole' },
      { label: 'Hole win', detail: 'Low net wins the hole; tie = halved' },
    ],
    points: [
      { label: 'Regular match', value: '2 pts' },
      { label: 'Blind match', value: '1 pt' },
    ],
  },
  2: {
    format: 'Points Round (Stableford)',
    course: 'Pinewild Magnolia · Friday AM',
    totalPoints: 15,
    description: 'Gross Stableford points format. Each player earns points based on their gross score relative to par. The twosome with the higher combined points vs. their quota wins.',
    scoring: [
      { label: 'Albatross (−3)', detail: '10 pts' },
      { label: 'Eagle (−2)', detail: '6 pts' },
      { label: 'Birdie (−1)', detail: '4 pts' },
      { label: 'Par (E)', detail: '2 pts' },
      { label: 'Bogey (+1)', detail: '1 pt' },
      { label: 'Double bogey (+2)', detail: '½ pt' },
      { label: 'Worse', detail: '0 pts' },
    ],
    points: [
      { label: 'Regular match', value: '2 pts' },
      { label: 'Blind match', value: '1 pt' },
      { label: 'Magic Ball', value: '1 pt/ball' },
    ],
  },
  3: {
    format: 'Texas Scramble',
    course: 'Pinewild Holly · Friday PM',
    totalPoints: 7,
    description: 'All 4 players tee off, choose the best drive, then each plays from that spot. 60% of each player\'s course HDCP applied. Best-ball count increases as the round progresses.',
    scoring: [
      { label: 'Holes 1–6', detail: 'Best 1 ball' },
      { label: 'Holes 7–12', detail: 'Best 2 balls' },
      { label: 'Holes 13–15', detail: 'Best 3 balls' },
      { label: 'Holes 16–18', detail: 'Best 4 balls (all players)' },
    ],
    points: [
      { label: '1st place', value: '4 pts' },
      { label: '2nd place', value: '2 pts' },
      { label: '3rd place', value: '1 pt' },
    ],
  },
  4: {
    format: 'Individual Match Play',
    course: 'Mid South · Saturday AM',
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
      { label: 'Blind match', value: '½ pt' },
    ],
  },
  5: {
    format: "Captain's Choice",
    course: 'Mid South · Saturday PM',
    totalPoints: 7,
    description: 'The team captain selects which shot to play after all players tee off. HDCP is 15% of the combined team handicap. Minimum 3 tee shots per player must be used across the round.',
    scoring: [
      { label: 'Team HDCP', detail: 'floor(sum of all 4 player course HDCPs × 15%)' },
      { label: 'Min tee balls', detail: 'Each player\'s drive must be selected at least 3 times' },
      { label: 'Net score', detail: 'Team gross minus HDCP; lowest net wins' },
    ],
    points: [
      { label: '1st place', value: '4 pts' },
      { label: '2nd place', value: '2 pts' },
      { label: '3rd place', value: '1 pt' },
    ],
  },
}

function RoundInfoBanner({ round }: { round: number }) {
  const info = ROUND_INFO[round]
  if (!info) return null

  return (
    <div className="bg-masters-light border border-masters-green/20 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-serif font-bold text-masters-dark text-base">{info.format}</h2>
        <span className="text-xs text-gray-500">{info.course}</span>
      </div>
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
    const hdcp = getPlayerCourseHdcp(player, course, config.tee, config.round, allPlayers)
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
