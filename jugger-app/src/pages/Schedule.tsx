import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { RoundConfig, RoundFormat } from '../types'
import { Calendar, Clock, AlertTriangle, Shuffle, ClipboardList } from 'lucide-react'

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
  const { roundConfigs, courses, setRoundConfig, matches, teams, clearRoundMatches } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const [pendingFormat, setPendingFormat] = useState<{ round: number; format: RoundFormat } | null>(null)
  const [clearedRound, setClearedRound] = useState<number | null>(null)

  function handleFormatChange(round: number, newFormat: RoundFormat) {
    const current = roundConfigs.find(r => r.round === round)
    if (!current || newFormat === current.format) return
    if (matches.some(m => m.round === round)) {
      setPendingFormat({ round, format: newFormat })
    } else {
      applyFormatChange(round, newFormat, current)
    }
  }

  function applyFormatChange(round: number, newFormat: RoundFormat, existing: RoundConfig) {
    setRoundConfig({ ...existing, format: newFormat })
    setPendingFormat(null)
  }

  function confirmFormatChange() {
    if (!pendingFormat) return
    const existing = roundConfigs.find(r => r.round === pendingFormat.round)
    if (!existing) return
    clearRoundMatches(pendingFormat.round)
    applyFormatChange(pendingFormat.round, pendingFormat.format, existing)
    setClearedRound(pendingFormat.round)
  }

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
            <div key={rc.round} className="card border-l-4 border-masters-green space-y-3">
              {/* Header row: badge + format selector + rules */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="badge bg-masters-green text-white shrink-0">Round {rc.round}</span>
                  {isAdmin ? (
                    <select
                      className="font-serif font-bold text-lg text-masters-dark bg-transparent border-b-2 border-masters-green/40 focus:border-masters-green focus:outline-none cursor-pointer pr-1"
                      value={pendingFormat?.round === rc.round ? pendingFormat.format : rc.format}
                      onChange={e => handleFormatChange(rc.round, e.target.value as RoundFormat)}
                    >
                      {Object.entries(FORMAT_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="font-serif font-bold text-lg text-masters-dark">
                      {FORMAT_LABELS[rc.format] ?? rc.format}
                    </h3>
                  )}
                </div>
                <p className="text-xs text-gray-500">{FORMAT_RULES[pendingFormat?.round === rc.round ? pendingFormat.format : rc.format]}</p>

                {/* Pending format change warning */}
                {pendingFormat?.round === rc.round && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800">Round {rc.round} has existing pairings</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Changing to <strong>{FORMAT_LABELS[pendingFormat.format]}</strong> will clear all pairings for this round.
                        Scores entered so far will also be lost. You'll need to regenerate pairings afterward.
                      </p>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        <button
                          className="btn-primary text-xs py-1 px-3 bg-amber-500 border-amber-500 hover:bg-amber-600 focus:ring-amber-300"
                          onClick={confirmFormatChange}
                        >
                          Confirm — clear pairings &amp; change format
                        </button>
                        <button
                          className="text-xs text-gray-500 hover:text-gray-800"
                          onClick={() => setPendingFormat(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-change notice */}
                {clearedRound === rc.round && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-blue-700">
                    <Shuffle size={13} className="shrink-0 text-blue-500" />
                    <span>Pairings cleared — go to the <strong>Pairings</strong> page to regenerate.</span>
                    <button className="ml-auto text-blue-400 hover:text-blue-600 shrink-0" onClick={() => setClearedRound(null)}>✕</button>
                  </div>
                )}
              </div>

              {/* Date + Tees + Tee Times */}
              <div className="space-y-3">
                  {/* Date + Course + Tees row */}
                  <div className="grid sm:grid-cols-3 gap-3">
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
                      <label className="label">Course</label>
                      {isAdmin ? (
                        <select
                          className="input"
                          value={rc.courseId}
                          onChange={e => {
                            const newCourse = courses.find(c => c.id === e.target.value)
                            const firstTee = newCourse?.tees.find(t => t.rating != null && t.slope != null)
                            const existing = roundConfigs.find(r => r.round === rc.round)
                            if (!existing) return
                            setRoundConfig({ ...existing, courseId: e.target.value, tee: firstTee?.name ?? '' })
                          }}
                        >
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-medium text-masters-dark">{course?.name || '—'}</span>
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
                                <Link
                                  to={`/scorecards?match=${m.id}&round=${m.round}`}
                                  className="mt-1.5 flex items-center gap-1 text-masters-green hover:text-masters-dark font-semibold transition-colors"
                                >
                                  <ClipboardList size={10} /> Scorecard
                                </Link>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Blind matches */}
                    {(() => {
                      const blinds = [1, 2, 3]
                        .map(n => matches.find(x => x.id === `${rc.round}blind${n}`))
                        .filter(Boolean)
                      if (blinds.length === 0) return null
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Blind Matches</div>
                          <div className="grid grid-cols-3 gap-2">
                            {blinds.map(m => m && (
                              <div key={m.id} className="text-xs leading-snug">
                                <div className="text-gray-400 mb-0.5">{m.label}</div>
                                <div className="font-medium text-masters-dark">
                                  {playerName(m.twosome1.playerIds[0])} &amp; {playerName(m.twosome1.playerIds[1])}
                                </div>
                                <div className="text-gray-400 text-[10px]">vs</div>
                                <div className="font-medium text-masters-dark">
                                  {playerName(m.twosome2.playerIds[0])} &amp; {playerName(m.twosome2.playerIds[1])}
                                </div>
                                <Link
                                  to={`/scorecards?match=${m.id}&round=${m.round}`}
                                  className="mt-1.5 flex items-center gap-1 text-masters-green hover:text-masters-dark font-semibold transition-colors"
                                >
                                  <ClipboardList size={10} /> Scorecard
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

              {/* Course summary */}
              {course && (
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 bg-masters-cream rounded p-2">
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
