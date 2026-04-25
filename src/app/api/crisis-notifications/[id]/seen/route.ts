import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getCurrentMember } from '@/lib/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const member = await getCurrentMember()
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ownership check — only the designated contact can mark it seen
  const { data: notif } = await supabase
    .from('crisis_notifications')
    .select('contact_member_id')
    .eq('id', id)
    .single()

  if (!notif || notif.contact_member_id !== member.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('crisis_notifications')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[crisis-notifications/seen] update failed:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
