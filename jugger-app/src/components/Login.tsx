import { useState, type FormEvent } from 'react'
import { AuthError } from '@supabase/supabase-js'
import { Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EMAIL_KEY = 'jugger-login-email'

function savedEmail(): string {
  try { return localStorage.getItem(EMAIL_KEY) ?? '' } catch { return '' }
}
function rememberEmail(email: string) {
  try { localStorage.setItem(EMAIL_KEY, email) } catch { /* private browsing */ }
}

function loginMessage(error: unknown, step: 'email' | 'code'): string {
  if (!navigator.onLine) return 'No signal — try again when you have a connection.'
  if (error instanceof AuthError) {
    const text = `${error.code ?? ''} ${error.message}`
    if (/signup|otp_disabled|not allowed/i.test(text)) {
      return "That email isn't on the list. Check the spelling or ask the Admin to add you."
    }
    if (error.status === 429 || /rate limit/i.test(text)) {
      return 'Too many tries. Wait a minute, then try again.'
    }
    if (/sending.*email/i.test(text)) {
      return "Sign-in email couldn't be sent — tell the Admin the app's email settings need fixing."
    }
    if (step === 'code' && /expired|invalid|otp/i.test(text)) {
      return 'That code is wrong or has expired. Check it, or send a new one.'
    }
  }
  return 'Something went wrong. Try again in a minute.'
}

export default function Login() {
  const [email, setEmail] = useState(savedEmail)
  const [code,  setCode]  = useState('')
  const [step,  setStep]  = useState<'email' | 'code'>('email')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!supabase) return
    const address = email.trim().toLowerCase()
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (err) return setError(loginMessage(err, 'email'))
    rememberEmail(address)
    setEmail(address); setCode(''); setStep('code')
  }

  const checkCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setBusy(false)
    if (err) setError(loginMessage(err, 'code'))
    // On success AuthGate detects the new session and renders the app.
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a3a2f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <div style={{
        background: '#f5f5f0',
        borderRadius: 12,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: '#006747',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Shield size={26} color="#C9A84C" />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#1a3a2f',
            margin: 0,
          }}>
            Juggerknocker Invitational
          </h1>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode}>
            <p style={{ color: '#555', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
              Sign in with the email provided to the Admin. We'll send you a 6-digit code.
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#777', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #d0d7d0', borderRadius: 6, padding: '10px 12px',
                fontSize: 15, background: 'white', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 16,
                width: '100%', padding: '11px 0', borderRadius: 6, border: 'none',
                background: busy ? '#5a9a7a' : '#006747', color: 'white',
                fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={checkCode}>
            <p style={{ color: '#555', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
              We sent a code to <strong style={{ color: '#1a3a2f' }}>{email}</strong>. Enter it below, or tap the link in the email.
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#777', marginBottom: 6 }}>
              Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #d0d7d0', borderRadius: 6, padding: '10px 12px',
                fontSize: 24, letterSpacing: '0.3em', textAlign: 'center',
                background: 'white', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              style={{
                marginTop: 16,
                width: '100%', padding: '11px 0', borderRadius: 6, border: 'none',
                background: (busy || code.length < 6) ? '#5a9a7a' : '#006747', color: 'white',
                fontWeight: 700, fontSize: 15, cursor: (busy || code.length < 6) ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => sendCode()}
                style={{ background: 'none', border: 'none', color: '#006747', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Send a new code
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep('email'); setError('') }}
                style={{ background: 'none', border: 'none', color: '#006747', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Different email
              </button>
            </div>
            <p style={{ color: '#888', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              No email? Check spam, or wait a minute and send a new code.
            </p>
          </form>
        )}

        {error && (
          <p role="alert" style={{ marginTop: 12, color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
