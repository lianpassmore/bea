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

  const setBy =
    typeof body.set_by_member_id === 'string' && body.set_by_member_id.length > 0
      ? body.set_by_member_id
      : null

  const { data: existing, error: selectError } = await supabase
    .from('households')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 })
  }

  let householdId = existing?.id as string | undefined

  if (!householdId) {
    const { data: created, error: insertError } = await supabase
      .from('households')
      .insert({ name: 'Whānau' })
      .select('id')
      .single()
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    householdId = created.id as string
  }

  const { data: updated, error: updateError } = await supabase
    .from('households')
    .update({
      vision: text,
      vision_set_at: new Date().toISOString(),
      vision_set_by: setBy,
    })
    .eq('id', householdId)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    say: `I've held that for the whānau: "${text}". You can revisit it whenever it stops feeling true.`,
    vision: updated,
  })
}
