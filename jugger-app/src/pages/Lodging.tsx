import { MapPin, Calendar, ExternalLink, FileText, Users, Wifi, Utensils, Tv, WashingMachine, BedDouble, Star } from 'lucide-react'

const VILLAS = [
  {
    team: 'Billy Baroo',
    color: '#2563EB',
    bgLight: '#EFF6FF',
    border: '#BFDBFE',
    villa: '1615',
    checkin: 'Thursday, Aug 27',
    checkout: 'Sunday, Aug 30',
    nights: 3,
    players: ['Michael Quade', 'Nick Whitman', 'Nate Butterworth', 'Bryan Holcomb'],
  },
  {
    team: '#ballgame',
    color: '#DC2626',
    bgLight: '#FEF2F2',
    border: '#FECACA',
    villa: '1611',
    checkin: 'Wednesday, Aug 26',
    checkout: 'Sunday, Aug 30',
    nights: 4,
    players: ['Ron Pitts', 'Daniel Gunter', 'John Oxford', 'Chris Oncavage'],
    earlyArival: true,
  },
  {
    team: 'Silverbacks',
    color: '#059669',
    bgLight: '#ECFDF5',
    border: '#A7F3D0',
    villa: '1613',
    checkin: 'Thursday, Aug 27',
    checkout: 'Sunday, Aug 30',
    nights: 3,
    players: ['Danny Woyahn', 'Matt Skidmore', 'Chad Bender', 'Hunter Morris'],
  },
]

const AMENITIES = [
  { icon: BedDouble, label: '2 Bedrooms · 4 Beds', desc: 'Two beds per bedroom, two full bathrooms' },
  { icon: Tv, label: 'Entertainment', desc: 'TV in living room and each bedroom' },
  { icon: Utensils, label: 'Full Kitchen', desc: 'Fridge, stove, dishwasher, microwave, cookware & dishes' },
  { icon: Wifi, label: 'WiFi', desc: 'High-speed internet throughout the villa' },
  { icon: WashingMachine, label: 'In-Unit Laundry', desc: 'Stackable washer & dryer, detergent & dryer sheets provided' },
  { icon: Star, label: 'Housekeeping', desc: 'Linens included, daily housekeeping service (most stays)' },
]

export default function Lodging() {
  const base = import.meta.env.BASE_URL

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
          The 12-building Villa complex at Talamore Resort sits next to the Talamore Resort clubhouse —
          you can easily walk to the clubhouse for your round. Conveniently located to most of the area courses,
          roughly <strong>5 miles from Downtown Southern Pines</strong> and <strong>5 miles from the Village of Pinehurst</strong>.
        </p>
      </div>

      {/* Villa assignments */}
      <div>
        <h2 className="section-header text-lg mb-3">Villa Assignments</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {VILLAS.map(v => (
            <div
              key={v.villa}
              className="rounded-lg border-2 overflow-hidden"
              style={{ borderColor: v.border, backgroundColor: v.bgLight }}
            >
              {/* Team color header */}
              <div className="px-4 py-2.5 text-white font-serif font-bold text-lg" style={{ backgroundColor: v.color }}>
                {v.team}
              </div>

              {/* Villa number */}
              <div className="px-4 pt-3 pb-1">
                <div className="text-3xl font-serif font-bold" style={{ color: v.color }}>
                  Villa {v.villa}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <Calendar size={11} />
                  {v.nights} nights
                  {v.earlyArival && (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                      Early arrival
                    </span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="px-4 py-2 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Check-in</span>
                  <span className="font-medium text-gray-700">{v.checkin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Check-out</span>
                  <span className="font-medium text-gray-700">{v.checkout}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-4 border-t" style={{ borderColor: v.border }} />

              {/* Golfers */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  <Users size={10} />
                  Golfers
                </div>
                <ul className="space-y-1">
                  {v.players.map(p => (
                    <li key={p} className="text-sm font-medium text-gray-700">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div>
        <h2 className="section-header text-lg mb-3">Villa Complex Map</h2>
        <div className="card p-3">
          <img
            src="https://talamoregolf-resort.reslogic.com/images/Villas_&_Drives_Layout_map.jpg"
            alt="Talamore Villas layout map"
            className="w-full rounded object-contain max-h-96"
          />
          <p className="text-xs text-gray-400 mt-2 text-center">Talamore Villas & Drives Layout — Villas 1611, 1613, and 1615</p>
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
