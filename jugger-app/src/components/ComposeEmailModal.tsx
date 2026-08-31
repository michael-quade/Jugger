import { useState, useRef } from 'react'
import { X, Paperclip, Trash2, Mail, Send, Users } from 'lucide-react'
import type { Team } from '../types'
import { sendEmail, buildComposeEmail, type EmailAttachment } from '../lib/email'
import { useTournamentStore } from '../store/useTournamentStore'

interface Props {
  teams: Team[]
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // strip data:...;base64, prefix
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function ComposeEmailModal({ teams, onClose }: Props) {
  const { year } = useTournamentStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build recipient list from all players with emails
  const allPlayers = teams.flatMap(t =>
    t.players.map(p => ({ ...p, teamName: t.name, teamColor: t.color }))
  )
  const playersWithEmail = allPlayers.filter(p => p.playerEmail)
  const playersWithoutEmail = allPlayers.filter(p => !p.playerEmail)

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(playersWithEmail.map(p => p.playerEmail!))
  )
  const [extraEmails, setExtraEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<(EmailAttachment & { size: number })[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [pasteFlash, setPasteFlash] = useState(false)

  const toggleRecipient = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(email) ? next.delete(email) : next.add(email)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(playersWithEmail.map(p => p.playerEmail!)))
  const selectNone = () => setSelected(new Set())

  const extraList = extraEmails
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(e => e.includes('@'))

  const allRecipients = [...selected, ...extraList]

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setLoadingFiles(true)
    try {
      const newAttachments = await Promise.all(
        files.map(async file => ({
          filename: file.name,
          content: await readFileAsBase64(file),
          size: file.size,
        }))
      )
      setAttachments(prev => [...prev, ...newAttachments])
    } catch {
      alert('Failed to read one or more files.')
    }
    setLoadingFiles(false)
    // reset so same file can be re-added if removed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    if (!imageItems.length) return
    e.preventDefault()
    const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[]
    setLoadingFiles(true)
    try {
      const newAttachments = await Promise.all(
        files.map(async (file, i) => {
          const ext = file.type.split('/')[1] ?? 'png'
          const filename = `pasted-image-${Date.now()}${files.length > 1 ? `-${i + 1}` : ''}.${ext}`
          return { filename, content: await readFileAsBase64(file), size: file.size }
        })
      )
      setAttachments(prev => [...prev, ...newAttachments])
      setPasteFlash(true)
      setTimeout(() => setPasteFlash(false), 2000)
    } catch {
      alert('Failed to read pasted image.')
    }
    setLoadingFiles(false)
  }

  const totalAttachmentBytes = attachments.reduce((s, a) => s + a.size, 0)
  const attachmentWarning = totalAttachmentBytes > 10 * 1024 * 1024

  async function handleSend() {
    if (!subject.trim()) { setStatus({ msg: 'Subject is required.', ok: false }); return }
    if (!body.trim()) { setStatus({ msg: 'Body is required.', ok: false }); return }
    if (!allRecipients.length) { setStatus({ msg: 'No recipients selected.', ok: false }); return }

    setSending(true)
    setStatus(null)
    const html = buildComposeEmail(year, subject.trim(), body.trim())
    const result = await sendEmail(
      subject.trim(),
      html,
      allRecipients,
      attachments.map(({ filename, content }) => ({ filename, content })),
    )
    setSending(false)
    if (result.success) {
      setStatus({ msg: `Sent to ${allRecipients.length} recipient${allRecipients.length !== 1 ? 's' : ''}.`, ok: true })
    } else {
      setStatus({ msg: result.error ?? 'Send failed.', ok: false })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onPaste={handlePaste}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-masters-green" />
            <h2 className="font-serif font-bold text-masters-dark">Send Group Email</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label flex items-center gap-1.5">
                <Users size={12} /> Recipients
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={selectAll} className="text-masters-green hover:underline">All</button>
                <span className="text-gray-300">·</span>
                <button onClick={selectNone} className="text-gray-400 hover:underline">None</button>
                <span className="text-gray-400 ml-1">({selected.size} selected)</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {playersWithEmail.map(p => (
                <label key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(p.playerEmail!)}
                    onChange={() => toggleRecipient(p.playerEmail!)}
                    className="rounded"
                  />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.teamColor }} />
                  <span className="text-sm font-medium text-masters-dark">{p.name}</span>
                  <span className="text-xs text-gray-400 truncate ml-auto">{p.playerEmail}</span>
                </label>
              ))}
              {playersWithoutEmail.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 opacity-40">
                  <div className="w-4 h-4 border border-gray-200 rounded shrink-0" />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.teamColor }} />
                  <span className="text-sm text-gray-400">{p.name}</span>
                  <span className="text-xs text-gray-300 ml-auto">no email</span>
                </div>
              ))}
            </div>

            <div className="mt-2">
              <label className="label">Additional recipients</label>
              <input
                type="text"
                className="input w-full text-xs"
                placeholder="extra@email.com, another@email.com"
                value={extraEmails}
                onChange={e => setExtraEmails(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Comma or space separated</p>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              className="input w-full"
              placeholder="2026 Juggerknocker — Thursday Recap"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <label className="label">Message</label>
            <textarea
              className="input w-full h-36 resize-none font-sans text-sm"
              placeholder={"Gentlemen,\n\nGreat round today..."}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Blank line = new paragraph</p>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label flex items-center gap-1.5">
                <Paperclip size={12} /> Attachments
              </label>
              {attachments.length > 0 && (
                <span className={`text-[11px] ${attachmentWarning ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                  {formatBytes(totalAttachmentBytes)} total{attachmentWarning ? ' — may be slow' : ''}
                </span>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <Paperclip size={11} className="text-gray-400 shrink-0" />
                    <span className="text-xs font-medium text-masters-dark truncate flex-1">{a.filename}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(a.size)}</span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingFiles}
              className={`flex items-center gap-1.5 text-xs border border-dashed rounded-lg px-3 py-2 w-full justify-center transition-colors disabled:opacity-50 ${pasteFlash ? 'border-masters-green text-masters-green bg-green-50' : 'text-gray-500 hover:text-masters-dark border-gray-300 hover:border-gray-400'}`}
            >
              <Paperclip size={12} />
              {loadingFiles ? 'Reading files…' : pasteFlash ? 'Image added!' : 'Attach files · or paste image (Ctrl+V)'}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 space-y-2">
          {status && (
            <div className={`text-xs px-3 py-2 rounded flex items-center gap-2 ${status.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <Mail size={12} /> {status.msg}
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || !allRecipients.length}
              className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? 'Sending…' : `Send to ${allRecipients.length}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
