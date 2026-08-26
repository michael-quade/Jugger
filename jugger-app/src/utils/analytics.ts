import type { Match, Team, RoundConfig, HoleData, TeamRoundScore, CourseTee, ShotDirection } from '../types'

// Minimal course shape — satisfied by both Course and CourseHistoryEntry (after filtering nulls)
export interface CourseLike {
  id: string
  name: string
  par: number
  tees: CourseTee[]
  holes: HoleData[]
}

// ─── Input / shared types ────────────────────────────────────────────────────

export type RndFormat = 'team_match_play' | 'points_round' | 'texas_scramble' | 'individual_match' | 'captains_choice'

export interface YearBundle {
  year: number
  teams: Team[]
  matches: Match[]
  teamScores: TeamRoundScore[]
  roundConfigs: RoundConfig[]
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface ScoringDist {
  eagle: number      // ≤ par-2
  birdie: number
  par: number
  bogey: number
  double: number
  worse: number
  total: number
}

export interface ParTypeStat {
  holes: number
  totalScore: number
}

export interface PlayerScoringProfile {
  playerId: string
  dist: ScoringDist
  par3: ParTypeStat
  par4: ParTypeStat
  par5: ParTypeStat
  front: ParTypeStat
  back:  ParTypeStat
  roundScores: { year: number; round: number; format: RndFormat; gross: number; holes: number }[]
}

export interface H2HRecord {
  wins: number
  losses: number
  halves: number
  matchesPlayed: number
  byFormat: Partial<Record<RndFormat, { wins: number; losses: number; halves: number }>>
}

export interface PartnerRecord {
  partnerId: string
  wins: number
  losses: number
  ties: number
  matches: number
}

export interface TeamYearResult {
  year: number
  finish: number       // 1 | 2 | 3
  totalPoints: number
  byRound: Record<number, number>
  isChampion: boolean
}

export interface FormatTeamStat {
  wins: number
  losses: number
  ties: number
  points: number
  matches: number
}

export interface HoleStat {
  holeNumber: number
  par: number
  hdcpOrder: number
  samples: number
  totalScore: number
  avgScore: number
  avgVsPar: number
  eagle: number
  birdie: number
  parCount: number
  bogey: number
  double: number
  worse: number
}

export interface CourseAnalytics {
  courseId: string
  courseName: string
  holes: HoleStat[]
}

export interface RecordEntry {
  value: string
  holder: string
  year: number
  courseName?: string
  detail?: string
}

export interface RecordBook {
  lowestGross:          RecordEntry | null
  lowestNet:            RecordEntry | null
  mostEagles:           RecordEntry | null
  mostBirdies:          RecordEntry | null
  mostParsRound:        RecordEntry | null
  mostBogeys:           RecordEntry | null
  mostDoubles:          RecordEntry | null
  mostDoublePlus:       RecordEntry | null
  biggestMatchWin:      RecordEntry | null
  bestQuotaBeat:        RecordEntry | null
  mostStablefordPts:         RecordEntry | null
  lowestCaptainsChoiceGross: RecordEntry | null
  lowestCaptainsChoiceNet:   RecordEntry | null
}

// ─── Internal helpers ────────────────────────────────────────────────────────

export function findCourse(id: string, courses: CourseLike[], history: CourseLike[]): CourseLike | undefined {
  return courses.find(c => c.id === id) ?? history.find(c => c.id === id)
}

function holeStrokes(hdcp: number, hdcpOrder: number): number {
  if (hdcp >= hdcpOrder + 18) return 2
  if (hdcp >= hdcpOrder) return 1
  return 0
}

function computeHdcp(
  playerIdx: number, minIdx: number,
  slope: number, rating: number, par: number,
): number {
  const raw     = Math.round(playerIdx * (slope / 113) + (rating - par))
  const minRaw  = Math.round(minIdx   * (slope / 113) + (rating - par))
  const netted  = raw - minRaw
  return netted > 18 ? 18 + Math.round(0.5 * (netted - 18)) : Math.max(0, netted)
}

export function playerHdcpsForRound(
  teams: Team[], rc: RoundConfig, course: CourseLike,
): Record<string, number> {
  const all     = teams.flatMap(t => t.players)
  const minIdx  = Math.min(...all.map(p => p.handicapIndex))
  const tee     = course.tees.find(t => t.name === rc.tee) ?? course.tees[0]
  const slope   = tee?.slope  ?? 113
  const rating  = tee?.rating ?? course.par
  const out: Record<string, number> = {}
  for (const p of all) out[p.id] = computeHdcp(p.handicapIndex, minIdx, slope, rating, course.par)
  return out
}

function scoreCat(gross: number, par: number): keyof ScoringDist {
  const d = gross - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  if (d === 2)  return 'double'
  return 'worse'
}

function emptyDist(): ScoringDist {
  return { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, worse: 0, total: 0 }
}

function emptyParType(): ParTypeStat { return { holes: 0, totalScore: 0 } }

// ─── 1. Player scoring profiles ──────────────────────────────────────────────

export function computeScoringProfiles(
  bundles: YearBundle[],
  courses: CourseLike[],
  courseHistory: CourseLike[],
): Record<string, PlayerScoringProfile> {
  const profiles: Record<string, PlayerScoringProfile> = {}

  function get(pid: string): PlayerScoringProfile {
    if (!profiles[pid]) profiles[pid] = {
      playerId: pid,
      dist: emptyDist(),
      par3: emptyParType(), par4: emptyParType(), par5: emptyParType(),
      front: emptyParType(), back: emptyParType(),
      roundScores: [],
    }
    return profiles[pid]
  }

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc || rc.format === 'captains_choice') continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue

      const holeMap: Record<number, HoleData> = {}
      for (const h of course.holes) holeMap[h.number] = h

      for (const [pid, holeScores] of Object.entries(match.scores)) {
        const prof = get(pid)
        let gross = 0, holesPlayed = 0

        for (const [hn, score] of Object.entries(holeScores)) {
          if (score == null) continue
          const hole = holeMap[parseInt(hn)]
          if (!hole) continue

          const cat = scoreCat(score, hole.par)
          prof.dist[cat]++
          prof.dist.total++
          gross += score
          holesPlayed++

          if (hole.par === 3) { prof.par3.holes++; prof.par3.totalScore += score }
          if (hole.par === 4) { prof.par4.holes++; prof.par4.totalScore += score }
          if (hole.par === 5) { prof.par5.holes++; prof.par5.totalScore += score }
          if (hole.number <= 9) { prof.front.holes++; prof.front.totalScore += score }
          else                  { prof.back.holes++;  prof.back.totalScore  += score }
        }

        if (holesPlayed >= 9) {
          prof.roundScores.push({
            year: bundle.year, round: rc.round, format: rc.format as RndFormat, gross, holes: holesPlayed,
          })
        }
      }
    }
  }

  return profiles
}

// ─── 2. Head-to-head records ─────────────────────────────────────────────────

export function computeH2H(
  bundles: YearBundle[],
  courses: CourseLike[],
  courseHistory: CourseLike[],
): Record<string, Record<string, H2HRecord>> {
  const h2h: Record<string, Record<string, H2HRecord>> = {}

  function get(p1: string, p2: string): H2HRecord {
    if (!h2h[p1]) h2h[p1] = {}
    if (!h2h[p1][p2]) h2h[p1][p2] = { wins: 0, losses: 0, halves: 0, matchesPlayed: 0, byFormat: {} }
    return h2h[p1][p2]
  }

  function record(
    p1: string, p2: string,
    winner: 'p1' | 'p2' | 'tie',
    format: RndFormat,
  ) {
    const r12 = get(p1, p2)
    const r21 = get(p2, p1)
    r12.matchesPlayed++; r21.matchesPlayed++
    if (!r12.byFormat[format]) r12.byFormat[format] = { wins: 0, losses: 0, halves: 0 }
    if (!r21.byFormat[format]) r21.byFormat[format] = { wins: 0, losses: 0, halves: 0 }
    if (winner === 'tie') {
      r12.halves++; r21.halves++
      r12.byFormat[format]!.halves++; r21.byFormat[format]!.halves++
    } else if (winner === 'p1') {
      r12.wins++;   r21.losses++
      r12.byFormat[format]!.wins++;   r21.byFormat[format]!.losses++
    } else {
      r12.losses++; r21.wins++
      r12.byFormat[format]!.losses++; r21.byFormat[format]!.wins++
    }
  }

  function matchScore(
    pA: string, pB: string,
    match: Match, course: CourseLike,
    hdcps: Record<string, number>,
  ): 'p1' | 'p2' | 'tie' | null {
    let score = 0, played = 0
    for (const hole of course.holes) {
      const sa = match.scores[pA]?.[hole.number]
      const sb = match.scores[pB]?.[hole.number]
      if (sa == null || sb == null) continue
      const nA = sa - holeStrokes(hdcps[pA] ?? 0, hole.hdcpOrder)
      const nB = sb - holeStrokes(hdcps[pB] ?? 0, hole.hdcpOrder)
      if (nA < nB) score++; else if (nB < nA) score--
      played++
      if (Math.abs(score) > 18 - played) break // dormie-ish shortcut
    }
    if (played < 9) return null
    return score > 0 ? 'p1' : score < 0 ? 'p2' : 'tie'
  }

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc) continue
      const fmt = rc.format as RndFormat
      if (fmt !== 'individual_match' && fmt !== 'team_match_play') continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue
      const hdcps = playerHdcpsForRound(bundle.teams, rc, course)

      const [t1p1, t1p2] = match.twosome1.playerIds
      const [t2p1, t2p2] = match.twosome2.playerIds

      if (fmt === 'individual_match') {
        // Two clean 1v1s
        const res1 = matchScore(t1p1, t2p1, match, course, hdcps)
        if (res1) record(t1p1, t2p1, res1, fmt)
        const res2 = matchScore(t1p2, t2p2, match, course, hdcps)
        if (res2) record(t1p2, t2p2, res2, fmt)
      }

      if (fmt === 'team_match_play') {
        // Best-ball twosome result — record for all four cross-team pairs
        let score = 0, played = 0
        for (const hole of course.holes) {
          const s1a = match.scores[t1p1]?.[hole.number]
          const s1b = match.scores[t1p2]?.[hole.number]
          const s2a = match.scores[t2p1]?.[hole.number]
          const s2b = match.scores[t2p2]?.[hole.number]
          if (s1a == null || s1b == null || s2a == null || s2b == null) continue
          const n1 = Math.min(s1a - holeStrokes(hdcps[t1p1] ?? 0, hole.hdcpOrder),
                              s1b - holeStrokes(hdcps[t1p2] ?? 0, hole.hdcpOrder))
          const n2 = Math.min(s2a - holeStrokes(hdcps[t2p1] ?? 0, hole.hdcpOrder),
                              s2b - holeStrokes(hdcps[t2p2] ?? 0, hole.hdcpOrder))
          if (n1 < n2) score++; else if (n2 < n1) score--
          played++
        }
        if (played < 9) continue
        const w: 'p1' | 'p2' | 'tie' = score > 0 ? 'p1' : score < 0 ? 'p2' : 'tie'
        for (const p1 of [t1p1, t1p2]) {
          for (const p2 of [t2p1, t2p2]) {
            record(p1, p2, w, fmt)
          }
        }
      }
    }
  }

  return h2h
}

// ─── 3. Partnership records ───────────────────────────────────────────────────

export function computePartnerRecords(
  bundles: YearBundle[],
  courses: CourseLike[],
  courseHistory: CourseLike[],
): Record<string, Record<string, PartnerRecord>> {
  const recs: Record<string, Record<string, PartnerRecord>> = {}

  function get(p: string, partner: string): PartnerRecord {
    if (!recs[p]) recs[p] = {}
    if (!recs[p][partner]) recs[p][partner] = { partnerId: partner, wins: 0, losses: 0, ties: 0, matches: 0 }
    return recs[p][partner]
  }

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc) continue
      const fmt = rc.format as RndFormat
      if (fmt === 'captains_choice' || fmt === 'points_round') continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue
      const hdcps = playerHdcpsForRound(bundle.teams, rc, course)

      const twosomes = [match.twosome1, match.twosome2]
      for (const [ti, tw] of twosomes.entries()) {
        const [pa, pb] = tw.playerIds
        const opponent = twosomes[1 - ti]
        const [oa, ob] = opponent.playerIds

        // Compute twosome best-ball result
        let score = 0, played = 0
        for (const hole of course.holes) {
          const sa = match.scores[pa]?.[hole.number]
          const sb = match.scores[pb]?.[hole.number]
          const oc1 = match.scores[oa]?.[hole.number]
          const oc2 = match.scores[ob]?.[hole.number]
          if (sa == null || sb == null || oc1 == null || oc2 == null) continue
          const nThis = Math.min(sa - holeStrokes(hdcps[pa] ?? 0, hole.hdcpOrder),
                                 sb - holeStrokes(hdcps[pb] ?? 0, hole.hdcpOrder))
          const nOpp  = Math.min(oc1 - holeStrokes(hdcps[oa] ?? 0, hole.hdcpOrder),
                                 oc2 - holeStrokes(hdcps[ob] ?? 0, hole.hdcpOrder))
          if (nThis < nOpp) score++; else if (nOpp < nThis) score--
          played++
        }
        if (played < 9) continue

        const won  = score > 0
        const lost = score < 0
        const tied = score === 0

        const r1 = get(pa, pb); const r2 = get(pb, pa)
        r1.matches++; r2.matches++
        if (won)       { r1.wins++;   r2.wins++ }
        else if (lost) { r1.losses++; r2.losses++ }
        else if (tied) { r1.ties++;   r2.ties++ }
      }
    }
  }

  return recs
}

// ─── 4. Team results history ─────────────────────────────────────────────────

export function computeTeamResults(
  bundles: YearBundle[],
): Record<string, TeamYearResult[]> {
  const out: Record<string, TeamYearResult[]> = {}

  for (const bundle of bundles) {
    if (!bundle.teamScores.length) continue

    const totals: Record<string, number> = {}
    const byRound: Record<string, Record<number, number>> = {}

    for (const ts of bundle.teamScores) {
      totals[ts.teamId] = (totals[ts.teamId] ?? 0) + ts.points
      if (!byRound[ts.teamId]) byRound[ts.teamId] = {}
      byRound[ts.teamId][ts.round] = ts.points
    }

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
    const champion = sorted[0]?.[0]

    sorted.forEach(([teamId, pts], idx) => {
      if (!out[teamId]) out[teamId] = []
      out[teamId].push({
        year: bundle.year,
        finish: Math.min(idx + 1, 3) as 1 | 2 | 3,
        totalPoints: pts,
        byRound: byRound[teamId] ?? {},
        isChampion: teamId === champion,
      })
    })
  }

  return out
}

// ─── 5. Format stats per team ─────────────────────────────────────────────────

export function computeFormatStats(
  bundles: YearBundle[],
): Record<string, Record<RndFormat, FormatTeamStat>> {
  const stats: Record<string, Record<RndFormat, FormatTeamStat>> = {}

  function get(teamId: string, fmt: RndFormat): FormatTeamStat {
    if (!stats[teamId]) stats[teamId] = {} as Record<RndFormat, FormatTeamStat>
    if (!stats[teamId][fmt]) stats[teamId][fmt] = { wins: 0, losses: 0, ties: 0, points: 0, matches: 0 }
    return stats[teamId][fmt]
  }

  for (const bundle of bundles) {
    // Points earned per format
    for (const ts of bundle.teamScores) {
      const rc = bundle.roundConfigs.find(r => r.round === ts.round)
      if (!rc) continue
      get(ts.teamId, rc.format as RndFormat).points += ts.points
    }

    // Rank teams by points per round to compute wins/losses
    const roundGroups: Record<number, { teamId: string; points: number }[]> = {}
    for (const ts of bundle.teamScores) {
      if (!roundGroups[ts.round]) roundGroups[ts.round] = []
      roundGroups[ts.round].push({ teamId: ts.teamId, points: ts.points })
    }

    for (const [roundStr, group] of Object.entries(roundGroups)) {
      const rc = bundle.roundConfigs.find(r => r.round === parseInt(roundStr))
      if (!rc || group.length < 2) continue
      const sorted = [...group].sort((a, b) => b.points - a.points)
      const maxPts = sorted[0].points
      sorted.forEach(({ teamId, points }, idx) => {
        const stat = get(teamId, rc.format as RndFormat)
        stat.matches++
        if (idx === 0 && points > 0)         stat.wins++
        else if (points === maxPts && idx > 0) stat.ties++
        else                                    stat.losses++
      })
    }
  }

  return stats
}

// ─── 6. Course / hole difficulty ─────────────────────────────────────────────

export function computeCourseStats(
  bundles: YearBundle[],
  courses: CourseLike[],
  courseHistory: CourseLike[],
): CourseAnalytics[] {
  const byId: Record<string, { course: CourseLike; holes: Record<number, HoleStat> }> = {}

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc || rc.format === 'captains_choice') continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue

      if (!byId[course.id]) {
        byId[course.id] = {
          course,
          holes: Object.fromEntries(course.holes.map(h => [h.number, {
            holeNumber: h.number, par: h.par, hdcpOrder: h.hdcpOrder,
            samples: 0, totalScore: 0, avgScore: 0, avgVsPar: 0,
            eagle: 0, birdie: 0, parCount: 0, bogey: 0, double: 0, worse: 0,
          }])),
        }
      }
      const { holes: hs } = byId[course.id]

      for (const holeScores of Object.values(match.scores)) {
        for (const [hn, score] of Object.entries(holeScores)) {
          if (score == null) continue
          const h = hs[parseInt(hn)]
          if (!h) continue
          h.samples++; h.totalScore += score
          const c = scoreCat(score, h.par)
          if (c === 'eagle')  h.eagle++
          else if (c === 'birdie') h.birdie++
          else if (c === 'par')    h.parCount++
          else if (c === 'bogey')  h.bogey++
          else if (c === 'double') h.double++
          else                     h.worse++
        }
      }
    }
  }

  return Object.values(byId).map(({ course, holes }) => ({
    courseId: course.id,
    courseName: course.name,
    holes: Object.values(holes)
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map(h => ({
        ...h,
        avgScore:  h.samples > 0 ? h.totalScore / h.samples : 0,
        avgVsPar:  h.samples > 0 ? h.totalScore / h.samples - h.par : 0,
      })),
  }))
}

// ─── 7. Records ───────────────────────────────────────────────────────────────

export function computeRecords(
  bundles: YearBundle[],
  playerName: (id: string) => string,
  courses: CourseLike[],
  courseHistory: CourseLike[],
  captainsChoicePct = 0.15,
): RecordBook {
  type RawRec = { value: number; holder: string; year: number; detail: string; courseName: string }
  let lowestGross:          RawRec | null = null
  let lowestNet:            RawRec | null = null
  let mostEagles:           RawRec | null = null
  let mostBirdies:          RawRec | null = null
  let mostParsRound:        RawRec | null = null
  let mostBogeys:           RawRec | null = null
  let mostDoubles:          RawRec | null = null
  let mostDoublePlus:       RawRec | null = null
  let biggestWin:           RawRec | null = null
  let bestQuota:            RawRec | null = null
  let mostStablefordPts:         RawRec | null = null
  let lowestCaptainsChoiceGross: RawRec | null = null
  let lowestCaptainsChoiceNet:   RawRec | null = null

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc) continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue

      const holeMap: Record<number, HoleData> = {}
      for (const h of course.holes) holeMap[h.number] = h

      const hdcps = playerHdcpsForRound(bundle.teams, rc, course)
      const cname = course.name

      // ── Captain's Choice: team score from teamHoleScores ─────────────────
      if (rc.format === 'captains_choice') {
        if (match.teamHoleScores) {
          const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
          const teamHdcp = Math.floor(allPids.reduce((s, pid) => s + (hdcps[pid] ?? 0), 0) * captainsChoicePct)
          let teamGross = 0, teamNet = 0, holes = 0, complete = true
          for (const hole of course.holes) {
            const s = match.teamHoleScores[hole.number]
            if (s == null) { complete = false; break }
            teamGross += s
            teamNet   += s - holeStrokes(teamHdcp, hole.hdcpOrder)
            holes++
          }
          if (complete && holes === 18) {
            const team = bundle.teams.find(t => t.players.some(p => match.twosome1.playerIds.includes(p.id)))
            const holder = team?.name ?? 'Unknown'
            if (!lowestCaptainsChoiceGross || teamGross < lowestCaptainsChoiceGross.value)
              lowestCaptainsChoiceGross = { value: teamGross, holder, year: bundle.year, courseName: cname, detail: `${teamNet} net · ${teamHdcp} team HDCP` }
            if (!lowestCaptainsChoiceNet || teamNet < lowestCaptainsChoiceNet.value)
              lowestCaptainsChoiceNet   = { value: teamNet,   holder, year: bundle.year, courseName: cname, detail: `${teamGross} gross · ${teamHdcp} team HDCP` }
          }
        }
        continue
      }

      // ── Per-player individual round records ───────────────────────────────
      for (const [pid, holeScores] of Object.entries(match.scores)) {
        let gross = 0, net = 0, holes = 0
        let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0, doublePlus = 0
        let stableford = 0

        for (const [hn, score] of Object.entries(holeScores)) {
          if (score == null) continue
          const hole = holeMap[parseInt(hn)]
          if (!hole) continue
          gross += score
          net   += score - holeStrokes(hdcps[pid] ?? 0, hole.hdcpOrder)
          holes++
          const cat = scoreCat(score, hole.par)
          if (cat === 'eagle')  eagles++
          if (cat === 'birdie') birdies++
          if (cat === 'par')    pars++
          if (cat === 'bogey')  bogeys++
          if (cat === 'double') doubles++
          if (cat === 'double' || cat === 'worse') doublePlus++
          if (rc.format === 'points_round') stableford += stablefordSimple(score, hole.par)
        }
        if (holes < 18) continue

        const name = playerName(pid)

        if (!lowestGross || gross < lowestGross.value)
          lowestGross   = { value: gross,      holder: name, year: bundle.year, courseName: cname, detail: `R${match.round}` }
        if (!lowestNet || net < lowestNet.value)
          lowestNet     = { value: net,        holder: name, year: bundle.year, courseName: cname, detail: `${gross} gross` }
        if (eagles > 0 && (!mostEagles || eagles > mostEagles.value))
          mostEagles    = { value: eagles,     holder: name, year: bundle.year, courseName: cname, detail: `${eagles} eagle(s) · ${gross} gross` }
        if (birdies > 0 && (!mostBirdies || birdies > mostBirdies.value))
          mostBirdies   = { value: birdies,    holder: name, year: bundle.year, courseName: cname, detail: `${birdies} birdies · ${gross} gross` }
        if (pars > 0 && (!mostParsRound || pars > mostParsRound.value))
          mostParsRound = { value: pars,       holder: name, year: bundle.year, courseName: cname, detail: `${pars} pars · ${gross} gross` }
        if (bogeys > 0 && (!mostBogeys || bogeys > mostBogeys.value))
          mostBogeys    = { value: bogeys,     holder: name, year: bundle.year, courseName: cname, detail: `${bogeys} bogeys · ${gross} gross` }
        if (doubles > 0 && (!mostDoubles || doubles > mostDoubles.value))
          mostDoubles   = { value: doubles,    holder: name, year: bundle.year, courseName: cname, detail: `${doubles} doubles · ${gross} gross` }
        if (doublePlus > 0 && (!mostDoublePlus || doublePlus > mostDoublePlus.value))
          mostDoublePlus = { value: doublePlus, holder: name, year: bundle.year, courseName: cname, detail: `${doublePlus} dbl+ · ${gross} gross` }
        if (rc.format === 'points_round' && stableford > 0 && (!mostStablefordPts || stableford > mostStablefordPts.value))
          mostStablefordPts = { value: stableford, holder: name, year: bundle.year, courseName: cname, detail: `${stableford % 1 === 0 ? stableford : stableford.toFixed(1)} pts · ${gross} gross` }
      }

      // ── Match play biggest win ─────────────────────────────────────────────
      if (rc.format === 'team_match_play' || rc.format === 'individual_match') {
        // Detect decision point: first hole where margin exceeds remaining holes.
        // Freeze the result there — play continues past that point for blind scoring.
        function decidedResult(holes: HoleData[], runFn: (hole: HoleData) => number | null) {
          let score = 0, played = 0
          let decidedMargin = 0, decidedRemaining = 0, hasDecision = false
          for (let hi = 0; hi < holes.length; hi++) {
            const delta = runFn(holes[hi])
            if (delta == null) continue
            score += delta
            played++
            if (!hasDecision) {
              const rem = holes.length - hi - 1
              if (Math.abs(score) > rem) {
                hasDecision = true
                decidedMargin = Math.abs(score)
                decidedRemaining = rem
              }
            }
          }
          if (played < 9 || score === 0) return null
          const margin    = hasDecision ? decidedMargin    : Math.abs(score)
          const remaining = hasDecision ? decidedRemaining : 18 - played
          const winLabel  = remaining === 0 ? `${margin} UP` : `${margin}&${remaining}`
          return { score, margin, winLabel }
        }

        const process1v1 = (pA: string, pB: string) => {
          const res = decidedResult(course.holes, hole => {
            const sa = match.scores[pA]?.[hole.number]
            const sb = match.scores[pB]?.[hole.number]
            if (sa == null || sb == null) return null
            const nA = sa - holeStrokes(hdcps[pA] ?? 0, hole.hdcpOrder)
            const nB = sb - holeStrokes(hdcps[pB] ?? 0, hole.hdcpOrder)
            return nA < nB ? 1 : nB < nA ? -1 : 0
          })
          if (!res) return
          const winner = res.score > 0 ? pA : pB
          const detail = `vs ${playerName(res.score > 0 ? pB : pA)} · ${res.winLabel}`
          if (!biggestWin || res.margin > biggestWin.value)
            biggestWin = { value: res.margin, holder: playerName(winner), year: bundle.year, courseName: cname, detail }
        }

        if (rc.format === 'individual_match') {
          process1v1(match.twosome1.playerIds[0], match.twosome2.playerIds[0])
          process1v1(match.twosome1.playerIds[1], match.twosome2.playerIds[1])
        } else {
          const [t1p1, t1p2] = match.twosome1.playerIds
          const [t2p1, t2p2] = match.twosome2.playerIds
          const res = decidedResult(course.holes, hole => {
            const s1a = match.scores[t1p1]?.[hole.number]
            const s1b = match.scores[t1p2]?.[hole.number]
            const s2a = match.scores[t2p1]?.[hole.number]
            const s2b = match.scores[t2p2]?.[hole.number]
            if (s1a == null || s1b == null || s2a == null || s2b == null) return null
            const n1 = Math.min(s1a - holeStrokes(hdcps[t1p1] ?? 0, hole.hdcpOrder),
                                s1b - holeStrokes(hdcps[t1p2] ?? 0, hole.hdcpOrder))
            const n2 = Math.min(s2a - holeStrokes(hdcps[t2p1] ?? 0, hole.hdcpOrder),
                                s2b - holeStrokes(hdcps[t2p2] ?? 0, hole.hdcpOrder))
            return n1 < n2 ? 1 : n2 < n1 ? -1 : 0
          })
          if (res) {
            const winners = res.score > 0 ? `${playerName(t1p1)}/${playerName(t1p2)}` : `${playerName(t2p1)}/${playerName(t2p2)}`
            const losers  = res.score > 0 ? `${playerName(t2p1)}/${playerName(t2p2)}` : `${playerName(t1p1)}/${playerName(t1p2)}`
            if (!biggestWin || res.margin > biggestWin.value)
              biggestWin = { value: res.margin, holder: winners, year: bundle.year, courseName: cname, detail: `vs ${losers} · ${res.winLabel}` }
          }
        }
      }

      // ── Points Round: quota beat + highest individual Stableford ──────────
      if (rc.format === 'points_round') {
        const coursePar = course.holes.reduce((s, h) => s + h.par, 0)
        for (const tw of [match.twosome1, match.twosome2]) {
          const [pa, pb] = tw.playerIds
          const quota = coursePar - (hdcps[pa] ?? 0) - (hdcps[pb] ?? 0)
          let pts = 0; let complete = true
          for (const hole of course.holes) {
            const sa = match.scores[pa]?.[hole.number]
            const sb = match.scores[pb]?.[hole.number]
            if (sa == null || sb == null) { complete = false; break }
            pts += stablefordSimple(sa, hole.par) + stablefordSimple(sb, hole.par)
          }
          if (!complete) continue
          const beat = pts - quota
          const name = `${playerName(pa)} / ${playerName(pb)}`
          if (!bestQuota || beat > bestQuota.value)
            bestQuota = { value: beat, holder: name, year: bundle.year, courseName: cname, detail: `${pts} pts vs Q:${quota}` }
        }
      }
    }
  }

  const fmt = (r: RawRec | null, prefix = ''): RecordEntry | null =>
    r ? { value: `${prefix}${r.value}`, holder: r.holder, year: r.year, courseName: r.courseName, detail: r.detail } : null

  return {
    lowestGross:          fmt(lowestGross),
    lowestNet:            fmt(lowestNet),
    mostEagles:           fmt(mostEagles),
    mostBirdies:          fmt(mostBirdies),
    mostParsRound:        fmt(mostParsRound),
    mostBogeys:           fmt(mostBogeys),
    mostDoubles:          fmt(mostDoubles),
    mostDoublePlus:       fmt(mostDoublePlus),
    biggestMatchWin:      biggestWin ? { value: biggestWin.detail?.split('·')[1]?.trim() ?? `${biggestWin.value} UP`, holder: biggestWin.holder, year: biggestWin.year, courseName: biggestWin.courseName, detail: biggestWin.detail } : null,
    bestQuotaBeat:        fmt(bestQuota, '+'),
    mostStablefordPts:         fmt(mostStablefordPts),
    lowestCaptainsChoiceGross: fmt(lowestCaptainsChoiceGross),
    lowestCaptainsChoiceNet:   fmt(lowestCaptainsChoiceNet),
  }
}

function stablefordSimple(gross: number, par: number): number {
  const d = par - gross
  if (d < -2) return 0
  if (d === -2) return 0.5
  if (d === -1) return 1
  if (d === 0)  return 2
  if (d === 1)  return 4
  if (d === 2)  return 6
  return 10
}

// ─── 8. Format-level player stats (match play wins, quota diffs) ─────────────

export interface PlayerFormatStat {
  playerId: string
  matchPlayRecord: { wins: number; losses: number; halves: number }   // R1 + R4
  indivRecord:     { wins: number; losses: number; halves: number }   // R4 only
  bestQuotaDiff:   number | null    // highest single-round pts - quota
  scrambleAvg:     number | null    // average scramble gross score per round
  scrambleRounds:  number
}

export function computePlayerFormatStats(
  bundles: YearBundle[],
  courses: CourseLike[],
  courseHistory: CourseLike[],
): Record<string, PlayerFormatStat> {
  const stats: Record<string, PlayerFormatStat> = {}

  function get(pid: string): PlayerFormatStat {
    if (!stats[pid]) stats[pid] = {
      playerId: pid,
      matchPlayRecord: { wins: 0, losses: 0, halves: 0 },
      indivRecord:     { wins: 0, losses: 0, halves: 0 },
      bestQuotaDiff:   null,
      scrambleAvg:     null,
      scrambleRounds:  0,
    }
    return stats[pid]
  }

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (!rc) continue
      const fmt = rc.format as RndFormat
      if (fmt !== 'individual_match' && fmt !== 'team_match_play' && fmt !== 'texas_scramble' && fmt !== 'points_round') continue

      const course = findCourse(rc.courseId, courses, courseHistory)
      if (!course?.holes?.length) continue
      const hdcps = playerHdcpsForRound(bundle.teams, rc, course)

      if (fmt === 'individual_match') {
        const pairs: [string, string][] = [
          [match.twosome1.playerIds[0], match.twosome2.playerIds[0]],
          [match.twosome1.playerIds[1], match.twosome2.playerIds[1]],
        ]
        for (const [pA, pB] of pairs) {
          let score = 0, played = 0
          for (const hole of course.holes) {
            const sa = match.scores[pA]?.[hole.number]
            const sb = match.scores[pB]?.[hole.number]
            if (sa == null || sb == null) continue
            const nA = sa - holeStrokes(hdcps[pA] ?? 0, hole.hdcpOrder)
            const nB = sb - holeStrokes(hdcps[pB] ?? 0, hole.hdcpOrder)
            if (nA < nB) score++; else if (nB < nA) score--
            played++
          }
          if (played < 9) continue
          for (const [pid, won] of [[pA, score > 0], [pB, score < 0]] as [string, boolean][]) {
            const st = get(pid)
            const tie = score === 0
            if (tie)      { st.indivRecord.halves++;     st.matchPlayRecord.halves++ }
            else if (won) { st.indivRecord.wins++;       st.matchPlayRecord.wins++ }
            else          { st.indivRecord.losses++;     st.matchPlayRecord.losses++ }
          }
        }
      }

      if (fmt === 'team_match_play') {
        const [t1p1, t1p2] = match.twosome1.playerIds
        const [t2p1, t2p2] = match.twosome2.playerIds
        let score = 0, played = 0
        for (const hole of course.holes) {
          const s1a = match.scores[t1p1]?.[hole.number]
          const s1b = match.scores[t1p2]?.[hole.number]
          const s2a = match.scores[t2p1]?.[hole.number]
          const s2b = match.scores[t2p2]?.[hole.number]
          if (s1a == null || s1b == null || s2a == null || s2b == null) continue
          const n1 = Math.min(s1a - holeStrokes(hdcps[t1p1] ?? 0, hole.hdcpOrder),
                              s1b - holeStrokes(hdcps[t1p2] ?? 0, hole.hdcpOrder))
          const n2 = Math.min(s2a - holeStrokes(hdcps[t2p1] ?? 0, hole.hdcpOrder),
                              s2b - holeStrokes(hdcps[t2p2] ?? 0, hole.hdcpOrder))
          if (n1 < n2) score++; else if (n2 < n1) score--
          played++
        }
        if (played < 9) continue
        for (const pid of [t1p1, t1p2]) {
          const st = get(pid)
          const won = score > 0, tie = score === 0
          if (tie)      st.matchPlayRecord.halves++
          else if (won) st.matchPlayRecord.wins++
          else          st.matchPlayRecord.losses++
        }
        for (const pid of [t2p1, t2p2]) {
          const st = get(pid)
          const won = score < 0, tie = score === 0
          if (tie)      st.matchPlayRecord.halves++
          else if (won) st.matchPlayRecord.wins++
          else          st.matchPlayRecord.losses++
        }
      }

      if (fmt === 'texas_scramble') {
        const allPids = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
        // Aggregate total scramble score (gross) for the team
        let teamGross = 0, complete = true
        for (const hole of course.holes) {
          // Pick the best gross score (ball count simplified to 1 for avg)
          let best: number | null = null
          for (const pid of allPids) {
            const s = match.scores[pid]?.[hole.number]
            if (s != null && (best === null || s < best)) best = s
          }
          if (best === null) { complete = false; break }
          teamGross += best
        }
        if (complete) {
          for (const pid of allPids) {
            const st = get(pid)
            const prev = st.scrambleAvg ?? 0
            const n = st.scrambleRounds
            st.scrambleAvg = (prev * n + teamGross) / (n + 1)
            st.scrambleRounds++
          }
        }
      }

      if (fmt === 'points_round') {
        const coursePar = course.holes.reduce((s, h) => s + h.par, 0)
        for (const tw of [match.twosome1, match.twosome2]) {
          const [pa, pb] = tw.playerIds
          const quota = coursePar - (hdcps[pa] ?? 0) - (hdcps[pb] ?? 0)
          let pts = 0; let complete = true
          for (const hole of course.holes) {
            const sa = match.scores[pa]?.[hole.number]
            const sb = match.scores[pb]?.[hole.number]
            if (sa == null || sb == null) { complete = false; break }
            pts += stablefordSimple(sa, hole.par) + stablefordSimple(sb, hole.par)
          }
          if (!complete) continue
          const diff = pts - quota
          for (const pid of [pa, pb]) {
            const st = get(pid)
            if (st.bestQuotaDiff === null || diff > st.bestQuotaDiff) st.bestQuotaDiff = diff
          }
        }
      }
    }
  }

  return stats
}

// ─── Shot Stats ──────────────────────────────────────────────────────────────

export interface ShotStatDirs {
  left: number
  right: number
  long: number
  short: number
}

export interface PlayerShotStats {
  playerId: string
  fwAttempts: number
  fwHit: number
  fwMissDir: ShotStatDirs
  girAttempts: number
  girHit: number
  girMissDir: ShotStatDirs
  puttsTotal: number
  puttsHoles: number
}

const EXCLUDED_SHOT_STAT_FORMATS = new Set(['texas_scramble', 'captains_choice'])

export function computeShotStats(bundles: YearBundle[]): PlayerShotStats[] {
  const map = new Map<string, PlayerShotStats>()

  const getEntry = (pid: string): PlayerShotStats => {
    if (!map.has(pid)) {
      map.set(pid, {
        playerId: pid,
        fwAttempts: 0, fwHit: 0, fwMissDir: { left: 0, right: 0, long: 0, short: 0 },
        girAttempts: 0, girHit: 0, girMissDir: { left: 0, right: 0, long: 0, short: 0 },
        puttsTotal: 0, puttsHoles: 0,
      })
    }
    return map.get(pid)!
  }

  for (const bundle of bundles) {
    for (const match of bundle.matches) {
      if (match.isBlind) continue
      const rc = bundle.roundConfigs.find(r => r.round === match.round)
      if (rc && EXCLUDED_SHOT_STAT_FORMATS.has(rc.format)) continue
      if (!match.shotStats) continue

      for (const [pid, holeStats] of Object.entries(match.shotStats)) {
        const st = getEntry(pid)
        for (const stat of Object.values(holeStats)) {
          // fairway: null = par 3 N/A, undefined = not recorded
          if (stat.fairway !== undefined && stat.fairway !== null) {
            st.fwAttempts++
            if (stat.fairway === 'hit') {
              st.fwHit++
            } else {
              st.fwMissDir[stat.fairway as Exclude<ShotDirection, 'hit'>]++
            }
          }
          if (stat.gir !== undefined && stat.gir !== null) {
            st.girAttempts++
            if (stat.gir === 'hit') {
              st.girHit++
            } else {
              st.girMissDir[stat.gir as Exclude<ShotDirection, 'hit'>]++
            }
          }
          if (stat.putts !== undefined) {
            st.puttsTotal += stat.putts
            st.puttsHoles++
          }
        }
      }
    }
  }

  return Array.from(map.values())
}
