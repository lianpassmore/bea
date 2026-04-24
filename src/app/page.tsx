import { getCurrentMember } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import HomeClient, { type CrisisNotificationSummary } from './home-client'

type NotificationRow = {
  id: string
  briefing: string
  crisis_level: 'concerned' | 'urgent'
  created_at: string
  affected: { name: string } | { name: string }[] | null
}

export default async function Home() {
  const member = await getCurrentMember()

  let crisisNotifications: CrisisNotificationSummary[] = []
  if (member) {
    const { data } = await supabase
      .from('crisis_notifications')
      .select(`
        id, briefing, crisis_level, created_at,
        affected:members!affected_member_id(name)
      `)
      .eq('contact_member_id', member.id)
      .is('seen_at', null)
      .order('created_at', { ascending: false })

    crisisNotifications = ((data ?? []) as unknown as NotificationRow[]).map((n) => {
      const affectedName = Array.isArray(n.affected)
        ? n.affected[0]?.name
        : n.affected?.name
      return {
        id: n.id,
        briefing: n.briefing,
        crisis_level: n.crisis_level,
        created_at: n.created_at,
        affected_member_name: affectedName ?? 'A family member',
      }
    })
  }

  return (
    <HomeClient
      memberName={member?.name ?? null}
      memberRole={member?.role ?? null}
      crisisNotifications={crisisNotifications}
    />
  )
}
