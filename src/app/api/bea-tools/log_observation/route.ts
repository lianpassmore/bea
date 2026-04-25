import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: log a measurement against a goal. Use when Bea has just
// observed something the family is tracking (e.g. someone catches themselves
// before raising their voice).
//
// Body: { goal_id, value, note?, session_id? }
// Voice clients sometimes pass numeric values as strings — coerce.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const goalId = body.goal_id
  if (typeof goalId !== 'string' || !goalId) {
    return NextResponse.json({ error: 'goal_id is required' }, { status: 400 })
  }

  let value: number
  if (typeof body.value === 'number') {
    value = body.value
  } else if (typeof body.value === 'string') {
    value = parseFloat(body.value)
  } else {
    return NextResponse.json({ error: 'value must be a number' }, { status: 400 })
  }
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: 'value must be finite' }, { status: 400 })
  }

  const { data: goal, error: goalErr } = await supabase
    .from('goals')
    .select('id, title')
    .eq('id', goalId)
    .single()
  if (goalErr || !goal) {
    return NextResponse.json({ error: 'goal not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('observations')
    .insert({
      goal_id: goalId,
      session_id: typeof body.session_id === 'string' ? body.session_id : null,
      value,
      note: typeof body.note === 'string' ? body.note : null,
      observed_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    say: `Logged ${value} for "${goal.title}".`,
    observation: data,
  })
}
