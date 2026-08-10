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
  originalGhinNumber?: string
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
  | 'vegas'

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
  playerId?: string     // player.id from roster; enables name resolution when sub is active
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
  playerId?: string   // player.id from roster; enables name resolution when sub is active
  amount: number      // par3Count × $1
  paid: boolean
}

export interface LodgingUnit {
  teamId: string
  label: string          // "Villa 1615", "East Wing", "The House"
  building?: string      // "Bldg #6" — omit for single-property years
  checkin: string        // "Thu, Aug 27"
  checkout: string       // "Sun, Aug 30"
  nights: number
  earlyArrival?: boolean
}

export interface LodgingConfig {
  propertyName: string   // "Talamore Golf Resort"
  address: string        // full address for Google Maps link
  websiteUrl?: string
  description?: string   // shown in the info card on the Lodging page
  units: LodgingUnit[]   // one per team; all same label for single-house years
}

export interface ArchivedYear {
  year: number
  finalizedAt: string
  teams: Team[]
  roundConfigs: RoundConfig[]
  matches: Match[]
  teamScores: TeamRoundScore[]
  hdcpLocked: boolean
  lodgingConfig?: LodgingConfig
}

export interface GameConfig {
  texasScrambleHdcpPct: number      // default 0.6
  captainsChoiceHdcpPct: number     // default 0.15
  captainsChoiceMinTeeBalls: number // default 3 (0 = no minimum)
  enableBlinds: boolean             // affects new pairing generation
  enableMagicBall: boolean          // default true
  stablefordAlbatross: number       // default 10
  stablefordEagle: number           // default 6
  stablefordBirdie: number          // default 4
  stablefordPar: number             // default 2
  stablefordBogey: number           // default 1
  stablefordDouble: number          // default 0.5
  regularMatchPts: number           // default 2
  blindMatchPts: number             // default 1
  teamFinish1stPts: number          // default 4
  teamFinish2ndPts: number          // default 2
  teamFinish3rdPts: number          // default 1
  vegasBirdieMultiplier: number     // default 2
  vegasEagleMultiplier: number      // default 3
  vegasAlbatrossMultiplier: number  // default 4
  vegasRegularMatchPts: number      // default 2
  vegasBlindMatchPts: number        // default 1
  vegasEnableBlinds: boolean        // default true
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
  lockedRounds: number[]
  ctpTeamIds?: Record<number, string>
  hioDonations: HioDonation[]
  skidmoreScores: SkidmoreScore[]
  sandbaggerPlayerId?: string
  toiletAwardPlayerId?: string
  defendingChampionTeamId?: string
  gameConfig: GameConfig
  location?: string
  lodgingConfig?: LodgingConfig
  sideBets?: SideBet[]
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
  role?: 'admin' | 'scorer' | 'player'
  canScore?: boolean              // player with scorer rights
  isDefaultPassword?: boolean     // true until player changes their password
  mustChangePassword?: boolean    // forced change on next login
  playerId?: string               // roster Player.id this account is linked to
  subForPlayerId?: string         // if isSubAccount: the slot player.id being subbed
  isSubAccount?: boolean          // true for temporary sub accounts
  displayName?: string            // friendly name (player's full name)
}

export const MB_CATEGORIES = ['General', 'Golf Talk', 'Trip Planning', 'Photos', 'Off-Season'] as const
export type MbCategory = typeof MB_CATEGORIES[number]

export interface MbThread {
  id: string
  year: number
  category: string
  title: string
  author: string
  created_at: string
  last_reply_at: string
  reply_count: number
  is_pinned: boolean
  is_locked: boolean
}

export interface MbPost {
  id: string
  thread_id: string
  year: number
  is_op: boolean
  author: string
  body: string
  created_at: string
  edited_at: string | null
  is_deleted: boolean
  image_urls: string[] | null
}

export const MB_REACTION_EMOJIS = ['👍', '👎', '🏌️', '⛳', '🏆', '😂', '🔥', '🎉', '😎', '🤦', '💪', '🍺'] as const

export interface MbReaction {
  id: string
  thread_id: string
  post_id: string
  author: string
  emoji: string
  created_at: string
}

export interface SkidmoreScore {
  id: string
  date: string        // YYYY-MM-DD
  course: string
  rating: number      // 9-hole or 18-hole course rating to match holes played
  slope: number       // 9-hole or 18-hole slope to match holes played
  score: number       // adjusted gross score
  holes?: 9 | 18      // defaults to 18 when absent
  hdcpAtTime?: number // WHS 2024: Handicap Index when the 9-hole round was played
  notes?: string
}

// ── Side Bets ──────────────────────────────────────────────────────────────

export type SideBetFormat =
  | 'nassau'
  | 'skins'
  | 'match_money'
  | 'stroke_play'
  | 'wolf'
  | 'gruesomes'
  | 'vegas_side'
  | 'dots'
  | 'bingo_bango_bongo'

export interface SideBetParticipant {
  playerId: string
  playerName: string
  teamId: string
  side: 'A' | 'B'
}

export interface NassauConfig {
  front9: number
  back9: number
  overall: number
  autoPress: boolean       // auto-triggers at 2-down
  allowManualPress: boolean // either side can declare a press at any time
  pressAmount?: number
}

export interface ManualPress {
  startHole: number        // first hole of the press bet
  declaredAt: string       // ISO timestamp
  declaredBy: string       // username
}

export interface SkinsConfig {
  amountPerSkin: number
  carryover: boolean
  individualMode?: boolean   // all 4 players compete individually (vs 2-side team mode)
}

export interface MatchMoneyConfig {
  amountPerHole: number
}

export interface StrokePlayConfig {
  front9: number
  back9: number
  overall: number
  useNet: boolean
}

export interface DotsConfig {
  amountPerDot: number
  birdie: boolean
  eagle: boolean
  sandy: boolean
  greenie: boolean
  ferret: boolean
  poley: boolean
  barky: boolean
  customDots: string[]
}

export interface BingoBangoBongoConfig {
  amountPerPoint: number
}

export interface WolfConfig {
  baseAmountPerHole: number
  wolfAloneMultiplier: number
}

export interface GroesomesConfig {
  amountPerHole: number
}

export interface VegasSideConfig {
  amountPerHole: number
  birdieMultiplier: number
  eagleMultiplier: number
}

export type SideBetConfig =
  | NassauConfig
  | SkinsConfig
  | MatchMoneyConfig
  | StrokePlayConfig
  | DotsConfig
  | BingoBangoBongoConfig
  | WolfConfig
  | GroesomesConfig
  | VegasSideConfig

export interface SideBetHoleEntry {
  hole: number
  dots?: Record<string, string[]>            // playerId -> dot types earned
  bbb?: { bingo: string; bango: string; bongo: string }  // playerIds for each point
  wolfChoice?: { wolfId: string; partnerId?: string; alone: boolean }
  wolfWinnerSide?: 'A' | 'B' | null
  gruesomesChoice?: { sideAForcedId: string; sideBForcedId: string }
  notes?: string
}

export interface SideBet {
  id: string
  year: number
  matchId: string
  round: number
  format: SideBetFormat
  participants: SideBetParticipant[]         // 2 or 4
  config: SideBetConfig
  holes: SideBetHoleEntry[]                  // empty for auto-computed formats
  createdBy: string
  createdAt: string
  status: 'pending' | 'active' | 'complete' | 'cancelled'
  settledAt?: string
  notes?: string
  manualPresses?: ManualPress[]
}
