import type { Team, Match, Twosome, RoundConfig } from '../types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Partner rotation ────────────────────────────────────────────────────────
//
// Across the 3 twosome rounds each player pairs with every other teammate
// exactly once.  Players within a team are assigned slots 0-3; the pairing
// schemes below cover all 6 edges of K4 without repetition.
//
//   1st twosome round : (0,1) vs (2,3)
//   2nd twosome round : (0,2) vs (1,3)
//   3rd twosome round : (0,3) vs (1,2)
//
const INTRA_PAIRINGS: [[number, number], [number, number]][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

const TEAM_FORMATS = new Set<RoundConfig['format']>(['texas_scramble', 'captains_choice'])

function allPerms3(): [number, number, number][] {
  return [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]
}

// ─── Core builder ────────────────────────────────────────────────────────────

// Build the 3 physical tee-time foursomes for one twosome round.
//   perm   – which element of teams[] maps to T1 / T2 / T3
//   flips  – bitmask; bit k set means team perm[k] swaps its A/B twosome role
//
// Match matrix (unchanged from original):
//   F1 – T1-A vs T2-A   (Regular A)
//   F2 – T1-B vs T3-A   (Regular B)
//   F3 – T2-B vs T3-B   (Regular C)
//
function buildFoursomes(
  teams: Team[],
  slots: Record<string, string[]>,
  pairingIdx: number,
  perm: [number, number, number],
  flips: number,
): [string, string, string, string][] {
  const pairs = INTRA_PAIRINGS[pairingIdx]

  function tw(tIdx: number, wantA: boolean): [string, string] {
    const team = teams[perm[tIdx]]
    const flipped = !!(flips & (1 << tIdx))
    const pi = (wantA !== flipped) ? 0 : 1
    const s = slots[team.id]
    return [s[pairs[pi][0]], s[pairs[pi][1]]]
  }

  const [t1a, t1b] = [tw(0, true), tw(0, false)]
  const [t2a, t2b] = [tw(1, true), tw(1, false)]
  const [t3a, t3b] = [tw(2, true), tw(2, false)]

  return [
    [...t1a, ...t2a] as [string, string, string, string], // F1
    [...t1b, ...t3a] as [string, string, string, string], // F2
    [...t2b, ...t3b] as [string, string, string, string], // F3
  ]
}

// Count cross-round repeated player pairs across all foursomes (lower = better).
function scoreRepeats(allFoursomes: [string, string, string, string][][]): number {
  const seen = new Map<string, number>()
  for (const roundFoursomes of allFoursomes) {
    for (const group of roundFoursomes) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const key = group[i] < group[j]
            ? `${group[i]}|${group[j]}`
            : `${group[j]}|${group[i]}`
          seen.set(key, (seen.get(key) ?? 0) + 1)
        }
      }
    }
  }
  let score = 0
  for (const cnt of seen.values()) {
    if (cnt > 1) score += cnt - 1
  }
  return score
}

// Convert an assignment into the 6 Match objects for one round.
function buildMatchObjects(
  teams: Team[],
  round: number,
  slots: Record<string, string[]>,
  pairingIdx: number,
  perm: [number, number, number],
  flips: number,
): Match[] {
  const pairs = INTRA_PAIRINGS[pairingIdx]

  function twosome(tIdx: number, wantA: boolean): Twosome {
    const team = teams[perm[tIdx]]
    const flipped = !!(flips & (1 << tIdx))
    const pi = (wantA !== flipped) ? 0 : 1
    const s = slots[team.id]
    return { teamId: team.id, playerIds: [s[pairs[pi][0]], s[pairs[pi][1]]] }
  }

  const t1a = twosome(0, true),  t1b = twosome(0, false)
  const t2a = twosome(1, true),  t2b = twosome(1, false)
  const t3a = twosome(2, true),  t3b = twosome(2, false)

  return [
    { id: `${round}a`,      round, label: 'Match A', isBlind: false, twosome1: t1a, twosome2: t2a, scores: {} },
    { id: `${round}b`,      round, label: 'Match B', isBlind: false, twosome1: t1b, twosome2: t3a, scores: {} },
    { id: `${round}c`,      round, label: 'Match C', isBlind: false, twosome1: t2b, twosome2: t3b, scores: {} },
    { id: `${round}blind1`, round, label: 'Blind 1', isBlind: true,  twosome1: t3b, twosome2: t1a, scores: {} },
    { id: `${round}blind2`, round, label: 'Blind 2', isBlind: true,  twosome1: t2a, twosome2: t3a, scores: {} },
    { id: `${round}blind3`, round, label: 'Blind 3', isBlind: true,  twosome1: t2b, twosome2: t1b, scores: {} },
  ]
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Standalone single-round twosome generation (random assignment, used when
// regenerating one round outside of generateAllPairings).
export function generateTwosomeMatches(
  teams: Team[],
  round: number,
  pairingIdx = 0,
): Match[] {
  const slots: Record<string, string[]> = {}
  for (const team of teams) {
    slots[team.id] = shuffle(team.players.map(p => p.id))
  }
  const perm = shuffle([0, 1, 2]) as [number, number, number]
  return buildMatchObjects(teams, round, slots, pairingIdx, perm, 0)
}

export function generateTeamMatches(teams: Team[], round: number): Match[] {
  return teams.map(team => ({
    id: `${round}-${team.id}`,
    round,
    label: team.name,
    isBlind: false,
    twosome1: { teamId: team.id, playerIds: [team.players[0].id, team.players[1].id] },
    twosome2: { teamId: team.id, playerIds: [team.players[2].id, team.players[3].id] },
    scores: {},
  }))
}

export function generateMatchesForRound(
  teams: Team[],
  round: number,
  format: RoundConfig['format'],
  allConfigs?: RoundConfig[],
): Match[] {
  if (TEAM_FORMATS.has(format)) return generateTeamMatches(teams, round)
  const twosomeRounds = (allConfigs ?? [])
    .filter(rc => !TEAM_FORMATS.has(rc.format))
    .map(rc => rc.round)
    .sort((a, b) => a - b)
  const idx = twosomeRounds.indexOf(round as 1 | 2 | 3 | 4 | 5)
  return generateTwosomeMatches(teams, round, Math.max(0, idx))
}

// Primary entry point — generates all pairings with:
//   1. Guaranteed partner rotation (each player partners with every teammate once)
//   2. Greedy opponent minimization (limit repeat cross-team foursomes)
//
export function generateAllPairings(teams: Team[], roundConfigs: RoundConfig[]): Match[] {
  const twosomeConfigs = roundConfigs
    .filter(rc => !TEAM_FORMATS.has(rc.format))
    .sort((a, b) => a.round - b.round)
  const teamConfigs = roundConfigs.filter(rc => TEAM_FORMATS.has(rc.format))

  // One random slot order per team, shared across all twosome rounds.
  // Slot 0-3 determines which INTRA_PAIRINGS row each player lands in.
  const slots: Record<string, string[]> = {}
  for (const team of teams) {
    slots[team.id] = shuffle(team.players.map(p => p.id))
  }

  const perms = allPerms3()
  const chosenFoursomes: [string, string, string, string][][] = []
  const assignments: { perm: [number, number, number]; flips: number }[] = []

  for (let ri = 0; ri < twosomeConfigs.length; ri++) {
    const pairingIdx = Math.min(ri, INTRA_PAIRINGS.length - 1)
    let bestScore = Infinity
    let bestPerm = perms[0]
    let bestFlips = 0
    let tieCount = 0

    for (const perm of perms) {
      for (let flips = 0; flips < 8; flips++) {
        const fo = buildFoursomes(teams, slots, pairingIdx, perm, flips)
        const score = scoreRepeats([...chosenFoursomes, fo])
        if (score < bestScore) {
          bestScore = score
          bestPerm = perm
          bestFlips = flips
          tieCount = 1
        } else if (score === bestScore) {
          tieCount++
          if (Math.random() < 1 / tieCount) {
            bestPerm = perm
            bestFlips = flips
          }
        }
      }
    }

    chosenFoursomes.push(buildFoursomes(teams, slots, pairingIdx, bestPerm, bestFlips))
    assignments.push({ perm: bestPerm, flips: bestFlips })
  }

  const twosomeMatches = twosomeConfigs.flatMap((rc, ri) => {
    const { perm, flips } = assignments[ri]
    return buildMatchObjects(teams, rc.round, slots, Math.min(ri, INTRA_PAIRINGS.length - 1), perm, flips)
  })

  const teamMatches = teamConfigs.flatMap(rc => generateTeamMatches(teams, rc.round))

  return [...twosomeMatches, ...teamMatches]
}

// ─── Lookup helpers (unchanged) ──────────────────────────────────────────────

export function getMatchesForRound(matches: Match[], round: number): Match[] {
  return matches
    .filter(m => m.round === round)
    .sort((a, b) => {
      if (a.isBlind !== b.isBlind) return a.isBlind ? 1 : -1
      return a.label.localeCompare(b.label)
    })
}

export function getPlayerName(teams: Team[], playerId: string): string {
  for (const team of teams) {
    const p = team.players.find(p => p.id === playerId)
    if (p) return p.name
  }
  return playerId
}

export function getTeamName(teams: Team[], teamId: string): string {
  return teams.find(t => t.id === teamId)?.name ?? teamId
}

export function getTeamColor(teams: Team[], teamId: string): string {
  return teams.find(t => t.id === teamId)?.color ?? '#666'
}
