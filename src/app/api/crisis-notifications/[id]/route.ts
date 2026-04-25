import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getCurrentMember } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const member = await getCurrentMember()
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: notif } = await supabase
    .from('crisis_notifications')
    .select('id, briefing, crisis_level, created_at, contact_member_id, affected_member_id')
    .eq('id', id)
    .single()

  if (!notif || notif.contact_member_id !== member.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: affected } = await supabase
    .from('members')
    .select('name')
    .eq('id', notif.affected_member_id)
    .single()

  return NextResponse.json({
    id: notif.id,
    briefing: notif.briefing,
    crisis_level: notif.crisis_level,
    created_at: notif.created_at,
    affected_member_name: affected?.name ?? 'A family member',
  })
}
