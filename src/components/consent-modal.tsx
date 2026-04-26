'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptConsent } from '@/app/actions/consent'
import { createClient } from '@/lib/supabase-browser'

export default function ConsentModal({ memberName }: { memberName: string | null }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAgree = async () => {
    setError(null)
    setSubmitting(true)
    const res = await acceptConsent()
    if (!res.success) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }
    router.refresh()
  }

  const handleDecline = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-bea-charcoal/40 backdrop-blur-md" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-bea-milk rounded-[2rem] border border-bea-charcoal/10 shadow-2xl shadow-bea-charcoal/10 p-7 sm:p-10 animate-fade-in"
      >
        <header className="space-y-3 mb-8">
          <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber">
            Before we begin
          </p>
          <h2 id="consent-title" className="font-serif text-2xl sm:text-3xl text-bea-charcoal leading-snug">
            {memberName ? `Kia ora, ${memberName}.` : 'Kia ora.'}
            <br />
            Here is what you should know.
          </h2>
        </header>

        <div className="space-y-5 font-body text-bea-charcoal leading-relaxed">
          <p>
            Bea is a quiet presence in your home. With your permission, Bea will listen during the times your family chooses, so she can understand the rhythm of your home and offer reflections that help.
          </p>
          <p>
            When Bea is on, she records conversations and turns them into transcripts. These are stored privately for your family and used to notice patterns, suggest moments of connection, and check in with each of you.
          </p>
          <p>
            Bea is not a crisis service. She is also not a substitute for professional support. If you or someone you love is in distress, please reach for the people and services who can be there in person.
          </p>
          <p className="text-bea-blue">
            You can withdraw your consent at any time from your profile menu, or by telling us directly. When you withdraw, Bea will stop listening for you.
          </p>
        </div>

        {error && (
          <p className="font-body text-sm text-bea-clay text-center pt-4">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-8">
          <button
            type="button"
            onClick={handleAgree}
            disabled={submitting || signingOut}
            className="w-full bg-bea-charcoal text-bea-milk hover:bg-[#1a1a1a] rounded-full py-4 font-body text-lg transition-all duration-300 disabled:opacity-40"
          >
            {submitting ? 'One moment...' : 'I understand and agree'}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting || signingOut}
            className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-300 py-2 disabled:opacity-40"
          >
            {signingOut ? 'Signing out...' : 'Not now, sign me out'}
          </button>
        </div>
      </div>
    </div>
  )
}
