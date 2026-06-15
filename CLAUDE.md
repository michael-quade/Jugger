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

---

## Project Structure

```
jugger-app/src/
  App.tsx                       # Router setup, default admin bootstrap, Supabase init
  main.tsx                      # ReactDOM.createRoot, HashRouter
  index.css                     # Tailwind + custom component styles
  types/index.ts                # All TypeScript interfaces
  store/
    useTournamentStore.ts       # Zustand store v18 (all state + actions)
    useAuthStore.ts             # Auth state (admin/scorer login)
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
    hdcpHistory.ts              # Static HDCP history 2006–2025; Stats merges with
                                #   archivedYears dynamically for 2026+
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
                                #   RoundInfoBanner reads live gameConfig
    Courses.tsx                 # Active-year courses only (from roundConfigs); hole data
    RoundGames.tsx              # Game format rules + configurable house parameters
                                #   (admin only); changes apply immediately to scoring
    Results.tsx                 # Editable team standings table
    CtpPage.tsx                 # Par 3 CTP pot management
    HoleInOne.tsx               # HIO champion tracking + pot management
    Stats.tsx                   # Handicap history charts (auto-merged from archivedYears)
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
  isPermanentReplacement?: boolean // permanent roster change; kept after finalizeYear
  replacedPlayerName?: string     // name of the player they replaced
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
}

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
  skidmoreScores: SkidmoreScore[]
  sandbaggerPlayerId?: string       // player id holding Sandbagger Award
  toiletAwardPlayerId?: string      // player id holding Toilet Award
  defendingChampionTeamId?: string  // team id of prior year's champion
  gameConfig: GameConfig            // house rules; wired into scoring calculations
}

AdminCredential { username, passwordHash, role?: 'admin' | 'scorer' }
```

---

## State Management

### Zustand Store (`useTournamentStore`) — version 18

Persists to `localStorage` key `jugger-tournament-2026`. All 18 versions have migration functions.

**Key actions:**
- `setYear / lockHandicaps / setPairingsLocked`
- `updatePlayer / addPlayer / removePlayer / updateTeamName / updateTeamColor`
- `substitutePlayer` — replaces a player with a single-year sub (reverts on `finalizeYear`)
- `revertSubstitute` — restores original player before finalization
- `permanentlyReplacePlayer` — replaces a player permanently (kept after `finalizeYear`)
- `makeSubPermanent` — upgrades an existing sub to a permanent replacement
- `setCourse / setRoundConfig`
- `setMatches / updateMatch / setMatchScore / setTeamHoleScore / setTeeShot`
- `setTeamScore / clearAllTeamScores / clearTeamScoresForRound`
- `clearMatchScores / clearAllMatchScores / clearRoundMatches`
- `addAdmin / updateAdmin / removeAdmin`
- `setSandbaggerPlayer(id)` / `setToiletAwardPlayer(id)` — assign end-of-year awards
- `setDefendingChampion(teamId)` — manually assign/override defending champion team
- `setGameConfig(config)` — update house rules; triggers handicap module singleton update
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

**Score propagation:** When a non-blind match score changes, the store automatically propagates those scores to the player's corresponding blind match in the same round.

**GameConfig sync:** After store creation, a module-level subscriber calls `configureHdcpSettings(state.gameConfig)` on every state change so handicap calculations stay in sync without threading config through every call site.

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

**APP_STATE_KEYS** (synced as single JSON): `year, teams, courses, roundConfigs, holeInOnes, ctpEntries, ctpDonations, ctpHioHistory, hdcpLocked, courseHistory, admins, pairingsLocked, hioDonations, skidmoreScores, sandbaggerPlayerId, toiletAwardPlayerId, defendingChampionTeamId, gameConfig`

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
| **Guest** | No login | Read-only view of all pages except Pairings, Round Games, and Skidmore HDCP |

### Page-Level Access

| Page | Guests | Scorers | Admins |
|---|---|---|---|
| Dashboard | Read | Read | Full (lock HDCP, assign awards, finalize year) |
| Teams | Read | Read | Full (edit names, HDCP, substitutes, permanent replacements, awards) |
| Schedule | Read | Read | Full (edit dates, tee times, format) |
| **Pairings** | **Hidden** | **Hidden** | Full (generate, edit, lock) |
| Scorecards | Read | Enter scores, Magic Ball, match result | Full + simulate + clear |
| Courses | Read | Read | Full (edit hole data) |
| **Round Games** | **Hidden** | **Hidden** | Full (view rules, edit house parameters) |
| Team Results | Read | Read | Edit scores |
| Par 3 CTP | Read | Read | Full |
| Hole in One | Read | Read | Full |
| Stats | Read | Read | Read |
| Archive | Read | Read | Upload/delete files |
| History | Read | Read | Add/edit/delete courses; assign to round |
| Print All | Print | Print | Print |
| **Skidmore HDCP** | **Hidden** | **Hidden** | Full (add/edit scores, auto-applies HDCP) |

### Account Management

Admins open the "Manage Accounts" panel (Header → Manage). Two sections:
- **Admins** — full access accounts
- **Scorers** — score-entry-only accounts

Both use SHA-256 password hashing via Web Crypto API.

---

## Navigation Order

1. Dashboard · 2. Teams · 3. Schedule · 4. Pairings *(admin only)* · 5. Scorecards · 6. Courses · 7. Round Games *(admin only)* · 8. Team Results · 9. Par 3 CTP · 10. Hole in One · 11. Stats · 12. Archive · 13. History · 14. Print All · 15. Skidmore HDCP *(admin only)*

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
- Entire chrome (header + sub-nav + history banner) wrapped in one `sticky top-0 z-50` div — all three scroll as a unit and stay pinned
- Header: tournament logo, title (links to Dashboard), year badge, sync status dot, admin widget
- Admin year selector (dropdown) — visible only when archived years exist and user is admin
- History mode amber banner with "Return to {liveYear}" button

---

## Page Details

### Dashboard (`/`)
- **Champion hero** — when tournament is complete, displays the winning team with trophy, color banner, and Ryder Cup tiebreaker logic (via `utils/champion.ts`)
- **Stat cards** (click to navigate): Players → Teams, Courses → Courses, Matches → Schedule, Rounds → Results
- **Standings** — sorted by total `teamScores` points
- **Round Schedule** — list of rounds with date/time, links to Schedule page
- **Team Rosters** — 3 cards with team name row showing `🏆 Defending Champs` badge (right side, baseline-aligned) for the defending champion team; players with `ghinNumber` can be looked up via GHIN; Sandbagger and Toilet Award thumbnail images (`h-5 w-5`) shown inline next to award holders' names
- **Admin controls**: dropdown to manually assign defending champion team
- **Finalize Tournament** — admin only, live year only; Step 1: pick Sandbagger and Toilet Award winners; Step 2: confirm and archive

### Teams (`/teams`)
- Edit player name / handicap index / GHIN number (admin only)
- **Substitute player system** — admin can swap a player for a single-year sub; sub reverts to original player on `finalizeYear`; badge: `SUB`
- **Permanent replacement** — admin can permanently replace a player; carried forward on `finalizeYear`; badge: `PERM`
- **Make Sub Permanent** — upgrades an existing sub to a permanent roster member
- HDCP table: raw, netted, capped, final HDCPs for all rounds; column headers show course name and format; note distinguishes 60% scramble rounds dynamically based on `roundConfigs.format`
- Handicap lock toggle prevents edits; Captain's Choice team aggregate shown dynamically
- **Award images** — player row shows `sandbagger.jpg` or `toilet_award.webp` (`h-full` filling the row height) for award holders; admin can assign/remove via thumbnail buttons; `✕` overlay removes the award
- **Defending Champions** — team name row shows `🏆 Defending Champs` text; admin can click it to remove, or click `🏆` on other teams to assign

### Schedule (`/schedule`)
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
- Round tabs (1–5) + match selector list
- **Round Info Banner** — per-round description panel above matches; reads live from `gameConfig` via `getFormatInfo(gc)` so all point values, pcts, and descriptions update instantly when house rules change
- Per-match scorecard via `ScorecardCard` component (see below)
- Score entry inputs (canEnterScores role)
- Admin-only: **Simulate Scores** (per-round or global), Clear Scores, Clear All Scores
  - Simulate includes Magic Ball random assignment for non-blind Points Round matches
  - Clear sets `magicBall1/2: undefined` in addition to clearing scores
- Auto-recomputes team scores when scores change (format-specific logic)
- Deep links: `?match={matchId}&round={round}`

### Courses (`/{year} Courses` at `/courses`)
- Shows **only** courses assigned in the current year's `roundConfigs`; empty state if none assigned
- Tab per active course
- Course hero image, name, par, website (admin-editable)
- Tee table: Name | F9 yds | B9 yds | Total yds | Rating | Slope
- Official scorecard images with lightbox zoom
- F9 and B9 hole tables: Hole | Par | HDCP | [tee yardages], all columns centered
- Totals footer row in each hole table

### Round Games (`/round-games`) — Admin only
- Card per format (Team Match Play, Points Round, Texas Scramble, Individual Match Play, Captain's Choice)
- Each card: format name + informal nickname, assigned round badge, description, "How It Works" bullet list, HDCP note
- **Configurable parameters** — admin-editable inputs; changes take effect immediately for all scoring and descriptions:
  - Texas Scramble: HDCP %, finish points (1st/2nd/3rd)
  - Captain's Choice: HDCP %, min tee balls per player, finish points
  - Points Round: Magic Ball on/off, blinds on/off, all 6 Stableford point values, regular/blind match points
  - Team Match Play: blinds on/off, regular/blind match points
  - Individual Match Play: blinds on/off, match/twosome/blind point values
- **Match Structure** reference card at bottom: twosome matrix (T1A vs T2A etc.) and team format rules
- **Reset to Defaults** button restores `DEFAULT_GAME_CONFIG`
- Round badge shows currently-assigned round from `roundConfigs` (updates live when Schedule changes format)

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
- Recharts LineChart: handicap trends for all 12 players across all recorded years
- Data auto-merged: static `data/hdcpHistory.ts` (2006–2025) + dynamic `archivedYears` + live year — no manual edits needed when a year is finalized
- Year range filter, player visibility toggles, team group controls
- Colors keyed to team (3 shades per team)
- Career summary header shows latest available year

### Archive (`/archive`)
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

### Print All (`/print`)
- react-to-print renders all match scorecards, 2 per 8.5×11 page
- Cut line between top/bottom halves
- Round headers, page breaks between rounds
- @page: letter, 0.35in margins

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

Stroke dots (`.` / `..`) calculated from `getStrokeDots(courseHdcp, holeHdcpRank)`.

R5: All 4 players share the same `teamHdcp = floor(Σ individual HDCPs × captainsChoiceHdcpPct)`.

---

## Scoring Computation (`utils/matchplay.ts`)

Called in `ScorecardView` after every score entry:

- `computeMatchPlay(match, holes, hdcps)` — best-ball net per hole, running +/- holes
- `computePointsRound(match, holes, hdcps)` — gross Stableford vs quota; twosome quota = `coursePar − (hdcpA + hdcpB)` where `coursePar` is derived from the `holes` array
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
