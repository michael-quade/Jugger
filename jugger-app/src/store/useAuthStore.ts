import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  currentAdmin: string | null
  currentRole: 'admin' | 'scorer' | 'player' | 'treasurer' | null
  canScore: boolean
  canTreasure: boolean
  syncFromSession: (session: Session) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  currentAdmin: null,
  currentRole: null,
  canScore: false,
  canTreasure: false,

  syncFromSession: async (session) => {
    if (!supabase) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, role, can_score, can_treasure')
      .eq('id', session.user.id)
      .single()
    if (!profile) return
    const role = profile.role as AuthState['currentRole']
    set({
      currentAdmin: profile.display_name || profile.username,
      currentRole: role,
      canScore:
        role === 'admin' ||
        role === 'scorer' ||
        (role === 'player' && profile.can_score === true),
      canTreasure:
        role === 'admin' ||
        role === 'treasurer' ||
        (role === 'player' && profile.can_treasure === true),
    })
  },

  logout: () => set({
    currentAdmin: null,
    currentRole: null,
    canScore: false,
    canTreasure: false,
  }),
}))

export const useIsAdmin           = () => useAuthStore(s => s.currentRole === 'admin')
export const useIsScorer          = () => useAuthStore(s => s.currentRole === 'scorer')
export const useIsPlayer          = () => useAuthStore(s => s.currentRole === 'player')
export const useCanEnterScores    = () => useAuthStore(s => s.canScore)
export const useCanManagePayments = () => useAuthStore(s => s.canTreasure)
export const useCanAccessBoard    = () => useAuthStore(s =>
  s.currentRole === 'admin' || s.currentRole === 'player'
)
export const useCurrentAdmin      = () => useAuthStore(s => s.currentAdmin)
