import { Outlet, NavLink, Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import {
  LayoutDashboard, Users, MapPin, Calendar, Shuffle,
  ClipboardList, Trophy, Aperture, Printer, BookOpen, TrendingUp, Archive, Crosshair,
  History, ArrowRight, Calculator, Gamepad2,
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
  { to: '/courses',      label: 'Courses',      icon: MapPin },
  { to: '/round-games',  label: 'Round Games',  icon: Gamepad2, adminOnly: true },
  { to: '/results',      label: 'Team Results', icon: Trophy,  adminOnly: true },
  { to: '/ctp',        label: 'Par 3 CTP',    icon: Crosshair },
  { to: '/hole-in-one',label: 'Hole in One',  icon: Aperture },
  { to: '/analytics',  label: 'Analytics',    icon: TrendingUp },
  { to: '/archive',    label: 'Archive',      icon: Archive,    adminOnly: true },
  { to: '/history',    label: 'Course History', icon: BookOpen },
  { to: '/print',           label: 'Print All',      icon: Printer,   adminOnly: true },
  { to: '/skidmore-hdcp',  label: 'Skidmore HDCP',  icon: Calculator, adminOnly: true },
]

// Five most-used pages pinned to the mobile bottom bar
const BOTTOM_NAV = [
  { to: '/',           label: 'Home',     icon: LayoutDashboard },
  { to: '/scorecards', label: 'Scores',   icon: ClipboardList },
  { to: '/ctp',        label: 'Par 3',    icon: Crosshair },
  { to: '/schedule',   label: 'Schedule', icon: Calendar },
  { to: '/results',    label: 'Results',  icon: Trophy },
]

export default function Layout() {
  const { year, liveYear, archivedYears, isViewingHistory, switchToYear, returnToLive } = useTournamentStore()
  const { connected } = useSyncStatus()
  const isAdmin = useIsAdmin()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky chrome: header + nav + optional history banner */}
      <div id="site-header" className="sticky top-0 z-50 no-print">
        {/* Top header */}
        <header className="bg-masters-dark text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 lg:py-5 flex items-center gap-2 lg:gap-4">
            <Link to="/" className="flex items-center gap-2 lg:gap-4 hover:opacity-80 transition-opacity">
              <img src={`${import.meta.env.BASE_URL}Juggerknocker Invitational logo.png`} alt="Juggerknocker Invitational" className="h-14 w-14 lg:h-36 lg:w-36 shrink-0 object-contain" />
              <div>
                <h1 className="font-serif text-lg lg:text-3xl font-bold leading-tight tracking-wide">
                  Juggerknocker Invitational
                </h1>
                <p className="text-masters-gold text-xs lg:text-sm font-semibold tracking-widest mt-0.5 uppercase">
                  {year} Season
                </p>
              </div>
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

        {/* Sub-nav — scrolls horizontally on mobile instead of wrapping */}
        <nav className="bg-masters-green text-white shadow">
          <div className="max-w-7xl mx-auto px-4">
            <ul className="flex gap-0.5 py-1 overflow-x-auto nav-scrollable">
              {NAV.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
                <li key={to} className="shrink-0">
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
                    <span className="hidden lg:inline">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* History mode banner */}
        {isViewingHistory && (
          <div className="bg-amber-500 text-white">
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
      </div>

      {/* Main content — extra bottom padding on mobile to clear the fixed bottom nav */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-24 lg:pb-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-masters-dark text-masters-gold/70 text-center text-xs py-2 no-print mb-14 lg:mb-0">
        {year} Juggerknocker Invitational
      </footer>

      {/* Mobile bottom nav — hidden on sm+ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-masters-green border-t border-black/20 lg:hidden no-print">
        <div className="flex">
          {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-masters-gold' : 'text-white/80'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
