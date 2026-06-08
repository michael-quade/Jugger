import { Outlet, NavLink, Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import {
  LayoutDashboard, Users, MapPin, Calendar, Shuffle,
  ClipboardList, Trophy, Aperture, Printer, BookOpen, TrendingUp, Archive, Crosshair,
  History, ArrowRight,
} from 'lucide-react'
import HeaderAdminWidget from './HeaderAdminWidget'
import { useSyncStatus } from '../hooks/useSupabaseSync'
import { isSupabaseEnabled } from '../lib/supabase'
import { useIsAdmin } from '../store/useAuthStore'

const NAV = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/teams',      label: 'Teams',        icon: Users },
  { to: '/schedule',   label: 'Schedule',     icon: Calendar },
  { to: '/pairings',   label: 'Pairings',     icon: Shuffle,       adminOnly: true },
  { to: '/scorecards', label: 'Scorecards',   icon: ClipboardList },
  { to: '/courses',    label: 'Courses',      icon: MapPin },
  { to: '/results',    label: 'Team Results', icon: Trophy },
  { to: '/ctp',        label: 'Par 3 CTP',    icon: Crosshair },
  { to: '/hole-in-one',label: 'Hole in One',  icon: Aperture },
  { to: '/stats',      label: 'Stats',        icon: TrendingUp },
  { to: '/archive',    label: 'Archive',      icon: Archive },
  { to: '/history',    label: 'History',      icon: BookOpen },
  { to: '/print',      label: 'Print All',    icon: Printer },
]

export default function Layout() {
  const { year, liveYear, archivedYears, isViewingHistory, switchToYear, returnToLive } = useTournamentStore()
  const { connected } = useSyncStatus()
  const isAdmin = useIsAdmin()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-masters-dark text-white no-print">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-4">
          <img src={`${import.meta.env.BASE_URL}Juggerknocker Invitational logo.png`} alt="Juggerknocker Invitational" className="h-36 w-36 shrink-0 object-contain" />
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <h1 className="font-serif text-3xl font-bold leading-tight tracking-wide">
              Juggerknocker Invitational
            </h1>
            <p className="text-masters-gold text-sm font-semibold tracking-widest mt-0.5 uppercase">
              {year} Season
            </p>
          </Link>
          {/* Admin year selector */}
          {isAdmin && archivedYears.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <History size={13} className="text-white/50 shrink-0" />
              <select
                className="bg-transparent text-white/80 text-xs border border-white/20 rounded px-1.5 py-0.5 focus:outline-none focus:border-white/50 cursor-pointer"
                value={isViewingHistory ? year : liveYear}
                onChange={e => switchToYear(parseInt(e.target.value))}
              >
                <option value={liveYear}>{liveYear} (Live)</option>
                {[...archivedYears].sort((a, b) => b.year - a.year).map(a => (
                  <option key={a.year} value={a.year}>{a.year}</option>
                ))}
              </select>
            </div>
          )}
          {isSupabaseEnabled && (
            <div className={`${isAdmin && archivedYears.length > 0 ? '' : 'ml-auto'} flex items-center gap-1.5 text-xs text-white/60`} title={connected ? 'Live sync connected' : 'Connecting…'}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-white/30'}`} />
              <span className="hidden sm:inline">{connected ? 'Live' : 'Syncing…'}</span>
            </div>
          )}
          <HeaderAdminWidget />
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="sticky top-[100px] z-40 bg-masters-green text-white shadow no-print">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex flex-wrap gap-0.5 py-1">
            {NAV.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
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

      {/* History mode banner */}
      {isViewingHistory && (
        <div className="bg-amber-500 text-white no-print">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History size={15} className="shrink-0" />
              Viewing {year} historical data — changes are saved locally only
            </div>
            <button
              onClick={returnToLive}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 transition-colors rounded px-3 py-1.5 font-semibold shrink-0"
            >
              Return to {liveYear} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

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
