import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { RoundConfig } from '../types'
import { Calendar, Clock } from 'lucide-react'

const FORMAT_LABELS: Record<string, string> = {
  team_match_play: 'Team Match Play',
  points_round: 'Points Round',
  texas_scramble: 'Texas Scramble',
  individual_match: 'Individual Match Play',
  captains_choice: "Captain's Choice",
}

const FORMAT_RULES: Record<string, string> = {
  team_match_play:
    'Two vs Two, Best Ball Net. Each twosome takes its best NET score per hole. Most holes won wins. Match = 2 pts, Blind = 1 pt.',
  points_round:
    'Gross Stableford. Dbl Bogey = ½, Bogey = 1, Par = 2, Birdie = 4, Eagle = 6, Albatross = 10. Quota = 36 – Course HDCP. Match = 2 pts, Blind = 1 pt, Magic Ball = 1 pt/ball.',
  texas_scramble:
    'All players tee off, pick best drive, play own ball. 60% HDCP. Best 1 ball H1–6, 2 balls H7–12, 3 balls H13–15, 4 balls H16–18. 1st=4, 2nd=2, 3rd=1 pt.',
  individual_match:
    'Each player plays own ball, NET scoring. Individual match = 1 pt. Twosome best-ball sub-match = 1 pt. Blind = ½ pt.',
  captains_choice:
    "Captain picks the shot. HDCP = floor(team aggregate × 15%). Min 3 tee balls per player. 1st=4, 2nd=2, 3rd=1 pt.",
}

function fmt24to12(t: string): string {
  if (!t) return '—'
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

const MATCH_LABELS = ['Match A', 'Match B', 'Match C'] as const

export default function Schedule() {
  const { roundConfigs, courses, setRoundConfig, matches, teams } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const playerName = (id: string) => {
    for (const t of teams) {
      const p = t.players.find(p => p.id === id)
      if (p) return p.name.split(' ')[0] // first name only to keep it compact
    }
    return id
  }

  const sorted = [...roundConfigs].sort((a, b) => a.round - b.round)

  function updateField(round: number, field: keyof RoundConfig, value: string) {
    if (!isAdmin) return
    const existing = roundConfigs.find(r => r.round === round)
    if (!existing) return
    setRoundConfig({ ...existing, [field]: value } as RoundConfig)
  }

  function updateTeeTime(round: number, matchIdx: 0 | 1 | 2, value: string) {
    if (!isAdmin) return
    const existing = roundConfigs.find(r => r.round === round)
    if (!existing) return
    const times: [string, string, string] = [...(existing.teeTimes ?? ['', '', ''])] as [string, string, string]
    times[matchIdx] = value
    setRoundConfig({ ...existing, teeTimes: times })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-masters-dark">Round Schedule &amp; Tee Times</h1>
      <p className="text-sm text-gray-500">
        {isAdmin ? 'Set dates, tee times, and which tees to play for each round.' : 'Dates, tee times, and course assignments for each round.'}
      </p>

      <div className="space-y-4">
        {sorted.map(rc => {
          const course = courses.find(c => c.id === rc.courseId)
          const times = rc.teeTimes ?? ['', '', '']
          return (
            <div key={rc.round} className="card border-l-4 border-masters-green">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-masters-green text-white">Round {rc.round}</span>
                    <h3 className="font-serif font-bold text-lg text-masters-dark">
                      {FORMAT_LABELS[rc.format] ?? rc.format}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{FORMAT_RULES[rc.format]}</p>
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Date + Tees row */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label flex items-center gap-1">
                        <Calendar size={11} /> Date
                      </label>
                      {isAdmin ? (
                        <input
                          type="date"
                          className="input"
                          value={rc.date ?? ''}
                          onChange={e => updateField(rc.round, 'date', e.target.value)}
                        />
                      ) : (
                        <span className="text-sm font-medium text-masters-dark">
                          {rc.date
                            ? new Date(rc.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="label">Tees</label>
                      {isAdmin ? (
                        <select
                          className="input"
                          value={rc.tee}
                          onChange={e => updateField(rc.round, 'tee', e.target.value)}
                        >
                          {(course?.tees ?? []).filter(t => t.rating != null && t.slope != null).map(t => {
                            const fromHoles = (course?.holes ?? []).reduce((s, h) => s + (h.yardages[t.name] ?? 0), 0)
                            const holesWithData = (course?.holes ?? []).filter(h => h.yardages[t.name] != null).length
                            const yards = holesWithData === 18 ? fromHoles : (t.totalYards ?? null)
                            const yardsStr = yards ? ` · ${yards.toLocaleString()} yds` : ''
                            return (
                              <option key={t.name} value={t.name}>
                                {t.name}{yardsStr} · {t.rating}/{t.slope}
                              </option>
                            )
                          })}
                        </select>
                      ) : (
                        <span className="text-sm font-medium text-masters-dark">{rc.tee || '—'}</span>
                      )}
                    </div>
                  </div>

                  {/* Tee times per match group */}
                  <div>
                    <label className="label flex items-center gap-1">
                      <Clock size={11} /> Tee Times
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {MATCH_LABELS.map((label, idx) => {
                        const matchId = `${rc.round}${['a','b','c'][idx]}`
                        const m = matches.find(x => x.id === matchId)
                        return (
                          <div key={label}>
                            <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                            {isAdmin ? (
                              <input
                                type="time"
                                className="input text-sm"
                                value={times[idx] ?? ''}
                                onChange={e => updateTeeTime(rc.round, idx as 0 | 1 | 2, e.target.value)}
                              />
                            ) : (
                              <span className="text-sm font-semibold text-masters-dark">
                                {fmt24to12(times[idx] ?? '')}
                              </span>
                            )}
                            {m && (
                              <div className="mt-1.5 text-xs leading-snug">
                                <div className="font-medium text-masters-dark">
                                  {playerName(m.twosome1.playerIds[0])} &amp; {playerName(m.twosome1.playerIds[1])}
                                </div>
                                <div className="text-gray-400 text-[10px]">vs</div>
                                <div className="font-medium text-masters-dark">
                                  {playerName(m.twosome2.playerIds[0])} &amp; {playerName(m.twosome2.playerIds[1])}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Course summary */}
              {course && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 bg-masters-cream rounded p-2">
                  <span><strong>Course:</strong> {course.name}</span>
                  <span><strong>Par:</strong> {course.par}</span>
                  {course.tees.filter(t => t.rating != null && t.name === rc.tee).map(t => {
                    const fromHoles = course.holes.reduce((s, h) => s + (h.yardages[t.name] ?? 0), 0)
                    const holesWithData = course.holes.filter(h => h.yardages[t.name] != null).length
                    const yards = holesWithData === 18 ? fromHoles : (t.totalYards ?? null)
                    return (
                      <span key={t.name}>
                        <strong>{t.name}:</strong> {yards ? `${yards.toLocaleString()} yds · ` : ''}{t.rating}/{t.slope}
                      </span>
                    )
                  })}
                  {course.website && (
                    <a href={course.website} target="_blank" rel="noopener noreferrer" className="text-masters-green underline">
                      Course website ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
