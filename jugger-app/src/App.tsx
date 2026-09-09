import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import Dashboard from './pages/Dashboard'

// Lazy-loaded pages — each becomes its own JS chunk at build time.
// Dashboard stays eager so the initial route renders without delay.
const Teams           = lazy(() => import('./pages/Teams'))
const Courses         = lazy(() => import('./pages/Courses'))
const CourseHistory   = lazy(() => import('./pages/CourseHistory'))
const Stats           = lazy(() => import('./pages/Stats'))
const Analytics       = lazy(() => import('./pages/Analytics'))
const FileArchive     = lazy(() => import('./pages/FileArchive'))
const Schedule        = lazy(() => import('./pages/Schedule'))
const Pairings        = lazy(() => import('./pages/Pairings'))
const ScorecardView   = lazy(() => import('./pages/ScorecardView'))
const Results         = lazy(() => import('./pages/Results'))
const HoleInOne       = lazy(() => import('./pages/HoleInOne'))
const PrintAll        = lazy(() => import('./pages/PrintAll'))
const SkidmoreHdcp    = lazy(() => import('./pages/SkidmoreHdcp'))
const RoundGames      = lazy(() => import('./pages/RoundGames'))
const CtpPage         = lazy(() => import('./pages/CtpPage'))
const Lodging         = lazy(() => import('./pages/Lodging'))
const MessageBoard    = lazy(() => import('./pages/MessageBoard'))
const MessageBoardThread = lazy(() => import('./pages/MessageBoardThread'))
const SideBets        = lazy(() => import('./pages/SideBets'))
const SideBetCreate   = lazy(() => import('./pages/SideBetCreate'))
const SideBetDetail   = lazy(() => import('./pages/SideBetDetail'))
// --- MOBILE SCORING FEATURE (remove this lazy + the route below to revert) ---
const MobileScoring   = lazy(() => import('./pages/MobileScoring'))
// --- END MOBILE SCORING ---
const Summary         = lazy(() => import('./pages/Summary'))
import { useTournamentStore } from './store/useTournamentStore'
import { useAuthStore } from './store/useAuthStore'
import { hashPassword, DEFAULT_PASSWORD, generateUsername } from './utils/auth'

export default function App() {
  const { admins, addAdmin, teams } = useTournamentStore()
  const checkSessionTimeout = useAuthStore(s => s.checkSessionTimeout)
  useSupabaseSync()

  // Hard 12-hour session timeout — checked every minute
  useEffect(() => {
    const id = setInterval(checkSessionTimeout, 60_000)
    return () => clearInterval(id)
  }, [checkSessionTimeout])

  // Bootstrap default quade admin on first load
  useEffect(() => {
    if (admins.length === 0) {
      hashPassword(import.meta.env.VITE_ADMIN_BOOTSTRAP_PASSWORD ?? '8675309#').then(hash => {
        addAdmin({ username: 'quade', passwordHash: hash })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-create player accounts for all roster members and active subs
  useEffect(() => {
    async function ensurePlayerAccounts() {
      const { admins: currentAdmins, addAdmin: doAddAdmin } = useTournamentStore.getState()
      const defaultHash = await hashPassword(DEFAULT_PASSWORD)

      for (const team of teams) {
        for (const player of team.players) {
          if (player.isSubstitute) {
            // Sub slot: create a temporary sub account if one doesn't exist
            const hasSubAccount = currentAdmins.some(
              a => a.subForPlayerId === player.id && a.isSubAccount
            )
            if (!hasSubAccount) {
              const existing = useTournamentStore.getState().admins.map(a => a.username)
              const username = generateUsername(player.name, existing)
              doAddAdmin({
                username,
                passwordHash: defaultHash,
                role: 'player',
                canScore: false,
                isDefaultPassword: true,
                mustChangePassword: true,
                subForPlayerId: player.id,
                isSubAccount: true,
                displayName: player.name,
              })
            }
            // Also ensure the benched original player has a permanent account
            const originalName = player.originalName
            if (originalName) {
              const hasOriginalAccount = useTournamentStore.getState().admins.some(
                a => a.playerId === player.id && !a.isSubAccount
              )
              if (!hasOriginalAccount) {
                const existing = useTournamentStore.getState().admins.map(a => a.username)
                const username = generateUsername(originalName, existing)
                doAddAdmin({
                  username,
                  passwordHash: defaultHash,
                  role: 'player',
                  canScore: false,
                  isDefaultPassword: true,
                  mustChangePassword: true,
                  playerId: player.id,
                  displayName: originalName,
                })
              }
            }
          } else {
            // Regular or permanent-replacement slot: create account if none exists
            const hasAccount = currentAdmins.some(
              a => a.playerId === player.id && !a.isSubAccount
            )
            if (!hasAccount) {
              const existing = useTournamentStore.getState().admins.map(a => a.username)
              const username = generateUsername(player.name, existing)
              doAddAdmin({
                username,
                passwordHash: defaultHash,
                role: 'player',
                canScore: false,
                isDefaultPassword: true,
                mustChangePassword: true,
                playerId: player.id,
                displayName: player.name,
              })
            }
          }
        }
      }
    }
    ensurePlayerAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams])

  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f0' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e8f0ec', borderTopColor: '#006747', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
    <Routes>
      {/* --- MOBILE SCORING FEATURE (remove this route + import above to revert) --- */}
      <Route path="/scorecards/:matchId/mobile" element={<MobileScoring />} />
      {/* --- END MOBILE SCORING --- */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="teams" element={<Teams />} />
        <Route path="courses" element={<Courses />} />
        <Route path="history" element={<CourseHistory />} />
        <Route path="stats" element={<Stats />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="archive" element={<FileArchive />} />
        <Route path="lodging" element={<Lodging />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="pairings" element={<Pairings />} />
        <Route path="scorecards" element={<ScorecardView />} />
        <Route path="round-games" element={<RoundGames />} />
        <Route path="results" element={<Results />} />
        <Route path="hole-in-one" element={<HoleInOne />} />
        <Route path="ctp" element={<CtpPage />} />
        <Route path="print" element={<PrintAll />} />
        <Route path="skidmore-hdcp" element={<SkidmoreHdcp />} />
        <Route path="board" element={<MessageBoard />} />
        <Route path="board/:threadId" element={<MessageBoardThread />} />
        <Route path="side-bets" element={<SideBets />} />
        <Route path="side-bets/new" element={<SideBetCreate />} />
        <Route path="side-bets/:betId" element={<SideBetDetail />} />
        <Route path="summary" element={<Summary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
