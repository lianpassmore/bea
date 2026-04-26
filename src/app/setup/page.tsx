'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordWav } from '@/lib/recorder'
import PageBackground from '@/components/page-background'

const PROMPTS = [
  'Tell me your name, and what a typical day looks like for you.',
  'What has been on your mind lately?',
  'Describe a place you love going, or something you enjoy doing.',
  'What is one thing that has made you smile recently?',
]

type Step = 'consent' | 'name' | 'creating' | 'record' | 'recording' | 'enrolling' | 'done' | 'error'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('consent')
  const [name, setName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [progress, setProgress] = useState(0)
  const [promptIndex, setPromptIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const idx = Math.min(Math.floor((progress / 100) * PROMPTS.length), PROMPTS.length - 1)
    setPromptIndex(idx)
  }, [progress])

  async function handleConsent() {
    setStep('name')
    setTimeout(() => nameInputRef.current?.focus(), 800) // Slower focus to match the fade-in
  }

  async function handleName() {
    if (!name.trim()) return
    setStep('creating')
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed to create member')
      const member = await res.json()
      setMemberId(member.id)
      setStep('record')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  async function handleRecord() {
    setStep('recording')
    setProgress(0)
    try {
      const wav = await recordWav(30_000, (pct) => setProgress(pct))
      setStep('enrolling')
      const form = new FormData()
      form.append('audio', wav, 'enrollment.wav')
      form.append('memberId', memberId)
      const res = await fetch('/api/voice/enroll', { method: 'POST', body: form })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.error ?? 'Enrollment failed')
      }
      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  const secondsLeft = Math.max(0, Math.round(30 - (progress / 100) * 30))

  return (
    // Generous top padding. Removed min-h screen height to let content float naturally.
    <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 px-2 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full">
      <PageBackground variant="arrival" />

      {/* Changing the key forces the fade-in animation on every step change */}
      <div key={step} className="animate-fade-in flex flex-col flex-1 w-full justify-between">
        
        {/* ── CONSENT ───────────────────────────────── */}
        {step === 'consent' && (
          <>
            <div className="space-y-10">
              <header>
                <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
                  Before we speak.
                </h1>
              </header>

              {/* Converted the boxed T&C list into quiet, readable paragraphs */}
              <div className="space-y-4 md:space-y-6 font-body text-base md:text-lg text-bea-charcoal leading-relaxed">
                <p>
                  I listen to you and the people you live with. To do this, I keep a few things.
                </p>
                <p className="text-bea-olive">
                  I keep a voice print so I can recognise you without you having to introduce yourself. I keep summaries of our kōrero, and notice patterns in how the house feels.
                </p>
                <p className="text-bea-blue">
                  You can ask me to remove you at any time. If you do, I will forget your voice, though past summaries will remain part of the house&apos;s memory.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-8 pt-12">
              <button
                onClick={handleConsent}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                I understand
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
              >
                I would rather remain a guest
              </button>
            </div>
          </>
        )}

        {/* ── NAME ──────────────────────────────────── */}
        {step === 'name' && (
          <>
            <div className="space-y-12">
              <header>
                <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
                  What shall I call you?
                </h1>
              </header>
              
              {/* Removed the white box. Made it a quiet line, like writing in a book. */}
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleName()}
                placeholder="Your name..."
                className="w-full bg-transparent border-b border-bea-charcoal/20 pb-3 md:pb-4 font-body text-2xl md:text-3xl text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none focus:border-bea-amber transition-colors rounded-none"
                autoComplete="off"
              />
            </div>
            
            <div className="pt-16">
              <button
                onClick={handleName}
                disabled={!name.trim()}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 disabled:opacity-30"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                Continue
              </button>
            </div>
          </>
        )}

        {/* ── CREATING ───────────────────────────── */}
        {step === 'creating' && (
          <div className="flex flex-col flex-1 justify-center items-start">
             {/* Replaced the spinner with a quiet, pulsing text state */}
            <p className="font-body text-xl md:text-2xl text-bea-blue animate-pulse">
              Taking note...
            </p>
          </div>
        )}

        {/* ── RECORD ────────────────────────────────── */}
        {step === 'record' && (
          <>
            <div className="space-y-8">
              <header>
                <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
                  Let me hear your voice.
                </h1>
              </header>
              
              <div className="space-y-4 md:space-y-6 font-body text-base md:text-lg text-bea-charcoal leading-relaxed">
                <p>
                  I will show you a few questions. Just answer them naturally. It takes about thirty seconds.
                </p>
                <p className="text-bea-olive">
                  I just need to hear the tone of your voice, not any particular words.
                </p>
              </div>
            </div>
            
            <div className="pt-16">
              <button
                onClick={handleRecord}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                Begin
              </button>
            </div>
          </>
        )}

        {/* ── RECORDING ─────────────────────────────── */}
        {step === 'recording' && (
          <div className="flex flex-col flex-1 justify-between py-12">
            
            {/* The prompt sits quietly in the middle of the screen */}
            <div className="flex-1 flex flex-col justify-center">
              <p className="font-body text-xl md:text-3xl text-bea-charcoal leading-snug transition-opacity duration-1000">
                {PROMPTS[promptIndex]}
              </p>
            </div>

            {/* Subtle progress indicator at the bottom instead of heavy bars and mics */}
            <div className="space-y-4">
              <p className="font-ui text-sm text-bea-blue">
                {secondsLeft > 0 ? `Listening... ${secondsLeft}s` : 'Finishing up...'}
              </p>
              <div className="w-full bg-bea-charcoal/5 h-px">
                <div
                  className="bg-bea-amber h-px transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
          </div>
        )}

        {/* ── ENROLLING ─────────────────────────────── */}
        {step === 'enrolling' && (
          <div className="flex flex-col flex-1 justify-center items-start">
            <p className="font-body text-xl md:text-2xl text-bea-blue animate-pulse">
              Learning your voice...
            </p>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────── */}
        {step === 'done' && (
          <>
            <div className="space-y-8">
              <header>
                <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
                  Kia ora, {name}.
                </h1>
              </header>
              <div className="font-body text-base md:text-lg text-bea-olive leading-relaxed">
                <p>
                  I will recognise you next time we speak. You do not need to do anything—just start talking.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-start gap-8 pt-16">
              <button
                onClick={() => router.push('/check-in')}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                Kōrero with me now
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
              >
                Return home
              </button>
            </div>
          </>
        )}

        {/* ── ERROR ─────────────────────────────────── */}
        {step === 'error' && (
          <>
            <div className="space-y-6">
              <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight">
                Something stopped us.
              </h1>
              <p className="font-body text-base md:text-lg text-bea-olive">
                {errorMsg}
              </p>
            </div>
            
            <div className="flex flex-col items-start gap-8 pt-16">
              <button
                onClick={() => { setStep('record'); setErrorMsg('') }}
                className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
                Try again
              </button>
              <button
                onClick={() => router.push('/')}
                className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
              >
                Cancel
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}