import type { Player, Course, RoundConfig } from '../types'

export function courseHandicap(index: number, slope: number, rating: number, par: number): number {
  return Math.round(index * (slope / 113) + (rating - par))
}

export function getPlayerCourseHdcp(
  player: Player,
  course: Course,
  tee: string,
  round: number,
  teamAggregate?: number,
): number {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const override = player.courseHdcpOverrides?.[`${course.id}-${round}`]
  if (override !== undefined) return override

  const raw = courseHandicap(player.handicapIndex, teeData.slope, teeData.rating, course.par)

  switch (round) {
    case 1:
    case 4:
      return raw
    case 2:
      return raw
    case 3:
      return Math.floor(raw * 0.6)
    case 5:
      return teamAggregate !== undefined ? Math.floor(teamAggregate * 0.15) : raw
    default:
      return raw
  }
}

export function playerQuota(courseHdcp: number): number {
  return 36 - courseHdcp
}

export function teamQuota(hdcps: number[]): number {
  return hdcps.reduce((sum, h) => sum + (36 - h), 0)
}

export function getStrokeDots(courseHdcp: number, holeHdcpRank: number): string {
  if (courseHdcp >= 18 + holeHdcpRank) return '..'
  if (courseHdcp >= holeHdcpRank) return '.'
  return ''
}

export function stablefordPoints(grossScore: number, par: number, strokes: number): number {
  const net = grossScore - strokes
  const diff = par - net
  if (diff <= -2) return 0    // double bogey or worse
  if (diff === -1) return 0.5 // bogey - stored as 0.5
  if (diff === 0)  return 2   // par
  if (diff === 1)  return 4   // birdie
  if (diff === 2)  return 6   // eagle
  return 10                   // albatross+
}

export function formatRoundHdcp(round: number): string {
  switch (round) {
    case 1: return 'Full Course HDCP'
    case 2: return 'Full Course HDCP (quota = 36 − HDCP)'
    case 3: return '60% of Course HDCP'
    case 4: return 'Full Course HDCP'
    case 5: return '15% of Team Aggregate'
    default: return ''
  }
}

export function getRoundHdcpPct(round: number): number | null {
  if (round === 3) return 0.6
  if (round === 5) return 0.15
  return null
}

export function computeAllCourseHdcps(
  players: Player[],
  course: Course,
  tee: string,
  round: number,
): Record<string, number> {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const result: Record<string, number> = {}

  if (round === 5) {
    const aggregate = players.reduce((sum, p) => {
      const raw = courseHandicap(p.handicapIndex, teeData.slope, teeData.rating, course.par)
      return sum + raw
    }, 0)
    players.forEach(p => { result[p.id] = Math.floor(aggregate * 0.15) })
    return result
  }

  players.forEach(p => {
    result[p.id] = getPlayerCourseHdcp(p, course, tee, round)
  })
  return result
}
