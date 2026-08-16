import { useState, useEffect, useMemo } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { useTournamentStore } from '../store/useTournamentStore'
import {
  LayoutDashboard, Users, MapPin, Calendar, Shuffle,
  ClipboardList, Trophy, Aperture, Printer, BookOpen, TrendingUp, Archive, Crosshair,
  History, ArrowRight, Calculator, Gamepad2, Hotel, MessageSquare, DollarSign,
  type LucideIcon,
} from 'lucide-react'
import HeaderAdminWidget from './HeaderAdminWidget'
import { useSyncStatus } from '../hooks/useSupabaseSync'
import { isSupabaseEnabled } from '../lib/supabase'
import { useIsAdmin, useIsPlayer, useCanAccessBoard } from '../store/useAuthStore'
import { useBoardStore } from '../store/useBoardStore'

// ── Weather forecast ─────────────────────────────────────────────────────────
// Pinehurst, NC coordinates — update if event location changes year-over-year
const WX_LAT = 35.195
const WX_LON = -79.469
const WX_CACHE_MS = 60 * 60 * 1000 // re-fetch after 1 hour

interface DayFx { date: string; wmo: number; highF: number; lowF: number; rainPct: number }
interface WxCache { days: DayFx[]; mode: 'historical' | 'forecast'; label: string; fetchedAt: number }

function wmoEmoji(c: number) {
  if (c <= 1)  return '☀️'
  if (c === 2) return '⛅'
  if (c === 3) return '☁️'
  if (c < 50)  return '🌫️'
  if (c < 70)  return '🌧️'
  if (c < 80)  return '❄️'
  if (c < 83)  return '🌦️'
  return '⛈️'
}
function wmoLabel(c: number) {
  if (c === 0)  return 'Sunny'
  if (c === 1)  return 'Mostly Clear'
  if (c === 2)  return 'Partly Cloudy'
  if (c === 3)  return 'Overcast'
  if (c < 50)   return 'Foggy'
  if (c < 56)   return 'Drizzle'
  if (c < 66)   return 'Rain'
  if (c < 80)   return 'Snow'
  if (c < 83)   return 'Showers'
  return 'Thunderstorm'
}
function wmoSeverity(c: number) {
  if (c >= 95) return 7; if (c >= 80) return 6; if (c >= 61) return 5
  if (c >= 51) return 4; if (c === 3) return 3;  if (c === 2) return 2
  return c === 1 ? 1 : 0
}
function precipToRainPct(avgMm: number) {
  if (avgMm <= 0.1) return 5; if (avgMm <= 1) return 20; if (avgMm <= 3) return 40
  if (avgMm <= 6)   return 60; return 80
}
function fmtDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()] + ` · ${d.getMonth()+1}/${d.getDate()}`
}
const wxAvg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s,v) => s+v, 0) / arr.length) : 0

async function loadWeather(eventDates: string[]): Promise<WxCache | null> {
  if (!eventDates.length) return null

  // Don't show weather when viewing past events (archived years)
  const lastDateMs = new Date(eventDates[eventDates.length - 1] + 'T12:00:00').getTime()
  if (Date.now() > lastDateMs + 86_400_000) return null

  const cacheKey = `jugger-weather-v2-${eventDates[0]}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const c: WxCache = JSON.parse(raw)
      if (Date.now() - c.fetchedAt < WX_CACHE_MS) return c
    }
  } catch {}

  const startDate = eventDates[0]
  const endDate   = eventDates[eventDates.length - 1]
  const daysUntilEnd = (lastDateMs - Date.now()) / 86_400_000
  let result: WxCache | null = null

  // Switch to live forecast only when all event dates are comfortably inside
  // the 16-day API window. 14-day threshold gives a 2-day buffer so we never
  // ask the forecast API for dates right at its boundary (causes silent failure).
  if (daysUntilEnd > 14) {
    // Historical: average same calendar dates from prior 3 years
    const eventYear  = parseInt(startDate.slice(0, 4), 10)
    const priorYears = [eventYear - 1, eventYear - 2, eventYear - 3]

    const responses = await Promise.all(priorYears.map(async yr => {
      const s = startDate.replace(/^\d{4}/, String(yr))
      const e = endDate.replace(/^\d{4}/, String(yr))
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${WX_LAT}&longitude=${WX_LON}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&timezone=America%2FNew_York&temperature_unit=fahrenheit&start_date=${s}&end_date=${e}`
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return null
        return (await res.json()).daily as {
          weather_code: number[]; temperature_2m_max: number[]
          temperature_2m_min: number[]; precipitation_sum: number[]
        }
      } catch { return null }
    }))

    const valid = responses.filter(Boolean)
    if (!valid.length) return null

    const days: DayFx[] = eventDates.map((date, i) => {
      const highs   = valid.map(d => d!.temperature_2m_max[i]).filter((v): v is number => v != null)
      const lows    = valid.map(d => d!.temperature_2m_min[i]).filter((v): v is number => v != null)
      const codes   = valid.map(d => d!.weather_code[i]).filter((v): v is number => v != null)
      const precips = valid.map(d => d!.precipitation_sum[i] ?? 0)
      const wmo     = codes.length ? codes.reduce((w, c) => wmoSeverity(c) > wmoSeverity(w) ? c : w) : 0
      return { date, wmo, highF: wxAvg(highs), lowF: wxAvg(lows),
        rainPct: precipToRainPct(wxAvg(precips.map(Math.round)) ) }
    })
    result = { days, mode: 'historical', label: 'Historical Avg · 3yr', fetchedAt: Date.now() }

  } else {
    // Live forecast (Open-Meteo free tier, no API key)
    const label = daysUntilEnd > 7 ? 'Extended Forecast' : 'Forecast'
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WX_LAT}&longitude=${WX_LON}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=America%2FNew_York&temperature_unit=fahrenheit` +
      `&start_date=${startDate}&end_date=${endDate}&forecast_days=16`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const { daily } = await res.json()
      const { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = daily
      const days: DayFx[] = (time as string[]).map((date, i) => ({
        date, wmo: weather_code[i] ?? 0,
        highF:   Math.round(temperature_2m_max[i] ?? 0),
        lowF:    Math.round(temperature_2m_min[i] ?? 0),
        rainPct: precipitation_probability_max[i] ?? 0,
      }))
      result = { days, mode: 'forecast', label, fetchedAt: Date.now() }
    } catch { return null }
  }

  if (result) { try { localStorage.setItem(cacheKey, JSON.stringify(result)) } catch {} }
  return result
}

function WeatherCard({ day, isFirst }: { day: DayFx; isFirst: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-lg px-2 lg:px-2.5 py-1.5 min-w-[66px] lg:min-w-[76px] ${
      isFirst
        ? 'bg-masters-gold/[0.14] border border-masters-gold/50'
        : 'bg-white/[0.07] border border-white/[0.12]'
    }`}>
      <span className="text-[9px] font-bold text-masters-gold tracking-wide leading-none whitespace-nowrap">
        {fmtDayLabel(day.date)}
      </span>
      <span className="text-base lg:text-lg leading-none my-0.5">{wmoEmoji(day.wmo)}</span>
      <div className="flex items-baseline gap-0.5 leading-none">
        <span className="text-[11px] font-bold text-white">{day.highF}°</span>
        <span className="text-[9px] text-white/40">/{day.lowF}°</span>
      </div>
      <span className="text-[8px] text-white/50 text-center leading-tight">{wmoLabel(day.wmo)}</span>
      <span className={`text-[8px] flex items-center gap-0.5 mt-0.5 leading-none ${day.rainPct >= 40 ? 'text-blue-300/80' : 'text-white/35'}`}>
        💧{day.rainPct}%
      </span>
    </div>
  )
}
// ── End Weather ──────────────────────────────────────────────────────────────

const NAV: { to: string; label: string; icon: LucideIcon; adminOnly?: boolean; boardOnly?: boolean; playerOrAdmin?: boolean }[] = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/teams',      label: 'Teams',        icon: Users },
  { to: '/schedule',   label: 'Schedule',     icon: Calendar },
  { to: '/pairings',   label: 'Pairings',     icon: Shuffle,       adminOnly: true },
  { to: '/scorecards', label: 'Scorecards',   icon: ClipboardList },
  { to: '/side-bets',  label: 'Side Bets',    icon: DollarSign,    playerOrAdmin: true },
  { to: '/lodging',    label: 'Lodging',      icon: Hotel },
  { to: '/board',      label: 'Board',        icon: MessageSquare },
  { to: '/courses',      label: 'Courses',      icon: MapPin },
  { to: '/round-games',  label: 'Rules/Games',  icon: Gamepad2 },
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

function formatDateRange(configs: { date?: string }[], year: number): string {
  const prefix = String(year)
  const dates = configs.map(c => c.date).filter(d => d?.startsWith(prefix)) as string[]
  if (dates.length === 0) return ''
  dates.sort()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const first = new Date(dates[0] + 'T12:00:00')
  const last  = new Date(dates[dates.length - 1] + 'T12:00:00')
  if (first.getMonth() === last.getMonth())
    return `${MONTHS[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`
}

export default function Layout() {
  const { year, liveYear, archivedYears, isViewingHistory, switchToYear, returnToLive, roundConfigs, location } = useTournamentStore()
  const { connected } = useSyncStatus()
  const dateRange   = formatDateRange(roundConfigs, year)
  const isAdmin     = useIsAdmin()
  const isPlayer    = useIsPlayer()
  const canBoard    = useCanAccessBoard()
  const unreadCount = useBoardStore(s => s.unreadCount)

  // Weather: derive unique event dates from roundConfigs, fetch forecast or historical avg
  const [weather, setWeather] = useState<WxCache | null>(null)
  const eventDates = useMemo(() => {
    const prefix = String(year)
    return [...new Set(
      roundConfigs.map(rc => rc.date).filter((d): d is string => !!d && d.startsWith(prefix))
    )].sort()
  }, [roundConfigs, year])
  useEffect(() => {
    if (!eventDates.length) return
    let cancelled = false
    loadWeather(eventDates).then(result => { if (!cancelled && result) setWeather(result) })
    return () => { cancelled = true }
  }, [eventDates.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky chrome: header + nav + optional history banner */}
      <div id="site-header" className="sticky top-0 z-50 no-print">
        {/* Top header */}
        <header className="bg-masters-dark text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 lg:py-5 flex items-center gap-2 lg:gap-3">

            {/* Left: logo + title */}
            <Link to="/" className="flex items-center gap-2 lg:gap-4 shrink-0 hover:opacity-80 transition-opacity">
              <img src={`${import.meta.env.BASE_URL}Juggerknocker Invitational logo.png`} alt="Juggerknocker Invitational" className="h-14 w-14 lg:h-36 lg:w-36 shrink-0 object-contain" />
              <div>
                <h1 className="font-serif text-lg lg:text-3xl font-bold leading-tight tracking-wide">
                  Juggerknocker Invitational
                </h1>
                <p className="text-masters-gold text-xs lg:text-sm font-semibold tracking-widest mt-0.5 uppercase">
                  {year} Season
                </p>
                {location && (
                  <p className="text-white/70 text-[10px] lg:text-xs leading-tight mt-0.5">{location}</p>
                )}
                {dateRange && (
                  <p className="text-white/60 text-[10px] lg:text-xs leading-tight">{dateRange}</p>
                )}
              </div>
            </Link>

            {/* Admin year selector (stays near title) */}
            {isAdmin && archivedYears.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs shrink-0">
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

            {/* Center: weather strip — fills remaining space, hidden on mobile */}
            <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-1 min-w-0">
              {weather && (
                <>
                  <span className="text-[8px] font-bold tracking-[0.12em] text-white/30 uppercase">
                    {weather.label}
                  </span>
                  <div className="flex gap-1.5">
                    {weather.days.map((day, i) => (
                      <WeatherCard key={day.date} day={day} isFirst={i === 0} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right: sync dot + admin widget (always grouped together) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              {isSupabaseEnabled && (
                <div className="flex items-center gap-1.5 text-xs text-white/60" title={connected ? 'Live sync connected' : 'Connecting…'}>
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-white/30'}`} />
                  <span className="hidden sm:inline">{connected ? 'Live' : 'Syncing…'}</span>
                </div>
              )}
              <HeaderAdminWidget />
            </div>

          </div>

          {/* Mobile portrait weather — compact single row; hidden on md+ where center strip shows */}
          {weather && (
            <div className="md:hidden flex items-center justify-center gap-2.5 pb-2 px-4 flex-wrap">
              <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase shrink-0">
                {weather.label}
              </span>
              <div className="flex items-center gap-0.5">
                {weather.days.map((day, i) => (
                  <div key={day.date} className="flex items-center">
                    {i > 0 && <span className="text-white/20 mx-1.5 text-xs">·</span>}
                    <span className="text-sm leading-none mr-1">{wmoEmoji(day.wmo)}</span>
                    <span className="text-[10px] font-bold text-masters-gold mr-0.5">{fmtDayLabel(day.date).split(' ·')[0]}</span>
                    <span className="text-[10px] font-semibold text-white">{day.highF}°</span>
                    {day.rainPct >= 40 && (
                      <span className="text-[9px] text-blue-300/80 ml-0.5">💧{day.rainPct}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Sub-nav — scrolls horizontally on mobile instead of wrapping */}
        <nav className="bg-masters-green text-white shadow">
          <div className="max-w-7xl mx-auto px-4">
            <ul className="flex gap-0.5 py-1 overflow-x-auto nav-scrollable">
              {NAV.filter(({ adminOnly, boardOnly, playerOrAdmin }) =>
                (!adminOnly || isAdmin) && (!boardOnly || canBoard) && (!playerOrAdmin || isPlayer || isAdmin)
              ).map(({ to, label, icon: Icon }) => (
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
                    <span className="relative">
                      <Icon size={13} />
                      {to === '/board' && canBoard && unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold px-0.5 leading-none pointer-events-none">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
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
