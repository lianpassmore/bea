import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: a human has confirmed a draft goal — flip it to 'active'
// so the pattern agent starts logging observations against it.
//
// Body: { goal_id }
export async function POST(request: NextRequest) {
  let body: { goal_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const goalId = body.goal_id
  if (typeof goalId !== 'string' || !goalId) {
    return NextResponse.json({ error: 'goal_id is required' }, { status: 400 })
  }

  const { data: existing, error: lookupErr } = await supabase
    .from('goals')
    .select('id, title, status')
    .eq('id', goalId)
    .single()
  if (lookupErr || !existing) {
    return NextResponse.json({ error: 'goal not found' }, { status: 404 })
  }

  if (existing.status === 'active') {
    return NextResponse.json({
      say: `"${existing.title}" is already active.`,
      goal: existing,
      already_active: true,
    })
  }
  if (existing.status !== 'draft' && existing.status !== 'paused') {
    return NextResponse.json(
      { error: `cannot confirm a goal in status '${existing.status}'` },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('goals')
    .update({ status: 'active' })
    .eq('id', goalId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    say: `"${data.title}" is now active. I'll start tracking it.`,
    goal: data,
  })
}
