import { useState, useMemo } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { Flag, Check, Heart, Trophy, X } from 'lucide-react'
import type { CtpEntry, Course, RoundConfig } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

export interface Par3Hole {
  round: number
  hole: number
  courseName: string
  courseId: string
  yardage?: number
}

export function getPar3Holes(roundConfigs: RoundConfig[], courses: Course[]): Par3Hole[] {
  const holes: Par3Hole[] = []
  const sorted = [...roundConfigs].sort((a, b) => a.round - b.round)
  for (const rc of sorted) {
    const course = courses.find(c => c.id === rc.courseId)
    if (!course) continue
    course.holes
      .filter(h => h.par === 3)
      .sort((a, b) => a.number - b.number)
      .forEach(h => {
        holes.push({
          round: rc.round,
          hole: h.number,
          courseName: course.name,
          courseId: course.id,
          yardage: h.yardages[rc.tee],
        })
      })
  }
  return holes
}

export function entryKey(round: number, hole: number) {
  return `${round}-${hole}`
}

function fmtDollars(n: number) {
  return `$${n.toLocaleString()}`
}

// ── CtpHoleRow ─────────────────────────────────────────────────────────────────

interface CtpHoleRowProps {
  par3: Par3Hole
  entry: CtpEntry | undefined
  allPlayerNames: string[]
  prizePerHole: number
  canEdit: boolean
  canMarkPaid: boolean
  onUpdate: (updates: Partial<CtpEntry>) => void
}

export function CtpHoleRow({
  par3, entry, allPlayerNames, prizePerHole, canEdit, canMarkPaid, onUpdate,
}: CtpHoleRowProps) {
  const [editing, setEditing] = useState(false)
  const [winnerDraft, setWinnerDraft] = useState(entry?.winnerName ?? '')
  const [donateDraft, setDonateDraft] = useState(false)

  const hasResult = !!(entry && (entry.winnerName || entry.donatedToHio))
  const statusColor = !hasResult
    ? 'border-gray-200 bg-gray-50'
    : entry?.donatedToHio
      ? 'border-orange-200 bg-orange-50'
      : 'border-masters-green/30 bg-masters-green/5'

  function saveWinner() {
    if (winnerDraft.trim() && winnerDraft !== '__other__') {
      onUpdate({ winnerName: winnerDraft.trim(), donatedToHio: false, hioDonationAmount: undefined })
    }
    setEditing(false)
  }

  function saveDonate() {
    onUpdate({ donatedToHio: true, winnerName: undefined, winnerPaid: undefined, hioDonationAmount: prizePerHole })
    setDonateDraft(false)
    setEditing(false)
  }

  function clearResult() {
    onUpdate({ winnerName: undefined, winnerPaid: undefined, donatedToHio: false, hioDonationAmount: undefined })
    setEditing(false)
  }

  return (
    <div className={`border rounded-lg p-3 transition-colors ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-center shrink-0">
            <div className="text-xs text-gray-400 font-medium">Hole</div>
            <div className="font-bold text-masters-dark text-lg leading-none">#{par3.hole}</div>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-masters-dark truncate">{par3.courseName}</div>
            {par3.yardage
              ? <div className="text-xs text-gray-400">{par3.yardage} yds</div>
              : <div className="text-xs text-gray-300">yardage unknown</div>}
          </div>
        </div>
        <div className="shrink-0 text-xs font-bold text-masters-gold bg-masters-gold/10 rounded-full px-2 py-0.5">
          {fmtDollars(prizePerHole)}
        </div>
      </div>

      <div className="mt-2">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            {hasResult ? (
              entry!.donatedToHio ? (
                <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold">
                  <Heart size={12} /> Donated {fmtDollars(entry!.hioDonationAmount ?? prizePerHole)} → HIO pot
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-masters-green text-xs font-semibold">
                    <Trophy size={12} /> {entry!.winnerName}
                  </div>
                  {canMarkPaid && (
                    <button
                      onClick={() => onUpdate({ winnerPaid: !entry!.winnerPaid })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                        entry!.winnerPaid
                          ? 'bg-masters-green/15 border-masters-green/30 text-masters-green'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-masters-green'
                      }`}
                    >
                      {entry!.winnerPaid ? '✓ Paid' : 'Mark paid'}
                    </button>
                  )}
                </div>
              )
            ) : (
              <span className="text-xs text-gray-300 italic">No result yet</span>
            )}
            {canEdit && (
              <button
                className="text-xs text-gray-400 hover:text-masters-green shrink-0"
                onClick={() => { setEditing(true); setWinnerDraft(entry?.winnerName ?? '') }}
              >
                {hasResult ? 'Edit' : 'Record'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {!donateDraft ? (
              <>
                <div className="flex gap-2">
                  <select
                    className="input flex-1 text-sm"
                    value={winnerDraft}
                    onChange={e => setWinnerDraft(e.target.value)}
                  >
                    <option value="">— Select CTP winner —</option>
                    {allPlayerNames.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="__other__">Other…</option>
                  </select>
                  {winnerDraft === '__other__' && (
                    <input
                      className="input w-36 text-sm"
                      placeholder="Name"
                      onChange={e => setWinnerDraft(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="btn-primary text-xs flex items-center gap-1"
                    disabled={!winnerDraft || winnerDraft === '__other__'}
                    onClick={saveWinner}
                  >
                    <Check size={12} /> Save winner
                  </button>
                  <button
                    className="btn-ghost text-xs flex items-center gap-1 text-orange-600 border-orange-300"
                    onClick={() => setDonateDraft(true)}
                  >
                    <Heart size={12} /> No one on green → HIO
                  </button>
                  {hasResult && (
                    <button
                      className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                      onClick={clearResult}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                  <button className="text-xs text-gray-400" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                  <Heart size={12} /> Donate {fmtDollars(prizePerHole)} to HIO pot?
                </p>
                <p className="text-xs text-gray-500">
                  No player landed on the green — this hole's prize goes to the Hole in One pot.
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs flex items-center gap-1 bg-orange-500 border-orange-500 hover:bg-orange-600"
                    onClick={saveDonate}
                  >
                    <Check size={12} /> Confirm donation
                  </button>
                  <button className="text-xs text-gray-400" onClick={() => setDonateDraft(false)}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CtpPanel ───────────────────────────────────────────────────────────────────

interface CtpPanelProps {
  round: number
  canEdit: boolean
  canMarkPaid: boolean
}

export function CtpPanel({ round, canEdit, canMarkPaid }: CtpPanelProps) {
  const {
    year, teams, courses, roundConfigs,
    ctpEntries, updateCtpEntry, setCtpEntries,
  } = useTournamentStore()

  const allPlayerNames = useMemo(
    () => teams.flatMap(t => t.players).map(p => p.name),
    [teams]
  )
  const prizePerHole = teams.flatMap(t => t.players).length

  const allPar3Holes = useMemo(
    () => getPar3Holes(roundConfigs, courses),
    [roundConfigs, courses]
  )
  const roundPar3Holes = allPar3Holes.filter(h => h.round === round)

  const entryMap = useMemo(() => {
    const m: Record<string, CtpEntry> = {}
    for (const e of ctpEntries) {
      if (e.year === year && e.round === round) m[entryKey(e.round, e.hole)] = e
    }
    return m
  }, [ctpEntries, year, round])

  if (roundPar3Holes.length === 0) return null

  function handleUpdate(hole: number, updates: Partial<CtpEntry>) {
    const key = entryKey(round, hole)
    const existing = entryMap[key]
    if (existing) {
      updateCtpEntry(existing.id, updates)
    } else {
      const par3 = roundPar3Holes.find(h => h.hole === hole)!
      const newEntry: CtpEntry = {
        id: `ctp-${year}-r${round}-h${hole}`,
        year,
        round,
        hole,
        courseName: par3.courseName,
        yardage: par3.yardage,
        ...updates,
      }
      setCtpEntries([...ctpEntries, newEntry])
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Flag size={14} className="text-masters-green" />
        <h3 className="font-serif font-bold text-masters-dark">Par 3 Closest to the Pin</h3>
        <span className="text-xs text-gray-400 ml-auto">
          {roundPar3Holes.length} hole{roundPar3Holes.length !== 1 ? 's' : ''} · ${prizePerHole} each
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {roundPar3Holes.map(h => (
          <CtpHoleRow
            key={entryKey(h.round, h.hole)}
            par3={h}
            entry={entryMap[entryKey(h.round, h.hole)]}
            allPlayerNames={allPlayerNames}
            prizePerHole={prizePerHole}
            canEdit={canEdit}
            canMarkPaid={canMarkPaid}
            onUpdate={updates => handleUpdate(h.hole, updates)}
          />
        ))}
      </div>
    </div>
  )
}
