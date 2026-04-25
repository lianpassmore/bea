'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PageBackground from '@/components/page-background'

type Stage = 'default' | 'emailEntry' | 'sent'

export default function LoginPage() {
  const supabase = createClient()
  const [stage, setStage] = useState<Stage>('default')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setStage('sent')
  }

  return (
    <div className="flex flex-col flex-1 justify-center pb-12 md:pb-20 max-w-sm mx-auto w-full animate-fade-in">
      <PageBackground variant="arrival" />

      <header className="space-y-4 md:space-y-6 mb-10 md:mb-16">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
          Welcome.
        </h1>
        <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed">
          Sign in to join your family.
        </p>
      </header>

      {stage === 'sent' ? (
        <div className="animate-fade-in space-y-4">
          <p className="font-body text-base md:text-lg text-bea-charcoal leading-relaxed">
            I have sent a note to your email.
          </p>
          <p className="font-body text-base md:text-lg text-bea-blue leading-relaxed">
            You can use the link inside it to enter when you are ready. You can close this window now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:gap-8 w-full animate-fade-in">

          {/* Refined Google Button: No colored background, just elegant typography and hover states */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="group flex items-center gap-4 py-3 md:py-4 border-b border-bea-charcoal/10 hover:border-bea-amber/40 transition-colors duration-500 disabled:opacity-30"
          >
            <GoogleG className="text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500" />
            <span className="font-body text-base md:text-lg text-bea-charcoal group-hover:text-bea-amber transition-colors duration-500">
              Continue with Google
            </span>
          </button>

          {stage === 'default' ? (
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setStage('emailEntry')}
                className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
              >
                Or use an email link
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-8 md:gap-12 pt-4 animate-fade-in">
              <div>
                <input
                  type="email"
                  autoFocus
                  required
                  placeholder="Your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-bea-charcoal/20 pb-3 md:pb-4 font-serif text-xl md:text-2xl text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none focus:border-bea-amber transition-colors rounded-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 disabled:opacity-30"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                {loading ? 'Sending...' : 'Send link'}
              </button>
            </form>
          )}

          {error && (
            <p className="font-body text-bea-clay pt-4 animate-fade-in">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

function GoogleG({ className = "currentColor" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.92h5.35c-.23 1.48-1.66 4.34-5.35 4.34-3.22 0-5.85-2.67-5.85-5.96s2.63-5.96 5.85-5.96c1.83 0 3.06.78 3.76 1.45l2.56-2.48C16.68 3.9 14.56 3 12 3 6.98 3 3 7 3 12s3.98 9 9 9c5.2 0 8.63-3.66 8.63-8.82 0-.59-.07-1.04-.15-1.5z"
      />
    </svg>
  )
}