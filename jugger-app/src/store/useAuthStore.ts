import { create } from 'zustand'
import { verifyPassword } from '../utils/auth'
import { useTournamentStore } from './useTournamentStore'

interface AuthState {
  currentAdmin: string | null
  loginError: string | null
  loggingIn: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentAdmin: null,
  loginError: null,
  loggingIn: false,

  login: async (username, password) => {
    set({ loggingIn: true, loginError: null })
    const { admins } = useTournamentStore.getState()
    const admin = admins.find(a => a.username.toLowerCase() === username.toLowerCase())
    if (!admin) {
      set({ loggingIn: false, loginError: 'Invalid username or password.' })
      return false
    }
    const ok = await verifyPassword(password, admin.passwordHash)
    if (ok) {
      set({ currentAdmin: admin.username, loggingIn: false, loginError: null })
    } else {
      set({ loggingIn: false, loginError: 'Invalid username or password.' })
    }
    return ok
  },

  logout: () => set({ currentAdmin: null, loginError: null }),
  clearError: () => set({ loginError: null }),
}))

// Convenience selectors
export const useIsAdmin = () => useAuthStore(s => !!s.currentAdmin)
export const useCurrentAdmin = () => useAuthStore(s => s.currentAdmin)
