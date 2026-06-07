import { create } from 'zustand'
import { verifyPassword } from '../utils/auth'
import { useTournamentStore } from './useTournamentStore'

interface AuthState {
  currentAdmin: string | null
  currentRole: 'admin' | 'scorer' | null
  loginError: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentAdmin: null,
  currentRole: null,
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
      set({ currentAdmin: cred.username, currentRole: cred.role ?? 'admin', loggingIn: false, loginError: null })
    } else {
      set({ loggingIn: false, loginError: 'Invalid username or password.' })
    }
    return ok
  },

  logout: () => set({ currentAdmin: null, currentRole: null, loginError: null }),
  clearError: () => set({ loginError: null }),
}))

// Convenience selectors
export const useIsAdmin = () => useAuthStore(s => s.currentRole === 'admin')
export const useIsScorer = () => useAuthStore(s => s.currentRole === 'scorer')
export const useCanEnterScores = () => useAuthStore(s => s.currentRole === 'admin' || s.currentRole === 'scorer')
export const useCurrentAdmin = () => useAuthStore(s => s.currentAdmin)
