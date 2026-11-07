import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGate from './components/AuthGate'
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
function SupabaseSync() {
  useSupabaseSync()
  return null
}

export default function App() {

  return (
    <AuthGate>
    <SupabaseSync />
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
    </AuthGate>
  )
}
