import { useState, useRef, useCallback } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import { COURSE_IMAGE_DEFAULTS, COURSE_IMAGE_CONTAIN, COURSE_NAME_OVERRIDES, COURSE_WEBSITE_OVERRIDES, COURSE_NOTES_OVERRIDES } from '../data/initialData'
import type { CourseHistoryEntry, CourseHistoryRound, CourseTee } from '../types'
import {
  Plus, ExternalLink, Trash2, Check, X, Edit2, Upload,
  ChevronDown, ChevronUp, Link as LinkIcon, BookOpen, Calendar,
  Flag, Image as ImageIcon, FileImage,
} from 'lucide-react'

const ROUND_LABELS: Record<number, string> = {
  1: 'Round 1 — Team Match Play',
  2: 'Round 2 — Points Round',
  3: 'Round 3 — Texas Scramble',
  4: 'Round 4 — Individual Match Play',
  5: "Round 5 — Captain's Choice",
}

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function domainHint(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  } catch {
    return ''
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Blank form state ────────────────────────────────────────────────────────

function blankEntry(): Omit<CourseHistoryEntry, 'id'> {
  return {
    name: '',
    location: '',
    par: undefined,
    website: '',
    imageUrl: '',
    imageData: undefined,
    tees: [],
    scorecardUrl: '',
    scorecardImageData: undefined,
    notes: '',
    playedRounds: [],
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseHistory() {
  const { courseHistory, addCourseHistory, updateCourseHistory, deleteCourseHistory, roundConfigs, setRoundConfig } = useTournamentStore()
  const [view, setView] = useState<'list' | 'detail' | 'add' | 'edit'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CourseHistoryEntry | null>(null)

  const selected = courseHistory.find(c => c.id === selectedId) ?? null
  const [filterYear, setFilterYear] = useState<number | null>(null)

  const allYears = [...new Set(
    courseHistory.flatMap(c => c.playedRounds.map(r => r.year))
  )].sort((a, b) => b - a)

  const sortedCourses = [...courseHistory]
    .sort((a, b) => {
      const latestYear = (e: typeof a) =>
        e.playedRounds.length ? Math.max(...e.playedRounds.map(r => r.year)) : 0
      return latestYear(b) - latestYear(a)
    })
    .filter(c => filterYear === null || c.playedRounds.some(r => r.year === filterYear))

  function openDetail(id: string) {
    setSelectedId(id)
    setView('detail')
  }

  function openAdd() {
    setEditDraft({ id: newId(), ...blankEntry() })
    setView('add')
  }

  function openEdit(entry: CourseHistoryEntry) {
    setEditDraft({ ...entry })
    setView('edit')
  }

  function saveEntry(entry: CourseHistoryEntry) {
    if (view === 'add') {
      addCourseHistory(entry)
      setSelectedId(entry.id)
      setView('detail')
    } else {
      updateCourseHistory(entry.id, entry)
      setSelectedId(entry.id)
      setView('detail')
    }
    setEditDraft(null)
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this course from history?')) return
    deleteCourseHistory(id)
    setView('list')
    setSelectedId(null)
  }

  function assignToRound(entry: CourseHistoryEntry, round: 1 | 2 | 3 | 4 | 5) {
    const existing = roundConfigs.find(r => r.round === round)
    if (!existing) return
    setRoundConfig({ ...existing, courseId: entry.id })
    updateCourseHistory(entry.id, {
      playedRounds: entry.playedRounds.some(r => r.year === new Date().getFullYear() && r.round === round)
        ? entry.playedRounds
        : [...entry.playedRounds, { id: newId(), year: new Date().getFullYear(), round }],
    })
    alert(`Assigned ${entry.name} to ${ROUND_LABELS[round]}`)
  }

  if (view === 'add' || view === 'edit') {
    return (
      <CourseForm
        draft={editDraft!}
        isNew={view === 'add'}
        onSave={saveEntry}
        onCancel={() => {
          setEditDraft(null)
          setView(selectedId ? 'detail' : 'list')
        }}
      />
    )
  }

  if (view === 'detail' && selected) {
    return (
      <CourseDetail
        entry={selected}
        onEdit={() => openEdit(selected)}
        onDelete={() => handleDelete(selected.id)}
        onBack={() => setView('list')}
        onAssignRound={(round) => assignToRound(selected, round)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Course History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track every course the group has played over the years.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openAdd}>
          <Plus size={15} /> Add Course
        </button>
      </div>

      {allYears.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filter by year:</span>
          <button
            onClick={() => setFilterYear(null)}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
              filterYear === null ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green text-gray-600'
            }`}
          >
            All
          </button>
          {allYears.map(y => (
            <button
              key={y}
              onClick={() => setFilterYear(filterYear === y ? null : y)}
              className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                filterYear === y ? 'bg-masters-green text-white' : 'bg-white border border-gray-300 hover:border-masters-green text-gray-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {courseHistory.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-semibold">No courses in history yet.</p>
          <p className="text-gray-300 text-sm mt-1">Add a course to start building your record.</p>
          <button className="btn-primary mt-4 inline-flex items-center gap-2" onClick={openAdd}>
            <Plus size={14} /> Add First Course
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCourses.map(c => (
            <CourseCard key={c.id} entry={c} onClick={() => openDetail(c.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Course card (list view) ──────────────────────────────────────────────────

function CourseCard({ entry, onClick }: { entry: CourseHistoryEntry; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const imgSrc = entry.imageData ?? entry.imageUrl ?? COURSE_IMAGE_DEFAULTS[entry.id]
  const contain = entry.imageContain ?? !!COURSE_IMAGE_CONTAIN[entry.id]
  const displayName = COURSE_NAME_OVERRIDES[entry.id] ?? entry.name
  const displayNotes = COURSE_NOTES_OVERRIDES[entry.id] ?? entry.notes
  const timesPlayed = entry.playedRounds.length

  // Unique years sorted newest first, with their round labels
  const yearRows = [...entry.playedRounds]
    .sort((a, b) => b.year - a.year || (b.round ?? 0) - (a.round ?? 0))
    .reduce<{ year: number; rounds: (number | undefined)[] }[]>((acc, r) => {
      const existing = acc.find(x => x.year === r.year)
      if (existing) { existing.rounds.push(r.round); return acc }
      return [...acc, { year: r.year, rounds: [r.round] }]
    }, [])

  return (
    <button
      onClick={onClick}
      className="card text-left hover:shadow-md hover:border-masters-green transition-all border border-gray-200 p-0 overflow-hidden group"
    >
      {imgSrc && !imgErr ? (
        <div className={`h-36 overflow-hidden ${'bg-masters-dark'}`}>
          <img
            src={imgSrc}
            alt={displayName}
            className={`w-full h-full ${contain ? 'object-contain p-3' : 'object-cover group-hover:scale-105 transition-transform duration-300'}`}
            onError={() => setImgErr(true)}
          />
        </div>
      ) : (
        <div className="h-36 bg-masters-light flex items-center justify-center">
          <Flag size={28} className="text-masters-green/30" />
        </div>
      )}
      <div className="p-3 flex gap-3">
        {/* Left: name / location / stats */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-bold text-masters-dark text-sm leading-tight">{displayName}</h3>
          {entry.location && <p className="text-xs text-gray-500 mt-0.5">{entry.location}</p>}
          {displayNotes && <p className="text-xs text-gray-400 italic mt-0.5 line-clamp-2">{displayNotes}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {entry.par && <span className="flex items-center gap-1"><Flag size={10} /> Par {entry.par}</span>}
            <span className="flex items-center gap-1"><Calendar size={10} /> {timesPlayed} {timesPlayed === 1 ? 'round' : 'rounds'}</span>
          </div>
        </div>

        {/* Right: years played */}
        {yearRows.length > 0 && (
          <div className="shrink-0 border-l border-gray-100 pl-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Years Played</p>
            <div className="space-y-0.5">
              {yearRows.slice(0, 6).map(({ year, rounds }) => (
                <div key={year} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-masters-dark tabular-nums">{year}</span>
                  {rounds.filter(Boolean).map(r => (
                    <span key={r} className="text-[10px] bg-masters-green/10 text-masters-green rounded px-1 font-semibold">
                      R{r}
                    </span>
                  ))}
                </div>
              ))}
              {yearRows.length > 6 && (
                <p className="text-[10px] text-gray-300">+{yearRows.length - 6} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Course detail view ───────────────────────────────────────────────────────

function CourseDetail({
  entry, onEdit, onDelete, onBack, onAssignRound,
}: {
  entry: CourseHistoryEntry
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
  onAssignRound: (round: 1 | 2 | 3 | 4 | 5) => void
}) {
  const isAdmin = useIsAdmin()
  const [imgErr, setImgErr] = useState(false)
  const [scImgErr, setScImgErr] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const imgSrc = entry.imageData ?? entry.imageUrl ?? COURSE_IMAGE_DEFAULTS[entry.id]
  const contain = entry.imageContain ?? !!COURSE_IMAGE_CONTAIN[entry.id]
  const displayName = COURSE_NAME_OVERRIDES[entry.id] ?? entry.name
  const displayWebsite = COURSE_WEBSITE_OVERRIDES[entry.id] ?? entry.website
  const displayNotes = COURSE_NOTES_OVERRIDES[entry.id] ?? entry.notes
  const scSrc = entry.scorecardImageData ?? entry.scorecardUrl

  return (
    <div className="space-y-4">
      {/* Back + actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button className="btn-ghost text-sm flex items-center gap-1" onClick={onBack}>
          ← Back to History
        </button>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-sm flex items-center gap-1" onClick={onEdit}>
            <Edit2 size={13} /> Edit
          </button>
          <button className="btn-ghost text-sm flex items-center gap-1 text-red-500 hover:text-red-700" onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Hero image */}
      {imgSrc && !imgErr && (
        <div className={`relative rounded-lg overflow-hidden shadow-md h-52 ${'bg-masters-dark'}`}>
          <img
            src={imgSrc}
            alt={displayName}
            className={`w-full h-full ${contain ? 'object-contain p-6' : 'object-cover'}`}
            onError={() => setImgErr(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-masters-dark/70 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 text-white">
            <h2 className="font-serif text-2xl font-bold drop-shadow">{displayName}</h2>
            {entry.location && <p className="text-sm text-masters-gold">{entry.location}</p>}
          </div>
          {displayWebsite && (
            <a
              href={displayWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded px-2 py-1 text-xs flex items-center gap-1 backdrop-blur-sm transition-colors"
            >
              <ExternalLink size={11} /> Visit Site
            </a>
          )}
        </div>
      )}

      {/* Info card */}
      <div className="card">
        <h2 className="font-serif text-xl font-bold text-masters-dark">{displayName}</h2>
        {entry.location && <p className="text-sm text-gray-500">{entry.location}</p>}

        <div className="grid sm:grid-cols-3 gap-4 mt-3 text-sm">
          {entry.par && (
            <div>
              <span className="label">Par</span>
              <span className="font-semibold text-masters-dark">{entry.par}</span>
            </div>
          )}
          {displayWebsite && (
            <div>
              <span className="label">Website</span>
              <a href={displayWebsite} target="_blank" rel="noopener noreferrer" className="text-masters-green hover:underline flex items-center gap-1 text-xs">
                <ExternalLink size={11} /> {new URL(displayWebsite).hostname.replace('www.', '')}
              </a>
            </div>
          )}
          <div>
            <span className="label">Times Played</span>
            <span className="font-semibold text-masters-dark">{entry.playedRounds.length}</span>
          </div>
        </div>

        {/* Tees */}
        {entry.tees && entry.tees.length > 0 && (
          <div className="mt-4">
            <p className="label">Tees</p>
            <div className="flex flex-wrap gap-3">
              {entry.tees.map((t, i) => (
                <div key={i} className="bg-masters-light rounded px-3 py-1.5 text-xs">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-gray-500 ml-2">{t.rating}/{t.slope}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {displayNotes && (
          <div className="mt-4">
            <p className="label">Notes</p>
            <p className="text-sm text-gray-600">{displayNotes}</p>
          </div>
        )}
      </div>

      {/* Play history */}
      <div className="card">
        <h3 className="section-header">Play History</h3>
        {entry.playedRounds.length === 0 ? (
          <p className="text-sm text-gray-400">No rounds recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {[...entry.playedRounds].sort((a, b) => b.year - a.year || 0).map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm border-b last:border-b-0 pb-2 last:pb-0">
                <span className="font-bold text-masters-dark w-12">{r.year}</span>
                {r.round && (
                  <span className="bg-masters-green/10 text-masters-green text-xs px-2 py-0.5 rounded font-semibold">
                    {ROUND_LABELS[r.round]}
                  </span>
                )}
                {r.date && <span className="text-gray-400 text-xs">{r.date}</span>}
                {r.notes && <span className="text-gray-500 text-xs">{r.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign to round */}
      {isAdmin && <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="section-header mb-0">Assign to Tournament Round</h3>
          <button
            className="btn-ghost text-xs flex items-center gap-1"
            onClick={() => setShowAssign(v => !v)}
          >
            {showAssign ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showAssign ? 'Hide' : 'Show'}
          </button>
        </div>
        {showAssign && (
          <div className="mt-3 flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as const).map(r => (
              <button
                key={r}
                className="btn-ghost text-xs"
                onClick={() => { onAssignRound(r); setShowAssign(false) }}
              >
                {ROUND_LABELS[r]}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Scorecard attachment */}
      {scSrc && !scImgErr && (
        <div className="card">
          <h3 className="section-header">Scorecard</h3>
          <img
            src={scSrc}
            alt="Scorecard"
            className="w-full rounded border border-gray-200 max-h-96 object-contain bg-gray-50"
            onError={() => setScImgErr(true)}
          />
        </div>
      )}
      {entry.scorecardUrl && scImgErr && (
        <div className="card">
          <h3 className="section-header">Scorecard</h3>
          <a href={entry.scorecardUrl} target="_blank" rel="noopener noreferrer" className="text-masters-green hover:underline text-sm flex items-center gap-1">
            <ExternalLink size={13} /> View Scorecard
          </a>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

function CourseForm({
  draft: initial, isNew, onSave, onCancel,
}: {
  draft: CourseHistoryEntry
  isNew: boolean
  onSave: (e: CourseHistoryEntry) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<CourseHistoryEntry>({ ...initial })
  const [urlInput, setUrlInput] = useState(initial.website ?? '')
  const [urlFetching, setUrlFetching] = useState(false)
  const [section, setSection] = useState<'basic' | 'image' | 'tees' | 'scorecard' | 'history'>('basic')

  const imgUploadRef = useRef<HTMLInputElement>(null)
  const scUploadRef = useRef<HTMLInputElement>(null)

  function update(updates: Partial<CourseHistoryEntry>) {
    setDraft(d => ({ ...d, ...updates }))
  }

  async function handleUrlLookup() {
    if (!urlInput.trim()) return
    setUrlFetching(true)
    update({ website: urlInput.trim() })
    // Extract name hint from domain since CORS blocks direct fetches
    const hint = domainHint(urlInput.trim())
    if (!draft.name && hint) update({ name: hint })
    await new Promise(r => setTimeout(r, 400))
    setUrlFetching(false)
  }

  async function handleImageUpload(file: File, field: 'imageData' | 'scorecardImageData') {
    const data = await readFileAsDataUrl(file)
    update({ [field]: data })
  }

  function addTee() {
    update({ tees: [...(draft.tees ?? []), { name: '', rating: 0, slope: 113 }] })
  }

  function updateTee(i: number, updates: Partial<CourseTee>) {
    update({ tees: (draft.tees ?? []).map((t, idx) => idx === i ? { ...t, ...updates } : t) })
  }

  function removeTee(i: number) {
    update({ tees: (draft.tees ?? []).filter((_, idx) => idx !== i) })
  }

  function addPlayedRound() {
    const newRound: CourseHistoryRound = { id: newId(), year: new Date().getFullYear() }
    update({ playedRounds: [...draft.playedRounds, newRound] })
  }

  function updatePlayedRound(id: string, updates: Partial<CourseHistoryRound>) {
    update({
      playedRounds: draft.playedRounds.map(r => r.id !== id ? r : { ...r, ...updates }),
    })
  }

  function removePlayedRound(id: string) {
    update({ playedRounds: draft.playedRounds.filter(r => r.id !== id) })
  }

  const tabs = [
    { key: 'basic', label: 'Info' },
    { key: 'image', label: 'Image' },
    { key: 'tees', label: 'Tees' },
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'history', label: 'History' },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">
          {isNew ? 'Add Course' : `Edit — ${draft.name || 'Course'}`}
        </h1>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              section === t.key
                ? 'border-masters-green text-masters-green'
                : 'border-transparent text-gray-500 hover:text-masters-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {/* ── Basic Info ── */}
        {section === 'basic' && (
          <div className="space-y-4">
            {/* URL lookup */}
            <div>
              <label className="label">Course Website / URL</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
                <button
                  className="btn-primary text-xs px-3 flex items-center gap-1"
                  onClick={handleUrlLookup}
                  disabled={urlFetching}
                >
                  <LinkIcon size={12} />
                  {urlFetching ? 'Loading…' : 'Load'}
                </button>
                {urlInput && (
                  <a href={urlInput} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Paste the course URL to pre-fill the name, then complete the fields below.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Course Name *</label>
                <input className="input" value={draft.name} onChange={e => update({ name: e.target.value })} placeholder="e.g. Pine Needles" />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={draft.location ?? ''} onChange={e => update({ location: e.target.value })} placeholder="e.g. Southern Pines, NC" />
              </div>
              <div>
                <label className="label">Par</label>
                <input className="input" type="number" min={60} max={80} value={draft.par ?? ''} onChange={e => update({ par: parseInt(e.target.value) || undefined })} placeholder="72" />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={draft.notes ?? ''} onChange={e => update({ notes: e.target.value })} placeholder="Memorable moments, conditions, results…" />
            </div>
          </div>
        )}

        {/* ── Image ── */}
        {section === 'image' && (
          <div className="space-y-4">
            <div>
              <label className="label">Image URL</label>
              <input
                className="input"
                value={draft.imageUrl ?? ''}
                onChange={e => update({ imageUrl: e.target.value, imageData: undefined })}
                placeholder="https://example.com/course.jpg"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">— or —</span>
              <button
                className="btn-ghost text-xs flex items-center gap-1"
                onClick={() => imgUploadRef.current?.click()}
              >
                <Upload size={13} /> Upload Photo
              </button>
              <input
                ref={imgUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(f, 'imageData')
                }}
              />
              {draft.imageData && (
                <button className="text-xs text-red-500 hover:text-red-700" onClick={() => update({ imageData: undefined })}>
                  Remove upload
                </button>
              )}
            </div>

            {/* Preview */}
            {(draft.imageData ?? draft.imageUrl) && (
              <div className="mt-2">
                <p className="label">Preview</p>
                <img
                  src={draft.imageData ?? draft.imageUrl}
                  alt="Preview"
                  className="rounded border border-gray-200 max-h-52 object-cover w-full bg-gray-50"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Tees ── */}
        {section === 'tees' && (
          <div className="space-y-3">
            {(draft.tees ?? []).length === 0 && (
              <p className="text-sm text-gray-400">No tees added yet.</p>
            )}
            {(draft.tees ?? []).map((tee, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <input className="input w-24" placeholder="Name" value={tee.name} onChange={e => updateTee(i, { name: e.target.value })} />
                <span className="text-xs text-gray-400">Rating:</span>
                <input className="input w-20" type="number" step="0.1" value={tee.rating} onChange={e => updateTee(i, { rating: parseFloat(e.target.value) || 0 })} />
                <span className="text-xs text-gray-400">Slope:</span>
                <input className="input w-20" type="number" value={tee.slope} onChange={e => updateTee(i, { slope: parseInt(e.target.value) || 113 })} />
                <button onClick={() => removeTee(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>
            ))}
            <button className="btn-ghost text-xs flex items-center gap-1" onClick={addTee}>
              <Plus size={12} /> Add Tee
            </button>
          </div>
        )}

        {/* ── Scorecard ── */}
        {section === 'scorecard' && (
          <div className="space-y-4">
            <div>
              <label className="label">Scorecard URL</label>
              <input
                className="input"
                value={draft.scorecardUrl ?? ''}
                onChange={e => update({ scorecardUrl: e.target.value, scorecardImageData: undefined })}
                placeholder="Link to online scorecard or PDF"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">— or upload a photo —</span>
              <button
                className="btn-ghost text-xs flex items-center gap-1"
                onClick={() => scUploadRef.current?.click()}
              >
                <FileImage size={13} /> Upload Scorecard Image
              </button>
              <input
                ref={scUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(f, 'scorecardImageData')
                }}
              />
              {draft.scorecardImageData && (
                <button className="text-xs text-red-500 hover:text-red-700" onClick={() => update({ scorecardImageData: undefined })}>
                  Remove
                </button>
              )}
            </div>

            {draft.scorecardImageData && (
              <div>
                <p className="label">Scorecard Preview</p>
                <img
                  src={draft.scorecardImageData}
                  alt="Scorecard"
                  className="rounded border border-gray-200 w-full max-h-96 object-contain bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">Review the image and enter course details in the other tabs.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Play History ── */}
        {section === 'history' && (
          <div className="space-y-3">
            {draft.playedRounds.length === 0 && (
              <p className="text-sm text-gray-400">No rounds recorded yet.</p>
            )}
            {draft.playedRounds.map(r => (
              <div key={r.id} className="flex flex-wrap gap-2 items-center border-b pb-2 last:border-b-0">
                <div>
                  <label className="label">Year</label>
                  <input
                    className="input w-20"
                    type="number"
                    value={r.year}
                    onChange={e => updatePlayedRound(r.id, { year: parseInt(e.target.value) || r.year })}
                  />
                </div>
                <div>
                  <label className="label">Round (optional)</label>
                  <select
                    className="input"
                    value={r.round ?? ''}
                    onChange={e => updatePlayedRound(r.id, { round: e.target.value ? (parseInt(e.target.value) as 1|2|3|4|5) : undefined })}
                  >
                    <option value="">— none —</option>
                    {([1, 2, 3, 4, 5] as const).map(n => (
                      <option key={n} value={n}>{ROUND_LABELS[n]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input w-32"
                    type="date"
                    value={r.date ?? ''}
                    onChange={e => updatePlayedRound(r.id, { date: e.target.value || undefined })}
                  />
                </div>
                <div className="flex-1 min-w-32">
                  <label className="label">Notes</label>
                  <input className="input" value={r.notes ?? ''} onChange={e => updatePlayedRound(r.id, { notes: e.target.value || undefined })} placeholder="Optional" />
                </div>
                <button onClick={() => removePlayedRound(r.id)} className="mt-4 text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button className="btn-ghost text-xs flex items-center gap-1" onClick={addPlayedRound}>
              <Plus size={12} /> Add Round
            </button>
          </div>
        )}
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2">
        <button
          className="btn-primary flex items-center gap-1"
          disabled={!draft.name.trim()}
          onClick={() => onSave(draft)}
        >
          <Check size={14} /> {isNew ? 'Add Course' : 'Save Changes'}
        </button>
        <button className="btn-ghost flex items-center gap-1" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}
