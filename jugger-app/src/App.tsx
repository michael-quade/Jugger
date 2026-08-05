import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Courses from './pages/Courses'
import CourseHistory from './pages/CourseHistory'
import Stats from './pages/Stats'
import Analytics from './pages/Analytics'
import FileArchive from './pages/FileArchive'
import Schedule from './pages/Schedule'
import Pairings from './pages/Pairings'
import ScorecardView from './pages/ScorecardView'
import Results from './pages/Results'
import HoleInOne from './pages/HoleInOne'
import PrintAll from './pages/PrintAll'
import SkidmoreHdcp from './pages/SkidmoreHdcp'
import RoundGames from './pages/RoundGames'
import CtpPage from './pages/CtpPage'
import Lodging from './pages/Lodging'
import MessageBoard from './pages/MessageBoard'
import MessageBoardThread from './pages/MessageBoardThread'
import { useTournamentStore } from './store/useTournamentStore'
import { hashPassword, DEFAULT_PASSWORD, generateUsername } from './utils/auth'

export default function App() {
  const { admins, addAdmin, teams } = useTournamentStore()
  useSupabaseSync()

  // Bootstrap default quade admin on first load
  useEffect(() => {
    if (admins.length === 0) {
      hashPassword('8675309#').then(hash => {
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
                canScore: true,        // subs always get scorer rights
                isDefaultPassword: true,
                mustChangePassword: true,
                subForPlayerId: player.id,
                isSubAccount: true,
                displayName: player.name,
              })
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
    <Routes>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
