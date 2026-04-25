'use client'

import { useEffect, useState } from 'react'
import { subscribeUser } from '@/app/actions/push'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

type Env = { supported: boolean; isIOS: boolean; isStandalone: boolean }

export default function PushNotificationManager() {
  const [env, setEnv] = useState<Env | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    const next: Env = { supported, isIOS: ios, isStandalone: standalone }

    if (!supported) {
      Promise.resolve().then(() => setEnv(next))
      return
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setEnv(next)
        setSubscription(sub)
      })
      .catch((err) => {
        console.error('SW register failed:', err)
        setEnv(next)
      })
  }, [])

  const subscribe = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      setSubscription(sub)
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      await subscribeUser({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      })
    } catch (err) {
      console.error('Subscribe failed:', err)
    } finally {
      setBusy(false)
    }
  }

  if (env === null) return null
  const { supported, isIOS, isStandalone } = env

  if (!supported) {
    if (isIOS && !isStandalone) {
      return (
        <div className="border-t border-bea-charcoal/10 pt-6">
          <p className="font-body text-bea-olive leading-relaxed">
            To receive notifications on iPhone, tap the share icon in Safari and choose &ldquo;Add to Home Screen&rdquo;. Then open Bea from your home screen.
          </p>
        </div>
      )
    }
    return null
  }

  if (subscription) return null

  return (
    <div className="border-t border-bea-charcoal/10 pt-6">
      <div className="space-y-4">
        <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed">
          I can let you know when I am beginning or ending a household session.
        </p>
        <button
          onClick={subscribe}
          disabled={busy}
          className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
          {busy ? 'Asking...' : 'Allow notifications'}
        </button>
        {isIOS && !isStandalone && (
          <p className="font-ui text-xs text-bea-blue/70 leading-relaxed">
            On iPhone, you must add Bea to your home screen first (Share → Add to Home Screen).
          </p>
        )}
      </div>
    </div>
  )
}
