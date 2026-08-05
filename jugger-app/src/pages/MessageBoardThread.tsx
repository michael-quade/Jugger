import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, Pin, Pencil, Trash2, MessageSquare, Send, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore, useIsAdmin, useCanAccessBoard } from '../store/useAuthStore'
import { useTournamentStore } from '../store/useTournamentStore'
import { compressImage } from '../utils/imageCompress'
import { markThreadRead } from '../utils/boardUtils'
import type { MbThread, MbPost, MbReaction } from '../types'
import { MB_REACTION_EMOJIS } from '../types'

const BUCKET = 'jugger-board'

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

function PostBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g)
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-masters-green underline break-all">{part}</a>
          : part
      )}
    </p>
  )
}

interface LightboxState { urls: string[]; idx: number }

function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const { urls, idx: initIdx } = state
  const [idx, setIdx] = useState(initIdx)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(urls.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [urls.length, onClose])

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none" onClick={onClose}>✕</button>
      {urls.length > 1 && idx > 0 && (
        <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}>
          <ChevronLeft size={36} />
        </button>
      )}
      <img
        src={urls[idx]}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
        onClick={e => e.stopPropagation()}
        alt=""
      />
      {urls.length > 1 && idx < urls.length - 1 && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}>
          <ChevronRight size={36} />
        </button>
      )}
      {urls.length > 1 && (
        <p className="absolute bottom-4 text-white/50 text-sm">{idx + 1} / {urls.length}</p>
      )}
    </div>
  )
}

export default function MessageBoardThread() {
  const { threadId } = useParams<{ threadId: string }>()
  const { currentAdmin } = useAuthStore()
  const isAdmin   = useIsAdmin()
  const canAccess = useCanAccessBoard()
  const { admins, year } = useTournamentStore()

  const displayName = useCallback((username: string) => {
    const cred = admins.find(a => a.username === username)
    return cred?.displayName ?? username
  }, [admins])

  const [thread,    setThread]    = useState<MbThread | null>(null)
  const [posts,     setPosts]     = useState<MbPost[]>([])
  const [reactions, setReactions] = useState<MbReaction[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Reply form
  const [reply,       setReply]       = useState('')
  const [posting,     setPosting]     = useState(false)
  const [postErr,     setPostErr]     = useState<string | null>(null)
  const [pendingImgs, setPendingImgs] = useState<File[]>([])
  const [previews,    setPreviews]    = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editBody,   setEditBody]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Lightbox
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  // Sticky reply button (mobile)
  const replyFormRef = useRef<HTMLDivElement>(null)
  const [showJumpReply, setShowJumpReply] = useState(false)
  useEffect(() => {
    if (!replyFormRef.current) return
    const obs = new IntersectionObserver(([entry]) => setShowJumpReply(!entry.isIntersecting), { threshold: 0 })
    obs.observe(replyFormRef.current)
    return () => obs.disconnect()
  }, [loading])

  // ── Initial data fetch ─────────────────────────────────────
  useEffect(() => {
    if (!supabase || !threadId) return
    ;(async () => {
      const [threadRes, postsRes, reactionsRes] = await Promise.all([
        supabase.from('mb_threads').select('*').eq('id', threadId).single(),
        supabase.from('mb_posts').select('*').eq('thread_id', threadId).eq('is_deleted', false).order('created_at'),
        supabase.from('mb_reactions').select('*').eq('thread_id', threadId),
      ])
      if (threadRes.error) setError(threadRes.error.message)
      else setThread(threadRes.data as MbThread)
      if (postsRes.data)     setPosts(postsRes.data as MbPost[])
      if (reactionsRes.data) setReactions(reactionsRes.data as MbReaction[])
      setLoading(false)
      // Mark as read
      if (currentAdmin && threadId) markThreadRead(currentAdmin, threadId)
    })()
  }, [threadId, currentAdmin])

  // ── Realtime: new posts ───────────────────────────────────
  useEffect(() => {
    if (!supabase || !threadId) return
    const channel = supabase.channel(`mb_posts_${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mb_posts',
        filter: `thread_id=eq.${threadId}`,
      }, payload => {
        const incoming = payload.new as MbPost
        if (incoming.is_deleted) return
        setPosts(ps => {
          if (ps.some(p => p.id === incoming.id)) return ps
          return [...ps, incoming]
        })
        setThread(t => t ? { ...t, reply_count: t.reply_count + 1, last_reply_at: incoming.created_at } : t)
        if (currentAdmin && threadId) markThreadRead(currentAdmin, threadId)
      })
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [threadId, currentAdmin])

  // ── Realtime: reactions ────────────────────────────────────
  useEffect(() => {
    if (!supabase || !threadId) return
    const channel = supabase.channel(`mb_reactions_${threadId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mb_reactions',
        filter: `thread_id=eq.${threadId}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setReactions(rs => {
            if (rs.some(r => r.id === (payload.new as MbReaction).id)) return rs
            return [...rs, payload.new as MbReaction]
          })
        } else if (payload.eventType === 'DELETE') {
          setReactions(rs => rs.filter(r => r.id !== (payload.old as { id: string }).id))
        }
      })
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [threadId])

  // ── Reactions computed per post ────────────────────────────
  const reactionsByPost = useMemo(() => {
    const result: Record<string, Record<string, { count: number; hasReacted: boolean; reactionId: string | null }>> = {}
    for (const r of reactions) {
      if (!result[r.post_id]) result[r.post_id] = {}
      if (!result[r.post_id][r.emoji]) result[r.post_id][r.emoji] = { count: 0, hasReacted: false, reactionId: null }
      result[r.post_id][r.emoji].count++
      if (r.author === currentAdmin) {
        result[r.post_id][r.emoji].hasReacted = true
        result[r.post_id][r.emoji].reactionId = r.id
      }
    }
    return result
  }, [reactions, currentAdmin])

  async function toggleReaction(postId: string, emoji: string) {
    if (!supabase || !currentAdmin || !threadId) return
    const existing = reactions.find(r => r.post_id === postId && r.author === currentAdmin && r.emoji === emoji)
    if (existing) {
      await supabase.from('mb_reactions').delete().eq('id', existing.id)
      setReactions(rs => rs.filter(r => r.id !== existing.id))
    } else {
      const { data } = await supabase.from('mb_reactions')
        .insert([{ thread_id: threadId, post_id: postId, author: currentAdmin, emoji }])
        .select().single()
      if (data) setReactions(rs => [...rs, data as MbReaction])
    }
  }

  // ── Photo helpers ──────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - pendingImgs.length)
    setPendingImgs(prev => [...prev, ...files].slice(0, 4))
    files.forEach(f => setPreviews(prev => [...prev, URL.createObjectURL(f)]))
    e.target.value = ''
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setPendingImgs(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
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

  // ── Reply submit ───────────────────────────────────────────
  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !currentAdmin || !threadId) return
    if (!reply.trim() && pendingImgs.length === 0) return
    setPosting(true); setPostErr(null)
    try {
      let imageUrls: string[] = []
      if (pendingImgs.length > 0) { setUploading(true); imageUrls = await uploadImages(pendingImgs); setUploading(false) }
      const now = new Date().toISOString()
      const { data, error: err } = await supabase.from('mb_posts')
        .insert([{ thread_id: threadId, year, is_op: false, author: currentAdmin, body: reply.trim(), image_urls: imageUrls.length > 0 ? imageUrls : null }])
        .select().single()
      if (err || !data) throw err ?? new Error('Failed to post')
      setPosts(ps => [...ps, data as MbPost])
      const newCount = (thread?.reply_count ?? 0) + 1
      await supabase.from('mb_threads').update({ reply_count: newCount, last_reply_at: now }).eq('id', threadId)
      setThread(t => t ? { ...t, reply_count: newCount, last_reply_at: now } : t)
      previews.forEach(url => URL.revokeObjectURL(url))
      setReply(''); setPendingImgs([]); setPreviews([])
      markThreadRead(currentAdmin, threadId)
    } catch (e) {
      setPostErr(e instanceof Error ? e.message : 'Failed to post reply.')
    } finally { setPosting(false); setUploading(false) }
  }

  // ── Edit / delete post ─────────────────────────────────────
  async function handleDelete(postId: string, isOp: boolean) {
    if (!supabase) return
    await supabase.from('mb_posts').update({ is_deleted: true }).eq('id', postId)
    setPosts(ps => ps.filter(p => p.id !== postId))
    if (!isOp && thread) {
      const newCount = Math.max(0, thread.reply_count - 1)
      await supabase.from('mb_threads').update({ reply_count: newCount }).eq('id', thread.id)
      setThread(t => t ? { ...t, reply_count: newCount } : t)
    }
  }

  async function saveEdit(postId: string) {
    if (!supabase || !editBody.trim()) return
    setEditSaving(true)
    const now = new Date().toISOString()
    await supabase.from('mb_posts').update({ body: editBody.trim(), edited_at: now }).eq('id', postId)
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, body: editBody.trim(), edited_at: now } : p))
    setEditingId(null); setEditSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  if (error)   return <div className="text-center py-12 text-red-500 text-sm">{error}</div>
  if (!thread) return <div className="text-center py-12 text-gray-400 text-sm">Thread not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}

      {/* Thread header */}
      <div className="mb-4">
        <Link to="/board" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-masters-green mb-3 transition-colors">
          <ArrowLeft size={14} /> Back to Board
        </Link>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && <Pin size={13} className="text-masters-gold shrink-0" />}
              {thread.is_locked && <Lock size={13} className="text-gray-400 shrink-0" />}
              <h1 className="font-serif text-xl font-bold text-masters-dark leading-tight">{thread.title}</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="text-[11px] font-semibold bg-masters-light text-masters-dark px-2 py-0.5 rounded mr-2">{thread.category}</span>
              Started by {displayName(thread.author)} · {timeAgo(thread.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3 mb-6">
        {posts.map((post, idx) => {
          const isOwn     = post.author === currentAdmin
          const canEdit   = isOwn && !thread.is_locked
          const canDelete = (isOwn || isAdmin) && !post.is_op
          const postReactions = reactionsByPost[post.id] ?? {}

          return (
            <div key={post.id} className={`card ${post.is_op ? 'border-l-4 border-masters-green' : ''}`}>
              {/* Post header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-semibold text-sm text-masters-dark">{displayName(post.author)}</span>
                  {post.is_op && <span className="ml-1.5 text-[10px] text-masters-green font-bold uppercase tracking-wide">OP</span>}
                  <span className="text-xs text-gray-400 ml-2">
                    {timeAgo(post.created_at)}{post.edited_at && <span className="italic"> (edited)</span>}
                  </span>
                  <span className="text-xs text-gray-300 ml-2">#{idx + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button onClick={() => editingId === post.id ? setEditingId(null) : (setEditingId(post.id), setEditBody(post.body))}
                      className="p-1 text-gray-300 hover:text-masters-green rounded transition-colors" title="Edit">
                      <Pencil size={13} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(post.id, post.is_op)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Post body or edit form */}
              {editingId === post.id ? (
                <div className="space-y-2">
                  <textarea className="input w-full resize-y text-sm" rows={4} value={editBody} onChange={e => setEditBody(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button className="btn-primary text-sm py-1" disabled={editSaving || !editBody.trim()} onClick={() => saveEdit(post.id)}>
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn-ghost text-sm py-1" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <PostBody body={post.body} />
              )}

              {/* Images */}
              {post.image_urls && post.image_urls.length > 0 && (
                <div className={`mt-3 grid gap-2 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.image_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="rounded-lg object-cover w-full cursor-zoom-in"
                      style={{ maxHeight: post.image_urls!.length === 1 ? '480px' : '200px' }}
                      onClick={() => setLightbox({ urls: post.image_urls!, idx: i })}
                      alt=""
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {/* Reaction bar */}
              {canAccess && (
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-50 flex-wrap">
                  {MB_REACTION_EMOJIS.map(emoji => {
                    const data = postReactions[emoji]
                    const hasReacted = data?.hasReacted ?? false
                    const count      = data?.count ?? 0
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        title={hasReacted ? 'Remove reaction' : 'React'}
                        className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full border transition-colors ${
                          hasReacted
                            ? 'bg-masters-green/10 border-masters-green/30 text-masters-dark'
                            : 'border-transparent hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="text-xs font-semibold leading-none">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky jump-to-reply button (mobile only, shown when reply form is off-screen) */}
      {canAccess && currentAdmin && !thread.is_locked && showJumpReply && (
        <button
          className="fixed bottom-20 right-4 z-40 lg:hidden flex items-center gap-1.5 btn-primary shadow-lg text-sm"
          onClick={() => replyFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <Send size={13} /> Reply
        </button>
      )}

      {/* Reply form */}
      {canAccess && currentAdmin && !thread.is_locked && (
        <div ref={replyFormRef} className="card border border-masters-green/20">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={15} className="text-masters-green" />
            <h3 className="font-semibold text-sm text-masters-dark">Reply</h3>
          </div>
          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              className="input w-full resize-y"
              rows={4}
              placeholder="Write a reply…"
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            {/* Image previews */}
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="h-16 w-16 object-cover rounded border border-gray-200" alt="" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
            {postErr && <p className="text-red-500 text-sm">{postErr}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" className="btn-primary flex items-center gap-1.5"
                disabled={posting || (!reply.trim() && pendingImgs.length === 0)}>
                <Send size={14} />
                {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post Reply'}
              </button>
              {pendingImgs.length < 4 && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost flex items-center gap-1.5 text-sm">
                  <Camera size={14} />
                  Photo {pendingImgs.length > 0 ? `(${pendingImgs.length}/4)` : ''}
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handleFileSelect} />
          </form>
        </div>
      )}

      {thread.is_locked && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-400 text-sm">
          <Lock size={14} /> This thread is locked. No new replies.
        </div>
      )}
      {!canAccess && (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm">Sign in with your player account to reply.</p>
        </div>
      )}
    </div>
  )
}
