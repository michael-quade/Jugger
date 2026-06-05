import type { Match, Course } from '../types'
import { getStrokeDots, stablefordPoints } from './handicap'

// ─── Texas Scramble ──────────────────────────────────────────────────────────

function scrambleBallCount(holeNumber: number): number {
  if (holeNumber <= 6)  return 1
  if (holeNumber <= 12) return 2
  if (holeNumber <= 15) return 3
  return 4
}

export interface ScrambleResult {
  holeScores: (number | null)[]  // counted net score per hole; null = not all players scored
  running: number[]              // cumulative after each hole
  total: number
  holesPlayed: number
  isDone: boolean
}

export function computeScramble(
  match: Pick<Match, 'twosome1' | 'twosome2' | 'scores'>,
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
): ScrambleResult {
  const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
  const holeScores: (number | null)[] = []
  const running: number[] = []
  let cum = 0
  let holesPlayed = 0

  for (const hole of holes) {
    const netScores: number[] = []
    let allScored = true
    for (const pid of allPids) {
      const gross = match.scores[pid]?.[hole.number]
      if (gross == null) { allScored = false; break }
      const strokes = holeStrokes(playerHdcps[pid] ?? 0, hole.hdcpOrder)
      netScores.push(gross - strokes)
    }
    if (!allScored) {
      holeScores.push(null)
      running.push(cum)
      continue
    }
    holesPlayed++
    const count = scrambleBallCount(hole.number)
    const sorted = [...netScores].sort((a, b) => a - b)
    const holeScore = sorted.slice(0, count).reduce((s, v) => s + v, 0)
    cum += holeScore
    holeScores.push(holeScore)
    running.push(cum)
  }

  return { holeScores, running, total: cum, holesPlayed, isDone: holesPlayed === 18 }
}

function holeStrokes(hdcp: number, hdcpOrder: number): number {
  const d = getStrokeDots(hdcp, hdcpOrder)
  return d === '..' ? 2 : d === '.' ? 1 : 0
}

export interface MatchPlayResult {
  holeResults: Array<'w1' | 'w2' | 'h' | null> // w1=twosome1 wins, null=no scores
  running: number[]  // running status after each hole; positive = twosome1 leading
  holesPlayed: number
  winner: 'twosome1' | 'twosome2' | 'all_square' | null
  winLabel: string   // e.g. "3&2", "1 UP", "All Square"
}

export function computeMatchPlay(
  match: Pick<Match, 'twosome1' | 'twosome2' | 'scores'>,
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
): MatchPlayResult {
  const t1 = match.twosome1
  const t2 = match.twosome2

  const holeResults: Array<'w1' | 'w2' | 'h' | null> = []
  let running = 0
  const runningArr: number[] = []
  let holesPlayed = 0

  for (const hole of holes) {
    const t1p1 = match.scores[t1.playerIds[0]]?.[hole.number]
    const t1p2 = match.scores[t1.playerIds[1]]?.[hole.number]
    const t2p1 = match.scores[t2.playerIds[0]]?.[hole.number]
    const t2p2 = match.scores[t2.playerIds[1]]?.[hole.number]

    if (t1p1 == null || t1p2 == null || t2p1 == null || t2p2 == null) {
      holeResults.push(null)
      runningArr.push(running)
      continue
    }

    holesPlayed++

    const t1p1Net = t1p1 - holeStrokes(playerHdcps[t1.playerIds[0]] ?? 0, hole.hdcpOrder)
    const t1p2Net = t1p2 - holeStrokes(playerHdcps[t1.playerIds[1]] ?? 0, hole.hdcpOrder)
    const t2p1Net = t2p1 - holeStrokes(playerHdcps[t2.playerIds[0]] ?? 0, hole.hdcpOrder)
    const t2p2Net = t2p2 - holeStrokes(playerHdcps[t2.playerIds[1]] ?? 0, hole.hdcpOrder)

    const t1best = Math.min(t1p1Net, t1p2Net)
    const t2best = Math.min(t2p1Net, t2p2Net)

    if (t1best < t2best) {
      holeResults.push('w1')
      running++
    } else if (t2best < t1best) {
      holeResults.push('w2')
      running--
    } else {
      holeResults.push('h')
    }
    runningArr.push(running)
  }

  let winner: MatchPlayResult['winner'] = null
  let winLabel = ''

  if (holesPlayed > 0) {
    const remaining = 18 - holesPlayed
    const absRunning = Math.abs(running)

    if (holesPlayed === 18) {
      if (running > 0) { winner = 'twosome1'; winLabel = `${running} UP` }
      else if (running < 0) { winner = 'twosome2'; winLabel = `${absRunning} UP` }
      else { winner = 'all_square'; winLabel = 'All Square' }
    } else if (absRunning > remaining) {
      winLabel = `${absRunning}&${remaining}`
      winner = running > 0 ? 'twosome1' : 'twosome2'
    }
  }

  return { holeResults, running: runningArr, holesPlayed, winner, winLabel }
}

// ─── Individual Match Play (Round 4) ─────────────────────────────────────────

export interface IndividualMatch1v1Result {
  holeResults: Array<'w1' | 'w2' | 'h' | null>  // w1 = p1 wins
  running: number[]                               // positive = p1 leading
  holesPlayed: number
  winner: 'p1' | 'p2' | 'all_square' | null
  winLabel: string
}

export interface IndividualMatchResult {
  matchA: IndividualMatch1v1Result  // twosome1.playerIds[0] vs twosome2.playerIds[0]
  matchB: IndividualMatch1v1Result  // twosome1.playerIds[1] vs twosome2.playerIds[1]
  match2v2: MatchPlayResult | null  // null for blind matches
}

function compute1v1(
  p1Id: string,
  p2Id: string,
  scores: Match['scores'],
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
): IndividualMatch1v1Result {
  const holeResults: Array<'w1' | 'w2' | 'h' | null> = []
  let running = 0
  const runningArr: number[] = []
  let holesPlayed = 0

  for (const hole of holes) {
    const s1 = scores[p1Id]?.[hole.number]
    const s2 = scores[p2Id]?.[hole.number]

    if (s1 == null || s2 == null) {
      holeResults.push(null)
      runningArr.push(running)
      continue
    }

    holesPlayed++
    const net1 = s1 - holeStrokes(playerHdcps[p1Id] ?? 0, hole.hdcpOrder)
    const net2 = s2 - holeStrokes(playerHdcps[p2Id] ?? 0, hole.hdcpOrder)

    if (net1 < net2) { holeResults.push('w1'); running++ }
    else if (net2 < net1) { holeResults.push('w2'); running-- }
    else holeResults.push('h')
    runningArr.push(running)
  }

  let winner: IndividualMatch1v1Result['winner'] = null
  let winLabel = ''

  if (holesPlayed > 0) {
    const remaining = 18 - holesPlayed
    const abs = Math.abs(running)
    if (holesPlayed === 18) {
      if (running > 0) { winner = 'p1'; winLabel = `${running} UP` }
      else if (running < 0) { winner = 'p2'; winLabel = `${abs} UP` }
      else { winner = 'all_square'; winLabel = 'All Square' }
    } else if (abs > remaining) {
      winLabel = `${abs}&${remaining}`
      winner = running > 0 ? 'p1' : 'p2'
    }
  }

  return { holeResults, running: runningArr, holesPlayed, winner, winLabel }
}

export function computeIndividualMatch(
  match: Pick<Match, 'twosome1' | 'twosome2' | 'scores' | 'isBlind'>,
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
): IndividualMatchResult {
  const matchA = compute1v1(match.twosome1.playerIds[0], match.twosome2.playerIds[0], match.scores, holes, playerHdcps)
  const matchB = compute1v1(match.twosome1.playerIds[1], match.twosome2.playerIds[1], match.scores, holes, playerHdcps)
  const match2v2 = match.isBlind ? null : computeMatchPlay(match, holes, playerHdcps)
  return { matchA, matchB, match2v2 }
}

// ─── Captain's Choice ────────────────────────────────────────────────────────

export interface CaptainsChoiceResult {
  holeNetScores: (number | null)[]  // gross - strokes per hole; null = not scored
  running: number[]                 // cumulative net after each hole
  total: number
  holesPlayed: number
  isDone: boolean
}

export function computeCaptainsChoice(
  teamHoleScores: Record<number, number | null> | undefined,
  holes: Course['holes'],
  teamHdcp: number,
): CaptainsChoiceResult {
  const holeNetScores: (number | null)[] = []
  const running: number[] = []
  let cum = 0
  let holesPlayed = 0

  for (const hole of holes) {
    const gross = teamHoleScores?.[hole.number] ?? null
    if (gross == null) {
      holeNetScores.push(null)
      running.push(cum)
      continue
    }
    holesPlayed++
    const strokes = holeStrokes(teamHdcp, hole.hdcpOrder)
    const net = gross - strokes
    cum += net
    holeNetScores.push(net)
    running.push(cum)
  }

  return { holeNetScores, running, total: cum, holesPlayed, isDone: holesPlayed === 18 }
}

// ─── Points Round (Gross Stableford with Quota) ───────────────────────────────

export interface PointsRoundResult {
  quota1: number                   // twosome1 target = (36−hdcp1a) + (36−hdcp1b)
  quota2: number
  holePoints1: (number | null)[]   // per-hole team points; null = not yet scored
  holePoints2: (number | null)[]
  running1: number[]               // cumulative after each hole
  running2: number[]
  total1: number
  total2: number
  winner: 'twosome1' | 'twosome2' | 'all_square' | null
  winLabel: string
}

export function computePointsRound(
  match: Pick<Match, 'twosome1' | 'twosome2' | 'scores'>,
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
): PointsRoundResult {
  const t1 = match.twosome1
  const t2 = match.twosome2

  // Quota = sum of individual Stableford quotas (36 − course HDCP each)
  const quota1 = (36 - (playerHdcps[t1.playerIds[0]] ?? 0)) + (36 - (playerHdcps[t1.playerIds[1]] ?? 0))
  const quota2 = (36 - (playerHdcps[t2.playerIds[0]] ?? 0)) + (36 - (playerHdcps[t2.playerIds[1]] ?? 0))

  const holePoints1: (number | null)[] = []
  const holePoints2: (number | null)[] = []
  const running1: number[] = []
  const running2: number[] = []
  let cum1 = 0
  let cum2 = 0

  for (const hole of holes) {
    // Twosome 1 — gross Stableford (strokes = 0), both players must be scored
    const s1a = match.scores[t1.playerIds[0]]?.[hole.number]
    const s1b = match.scores[t1.playerIds[1]]?.[hole.number]
    if (s1a != null && s1b != null) {
      const pts = stablefordPoints(s1a, hole.par, 0) + stablefordPoints(s1b, hole.par, 0)
      holePoints1.push(pts)
      cum1 += pts
    } else {
      holePoints1.push(null)
    }
    running1.push(cum1)

    // Twosome 2
    const s2a = match.scores[t2.playerIds[0]]?.[hole.number]
    const s2b = match.scores[t2.playerIds[1]]?.[hole.number]
    if (s2a != null && s2b != null) {
      const pts = stablefordPoints(s2a, hole.par, 0) + stablefordPoints(s2b, hole.par, 0)
      holePoints2.push(pts)
      cum2 += pts
    } else {
      holePoints2.push(null)
    }
    running2.push(cum2)
  }

  // Winner = team with higher (points − quota); both must complete all 18 holes
  const done1 = holePoints1.every(p => p !== null)
  const done2 = holePoints2.every(p => p !== null)

  let winner: PointsRoundResult['winner'] = null
  let winLabel = ''

  if (done1 && done2) {
    const diff1 = cum1 - quota1
    const diff2 = cum2 - quota2
    if (diff1 > diff2) {
      winner = 'twosome1'
      winLabel = `${cum1} pts (${diff1 >= 0 ? '+' : ''}${diff1} vs Q:${quota1})`
    } else if (diff2 > diff1) {
      winner = 'twosome2'
      winLabel = `${cum2} pts (${diff2 >= 0 ? '+' : ''}${diff2} vs Q:${quota2})`
    } else {
      winner = 'all_square'
      winLabel = `Tied — ${cum1} pts vs Q:${quota1}`
    }
  }

  return { quota1, quota2, holePoints1, holePoints2, running1, running2, total1: cum1, total2: cum2, winner, winLabel }
}
