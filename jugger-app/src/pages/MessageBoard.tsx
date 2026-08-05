import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Plus, Pin, Lock, RefreshCw, X, Camera, Image, Search, Smile } from 'lucide-react'
import { EmojiPickerPopover } from '../components/EmojiPickerPopover'
import { supabase, isSupabaseEnabled } from '../lib/supabase'
import { useAuthStore, useIsAdmin, useCanAccessBoard } from '../store/useAuthStore'
import { useTournamentStore } from '../store/useTournamentStore'
import { useBoardStore } from '../store/useBoardStore'
import { compressImage } from '../utils/imageCompress'
import { isThreadUnread, markThreadRead, countUnreadThreads } from '../utils/boardUtils'
import type { MbThread } from '../types'
import { MB_CATEGORIES } from '../types'

const ALL_TAB = 'All'
const BUCKET  = 'jugger-board'

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
  const isAdmin   = useIsAdmin()
  const canAccess = useCanAccessBoard()
  const { admins, year } = useTournamentStore()
  const { setUnreadCount } = useBoardStore()

  const displayName = useCallback((username: string) => {
    const cred = admins.find(a => a.username === username)
    return cred?.displayName ?? username
  }, [admins])

  const [threads,    setThreads]    = useState<MbThread[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [tab,        setTab]        = useState<string>(ALL_TAB)
  const [search,     setSearch]     = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // New thread form
  const [newTitle,    setNewTitle]    = useState('')
  const [newCategory, setNewCategory] = useState<string>(MB_CATEGORIES[0])
  const [newBody,     setNewBody]     = useState('')
  const [posting,     setPosting]     = useState(false)
  const [postError,   setPostError]   = useState<string | null>(null)
  const [newFiles,       setNewFiles]       = useState<File[]>([])
  const [newPreviews,    setNewPreviews]    = useState<string[]>([])
  const [uploading,      setUploading]      = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const newBodyRef      = useRef<HTMLTextAreaElement>(null)

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
    else {
      const list = data as MbThread[]
      setThreads(list)
      setUnreadCount(countUnreadThreads(list, currentAdmin))
    }
    setLoading(false)
    setRefreshing(false)
  }, [year, currentAdmin, setUnreadCount])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - newFiles.length)
    setNewFiles(prev => [...prev, ...files].slice(0, 4))
    files.forEach(f => setNewPreviews(prev => [...prev, URL.createObjectURL(f)]))
    e.target.value = ''
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(newPreviews[idx])
    setNewFiles(prev => prev.filter((_, i) => i !== idx))
    setNewPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadImages(files: File[]): Promise<string[]> {
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i])
      const path = `board/${year}/${Date.now()}-${i}.jpg`
      const { error: upErr } = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase!.storage.from(BUCKET).getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  function insertEmoji(emoji: string) {
    const ta = newBodyRef.current
    const start = ta?.selectionStart ?? newBody.length
    const end   = ta?.selectionEnd   ?? newBody.length
    setNewBody(newBody.slice(0, start) + emoji + newBody.slice(end))
    setShowEmojiPicker(false)
    setTimeout(() => {
      ta?.focus()
      ta?.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !currentAdmin || !newTitle.trim()) return
    if (!newBody.trim() && newFiles.length === 0) return
    setPosting(true)
    setPostError(null)
    try {
      let imageUrls: string[] = []
      if (newFiles.length > 0) {
        setUploading(true)
        imageUrls = await uploadImages(newFiles)
        setUploading(false)
      }
      const now = new Date().toISOString()
      const { data: threadData, error: threadErr } = await supabase
        .from('mb_threads')
        .insert([{ year, category: newCategory, title: newTitle.trim(), author: currentAdmin, last_reply_at: now, reply_count: 0, is_pinned: false, is_locked: false }])
        .select().single()
      if (threadErr || !threadData) throw threadErr ?? new Error('Failed to create thread.')
      await supabase.from('mb_posts').insert([{
        thread_id: threadData.id, year, is_op: true, author: currentAdmin,
        body: newBody.trim(),
        image_urls: imageUrls.length > 0 ? imageUrls : null,
      }])
      newPreviews.forEach(url => URL.revokeObjectURL(url))
      setThreads(ts => [threadData as MbThread, ...ts])
      setNewTitle(''); setNewBody(''); setNewCategory(MB_CATEGORIES[0])
      setNewFiles([]); setNewPreviews([])
      setShowNew(false)
      // mark as read immediately since we just created it
      markThreadRead(currentAdmin, threadData.id)
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post.')
    } finally {
      setPosting(false)
      setUploading(false)
    }
  }

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

  const visible = useMemo(() => {
    let list = tab === ALL_TAB ? threads : threads.filter(t => t.category === tab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => t.title.toLowerCase().includes(q))
    }
    return list
  }, [threads, tab, search])

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
        <h2 className="font-serif text-xl font-bold text-masters-dark mb-2">Players Only</h2>
        <p className="text-gray-500 text-sm">Sign in with your player account to access the board.</p>
      </div>
    )
  }

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
          <button onClick={fetchThreads} disabled={refreshing} className="btn-ghost p-1.5" title="Refresh">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {canAccess && currentAdmin && (
            <button onClick={() => setShowNew(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> New Thread
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="input w-full pl-8 text-sm"
          placeholder="Search threads…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* New thread form */}
      {showNew && (
        <div className="card mb-5 border border-masters-green/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-masters-dark">New Thread</h3>
            <button onClick={() => { setShowNew(false); newPreviews.forEach(u => URL.revokeObjectURL(u)); setNewFiles([]); setNewPreviews([]) }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreateThread} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Title</label>
                <input className="input w-full" placeholder="Thread title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={120} required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  {MB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Post</label>
              <textarea ref={newBodyRef} className="input w-full resize-y" rows={4} placeholder={`What's on your mind? **bold**, _italic_, \`code\`, @mention`} value={newBody} onChange={e => setNewBody(e.target.value)} />
            </div>
            {/* Photo picker */}
            {newPreviews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {newPreviews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="h-16 w-16 object-cover rounded border border-gray-200" alt="" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
            {postError && <p className="text-red-500 text-sm">{postError}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <button type="submit" className="btn-primary" disabled={posting || !newTitle.trim() || (!newBody.trim() && newFiles.length === 0)}>
                {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post Thread'}
              </button>
              {newFiles.length < 4 && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-ghost flex items-center gap-1.5 text-sm">
                  <Camera size={14} /> Photo {newFiles.length > 0 ? `(${newFiles.length}/4)` : ''}
                </button>
              )}
              <div className="relative">
                <button type="button" onClick={() => setShowEmojiPicker(v => !v)}
                  className="btn-ghost flex items-center gap-1.5 text-sm" title="Insert emoji">
                  <Smile size={14} />
                </button>
                {showEmojiPicker && (
                  <EmojiPickerPopover onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)} />
                )}
              </div>
              <button type="button" className="btn-ghost text-sm" onClick={() => { setShowNew(false); setShowEmojiPicker(false); newPreviews.forEach(u => URL.revokeObjectURL(u)); setNewFiles([]); setNewPreviews([]) }}>
                Cancel
              </button>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handleFileSelect} />
          </form>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4">
        {[ALL_TAB, ...MB_CATEGORIES].map(c => (
          <button key={c} onClick={() => setTab(c)}
            className={`shrink-0 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
              tab === c ? 'bg-masters-green text-white' : 'bg-masters-light text-masters-dark hover:bg-masters-green/10'
            }`}
          >{c}</button>
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
          <p className="text-gray-400 text-sm">{search ? `No threads match "${search}".` : tab === ALL_TAB ? 'No threads yet. Start a conversation!' : `No threads in ${tab} yet.`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(t => {
            const unread = isThreadUnread(t, currentAdmin)
            return (
              <div key={t.id} className={`card flex gap-3 items-start ${t.is_pinned ? 'border border-masters-gold/40 bg-amber-50/30' : ''}`}>
                {/* Unread dot */}
                <div className="pt-1 shrink-0">
                  <div className={`w-2 h-2 rounded-full mt-0.5 ${unread ? 'bg-masters-green' : 'bg-transparent'}`} title={unread ? 'New activity' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {t.is_pinned && <Pin size={11} className="text-masters-gold shrink-0" />}
                    {t.is_locked && <Lock size={11} className="text-gray-400 shrink-0" />}
                    <Link
                      to={`/board/${t.id}`}
                      className="font-semibold text-masters-dark hover:text-masters-green transition-colors leading-snug"
                      onClick={() => currentAdmin && markThreadRead(currentAdmin, t.id)}
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
                    <button onClick={() => handlePinThread(t)} title={t.is_pinned ? 'Unpin' : 'Pin'}
                      className={`p-1 rounded hover:bg-masters-light transition-colors ${t.is_pinned ? 'text-masters-gold' : 'text-gray-300 hover:text-masters-gold'}`}>
                      <Pin size={13} />
                    </button>
                    <button onClick={() => handleLockThread(t)} title={t.is_locked ? 'Unlock' : 'Lock'}
                      className={`p-1 rounded hover:bg-masters-light transition-colors ${t.is_locked ? 'text-gray-500' : 'text-gray-300 hover:text-gray-500'}`}>
                      <Lock size={13} />
                    </button>
                    <button onClick={() => handleDeleteThread(t.id)}
                      className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors" title="Delete thread">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
