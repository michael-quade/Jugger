# Jugger 2026 — Juggerknocker Invitational Golf Trip

## Tournament Overview

**3 teams of 4 golfers** compete across **5 rounds** over one trip to Pinehurst, NC. Rounds are played Thursday afternoon through Saturday afternoon across 4 courses.

| Team | Color | Players |
|---|---|---|
| Billy Baroo | Blue `#2563EB` | Michael Quade (13.7), Nick Whitman (15.4), Nate Butterworth (12.9), Bryan Holcomb (16.9) |
| #ballgame | Red `#DC2626` | Ron Pitts (11.5), Daniel Gunter (18.7), John Oxford (9.1), Chris Oncavage (8.0) |
| Silverbacks | Green `#059669` | Danny Woyahn (8.1), Matt Skidmore (28.5), Chad Bender (7.0), Hunter Morris (7.2) |

---

## Rounds & Courses

| Round | Course | Format | Date | Notes |
|---|---|---|---|---|
| 1 | Pine Needles (Ross tees) | Team Match Play | Thu PM | 13:30/13:40/13:50 |
| 2 | Pinewild Magnolia (White tees) | Points Round | Fri AM | 08:24/08:33/08:42 |
| 3 | Pinewild Holly (Blue tees) | Texas Scramble | Fri PM | 13:48/13:57/14:06 |
| 4 | Mid South (Blue tees) | Individual Match Play | Sat AM | 08:05/08:15/08:25 |
| 5 | Mid South (Blue tees) | Captain's Choice | Sat PM | 13:40/13:50/14:00 |

### Course Ratings & Slopes

| Course | Par | Rating/Slope (played tees) |
|---|---|---|
| Pine Needles | 71 | 71.9 / 138 (Ross) |
| Pinewild Magnolia | 72 | 70.9 / 127 (White) |
| Pinewild Holly | 72 | 71.2 / 127 (Blue) |
| Mid South | 72 | 72.1 / 139 (Blue) |

---

## Scoring Formats

### Round 1 — Team Match Play
Two-on-two best-ball match play. Each twosome takes its **best NET score** per hole. Most holes won wins the match.
- Regular match: **2 pts** · Blind match: **1 pt**
- Tied match: 1 pt each (regular), ½ pt each (blind)

### Round 2 — Points Round (Stableford)
Each player earns **gross Stableford points** every hole. Goal: accumulate twosome points at or above the combined Quota.
- **Twosome Quota = course par − (HDCP_A + HDCP_B)**. Example: par 72, HDCPs 10+10 → Quota = 52
- Albatross = 10 · Eagle = 6 · Birdie = 4 · Par = 2 · Bogey = 1 · Double Bogey = ½ · Worse = 0
- Regular match: **2 pts** · Blind match: **1 pt**
- **Magic Ball**: special ball assigned to each twosome; players alternate using it for entire holes (Player A uses it on hole 1, Player B on hole 2, etc.). Twosome still holding it at finish earns **+1 pt**
- All point values and quota formula configurable via Round Games page

### Round 3 — Texas Scramble
All 4 players tee off; pick best drive; all play from there. **60% of course HDCP** (configurable). Ball count rules:
- Holes 1–6: best 1 ball · Holes 7–12: best 2 balls · Holes 13–15: best 3 balls · Holes 16–18: best 4 balls
- Finish: 1st = **4 pts** · 2nd = **2 pts** · 3rd = **1 pt** (configurable)

### Round 4 — Individual Match Play
Each player plays their own ball, NET scoring.
- Each individual 1v1: **1 pt** · Each 2v2 twosome best-ball sub-match: **1 pt** · Blind: **½ pt**

### Round 5 — Captain's Choice
Team captain picks the shot. HDCP = `floor(team aggregate × 15%)` (configurable). Min **3 tee balls** per player across 18 holes (configurable).
- Finish: 1st = **4 pts** · 2nd = **2 pts** · 3rd = **1 pt** (configurable)

### Vegas (optional format)
Two-on-two format where each twosome combines their NET scores into a two-digit number (lower score first) forming the hole score. Lower combined number wins the hole.
- Birdie multiplier (default ×2), Eagle multiplier (×3), Albatross (×4) — applied when any player makes that score
- Regular match: **2 pts** · Blind match: **1 pt** (configurable)
- All parameters configurable via Round Games page

---

## Handicap System

### Formula
```
Course HDCP = round(Handicap Index × (Slope / 113) + (Course Rating − Par))
```

### Netting (used for all formats)
Players net against the lowest Course HDCP in the field. Netted HDCP = player raw − minimum raw.

### Over-18 Cap
If netted HDCP > 18: `18 + 0.5 × (netted − 18)`

### Format-based percentages
Handicap percentages are keyed to **format type**, not round number. Defaults configurable via Round Games page.

| Format | Default % | Notes |
|---|---|---|
| `team_match_play` | 100% | Full netted+capped HDCP |
| `points_round` | 100% (quota-based) | Twosome quota = course par − (HDCP_A + HDCP_B) |
| `texas_scramble` | 60% | Applied after netting+capping |
| `individual_match` | 100% | Full netted+capped HDCP |
| `captains_choice` | 15% of team sum | `floor(Σ individual HDCPs × pct)` |

### Handicap Module Singleton (`utils/handicap.ts`)
Module-level vars (`_scramblePct`, `_captainsChoicePct`, `_stableford`) are updated by a Zustand store subscriber whenever `gameConfig` changes. All handicap/scoring functions read these vars at call time — no threading of config through callers needed.
- `configureHdcpSettings(config)` — called by store on load + every gameConfig change
- `getScramblePct()` / `getCaptainsChoicePct()` — read current values (used in ScorecardCard labels)

---

## Pairing Rules

- Each twosome plays exactly 2 matches per round: 1 regular + 1 blind
- A twosome never plays the same opposing team twice in the same round
- Blind matches are ideally against a different team than the regular match
- Generation enforces partner rotation and minimizes opponent repeats across rounds
- Fixed matrix (teams randomly assigned as T1/T2/T3 each round, then split into twosomes A/B):
  - Regular A: T1A vs T2A · Regular B: T1B vs T3A · Regular C: T2B vs T3B
  - Blind 1: T3B vs T1A · Blind 2: T2A vs T3A · Blind 3: T2B vs T1B
- R3 and R5 (team formats): one match per team (all 4 players together), no blinds

---

## Web Application

Lives in `jugger-app/`. Deployed to **`https://juggerknockerinvitational.com`** via GitHub Pages with custom domain.

### Quick Start

```bash
cd jugger-app
npm install
npm run dev      # http://localhost:5173/
npm run build    # production build → dist/
```

### Tech Stack

| Library | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.3 | Build tool, `base: '/'` (custom domain) |
| React Router DOM | 6.24 | Client-side routing (HashRouter) |
| Zustand | 4.5.4 | State management + localStorage persistence |
| Tailwind CSS | 3.4 | Styling (Masters tournament theme) |
| Supabase JS | 2.107 | Real-time database sync |
| react-to-print | 2.15 | Print scorecard layout |
| recharts | 3.8 | Handicap history charts |
| lucide-react | 0.395 | Icons |

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) triggers on push to `master`:
1. `npm ci` + `npm run build` with Supabase secrets injected
2. `dist/` uploaded to GitHub Pages; `public/CNAME` sets `juggerknockerinvitational.com`

**Action versions (Node 24-native):** `actions/checkout@v6`, `actions/setup-node@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`. Build uses Node 22. Runner opts into Node 24 via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`.

Required GitHub secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Local dev: `.env.local` (gitignored) with the same two vars.

`index.html` includes `Cache-Control: no-cache, no-store, must-revalidate` meta tags (browser hints for stale-cache mitigation on iOS Safari; Vite content-hashes all JS/CSS so only `index.html` itself is at risk of being served stale by the browser).

---

## Project Structure

```
jugger-app/src/
  App.tsx                       # Router setup, default admin bootstrap, Supabase init
  main.tsx                      # ReactDOM.createRoot, HashRouter
  index.css                     # Tailwind + custom component styles
  types/index.ts                # All TypeScript interfaces
  store/
    useTournamentStore.ts       # Zustand store v25 (all state + actions)
    useAuthStore.ts             # Auth state (admin/scorer/treasurer login)
  lib/supabase.ts               # Supabase client init (null if env vars absent)
  hooks/useSupabaseSync.ts      # Real-time sync hook + useSyncStatus
  utils/
    auth.ts                     # SHA-256 password hash/verify (Web Crypto API)
    handicap.ts                 # Course HDCP formulas, stroke dots, Stableford;
                                #   module-level config singleton updated by store
    matchplay.ts                # Per-format scoring computation
    pairings.ts                 # Match generation + lookup helpers
    champion.ts                 # Tournament champion detection + Ryder Cup tiebreaker
  data/
    courseData.ts               # 4 courses (holes, pars, yardages, tees) + ROUND_CONFIGS
    initialData.ts              # INITIAL_TEAMS, INITIAL_COURSE_HISTORY, donations,
                                #   INITIAL_SKIDMORE_SCORES (18 historical rounds)
    hdcpHistory.ts              # Static HDCP history 2006–2025; Analytics merges with
                                #   archivedYears dynamically for 2026+
    analytics.ts                # Historical data computation: scoring profiles, H2H,
                                #   partner records, team results, format/course stats,
                                #   records, player format breakdowns; YearBundle type
  components/
    Layout.tsx                  # Sticky chrome (header + nav + history banner in one
                                #   sticky wrapper), Outlet
    ScorecardCard.tsx           # Per-format scorecard display + score entry;
                                #   reads gameConfig from store for dynamic labels
    AdminPanel.tsx              # Admin/scorer account management modal
    HeaderAdminWidget.tsx       # Header login/logout widget
  pages/
    Dashboard.tsx               # Overview: champion hero, standings, schedule, rosters,
                                #   award thumbnails, defending champs, finalize
    Teams.tsx                   # Roster editing, substitute/permanent replacement,
                                #   HDCP table, award images, defending champs badge
    Schedule.tsx                # Round dates, tee times, format selector
    Pairings.tsx                # Match generation + manual editing (admin only)
    ScorecardView.tsx           # Score entry UI, per-round simulate, auto team scores;
                                #   RoundInfoBanner reads live gameConfig;
                                #   "Score Hole-by-Hole" button (mobile, all users) links to MobileScoring
    MobileScoring.tsx           # Full-screen per-hole mobile scoring page (all users can view;
                                #   scorers/admins can edit); route outside Layout wrapper
    SideBets.tsx                # Player/admin side bets: list, status badges, settlement display
    SideBetCreate.tsx           # Create a new side bet (player/admin)
    SideBetDetail.tsx           # Per-bet detail: participants, stake, settlement result
    MessageBoard.tsx            # Supabase-backed discussion board (threads list; player+admin access)
    MessageBoardThread.tsx      # Single thread view with replies, photos, emoji reactions
    Courses.tsx                 # Active-year courses only (from roundConfigs); hole data
    RoundGames.tsx              # Game format rules + configurable house parameters;
                                #   visible to all — admin edits, guests/scorers read-only
    Lodging.tsx                 # Trip lodging details: property info, team unit assignments,
                                #   annotated resort map, amenities, PDF documents;
                                #   admin-configurable via LodgingConfig in store
    Results.tsx                 # Editable team standings table
    CtpPage.tsx                 # Par 3 CTP pot management
    HoleInOne.tsx               # HIO champion tracking + pot management
    Analytics.tsx               # 8-tab historical data explorer (replaces Stats page)
    FileArchive.tsx             # Supabase Storage file browser
    CourseHistory.tsx           # Course database — primary course add/edit/delete;
                                #   assign to tournament round (admin)
    PrintAll.tsx                # Batch print all scorecards (2/page)
    SkidmoreHdcp.tsx            # WHS handicap tracker for Matt Skidmore (admin only)
```

### Public Assets
- `sandbagger.jpg` — Sandbagger Award image (shown next to award winner's name)
- `toilet_award.webp` — Toilet Award image (shown next to award winner's name)
- `Juggerknocker Invitational logo.png` — Tournament logo (header)
- `talamore-map.jpg` — Talamore Villas & Drives Layout map (used on Lodging page with SVG overlay)
- `2026 lodging.pdf` — Booking confirmation PDF
- `CHECK IN AND RESORT INFORMATION.pdf` — Resort check-in instructions
- `RULES AND REGULATIONS.pdf` — Resort rules document

---

## TypeScript Types (`types/index.ts`)

```typescript
Player {
  id: string
  name: string
  ghinNumber?: string
  handicapIndex: number
  hdcpLocked: boolean
  hdcp2009gross?: number          // Round 2 quota base
  courseHdcpOverrides?: Record<string, number>   // courseId → override
  isSubstitute?: boolean          // single-year sub; reverts after finalizeYear
  originalName?: string           // original player name when subbed out
  originalHandicapIndex?: number  // original HDCP when subbed out
  originalGhinNumber?: string     // original GHIN when subbed out; restored on revert
  isPermanentReplacement?: boolean // permanent roster change; kept after finalizeYear
  replacedPlayerName?: string     // name of the player they replaced
}

Team { id, name, color, players: Player[] }

HoleData { number, par, hdcpOrder, yardages: Record<teeName, number> }
CourseTee { name, rating?, slope?, totalYards? }
Course { id, name, par, website?, tees: CourseTee[], holes: HoleData[] }

RoundFormat = 'team_match_play' | 'points_round' | 'texas_scramble'
            | 'individual_match' | 'captains_choice' | 'vegas'

RoundConfig {
  round: 1|2|3|4|5
  format: RoundFormat
  label: string
  courseId: string
  tee: string
  date?: string                   // YYYY-MM-DD
  teeTimes?: [string, string, string]  // HH:MM for Match A/B/C
}

Twosome { teamId: string; playerIds: [string, string] }

Match {
  id: string                      // e.g. '1a', '1blind2', '3-team-id'
  round: number
  label: string                   // 'Match A', 'Blind 1', team name (R3/R5)
  isBlind: boolean
  twosome1: Twosome
  twosome2: Twosome
  scores: Record<playerId, Record<holeNumber, number | null>>
  result?: string                 // free-text result note
  magicBall1?: boolean            // R2 only
  magicBall2?: boolean            // R2 only
  teeShotsUsed?: Record<holeNumber, playerId>   // R5 only
  teamHoleScores?: Record<holeNumber, number | null>  // R5 only
}

TeamRoundScore { teamId, round, points, notes? }

HoleInOneEntry {
  id, year, playerName, course, hole, yardage?, date, notes
  photoData?: string              // base64
  potClaimed?: number             // pot amount at time of claim
}

HioDonation {
  id, year, playerName, paid, amount, claimedByHioId?
  playerId?: string   // player.id from roster; enables sub name resolution
}

CtpEntry {
  id, year, round, hole, courseName, yardage?
  winnerName?, winnerPaid?, donatedToHio?, hioDonationAmount?
}
CtpDonation {
  id, year, playerName, amount, paid
  playerId?: string   // player.id from roster; enables sub name resolution
}

LodgingUnit {
  teamId: string
  label: string          // "Villa 1615", "East Wing", "The House"
  building?: string      // "Bldg #6" — omit for single-property years
  checkin: string        // "Thu, Aug 27"
  checkout: string       // "Sun, Aug 30"
  nights: number
  earlyArrival?: boolean
}

LodgingConfig {
  propertyName: string   // "Talamore Golf Resort"
  address: string        // full address for Google Maps link
  websiteUrl?: string
  description?: string   // shown in the info card on the Lodging page
  units: LodgingUnit[]   // one per team; all same label for single-house years
}

SkidmoreScore {
  id: string
  date: string                    // YYYY-MM-DD
  course: string
  rating: number                  // 9-hole or 18-hole course rating
  slope: number                   // 9-hole or 18-hole slope
  score: number                   // adjusted gross score
  holes?: 9 | 18                  // defaults to 18
  hdcpAtTime?: number             // WHS 2024: Handicap Index when 9-hole round was played
  notes?: string
}

GameConfig {
  texasScrambleHdcpPct: number      // default 0.6
  captainsChoiceHdcpPct: number     // default 0.15
  captainsChoiceMinTeeBalls: number // default 3 (0 = no minimum)
  enableBlinds: boolean             // default true; affects new pairing generation
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

ArchivedYear {
  year, finalizedAt: string
  teams, roundConfigs, matches, teamScores, hdcpLocked
  lodgingConfig?: LodgingConfig
}

TournamentState {
  year: number                    // current tournament year
  liveYear: number                // the live (non-archived) year
  archivedYears: ArchivedYear[]
  isViewingHistory: boolean
  liveCache: Omit<ArchivedYear, 'finalizedAt'> | null
  teams, courses, roundConfigs, matches, teamScores
  holeInOnes, ctpEntries, ctpDonations, ctpHioHistory
  hdcpLocked, courseHistory, admins, pairingsLocked, lockedRounds: number[], hioDonations
  skidmoreScores: SkidmoreScore[]
  sandbaggerPlayerId?: string       // player id holding Sandbagger Award
  toiletAwardPlayerId?: string      // player id holding Toilet Award
  defendingChampionTeamId?: string  // team id of prior year's champion
  gameConfig: GameConfig            // house rules; wired into scoring calculations
  location?: string                 // trip destination (e.g. 'Pinehurst, NC'); shown in header
  lodgingConfig?: LodgingConfig     // admin-configurable; shown on Lodging page
  ctpTeamIds?: Record<number, string>  // round → teamId; which team goes last in R3/R5 CTP entry; synced via Supabase
}

AdminCredential {
  username, passwordHash
  role?: 'admin' | 'scorer' | 'player' | 'treasurer'
  canScore?: boolean      // player-role accounts with scorer rights
  canTreasure?: boolean   // player-role accounts with treasurer rights (mark payments paid)
  displayName?: string    // friendly name shown in account management
  isSubAccount?: boolean  // true for player accounts created from sub roster entries
  isDefaultPassword?: boolean  // true until player changes their password
  mustChangePassword?: boolean // force password change on next login
}
```

---

## State Management

### Zustand Store (`useTournamentStore`) — version 25

Persists to `localStorage` key `jugger-tournament-2026`. All 25 versions have migration functions.

**Key actions:**
- `setYear / lockHandicaps / setPairingsLocked / lockRound(round) / unlockRound(round)`
- `updatePlayer / addPlayer / removePlayer / updateTeamName / updateTeamColor`
- `substitutePlayer` — replaces a player with a single-year sub (reverts on `finalizeYear`)
- `revertSubstitute` — restores original player before finalization
- `permanentlyReplacePlayer` — replaces a player permanently (kept after `finalizeYear`)
- `makeSubPermanent` — upgrades an existing sub to a permanent replacement
- `setCourse / setRoundConfig`
- `setLocation(location)` — update trip destination string; shown in header
- `setMatches / updateMatch / setMatchScore / setTeamHoleScore / setTeeShot`
- `setMatchScoresBatch(matchId, scores)` — applies all player/hole scores in one atomic store update (avoids Supabase realtime feedback loop during simulate)
- `setTeamScore / clearAllTeamScores / clearTeamScoresForRound`
- `clearMatchScores / clearAllMatchScores / clearRoundMatches`
- `addAdmin / updateAdmin / removeAdmin`
- `setSandbaggerPlayer(id)` / `setToiletAwardPlayer(id)` — assign end-of-year awards
- `setDefendingChampion(teamId)` — manually assign/override defending champion team
- `setGameConfig(config)` — update house rules; triggers handicap module singleton update
- `setLodgingConfig(config)` — update lodging property/unit assignments; synced via Supabase
- `finalizeYear` — snapshots year → archivedYears, increments year, clears matches/scores;
  single-year subs revert; permanent replacements graduate; **auto-persists Skidmore tournament
  scores** (non-blind, non-team-format rounds with all 18 holes scored, id `sk-tour-{year}-r{round}`);
  **auto-computes defending champion** via `computeChampion`; sets `defendingChampionTeamId`
- `switchToYear(year)` — swaps live state to archived year; saves liveCache first
- `returnToLive()` — restores liveCache, saves any edits back to archivedYears
- `addHoleInOne / updateHoleInOne / deleteHoleInOne`
- `addHioDonation / setDonationPaid / claimPot`
- `setCtpEntries / updateCtpEntry / addCtpDonation / setCtpDonationPaid`
- `addCourseHistory / updateCourseHistory / deleteCourseHistory`
- `addSkidmoreScore / updateSkidmoreScore / removeSkidmoreScore`
- `setCtpTeamId(round, teamId)` — set which team goes last in CTP entry for R3/R5; synced to Supabase
- `promotePlayerToTreasurer(username)` — grants `canTreasure: true` on a player-role account
- `demotePlayerFromTreasurer(username)` — revokes treasurer rights

**Score propagation:** When a non-blind match score changes (`setMatchScore` or `setMatchScoresBatch`), the store automatically propagates those scores to the player's corresponding blind match in the same round.

**GameConfig sync:** After store creation, a module-level subscriber calls `configureHdcpSettings(state.gameConfig)` on every state change so handicap calculations stay in sync without threading config through every call site.

### Auth Store (`useAuthStore`)

Not persisted (session-only).

```typescript
{
  currentAdmin: string|null
  currentRole: 'admin'|'scorer'|'player'|'treasurer'|null
  canScore: boolean      // true for admin, scorer, player with canScore
  canTreasure: boolean   // true for admin, treasurer, player with canTreasure
  loggingIn, loginError, mustChangePassword
}
```

- `login(username, password)` — verifies SHA-256 hash against `admins` in tournament store; sets `currentRole`, `canScore`, `canTreasure` from credential; role defaults to `'admin'` if unset
- Selectors: `useIsAdmin()`, `useIsScorer()`, `useIsPlayer()`, `useCanEnterScores()`, `useCanManagePayments()`, `useCurrentAdmin()`
  - `useCanManagePayments()` — true for admins and any account with `canTreasure`; controls CTP winner paid toggles and HIO donation paid toggles

**Default admin:** `App.tsx` bootstraps a `quade` admin on first load if no admins exist.

---

## Supabase Sync (`useSupabaseSync`)

### Tables

| Table | Key | Payload |
|---|---|---|
| `app_state` | `id = 'jugger-{year}'` | `state` JSON blob (all APP_STATE_KEYS) |
| `matches` | `match_id`, `tournament_year` | `match_json` (Match object) |
| `team_scores` | `tournament_year`, `team_id`, `round` | `points`, `notes` |

**APP_STATE_KEYS** (synced as single JSON): `year, teams, courses, roundConfigs, holeInOnes, ctpEntries, ctpDonations, ctpHioHistory, hdcpLocked, courseHistory, admins, pairingsLocked, lockedRounds, hioDonations, skidmoreScores, sandbaggerPlayerId, toiletAwardPlayerId, defendingChampionTeamId, gameConfig, location, lodgingConfig, ctpTeamIds`

### Sync Behavior
- **On load:** Supabase wins over localStorage if rows exist
- **Local → Supabase:** Zustand subscriber detects changes; matches/teamScores upserted immediately; app_state debounced 1 second
- **Supabase → Local:** Realtime channel listens for INSERT/UPDATE/DELETE on all three tables
- **Loop prevention:** `remoteDepth` counter (> 0 = skip outbound push)
- **History mode:** All sync suppressed when `isViewingHistory = true`
- **Storage bucket:** `jugger-archive` (FileArchive page)

---

## Authentication & Access Control

| Role | Login | Capabilities |
|---|---|---|
| **Admin** | Shield icon → sign-in form | Everything: edit rosters, courses, schedule, pairings, scores, results, accounts |
| **Scorer** | Same sign-in form | Enter scores, toggle Magic Ball, record match results |
| **Treasurer** | Same sign-in form | Mark CTP winner payments paid; mark CTP/HIO contributions paid; no score entry |
| **Player** | Same sign-in form | Read-only by default; can be granted Scorer and/or Treasurer rights individually |
| **Guest** | No login | Read-only view of all pages except Pairings, Round Games, Team Results, and Skidmore HDCP |

### Page-Level Access

| Page | Guests | Scorers | Admins |
|---|---|---|---|
| Dashboard | Read | Read | Full (lock HDCP, assign awards, finalize year) |
| Teams | Read | Read | Full (edit names, HDCP, substitutes, permanent replacements, awards) |
| Schedule | Read | Read | Full (edit dates, tee times, format) |
| **Pairings** | **Hidden** | **Hidden** | Full (generate, edit, lock) |
| Scorecards | Read | Enter scores, Magic Ball, match result | Full + simulate + clear |
| **Side Bets** | **Hidden** | **Hidden** | Full; players can view/create their own |
| Lodging | Read | Read | Full (edit property, units, dates) |
| **Board** | **Hidden** | **Hidden** | Full; players can post/reply |
| Courses | Read | Read | Full (edit hole data) |
| Round Games | Read (rules + values) | Read | Full (edit house parameters) |
| **Team Results** | **Hidden** | **Hidden** | Edit scores |
| Par 3 CTP | Read | Read | Full |
| Hole in One | Read | Read | Full |
| Analytics | Read | Read | Read |
| **Archive** | **Hidden** | **Hidden** | Upload/delete files |
| History | Read | Read | Add/edit/delete courses; assign to round |
| **Print All** | **Hidden** | **Hidden** | Print |
| **Skidmore HDCP** | **Hidden** | **Hidden** | Full (add/edit scores, auto-applies HDCP) |

### Account Management

Admins open the "Manage Accounts" panel (Header → Manage). Three sections:
- **Players** — auto-created from roster; grant/revoke Scorer and/or Treasurer rights per player; default password shown until changed; subs labeled `SUB`
  - Each row uses a **2-row stacked layout**: row 1 has display name + username + `SUB`/default-PW badges (all flex-wrap to avoid collisions); row 2 has pill-style action buttons (Scorer toggle, Treasurer toggle, Reset PW — color-coded active/inactive state)
- **Admins** — full access accounts; inline Change PW + Delete actions
- **Scorers** — standalone scorer accounts (non-player volunteers); same inline actions as Admins

All accounts use SHA-256 password hashing via Web Crypto API. `useCanManagePayments()` returns true for admins and any account (regardless of role) where `canTreasure === true`.

---

## Navigation Order

1. Dashboard · 2. Teams · 3. Schedule · 4. Pairings *(admin only)* · 5. Scorecards · 6. Side Bets *(player/admin only)* · 7. Lodging · 8. Board · 9. Courses · 10. Round Games · 11. Team Results *(admin only)* · 12. Par 3 CTP · 13. Hole in One · 14. Analytics · 15. Archive *(admin only)* · 16. Course History · 17. Print All *(admin only)* · 18. Skidmore HDCP *(admin only)*

**Mobile bottom nav** (fixed bar, `lg:hidden`): Home → Scores → Par 3 → Schedule → Results. Nav labels are icon-only on mobile (text hidden via `hidden lg:inline`). Top sub-nav scrolls horizontally on mobile (`overflow-x-auto no-scrollbar`); on desktop it shows a thin white scrollbar (`.nav-scrollable`) when items overflow so admin-only pages remain discoverable.

---

## Layout & Theme

### Colors (Tailwind config + CSS vars)

| Token | Hex | Usage |
|---|---|---|
| `masters-dark` | `#1a3a2f` | Header background, dark text |
| `masters-green` | `#006747` | Nav bar, buttons, active states |
| `masters-gold` | `#C9A84C` | Accents, active nav, year label |
| `masters-cream` | `#f5f5f0` | Page backgrounds |
| `masters-light` | `#e8f0ec` | Table headers, card backgrounds |

### Component Classes (index.css)

- `.card` — white rounded shadow panel
- `.btn-primary / .btn-secondary / .btn-ghost / .btn-danger`
- `.input` — text input with border
- `.label` — small uppercase field label
- `.section-header` — serif bold section title
- `.badge` — small pill chip
- `.no-print` — hidden in print mode
- `.scorecard-table` — scorecard-specific table styling (`.dot-cell`, `.row-par`, etc.)
- `.no-scrollbar` — hides scrollbar visually while keeping scroll behavior (used on mobile nav and match pill row)
- `.nav-scrollable` — shows thin white scrollbar on desktop nav (`@media (min-width: 1024px)`); hidden on mobile
- `.print-round-preview` — hidden on screen (`@media screen { display: none }`); renders normally in react-to-print's print iframe so Print Round content is accessible without being visible to the user

### Fonts
- **Serif:** Playfair Display (headers, team names)
- **Sans:** Source Sans 3 (body text)

### Header Layout
- Entire chrome (header + sub-nav + history banner) wrapped in one `sticky top-0 z-50` div — all three scroll as a unit and stay pinned
- Header is a 3-zone flex row: **left** (logo + title, shrink-0) · **center** (weather strip, flex-1, `hidden md:flex`) · **right** (sync dot + admin widget, grouped together, shrink-0)
- Logo and title are responsive: `h-14 w-14 lg:h-36 lg:w-36` / `text-lg lg:text-3xl`
- Below the title: `location` (e.g. "Pinehurst, NC") and date range (e.g. "August 27–29, 2026") derived from `roundConfigs` dates filtered to the current year — both hidden if not set or if dates don't match the current year (prevents stale dates after `finalizeYear`)
- Admin year selector (dropdown) — visible only when archived years exist and user is admin; positioned between the title block and the weather center zone
- History mode amber banner with "Return to {liveYear}" button
- **Weather strip** (center zone, `hidden md:flex`) — 3-day event forecast shown on tablet/desktop; one `WeatherCard` per unique event date (Thu/Fri/Sat), showing: day label, WMO weather emoji, high/low °F, condition label, rain probability
  - **Forecast mode** (≤14 days until last event date): Open-Meteo `forecast` API (`api.open-meteo.com/v1/forecast`, `forecast_days=16`, `temperature_unit=fahrenheit`); label reads "Forecast" or "Extended Forecast" (>7 days)
  - **Historical mode** (>14 days): Open-Meteo `archive` API (`archive-api.open-meteo.com/v1/archive`) for the same calendar dates in the prior 3 years; averages highs/lows; uses worst WMO severity code; `precipitation_sum` (mm) converted to approximate rain % via lookup table; label reads "Historical Avg · 3yr"
  - 14-day threshold (not 16) gives a 2-day buffer so the API is never queried at its exact boundary
  - Cache key `jugger-weather-v2-{firstEventDate}`, TTL 1 hour via `localStorage`; null result is not cached (retried next load)
  - Event coordinates hardcoded: Pinehurst, NC (`WX_LAT = 35.195`, `WX_LON = -79.469`) — update for future venues
  - Weather suppressed for archived/past years (last event date > 1 day ago)
- **Mobile compact weather row** (`md:hidden`) — rendered below the main flex row inside `<header>`; shows emoji + day abbreviation + high°F + 💧rain% (only if ≥40%) for each day, separated by dots; no card borders

---

## Page Details

### Dashboard (`/`)
- **Champion hero** — when tournament is complete, displays the winning team with trophy, color banner, and Ryder Cup tiebreaker logic (via `utils/champion.ts`)
- **Stat cards** (click to navigate): Players → Teams, Courses → Courses, Matches → Schedule, Rounds → Results
- **Standings** — sorted by total `teamScores` points
- **Round Schedule** — list of rounds with date/time, links to Schedule page
- **Team Rosters** — 3 cards with team name row showing `🏆 Defending Champs` badge (right side, baseline-aligned) for the defending champion team; players with `ghinNumber` can be looked up via GHIN; Sandbagger and Toilet Award thumbnail images (`h-5 w-5`) shown inline next to award holders' names; substitute players show an amber `SUB` pill badge next to their name
- **Admin controls**: dropdown to manually assign defending champion team
- **Finalize Tournament** — admin only, live year only; Step 1: pick Sandbagger and Toilet Award winners; Step 2: confirm and archive

### Teams (`/teams`)
- Edit player name / handicap index / GHIN number (admin only)
- **Substitute player system** — admin can swap a player for a single-year sub; sub reverts to original player on `finalizeYear`; badge: `SUB`
  - Original player's GHIN is saved to `originalGhinNumber` and cleared from the active record; sub's GHIN field starts blank
  - **Revert** restores original name, HDCP, and GHIN; `makeSubPermanent` clears `originalGhinNumber`
- **Permanent replacement** — admin can permanently replace a player; carried forward on `finalizeYear`; badge: `PERM`
- **Make Sub Permanent** — upgrades an existing sub to a permanent roster member
- HDCP table: raw, netted, capped, final HDCPs for all rounds; column headers show course name and format; R3 header reads scramble % from `gameConfig.texasScrambleHdcpPct` (not hardcoded 60%)
- Handicap lock toggle prevents edits; Captain's Choice team aggregate shown dynamically
- **Award images** — player row shows `sandbagger.jpg` or `toilet_award.webp` (`h-full` filling the row height) for award holders; admin can assign/remove via thumbnail buttons; `✕` overlay removes the award
- **Defending Champions** — team name row shows `🏆 Defending Champs` text; admin can click it to remove, or click `🏆` on other teams to assign

### Schedule (`/schedule`)
- **Location field** at top — admin-editable text input for trip destination (e.g. "Pinehurst, NC"); displayed in the site header
- Per-round card: format selector (admin), date/tee pickers (admin), tee times for Match A/B/C
- Player names shown under each match tee time
- **Scorecard links** under player names for each match (also shows blind matches)
- Format change warning if pairings exist (prompts to confirm + clear)
- Course summary bar (name, par, selected tee rating/slope/yardage)

### Pairings (`/pairings`) — Admin only
- Generate/Re-generate Pairings button (enforces partner rotation; minimizes opponent repeats)
- Lock Pairings toggle (prevents edits)
- Per-round match cards: team colors, player names, edit button (inline editor)
- Regular matches and blind matches in separate columns
- Scorecard link on every match card

### Scorecards (`/scorecards`)
- Round tabs (1–5) + match selector list (horizontal pill row on mobile, vertical sidebar on desktop)
- **Round Info Banner** — per-round description panel above matches; collapsible on mobile (collapsed by default); reads live from `gameConfig` via `getFormatInfo(gc)` so all point values, pcts, and descriptions update instantly when house rules change
- Per-match scorecard via `ScorecardCard` component (see below)
- **"Score Hole-by-Hole"** button (mobile only, `lg:hidden`, visible to all users) — links to `/scorecards/:matchId/mobile?round=N&hole=1`; full-screen per-hole scoring with numpad, result bar, CTP picker; editing gated to scorers/admins
- **CTP team selector** — for team-format rounds (Texas Scramble, Captain's Choice), an admin-only dropdown appears above `<RoundInfoBanner>` as soon as the round tab is selected (no match click required); sets which team goes last and gets the CTP recording prompt in MobileScoring; persists to `ctpTeamIds` in store and syncs via Supabase
- Score entry (desktop): number inputs; mobile stepper buttons ▲/▼ — first tap from null sets to par
- Admin-only: **Simulate Scores** (per-round or global), **Clear Scores**, Clear All Scores
  - Simulate uses `setMatchScoresBatch` (one atomic update) to avoid Supabase realtime feedback loop overwriting scores mid-simulation
  - Simulate includes Magic Ball random assignment for non-blind Points Round matches
  - Clear sets `magicBall1/2: undefined` in addition to clearing scores
- **Print Scorecard** and **Print Round** buttons — admin only; all printing uses letter landscape, 0.35in margins
  - Print Scorecard: prints the currently selected match
  - Print Round: prints all matches for the active round, 2 per page with cut line (same layout as Print All); content hidden on screen via `.print-round-preview` class
- **Per-round score locking** — admin can lock/unlock individual rounds; locked rounds show a padlock icon on the round tab; scorers cannot enter scores, toggle Magic Ball, or edit match results on locked rounds; admins retain full access; a banner explains lock status
- Auto-recomputes team scores when scores change (format-specific logic)
- **Auto-populates `match.result`** on every score entry and simulate for `team_match_play` and `individual_match` formats
- Deep links: `?match={matchId}&round={round}`

### Mobile Scoring (`/scorecards/:matchId/mobile`)
Full-screen per-hole scoring page for mobile devices. Mounted OUTSIDE the Layout wrapper (no header/nav) so it fills the entire viewport. Visible to all users; score editing gated to `canEnterScores`.

- **Hole navigation** — prev/next arrows + hole indicator; swipe-friendly layout
- **Score entry** — tap a player name to open numpad; after tapping Done, auto-advances to the next unscored player with numpad kept open; closes after last player scored; tap any scored player to re-open numpad for editing
- **Result bar** — format-aware running result below the hole scores (match play +/- holes, Stableford quota delta, team standings for scramble/captain's choice, individual match 3-row layout)
- **Par 3 CTP picker** — auto-triggers after all players are scored on a par-3 hole; shows all 12 players grouped by team; admin/scorer only
- **Score colors** — eagle=yellow, birdie=green, par=gray, bogey=red, double/worse=purple
- Uses `useTournamentStore.getState()` directly in the Done callback for fresh post-update state (React useMemo hasn't re-run yet at callback time)
- **Revert:** delete `src/pages/MobileScoring.tsx` + remove its import/route in `App.tsx` + remove the "Score Hole-by-Hole" button block in `ScorecardView.tsx`

### Side Bets (`/side-bets`) — Player/Admin only
Player-vs-player side wagers independent of the main tournament formats.
- Access gated to `isAdmin || isPlayer`; hidden from guests and scorer-only accounts
- **Three tabs**: Active (pending + active bets), History (completed/cancelled), Stats (player bet performance)
- Per-bet: participants, stake, format (`stroke_play`, `match_play`, `stableford`, etc.), target match/round, status badge (Pending / Active / Complete / Cancelled)
- Settlement auto-computed via `computeSideBet()` from `utils/sideBets.ts` using live match scores and HDCPs
- Create flow: `SideBetCreate.tsx` (format picker, participant selector, stake, match linkage); admin can create on behalf of any players
- Detail view: `SideBetDetail.tsx` — full settlement breakdown, player net scores, result

### Message Board (`/board`)
Supabase-backed discussion thread list for players and admins.
- Access gated to `useCanAccessBoard()` (logged-in players and admins; guests hidden)
- **Thread list**: categorized by `MB_CATEGORIES`; filter by category tab or free-text search; unread count badge on nav item
- **New thread**: title, category, body text, optional photo attachments (compressed via `compressImage`, stored in `jugger-board` Supabase Storage bucket); emoji picker
- Thread detail (`MessageBoardThread.tsx`): replies, photo attachments, emoji reactions, timestamps
- Admin can pin or lock threads
- Unread tracking via `boardUtils.ts` (localStorage read receipts); `useBoardStore` tracks `unreadCount` for nav badge
- Not synced via the main `app_state` Supabase row — uses dedicated `mb_threads` / `mb_replies` tables directly

### Courses (`/{year} Courses` at `/courses`)
- Shows **only** courses assigned in the current year's `roundConfigs`; empty state if none assigned
- Tab per active course
- Course hero image, name, par, website (admin-editable)
- Tee table: Name | F9 yds | B9 yds | Total yds | Rating | Slope
- Official scorecard images with lightbox zoom
- F9 and B9 hole tables: Hole | Par | HDCP | [tee yardages], all columns centered
- Totals footer row in each hole table

### Round Games (`/round-games`)
- Visible to **all users**; only admins can edit configurable parameters
- **"Juggerknocker Invitational Rules" card** — displayed above the format pills; 6 numbered house rules (ball in play, no club limit, gimmes, max net triple bogey, OB options a/b/c, handicap baseline from 12-month GHIN low or Rules Committee) with a USGA Rules external link
- **Quick-jump pill bar** — one pill per format; scrolls to that format's card
- Card per format (Team Match Play, Points Round, Texas Scramble, Individual Match Play, Captain's Choice, Vegas)
- Each card: format name + informal nickname, assigned round badge, description, "How It Works" bullet list, HDCP note
- **Stableford point values** (Points Round card) — visible to guests and scorers; shows all 6 values (Albatross/Eagle/Birdie/Par/Bogey/Double) even in read-only mode
- **Dynamic HDCP notes** — Texas Scramble gray box reads "HDCP: x% of each player's course HDCP"; Captain's Choice reads "HDCP: x% of the sum of each player's course HDCP"; both x values auto-update when admin changes the configured percentages
- **Configurable parameters** — admin-editable inputs; changes take effect immediately for all scoring and descriptions:
  - Texas Scramble: HDCP %, finish points (1st/2nd/3rd)
  - Captain's Choice: HDCP %, min tee balls per player, finish points
  - Points Round: Magic Ball on/off, blinds on/off, all 6 Stableford point values, regular/blind match points
  - Team Match Play: blinds on/off, regular/blind match points
  - Individual Match Play: blinds on/off, match/twosome/blind point values
  - Vegas: birdie/eagle/albatross multipliers, regular/blind match points, blinds on/off
- **Match Structure** reference card at bottom: twosome matrix (T1A vs T2A etc.) and team format rules
- **Reset to Defaults** button restores `DEFAULT_GAME_CONFIG`
- Round badge shows currently-assigned round from `roundConfigs` (updates live when Schedule changes format)

### Lodging (`/lodging`)
- Reads from `lodgingConfig` in the Zustand store (admin-configurable year-over-year)
- **Page header** — property name links to Google Maps; clicking launches native maps app on iOS/Android; optional website link
- **Unit assignment cards** — one card per team, ordered by `lodgingConfig.units` array; shows team color header, unit label (e.g. "Villa 1615"), optional building badge (e.g. "Bldg #6"), early arrival badge, check-in/check-out/nights dates, and live golfer roster (auto-reflects substitutes with amber `SUB` badge)
- **Annotated map** — `talamore-map.jpg` with SVG overlay; highlight box rotated ~22° CCW to match building angle; non-rotated label banner above cluster shows building name and villa numbers; SVG viewBox matches original image dimensions (2237×1653)
- **Amenities** — static grid of included villa amenities (bedrooms, kitchen, WiFi, laundry, housekeeping, etc.)
- **Resort documents** — PDF links for Check-In & Resort Information and Rules & Regulations
- **Admin edit modal** — "Edit Lodging" button (admin only) opens form to update: property name, address, website URL, description, and per-team unit assignments (label, building, check-in, checkout, nights, early arrival flag); units can be added/removed dynamically

`LodgingConfig` persists in `TournamentState`, is included in the `ArchivedYear` snapshot, and syncs via Supabase via `APP_STATE_KEYS`. `DEFAULT_LODGING_CONFIG` pre-populated with 2026 Talamore data.

### Results (`/results`) — Admin only
- Grid: Team × Round with editable point cells (admin)
- Max points shown per round (9, 15, 7, 12, 7)
- Winner row highlighted with trophy
- CTP quick-link
- Hidden from guests and scorers (standings visible on Dashboard instead)

### Par 3 CTP (`/ctp`)
- Auto-counts par-3 holes across all rounds from course data
- Pot = paid player count × par-3 count × $1/hole
- Per-hole CTP entry: round, hole, yardage, winner name
- **CTP Winnings card** (`WinnerPayouts` component) — groups wins by player; shows hole list (e.g. R2·H3), total dollar winnings, and a single "Mark Paid" button per player; visible to all; button gated to `useCanManagePayments()`
- **Substitute name resolution** — donation records store `playerId`; when a sub is active the current player's name (sub's name) is displayed; legacy records without `playerId` fall back to stored `playerName`
- CTP donation tracker per player (payment toggle gated to `useCanManagePayments()`)
- Historical CTP→HIO transfer bar chart
- **Mobile**: Pot Summary and Player Contributions sections collapsed by default (chevron toggle); CTP results visible first

### Hole in One (`/hole-in-one`)
- HIO pot hero: current pot total, contributor count
- Champion entries: year, player, course, hole, yardage, date, notes, photo
- Photo upload (base64 stored in Zustand)
- Claim Pot: sums all paid unclaimed donations → sets `potClaimed` on HIO entry
- Per-player $20/year donation tracking with paid toggle (gated to `useCanManagePayments()`)
- **Substitute name resolution** — donation records store `playerId`; when a sub is active the sub's name is shown in place of the original player's name; legacy records fall back to stored `playerName`
- **Substitute pot eligibility** — substitutes can only receive an HIO pot payout for donations made in the year they are playing (not prior years); only current-year `hioDonations` are summed for a sub's claim

### Analytics (`/analytics`)
8-tab historical data explorer powered by `utils/analytics.ts`. Data sourced from all `archivedYears` + live year bundled as `YearBundle[]`. Handles subs and permanent replacements via dynamic roster resolution across all bundles.

- **Team Results** — year-by-year points per round, bar charts, podium finishes
- **Player Scoring** — gross scoring distribution (eagle/birdie/par/bogey/double/worse) per player; scoring profile breakdown; radar comparison
- **Head-to-Head** — W/L/T matrix between every player pair; twosome partner records
- **Format Stats** — points per round by format, team performance per format
- **Course Stats** — scoring by course; difficulty comparison across rounds
- **HDCP Trends** — Recharts LineChart for all players across all recorded years; auto-merged from `data/hdcpHistory.ts` (2006–2025) + archived + live year; year range filter, player visibility toggles, team group controls; 3 shades per team
- **Records** — all-time records tiles (biggest win, lowest net, most Stableford pts, longest drive used, etc.); Cap'n Choice split into gross + net; dormie/decision logic via `decidedResult()` helper
- **Par 3 CTP** — historical CTP winners and donation tracking

Tab bar is sticky below the measured site header (uses `ResizeObserver` on `#site-header`).

### Archive (`/archive`) — Admin only
- Supabase Storage bucket `jugger-archive`
- File tree organized by year folder
- Type badges, file sizes, view/download links
- Admin: upload files, delete files
- Dev: served via Vite plugin reading `/JuggerHistory/` local filesystem

### History (`/history`) — Primary course management
- Searchable/filterable course database (28+ historical courses)
- **Add Course / Edit Course / Delete Course** — admin only; this is the primary way to add courses to the app; changes propagate to Courses page via `setCourse` + `setRoundConfig`
- Per-course detail: hero image upload, metadata, scorecard image, played rounds
- **Assign to Tournament Round** — admin only; sets course + round config; round labels dynamic based on `roundConfigs.format`
- Built-in `hist-*` entries seeded from `initialData.ts`

### Print All (`/print`) — Admin only
- react-to-print renders all match scorecards, 2 per page
- Cut line between top/bottom halves
- Round headers, page breaks between rounds
- `@page`: letter landscape, 0.35in margins; `scorecard-half` height 3.6in (fits 2 per landscape page)

### Skidmore HDCP (`/skidmore-hdcp`) — Admin only
- WHS handicap tracker for Matt Skidmore (not in GHIN)
- **HDCP Status cards**: computed WHS index + Teams page sync status
- **Auto-applies** computed HDCP to Teams page via `updatePlayer` when HDCPs are not locked; shows "projected" post-tournament HDCP when locked
- **Tournament scores auto-derived** from match data (non-blind, non-team-format rounds — excludes `texas_scramble` and `captains_choice` — with all 18 holes scored); appear/disappear automatically with simulation; **permanently saved on `finalizeYear`** with ids `sk-tour-{year}-r{round}`
- **Score table**: color-coded rows — gold = used in calculation, blue = in 20-score window, gray = outside window; shows differential breakdown
- **18-hole and 9-hole entry** supported:
  - 18-hole: standard score differential = `(113 / Slope) × (Score − Rating)`
  - 9-hole (WHS 2024): combined diff = actual 9-hole diff + `(Handicap Index at time ÷ 2)`; form pre-fills HDCP at time with current computed index
- **Add/Edit score form**: date, course, rating, slope, score, holes toggle (18/9), notes; live differential preview
- **USGA WHS rules accordion**: formula, 9-hole treatment, score window table (current count highlighted), handicap index formula, soft/hard caps, historical Excel discrepancy note
- Seeded with 18 historical scores from the `Skidmore HDCP` Excel tab (approximate dates 2020–2025)

---

## End-of-Year Awards

Two awards tracked in `TournamentState` and displayed throughout the app:

| Award | Field | Default | Image |
|---|---|---|---|
| **Sandbagger** | `sandbaggerPlayerId` | `'pitts'` (Ron Pitts) | `public/sandbagger.jpg` |
| **Toilet Award** | `toiletAwardPlayerId` | `'skidmore'` (Matt Skidmore) | `public/toilet_award.webp` |

- **Dashboard**: `h-5 w-5` thumbnail next to player name in roster cards
- **Teams**: full-height award image in player row right column; admin assigns/removes via thumbnail buttons with `✕` overlay
- **Finalize flow**: Step 1 prompts admin to pick both winners before archiving the year

---

## Defending Champions

`defendingChampionTeamId?: string` in `TournamentState`.

- **Auto-set on `finalizeYear`**: `computeChampion` determines the winner; Ryder Cup tiebreaker (tied = defending champion retains)
- **Manual override**: admin dropdown on Dashboard; trophy button on Teams page
- **Display**: `🏆 Defending Champs` in font-serif font-bold text-lg text-masters-gold in team name row on both Dashboard and Teams pages

---

## Finalize Tournament

Admin-only action on the Dashboard (live year only). Two-step flow:

- **Step 1** — Admin selects the Sandbagger Award and Toilet Award winners from player dropdowns (pre-populated with current holders). These are saved to `sandbaggerPlayerId` / `toiletAwardPlayerId` in state immediately.
- **Step 2** — Admin confirms. `finalizeYear()` fires.

### What gets stored

| Data | Where stored | Notes |
|---|---|---|
| **Full year snapshot** | `archivedYears[]` | Frozen `ArchivedYear` object (see below) |
| **Skidmore tournament scores** | `skidmoreScores[]` | Auto-derived from match data; id `sk-tour-{year}-r{round}` |
| **Defending champion** | `defendingChampionTeamId` | Auto-computed via `computeChampion`; carried into next year |
| **End-of-year awards** | `sandbaggerPlayerId`, `toiletAwardPlayerId` | Already saved in Step 1; persist into next year |

**ArchivedYear snapshot contains:**
- `year`, `finalizedAt` (ISO timestamp)
- `teams` — with subs intact as they were during the year (accurate historical record)
- `roundConfigs` — all 5 rounds, courses, formats, tee times
- `matches` — all match data with every hole score
- `teamScores` — final point totals per round
- `hdcpLocked` state
- `lodgingConfig` — property and unit assignments as configured for that year

**Skidmore score eligibility:** non-blind matches only; excludes `texas_scramble` and `captains_choice` formats; all 18 holes must be entered. Score not added if an entry with that id already exists.

### What gets reset for next year

- `matches` → emptied
- `teamScores` → emptied
- `hdcpLocked` → false
- `year` / `liveYear` → incremented by 1
- Single-year subs → reverted to original players
- Permanent replacements → graduate to core roster members (flags cleared)

### How archived data is visible

| Where | What you see |
|---|---|
| **Header year dropdown** (admin) | Prior year appears as a selectable option |
| **History mode** (switching to prior year) | Full read-only view of every page — scores, pairings, standings, roster — exactly as it was |
| **Dashboard** (live year) | `🏆 Defending Champs` badge on the champion team |
| **Dashboard** (viewing archived year) | Champion hero card with team color banner and trophy |
| **Analytics page** | Prior year data auto-merged into all tabs (scoring, H2H, records, HDCP trends, etc.) |
| **Skidmore HDCP page** | Tournament round scores appear permanently in the score table |

---

## ScorecardCard Component

Renders the full interactive scorecard for one match. Handles all 5 formats.

**Props:** `match, teams, course, config, interactive?, onScoreChange?, onTeamHoleScoreChange?, onTeeShotChange?`

Reads `gameConfig` from store directly (via `useTournamentStore`) so description labels and Captain's Choice team HDCP reflect live house rules without prop threading.

**Key behavior per format:**

| Format | Scoring cells | Net display | Result row |
|---|---|---|---|
| team_match_play | Per-player gross | Net per hole | Running +/- holes |
| points_round | Per-player gross | Stableford pts | Running quota delta |
| texas_scramble | Per-player gross | Net (configurable % HDCP) | Best-ball running total |
| individual_match | Per-player gross | Net per hole | Two 1v1 + 2v2 rows |
| captains_choice | Team hole score (admin) + tee shot selector | Net (configurable % team HDCP) | Running team total |
| vegas | Per-player gross | Net per hole | Two-digit combined score; running hole wins |

Stroke dots (`.` / `..`) calculated from `getStrokeDots(courseHdcp, holeHdcpRank)`.

R5: All 4 players share the same `teamHdcp = floor(Σ individual HDCPs × captainsChoiceHdcpPct)`.

**Dormie / match-decided display:** For `team_match_play` and `individual_match`, result rows freeze the win label at the hole where the match is clinched (margin > holes remaining). Post-decision hole cells are dimmed (opacity-40); a small gold checkmark appears at the decision hole column across all result row types.

---

## Scoring Computation (`utils/matchplay.ts`)

Called in `ScorecardView` after every score entry:

- `computeMatchPlay(match, holes, hdcps)` — best-ball net per hole, running +/- holes; returns `decisionHoleIndex` (0-indexed hole where match was clinched); `winLabel` frozen at that point (e.g. `3&2`)
- `computePointsRound(match, holes, hdcps)` — gross Stableford vs quota; twosome quota = `coursePar − (hdcpA + hdcpB)` where `coursePar` is derived from the `holes` array
- `computeScramble(match, holes, hdcps)` — ball count rules (1/2/3/4 by hole range)
- `computeIndividualMatch(match, holes, hdcps)` — two `compute1v1` results + 2v2; `compute1v1` also returns `decisionHoleIndex` and frozen `winLabel`
- `computeCaptainsChoice(teamHoleScores, holes, teamHdcp)` — shared net score

Team scores recomputed in `ScorecardView` after each change:
- `recomputePointsRoundTeamScores` — all matches fully scored? Award 2/1 pts per match
- `recomputeScrambleTeamScores` — rank all 3 teams by score; 4/2/1 pts
- `recomputeIndividualMatchTeamScores` — sum individual/2v2 wins per team
- `recomputeCaptainsChoiceTeamScores` — rank team totals; 4/2/1 pts

---

## Handicap Computation (`utils/handicap.ts`)

Key functions:

```
courseHandicap(index, slope, rating, par)
  → round(index × (slope/113) + (rating - par))

getPlayerCourseHdcp(player, course, tee, round, allPlayers, format = '')
  → applies netting, 18-cap, format % from module singleton
  → format param determines percentage — not round number

getRoundHdcpPct(format: string): number | null
  → _scramblePct for texas_scramble, _captainsChoicePct for captains_choice, null otherwise
  → reads from module-level vars (updated via configureHdcpSettings)

formatRoundHdcp(format: string): string
  → human-readable description using live pct values

computeAllCourseHdcps(players, course, tee, round, allPlayers, format = '')
  → for captains_choice: all players get same teamHdcp = round(Σ × _captainsChoicePct)
  → otherwise delegates to getPlayerCourseHdcp per player

apply18Cap(netted)
  → netted ≤ 18 ? netted : 18 + 0.5×(netted - 18)

getStrokeDots(courseHdcp, holeHdcpRank)
  → '' if rank > courseHdcp
  → '.' if rank ≤ courseHdcp ≤ 18 (or rank ≤ 18 for extras)
  → '..' if player gets 2 strokes on that hole

stablefordPoints(gross, par, strokes)
  → reads from _stableford module var (set by configureHdcpSettings)
  → returns 0/double/bogey/par/birdie/eagle/albatross pts

playerQuota(courseHdcp, coursePar)
  → Math.round(coursePar / 2) - courseHdcp  (per-player display value)

teamQuota(hdcps, coursePar)
  → coursePar - sum(hdcps)  (twosome/team quota for match result)

configureHdcpSettings(config)
  → updates _scramblePct, _captainsChoicePct, _stableford module vars
  → called by store subscriber on every gameConfig change

getScramblePct() / getCaptainsChoicePct()
  → read current module-level pct values (used by ScorecardCard labels)
```

---

## Champion Detection (`utils/champion.ts`)

```
computeChampion(teams, teamScores, rounds, defendingChampionTeamId?)
  → determines winning team by total points
  → Ryder Cup tiebreaker: if tied, counts individual round wins;
    defending champion retains on tie
  → returns { champion, isTied, tiedTeams } or null if incomplete

getDefendingChampionId(archivedYears, teams)
  → finds previous year's champion from archivedYears
```

Dashboard renders a champion hero card with team color banner and trophy when all rounds are complete.

---

## Analytics Computation (`utils/analytics.ts`)

Key exported functions (all consume `YearBundle[]` + course data):

```
computeScoringProfiles(bundles, courses, courseHistory)
  → per-player scoring distribution (eagle/birdie/par/bogey/double/worse counts + pcts)

computeH2H(bundles, courses, courseHistory)
  → W/L/T matrix for every player pair; twosome partner records

computePartnerRecords(bundles, courses, courseHistory)
  → win/loss/tie stats for every partnership combination

computeTeamResults(bundles)
  → year-by-year points per round per team; podium finish counts

computeFormatStats(bundles)
  → points distribution by format; team performance per format

computeCourseStats(bundles, courses, courseHistory)
  → scoring averages and difficulty comparison per course

computeRecords(bundles, playerName, courses, courseHistory, captainsChoicePct)
  → all-time records tiles; uses decidedResult() for match-play margins

computePlayerFormatStats(bundles, courses, courseHistory)
  → per-player breakdown per format (pts earned, win rate, scoring avg)

YearBundle { year, teams, matches, teamScores, roundConfigs }
  → unified type for archived + live year data
```

---

## Pairing Generation (`utils/pairings.ts`)

```
generateTwosomeMatches(teams, round, existingMatches?)
  Shuffles 3 teams → T1/T2/T3
  Shuffles each team's 4 players → splits into twosomes A/B
  Enforces partner rotation (no repeated partners across rounds)
  Minimizes opponent repeats where possible
  Fixed matrix creates 3 regular + 3 blind matches

generateTeamMatches(teams, round)
  One match per team; twosome1=[p0,p1], twosome2=[p2,p3]
  Used for texas_scramble and captains_choice

getMatchesForRound(matches, round)
  Filters + sorts: regular before blind, then alphabetical by label
  (ensures Match A/B/C appear before Blind 1/2/3 regardless of creation order)
```

Match ID formats:
- Regular: `{round}a`, `{round}b`, `{round}c`
- Blind: `{round}blind1`, `{round}blind2`, `{round}blind3`
- Team format: `{round}-{teamId}`

---

## Vite Configuration

```typescript
base: '/'                      // custom domain (juggerknockerinvitational.com)
plugins: [react(), juggerHistoryPlugin()]
server: { port: 5173, open: true }
```

`juggerHistoryPlugin` is a dev-only middleware that serves `/api/history-files` (JSON tree) and `/api/history-file/:year/:filename` (stream) from the local `/JuggerHistory/` directory. Not available in production (replaced by Supabase Storage).

---

## Excel Workbook (`Jugger 2026 Schedule-HDCP.xlsm`)

Legacy macro-enabled workbook used before the web app existed. The web app is now the system of record; the Excel is kept for reference.

| Sheet | Purpose |
|---|---|
| `Schedule` | Trip schedule, tee times, pairings, game rules |
| `HDCPs` | 2006–2026 handicap history + course HDCP calculations |
| `HDCP Calc` | Formula reference |
| `Skidmore HDCP` | Historical scores used to seed `INITIAL_SKIDMORE_SCORES` (18 rounds, 2020–2025) |
| `Results` | Final point totals per round; CTP tracking |
| `Hole in 1` | HIO tracker |
| `1-Scorecard` through `5-Scorecard` | Printed course scorecards per round |
| `1a/1b/1c`, `1blinds` … `5a/5b/5c` | Per-match printable scorecards |

**Scorecard layout:** Two copies per sheet (top/bottom halves). Columns B=player, C=HDCP, D–V=holes 1–18, W–X=subtotals. Dot indicators (`.` / `..`) show when handicap strokes apply.

**Note on Skidmore HDCP:** The Excel used a simplified formula (average lowest differentials, round to 1 decimal, no 0.96 multiplier), yielding 28.5. The web app uses the official WHS formula (× 0.96, truncate) giving 27.3.
