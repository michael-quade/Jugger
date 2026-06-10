import type { Team, TeamRoundScore } from '../types'

// Max points one team can earn per round
// R1: 2 regular×2 + 2 blind×1 = 6
// R2: same as R1 + up to 2 magic balls = 8
// R3/R5: 1st place = 4
// R4: 2 regular×(2×1v1 + 2v2) + 2 blind×(2×0.5) = 8
const MAX_PER_ROUND: Record<number, number> = { 1: 6, 2: 8, 3: 4, 4: 8, 5: 4 }

// Minimum points one team can earn per round
// Team-finish formats (R3, R5): last place gets 1 pt
// Match formats (R1, R2, R4): a team can lose everything = 0
const MIN_PER_ROUND: Record<number, number> = { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 }

export interface ChampionResult {
  champion: Team | null
  isComplete: boolean
}

export function computeChampion(
  teams: Team[],
  teamScores: TeamRoundScore[],
  rounds: number[],
): ChampionResult {
  if (teams.length === 0 || teamScores.length === 0 || rounds.length === 0) {
    return { champion: null, isComplete: false }
  }

  const totals = teams.map(t => ({
    team: t,
    total: teamScores.filter(s => s.teamId === t.id).reduce((sum, s) => sum + s.points, 0),
  }))

  const isComplete = teams.every(t =>
    rounds.every(r => teamScores.some(s => s.teamId === t.id && s.round === r))
  )

  const sorted = [...totals].sort((a, b) => b.total - a.total)
  const leader = sorted[0]

  // All rounds done: declare winner if no tie
  if (isComplete) {
    const tied = sorted.filter(t => t.total === leader.total)
    return { champion: tied.length === 1 ? leader.team : null, isComplete: true }
  }

  // Clinch: leader's guaranteed minimum > every opponent's theoretical maximum
  const clinched = sorted.slice(1).every(other => {
    const minRemForLeader = rounds
      .filter(r => !teamScores.some(s => s.teamId === leader.team.id && s.round === r))
      .reduce((sum, r) => sum + (MIN_PER_ROUND[r] ?? 0), 0)
    const maxRemForOther = rounds
      .filter(r => !teamScores.some(s => s.teamId === other.team.id && s.round === r))
      .reduce((sum, r) => sum + (MAX_PER_ROUND[r] ?? 0), 0)

    return leader.total + minRemForLeader > other.total + maxRemForOther
  })

  return { champion: clinched ? leader.team : null, isComplete: false }
}
