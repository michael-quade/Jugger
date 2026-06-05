import type { Player, Course, RoundConfig } from '../types'

export function courseHandicap(index: number, slope: number, rating: number, par: number): number {
  return Math.round(index * (slope / 113) + (rating - par))
}

// allTournamentPlayers = all 12 players across all teams, used to find minIndex for netting.
// If omitted, falls back to the old raw-course-HDCP calculation (no netting).
export function getPlayerCourseHdcp(
  player: Player,
  course: Course,
  tee: string,
  round: number,
  allTournamentPlayers: Player[] = [],
): number {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const override = player.courseHdcpOverrides?.[`${course.id}-${round}`]
  if (override !== undefined) return override

  if (allTournamentPlayers.length === 0) {
    // Legacy fallback: raw course HDCP (used when netting players not available)
    const raw = courseHandicap(player.handicapIndex, teeData.slope, teeData.rating, course.par)
    return round === 3 ? Math.floor(raw * 0.6) : raw
  }

  const minIndex = Math.min(...allTournamentPlayers.map(p => p.handicapIndex))
  return tournamentHdcp(player.handicapIndex, teeData.slope, teeData.rating, course.par, minIndex, round === 3)
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
  if (diff < -2)   return 0    // triple bogey or worse
  if (diff === -2) return 0.5  // double bogey
  if (diff === -1) return 1    // bogey
  if (diff === 0)  return 2    // par
  if (diff === 1)  return 4    // birdie
  if (diff === 2)  return 6    // eagle
  return 10                    // albatross+
}

// ─── Tournament netting formulas (mirrors Excel HDCPs tab U1:AO20) ────────────

// Raw course HDCP (1 decimal, for display — column Z/AB/AD/AF/AH)
export function rawCourseHdcpDisplay(index: number, slope: number, rating: number, par: number): number {
  return Math.round((index * (slope / 113) + (rating - par)) * 10) / 10
}

// Netted course HDCP without the >18 cap (columns AK–AO):
//   round(playerRaw) − round(lowestPlayerRaw)
export function nettedCourseHdcpRaw(index: number, slope: number, rating: number, par: number, minIndex: number): number {
  const playerRaw = Math.round(index * (slope / 113) + (rating - par))
  const lowestRaw = Math.round(minIndex * (slope / 113) + (rating - par))
  return playerRaw - lowestRaw
}

// Apply >18 compression (50% on excess): columns AA/AC/AE/AG/AI before scramble %
export function apply18Cap(netted: number): number {
  if (netted > 18) return 18 + Math.round(0.5 * (netted - 18))
  return netted
}

// Final tournament HDCP after full netting + cap (+ 60% for scramble)
export function tournamentHdcp(
  index: number,
  slope: number,
  rating: number,
  par: number,
  minIndex: number,
  scramble = false,
): number {
  const capped = apply18Cap(nettedCourseHdcpRaw(index, slope, rating, par, minIndex))
  return scramble ? Math.round(capped * 0.6) : capped
}

// 2009 Net HDCP (column W): old method, still shown in the table
export function net2009Hdcp(index: number, minIndex: number): number {
  if (index > 18) return 18
  return Math.trunc(index) - Math.trunc(minIndex)
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

// players = the match participants; allTournamentPlayers = all 12 for minIndex netting.
// For R5 (Captain's Choice): all match players get the same team HDCP = round(sum × 0.15).
export function computeAllCourseHdcps(
  players: Player[],
  course: Course,
  tee: string,
  round: number,
  allTournamentPlayers: Player[] = [],
): Record<string, number> {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const allPlayers = allTournamentPlayers.length > 0 ? allTournamentPlayers : players
  const minIndex = Math.min(...allPlayers.map(p => p.handicapIndex))
  const result: Record<string, number> = {}

  if (round === 5) {
    // Individual R5 tournament HDCPs summed, then × 15% for the team
    const indivHdcps = players.map(p =>
      tournamentHdcp(p.handicapIndex, teeData.slope, teeData.rating, course.par, minIndex, false)
    )
    const teamHdcp = Math.round(indivHdcps.reduce((s, v) => s + v, 0) * 0.15)
    players.forEach(p => { result[p.id] = teamHdcp })
    return result
  }

  players.forEach(p => {
    result[p.id] = getPlayerCourseHdcp(p, course, tee, round, allPlayers)
  })
  return result
}
