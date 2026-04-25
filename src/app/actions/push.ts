'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentMember } from '@/lib/auth'

type SerializedSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function subscribeUser(sub: SerializedSubscription) {
  const member = await getCurrentMember()
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        member_id: member?.id ?? null,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      { onConflict: 'endpoint' }
    )
  if (error) {
    console.error('Failed to save push subscription:', error)
    return { success: false }
  }
  return { success: true }
}

export async function unsubscribeUser(endpoint: string) {
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
  if (error) {
    console.error('Failed to remove push subscription:', error)
    return { success: false }
  }
  return { success: true }
}
