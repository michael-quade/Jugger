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
Each player earns **gross Stableford points** vs. their quota. Quota = 36 − course HDCP.
- Albatross = 10 · Eagle = 6 · Birdie = 4 · Par = 2 · Bogey = 1 · Double Bogey = ½ · Worse = 0
- Regular match: **2 pts** · Blind match: **1 pt** · Magic Ball: **+1 pt per twosome** that holds it at finish
- Team with accumulated points vs. quota wins the match

### Round 3 — Texas Scramble
All 4 players tee off; pick best drive; all play from there. **60% of course HDCP.** Ball count rules:
- Holes 1–6: best 1 ball · Holes 7–12: best 2 balls · Holes 13–15: best 3 balls · Holes 16–18: best 4 balls
- Finish: 1st = **4 pts** · 2nd = **2 pts** · 3rd = **1 pt**

### Round 4 — Individual Match Play
Each player plays their own ball, NET scoring.
- Each individual 1v1: **1 pt** · Each 2v2 twosome best-ball sub-match: **1 pt** · Blind: **½ pt**

### Round 5 — Captain's Choice
Team captain picks the shot. HDCP = `floor(team aggregate × 15%)`. Min **3 tee balls** per player across 18 holes.
- Finish: 1st = **4 pts** · 2nd = **2 pts** · 3rd = **1 pt**

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

### Round-specific percentages

| Round | Percentage | Notes |
|---|---|---|
| R1 Team Match Play | 100% | Full netted+capped HDCP |
| R2 Points Round | 100% (quota-based) | 36 − course HDCP |
| R3 Texas Scramble | 60% | Applied after netting+capping |
| R4 Individual Match Play | 100% | Full netted+capped HDCP |
| R5 Captain's Choice | 15% of team sum | `floor(Σ individual HDCPs × 0.15)` |

---

## Pairing Rules

- Each twosome plays exactly 2 matches per round: 1 regular + 1 blind
- A twosome never plays the same opposing team twice in the same round
- Blind matches are ideally against a different team than the regular match
- Fixed matrix (teams randomly assigned as T1/T2/T3 each round, then split into twosomes A/B):
  - Regular A: T1A vs T2A · Regular B: T1B vs T3A · Regular C: T2B vs T3B
  - Blind 1: T3B vs T1A · Blind 2: T2A vs T3A · Blind 3: T2B vs T1B
- R3 and R5 (team formats): one match per team (all 4 players together), no blinds

---

## Web Application

Lives in `jugger-app/`. Deployed to GitHub Pages at `https://michael-quade.github.io/Jugger/`.

### Quick Start

```bash
cd jugger-app
npm install
npm run dev      # http://localhost:5173/Jugger/
npm run build    # production build → dist/
```

### Tech Stack

| Library | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.3 | Build tool, `base: '/Jugger/'` |
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
2. `dist/` uploaded to GitHub Pages

Required GitHub secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Local dev: `.env.local` (gitignored) with the same two vars.

---

## Project Structure

```
jugger-app/src/
  App.tsx                       # Router setup, default admin bootstrap, Supabase init
  main.tsx                      # ReactDOM.createRoot, HashRouter
  index.css                     # Tailwind + custom component styles
  types/index.ts                # All TypeScript interfaces
  store/
    useTournamentStore.ts       # Zustand store v14 (all state + actions)
    useAuthStore.ts             # Auth state (admin/scorer login)
  lib/supabase.ts               # Supabase client init (null if env vars absent)
  hooks/useSupabaseSync.ts      # Real-time sync hook + useSyncStatus
  utils/
    auth.ts                     # SHA-256 password hash/verify (Web Crypto API)
    handicap.ts                 # Course HDCP formulas, stroke dots, Stableford
    matchplay.ts                # Per-format scoring computation
    pairings.ts                 # Match generation + lookup helpers
  data/
    courseData.ts               # 4 courses (holes, pars, yardages, tees) + ROUND_CONFIGS
    initialData.ts              # INITIAL_TEAMS, INITIAL_COURSE_HISTORY, donations
    hdcpHistory.ts              # 21-year HDCP history for all 12 players (2006–2026)
  components/
    Layout.tsx                  # Sticky header + sub-nav + history banner
    ScorecardCard.tsx           # Per-format scorecard display + score entry
    AdminPanel.tsx              # Admin/scorer account management modal
    HeaderAdminWidget.tsx       # Header login/logout widget
  pages/
    Dashboard.tsx               # Overview: standings, schedule, rosters, finalize
    Teams.tsx                   # Roster editing, HDCP table
    Schedule.tsx                # Round dates, tee times, format selector
    Pairings.tsx                # Match generation + manual editing (admin only)
    ScorecardView.tsx           # Score entry UI, auto team score computation
    Courses.tsx                 # Course/hole data editor with scorecard images
    Results.tsx                 # Editable team standings table
    CtpPage.tsx                 # Par 3 CTP pot management
    HoleInOne.tsx               # HIO champion tracking + pot management
    Stats.tsx                   # Handicap history line charts
    FileArchive.tsx             # Supabase Storage file browser
    CourseHistory.tsx           # Historical course database
    PrintAll.tsx                # Batch print all scorecards (2/page)
```

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
}

Team { id, name, color, players: Player[] }

HoleData { number, par, hdcpOrder, yardages: Record<teeName, number> }
CourseTee { name, rating?, slope?, totalYards? }
Course { id, name, par, website?, tees: CourseTee[], holes: HoleData[] }

RoundFormat = 'team_match_play' | 'points_round' | 'texas_scramble'
            | 'individual_match' | 'captains_choice'

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

HioDonation { id, year, playerName, paid, amount, claimedByHioId? }

CtpEntry {
  id, year, round, hole, courseName, yardage?
  winnerName?, winnerPaid?, donatedToHio?, hioDonationAmount?
}
CtpDonation { id, year, playerName, amount, paid }

ArchivedYear {
  year, finalizedAt: string
  teams, roundConfigs, matches, teamScores, hdcpLocked
}

TournamentState {
  year: number                    // current tournament year
  liveYear: number                // the live (non-archived) year
  archivedYears: ArchivedYear[]
  isViewingHistory: boolean
  liveCache: Omit<ArchivedYear, 'finalizedAt'> | null
  teams, courses, roundConfigs, matches, teamScores
  holeInOnes, ctpEntries, ctpDonations, ctpHioHistory
  hdcpLocked, courseHistory, admins, pairingsLocked, hioDonations
}

AdminCredential { username, passwordHash, role?: 'admin' | 'scorer' }
```

---

## State Management

### Zustand Store (`useTournamentStore`) — version 14

Persists to `localStorage` key `jugger-tournament-2026`. All 14 versions have migration functions.

**Key actions:**
- `setYear / lockHandicaps / setPairingsLocked`
- `updatePlayer / addPlayer / removePlayer / updateTeamName / updateTeamColor`
- `setCourse / setRoundConfig`
- `setMatches / updateMatch / setMatchScore / setTeamHoleScore / setTeeShot`
- `setTeamScore / clearAllTeamScores / clearTeamScoresForRound`
- `clearMatchScores / clearAllMatchScores / clearRoundMatches`
- `addAdmin / updateAdmin / removeAdmin`
- `finalizeYear` — snapshots year → archivedYears, increments year, clears matches/scores
- `switchToYear(year)` — swaps live state to archived year; saves liveCache first
- `returnToLive()` — restores liveCache, saves any edits back to archivedYears
- `addHoleInOne / updateHoleInOne / deleteHoleInOne`
- `addHioDonation / setDonationPaid / claimPot`
- `setCtpEntries / updateCtpEntry / addCtpDonation / setCtpDonationPaid`
- `addCourseHistory / updateCourseHistory / deleteCourseHistory`

**Score propagation:** When a non-blind match score changes, the store automatically propagates those scores to the player's corresponding blind match in the same round.

### Auth Store (`useAuthStore`)

Not persisted (session-only).

```typescript
{ currentAdmin: string|null, currentRole: 'admin'|'scorer'|null, loggingIn, loginError }
```

- `login(username, password)` — verifies SHA-256 hash against `admins` in tournament store, sets `currentRole` from `AdminCredential.role` (defaults to `'admin'`)
- Selectors: `useIsAdmin()`, `useIsScorer()`, `useCanEnterScores()`, `useCurrentAdmin()`

**Default admin:** `App.tsx` bootstraps a `quade` admin on first load if no admins exist.

---

## Supabase Sync (`useSupabaseSync`)

### Tables

| Table | Key | Payload |
|---|---|---|
| `app_state` | `id = 'jugger-{year}'` | `state` JSON blob (all APP_STATE_KEYS) |
| `matches` | `match_id`, `tournament_year` | `match_json` (Match object) |
| `team_scores` | `tournament_year`, `team_id`, `round` | `points`, `notes` |

**APP_STATE_KEYS** (synced as single JSON): `year, teams, courses, roundConfigs, holeInOnes, ctpEntries, ctpDonations, ctpHioHistory, hdcpLocked, courseHistory, admins, pairingsLocked, hioDonations`

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
| **Guest** | No login | Read-only view of all pages except Pairings |

### Page-Level Access

| Page | Guests | Scorers | Admins |
|---|---|---|---|
| Dashboard | Read | Read | Full (lock HDCP, finalize year) |
| Teams | Read | Read | Full (edit names, HDCP, add/remove players) |
| Schedule | Read | Read | Full (edit dates, tee times, format) |
| **Pairings** | **Hidden/locked** | **Hidden/locked** | Full (generate, edit, lock) |
| Scorecards | Read | Enter scores, Magic Ball, match result | Full + simulate + clear |
| Courses | Read | Read | Full (edit hole data) |
| Results | Read | Read | Edit scores |
| Par 3 CTP | Read | Read | Full |
| Hole in One | Read | Read | Full |
| Stats | Read | Read | Read |
| Archive | Read | Read | Upload/delete files |
| History | Read | Read | Assign course to round |
| Print All | Print | Print | Print |

### Account Management

Admins open the "Manage Accounts" panel (Header → Manage). Two sections:
- **Admins** — full access accounts
- **Scorers** — score-entry-only accounts

Both use SHA-256 password hashing via Web Crypto API.

---

## Navigation Order

1. Dashboard · 2. Teams · 3. Schedule · 4. Pairings *(admin only)* · 5. Scorecards · 6. Courses · 7. Team Results · 8. Par 3 CTP · 9. Hole in One · 10. Stats · 11. Archive · 12. History · 13. Print All

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

### Fonts
- **Serif:** Playfair Display (headers, team names)
- **Sans:** Source Sans 3 (body text)

### Header Layout
- Sticky top: tournament title (links to Dashboard), year badge, sync status dot, admin widget
- Admin year selector (dropdown) — visible only when archived years exist and user is admin
- History mode amber banner with "Return to {liveYear}" button

---

## Page Details

### Dashboard (`/`)
- **Stat cards** (click to navigate): Players → Teams, Courses → Courses, Matches → Schedule, Rounds → Results
- **Standings** — sorted by total `teamScores` points
- **Round Schedule** — list of rounds with date/time, links to Schedule page
- **Team Rosters** — 3 cards (click any → Teams page)
- **Finalize Tournament** — admin only, live year only; archives data and advances year

### Teams (`/teams`)
- Edit player name / handicap index (admin only)
- Add/remove substitutes (admin only)
- HDCP table: shows raw, netted, capped, final HDCPs for all 5 rounds (mirrors Excel)
- Handicap lock toggle prevents GHIN lookup changes

### Schedule (`/schedule`)
- Per-round card: format selector (admin), date/tee pickers (admin), tee times for Match A/B/C
- Player names shown under each match tee time
- **Scorecard links** under player names for each match (also shows blind matches)
- Format change warning if pairings exist (prompts to confirm + clear)
- Course summary bar (name, par, selected tee rating/slope/yardage)

### Pairings (`/pairings`) — Admin only
- Generate/Re-generate Pairings button
- Lock Pairings toggle (prevents edits)
- Per-round match cards: team colors, player names, edit button (inline editor)
- Regular matches and blind matches in separate columns
- Scorecard link on every match card

### Scorecards (`/scorecards`)
- Round tabs (1–5) + match selector list
- Per-match scorecard via `ScorecardCard` component (see below)
- Score entry inputs (canEnterScores role)
- Admin-only: Simulate Scores (random), Clear Scores, Clear All Scores
- Auto-recomputes team scores when scores change (format-specific logic)
- Deep links: `?match={matchId}&round={round}`

### Courses (`/courses`)
- Tab per course (4 courses)
- Course hero image, name, par, website (admin-editable)
- Tee table: Name | F9 yds | B9 yds | Total yds | Rating | Slope
- Official scorecard images with lightbox zoom
- F9 and B9 hole tables: Hole | Par | HDCP | [tee yardages], all columns centered
- Totals footer row in each hole table

### Results (`/results`)
- Grid: Team × Round with editable point cells (admin)
- Max points shown per round (9, 15, 7, 12, 7)
- Winner row highlighted with trophy
- CTP quick-link

### Par 3 CTP (`/ctp`)
- Auto-counts par-3 holes across all rounds from course data
- Pot = paid player count × par-3 count × $1/hole
- Per-hole CTP entry: round, hole, yardage, winner, paid toggle
- CTP donation tracker per player
- Historical CTP→HIO transfer bar chart

### Hole in One (`/hole-in-one`)
- HIO pot hero: current pot total, contributor count
- Champion entries: year, player, course, hole, yardage, date, notes, photo
- Photo upload (base64 stored in Zustand)
- Claim Pot: sums all paid unclaimed donations → sets `potClaimed` on HIO entry
- Per-player $20/year donation tracking with paid toggle (admin)

### Stats (`/stats`)
- Recharts LineChart: 21-year handicap trends (2006–2026) for all 12 players
- Year range filter, player visibility toggles, team group controls
- Colors keyed to team (3 shades per team)
- Data source: `data/hdcpHistory.ts` (static)

### Archive (`/archive`)
- Supabase Storage bucket `jugger-archive`
- File tree organized by year folder
- Type badges, file sizes, view/download links
- Admin: upload files, delete files
- Dev: served via Vite plugin reading `/JuggerHistory/` local filesystem

### History (`/history`)
- Searchable/filterable course database (28+ historical courses)
- Per-course detail: image, metadata, played rounds, scorecard
- Image upload (base64)
- **Assign to Tournament Round** — admin only
- Built-in `hist-*` entries seeded from `initialData.ts`

### Print All (`/print`)
- react-to-print renders all match scorecards, 2 per 8.5×11 page
- Cut line between top/bottom halves
- Round headers, page breaks between rounds
- @page: letter, 0.35in margins

---

## ScorecardCard Component

Renders the full interactive scorecard for one match. Handles all 5 formats.

**Props:** `match, teams, course, config, interactive?, onScoreChange?, onTeamHoleScoreChange?, onTeeShotChange?`

**Key behavior per format:**

| Format | Scoring cells | Net display | Result row |
|---|---|---|---|
| team_match_play | Per-player gross | Net per hole | Running +/- holes |
| points_round | Per-player gross | Stableford pts | Running quota delta |
| texas_scramble | Per-player gross | Net (60% HDCP) | Best-ball running total |
| individual_match | Per-player gross | Net per hole | Two 1v1 + 2v2 rows |
| captains_choice | Team hole score (admin) + tee shot selector | Net (15% team HDCP) | Running team total |

Stroke dots (`.` / `..`) calculated from `getStrokeDots(courseHdcp, holeHdcpRank)`.

R5: All 4 players share the same `teamHdcp = floor(Σ individual HDCPs × 0.15)`.

---

## Scoring Computation (`utils/matchplay.ts`)

Called in `ScorecardView` after every score entry:

- `computeMatchPlay(match, holes, hdcps)` — best-ball net per hole, running +/- holes
- `computePointsRound(match, holes, hdcps)` — gross Stableford vs quota
- `computeScramble(match, holes, hdcps)` — ball count rules (1/2/3/4 by hole range)
- `computeIndividualMatch(match, holes, hdcps)` — two `compute1v1` results + 2v2
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

getPlayerCourseHdcp(player, course, tee, round, allPlayers)
  → applies netting, 18-cap, round % (60% for R3)

apply18Cap(netted)
  → netted ≤ 18 ? netted : 18 + 0.5×(netted - 18)

getStrokeDots(courseHdcp, holeHdcpRank)
  → '' if rank > courseHdcp
  → '.' if rank ≤ courseHdcp ≤ 18 (or rank ≤ 18 for extras)
  → '..' if player gets 2 strokes on that hole

stablefordPoints(gross, par, strokes)
  → net = gross - strokes; returns 0/0.5/1/2/4/6/10
```

---

## Pairing Generation (`utils/pairings.ts`)

```
generateTwosomeMatches(teams, round)
  Shuffles 3 teams → T1/T2/T3
  Shuffles each team's 4 players → splits into twosomes A/B
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
base: '/Jugger/'               // GitHub Pages subdirectory
plugins: [react(), juggerHistoryPlugin()]
server: { port: 5173, open: true }
```

`juggerHistoryPlugin` is a dev-only middleware that serves `/api/history-files` (JSON tree) and `/api/history-file/:year/:filename` (stream) from the local `/JuggerHistory/` directory. Not available in production (replaced by Supabase Storage).

---

## Excel Workbook (`Jugger 2026 Schedule-HDCP.xlsm`)

Legacy macro-enabled workbook used before the web app existed.

| Sheet | Purpose |
|---|---|
| `Schedule` | Trip schedule, tee times, pairings, game rules |
| `HDCPs` | 2006–2026 handicap history + course HDCP calculations |
| `HDCP Calc` | Formula reference |
| `Skidmore HDCP` | High-handicap special calculations (Matt Skidmore ~28) |
| `Results` | Final point totals per round; CTP tracking |
| `Hole in 1` | HIO tracker |
| `1-Scorecard` through `5-Scorecard` | Printed course scorecards per round |
| `1a/1b/1c`, `1blinds` … `5a/5b/5c` | Per-match printable scorecards |

**Scorecard layout:** Two copies per sheet (top/bottom halves). Columns B=player, C=HDCP, D–V=holes 1–18, W–X=subtotals. Dot indicators (`.` / `..`) show when handicap strokes apply.

**Workflow:**
1. Update handicap indexes in `HDCPs` sheet
2. Verify course ratings/slopes
3. Update rosters if lineup changed
4. Confirm pairings in `Schedule`
5. Print match sheets for on-course use
6. Enter scores; `Results` aggregates totals
