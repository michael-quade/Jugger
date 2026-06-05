import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Courses from './pages/Courses'
import CourseHistory from './pages/CourseHistory'
import Stats from './pages/Stats'
import FileArchive from './pages/FileArchive'
import Schedule from './pages/Schedule'
import Pairings from './pages/Pairings'
import ScorecardView from './pages/ScorecardView'
import Results from './pages/Results'
import HoleInOne from './pages/HoleInOne'
import PrintAll from './pages/PrintAll'
import CtpPage from './pages/CtpPage'
import { useTournamentStore } from './store/useTournamentStore'
import { hashPassword } from './utils/auth'

export default function App() {
  const { admins, addAdmin } = useTournamentStore()
  useSupabaseSync()

  useEffect(() => {
    if (admins.length === 0) {
      hashPassword('8675309#').then(hash => {
        addAdmin({ username: 'quade', passwordHash: hash })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="teams" element={<Teams />} />
        <Route path="courses" element={<Courses />} />
        <Route path="history" element={<CourseHistory />} />
        <Route path="stats" element={<Stats />} />
        <Route path="archive" element={<FileArchive />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="pairings" element={<Pairings />} />
        <Route path="scorecards" element={<ScorecardView />} />
        <Route path="results" element={<Results />} />
        <Route path="hole-in-one" element={<HoleInOne />} />
        <Route path="ctp" element={<CtpPage />} />
        <Route path="print" element={<PrintAll />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
