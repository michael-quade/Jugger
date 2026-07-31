import { useState } from 'react'
import { MapPin, Calendar, ExternalLink, FileText, Users, Wifi, Utensils, Tv, BedDouble, Star, WashingMachine, Settings, Plus, Trash2, X, Check } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'
import { useIsAdmin } from '../store/useAuthStore'
import type { LodgingConfig, LodgingUnit } from '../types'

const AMENITIES = [
  { icon: BedDouble,      label: '2 Bedrooms · 4 Beds',  desc: 'Two beds per bedroom, two full bathrooms' },
  { icon: Tv,             label: 'Entertainment',         desc: 'TV in living room and each bedroom' },
  { icon: Utensils,       label: 'Full Kitchen',          desc: 'Fridge, stove, dishwasher, microwave, cookware & dishes' },
  { icon: Wifi,           label: 'WiFi',                  desc: 'High-speed internet throughout the villa' },
  { icon: WashingMachine, label: 'In-Unit Laundry',       desc: 'Stackable washer & dryer; detergent & dryer sheets provided' },
  { icon: Star,           label: 'Housekeeping',          desc: 'Linens included; daily housekeeping service (most stays)' },
]

// BLDG #6 position in original 2237×1653 image coordinates
const BLDG6 = { x: 880, y: 225, w: 255, h: 150 }

function mapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`
}

// ---- Admin edit modal ----

interface EditModalProps {
  config: LodgingConfig
  teams: { id: string; name: string; color: string }[]
  onSave: (c: LodgingConfig) => void
  onClose: () => void
}

function EditModal({ config, teams, onSave, onClose }: EditModalProps) {
  const [draft, setDraft] = useState<LodgingConfig>(JSON.parse(JSON.stringify(config)))

  function setField<K extends keyof LodgingConfig>(key: K, value: LodgingConfig[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function setUnit(index: number, updates: Partial<LodgingUnit>) {
    setDraft(d => ({
      ...d,
      units: d.units.map((u, i) => i === index ? { ...u, ...updates } : u),
    }))
  }

  function addUnit() {
    const usedIds = new Set(draft.units.map(u => u.teamId))
    const nextTeam = teams.find(t => !usedIds.has(t.id))
    setDraft(d => ({
      ...d,
      units: [...d.units, {
        teamId: nextTeam?.id ?? teams[0]?.id ?? '',
        label: '',
        building: '',
        checkin: '',
        checkout: '',
        nights: 3,
      }],
    }))
  }

  function removeUnit(index: number) {
    setDraft(d => ({ ...d, units: d.units.filter((_, i) => i !== index) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
          <h2 className="font-serif font-bold text-lg text-masters-dark">Edit Lodging</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Property info */}
          <div className="space-y-3">
            <h3 className="label">Property</h3>
            <div className="space-y-2">
              <label className="label">Name</label>
              <input className="input w-full" value={draft.propertyName} onChange={e => setField('propertyName', e.target.value)} placeholder="Talamore Golf Resort" />
            </div>
            <div>
              <label className="label">Address (used for Google Maps link)</label>
              <input className="input w-full" value={draft.address} onChange={e => setField('address', e.target.value)} placeholder="48 Talamore Drive, Southern Pines, NC 28387" />
            </div>
            <div>
              <label className="label">Website URL (optional)</label>
              <input className="input w-full" value={draft.websiteUrl ?? ''} onChange={e => setField('websiteUrl', e.target.value || undefined)} placeholder="https://…" />
            </div>
            <div>
              <label className="label">Description (shown in info card)</label>
              <textarea
                className="input w-full h-24 resize-none"
                value={draft.description ?? ''}
                onChange={e => setField('description', e.target.value || undefined)}
                placeholder="Brief description of the property and location…"
              />
            </div>
          </div>

          {/* Unit assignments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="label">Team Assignments</h3>
              <button onClick={addUnit} className="btn-secondary text-xs flex items-center gap-1 py-1">
                <Plus size={13} /> Add Unit
              </button>
            </div>
            <div className="space-y-4">
              {draft.units.map((unit, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                  <button
                    onClick={() => removeUnit(i)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Team</label>
                      <select
                        className="input w-full"
                        value={unit.teamId}
                        onChange={e => setUnit(i, { teamId: e.target.value })}
                      >
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Unit Label (e.g. "Villa 1615", "East Wing")</label>
                      <input className="input w-full" value={unit.label} onChange={e => setUnit(i, { label: e.target.value })} placeholder="Villa 1615" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Building (optional, e.g. "Bldg #6")</label>
                      <input className="input w-full" value={unit.building ?? ''} onChange={e => setUnit(i, { building: e.target.value || undefined })} placeholder="Bldg #6" />
                    </div>
                    <div>
                      <label className="label">Nights</label>
                      <input type="number" min={1} className="input w-full" value={unit.nights} onChange={e => setUnit(i, { nights: parseInt(e.target.value) || 1 })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Check-in</label>
                      <input className="input w-full" value={unit.checkin} onChange={e => setUnit(i, { checkin: e.target.value })} placeholder="Thu, Aug 27" />
                    </div>
                    <div>
                      <label className="label">Check-out</label>
                      <input className="input w-full" value={unit.checkout} onChange={e => setUnit(i, { checkout: e.target.value })} placeholder="Sun, Aug 30" />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unit.earlyArrival ?? false}
                      onChange={e => setUnit(i, { earlyArrival: e.target.checked || undefined })}
                    />
                    Early arrival
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onSave(draft); onClose() }} className="btn-primary flex items-center gap-1.5">
            <Check size={14} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main page ----

export default function Lodging() {
  const base = import.meta.env.BASE_URL
  const { teams, lodgingConfig, setLodgingConfig } = useTournamentStore()
  const isAdmin = useIsAdmin()
  const [editing, setEditing] = useState(false)

  const cfg = lodgingConfig

  if (!cfg) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="section-header text-2xl mb-4">Lodging</h1>
        <p className="text-gray-500">No lodging information configured yet.</p>
      </div>
    )
  }

  // Build unit cards, ordered by units array so admin controls order
  const unitCards = cfg.units.map(unit => ({
    unit,
    team: teams.find(t => t.id === unit.teamId),
  })).filter(u => u.team)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="section-header text-2xl mb-1">Lodging</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <a
              href={mapsUrl(cfg.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-masters-green hover:underline"
            >
              <MapPin size={14} />
              {cfg.propertyName} · {cfg.address.split(',').slice(1, 2).join('').trim() || cfg.address}
            </a>
            {cfg.websiteUrl && (
              <a
                href={cfg.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-masters-green hover:underline"
              >
                <ExternalLink size={13} />
                {cfg.propertyName} website
              </a>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs shrink-0"
          >
            <Settings size={13} /> Edit Lodging
          </button>
        )}
      </div>

      {/* Property description */}
      {cfg.description && (
        <div className="card p-4 text-sm text-gray-600 leading-relaxed">
          <p>{cfg.description}</p>
        </div>
      )}

      {/* Unit assignment cards */}
      {unitCards.length > 0 && (
        <div>
          <h2 className="section-header text-lg mb-3">Assignments</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {unitCards.map(({ unit, team: t }) => (
              <div
                key={unit.teamId}
                className="rounded-lg border-2 overflow-hidden"
                style={{ borderColor: t!.color + '60', backgroundColor: t!.color + '0D' }}
              >
                {/* Team color header */}
                <div
                  className="px-4 py-2.5 text-white font-serif font-bold text-lg"
                  style={{ backgroundColor: t!.color }}
                >
                  {t!.name}
                </div>

                {/* Unit label + building */}
                <div className="px-4 pt-3 pb-1">
                  <div className="text-3xl font-serif font-bold" style={{ color: t!.color }}>
                    {unit.label}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {unit.building && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t!.color + 'CC' }}>
                        {unit.building}
                      </span>
                    )}
                    {unit.earlyArrival && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold">
                        Early arrival
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="px-4 py-2 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Check-in</span>
                    <span className="font-medium text-gray-700">{unit.checkin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Check-out</span>
                    <span className="font-medium text-gray-700">{unit.checkout}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Duration</span>
                    <span className="font-medium text-gray-700">{unit.nights} nights</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-4 border-t border-gray-200" />

                {/* Golfers — live from store, subs automatically reflected */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    <Users size={10} />
                    Golfers
                  </div>
                  <ul className="space-y-1">
                    {t!.players.map(p => (
                      <li key={p.id} className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        {p.name}
                        {p.isSubstitute && (
                          <span className="text-[9px] px-1 py-px rounded font-bold text-white bg-amber-500">SUB</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Annotated map */}
      <div>
        <h2 className="section-header text-lg mb-3">Villa Complex Map</h2>
        <div className="card p-3">
          {/* Container preserves original image aspect ratio (2237:1653) */}
          <div className="relative w-full" style={{ aspectRatio: '2237 / 1653' }}>
            <img
              src={`${base}talamore-map.jpg`}
              alt="Talamore Villas layout map"
              className="absolute inset-0 w-full h-full object-fill rounded"
            />
            {/* SVG overlay uses original image coordinate space */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 2237 1653"
              xmlns="http://www.w3.org/2000/svg"
              style={{ pointerEvents: 'none' }}
            >
              {/* Rotated highlight — ring + fill only */}
              <g transform={`rotate(-22, ${BLDG6.x + BLDG6.w / 2}, ${BLDG6.y + BLDG6.h / 2})`}>
                <rect
                  x={BLDG6.x - 14}
                  y={BLDG6.y - 14}
                  width={BLDG6.w + 28}
                  height={BLDG6.h + 28}
                  rx="14"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="5"
                  strokeDasharray="18 8"
                  opacity="0.9"
                />
                <rect
                  x={BLDG6.x}
                  y={BLDG6.y}
                  width={BLDG6.w}
                  height={BLDG6.h}
                  rx="8"
                  fill="#F59E0B"
                  fillOpacity="0.25"
                  stroke="#D97706"
                  strokeWidth="3"
                />
              </g>
              {/* Label — horizontal (not rotated), above the cluster */}
              <rect x={727} y={48} width={560} height={158} rx="10" fill="#1a3a2f" fillOpacity="0.9" />
              <text x={1007} y={120} textAnchor="middle" fill="#C9A84C" fontSize="60" fontWeight="bold" fontFamily="serif">
                BLDG #6
              </text>
              <text x={1007} y={183} textAnchor="middle" fill="#ffffff" fontSize="45" fontFamily="sans-serif">
                {cfg.units.map(u => u.label.replace(/\D/g, '')).filter(Boolean).join(' · ') || 'Villas 1611 · 1613 · 1615'}
              </text>
            </svg>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Talamore Villas &amp; Drives Layout — all three villas are in Bldg #6, Woodbrooke Drive
          </p>
        </div>
      </div>

      {/* Amenities */}
      <div>
        <h2 className="section-header text-lg mb-3">What's Included</h2>
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AMENITIES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-masters-light flex items-center justify-center">
                  <Icon size={15} className="text-masters-green" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-masters-dark">{label}</div>
                  <div className="text-xs text-gray-500 leading-snug">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 border-t pt-3">
            Coffee, laundry detergent, and dryer sheets provided. Bed and bathroom linens included.
          </p>
        </div>
      </div>

      {/* Documents */}
      <div>
        <h2 className="section-header text-lg mb-3">Resort Documents</h2>
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`${base}CHECK IN AND RESORT INFORMATION.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-masters-green/30 bg-masters-light hover:bg-green-50 transition-colors text-sm font-medium text-masters-dark"
            >
              <FileText size={16} className="text-masters-green shrink-0" />
              Check-In &amp; Resort Information
              <ExternalLink size={12} className="text-gray-400 ml-auto" />
            </a>
            <a
              href={`${base}RULES AND REGULATIONS.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-masters-green/30 bg-masters-light hover:bg-green-50 transition-colors text-sm font-medium text-masters-dark"
            >
              <FileText size={16} className="text-masters-green shrink-0" />
              Rules &amp; Regulations
              <ExternalLink size={12} className="text-gray-400 ml-auto" />
            </a>
          </div>
        </div>
      </div>

      {/* Admin edit modal */}
      {editing && (
        <EditModal
          config={cfg}
          teams={teams}
          onSave={setLodgingConfig}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
