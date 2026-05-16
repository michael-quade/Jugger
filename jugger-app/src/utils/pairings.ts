import type { Team, Match, Twosome } from '../types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function splitTwosome(team: Team): [Twosome, Twosome] {
  const shuffled = shuffle(team.players)
  return [
    { teamId: team.id, playerIds: [shuffled[0].id, shuffled[1].id] },
    { teamId: team.id, playerIds: [shuffled[2].id, shuffled[3].id] },
  ]
}

export function generateTwosomeMatches(teams: Team[], round: number): Match[] {
  const [t1, t2, t3] = shuffle(teams)
  const [t1a, t1b] = splitTwosome(t1)
  const [t2a, t2b] = splitTwosome(t2)
  const [t3a, t3b] = splitTwosome(t3)

  const matches: Match[] = [
    {
      id: `${round}a`, round, label: 'Match A',
      isBlind: false,
      twosome1: t1a, twosome2: t2a,
      scores: {},
    },
    {
      id: `${round}b`, round, label: 'Match B',
      isBlind: false,
      twosome1: t1b, twosome2: t3a,
      scores: {},
    },
    {
      id: `${round}c`, round, label: 'Match C',
      isBlind: false,
      twosome1: t2b, twosome2: t3b,
      scores: {},
    },
    {
      id: `${round}blind1`, round, label: 'Blind 1',
      isBlind: true,
      twosome1: t3b, twosome2: t1a,
      scores: {},
    },
    {
      id: `${round}blind2`, round, label: 'Blind 2',
      isBlind: true,
      twosome1: t2a, twosome2: t3a,
      scores: {},
    },
    {
      id: `${round}blind3`, round, label: 'Blind 3',
      isBlind: true,
      twosome1: t2b, twosome2: t1b,
      scores: {},
    },
  ]

  return matches
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

export function generateAllPairings(teams: Team[]): Match[] {
  const matches: Match[] = []
  // Rounds 1, 2, 4: twosome matches
  for (const round of [1, 2, 4] as const) {
    matches.push(...generateTwosomeMatches(teams, round))
  }
  // Rounds 3, 5: team formats (each team plays as a unit)
  for (const round of [3, 5] as const) {
    matches.push(...generateTeamMatches(teams, round))
  }
  return matches
}

export function getMatchesForRound(matches: Match[], round: number): Match[] {
  return matches.filter(m => m.round === round)
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
