import { getStrokeDots } from './handicap'
import type {
  Match, HoleData, SideBet, SideBetParticipant,
  NassauConfig, SkinsConfig, MatchMoneyConfig, StrokePlayConfig,
  DotsConfig, BingoBangoBongoConfig, WolfConfig, GroesomesConfig, VegasSideConfig,
} from '../types'

export interface SettlementLineItem {
  label: string
  status: 'A' | 'B' | 'tied' | 'pending'
  amount: number
  detail?: string
}

export interface PlayerTotal {
  playerId: string
  playerName: string
  skinsWon: number
  net: number               // positive = earned, negative = owed
}

export interface SettlementResult {
  lineItems: SettlementLineItem[]
  sideANet: number          // positive = side B owes A; negative = side A owes B
  summary: string           // e.g. "Side A leads $14"
  complete: boolean
  playerTotals?: PlayerTotal[]  // individual-mode skins: per-player breakdown
}

// ── Net score helpers ──────────────────────────────────────────────

function strokesOnHole(courseHdcp: number, hdcpOrder: number): number {
  const dots = getStrokeDots(courseHdcp, hdcpOrder)
  return dots === '..' ? 2 : dots === '.' ? 1 : 0
}

function playerNetOnHole(
  playerId: string,
  holeNum: number,
  match: Match,
  courseHdcp: number,
  holes: HoleData[]
): number | null {
  const gross = match.scores[playerId]?.[holeNum]
  if (gross == null) return null
  const hole = holes.find(h => h.number === holeNum)
  if (!hole) return null
  return gross - strokesOnHole(courseHdcp, hole.hdcpOrder)
}

export function sideNetOnHole(
  side: 'A' | 'B',
  participants: SideBetParticipant[],
  holeNum: number,
  match: Match,
  hdcps: Record<string, number>,
  holes: HoleData[]
): number | null {
  let best: number | null = null
  for (const p of participants.filter(p => p.side === side)) {
    const net = playerNetOnHole(p.playerId, holeNum, match, hdcps[p.playerId] ?? 0, holes)
    if (net !== null && (best === null || net < best)) best = net
  }
  return best
}

export function holeWinner(
  holeNum: number,
  participants: SideBetParticipant[],
  match: Match,
  hdcps: Record<string, number>,
  holes: HoleData[]
): 'A' | 'B' | 'tied' | null {
  const a = sideNetOnHole('A', participants, holeNum, match, hdcps, holes)
  const b = sideNetOnHole('B', participants, holeNum, match, hdcps, holes)
  if (a === null || b === null) return null
  return a < b ? 'A' : b < a ? 'B' : 'tied'
}

// ── Segment scoring (used by Nassau and overall) ───────────────────

interface SegmentResult {
  aWon: number
  bWon: number
  tied: number
  pending: boolean
  winner: 'A' | 'B' | 'tied' | 'pending'
}

function scoreSegment(
  holeNums: number[],
  participants: SideBetParticipant[],
  match: Match,
  hdcps: Record<string, number>,
  holes: HoleData[]
): SegmentResult {
  let aWon = 0, bWon = 0, tied = 0, pending = false
  for (const n of holeNums) {
    const w = holeWinner(n, participants, match, hdcps, holes)
    if (w === null) { pending = true }
    else if (w === 'A') aWon++
    else if (w === 'B') bWon++
    else tied++
  }
  const winner = pending && (holeNums.length - aWon - bWon - tied) > Math.abs(aWon - bWon)
    ? 'pending'
    : aWon > bWon ? 'A' : bWon > aWon ? 'B' : 'tied'
  return { aWon, bWon, tied, pending, winner }
}

export function fmt(amount: number): string {
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

function playerName(participants: SideBetParticipant[], side: 'A' | 'B'): string {
  return participants.find(p => p.side === side)?.playerName ?? `Side ${side}`
}

// ── Nassau ────────────────────────────────────────────────────────

export function computeNassau(
  config: NassauConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  const front9Nums = holes.filter(h => h.number <= 9).map(h => h.number)
  const back9Nums  = holes.filter(h => h.number > 9).map(h => h.number)
  const allNums    = holes.map(h => h.number)

  const front = scoreSegment(front9Nums, bet.participants, match, hdcps, holes)
  const back  = scoreSegment(back9Nums,  bet.participants, match, hdcps, holes)
  const all   = scoreSegment(allNums,    bet.participants, match, hdcps, holes)

  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  function addSegment(label: string, seg: SegmentResult, amount: number) {
    const detail = `${seg.aWon}–${seg.bWon}`
    lineItems.push({ label, status: seg.winner, amount, detail })
    if (seg.winner === 'A') sideANet += amount
    else if (seg.winner === 'B') sideANet -= amount
  }

  addSegment(`Front 9 (${fmt(config.front9)})`, front, config.front9)
  addSegment(`Back 9 (${fmt(config.back9)})`,   back,  config.back9)
  addSegment(`Overall (${fmt(config.overall)})`, all,   config.overall)

  const pressAmt = config.pressAmount ?? config.front9

  // Auto-press: triggers when a side goes exactly 2 down within a 9
  if (config.autoPress) {
    function detectAndAddPresses(holeNums: number[], label: string) {
      let margin = 0 // positive = A leads
      for (let i = 0; i < holeNums.length - 1; i++) {
        const w = holeWinner(holeNums[i], bet.participants, match, hdcps, holes)
        if (w === null) break
        if (w === 'A') margin++
        else if (w === 'B') margin--
        if (margin === -2 || margin === 2) {
          const pressHoles = holeNums.slice(i + 1)
          const pressSeg = scoreSegment(pressHoles, bet.participants, match, hdcps, holes)
          const pressLabel = `Auto-Press H${holeNums[i + 1]}–${holeNums[holeNums.length - 1]} (${fmt(pressAmt)})`
          addSegment(pressLabel, pressSeg, pressAmt)
          margin = 0
        }
      }
    }
    detectAndAddPresses(front9Nums, 'Front')
    detectAndAddPresses(back9Nums,  'Back')
  }

  // Manual presses: each declared press runs from its start hole to end of that 9
  if (config.allowManualPress && bet.manualPresses?.length) {
    for (const press of bet.manualPresses) {
      const endHole = press.startHole <= 9 ? 9 : 18
      const pressHoleNums = holes
        .map(h => h.number)
        .filter(n => n >= press.startHole && n <= endHole)
      if (pressHoleNums.length === 0) continue
      const pressSeg = scoreSegment(pressHoleNums, bet.participants, match, hdcps, holes)
      const pressLabel = `Press H${pressHoleNums[0]}–${endHole} (${fmt(pressAmt)})`
      addSegment(pressLabel, pressSeg, pressAmt)
    }
  }

  const complete = !front.pending && !back.pending && !all.pending
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0
    ? 'All Square'
    : sideANet > 0
      ? `${sideA} up ${fmt(absSideANet)}`
      : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Skins ─────────────────────────────────────────────────────────

export function computeSkins(
  config: SkinsConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  const lineItems: SettlementLineItem[] = []

  // ── Individual mode: all participants compete, winner = unique lowest net ──
  if (config.individualMode) {
    const n = bet.participants.length
    const skinsByPlayer: Record<string, number> = {}
    for (const p of bet.participants) skinsByPlayer[p.playerId] = 0
    let carry = 0
    let totalSkinsAwarded = 0

    for (const hole of holes) {
      const nets: { pid: string; name: string; net: number }[] = []
      let pending = false
      for (const p of bet.participants) {
        const net = playerNetOnHole(p.playerId, hole.number, match, hdcps[p.playerId] ?? 0, holes)
        if (net === null) { pending = true; break }
        nets.push({ pid: p.playerId, name: p.playerName, net })
      }

      if (pending) {
        lineItems.push({ label: `Hole ${hole.number}`, status: 'pending', amount: (carry + 1) * config.amountPerSkin, detail: carry > 0 ? `${carry + 1} skins at stake` : undefined })
        continue
      }

      const minNet = Math.min(...nets.map(n => n.net))
      const winners = nets.filter(n => n.net === minNet)

      if (winners.length === 1) {
        const { pid, name } = winners[0]
        const skinCount = carry + 1
        const amount = skinCount * (n - 1) * config.amountPerSkin
        skinsByPlayer[pid] += skinCount
        totalSkinsAwarded += skinCount
        const detail = carry > 0 ? `${name} (${skinCount} skins, ${carry} carried)` : name
        lineItems.push({ label: `Hole ${hole.number}`, status: 'A', amount, detail })
        carry = 0
      } else if (config.carryover) {
        carry++
        lineItems.push({ label: `Hole ${hole.number}`, status: 'tied', amount: config.amountPerSkin * (n - 1), detail: `Tie — carries over` })
      } else {
        lineItems.push({ label: `Hole ${hole.number}`, status: 'tied', amount: config.amountPerSkin * (n - 1), detail: 'Halved' })
      }
    }

    const playerTotals: PlayerTotal[] = bet.participants.map(p => {
      const won = skinsByPlayer[p.playerId] ?? 0
      // net = won × (n−1) × X  −  (totalSkinsAwarded − won) × X
      //     = (won × n − totalSkinsAwarded) × X
      const net = (won * n - totalSkinsAwarded) * config.amountPerSkin
      return { playerId: p.playerId, playerName: p.playerName, skinsWon: won, net }
    })

    const complete = holes.every(h =>
      bet.participants.every(p => playerNetOnHole(p.playerId, h.number, match, hdcps[p.playerId] ?? 0, holes) !== null)
    )
    const sorted = [...playerTotals].sort((a, b) => b.net - a.net)
    const leader = sorted[0]
    const summary = leader.net === 0
      ? 'All even'
      : `${leader.playerName} leads: ${leader.skinsWon} skin${leader.skinsWon !== 1 ? 's' : ''} (${leader.net > 0 ? '+' : ''}${fmt(leader.net)})`

    return { lineItems, sideANet: 0, summary, complete, playerTotals }
  }

  // ── Team mode: best-ball per side ─────────────────────────────────
  let sideANet = 0
  let carry = 0

  for (const hole of holes) {
    const w = holeWinner(hole.number, bet.participants, match, hdcps, holes)
    if (w === null) {
      lineItems.push({ label: `Hole ${hole.number}`, status: 'pending', amount: (carry + 1) * config.amountPerSkin, detail: carry > 0 ? `${carry + 1} skins at stake` : undefined })
      continue
    }
    if (w === 'tied') {
      if (config.carryover) {
        carry++
        lineItems.push({ label: `Hole ${hole.number}`, status: 'tied', amount: config.amountPerSkin, detail: 'Carries over' })
      } else {
        lineItems.push({ label: `Hole ${hole.number}`, status: 'tied', amount: config.amountPerSkin, detail: 'Halved' })
      }
    } else {
      const skinValue = (carry + 1) * config.amountPerSkin
      const detail = carry > 0 ? `${carry + 1} skins (${carry} carried)` : '1 skin'
      lineItems.push({ label: `Hole ${hole.number}`, status: w, amount: skinValue, detail })
      if (w === 'A') sideANet += skinValue
      else sideANet -= skinValue
      carry = 0
    }
  }

  const complete = holes.every(h => holeWinner(h.number, bet.participants, match, hdcps, holes) !== null)
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0 ? 'Even' : sideANet > 0 ? `${sideA} up ${fmt(absSideANet)}` : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Match Money (per hole) ─────────────────────────────────────────

export function computeMatchMoney(
  config: MatchMoneyConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  for (const hole of holes) {
    const w = holeWinner(hole.number, bet.participants, match, hdcps, holes)
    if (w === null) {
      lineItems.push({ label: `Hole ${hole.number}`, status: 'pending', amount: config.amountPerHole })
      continue
    }
    lineItems.push({ label: `Hole ${hole.number}`, status: w, amount: config.amountPerHole })
    if (w === 'A') sideANet += config.amountPerHole
    else if (w === 'B') sideANet -= config.amountPerHole
  }

  const complete = holes.every(h => holeWinner(h.number, bet.participants, match, hdcps, holes) !== null)
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0 ? 'Even' : sideANet > 0 ? `${sideA} up ${fmt(absSideANet)}` : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Stroke Play ───────────────────────────────────────────────────

export function computeStrokePlay(
  config: StrokePlayConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  function segTotal(side: 'A' | 'B', holeNums: number[]): number | null {
    let total = 0
    for (const n of holeNums) {
      const net = sideNetOnHole(side, bet.participants, n, match, hdcps, holes)
      if (net === null) return null
      total += net
    }
    return total
  }

  const front9Nums = holes.filter(h => h.number <= 9).map(h => h.number)
  const back9Nums  = holes.filter(h => h.number > 9).map(h => h.number)
  const allNums    = holes.map(h => h.number)

  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  function addSegment(label: string, holeNums: number[], amount: number) {
    const aTotal = segTotal('A', holeNums)
    const bTotal = segTotal('B', holeNums)
    if (aTotal === null || bTotal === null) {
      lineItems.push({ label, status: 'pending', amount })
      return
    }
    const status: 'A' | 'B' | 'tied' = aTotal < bTotal ? 'A' : bTotal < aTotal ? 'B' : 'tied'
    const detail = `${aTotal} vs ${bTotal}`
    lineItems.push({ label, status, amount, detail })
    if (status === 'A') sideANet += amount
    else if (status === 'B') sideANet -= amount
  }

  if (config.front9 > 0) addSegment(`Front 9 (${fmt(config.front9)})`, front9Nums, config.front9)
  if (config.back9 > 0)  addSegment(`Back 9 (${fmt(config.back9)})`,   back9Nums,  config.back9)
  if (config.overall > 0) addSegment(`Overall (${fmt(config.overall)})`, allNums,   config.overall)

  const complete = allNums.every(n => sideNetOnHole('A', bet.participants, n, match, hdcps, holes) !== null)
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0 ? 'Even' : sideANet > 0 ? `${sideA} up ${fmt(absSideANet)}` : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Dots ──────────────────────────────────────────────────────────

export function computeDots(
  config: DotsConfig,
  bet: SideBet
): SettlementResult {
  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  const dotsByPlayer: Record<string, number> = {}
  for (const p of bet.participants) dotsByPlayer[p.playerId] = 0

  for (const holeEntry of bet.holes) {
    if (!holeEntry.dots) continue
    for (const [pid, dotTypes] of Object.entries(holeEntry.dots)) {
      dotsByPlayer[pid] = (dotsByPlayer[pid] ?? 0) + dotTypes.length
    }
  }

  let aDots = 0, bDots = 0
  for (const p of bet.participants) {
    if (p.side === 'A') aDots += dotsByPlayer[p.playerId] ?? 0
    else bDots += dotsByPlayer[p.playerId] ?? 0
  }

  const netDots = aDots - bDots
  const netAmount = Math.abs(netDots) * config.amountPerDot

  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  if (aDots > 0 || bDots > 0) {
    lineItems.push({
      label: `${sideA}: ${aDots} dots`,
      status: aDots > bDots ? 'A' : aDots < bDots ? 'B' : 'tied',
      amount: aDots * config.amountPerDot,
      detail: `${fmt(config.amountPerDot)}/dot`,
    })
    lineItems.push({
      label: `${sideB}: ${bDots} dots`,
      status: bDots > aDots ? 'B' : bDots < aDots ? 'A' : 'tied',
      amount: bDots * config.amountPerDot,
      detail: `${fmt(config.amountPerDot)}/dot`,
    })
  }

  if (netDots > 0) sideANet = netAmount
  else if (netDots < 0) sideANet = -netAmount

  const complete = bet.holes.length === 18
  const absSideANet = Math.abs(sideANet)
  const summary = sideANet === 0
    ? `${aDots + bDots} dots · Even`
    : sideANet > 0
      ? `${sideA} up ${fmt(absSideANet)} (${aDots} vs ${bDots} dots)`
      : `${sideB} up ${fmt(absSideANet)} (${bDots} vs ${aDots} dots)`

  return { lineItems, sideANet, summary, complete }
}

// ── Bingo Bango Bongo ─────────────────────────────────────────────

export function computeBBB(
  config: BingoBangoBongoConfig,
  bet: SideBet
): SettlementResult {
  const lineItems: SettlementLineItem[] = []
  let sideANet = 0
  let aPoints = 0, bPoints = 0

  for (const holeEntry of bet.holes) {
    if (!holeEntry.bbb) continue
    const { bingo, bango, bongo } = holeEntry.bbb
    for (const [label, pid] of [['Bingo', bingo], ['Bango', bango], ['Bongo', bongo]] as [string, string][]) {
      if (!pid) continue
      const p = bet.participants.find(p => p.playerId === pid)
      if (!p) continue
      if (p.side === 'A') { aPoints++; sideANet += config.amountPerPoint }
      else { bPoints++; sideANet -= config.amountPerPoint }
      lineItems.push({ label: `H${holeEntry.hole} ${label}`, status: p.side, amount: config.amountPerPoint, detail: p.playerName })
    }
  }

  const complete = bet.holes.length === 18
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0
    ? `Even (${aPoints} vs ${bPoints} pts)`
    : sideANet > 0
      ? `${sideA} up ${fmt(absSideANet)}`
      : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Wolf ──────────────────────────────────────────────────────────

export function computeWolf(
  config: WolfConfig,
  bet: SideBet
): SettlementResult {
  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  for (const holeEntry of bet.holes) {
    if (!holeEntry.wolfChoice) continue
    const { wolfId, alone } = holeEntry.wolfChoice
    const winnerSide = holeEntry.wolfWinnerSide
    const wolfParticipant = bet.participants.find(p => p.playerId === wolfId)
    if (!wolfParticipant || winnerSide === undefined || winnerSide === null) continue

    const amount = alone ? config.baseAmountPerHole * config.wolfAloneMultiplier : config.baseAmountPerHole
    const wolfSide = wolfParticipant.side
    const label = alone
      ? `H${holeEntry.hole} Wolf alone (${wolfParticipant.playerName})`
      : `H${holeEntry.hole} Wolf (${wolfParticipant.playerName}${holeEntry.wolfChoice.partnerId ? '+partner' : ''})`

    lineItems.push({ label, status: winnerSide, amount, detail: `${fmt(amount)}${alone ? ' (2×)' : ''}` })
    if (winnerSide === wolfSide) {
      sideANet += wolfSide === 'A' ? amount : -amount
    } else {
      sideANet += wolfSide === 'B' ? amount : -amount
    }
  }

  const complete = bet.holes.length === 18
  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0 ? 'Even' : sideANet > 0 ? `${sideA} up ${fmt(absSideANet)}` : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Gruesomes ─────────────────────────────────────────────────────

export function computeGroesomes(
  config: GroesomesConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  return computeMatchMoney({ amountPerHole: config.amountPerHole }, bet, match, holes, hdcps)
}

// ── Vegas Side ────────────────────────────────────────────────────

export function computeVegasSide(
  config: VegasSideConfig,
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  const lineItems: SettlementLineItem[] = []
  let sideANet = 0

  for (const hole of holes) {
    const sideAPlayers = bet.participants.filter(p => p.side === 'A')
    const sideBPlayers = bet.participants.filter(p => p.side === 'B')

    function vegasScore(players: SideBetParticipant[]): number | null {
      const nets = players
        .map(p => playerNetOnHole(p.playerId, hole.number, match, hdcps[p.playerId] ?? 0, holes))
        .filter((n): n is number => n !== null)
      if (nets.length < 2) return null
      nets.sort((a, b) => a - b)
      return nets[0] * 10 + nets[1]
    }

    const aScore = vegasScore(sideAPlayers)
    const bScore = vegasScore(sideBPlayers)

    if (aScore === null || bScore === null) {
      lineItems.push({ label: `Hole ${hole.number}`, status: 'pending', amount: config.amountPerHole })
      continue
    }

    let amount = config.amountPerHole
    const holePar = holes.find(h => h.number === hole.number)?.par ?? 4
    const allNets = [...sideAPlayers, ...sideBPlayers]
      .map(p => playerNetOnHole(p.playerId, hole.number, match, hdcps[p.playerId] ?? 0, holes))
      .filter((n): n is number => n !== null)
    if (allNets.length > 0) {
      const bestNet = Math.min(...allNets)
      if (bestNet <= holePar - 3) amount *= config.eagleMultiplier * 2
      else if (bestNet <= holePar - 2) amount *= config.eagleMultiplier
      else if (bestNet <= holePar - 1) amount *= config.birdieMultiplier
    }

    const status: 'A' | 'B' | 'tied' = aScore < bScore ? 'A' : bScore < aScore ? 'B' : 'tied'
    lineItems.push({ label: `Hole ${hole.number}`, status, amount, detail: `${aScore} vs ${bScore}` })
    if (status === 'A') sideANet += amount
    else if (status === 'B') sideANet -= amount
  }

  const complete = holes.every(h => {
    const nets = bet.participants.map(p => playerNetOnHole(p.playerId, h.number, match, hdcps[p.playerId] ?? 0, holes))
    return nets.every(n => n !== null)
  })

  const absSideANet = Math.abs(sideANet)
  const sideA = playerName(bet.participants, 'A')
  const sideB = playerName(bet.participants, 'B')
  const summary = sideANet === 0 ? 'Even' : sideANet > 0 ? `${sideA} up ${fmt(absSideANet)}` : `${sideB} up ${fmt(absSideANet)}`

  return { lineItems, sideANet, summary, complete }
}

// ── Dispatcher ────────────────────────────────────────────────────

export function computeSideBet(
  bet: SideBet,
  match: Match,
  holes: HoleData[],
  hdcps: Record<string, number>
): SettlementResult {
  const cfg = bet.config as any
  switch (bet.format) {
    case 'nassau':       return computeNassau(cfg, bet, match, holes, hdcps)
    case 'skins':        return computeSkins(cfg, bet, match, holes, hdcps)
    case 'match_money':  return computeMatchMoney(cfg, bet, match, holes, hdcps)
    case 'stroke_play':  return computeStrokePlay(cfg, bet, match, holes, hdcps)
    case 'dots':         return computeDots(cfg, bet)
    case 'bingo_bango_bongo': return computeBBB(cfg, bet)
    case 'wolf':         return computeWolf(cfg, bet)
    case 'gruesomes':    return computeGroesomes(cfg, bet, match, holes, hdcps)
    case 'vegas_side':   return computeVegasSide(cfg, bet, match, holes, hdcps)
  }
}

export const FORMAT_DISPLAY_NAMES: Record<string, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  match_money: 'Match Money',
  stroke_play: 'Stroke Play',
  wolf: 'Wolf',
  gruesomes: 'Gruesomes',
  vegas_side: 'Vegas',
  dots: 'Dots',
  bingo_bango_bongo: 'Bingo Bango Bongo',
}

export const FORMAT_DESCRIPTIONS: Record<string, string> = {
  nassau: 'Three separate bets: front 9, back 9, and overall match.',
  skins: 'Win a hole outright to win a skin. Ties carry over.',
  match_money: 'Win money for each hole you win net.',
  stroke_play: 'Lowest net total score wins the front 9, back 9, or overall.',
  wolf: 'One player is the Wolf each hole and chooses their partner (or goes alone).',
  gruesomes: 'Each team picks which opponent tee shot the other team must play.',
  vegas_side: 'Combine two net scores into a two-digit number; lower number wins.',
  dots: 'Earn dots for junk (birdies, sandies, greenies, etc.).',
  bingo_bango_bongo: 'Three points per hole: first on green (bingo), closest to pin (bango), first in hole (bongo).',
}
