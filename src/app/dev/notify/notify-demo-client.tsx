'use client'

import { useEffect, useState } from 'react'

type Category = 'advance' | 'start' | 'end'

type Preset = {
  id: string
  label: string
  hint: string
  payload: {
    title: string
    body: string
    tag?: string
    url?: string
    category?: Category
  }
}

const PRESETS: Preset[] = [
  {
    id: 'listen-start',
    label: 'Bea is listening (start)',
    hint: 'What fires when listening mode turns on.',
    payload: {
      title: 'Bea is listening quietly',
      body: 'The room is being held.',
      tag: 'bea-listen',
      category: 'start',
    },
  },
  {
    id: 'listen-end',
    label: 'Bea has stopped listening (end)',
    hint: 'What fires when listening mode turns off.',
    payload: {
      title: 'Bea has stopped listening',
      body: 'The room is private again.',
      tag: 'bea-listen',
      category: 'end',
    },
  },
  {
    id: 'group-start',
    label: 'Whānau kōrero begins (start)',
    hint: 'Group voice session opening.',
    payload: {
      title: 'Bea has begun a whānau kōrero',
      body: 'She is in the room now.',
      tag: 'bea-household',
      category: 'start',
    },
  },
  {
    id: 'group-end',
    label: 'Whānau kōrero ends (end)',
    hint: 'Group voice session closing.',
    payload: {
      title: 'Whānau kōrero has ended',
      body: 'Bea is taking note of what she heard.',
      tag: 'bea-household',
      category: 'end',
    },
  },
  {
    id: 'advance',
    label: '5-minute advance warning',
    hint: 'Heads-up before a scheduled session.',
    payload: {
      title: 'Bea will start listening quietly in 5 minutes',
      body: 'Evening kai',
      tag: 'bea-soon-demo',
      category: 'advance',
    },
  },
]

type SubState =
  | { phase: 'loading' }
  | { phase: 'unsupported'; reason: string }
  | { phase: 'unsubscribed' }
  | { phase: 'subscribed'; endpoint: string }

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

export default function NotifyDemoClient() {
  const [sub, setSub] = useState<SubState>({ phase: 'loading' })
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    if (!supported) {
      setSub({ phase: 'unsupported', reason: 'This browser does not support web push.' })
      return
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (ios && !standalone) {
      setSub({ phase: 'unsupported', reason: 'On iPhone, add Bea to the Home Screen and open it from there.' })
      return
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => {
        if (s) setSub({ phase: 'subscribed', endpoint: s.endpoint })
        else setSub({ phase: 'unsubscribed' })
      })
      .catch((err) => {
        setSub({ phase: 'unsupported', reason: `Service worker failed: ${String(err)}` })
      })
  }, [])

  function appendLog(line: string) {
    const stamp = new Date().toLocaleTimeString('en-NZ', { hour12: false })
    setLog((prev) => [`${stamp}  ${line}`, ...prev].slice(0, 20))
  }

  async function fire(preset: Preset) {
    setBusy(preset.id)
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset.payload),
      })
      const data = (await res.json().catch(() => null)) as
        | { sent?: number; pruned?: number; skipped?: number; error?: string }
        | null
      if (!res.ok) {
        appendLog(`✗ ${preset.label} → ${data?.error ?? res.statusText}`)
      } else {
        appendLog(
          `✓ ${preset.label} → sent ${data?.sent ?? '?'}, skipped ${data?.skipped ?? 0}, pruned ${data?.pruned ?? 0}`,
        )
      }
    } catch (err) {
      appendLog(`✗ ${preset.label} → ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  async function localTest() {
    if (!('Notification' in window)) {
      appendLog('✗ local — Notification API unavailable')
      return
    }
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        appendLog(`✗ local — permission ${result}`)
        return
      }
    }
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('Bea (local test)', {
        body: 'This bypassed the push server. If you see it, the SW is wired.',
        tag: 'bea-local-test',
      })
      appendLog('✓ local — shown via service worker')
    } catch (err) {
      appendLog(`✗ local — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function subscribeHere() {
    setBusy('subscribe')
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) {
        appendLog('✗ subscribe — NEXT_PUBLIC_VAPID_PUBLIC_KEY missing')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
      const json = s.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const { subscribeUser } = await import('@/app/actions/push')
      await subscribeUser({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      })
      setSub({ phase: 'subscribed', endpoint: s.endpoint })
      appendLog('✓ subscribed this device')
    } catch (err) {
      appendLog(`✗ subscribe — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 pt-8 pb-8 max-w-2xl mx-auto w-full animate-fade-in">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-bea-charcoal leading-tight">Notification demo</h1>
        <p className="font-body text-base text-bea-olive mt-3 leading-relaxed">
          Fire any push notification on demand. Sends to every subscribed device.
        </p>
      </header>

      <section className="mb-8 border border-bea-charcoal/15 rounded-2xl p-5">
        <h2 className="font-ui text-xs uppercase tracking-wider text-bea-blue mb-3">This device</h2>
        {sub.phase === 'loading' && (
          <p className="font-body text-bea-olive">Checking…</p>
        )}
        {sub.phase === 'unsupported' && (
          <p className="font-body text-bea-clay text-sm">{sub.reason}</p>
        )}
        {sub.phase === 'unsubscribed' && (
          <div className="space-y-3">
            <p className="font-body text-bea-charcoal">Not subscribed yet on this device.</p>
            <button
              onClick={subscribeHere}
              disabled={busy === 'subscribe'}
              className="font-ui text-sm text-bea-charcoal underline underline-offset-4 decoration-bea-amber decoration-2 hover:opacity-70 disabled:opacity-40"
            >
              {busy === 'subscribe' ? 'Asking…' : 'Subscribe this device'}
            </button>
          </div>
        )}
        {sub.phase === 'subscribed' && (
          <p className="font-body text-bea-charcoal text-sm break-all">
            Subscribed.{' '}
            <span className="font-ui text-xs text-bea-blue/70">
              {sub.endpoint.slice(0, 60)}…
            </span>
          </p>
        )}
        <button
          onClick={localTest}
          className="mt-4 font-ui text-xs text-bea-blue hover:text-bea-charcoal"
        >
          Show a local test notification (skips the push server)
        </button>
      </section>

      <section className="mb-8">
        <h2 className="font-ui text-xs uppercase tracking-wider text-bea-blue mb-3">Broadcasts</h2>
        <div className="space-y-3">
          {PRESETS.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-4 border border-bea-charcoal/15 rounded-2xl p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-body text-base text-bea-charcoal">{p.label}</p>
                <p className="font-ui text-xs text-bea-blue/70 mt-1">{p.hint}</p>
                <p className="font-ui text-xs text-bea-charcoal/60 mt-2 truncate">
                  “{p.payload.title}” — {p.payload.body}
                </p>
              </div>
              <button
                onClick={() => fire(p)}
                disabled={busy === p.id}
                className="shrink-0 inline-flex items-center gap-3 font-body text-sm text-bea-charcoal hover:opacity-70 disabled:opacity-40"
              >
                <span className="h-px w-6 bg-bea-amber" />
                {busy === p.id ? 'Sending…' : 'Fire'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-ui text-xs uppercase tracking-wider text-bea-blue mb-3">Activity</h2>
        {log.length === 0 ? (
          <p className="font-body text-sm text-bea-olive italic">Nothing fired yet.</p>
        ) : (
          <ul className="space-y-1 font-ui text-xs text-bea-charcoal/80">
            {log.map((line, i) => (
              <li key={i} className="font-mono">{line}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
