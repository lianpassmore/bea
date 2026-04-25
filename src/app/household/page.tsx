import { redirect } from 'next/navigation'
import { getCurrentMember } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import HouseholdClient from './household-client'

export default async function HouseholdPage() {
  const member = await getCurrentMember()
  if (!member || member.role !== 'primary') {
    redirect('/')
  }
  const { data } = await supabase
    .from('households')
    .select('vision')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const householdVision = (data?.vision as string | null) ?? ''
  return <HouseholdClient householdVision={householdVision} />
}
