import { useState, useRef } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { HoleInOneEntry, HioDonation } from '../types'
import {
  Trophy, DollarSign, Check, X, Edit2, Trash2,
  Upload, Plus, ChevronDown, ChevronRight, Camera,
} from 'lucide-react'

const DONATION_AMOUNT = 20

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fmtDollars(n: number) {
  return `$${n.toLocaleString()}`
}

// ── Pot Hero ─────────────────────────────────────────────────────────────────

function PotHero({
  currentPot, paidCount, totalCount, year, isAdmin, onRecordHio,
}: {
  currentPot: number
  paidCount: number
  totalCount: number
  year: number
  isAdmin: boolean
  onRecordHio: () => void
}) {
  const pendingAmt = (totalCount - paidCount) * DONATION_AMOUNT
  return (
    <div
      className="relative rounded-2xl overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg, #004D35 0%, #006747 60%, #1a7a50 100%)' }}
    >
      {/* decorative golf ball pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative px-6 py-10 text-center space-y-3">
        <p className="text-masters-gold font-bold uppercase tracking-widest text-sm">
          ⛳ &nbsp; Hole in One Pot
        </p>

        <div
          className="font-serif font-bold leading-none"
          style={{ fontSize: 'clamp(4rem, 12vw, 8rem)', color: '#f5d87a' }}
        >
          {fmtDollars(currentPot)}
        </div>

        <div className="space-y-0.5">
          <p className="text-white/80 text-sm">
            {paidCount} of {totalCount} players paid for {year}
            {paidCount < totalCount && (
              <span className="ml-2 text-white/50">
                · {fmtDollars(pendingAmt)} pending
              </span>
            )}
          </p>
          {currentPot === 0 && (
            <p className="text-white/50 text-xs">Pot resets each time a champion claims it.</p>
          )}
        </div>

        {isAdmin && (
          <div className="pt-3">
            <button
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
              style={{ background: '#C9A84C', color: 'white' }}
              onMouseOver={e => (e.currentTarget.style.background = '#b8973b')}
              onMouseOut={e => (e.currentTarget.style.background = '#C9A84C')}
              onClick={onRecordHio}
            >
              <Trophy size={16} /> Record a Hole in One
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Year Payment Tracker ──────────────────────────────────────────────────────

function YearTracker({
  donations, year, isAdmin, onToggle, onAddPlayer,
}: {
  donations: HioDonation[]
  year: number
  isAdmin: boolean
  onToggle: (id: string, paid: boolean) => void
  onAddPlayer: (name: string) => void
}) {
  const [newName, setNewName] = useState('')
  const paidCount = donations.filter(d => d.paid).length
  const total = donations.length * DONATION_AMOUNT
  const collected = donations.filter(d => d.paid).length * DONATION_AMOUNT

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h2 className="section-header mb-0">{year} Donations</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {paidCount} of {donations.length} paid · {fmtDollars(collected)} of {fmtDollars(total)} collected
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-full bg-masters-green inline-block" /> Paid
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 ml-2">
            <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" /> Pending
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {donations.map(d => (
          <button
            key={d.id}
            disabled={!isAdmin}
            onClick={() => isAdmin && onToggle(d.id, !d.paid)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left
              ${d.paid
                ? 'bg-masters-green/10 border-masters-green/30 text-masters-dark'
                : 'bg-gray-50 border-gray-200 text-gray-500'
              }
              ${isAdmin ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}
            `}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${d.paid ? 'bg-masters-green' : 'bg-gray-200'}`}>
              {d.paid && <Check size={11} className="text-white" />}
            </span>
            <span className="truncate text-xs">{d.playerName.split(' ').slice(-1)[0]}</span>
            {d.paid && <span className="ml-auto text-[10px] text-masters-green font-bold">${d.amount}</span>}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-4 flex gap-2 border-t pt-4">
          <input
            className="input flex-1 text-sm"
            placeholder="Add player for this year…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newName.trim()) {
                onAddPlayer(newName.trim())
                setNewName('')
              }
            }}
          />
          <button
            className="btn-ghost flex items-center gap-1 text-sm"
            disabled={!newName.trim()}
            onClick={() => { if (newName.trim()) { onAddPlayer(newName.trim()); setNewName('') } }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </div>
  )
}

// ── Champion Card ─────────────────────────────────────────────────────────────

function ChampionCard({
  hio, isAdmin, onUpdate, onDelete,
}: {
  hio: HoleInOneEntry
  isAdmin: boolean
  onUpdate: (updates: Partial<HoleInOneEntry>) => void
  onDelete: () => void
}) {
  const photoRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<HoleInOneEntry>({ ...hio })

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await readFileAsBase64(file)
    onUpdate({ photoData: data })
  }

  function saveEdit() {
    onUpdate(draft)
    setEditing(false)
  }

  const hasPot = hio.potClaimed != null && hio.potClaimed > 0

  if (editing) {
    return (
      <div className="card border-2 border-masters-gold space-y-3">
        <p className="font-semibold text-sm text-masters-dark">Edit Champion Entry</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Player</label>
            <input className="input" value={draft.playerName} onChange={e => setDraft({ ...draft, playerName: e.target.value })} />
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" type="number" value={draft.year} onChange={e => setDraft({ ...draft, year: parseInt(e.target.value) || draft.year })} />
          </div>
          <div>
            <label className="label">Course</label>
            <input className="input" value={draft.course} onChange={e => setDraft({ ...draft, course: e.target.value })} />
          </div>
          <div>
            <label className="label">Hole</label>
            <input className="input" type="number" min={1} max={18} value={draft.hole} onChange={e => setDraft({ ...draft, hole: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label className="label">Yardage</label>
            <input className="input" type="number" min={50} max={300} value={draft.yardage ?? ''} onChange={e => setDraft({ ...draft, yardage: parseInt(e.target.value) || undefined })} placeholder="e.g. 162" />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Notes / Witnesses</label>
          <textarea className="input" rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-1" onClick={saveEdit}><Check size={14} /> Save</button>
          <button className="btn-ghost flex items-center gap-1" onClick={() => { setEditing(false); setDraft({ ...hio }) }}><X size={14} /> Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border-2 border-masters-gold shadow-lg">
      {/* Hero photo area */}
      <div className="relative h-52 bg-masters-dark flex items-center justify-center group">
        {hio.photoData ? (
          <>
            <img
              src={hio.photoData}
              alt={`${hio.playerName} hole in one`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-masters-dark/80 via-masters-dark/10 to-transparent" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/30">
            <Camera size={40} />
            <span className="text-xs">No photo</span>
          </div>
        )}

        {isAdmin && (
          <>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <button
              onClick={() => photoRef.current?.click()}
              className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Upload size={11} /> {hio.photoData ? 'Change Photo' : 'Upload Photo'}
            </button>
          </>
        )}

        {/* Gold trophy badge */}
        <div className="absolute top-3 left-3 bg-masters-gold rounded-full px-3 py-1 text-white text-xs font-bold flex items-center gap-1 shadow">
          <Trophy size={11} /> HOLE IN ONE
        </div>
      </div>

      {/* Info panel */}
      <div className="bg-masters-dark text-white p-4 space-y-1">
        <h3 className="font-serif font-bold text-2xl leading-tight">{hio.playerName || '(unnamed)'}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          <span className="text-masters-gold font-semibold">
            Hole #{hio.hole}
            {hio.yardage && <span className="text-white/70 font-normal"> · {hio.yardage} yds</span>}
          </span>
          <span className="text-white/70">{hio.course || 'Unknown course'}</span>
        </div>
        <p className="text-white/50 text-xs">{hio.date} · {hio.year} Juggerknocker</p>
        {hasPot && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-masters-gold/20 border border-masters-gold/40 rounded-lg px-3 py-1 text-masters-gold font-bold text-sm">
            <DollarSign size={13} />
            Won {fmtDollars(hio.potClaimed!)} from the pot
          </div>
        )}
        {hio.notes && (
          <p className="text-white/50 text-xs italic pt-1">{hio.notes}</p>
        )}

        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t border-white/10 mt-2">
            <button
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
              onClick={() => { setDraft({ ...hio }); setEditing(true) }}
            >
              <Edit2 size={12} /> Edit
            </button>
            <button
              className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
              onClick={() => { if (confirm(`Remove ${hio.playerName}'s hole in one entry?`)) onDelete() }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Record HIO Modal ──────────────────────────────────────────────────────────

function RecordHioModal({
  year, currentPot, onClose, onSave,
}: {
  year: number
  currentPot: number
  onClose: () => void
  onSave: (entry: HoleInOneEntry, claimPot: boolean) => void
}) {
  const { teams, courses } = useTournamentStore()
  const allPlayers = teams.flatMap(t => t.players)
  const photoRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<HoleInOneEntry>({
    id: `hio-${Date.now()}`,
    year,
    playerName: '',
    course: '',
    hole: 1,
    yardage: undefined,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    photoData: undefined,
    potClaimed: undefined,
  })
  const [claimPotChecked, setClaimPotChecked] = useState(currentPot > 0)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await readFileAsBase64(file)
    setDraft(d => ({ ...d, photoData: data }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-serif font-bold text-lg text-masters-dark flex items-center gap-2">
            <Trophy size={18} className="text-masters-gold" /> Record Hole in One
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Photo upload */}
          <div>
            <label className="label">Champion Photo</label>
            <div
              onClick={() => photoRef.current?.click()}
              className={`relative rounded-lg border-2 border-dashed cursor-pointer transition-colors overflow-hidden
                ${draft.photoData ? 'border-masters-green' : 'border-gray-300 hover:border-masters-green'}`}
            >
              {draft.photoData ? (
                <div className="relative h-40">
                  <img src={draft.photoData} alt="Champion" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-semibold">
                    Change Photo
                  </div>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Upload size={28} />
                  <span className="text-sm">Click to upload champion photo</span>
                </div>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Player</label>
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={draft.playerName}
                  onChange={e => setDraft({ ...draft, playerName: e.target.value })}
                >
                  <option value="">— Select player —</option>
                  {allPlayers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  <option value="__other__">Other…</option>
                </select>
                {draft.playerName === '__other__' && (
                  <input
                    className="input flex-1"
                    placeholder="Enter name"
                    onChange={e => setDraft({ ...draft, playerName: e.target.value })}
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div>
              <label className="label">Year</label>
              <input className="input" type="number" value={draft.year}
                onChange={e => setDraft({ ...draft, year: parseInt(e.target.value) || draft.year })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={draft.date}
                onChange={e => setDraft({ ...draft, date: e.target.value })} />
            </div>

            <div className="col-span-2">
              <label className="label">Course</label>
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={draft.course}
                  onChange={e => setDraft({ ...draft, course: e.target.value })}
                >
                  <option value="">— Select course —</option>
                  {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="__other__">Other…</option>
                </select>
                {(draft.course === '__other__' || !courses.find(c => c.name === draft.course)) && draft.course !== '' && draft.course !== '__other__' && (
                  <input className="input flex-1" value={draft.course}
                    onChange={e => setDraft({ ...draft, course: e.target.value })} placeholder="Course name" />
                )}
              </div>
              {draft.course === '__other__' && (
                <input className="input mt-1 w-full" autoFocus placeholder="Enter course name"
                  onChange={e => setDraft({ ...draft, course: e.target.value })} />
              )}
            </div>

            <div>
              <label className="label">Hole</label>
              <input className="input" type="number" min={1} max={18} value={draft.hole}
                onChange={e => setDraft({ ...draft, hole: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="label">Yardage</label>
              <input className="input" type="number" min={50} max={300}
                value={draft.yardage ?? ''}
                onChange={e => setDraft({ ...draft, yardage: parseInt(e.target.value) || undefined })}
                placeholder="e.g. 162" />
            </div>
          </div>

          <div>
            <label className="label">Notes / Witnesses</label>
            <textarea className="input" rows={2} value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Who was there? Any details about the shot…" />
          </div>

          {/* Pot claim */}
          {currentPot > 0 && (
            <div className={`rounded-lg p-4 border-2 ${claimPotChecked ? 'bg-masters-gold/10 border-masters-gold' : 'bg-gray-50 border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimPotChecked}
                  onChange={e => setClaimPotChecked(e.target.checked)}
                  className="w-4 h-4 accent-masters-green"
                />
                <div>
                  <span className="font-semibold text-sm text-masters-dark">Claim the pot</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Awards {fmtDollars(currentPot)} to {draft.playerName || 'this champion'} and resets the pot to $0.
                  </p>
                </div>
                {claimPotChecked && (
                  <span className="ml-auto text-masters-gold font-bold text-lg">{fmtDollars(currentPot)}</span>
                )}
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              className="btn-primary flex items-center gap-1 flex-1 justify-center"
              disabled={!draft.playerName || draft.playerName === '__other__'}
              onClick={() => onSave(draft, claimPotChecked)}
            >
              <Trophy size={14} /> Save Champion
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Donation History Table ────────────────────────────────────────────────────

function DonationHistoryTable({
  donations, hioEntries, years, teams,
}: {
  donations: HioDonation[]
  hioEntries: HoleInOneEntry[]
  years: number[]
  teams: { id: string; name: string; color: string; players: { name: string }[] }[]
}) {
  // Build ordered player list from team roster
  const orderedPlayers = teams.flatMap(t =>
    t.players.map(p => ({ name: p.name, teamName: t.name, teamColor: t.color }))
  )
  // Include any donation players not in current roster
  const donationNames = [...new Set(donations.map(d => d.playerName))]
  const extraNames = donationNames.filter(n => !orderedPlayers.find(p => p.name === n))
  const allRows = [
    ...orderedPlayers,
    ...extraNames.map(n => ({ name: n, teamName: '', teamColor: '#999' })),
  ]

  function getDonation(playerName: string, year: number) {
    return donations.find(d => d.playerName === playerName && d.year === year)
  }

  function getClaimLabel(claimedByHioId: string) {
    const hio = hioEntries.find(h => h.id === claimedByHioId)
    return hio ? `Won by ${hio.playerName} (${hio.year})` : 'Claimed'
  }

  const yearTotals = years.map(yr => ({
    year: yr,
    paid: donations.filter(d => d.year === yr && d.paid).length,
    total: donations.filter(d => d.year === yr).length,
    amount: donations.filter(d => d.year === yr && d.paid).reduce((s, d) => s + d.amount, 0),
  }))

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-masters-light">
            <th className="border border-gray-200 p-2 text-left font-semibold text-masters-dark sticky left-0 bg-masters-light">
              Player
            </th>
            {years.map(yr => (
              <th key={yr} className="border border-gray-200 p-2 text-center font-semibold text-masters-dark min-w-16">
                {yr}
              </th>
            ))}
            <th className="border border-gray-200 p-2 text-center font-semibold text-masters-dark">Total</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map(({ name, teamName, teamColor }) => {
            const playerDons = years.map(yr => getDonation(name, yr))
            const playerTotal = playerDons.reduce((s, d) => s + (d?.paid ? d.amount : 0), 0)
            return (
              <tr key={name} className="hover:bg-gray-50">
                <td className="border border-gray-200 p-2 sticky left-0 bg-white">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: teamColor }} />
                    <span className="font-medium text-masters-dark">{name.split(' ').slice(-1)[0]}</span>
                    {teamName && (
                      <span className="text-gray-400 text-[10px]">{name.split(' ')[0][0]}.</span>
                    )}
                  </div>
                </td>
                {playerDons.map((d, i) => (
                  <td key={years[i]} className="border border-gray-200 p-1 text-center">
                    {d ? (
                      d.claimedByHioId ? (
                        <span
                          title={getClaimLabel(d.claimedByHioId)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-masters-gold/20 text-masters-gold text-[11px] font-bold cursor-help"
                        >
                          ★
                        </span>
                      ) : d.paid ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-masters-green/15 text-masters-green">
                          <Check size={12} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-300">
                          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                        </span>
                      )
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                ))}
                <td className="border border-gray-200 p-2 text-center font-bold text-masters-dark">
                  {playerTotal > 0 ? fmtDollars(playerTotal) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-masters-light font-semibold">
            <td className="border border-gray-200 p-2 text-masters-dark sticky left-0 bg-masters-light">
              Collected
            </td>
            {yearTotals.map(({ year: yr, paid, total, amount }) => (
              <td key={yr} className="border border-gray-200 p-2 text-center text-masters-dark">
                <div>{fmtDollars(amount)}</div>
                <div className="text-[10px] text-gray-400 font-normal">{paid}/{total}</div>
              </td>
            ))}
            <td className="border border-gray-200 p-2 text-center text-masters-dark">
              {fmtDollars(donations.filter(d => d.paid).reduce((s, d) => s + d.amount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-full bg-masters-green/15 items-center justify-center text-masters-green"><Check size={10} /></span>
          Paid (in pot)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-full bg-masters-gold/20 items-center justify-center text-masters-gold font-bold text-[11px]">★</span>
          Paid (pot was won — hover for winner)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-full bg-gray-100 items-center justify-center"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /></span>
          Not paid
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HoleInOne() {
  const {
    holeInOnes, hioDonations, ctpEntries, ctpHioHistory, year, teams,
    addHoleInOne, updateHoleInOne, deleteHoleInOne,
    setDonationPaid, claimPot, addHioDonation,
  } = useTournamentStore()
  const isAdmin = useIsAdmin()

  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // CTP→HIO: historical amounts + app-tracked amounts from ctpEntries
  const ctpHioTotal =
    ctpHioHistory.reduce((s, h) => s + h.amount, 0) +
    ctpEntries.filter(e => e.donatedToHio).reduce((s, e) => s + (e.hioDonationAmount ?? 0), 0)

  // Active pot: paid player donations (not claimed) + CTP→HIO donations
  const currentPot =
    hioDonations.filter(d => d.paid && !d.claimedByHioId).reduce((sum, d) => sum + d.amount, 0) +
    ctpHioTotal

  const currentYearDonations = hioDonations.filter(d => d.year === year)
  const paidThisYear = currentYearDonations.filter(d => d.paid).length

  const champions = [...holeInOnes].sort((a, b) => b.year - a.year || b.hole - a.hole)

  const donationYears = [...new Set(hioDonations.map(d => d.year))].sort()

  function handleAddPlayer(name: string) {
    const existing = hioDonations.find(d => d.year === year && d.playerName === name)
    if (existing) return
    addHioDonation({
      id: `hio-don-${year}-custom-${Date.now()}`,
      year,
      playerName: name,
      paid: false,
      amount: DONATION_AMOUNT,
    })
  }

  function handleSaveHio(entry: HoleInOneEntry, shouldClaim: boolean) {
    addHoleInOne(entry)
    if (shouldClaim) claimPot(entry.id)
    setShowRecordModal(false)
  }

  return (
    <div className="space-y-6">
      {/* The Pot */}
      <PotHero
        currentPot={currentPot}
        paidCount={paidThisYear}
        totalCount={currentYearDonations.length}
        year={year}
        isAdmin={isAdmin}
        onRecordHio={() => setShowRecordModal(true)}
      />

      {/* Current year donation tracker */}
      {currentYearDonations.length > 0 && (
        <YearTracker
          donations={currentYearDonations}
          year={year}
          isAdmin={isAdmin}
          onToggle={setDonationPaid}
          onAddPlayer={handleAddPlayer}
        />
      )}

      {/* Hall of Champions */}
      {champions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-masters-dark flex items-center gap-2">
            <Trophy size={20} className="text-masters-gold" /> Hall of Champions
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {champions.map(hio => (
              <ChampionCard
                key={hio.id}
                hio={hio}
                isAdmin={isAdmin}
                onUpdate={updates => updateHoleInOne(hio.id, updates)}
                onDelete={() => deleteHoleInOne(hio.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">⛳</div>
          <p className="text-gray-400 font-semibold">No champions yet</p>
          <p className="text-gray-300 text-sm mt-1">The pot keeps growing until someone makes the shot.</p>
        </div>
      )}

      {/* Donation History */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setShowHistory(v => !v)}
        >
          <div>
            <h2 className="font-serif font-bold text-lg text-masters-dark">Full Donation History</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtDollars(hioDonations.filter(d => d.paid).reduce((s, d) => s + d.amount, 0))} total collected across all years
            </p>
          </div>
          {showHistory
            ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
            : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
        </button>

        {showHistory && (
          <DonationHistoryTable
            donations={hioDonations}
            hioEntries={holeInOnes}
            years={donationYears}
            teams={teams}
          />
        )}
      </div>

      {/* Record HIO Modal */}
      {showRecordModal && (
        <RecordHioModal
          year={year}
          currentPot={currentPot}
          onClose={() => setShowRecordModal(false)}
          onSave={handleSaveHio}
        />
      )}
    </div>
  )
}
