import { create } from 'zustand'
import { verifyPassword } from '../utils/auth'
import { useTournamentStore } from './useTournamentStore'

interface AuthState {
  currentAdmin: string | null
  currentRole: 'admin' | 'scorer' | 'player' | null
  canScore: boolean
  mustChangePassword: boolean
  loginError: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  clearMustChangePassword: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentAdmin: null,
  currentRole: null,
  canScore: false,
  mustChangePassword: false,
  loginError: null,
  loggingIn: false,

  login: async (username, password) => {
    set({ loggingIn: true, loginError: null })
    const { admins } = useTournamentStore.getState()
    const cred = admins.find(a => a.username.toLowerCase() === username.toLowerCase())
    if (!cred) {
      set({ loggingIn: false, loginError: 'Invalid username or password.' })
      return false
    }
    const ok = await verifyPassword(password, cred.passwordHash)
    if (ok) {
      const role = cred.role ?? 'admin'
      const canScore =
        role === 'admin' ||
        role === 'scorer' ||
        (role === 'player' && cred.canScore === true)
      set({
        currentAdmin: cred.username,
        currentRole: role,
        canScore,
        mustChangePassword: cred.mustChangePassword === true,
        loggingIn: false,
        loginError: null,
      })
    } else {
      set({ loggingIn: false, loginError: 'Invalid username or password.' })
    }
    return ok
  },

  logout: () => set({
    currentAdmin: null,
    currentRole: null,
    canScore: false,
    mustChangePassword: false,
    loginError: null,
  }),

  clearError: () => set({ loginError: null }),
  clearMustChangePassword: () => set({ mustChangePassword: false }),
}))

export const useIsAdmin        = () => useAuthStore(s => s.currentRole === 'admin')
export const useIsScorer       = () => useAuthStore(s => s.currentRole === 'scorer')
export const useIsPlayer       = () => useAuthStore(s => s.currentRole === 'player')
export const useCanEnterScores = () => useAuthStore(s => s.canScore)
export const useCanAccessBoard = () => useAuthStore(s =>
  s.currentRole === 'admin' || s.currentRole === 'player'
)
export const useCurrentAdmin   = () => useAuthStore(s => s.currentAdmin)
