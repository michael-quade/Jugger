import { useState } from 'react'
import { Shield, LogOut, Settings, ClipboardList, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import AdminPanel from './AdminPanel'

export default function HeaderAdminWidget() {
  const { currentAdmin, currentRole, logout } = useAuthStore()
  const [showPanel, setShowPanel] = useState(false)

  if (!currentAdmin) return null

  const isAdmin  = currentRole === 'admin'
  const isScorer = currentRole === 'scorer'

  const roleIcon = isAdmin
    ? <Shield size={14} className="text-masters-gold shrink-0" />
    : isScorer
      ? <ClipboardList size={14} className="text-masters-gold shrink-0" />
      : <User size={14} className="text-masters-gold shrink-0" />

  const handleSignOut = async () => {
    logout()
    await supabase?.auth.signOut({ scope: 'local' })
  }

  return (
    <>
      {showPanel && <AdminPanel onClose={() => setShowPanel(false)} />}
      <div className="ml-auto flex items-center gap-3">
        {roleIcon}
        <span className="text-white text-sm font-semibold hidden sm:inline">{currentAdmin}</span>
        {isAdmin && (
          <button
            className="hidden sm:flex items-center gap-1 text-xs text-white/70 hover:text-masters-gold transition-colors"
            onClick={() => setShowPanel(true)}
          >
            <Settings size={12} />
            Manage
          </button>
        )}
        {currentRole === 'player' && (
          <span className="hidden sm:inline text-xs text-white/50">Player</span>
        )}
        <button
          className="flex items-center gap-1 text-xs text-white/70 hover:text-red-400 transition-colors"
          onClick={handleSignOut}
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </>
  )
}
