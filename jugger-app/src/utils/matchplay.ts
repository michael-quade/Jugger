import type { Match, Course } from '../types'
import { getStrokeDots, stablefordPoints } from './handicap'

// Given an array of net totals (already sorted ascending = best first) and the
// configured finish points [1stPts, 2ndPts, 3rdPts], returns the points each
// position earns after splitting tied positions equally.
// e.g. totals=[68,68,71], pts=[4,2,1] → [3, 3, 1]  (positions 0+1 split 4+2)
export function splitFinishPoints(totals: number[], pts: number[]): number[] {
  const result = new Array(totals.length).fill(0)
  let i = 0
  while (i < totals.length) {
    let j = i
    while (j < totals.length && totals[j] === totals[i]) j++
    const avg = pts.slice(i, j).reduce((s, p) => s + p, 0) / (j - i)
    for (let k = i; k < j; k++) result[k] = avg
    i = j
  }
  return result
}

// ─── Texas Scramble ──────────────────────────────────────────────────────────

export function scrambleBallCount(holeNumber: number): number {
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
  winLabel: string         // e.g. "3&2", "1 UP", "All Square" — frozen at decision point
  decisionHoleIndex?: number  // 0-indexed hole where match was decided (may differ from last scored hole)
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

  // Track when the match is first clinched (margin exceeds remaining holes)
  let decidedIdx: number | null = null
  let decidedMargin = 0
  let decidedRemaining = 0

  for (let hi = 0; hi < holes.length; hi++) {
    const hole = holes[hi]
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

    if (t1best < t2best) { holeResults.push('w1'); running++ }
    else if (t2best < t1best) { holeResults.push('w2'); running-- }
    else holeResults.push('h')
    runningArr.push(running)

    // Detect the first hole where the match is clinched
    if (decidedIdx === null) {
      const rem = holes.length - hi - 1
      if (Math.abs(running) > rem) {
        decidedIdx = hi
        decidedMargin = Math.abs(running)
        decidedRemaining = rem
      }
    }
  }

  let winner: MatchPlayResult['winner'] = null
  let winLabel = ''

  if (decidedIdx !== null) {
    // Match was clinched before (or exactly at) the final hole — freeze at that result
    winner = running > 0 ? 'twosome1' : 'twosome2'
    winLabel = decidedRemaining === 0 ? `${decidedMargin} UP` : `${decidedMargin}&${decidedRemaining}`
  } else if (holesPlayed === 18) {
    // All 18 played, never clinched early — use final running
    const absRunning = Math.abs(running)
    if (running > 0) { winner = 'twosome1'; winLabel = `${running} UP` }
    else if (running < 0) { winner = 'twosome2'; winLabel = `${absRunning} UP` }
    else { winner = 'all_square'; winLabel = 'All Square' }
  }

  return { holeResults, running: runningArr, holesPlayed, winner, winLabel, decisionHoleIndex: decidedIdx ?? undefined }
}

// ─── Individual Match Play (Round 4) ─────────────────────────────────────────

export interface IndividualMatch1v1Result {
  holeResults: Array<'w1' | 'w2' | 'h' | null>  // w1 = p1 wins
  running: number[]                               // positive = p1 leading
  holesPlayed: number
  winner: 'p1' | 'p2' | 'all_square' | null
  winLabel: string
  decisionHoleIndex?: number  // 0-indexed hole where match was decided
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

  let decidedIdx: number | null = null
  let decidedMargin = 0
  let decidedRemaining = 0

  for (let hi = 0; hi < holes.length; hi++) {
    const hole = holes[hi]
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

    if (decidedIdx === null) {
      const rem = holes.length - hi - 1
      if (Math.abs(running) > rem) {
        decidedIdx = hi
        decidedMargin = Math.abs(running)
        decidedRemaining = rem
      }
    }
  }

  let winner: IndividualMatch1v1Result['winner'] = null
  let winLabel = ''

  if (decidedIdx !== null) {
    winner = running > 0 ? 'p1' : 'p2'
    winLabel = decidedRemaining === 0 ? `${decidedMargin} UP` : `${decidedMargin}&${decidedRemaining}`
  } else if (holesPlayed === 18) {
    const abs = Math.abs(running)
    if (running > 0) { winner = 'p1'; winLabel = `${running} UP` }
    else if (running < 0) { winner = 'p2'; winLabel = `${abs} UP` }
    else { winner = 'all_square'; winLabel = 'All Square' }
  }

  return { holeResults, running: runningArr, holesPlayed, winner, winLabel, decisionHoleIndex: decidedIdx ?? undefined }
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

// ─── Vegas (Two-Digit Number Points Format) ──────────────────────────────────

export interface VegasConfig {
  birdieMultiplier: number    // default 2
  eagleMultiplier: number     // default 3
  albatrossMultiplier: number // default 4
}

export interface VegasHoleResult {
  t1Net: [number | null, number | null]  // net scores for twosome1's two players
  t2Net: [number | null, number | null]  // net scores for twosome2's two players
  t1Vegas: number | null   // 2-digit Vegas number for twosome1
  t2Vegas: number | null   // 2-digit Vegas number for twosome2
  rawPts: number | null    // |t1Vegas − t2Vegas|
  multiplier: number       // 1, 2, 3, or 4 based on winning team's best gross
  finalPts: number | null  // rawPts × multiplier; positive = twosome1 wins hole
}

export interface VegasResult {
  holeResults: VegasHoleResult[]
  running: number[]   // cumulative pts after each hole; positive = twosome1 leads
  total1: number
  total2: number
  holesPlayed: number
  winner: 'twosome1' | 'twosome2' | 'all_square' | null
  winLabel: string
}

export function computeVegas(
  match: Pick<Match, 'twosome1' | 'twosome2' | 'scores'>,
  holes: Course['holes'],
  playerHdcps: Record<string, number>,
  config: VegasConfig,
): VegasResult {
  const t1 = match.twosome1
  const t2 = match.twosome2
  const holeResults: VegasHoleResult[] = []
  const running: number[] = []
  let cum = 0
  let holesPlayed = 0

  for (const hole of holes) {
    const g1a = match.scores[t1.playerIds[0]]?.[hole.number] ?? null
    const g1b = match.scores[t1.playerIds[1]]?.[hole.number] ?? null
    const g2a = match.scores[t2.playerIds[0]]?.[hole.number] ?? null
    const g2b = match.scores[t2.playerIds[1]]?.[hole.number] ?? null

    if (g1a == null || g1b == null || g2a == null || g2b == null) {
      holeResults.push({ t1Net: [null, null], t2Net: [null, null], t1Vegas: null, t2Vegas: null, rawPts: null, multiplier: 1, finalPts: null })
      running.push(cum)
      continue
    }

    holesPlayed++

    const s1a = holeStrokes(playerHdcps[t1.playerIds[0]] ?? 0, hole.hdcpOrder)
    const s1b = holeStrokes(playerHdcps[t1.playerIds[1]] ?? 0, hole.hdcpOrder)
    const s2a = holeStrokes(playerHdcps[t2.playerIds[0]] ?? 0, hole.hdcpOrder)
    const s2b = holeStrokes(playerHdcps[t2.playerIds[1]] ?? 0, hole.hdcpOrder)

    const n1a = g1a - s1a
    const n1b = g1b - s1b
    const n2a = g2a - s2a
    const n2b = g2b - s2b

    const t1Lo = Math.min(n1a, n1b)
    const t1Hi = Math.max(n1a, n1b)
    const t2Lo = Math.min(n2a, n2b)
    const t2Hi = Math.max(n2a, n2b)

    const t1Vegas = t1Lo * 10 + t1Hi
    const t2Vegas = t2Lo * 10 + t2Hi
    const rawPts = Math.abs(t1Vegas - t2Vegas)

    // Winner is the team with the lower Vegas number
    const winnerIsT1 = t1Vegas < t2Vegas
    const winnerIsT2 = t2Vegas < t1Vegas

    // Multiplier: based on winning team's best GROSS score vs par
    let multiplier = 1
    if (winnerIsT1 || winnerIsT2) {
      const wG1 = winnerIsT1 ? g1a : g2a
      const wG2 = winnerIsT1 ? g1b : g2b
      const bestGross = Math.min(wG1, wG2)
      const diff = hole.par - bestGross  // positive = under par
      if (diff >= 3) multiplier = config.albatrossMultiplier
      else if (diff === 2) multiplier = config.eagleMultiplier
      else if (diff === 1) multiplier = config.birdieMultiplier
    }

    const signedPts = winnerIsT1 ? rawPts * multiplier : winnerIsT2 ? -(rawPts * multiplier) : 0
    cum += signedPts

    holeResults.push({ t1Net: [n1a, n1b], t2Net: [n2a, n2b], t1Vegas, t2Vegas, rawPts, multiplier, finalPts: signedPts })
    running.push(cum)
  }

  const total1 = Math.max(0, cum)
  const total2 = Math.max(0, -cum)

  let winner: VegasResult['winner'] = null
  let winLabel = ''
  if (holesPlayed === 18) {
    if (cum > 0) { winner = 'twosome1'; winLabel = `${cum} pts` }
    else if (cum < 0) { winner = 'twosome2'; winLabel = `${Math.abs(cum)} pts` }
    else { winner = 'all_square'; winLabel = 'All Square' }
  }

  return { holeResults, running, total1, total2, holesPlayed, winner, winLabel }
}

// ─── Points Round (Gross Stableford with Quota) ───────────────────────────────

export interface PointsRoundResult {
  quota1: number                   // twosome1 target = coursePar − (hdcp1a + hdcp1b)
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

  // Twosome quota = course par − (hdcpA + hdcpB)
  const coursePar = holes.reduce((s, h) => s + h.par, 0)
  const quota1 = coursePar - (playerHdcps[t1.playerIds[0]] ?? 0) - (playerHdcps[t1.playerIds[1]] ?? 0)
  const quota2 = coursePar - (playerHdcps[t2.playerIds[0]] ?? 0) - (playerHdcps[t2.playerIds[1]] ?? 0)

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
