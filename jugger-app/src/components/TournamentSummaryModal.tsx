import { useState } from 'react'
import { X, Send, Mail } from 'lucide-react'
import { sendEmail, getAllRecipients } from '../lib/email'
import type { Team } from '../types'

interface Props {
  subject: string
  html: string
  teams: Team[]
  onClose: () => void
}

export default function TournamentSummaryModal({ subject, html, teams, onClose }: Props) {
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const recipients = getAllRecipients(teams)

  async function handleSend() {
    setSending(true)
    setStatus(null)
    const result = await sendEmail(subject, html, recipients)
    setSending(false)
    setStatus(result.success
      ? { msg: `Sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`, ok: true }
      : { msg: result.error ?? 'Send failed', ok: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-masters-green" />
            <span className="font-serif font-bold text-masters-dark">Tournament Summary Email</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {/* Subject line */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide w-16">Subject</span>
            <span className="text-gray-700 font-medium truncate">{subject}</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide w-16">To</span>
            <span className="text-gray-500 text-xs">
              {recipients.length > 0
                ? `${recipients.join(', ')}`
                : <span className="text-amber-600">No player emails configured</span>}
            </span>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-hidden border-b border-gray-100">
          <iframe
            srcDoc={html}
            title="Email preview"
            className="w-full h-full"
            style={{ minHeight: 0 }}
            sandbox="allow-same-origin"
          />
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          {status ? (
            <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {status.msg}
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              {recipients.length === 0 ? 'Add player emails in the Teams page to enable sending.' : `${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">Close</button>
            <button
              onClick={handleSend}
              disabled={sending || recipients.length === 0 || !!status?.ok}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {sending ? '…' : <><Send size={12} /> Send to All</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
