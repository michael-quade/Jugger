import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import Login from './Login'

/**
 * Wraps the entire app. Shows the login screen until a golfer signs in.
 * Without a Supabase connection (local dev without .env.local), the app
 * opens without login, since there is no data to protect in that mode.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Start checked=true if Supabase isn't configured — skip login in dev.
  const [checked, setChecked] = useState(!supabase)
  const syncFromSession = useAuthStore(s => s.syncFromSession)

  useEffect(() => {
    if (!supabase) return
    // onAuthStateChange fires once immediately with the saved session
    // (works offline for the AuthGate part), then on every sign-in and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setChecked(true)
      if (next) {
        syncFromSession(next)
      } else {
        useAuthStore.getState().logout()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [syncFromSession])

  if (!checked) return null
  if (supabase && !session) return <Login />
  return <>{children}</>
}
