import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, Pin, Pencil, Trash2, MessageSquare, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore, useIsAdmin, useCanAccessBoard } from '../store/useAuthStore'
import { useTournamentStore } from '../store/useTournamentStore'
import type { MbThread, MbPost } from '../types'

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
  // Auto-link URLs
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

export default function MessageBoardThread() {
  const { threadId } = useParams<{ threadId: string }>()
  const { currentAdmin } = useAuthStore()
  const isAdmin    = useIsAdmin()
  const canAccess  = useCanAccessBoard()
  const { admins, year } = useTournamentStore()

  const displayName = useCallback((username: string) => {
    const cred = admins.find(a => a.username === username)
    return cred?.displayName ?? username
  }, [admins])

  const [thread,  setThread]  = useState<MbThread | null>(null)
  const [posts,   setPosts]   = useState<MbPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [reply,    setReply]    = useState('')
  const [posting,  setPosting]  = useState(false)
  const [postErr,  setPostErr]  = useState<string | null>(null)

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editBody,   setEditBody]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (!supabase || !threadId) return
    ;(async () => {
      const [threadRes, postsRes] = await Promise.all([
        supabase.from('mb_threads').select('*').eq('id', threadId).single(),
        supabase.from('mb_posts').select('*').eq('thread_id', threadId).eq('is_deleted', false).order('created_at'),
      ])
      if (threadRes.error) setError(threadRes.error.message)
      else setThread(threadRes.data as MbThread)
      if (postsRes.data) setPosts(postsRes.data as MbPost[])
      setLoading(false)
    })()
  }, [threadId])

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !currentAdmin || !reply.trim() || !threadId) return
    setPosting(true)
    setPostErr(null)
    const now = new Date().toISOString()
    const { data, error: err } = await supabase
      .from('mb_posts')
      .insert([{ thread_id: threadId, year, is_op: false, author: currentAdmin, body: reply.trim() }])
      .select()
      .single()
    if (err || !data) {
      setPostErr(err?.message ?? 'Failed to post reply.')
      setPosting(false)
      return
    }
    setPosts(ps => [...ps, data as MbPost])
    const newCount = (thread?.reply_count ?? 0) + 1
    await supabase.from('mb_threads').update({ reply_count: newCount, last_reply_at: now }).eq('id', threadId)
    setThread(t => t ? { ...t, reply_count: newCount, last_reply_at: now } : t)
    setReply('')
    setPosting(false)
  }

  async function handleDelete(postId: string) {
    if (!supabase) return
    await supabase.from('mb_posts').update({ is_deleted: true }).eq('id', postId)
    setPosts(ps => ps.filter(p => p.id !== postId))
    // Decrement reply count for non-OP posts
    const post = posts.find(p => p.id === postId)
    if (post && !post.is_op && thread) {
      const newCount = Math.max(0, thread.reply_count - 1)
      await supabase.from('mb_threads').update({ reply_count: newCount }).eq('id', thread.id)
      setThread(t => t ? { ...t, reply_count: newCount } : t)
    }
  }

  function startEdit(post: MbPost) {
    setEditingId(post.id)
    setEditBody(post.body)
  }

  async function saveEdit(postId: string) {
    if (!supabase || !editBody.trim()) return
    setEditSaving(true)
    const now = new Date().toISOString()
    await supabase.from('mb_posts').update({ body: editBody.trim(), edited_at: now }).eq('id', postId)
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, body: editBody.trim(), edited_at: now } : p))
    setEditingId(null)
    setEditSaving(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
  if (error) return <div className="text-center py-12 text-red-500 text-sm">{error}</div>
  if (!thread) return <div className="text-center py-12 text-gray-400 text-sm">Thread not found.</div>

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
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
          const isOwn = post.author === currentAdmin
          const canEdit = isOwn && !thread.is_locked
          const canDelete = (isOwn || isAdmin) && !post.is_op

          return (
            <div key={post.id} className={`card ${post.is_op ? 'border-l-4 border-masters-green' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-semibold text-sm text-masters-dark">{displayName(post.author)}</span>
                  {post.is_op && <span className="ml-1.5 text-[10px] text-masters-green font-bold uppercase tracking-wide">OP</span>}
                  <span className="text-xs text-gray-400 ml-2">
                    {timeAgo(post.created_at)}
                    {post.edited_at && <span className="italic"> (edited)</span>}
                  </span>
                  <span className="text-xs text-gray-300 ml-2">#{idx + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => editingId === post.id ? setEditingId(null) : startEdit(post)}
                      className="p-1 text-gray-300 hover:text-masters-green rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              {editingId === post.id ? (
                <div className="space-y-2">
                  <textarea
                    className="input w-full resize-y text-sm"
                    rows={4}
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-sm py-1"
                      disabled={editSaving || !editBody.trim()}
                      onClick={() => saveEdit(post.id)}
                    >
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn-ghost text-sm py-1" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <PostBody body={post.body} />
              )}
            </div>
          )
        })}
      </div>

      {/* Reply form */}
      {canAccess && currentAdmin && !thread.is_locked && (
        <div className="card border border-masters-green/20">
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
            {postErr && <p className="text-red-500 text-sm">{postErr}</p>}
            <button
              type="submit"
              className="btn-primary flex items-center gap-1.5"
              disabled={posting || !reply.trim()}
            >
              <Send size={14} />
              {posting ? 'Posting…' : 'Post Reply'}
            </button>
          </form>
        </div>
      )}
      {thread.is_locked && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-400 text-sm">
          <Lock size={14} />
          This thread is locked. No new replies.
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
