import { useState } from 'react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { Course, HoleData, CourseTee } from '../types'
import { Check, X, ExternalLink } from 'lucide-react'

const COURSE_IMAGES: Record<string, string> = {
  'pine-needles':      `${import.meta.env.BASE_URL}courses/pine-needles.jpg`,
  'pinewild-magnolia': `${import.meta.env.BASE_URL}courses/pinewild-magnolia.jpg`,
  'pinewild-holly':    `${import.meta.env.BASE_URL}courses/pinewild-holly.jpg`,
  'mid-south':         `${import.meta.env.BASE_URL}courses/mid-south.jpg`,
}

const COURSE_IMAGE_POSITIONS: Record<string, string> = {
  'mid-south': 'center 70%',
}

export default function Courses() {
  const { courses, setCourse } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [selected, setSelected] = useState<string>(courses[0]?.id ?? '')
  const course = courses.find(c => c.id === selected)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-masters-dark">Course Information</h1>

      {/* Course tabs */}
      <div className="flex gap-2 flex-wrap">
        {courses.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
              selected === c.id
                ? 'bg-masters-green text-white'
                : 'bg-white border border-gray-300 hover:border-masters-green'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* key={course.id} forces a fresh mount (and fresh draft state) on every tab switch */}
      {course && <CourseEditor key={course.id} course={course} onSave={setCourse} isAdmin={isAdmin} />}
    </div>
  )
}

function CourseEditor({ course, onSave, isAdmin }: { course: Course; onSave: (c: Course) => void; isAdmin: boolean }) {
  const [draft, setDraft] = useState<Course>({ ...course })
  const [dirty, setDirty] = useState(false)
  const [imgError, setImgError] = useState(false)

  const imageUrl = COURSE_IMAGES[course.id]

  function update(updates: Partial<Course>) {
    setDraft(d => ({ ...d, ...updates }))
    setDirty(true)
  }

  function updateTee(i: number, updates: Partial<CourseTee>) {
    update({ tees: draft.tees.map((t, idx) => idx === i ? { ...t, ...updates } : t) })
  }

  function updateHole(num: number, updates: Partial<HoleData>) {
    update({ holes: draft.holes.map(h => h.number === num ? { ...h, ...updates } : h) })
  }

  function updateYardage(holeNum: number, tee: string, val: number) {
    update({
      holes: draft.holes.map(h =>
        h.number === holeNum ? { ...h, yardages: { ...h.yardages, [tee]: val } } : h
      ),
    })
  }

  const front = draft.holes.slice(0, 9)
  const back  = draft.holes.slice(9)

  const frontPar = front.reduce((s, h) => s + h.par, 0)
  const backPar  = back.reduce((s, h) => s + h.par, 0)

  return (
    <div className="space-y-4">
      {/* Course hero image */}
      {imageUrl && !imgError && (
        <div className="relative rounded-lg overflow-hidden shadow-md h-52 bg-masters-dark">
          <img
            src={imageUrl}
            alt={`${course.name} course photo`}
            className="w-full h-full object-cover"
            style={{ objectPosition: COURSE_IMAGE_POSITIONS[course.id] ?? 'center center' }}
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-masters-dark/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h2 className="font-serif text-2xl font-bold drop-shadow">{course.name}</h2>
            <p className="text-sm text-masters-gold font-semibold">
              Par {course.par}
              {draft.tees.map(t => ` · ${t.name}: ${t.rating}/${t.slope}`).join('')}
            </p>
          </div>
          {draft.website && (
            <a
              href={draft.website}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white rounded px-2 py-1 text-xs flex items-center gap-1 backdrop-blur-sm transition-colors"
            >
              <ExternalLink size={11} /> Visit Site
            </a>
          )}
        </div>
      )}

      {/* Course settings card */}
      <div className="card">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Course Name</label>
            <input className="input" value={draft.name} readOnly={!isAdmin} onChange={e => isAdmin && update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">Par</label>
            <input className="input" type="number" value={draft.par} readOnly={!isAdmin} onChange={e => isAdmin && update({ par: parseInt(e.target.value) || draft.par })} />
          </div>
          <div>
            <label className="label">Website</label>
            <div className="flex gap-1">
              <input className="input flex-1" value={draft.website ?? ''} readOnly={!isAdmin} onChange={e => isAdmin && update({ website: e.target.value })} />
              {draft.website && (
                <a href={draft.website} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center gap-1">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tees */}
        <div className="mt-4">
          <label className="label">Tee Options</label>
          <div className="space-y-2">
            {draft.tees.map((tee, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <input className="input w-24" value={tee.name} readOnly={!isAdmin} onChange={e => isAdmin && updateTee(i, { name: e.target.value })} placeholder="Name" />
                <span className="text-xs text-gray-400">Rating:</span>
                <input className="input w-20" type="number" step="0.1" value={tee.rating} readOnly={!isAdmin} onChange={e => isAdmin && updateTee(i, { rating: parseFloat(e.target.value) })} />
                <span className="text-xs text-gray-400">Slope:</span>
                <input className="input w-20" type="number" value={tee.slope} readOnly={!isAdmin} onChange={e => isAdmin && updateTee(i, { slope: parseInt(e.target.value) })} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hole data tables */}
      {[front, back].map((group, gi) => {
        const groupPar = gi === 0 ? frontPar : backPar
        return (
          <div key={gi} className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-header mb-0">
                {gi === 0 ? 'Front Nine (Holes 1–9)' : 'Back Nine (Holes 10–18)'}
              </h3>
              <span className="text-sm text-gray-500 font-semibold">Par {groupPar}</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-masters-light">
                  <th className="border p-1 text-left">Hole</th>
                  <th className="border p-1">Par</th>
                  <th className="border p-1">HDCP</th>
                  {draft.tees.map(t => (
                    <th key={t.name} className="border p-1">{t.name} Yds</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.map(hole => (
                  <tr key={hole.number} className="hover:bg-gray-50">
                    <td className="border p-1 font-bold text-masters-dark text-center">{hole.number}</td>
                    <td className="border p-1">
                      <input
                        type="number" min={3} max={5}
                        className="w-10 text-center border-none bg-transparent"
                        value={hole.par}
                        readOnly={!isAdmin}
                        onChange={e => isAdmin && updateHole(hole.number, { par: parseInt(e.target.value) })}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number" min={1} max={19}
                        className="w-12 text-center border-none bg-transparent"
                        value={hole.hdcpOrder}
                        readOnly={!isAdmin}
                        onChange={e => isAdmin && updateHole(hole.number, { hdcpOrder: parseInt(e.target.value) })}
                      />
                    </td>
                    {draft.tees.map(t => (
                      <td key={t.name} className="border p-1">
                        <input
                          type="number"
                          className="w-16 text-center border-none bg-transparent"
                          value={hole.yardages[t.name] ?? ''}
                          readOnly={!isAdmin}
                          onChange={e => isAdmin && updateYardage(hole.number, t.name, parseInt(e.target.value) || 0)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {dirty && isAdmin && (
        <div className="flex gap-2">
          <button className="btn-primary flex items-center gap-1" onClick={() => { onSave(draft); setDirty(false) }}>
            <Check size={14} /> Save Changes
          </button>
          <button className="btn-ghost flex items-center gap-1" onClick={() => { setDraft({ ...course }); setDirty(false) }}>
            <X size={14} /> Discard
          </button>
        </div>
      )}
    </div>
  )
}
