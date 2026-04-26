'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function currentMemberId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function acceptConsent() {
  const memberId = await currentMemberId()
  if (!memberId) return { success: false as const, error: 'not_signed_in' }

  const { error } = await supabaseAdmin
    .from('members')
    .update({
      consent_given: true,
      consent_given_at: new Date().toISOString(),
      consent_withdrawn_at: null,
      status: 'active',
    })
    .eq('id', memberId)

  if (error) {
    console.error('acceptConsent failed:', error)
    return { success: false as const, error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function withdrawConsent() {
  const memberId = await currentMemberId()
  if (!memberId) return { success: false as const, error: 'not_signed_in' }

  const { error } = await supabaseAdmin
    .from('members')
    .update({
      consent_given: false,
      consent_withdrawn_at: new Date().toISOString(),
      status: 'withdrawn',
    })
    .eq('id', memberId)

  if (error) {
    console.error('withdrawConsent failed:', error)
    return { success: false as const, error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true as const }
}
