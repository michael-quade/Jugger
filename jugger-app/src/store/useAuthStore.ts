import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { verifyPassword } from '../utils/auth'
import { useTournamentStore } from './useTournamentStore'

const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000 // 12 hours

interface AuthState {
  currentAdmin: string | null
  currentRole: 'admin' | 'scorer' | 'player' | 'treasurer' | null
  canScore: boolean
  canTreasure: boolean
  mustChangePassword: boolean
  loginError: string | null
  loggingIn: boolean
  loginAt: number | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  clearMustChangePassword: () => void
  checkSessionTimeout: () => void
}

export { SESSION_TIMEOUT_MS }

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  currentAdmin: null,
  currentRole: null,
  canScore: false,
  canTreasure: false,
  mustChangePassword: false,
  loginError: null,
  loggingIn: false,
  loginAt: null,

  login: async (username, password) => {
    set({ loggingIn: true, loginError: null })
    try {
      const { admins } = useTournamentStore.getState()
      if (admins.length === 0) {
        set({ loginError: 'Account data not loaded yet — try refreshing, or check that your browser allows connections to supabase.co (Brave Shields may be blocking it).' })
        return false
      }
      const cred = admins.find(a => a.username.toLowerCase() === username.toLowerCase())
      if (!cred) {
        set({ loginError: 'Invalid username or password.' })
        return false
      }
      const ok = await verifyPassword(password, cred.passwordHash)
      if (ok) {
        const role = cred.role ?? 'admin'
        const canScore =
          role === 'admin' ||
          role === 'scorer' ||
          (role === 'player' && cred.canScore === true)
        const canTreasure =
          role === 'admin' ||
          role === 'treasurer' ||
          (role === 'player' && cred.canTreasure === true)
        set({
          currentAdmin: cred.username,
          currentRole: role,
          canScore,
          canTreasure,
          mustChangePassword: cred.mustChangePassword === true,
          loginError: null,
          loginAt: Date.now(),
        })
      } else {
        set({ loginError: 'Invalid username or password.' })
      }
      return ok
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ loginError: `Sign-in error: ${msg}. Try refreshing the page.` })
      return false
    } finally {
      set({ loggingIn: false })
    }
  },

  logout: () => set({
    currentAdmin: null,
    currentRole: null,
    canScore: false,
    canTreasure: false,
    mustChangePassword: false,
    loginError: null,
    loginAt: null,
  }),

  clearError: () => set({ loginError: null }),
  clearMustChangePassword: () => set({ mustChangePassword: false }),

  checkSessionTimeout: () => {
    const { loginAt, currentAdmin, logout } = get()
    if (currentAdmin && loginAt && Date.now() - loginAt > SESSION_TIMEOUT_MS) {
      logout()
    }
  },
    }),
    {
      name: 'jugger-auth-session',
      partialize: (state) => ({
        currentAdmin: state.currentAdmin,
        currentRole: state.currentRole,
        canScore: state.canScore,
        canTreasure: state.canTreasure,
        mustChangePassword: state.mustChangePassword,
        loginAt: state.loginAt,
      }),
    }
  )
)

export const useIsAdmin           = () => useAuthStore(s => s.currentRole === 'admin')
export const useIsScorer          = () => useAuthStore(s => s.currentRole === 'scorer')
export const useIsPlayer          = () => useAuthStore(s => s.currentRole === 'player')
export const useCanEnterScores    = () => useAuthStore(s => s.canScore)
export const useCanManagePayments = () => useAuthStore(s => s.canTreasure)
export const useCanAccessBoard    = () => useAuthStore(s =>
  s.currentRole === 'admin' || s.currentRole === 'player'
)
export const useCurrentAdmin      = () => useAuthStore(s => s.currentAdmin)
