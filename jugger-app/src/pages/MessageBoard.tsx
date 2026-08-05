import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Plus, Pin, Lock, RefreshCw, X } from 'lucide-react'
import { supabase, isSupabaseEnabled } from '../lib/supabase'
import { useAuthStore, useIsAdmin, useCanAccessBoard } from '../store/useAuthStore'
import { useTournamentStore } from '../store/useTournamentStore'
import type { MbThread } from '../types'
import { MB_CATEGORIES } from '../types'

const ALL_TAB = 'All'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function MessageBoard() {
  const { currentAdmin } = useAuthStore()
  const isAdmin    = useIsAdmin()
  const canAccess  = useCanAccessBoard()
  const { admins, year } = useTournamentStore()

  const displayName = useCallback((username: string) => {
    const cred = admins.find(a => a.username === username)
    return cred?.displayName ?? username
  }, [admins])

  const [threads, setThreads]     = useState<MbThread[]>([])
  const [loading, setLoading]     = useState(true)
  const [error,   setError]       = useState<string | null>(null)
  const [tab,     setTab]         = useState<string>(ALL_TAB)
  const [showNew, setShowNew]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // New thread form
  const [newTitle,    setNewTitle]    = useState('')
  const [newCategory, setNewCategory] = useState<string>(MB_CATEGORIES[0])
  const [newBody,     setNewBody]     = useState('')
  const [posting,     setPosting]     = useState(false)
  const [postError,   setPostError]   = useState<string | null>(null)

  const fetchThreads = useCallback(async () => {
    if (!supabase) return
    setRefreshing(true)
    const { data, error: err } = await supabase
      .from('mb_threads')
      .select('*')
      .eq('year', year)
      .order('is_pinned', { ascending: false })
      .order('last_reply_at', { ascending: false })
    if (err) setError(err.message)
    else setThreads(data as MbThread[])
    setLoading(false)
    setRefreshing(false)
  }, [year])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  async function handleDeleteThread(threadId: string) {
    if (!supabase || !isAdmin) return
    if (!confirm('Delete this thread and all its replies?')) return
    await supabase.from('mb_threads').delete().eq('id', threadId)
    setThreads(ts => ts.filter(t => t.id !== threadId))
  }

  async function handlePinThread(thread: MbThread) {
    if (!supabase || !isAdmin) return
    await supabase.from('mb_threads').update({ is_pinned: !thread.is_pinned }).eq('id', thread.id)
    setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, is_pinned: !t.is_pinned } : t))
  }

  async function handleLockThread(thread: MbThread) {
    if (!supabase || !isAdmin) return
    await supabase.from('mb_threads').update({ is_locked: !thread.is_locked }).eq('id', thread.id)
    setThreads(ts => ts.map(t => t.id === thread.id ? { ...t, is_locked: !t.is_locked } : t))
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !currentAdmin || !newTitle.trim() || !newBody.trim()) return
    setPosting(true)
    setPostError(null)
    const now = new Date().toISOString()
    const { data: threadData, error: threadErr } = await supabase
      .from('mb_threads')
      .insert([{
        year,
        category: newCategory,
        title: newTitle.trim(),
        author: currentAdmin,
        last_reply_at: now,
        reply_count: 0,
        is_pinned: false,
        is_locked: false,
      }])
      .select()
      .single()
    if (threadErr || !threadData) {
      setPostError(threadErr?.message ?? 'Failed to create thread.')
      setPosting(false)
      return
    }
    // Insert OP post
    await supabase.from('mb_posts').insert([{
      thread_id: threadData.id,
      year,
      is_op: true,
      author: currentAdmin,
      body: newBody.trim(),
    }])
    setThreads(ts => [threadData as MbThread, ...ts])
    setNewTitle('')
    setNewBody('')
    setNewCategory(MB_CATEGORIES[0])
    setShowNew(false)
    setPosting(false)
  }

  const visible = tab === ALL_TAB
    ? threads
    : threads.filter(t => t.category === tab)

  if (!isSupabaseEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
        <h2 className="font-serif text-xl font-bold text-masters-dark mb-2">Board Unavailable</h2>
        <p className="text-gray-500 text-sm">Real-time sync is not configured. Message board requires Supabase.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-masters-green" />
          <h1 className="font-serif text-2xl font-bold text-masters-dark">Board</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchThreads}
            disabled={refreshing}
            className="btn-ghost p-1.5"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {canAccess && currentAdmin && (
            <button
              onClick={() => setShowNew(v => !v)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={14} />
              New Thread
            </button>
          )}
        </div>
      </div>

      {/* New thread form */}
      {showNew && (
        <div className="card mb-5 border border-masters-green/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-masters-dark">New Thread</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreateThread} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Title</label>
                <input
                  className="input w-full"
                  placeholder="Thread title…"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                >
                  {MB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Post</label>
              <textarea
                className="input w-full resize-y"
                rows={4}
                placeholder="What's on your mind?"
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                required
              />
            </div>
            {postError && <p className="text-red-500 text-sm">{postError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={posting || !newTitle.trim() || !newBody.trim()}
              >
                {posting ? 'Posting…' : 'Post Thread'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4">
        {[ALL_TAB, ...MB_CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`shrink-0 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              tab === c
                ? 'bg-masters-green text-white'
                : 'bg-masters-light text-masters-dark hover:bg-masters-green/10'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">
            {tab === ALL_TAB ? 'No threads yet. Start a conversation!' : `No threads in ${tab} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(t => (
            <div
              key={t.id}
              className={`card flex gap-3 items-start ${t.is_pinned ? 'border border-masters-gold/40 bg-amber-50/30' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {t.is_pinned && <Pin size={11} className="text-masters-gold shrink-0" />}
                  {t.is_locked && <Lock size={11} className="text-gray-400 shrink-0" />}
                  <Link
                    to={`/board/${t.id}`}
                    className="font-semibold text-masters-dark hover:text-masters-green transition-colors leading-snug"
                  >
                    {t.title}
                  </Link>
                  <span className="text-[10px] font-semibold bg-masters-light text-masters-dark px-2 py-0.5 rounded shrink-0">
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  by {displayName(t.author)} · {timeAgo(t.created_at)}
                  {t.reply_count > 0 && ` · ${t.reply_count} ${t.reply_count === 1 ? 'reply' : 'replies'}`}
                  {t.reply_count > 0 && ` · last ${timeAgo(t.last_reply_at)}`}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handlePinThread(t)}
                    title={t.is_pinned ? 'Unpin' : 'Pin'}
                    className={`p-1 rounded hover:bg-masters-light transition-colors ${t.is_pinned ? 'text-masters-gold' : 'text-gray-300 hover:text-masters-gold'}`}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={() => handleLockThread(t)}
                    title={t.is_locked ? 'Unlock' : 'Lock'}
                    className={`p-1 rounded hover:bg-masters-light transition-colors ${t.is_locked ? 'text-gray-500' : 'text-gray-300 hover:text-gray-500'}`}
                  >
                    <Lock size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteThread(t.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete thread"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!canAccess && !currentAdmin && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">Sign in with your player account to access the board.</p>
        </div>
      )}
    </div>
  )
}
