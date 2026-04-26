import { createClient } from './supabase-server'

export type MemberRow = {
  id: string
  name: string
  role: 'primary' | 'family'
  email: string | null
  auth_user_id: string | null
  voice_enrolled: boolean
  status: 'active' | 'withdrawn'
  avatar_url: string | null
  consent_given: boolean
  consent_given_at: string | null
  consent_withdrawn_at: string | null
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentMember(): Promise<MemberRow | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('members')
    .select('id, name, role, email, auth_user_id, voice_enrolled, status, avatar_url, consent_given, consent_given_at, consent_withdrawn_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error) return null
  return data as MemberRow | null
}
