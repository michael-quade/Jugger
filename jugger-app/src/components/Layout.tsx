import { Outlet, NavLink } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import {
  LayoutDashboard, Users, MapPin, Calendar, Shuffle,
  ClipboardList, Trophy, Aperture, Printer, Flag, BookOpen, TrendingUp, Archive, Crosshair,
} from 'lucide-react'

const NAV = [
  { to: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/teams',      label: 'Teams',       icon: Users },
  { to: '/courses',    label: 'Courses',     icon: MapPin },
  { to: '/history',    label: 'History',     icon: BookOpen },
  { to: '/stats',      label: 'Stats',       icon: TrendingUp },
  { to: '/archive',    label: 'Archive',     icon: Archive },
  { to: '/schedule',   label: 'Schedule',    icon: Calendar },
  { to: '/pairings',   label: 'Pairings',    icon: Shuffle },
  { to: '/scorecards', label: 'Scorecards',  icon: ClipboardList },
  { to: '/results',    label: 'Team Results', icon: Trophy },
  { to: '/ctp',        label: 'Par 3 CTP',   icon: Crosshair },
  { to: '/hole-in-one',label: 'Hole in One', icon: Aperture },
  { to: '/print',      label: 'Print All',   icon: Printer },
]

export default function Layout() {
  const { year } = useTournamentStore()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-masters-dark text-white no-print">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-4">
          <Flag size={36} className="text-masters-gold shrink-0" />
          <div>
            <h1 className="font-serif text-3xl font-bold leading-tight tracking-wide">
              Juggerknocker Invitational
            </h1>
            <p className="text-masters-gold text-sm font-semibold tracking-widest mt-0.5 uppercase">
              {year} Season
            </p>
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="sticky top-[100px] z-40 bg-masters-green text-white shadow no-print">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex flex-wrap gap-0.5 py-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-masters-gold text-white'
                        : 'hover:bg-masters-dark text-white/90'
                    }`
                  }
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-masters-dark text-masters-gold/70 text-center text-xs py-2 no-print">
        {year} Juggerknocker Invitational
      </footer>
    </div>
  )
}
