import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: Bea proposes a goal during a conversation. Creates a goal
// in 'draft' status — it does NOT start tracking until a human confirms it
// via /api/bea-tools/confirm_goal (or the UI flips it to 'active').
//
// Body: { owner_type, owner_id?, title, description?, metric_key?,
//         direction?, target?, rationale?, session_id? }
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ownerType = body.owner_type
  if (ownerType !== 'member' && ownerType !== 'whanau') {
    return NextResponse.json(
      { error: "owner_type must be 'member' or 'whanau'" },
      { status: 400 },
    )
  }
  const ownerId = body.owner_id ?? null
  if (ownerType === 'member' && typeof ownerId !== 'string') {
    return NextResponse.json(
      { error: 'owner_id is required for member goals' },
      { status: 400 },
    )
  }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const direction =
    body.direction === 'decrease' ||
    body.direction === 'increase' ||
    body.direction === 'maintain'
      ? body.direction
      : null

  const proposedBy = {
    source: 'bea_proposal',
    session_id: typeof body.session_id === 'string' ? body.session_id : null,
    rationale: typeof body.rationale === 'string' ? body.rationale : null,
    proposed_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      owner_type: ownerType,
      owner_id: ownerType === 'whanau' ? null : ownerId,
      title,
      description: typeof body.description === 'string' ? body.description : null,
      metric_key: typeof body.metric_key === 'string' ? body.metric_key : null,
      direction,
      target: typeof body.target === 'number' ? body.target : null,
      status: 'draft',
      proposed_by: proposedBy,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    say: `I've drafted a goal: "${title}". It won't start tracking until you confirm it.`,
    goal: data,
  })
}
