# Jugger 2026 — Juggerknocker Invitational Golf Trip

## Web Application

A React/TypeScript web app lives in `jugger-app/`. To run for demo:

```bash
cd jugger-app
npm install
npm run dev        # opens http://localhost:5173
```

### App Features

| Feature | Details |
|---|---|
| **Year management** | Tournament year shown in header, editable on Dashboard |
| **Team rosters** | Edit player names; add/remove substitutes per team |
| **GHIN lookup** | Search by GHIN # or name; confirm result before applying; manual fallback; lock all HDCPs before event |
| **Courses** | View/edit all 4 course hole-by-hole: par, HDCP order, yardages per tee, rating/slope |
| **Schedule** | Set date, tee time, and tees for each round; rules displayed per format |
| **Pairings** | Randomize or manually edit all 5 rounds; twosomes for Rounds 1/2/4, team format for Rounds 3/5; blind matches auto-generated |
| **Scorecards** | Interactive score entry per match; handicap dots per hole computed from USGA formula; round-specific HDCP %; running gross/net/points summary |
| **Results** | Team standings table with editable scores per round; Closest-to-Pin tracker |
| **Hole in One** | Full tracking: player, course, hole, date, notes/witnesses |
| **Print All** | Prints all scorecards at once — 2 cards per 8.5×11 sheet |

### Tech Stack

- **Vite + React 18 + TypeScript** — fast dev server, VS Code friendly
- **Zustand** with `persist` middleware — state saved to `localStorage` automatically
- **Tailwind CSS** — Masters Tournament theme (Augusta green `#006747`, gold `#C9A84C`, cream `#F8F4EE`)
- **react-to-print** — handles browser print with 2-per-page scorecard layout
- **lucide-react** — icons

### Key Files

| File | Purpose |
|---|---|
| `src/data/courseData.ts` | Pre-populated hole data for all 4 courses |
| `src/data/initialData.ts` | Pre-populated team rosters and handicap indexes |
| `src/utils/handicap.ts` | Course HDCP formula, stroke dot allocation, Stableford points |
| `src/utils/pairings.ts` | Random pairing generation using round-robin twosome matrix |
| `src/components/ScorecardCard.tsx` | Printable scorecard component with handicap dots |
| `src/store/useTournamentStore.ts` | Zustand store — all state and actions |

### Pairing Algorithm

Each round (1, 2, 4) randomly assigns teams as T1/T2/T3, randomly splits each team into 2 twosomes, then applies a fixed balanced matrix:

- Regular A: T1A vs T2A · Regular B: T1B vs T3A · Regular C: T2B vs T3B
- Blind 1: T3B vs T1A · Blind 2: T2A vs T3A · Blind 3: T2B vs T1B

Each twosome plays exactly 2 matches (1 regular + 1 blind), never against the same team twice.

### Corrected Round/Course Assignment

| Round | Course | Format |
|---|---|---|
| Round 1 | Pine Needles | Team Match Play (Thursday PM) |
| Round 2 | Pinewild Magnolia | Points Round (Friday AM) |
| Round 3 | Pinewild Holly | Texas Scramble (Friday PM) |
| Round 4 | Mid South | Individual Match Play (Saturday AM) |
| Round 5 | Mid South | Captain's Choice (Saturday PM) |

---

## Project Overview

`Jugger 2026 Schedule-HDCP.xlsm` is a macro-enabled Excel workbook that manages the annual Juggerknocker Invitational golf trip. It generates printed scorecards for each round showing:
- Which golfers are paired against each other
- Course information (yardages, par, hole handicap order)
- Per-hole stroke indicators showing when a golfer receives a handicap stroke (marked with `.`)

There are **3 teams of 4 golfers** competing across **5 rounds** over the trip.

---

## Teams & Rosters

| Billy Baroo | #ballgame | Silverbacks |
|---|---|---|
| Michael Quade | Ron Pitts | Danny Woyahn |
| Nick Whitman | Daniel Gunter | Matt Skidmore |
| Nate Butterworth | John Oxford | Chad Bender |
| Bryan Holcomb | Chris Oncavage | Hunter Morris |

---

## Pairings and Scheduling
| The pairings for matches and blinds must follow the following rules:
| Every team member plays a day with each of their other three team members.  Rotate each date to a different team member.  If there are two matches in a day both team members stay together the whole day.  
| Teams pair up each day and play against an opposing team pair in each match.
| Team pairs both do not play the same opposing team pairs in a single match.  
| Blind matches are ideally set up for a team to be blind against a different team than they played in the live match.  This may not always be possible though.
| Limit teams or individuals playing against the same team or other individuals multiple times.

---

## Courses

| Course | Rating/Slope | Used In |
|---|---|---|
| Pine Needles | 71.9/138 (Ross tees) | Round 1 |
| Pinewild Magnolia | 70.9/127 (White tees) | Round 2 AM |
| Pinewild Holly | 71.2/127 | Round 2 PM |
| Mid South | 72.1/139 | Rounds 3, 4, 5 |

---

## Rounds

### Round 1 — Team Match Play (Pine Needles)
Each match is two golfers (one twosome) vs. two golfers from another team. Scores kept as **NET** on each hole. Each twosome takes its best NET score; lowest score wins the hole. Most holes won wins the match.
- Regular match: **2 pts**
- Blind match: **1 pt**

### Round 2 — Points Round (Pinewild Magnolia AM + Pinewild Holly PM)
Twosomes paired against a twosome from another team. Each player is assigned a **point quota** based on course handicap. Team with accumulated points relative to quota wins. Scoring on **gross**:
- Double Bogey = ½ pt, Bogey = 1, Par = 2, Birdie = 4, Eagle = 6, Albatross = 10
- Regular match: **2 pts**
- Blind match: **1 pt**
- Magic Ball (teammates alternate teeing off with the Magic Ball): **1 pt per ball**

### Round 3 — Texas Scramble (Mid South)
All players tee off and pick the best drive; everyone plays from that drive. Count best NET scores using 60% of handicap:
- Holes 1–6: best 1 ball
- Holes 7–12: best 2 balls
- Holes 13–15: best 3 balls
- Holes 16–18: best 4 balls
- Finish: 1st = 4 pts, 2nd = 2 pts, 3rd = 1 pt

### Round 4 — Individual Match Play (Mid South)
Each player plays their own ball; NET scoring; straight match play.
- Each individual match: **1 pt**
- Each team twosome's best single score vs. the other twosome: **1 pt**
- Blind match: **½ pt**

### Round 5 — Captain's Choice (Mid South)
Team captain picks the shot to play. Handicap = 15% of the team's total handicap (rounded down); minimum **3 tee balls** must be used per player.
- Finish: 1st = 4 pts, 2nd = 2 pts, 3rd = 1 pt

---

## Handicap System

Handicaps follow the **USGA Rules of Handicapping** (https://www.usga.org/handicapping/roh/2020-rules-of-handicapping.html).

**Course Handicap formula:**
```
Course HDCP = Handicap Index × (Slope / 113) + (Course Rating – Par)
```

### Round-specific HDCP percentages

| Round | Format | HDCP % |
|---|---|---|
| Round 1 (Match Play) | Net HDCP, full strokes | Per-player course HDCP |
| Round 2 (Points) | 10% of 2009 Gross HDCP | Gross quotas |
| Round 3 (Scramble) | 60% of course HDCP | Best-ball rules apply |
| Round 4 (Individual) | Full course HDCP | Net per hole |
| Round 5 (Cap'n Choice) | 15% of team aggregate | Team-level |

Additional rules:
- Over-18 handicap cap: **50%** applied to strokes above 18
- Team HDCP base percentage: **15%**

Matt Skidmore has a dedicated `Skidmore HDCP` sheet due to his high handicap index (~28).

---

## Workbook Sheet Structure

### Reference / Setup Sheets

| Sheet | Purpose |
|---|---|
| `Schedule` | Full trip schedule: dates, tee times, team pairings per round, game rules |
| `HDCPs` | Golfer handicap history (2006–2025) and computed course handicaps for each course |
| `HDCP Calc` | Handicap calculation formulas and USGA reference |
| `Skidmore HDCP` | Matt Skidmore's high-handicap special calculations |
| `Results` | Final point totals per round per team; Closest-to-Pin tracking |
| `Hole in 1` | Hole-in-one tracking |

### Course Scorecards (printed reference)

| Sheet | Course |
|---|---|
| `1-Scorecard` | Pine Needles (Round 1) |
| `2-Scorecard` | Pinewild Magnolia (Round 2) |
| `3-Scorecard` | Mid South (Round 3) |
| `4-Scorecard` | Mid South (Round 4) |
| `5-Scorecard` | Mid South (Round 5) |

Each scorecard sheet contains hole numbers, yardages by tee (multiple tee options), par, and course handicap order for all 18 holes.

### Match Scorecards (printed and used on course)

Match sheets follow the pattern `{round}{match}`:

| Sheet Pattern | Description |
|---|---|
| `1a`, `1b`, `1c` | Round 1 match scorecards (A, B, C pairings) |
| `1blinds` | Round 1 blind match scorecards |
| `2a`, `2b`, `2c` | Round 2 match scorecards |
| `2blinds` | Round 2 blind match scorecards |
| `3a`, `3b`, `3c` | Round 3 match scorecards |
| `4a`, `4b`, `4c` | Round 4 match scorecards |
| `4blinds` | Round 4 blind match scorecards |
| `5a`, `5b`, `5c` | Round 5 match scorecards |

---

## Scorecard Layout Convention

Each match sheet contains two copies of the same scorecard (top and bottom half of sheet) to allow both sides of a match to keep their own card.

**Columns:** `B` = player name / label, `C` = player's course handicap, `D`–`V` = holes 1–18, `W`–`X` = subtotals/total.

**Stroke indicators:** A `.` in a hole cell means the golfer **receives a handicap stroke on that hole**. Two dots `..` means two strokes. The number of dots per row equals the golfer's course handicap, distributed across the holes in handicap-order priority.

**Row structure per match:**
1. Course name + game type header
2. Par row for all 18 holes
3. Yardage row (tees played)
4. Course HDCP order row
5. Player 1 — name, handicap, stroke dots
6. Player 2 — name, handicap, stroke dots
7. `+/- Holes` row (match play result tracking)
8. Player 3 — name, handicap, stroke dots
9. Player 4 — name, handicap, stroke dots
10. `+/- Holes` row
11. Rules note for the round

---

## Key Formulas & Logic

- **Handicap stroke allocation:** Strokes are placed on holes in course-HDCP order (hole ranked 1 receives the first stroke, hole ranked 2 the second, etc.). This determines where `.` markers appear per player.
- **Points Round quota:** Based on 10% of the 2009 historical gross handicap — a custom group-internal formula, not standard USGA.
- **Cap'n Choice HDCP:** `floor(team_aggregate_hdcp × 0.15)`
- **Scramble HDCP:** `floor(course_hdcp × 0.60)`

---

## Workflow for Updating Each Year

1. Update golfer **handicap indexes** in the `HDCPs` sheet (new column for current year).
2. Verify or update **course ratings and slopes** for the courses being played.
3. Update **team rosters** if the lineup changes.
4. Confirm **round pairings** in the `Schedule` sheet.
5. Recalculate course handicaps — the formula cells in `HDCPs` propagate to match sheets automatically.
6. Print match sheets (`1a`/`1b`/`1c`, `1blinds`, etc.) for on-course use.
7. Enter scores into match sheets during/after play; `Results` sheet aggregates totals.
