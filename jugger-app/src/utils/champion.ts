import type { Team, TeamRoundScore, ArchivedYear } from '../types'

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

// defendingChampionId: the team that holds the title going into this year.
// On a tied final, the defender retains (Ryder Cup rule).
// During the tournament, the defender clinches on >= (tie = their win); others need strict >.
export function computeChampion(
  teams: Team[],
  teamScores: TeamRoundScore[],
  rounds: number[],
  defendingChampionId?: string,
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

  // All rounds done: outright winner, or defending champion retains on tie
  if (isComplete) {
    const tied = sorted.filter(t => t.total === leader.total)
    if (tied.length === 1) return { champion: leader.team, isComplete: true }
    if (defendingChampionId) {
      const defender = tied.find(t => t.team.id === defendingChampionId)
      if (defender) return { champion: defender.team, isComplete: true }
    }
    return { champion: null, isComplete: true }
  }

  const leaderIsDefender = leader.team.id === defendingChampionId

  // Clinch: leader's guaranteed floor vs every opponent's theoretical ceiling.
  // Defender wins on tie, so use >= for them; others need strict >.
  const clinched = sorted.slice(1).every(other => {
    const minRemForLeader = rounds
      .filter(r => !teamScores.some(s => s.teamId === leader.team.id && s.round === r))
      .reduce((sum, r) => sum + (MIN_PER_ROUND[r] ?? 0), 0)
    const maxRemForOther = rounds
      .filter(r => !teamScores.some(s => s.teamId === other.team.id && s.round === r))
      .reduce((sum, r) => sum + (MAX_PER_ROUND[r] ?? 0), 0)

    return leaderIsDefender
      ? leader.total + minRemForLeader >= other.total + maxRemForOther
      : leader.total + minRemForLeader > other.total + maxRemForOther
  })

  return { champion: clinched ? leader.team : null, isComplete: false }
}

// Finds the defending champion's team ID by looking at the previous year's archived data.
// Returns undefined if no previous year exists or if it ended in an unresolved tie.
export function getDefendingChampionId(
  archivedYears: ArchivedYear[],
  currentYear: number,
): string | undefined {
  const prevYear = archivedYears.find(y => y.year === currentYear - 1)
  if (!prevYear) return undefined

  const { teams, teamScores, roundConfigs } = prevYear
  if (!teams?.length || !teamScores?.length || !roundConfigs?.length) return undefined

  const rounds = roundConfigs.map(rc => rc.round as number)
  // No recursive defense for the previous year — just find the outright highest scorer
  const result = computeChampion(teams, teamScores, rounds)
  return result.champion?.id
}
