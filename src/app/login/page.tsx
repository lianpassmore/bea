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
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10 animate-fade-in">
      <PageBackground variant="arrival" />

      {/* The Invitation Plaque */}
      <div className="w-full max-w-md bg-[#EBE5D9]/80 backdrop-blur-md border border-bea-charcoal/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-bea-charcoal/5 relative overflow-hidden">
        
        <header className="text-center mb-10 space-y-3">
          <h1 className="font-serif italic text-4xl text-bea-charcoal">
            Welcome.
          </h1>
          <p className="font-body text-bea-olive">
            Please sign in to join your family.
          </p>
        </header>

        {stage === 'sent' ? (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-12 h-[1px] bg-bea-amber mx-auto mb-8"></div>
            <p className="font-serif text-2xl text-bea-charcoal leading-snug">
              I have sent a note to your email.
            </p>
            <p className="font-body text-bea-olive leading-relaxed">
              You can use the link inside it to enter when you are ready. You can close this window now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-fade-in">
            
            {/* Soft, tactile Google Button */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="flex items-center justify-center gap-4 w-full bg-bea-milk/50 hover:bg-bea-milk border border-bea-charcoal/10 rounded-full py-4 transition-all duration-300 disabled:opacity-50"
            >
              <GoogleG className="text-bea-charcoal w-5 h-5" />
              <span className="font-body text-lg text-bea-charcoal">
                Continue with Google
              </span>
            </button>

            {stage === 'default' ? (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStage('emailEntry')}
                  className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-300"
                >
                  Or use an email link
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="flex flex-col gap-6 pt-4 animate-fade-in">
                <div className="w-full h-[1px] bg-bea-charcoal/10 mb-2"></div>
                
                <input
                  type="email"
                  autoFocus
                  required
                  placeholder="Your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-bea-charcoal/20 pb-3 font-serif text-xl text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none focus:border-bea-amber transition-colors text-center"
                />

                <div className="flex flex-col items-center gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="flex items-center justify-center w-full bg-bea-charcoal text-bea-milk hover:bg-[#1a1a1a] rounded-full py-4 font-body text-lg transition-all duration-300 disabled:opacity-30"
                  >
                    {loading ? 'Sending...' : 'Send link'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setStage('default')}
                    className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p className="font-body text-sm text-bea-clay text-center pt-2 animate-fade-in">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleG({ className = "currentColor" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.92h5.35c-.23 1.48-1.66 4.34-5.35 4.34-3.22 0-5.85-2.67-5.85-5.96s2.63-5.96 5.85-5.96c1.83 0 3.06.78 3.76 1.45l2.56-2.48C16.68 3.9 14.56 3 12 3 6.98 3 3 7 3 12s3.98 9 9 9c5.2 0 8.63-3.66 8.63-8.82 0-.59-.07-1.04-.15-1.5z"
      />
    </svg>
  )
}