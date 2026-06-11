import { useState, useMemo, useEffect } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { SkidmoreScore } from '../types'
import { Lock, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Calculator, AlertTriangle, Info } from 'lucide-react'

// ─── WHS Handicap Calculation ────────────────────────────────────────────────

// Number of lowest differentials to use based on score count (WHS 2024)
const DIFF_USE_TABLE: Record<number, number> = {
  3: 1, 4: 1, 5: 1,
  6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3,
  12: 4, 13: 4, 14: 4,
  15: 5, 16: 5,
  17: 6, 18: 6,
  19: 7, 20: 8,
}

function calcDiff(score: number, rating: number, slope: number): number {
  return Math.round((113 / slope) * (score - rating) * 10) / 10
}

interface HdcpResult {
  handicapIndex: number
  average: number
  usedCount: number
  totalConsidered: number
  usedIds: Set<string>
}

function calcHandicapIndex(
  scores: Array<SkidmoreScore & { isTournament?: boolean }>,
): HdcpResult | null {
  if (scores.length < 3) return null

  // Sort oldest → newest; take most recent 20
  const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date))
  const window = sorted.slice(-20)

  const n = window.length
  const useCount = DIFF_USE_TABLE[Math.min(n, 20)]
  if (!useCount) return null

  // Pair each score with its id and differential
  const withDiff = window.map(s => ({ id: s.id, diff: calcDiff(s.score, s.rating, s.slope) }))
  const byDiff = [...withDiff].sort((a, b) => a.diff - b.diff)
  const chosen = byDiff.slice(0, useCount)

  const avg = chosen.reduce((s, v) => s + v.diff, 0) / useCount
  const raw = avg * 0.96
  const index = Math.min(Math.floor(raw * 10) / 10, 54.0)

  return {
    handicapIndex: index,
    average: avg,
    usedCount: useCount,
    totalConsidered: n,
    usedIds: new Set(chosen.map(c => c.id)),
  }
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

const EMPTY_FORM = { date: '', course: '', rating: '', slope: '', score: '', notes: '' }

function ScoreForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<typeof EMPTY_FORM>
  onSave: (v: typeof EMPTY_FORM) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const diff = form.rating && form.slope && form.score
    ? calcDiff(parseFloat(form.score), parseFloat(form.rating), parseFloat(form.slope))
    : null

  const valid =
    form.date.trim() !== '' &&
    form.course.trim() !== '' &&
    !isNaN(parseFloat(form.rating)) &&
    !isNaN(parseFloat(form.slope)) &&
    !isNaN(parseFloat(form.score))

  return (
    <div className="card border border-masters-green/30 space-y-3">
      <h3 className="font-semibold text-masters-dark text-sm">
        {initial?.date ? 'Edit Score' : 'Add Score'}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input text-sm w-full" value={form.date} onChange={set('date')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Course</label>
          <input className="input text-sm w-full" placeholder="Course name" value={form.course} onChange={set('course')} />
        </div>
        <div>
          <label className="label">Course Rating</label>
          <input type="number" step="0.1" className="input text-sm w-full" placeholder="e.g. 71.4" value={form.rating} onChange={set('rating')} />
        </div>
        <div>
          <label className="label">Slope</label>
          <input type="number" className="input text-sm w-full" placeholder="e.g. 127" value={form.slope} onChange={set('slope')} />
        </div>
        <div>
          <label className="label">Adj. Gross Score</label>
          <input type="number" className="input text-sm w-full" placeholder="e.g. 104" value={form.score} onChange={set('score')} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes (optional)</label>
          <input className="input text-sm w-full" placeholder="e.g. Jugger 2026 R1" value={form.notes} onChange={set('notes')} />
        </div>
        {diff !== null && (
          <div className="flex items-center gap-1.5 text-sm text-masters-green font-semibold">
            <Calculator size={14} />
            Differential: {diff.toFixed(1)}
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-sm" disabled={!valid} onClick={() => onSave(form)}>
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SkidmoreHdcp() {
  const {
    teams, hdcpLocked, isViewingHistory, matches, courses, roundConfigs, year,
    skidmoreScores, addSkidmoreScore, updateSkidmoreScore, removeSkidmoreScore, updatePlayer,
  } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  // Find Matt in teams
  const mattInfo = useMemo(() => {
    for (const team of teams) {
      const player = team.players.find(p => p.id === 'skidmore' || p.name.toLowerCase().includes('skidmore'))
      if (player) return { player, teamId: team.id }
    }
    return null
  }, [teams])

  // Compute tournament scores from current match data (auto-adds/removes with simulation)
  const tournamentScores = useMemo((): Array<SkidmoreScore & { isTournament: true; round: number }> => {
    if (!mattInfo) return []
    const seen = new Set<number>()
    const result: Array<SkidmoreScore & { isTournament: true; round: number }> = []

    for (const match of matches) {
      if (match.isBlind) continue // use regular match only (scores propagate to blind anyway)
      const allIds = [...match.twosome1.playerIds, ...match.twosome2.playerIds]
      if (!allIds.includes(mattInfo.player.id)) continue
      if (seen.has(match.round)) continue

      const holeRecord = match.scores[mattInfo.player.id] ?? {}
      const holeNums = Object.keys(holeRecord).map(Number)
      if (holeNums.length < 18) continue
      if (holeNums.some(h => holeRecord[h] === null || holeRecord[h] === undefined)) continue

      const rc = roundConfigs.find(r => r.round === match.round)
      if (!rc) continue
      const course = courses.find(c => c.id === rc.courseId)
      if (!course) continue
      const tee = course.tees.find(t => t.name === rc.tee) ?? course.tees[0]
      if (!tee?.rating || !tee?.slope) continue

      const total = holeNums.reduce((s, h) => s + (holeRecord[h] ?? 0), 0)
      seen.add(match.round)
      result.push({
        id: `tournament-${year}-r${match.round}`,
        date: rc.date ?? `${year}-06-15`,
        course: `${course.name} (${year} R${match.round})`,
        rating: tee.rating,
        slope: tee.slope,
        score: total,
        notes: `${year} Tournament Round ${match.round}`,
        isTournament: true,
        round: match.round,
      })
    }
    return result
  }, [matches, mattInfo, roundConfigs, courses, year])

  // All scores combined, sorted oldest → newest for display (reversed for table)
  const allScores = useMemo(
    () => [...skidmoreScores, ...tournamentScores].sort((a, b) => a.date.localeCompare(b.date)),
    [skidmoreScores, tournamentScores],
  )

  const hdcpResult = useMemo(() => calcHandicapIndex(allScores), [allScores])
  const computedHdcp = hdcpResult?.handicapIndex ?? null

  // Projected HDCP if we include tournament scores (used when locked)
  const projectedResult = useMemo(
    () => tournamentScores.length > 0 ? hdcpResult : null,
    [tournamentScores, hdcpResult],
  )

  // Auto-apply to Teams page when not locked
  useEffect(() => {
    if (!mattInfo || hdcpLocked || isViewingHistory || computedHdcp === null) return
    if (Math.abs(mattInfo.player.handicapIndex - computedHdcp) < 0.05) return
    updatePlayer(mattInfo.teamId, mattInfo.player.id, { handicapIndex: computedHdcp })
    setApplied(true)
    const t = setTimeout(() => setApplied(false), 4000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedHdcp, hdcpLocked, isViewingHistory, mattInfo?.player.handicapIndex])

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <Lock size={32} className="mx-auto text-gray-300" />
        <p className="text-gray-500">Admin access required.</p>
      </div>
    )
  }

  const handleAddSave = (form: typeof EMPTY_FORM) => {
    addSkidmoreScore({
      date: form.date,
      course: form.course.trim(),
      rating: parseFloat(form.rating),
      slope: parseFloat(form.slope),
      score: parseFloat(form.score),
      notes: form.notes.trim() || undefined,
    })
    setShowAdd(false)
  }

  const handleEditSave = (form: typeof EMPTY_FORM) => {
    if (!editId) return
    updateSkidmoreScore(editId, {
      date: form.date,
      course: form.course.trim(),
      rating: parseFloat(form.rating),
      slope: parseFloat(form.slope),
      score: parseFloat(form.score),
      notes: form.notes.trim() || undefined,
    })
    setEditId(null)
  }

  // Determine which scores are in the 20-score window
  const windowIds = useMemo(() => {
    const sorted = [...allScores].sort((a, b) => a.date.localeCompare(b.date))
    return new Set(sorted.slice(-20).map(s => s.id))
  }, [allScores])

  // Display: newest first
  const displayScores = [...allScores].reverse()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Skidmore Handicap Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            WHS handicap for Matt Skidmore (not in GHIN) — Admin only
          </p>
        </div>
        {!hdcpLocked && (
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => { setShowAdd(true); setEditId(null) }}>
            <Plus size={14} /> Add Score
          </button>
        )}
      </div>

      {/* HDCP Status */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <div className="text-xs label">WHS Calculated HDCP</div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-serif font-bold text-masters-green">
              {computedHdcp !== null ? computedHdcp.toFixed(1) : '—'}
            </span>
            {hdcpResult && (
              <span className="text-xs text-gray-400 mb-1">
                avg {hdcpResult.average.toFixed(3)} × 0.96 = {(hdcpResult.average * 0.96).toFixed(3)}
                {' '}→ truncate
              </span>
            )}
          </div>
          {hdcpResult && (
            <p className="text-xs text-gray-500">
              Lowest {hdcpResult.usedCount} of {hdcpResult.totalConsidered} scores
              {allScores.length > 20 ? ` (most recent 20 of ${allScores.length})` : ''}
            </p>
          )}
          {allScores.length < 3 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} /> Need at least 3 scores
            </p>
          )}
        </div>

        <div className="card space-y-2">
          <div className="text-xs label">Teams Page Status</div>
          {mattInfo ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-serif font-bold text-masters-dark">
                  {mattInfo.player.handicapIndex.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">current value</span>
              </div>
              {hdcpLocked ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <Lock size={11} /> HDCPs locked for tournament
                  </div>
                  {projectedResult && tournamentScores.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Projected after tournament:{' '}
                      <span className="font-bold text-masters-green">{projectedResult.handicapIndex.toFixed(1)}</span>
                      {' '}(includes {tournamentScores.length} round{tournamentScores.length !== 1 ? 's' : ''})
                    </p>
                  )}
                </div>
              ) : applied ? (
                <div className="flex items-center gap-1.5 text-xs text-masters-green bg-green-50 border border-green-200 rounded px-2 py-1">
                  <Check size={11} /> Updated to {computedHdcp?.toFixed(1)}
                </div>
              ) : computedHdcp !== null && Math.abs(mattInfo.player.handicapIndex - computedHdcp) < 0.05 ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Check size={11} className="text-masters-green" /> Teams page is up to date
                </div>
              ) : (
                <p className="text-xs text-gray-400">Will auto-sync on next page visit</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Matt Skidmore not found in teams</p>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && !editId && (
        <ScoreForm onSave={handleAddSave} onCancel={() => setShowAdd(false)} />
      )}

      {/* USGA WHS Rules */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between text-sm font-semibold text-masters-dark"
          onClick={() => setShowRules(r => !r)}
        >
          <span className="flex items-center gap-2">
            <Info size={15} className="text-masters-green" />
            USGA World Handicap System — Calculation Rules
          </span>
          {showRules ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showRules && (
          <div className="mt-4 space-y-4 text-sm text-gray-700">
            <div className="space-y-1">
              <p className="font-semibold text-masters-dark">1. Score Differential</p>
              <div className="bg-masters-light rounded px-3 py-2 font-mono text-xs">
                Differential = round( (113 ÷ Slope Rating) × (Adj. Gross Score − Course Rating), 1 decimal )
              </div>
              <p className="text-xs text-gray-500">
                "Adjusted Gross Score" = gross score capped at net double bogey per hole
                (Par + 2 + handicap strokes received on that hole).
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-masters-dark">2. Score Window & Differentials Used</p>
              <p className="text-xs text-gray-500 mb-2">
                Use the most recent 20 scores. Select the lowest N differentials:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 text-xs">
                {Object.entries(DIFF_USE_TABLE).map(([n, use]) => (
                  <div
                    key={n}
                    className={`rounded px-2 py-1 text-center border ${
                      hdcpResult && parseInt(n) === hdcpResult.totalConsidered
                        ? 'border-masters-green bg-green-50 font-bold text-masters-green'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-gray-600">{n} scores</span>
                    <br />
                    <span>→ {use} used</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-masters-dark">3. Handicap Index Formula</p>
              <div className="bg-masters-light rounded px-3 py-2 font-mono text-xs">
                Index = truncate( avg(lowest N differentials) × 0.96, 1 decimal )
              </div>
              <p className="text-xs text-gray-500">
                Maximum Handicap Index is 54.0. Result is truncated (not rounded) to 1 decimal.
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-masters-dark">4. Soft Cap &amp; Hard Cap</p>
              <p className="text-xs text-gray-500">
                <strong>Soft cap:</strong> If the calculated index exceeds your low HDCP + 3, the excess
                above that threshold is reduced by 50%.<br />
                <strong>Hard cap:</strong> Index cannot exceed low HDCP + 5.<br />
                <em>Note: This app does not currently enforce caps. Matt's index typically won't
                trigger them given score consistency.</em>
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800 space-y-0.5">
              <p className="font-semibold">Historical Excel Discrepancy</p>
              <p>
                The "Skidmore HDCP" Excel tab used a simplified formula: average the lowest differentials
                then <em>round</em> to 1 decimal without the 0.96 multiplier. This gave 28.5 vs. the WHS
                result of 27.3 using the 18 pre-2026 scores. This app uses the official WHS formula
                (0.96 + truncation) going forward.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Score Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-masters-dark text-sm">
            Score History ({allScores.length} scores)
          </h2>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-masters-gold/30 border border-masters-gold inline-block" /> Used in calc</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200 inline-block" /> In 20-score window</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200 inline-block" /> Outside window</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-masters-light text-masters-dark text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Course</th>
                <th className="text-center px-3 py-2">Rating</th>
                <th className="text-center px-3 py-2">Slope</th>
                <th className="text-center px-3 py-2">Score</th>
                <th className="text-center px-3 py-2">Differential</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="text-center px-3 py-2 no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayScores.map((s) => {
                const isTournament = Boolean((s as unknown as Record<string, unknown>).isTournament)
                const inWindow = windowIds.has(s.id)
                const isUsed = hdcpResult?.usedIds.has(s.id) ?? false
                const diff = calcDiff(s.score, s.rating, s.slope)
                const isEditing = editId === s.id

                const rowBg = isUsed
                  ? 'bg-yellow-50 border-l-4 border-l-masters-gold'
                  : inWindow
                    ? 'bg-blue-50/40'
                    : 'bg-white opacity-60'

                return (
                  <tr key={s.id} className={`border-b border-gray-100 ${rowBg}`}>
                    {isEditing && !isTournament ? (
                      <td colSpan={8} className="px-4 py-2">
                        <ScoreForm
                          initial={{
                            date: s.date,
                            course: s.course,
                            rating: String(s.rating),
                            slope: String(s.slope),
                            score: String(s.score),
                            notes: s.notes ?? '',
                          }}
                          onSave={handleEditSave}
                          onCancel={() => setEditId(null)}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {s.date || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {s.course}
                            {isTournament && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-masters-green text-white font-bold uppercase tracking-wide">
                                Tourney
                              </span>
                            )}
                          </div>
                          {s.notes && !isTournament && (
                            <div className="text-[10px] text-gray-400">{s.notes}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{s.rating}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{s.slope}</td>
                        <td className="px-3 py-2.5 text-center font-mono font-semibold">{s.score}</td>
                        <td className={`px-3 py-2.5 text-center font-mono font-semibold ${isUsed ? 'text-masters-green' : 'text-gray-700'}`}>
                          {diff.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isUsed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-masters-gold/20 text-masters-dark font-bold uppercase">
                              Used
                            </span>
                          ) : inWindow ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase">
                              Window
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 uppercase">
                              Old
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center no-print">
                          {!isTournament && isAdmin && (
                            deleteConfirm === s.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  className="text-[10px] text-red-600 hover:text-red-800 font-semibold"
                                  onClick={() => { removeSkidmoreScore(s.id); setDeleteConfirm(null) }}
                                >
                                  Confirm
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600">
                                  <X size={11} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => { setEditId(s.id); setShowAdd(false) }}
                                  className="text-gray-400 hover:text-masters-green"
                                  title="Edit"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(s.id)}
                                  className="text-gray-300 hover:text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )
                          )}
                          {isTournament && (
                            <span className="text-[10px] text-gray-300 italic">auto</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {allScores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No scores yet. Add the first score above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculation summary footer */}
        {hdcpResult && (
          <div className="px-4 py-3 bg-masters-light text-xs text-gray-600 border-t border-gray-100 space-y-0.5">
            <p>
              <strong>Calculation:</strong>{' '}
              Lowest {hdcpResult.usedCount} differentials from {hdcpResult.totalConsidered} scores
              {' '}= avg {hdcpResult.average.toFixed(3)}
              {' '}× 0.96 = {(hdcpResult.average * 0.96).toFixed(3)}
              {' '}→ truncate → <strong className="text-masters-green">{hdcpResult.handicapIndex.toFixed(1)}</strong>
            </p>
            <p className="text-gray-400">
              Used differentials (ascending):{' '}
              {[...hdcpResult.usedIds]
                .map(id => allScores.find(s => s.id === id))
                .filter(Boolean)
                .map(s => calcDiff(s!.score, s!.rating, s!.slope).toFixed(1))
                .sort((a, b) => parseFloat(a) - parseFloat(b))
                .join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
