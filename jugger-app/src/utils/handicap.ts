import type { Player, Course, RoundConfig, GameConfig } from '../types'

// Module-level config updated via configureHdcpSettings (called by store on load + every change)
let _scramblePct = 0.6
let _captainsChoicePct = 0.15
let _stableford = { albatross: 10, eagle: 6, birdie: 4, par: 2, bogey: 1, double: 0.5 }

export function configureHdcpSettings(config: Pick<GameConfig,
  'texasScrambleHdcpPct' | 'captainsChoiceHdcpPct' |
  'stablefordAlbatross' | 'stablefordEagle' | 'stablefordBirdie' |
  'stablefordPar' | 'stablefordBogey' | 'stablefordDouble'
>) {
  _scramblePct = config.texasScrambleHdcpPct
  _captainsChoicePct = config.captainsChoiceHdcpPct
  _stableford = {
    albatross: config.stablefordAlbatross,
    eagle: config.stablefordEagle,
    birdie: config.stablefordBirdie,
    par: config.stablefordPar,
    bogey: config.stablefordBogey,
    double: config.stablefordDouble,
  }
}

export function getScramblePct(): number { return _scramblePct }
export function getCaptainsChoicePct(): number { return _captainsChoicePct }

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
  format = '',
): number {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const override = player.courseHdcpOverrides?.[`${course.id}-${round}`]
  if (override !== undefined) return override

  const isScramble = format === 'texas_scramble'

  if (allTournamentPlayers.length === 0) {
    // Legacy fallback: raw course HDCP (used when netting players not available)
    const raw = courseHandicap(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par)
    return isScramble ? Math.floor(raw * _scramblePct) : raw
  }

  const minIndex = Math.min(...allTournamentPlayers.map(p => p.handicapIndex))
  return tournamentHdcp(player.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, isScramble)
}

// coursePar = total par for the round (e.g. 72).
// Per-player quota = half of course par minus their HDCP.
export function playerQuota(courseHdcp: number, coursePar: number): number {
  return Math.round(coursePar / 2) - courseHdcp
}

// Twosome/team quota = course par minus the sum of all player HDCPs.
export function teamQuota(hdcps: number[], coursePar: number): number {
  return coursePar - hdcps.reduce((sum, h) => sum + h, 0)
}

export function getStrokeDots(courseHdcp: number, holeHdcpRank: number): string {
  if (courseHdcp >= 18 + holeHdcpRank) return '..'
  if (courseHdcp >= holeHdcpRank) return '.'
  return ''
}

export function stablefordPoints(grossScore: number, par: number, strokes: number): number {
  const net = grossScore - strokes
  const diff = par - net
  if (diff < -2)   return 0
  if (diff === -2) return _stableford.double
  if (diff === -1) return _stableford.bogey
  if (diff === 0)  return _stableford.par
  if (diff === 1)  return _stableford.birdie
  if (diff === 2)  return _stableford.eagle
  return _stableford.albatross
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
  return scramble ? Math.round(capped * _scramblePct) : capped
}

// 2009 Net HDCP (column W): old method, still shown in the table
export function net2009Hdcp(index: number, minIndex: number): number {
  if (index > 18) return 18
  return Math.trunc(index) - Math.trunc(minIndex)
}

export function formatRoundHdcp(format: string): string {
  switch (format) {
    case 'texas_scramble':  return `${Math.round(_scramblePct * 100)}% of Course HDCP`
    case 'captains_choice': return `${Math.round(_captainsChoicePct * 100)}% of Team Aggregate`
    case 'points_round':    return 'Full Course HDCP; twosome quota = course par − (HDCP_A + HDCP_B)'
    default:                return 'Full Course HDCP'
  }
}

export function getRoundHdcpPct(format: string): number | null {
  if (format === 'texas_scramble') return _scramblePct
  if (format === 'captains_choice') return _captainsChoicePct
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
  format = '',
): Record<string, number> {
  const teeData = course.tees.find(t => t.name === tee) ?? course.tees[0]
  const allPlayers = allTournamentPlayers.length > 0 ? allTournamentPlayers : players
  const minIndex = Math.min(...allPlayers.map(p => p.handicapIndex))
  const result: Record<string, number> = {}

  if (format === 'captains_choice') {
    // Individual tournament HDCPs summed, then × 15% for the team
    const indivHdcps = players.map(p =>
      tournamentHdcp(p.handicapIndex, teeData.slope ?? 113, teeData.rating ?? course.par, course.par, minIndex, false)
    )
    const teamHdcp = Math.round(indivHdcps.reduce((s, v) => s + v, 0) * _captainsChoicePct)
    players.forEach(p => { result[p.id] = teamHdcp })
    return result
  }

  players.forEach(p => {
    result[p.id] = getPlayerCourseHdcp(p, course, tee, round, allPlayers, format)
  })
  return result
}
