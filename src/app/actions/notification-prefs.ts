'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export type NotificationPrefs = {
  advance: boolean
  start: boolean
  end: boolean
}

export async function updatePrefs(endpoint: string, prefs: NotificationPrefs) {
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .update({ prefs })
    .eq('endpoint', endpoint)
  if (error) {
    console.error('updatePrefs failed:', error)
    return { success: false }
  }
  return { success: true }
}

export async function getPrefs(endpoint: string): Promise<NotificationPrefs> {
  const { data } = await supabaseAdmin
    .from('push_subscriptions')
    .select('prefs')
    .eq('endpoint', endpoint)
    .maybeSingle()
  const prefs = (data?.prefs ?? {}) as Partial<NotificationPrefs>
  return {
    advance: prefs.advance ?? true,
    start: prefs.start ?? true,
    end: prefs.end ?? true,
  }
}
