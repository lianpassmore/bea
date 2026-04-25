import webpush from 'web-push'
import { supabaseAdmin } from './supabase-admin'

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@bea.local'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type NotificationCategory = 'advance' | 'start' | 'end'

export type NotificationPayload = {
  title: string
  body: string
  tag?: string
  url?: string
  category?: NotificationCategory
}

export async function sendToAll(payload: NotificationPayload): Promise<{ sent: number; pruned: number; skipped: number }> {
  ensureConfigured()
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, prefs')
  if (error) {
    console.error('Failed to load subscriptions:', error)
    return { sent: 0, pruned: 0, skipped: 0 }
  }
  if (!subs?.length) return { sent: 0, pruned: 0, skipped: 0 }

  const filtered = payload.category
    ? subs.filter((s) => {
        const prefs = (s.prefs ?? {}) as Record<string, boolean>
        return prefs[payload.category!] !== false
      })
    : subs
  const skipped = subs.length - filtered.length

  const json = JSON.stringify(payload)
  const dead: string[] = []
  let sent = 0

  await Promise.all(
    filtered.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        )
        sent++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          dead.push(s.id)
        } else {
          console.error('Push send failed:', err)
        }
      }
    })
  )

  if (dead.length) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', dead)
  }
  return { sent, pruned: dead.length, skipped }
}
