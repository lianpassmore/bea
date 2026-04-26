import { getCurrentMember } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CheckInClient from './check-in-client'

export default async function CheckInPage() {
  const member = await getCurrentMember()

  let individualVision: string | null = null
  if (member) {
    const { data } = await supabaseAdmin
      .from('members')
      .select('vision')
      .eq('id', member.id)
      .maybeSingle()
    individualVision = (data?.vision as string | null) ?? null
  }

  const { data: householdRow } = await supabaseAdmin
    .from('households')
    .select('vision')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const householdVision = (householdRow?.vision as string | null) ?? null

  return (
    <CheckInClient
      authedMember={
        member
          ? { id: member.id, name: member.name, role: member.role }
          : null
      }
      individualVision={individualVision}
      householdVision={householdVision}
    />
  )
}
