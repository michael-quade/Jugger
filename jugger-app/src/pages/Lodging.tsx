import { MapPin, Calendar, ExternalLink, FileText, Users, Wifi, Utensils, Tv, BedDouble, Star, WashingMachine } from 'lucide-react'
import { useTournamentStore } from '../store/useTournamentStore'

// Villa assignments keyed by team ID — specific to 2026 trip
const VILLA_CONFIG: Record<string, {
  villa: string
  building: string
  checkin: string
  checkout: string
  nights: number
  earlyArrival?: boolean
}> = {
  'billy-baroo': {
    villa: '1615',
    building: 'Bldg #6',
    checkin: 'Thu, Aug 27',
    checkout: 'Sun, Aug 30',
    nights: 3,
  },
  'ballgame': {
    villa: '1611',
    building: 'Bldg #6',
    checkin: 'Wed, Aug 26',
    checkout: 'Sun, Aug 30',
    nights: 4,
    earlyArrival: true,
  },
  'silverbacks': {
    villa: '1613',
    building: 'Bldg #6',
    checkin: 'Thu, Aug 27',
    checkout: 'Sun, Aug 30',
    nights: 3,
  },
}

const AMENITIES = [
  { icon: BedDouble,      label: '2 Bedrooms · 4 Beds',  desc: 'Two beds per bedroom, two full bathrooms' },
  { icon: Tv,             label: 'Entertainment',         desc: 'TV in living room and each bedroom' },
  { icon: Utensils,       label: 'Full Kitchen',          desc: 'Fridge, stove, dishwasher, microwave, cookware & dishes' },
  { icon: Wifi,           label: 'WiFi',                  desc: 'High-speed internet throughout the villa' },
  { icon: WashingMachine, label: 'In-Unit Laundry',       desc: 'Stackable washer & dryer; detergent & dryer sheets provided' },
  { icon: Star,           label: 'Housekeeping',          desc: 'Linens included; daily housekeeping service (most stays)' },
]

// Approximate BLDG #6 position in original 2237×1653 image coordinates
const BLDG6 = { x: 462, y: 102, w: 290, h: 200 }

export default function Lodging() {
  const base = import.meta.env.BASE_URL
  const { teams } = useTournamentStore()

  // Build villa cards from live team state — picks up subs automatically
  const villaCards = teams
    .filter(t => VILLA_CONFIG[t.id])
    .map(t => ({ team: t, cfg: VILLA_CONFIG[t.id] }))
    // Stable order: ballgame (early), billy-baroo, silverbacks
    .sort((a, b) => {
      const order: Record<string, number> = { ballgame: 0, 'billy-baroo': 1, silverbacks: 2 }
      return (order[a.team.id] ?? 9) - (order[b.team.id] ?? 9)
    })

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="section-header text-2xl mb-1">Lodging</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <MapPin size={14} />
            Talamore Villas · Southern Pines, NC
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            August 26–30, 2026
          </span>
          <a
            href="https://talamoregolfresort.com/lodging/talamore-villas/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-masters-green hover:underline"
          >
            <ExternalLink size={13} />
            Talamore Villas website
          </a>
        </div>
      </div>

      {/* Resort description */}
      <div className="card p-4 text-sm text-gray-600 leading-relaxed">
        <p>
          The 12-building Villa complex at Talamore Resort sits next to the Talamore Resort
          clubhouse — you can easily walk to the clubhouse for your round. Conveniently located
          to most of the area courses, roughly <strong>5 miles from Downtown Southern Pines</strong> and{' '}
          <strong>5 miles from the Village of Pinehurst</strong>. All three villas are in{' '}
          <strong>Building #6</strong> on Woodbrooke Drive.
        </p>
      </div>

      {/* Villa assignment cards */}
      <div>
        <h2 className="section-header text-lg mb-3">Villa Assignments</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {villaCards.map(({ team: t, cfg }) => (
            <div
              key={t.id}
              className="rounded-lg border-2 overflow-hidden"
              style={{ borderColor: t.color + '60', backgroundColor: t.color + '0D' }}
            >
              {/* Team color header */}
              <div
                className="px-4 py-2.5 text-white font-serif font-bold text-lg"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </div>

              {/* Villa + building */}
              <div className="px-4 pt-3 pb-1">
                <div className="text-3xl font-serif font-bold" style={{ color: t.color }}>
                  Villa {cfg.villa}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color + 'CC' }}>
                    {cfg.building}
                  </span>
                  {cfg.earlyArrival && (
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
                  <span className="font-medium text-gray-700">{cfg.checkin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Check-out</span>
                  <span className="font-medium text-gray-700">{cfg.checkout}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Duration</span>
                  <span className="font-medium text-gray-700">{cfg.nights} nights</span>
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
                  {t.players.map(p => (
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
              {/* Pulsing highlight ring around BLDG #6 */}
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
              {/* Semi-transparent gold fill over the building */}
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
              {/* Label banner */}
              <rect
                x={BLDG6.x - 2}
                y={BLDG6.y + BLDG6.h + 10}
                width={BLDG6.w + 4}
                height={52}
                rx="8"
                fill="#1a3a2f"
                fillOpacity="0.88"
              />
              <text
                x={BLDG6.x + BLDG6.w / 2}
                y={BLDG6.y + BLDG6.h + 28}
                textAnchor="middle"
                fill="#C9A84C"
                fontSize="18"
                fontWeight="bold"
                fontFamily="serif"
              >
                BLDG #6
              </text>
              <text
                x={BLDG6.x + BLDG6.w / 2}
                y={BLDG6.y + BLDG6.h + 50}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="14"
                fontFamily="sans-serif"
              >
                Villas 1611 · 1613 · 1615
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
    </div>
  )
}
