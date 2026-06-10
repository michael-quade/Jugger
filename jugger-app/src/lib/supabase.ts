import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isSupabaseEnabled = !!(url && key)

export const supabase = isSupabaseEnabled
  ? createClient(url!, key!, { realtime: { params: { eventsPerSecond: 10 } } })
  : null
