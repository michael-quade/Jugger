import { useState, useEffect } from 'react'
import { X, Share, Download } from 'lucide-react'

const DISMISS_KEY = 'jugger-pwa-dismiss'
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

function isDismissed() {
  try {
    const val = localStorage.getItem(DISMISS_KEY)
    if (!val) return false
    return Date.now() - parseInt(val) < DISMISS_TTL
  } catch { return false }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

export default function PwaInstallBanner() {
  const [show, setShow]       = useState(false)
  const [prompt, setPrompt]   = useState<any>(null)  // Android BeforeInstallPromptEvent

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    if (!isIOS) {
      const handler = (e: Event) => {
        e.preventDefault()
        setPrompt(e)
        setShow(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    } else {
      setShow(true)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div className="bg-masters-dark text-white px-4 py-2.5 flex items-center gap-3 text-sm lg:hidden">
      <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        {isIOS ? (
          <span>
            Install app: tap <Share size={13} className="inline mb-0.5" /> then <strong>Add to Home Screen</strong>
          </span>
        ) : (
          <span>Install the Jugger app for quick access</span>
        )}
      </div>
      {!isIOS && prompt && (
        <button
          onClick={install}
          className="flex items-center gap-1.5 bg-masters-gold text-masters-dark font-bold text-xs px-3 py-1.5 rounded-full shrink-0 hover:bg-yellow-400 transition-colors"
        >
          <Download size={12} /> Install
        </button>
      )}
      <button onClick={dismiss} className="text-white/60 hover:text-white shrink-0 transition-colors">
        <X size={16} />
      </button>
    </div>
  )
}
