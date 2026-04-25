import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// List observations.
//   ?goal_id=<uuid>     → observations for that goal (most recent first)
//   ?session_id=<uuid>  → observations for that session
//   ?limit=N            → cap (default 100)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const goalId = params.get('goal_id')
  const sessionId = params.get('session_id')
  const limitRaw = params.get('limit')
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500) : 100

  let query = supabase
    .from('observations')
    .select('*')
    .order('observed_at', { ascending: false })
    .limit(limit)

  if (goalId) query = query.eq('goal_id', goalId)
  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Create an observation against a goal.
// Body: { goal_id, value, session_id?, note?, observed_at? }
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
  if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
    return NextResponse.json({ error: 'value must be a finite number' }, { status: 400 })
  }

  const insert = {
    goal_id: goalId,
    session_id: typeof body.session_id === 'string' ? body.session_id : null,
    value: body.value,
    note: typeof body.note === 'string' ? body.note : null,
    observed_at:
      typeof body.observed_at === 'string' ? body.observed_at : new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('observations')
    .insert(insert)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
