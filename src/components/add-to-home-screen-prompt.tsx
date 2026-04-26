'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'bea_a2hs_dismissed_at'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000

function isStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari uses a non-standard property
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_MS
  } catch {
    return false
  }
}

export default function AddToHomeScreenPrompt() {
  const [mode, setMode] = useState<'ios' | 'install' | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)

    if (isIOSSafari) {
      const t = setTimeout(() => setMode('ios'), 1500)
      return () => clearTimeout(t)
    }

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('install')
    }
    const onInstalled = () => {
      setMode(null)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setMode(null)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setMode(null)
  }

  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  if (!mode) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a2hs-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-bea-charcoal/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-bea-milk border border-bea-charcoal/15 rounded-2xl shadow-xl p-5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-bea-olive hover:text-bea-charcoal hover:bg-bea-charcoal/5 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
        <div className="space-y-3 pr-8">
          <p
            id="a2hs-title"
            className="font-ui text-[10px] uppercase tracking-[0.2em] text-bea-blue"
          >
            Keep Bea close
          </p>
          {mode === 'ios' ? (
            <p className="font-body text-base leading-relaxed text-bea-charcoal">
              Tap
              <ShareIcon />
              in the toolbar, then choose{' '}
              <span className="italic">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="font-body text-base leading-relaxed text-bea-charcoal">
              Add Bea to your home screen so she&rsquo;s one tap away.
            </p>
          )}
          <div className="flex items-center gap-6 pt-1">
            {mode === 'install' && (
              <button
                onClick={install}
                className="group inline-flex items-center gap-3 font-body text-base text-bea-charcoal transition-opacity hover:opacity-70"
              >
                <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-12" />
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="font-ui text-xs text-bea-olive hover:text-bea-charcoal transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg
      aria-label="Share"
      role="img"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-text-bottom mx-1.5 h-4 w-4 text-bea-blue"
    >
      <path d="M12 3v13" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
