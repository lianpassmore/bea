import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const memberId = typeof body.member_id === 'string' ? body.member_id : ''
  if (!memberId) {
    return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('members')
    .update({
      vision: text,
      vision_set_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .select('id, name, vision, vision_set_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    say: `I'll hold that for you: "${text}". You can revisit it whenever it stops feeling true.`,
    vision: updated,
  })
}
