export interface Player {
  id: string
  name: string
  ghinNumber?: string
  handicapIndex: number
  hdcpLocked: boolean
  hdcp2009gross?: number // used for Round 2 quota
  courseHdcpOverrides?: Record<string, number> // courseId -> override value
  isSubstitute?: boolean
  originalName?: string
  originalHandicapIndex?: number
  isPermanentReplacement?: boolean
  replacedPlayerName?: string
}

export interface Team {
  id: string
  name: string
  color: string
  players: Player[]
}

export interface HoleData {
  number: number
  par: number
  hdcpOrder: number
  yardages: Record<string, number>
}

export interface CourseTee {
  name: string
  rating?: number
  slope?: number
  totalYards?: number  // pre-stored total when per-hole data unavailable
}

export interface Course {
  id: string
  name: string
  par: number
  website?: string
  tees: CourseTee[]
  holes: HoleData[]
  imageData?: string        // base64 uploaded hero photo
  scorecardImageData?: string  // base64 uploaded scorecard
}

export type RoundFormat =
  | 'team_match_play'
  | 'points_round'
  | 'texas_scramble'
  | 'individual_match'
  | 'captains_choice'

export interface RoundConfig {
  round: 1 | 2 | 3 | 4 | 5
  format: RoundFormat
  label: string
  courseId: string
  tee: string
  date?: string
  teeTimes?: [string, string, string]  // Match A, B, C tee times
}

export interface Twosome {
  teamId: string
  playerIds: [string, string]
}

export interface Match {
  id: string
  round: number
  label: string
  isBlind: boolean
  twosome1: Twosome
  twosome2: Twosome
  scores: Record<string, Record<number, number | null>> // playerId -> hole# -> gross
  result?: string       // optional free-text result
  magicBall1?: boolean  // twosome1 finished with Magic Ball (Round 2 non-blind only)
  magicBall2?: boolean  // twosome2 finished with Magic Ball
  teeShotsUsed?: Record<number, string>        // hole# -> playerId (Round 5: whose tee shot was used)
  teamHoleScores?: Record<number, number | null> // hole# -> gross team score (Round 5)
}

export interface TeamRoundScore {
  teamId: string
  round: number
  points: number
  notes?: string
}

export interface HoleInOneEntry {
  id: string
  year: number
  playerName: string
  course: string
  hole: number
  yardage?: number
  date: string
  notes: string
  photoData?: string    // base64 uploaded champion photo
  potClaimed?: number   // pot amount at time of claim (undefined = no pot claimed)
}

export interface HioDonation {
  id: string
  year: number
  playerName: string
  paid: boolean
  amount: number        // default $20
  claimedByHioId?: string  // set when this donation was part of a claimed pot
}

export interface CtpEntry {
  id: string
  year: number
  round: number
  hole: number
  courseName: string
  yardage?: number
  winnerName?: string
  winnerPaid?: boolean
  donatedToHio?: boolean
  hioDonationAmount?: number
}

export interface CtpDonation {
  id: string
  year: number
  playerName: string
  amount: number   // par3Count × $1
  paid: boolean
}

export interface ArchivedYear {
  year: number
  finalizedAt: string
  teams: Team[]
  roundConfigs: RoundConfig[]
  matches: Match[]
  teamScores: TeamRoundScore[]
  hdcpLocked: boolean
}

export interface TournamentState {
  year: number
  liveYear: number
  archivedYears: ArchivedYear[]
  isViewingHistory: boolean
  liveCache: Omit<ArchivedYear, 'finalizedAt'> | null
  teams: Team[]
  courses: Course[]
  roundConfigs: RoundConfig[]
  matches: Match[]
  teamScores: TeamRoundScore[]
  holeInOnes: HoleInOneEntry[]
  ctpEntries: CtpEntry[]
  ctpDonations: CtpDonation[]
  ctpHioHistory: { year: number; amount: number }[]
  hdcpLocked: boolean
  courseHistory: CourseHistoryEntry[]
  admins: AdminCredential[]
  pairingsLocked: boolean
  hioDonations: HioDonation[]
  skidmoreScores: SkidmoreScore[]
}

export interface CourseHistoryRound {
  id: string
  year: number
  round?: 1 | 2 | 3 | 4 | 5
  date?: string
  notes?: string
}

export interface CourseHistoryEntry {
  id: string
  name: string
  location?: string
  par?: number
  website?: string
  imageUrl?: string
  imageData?: string        // base64 for uploaded images
  imageContain?: boolean    // true for logos/non-landscape images
  tees?: CourseTee[]
  holes?: HoleData[]        // per-hole par and HDCP order (no yardages)
  scorecardUrl?: string
  scorecardImageData?: string
  notes?: string
  playedRounds: CourseHistoryRound[]
}

export interface AdminCredential {
  username: string
  passwordHash: string
  role?: 'admin' | 'scorer'
}

export interface SkidmoreScore {
  id: string
  date: string        // YYYY-MM-DD
  course: string
  rating: number
  slope: number
  score: number       // adjusted gross score
  notes?: string
}
