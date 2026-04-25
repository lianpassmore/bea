import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// List goals.
//   ?owner_type=member&owner_id=<uuid>  → that member's goals
//   ?owner_type=whanau                  → whānau goals
//   ?status=active|draft|paused|achieved|archived  (optional filter)
//   no params → all goals
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ownerType = params.get('owner_type')
  const ownerId = params.get('owner_id')
  const status = params.get('status')

  let query = supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false })

  if (ownerType === 'member') {
    if (!ownerId) {
      return NextResponse.json(
        { error: 'owner_id is required when owner_type=member' },
        { status: 400 },
      )
    }
    query = query.eq('owner_type', 'member').eq('owner_id', ownerId)
  } else if (ownerType === 'whanau') {
    query = query.eq('owner_type', 'whanau').is('owner_id', null)
  } else if (ownerType) {
    return NextResponse.json(
      { error: "owner_type must be 'member' or 'whanau'" },
      { status: 400 },
    )
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Create a goal.
// Body: { owner_type, owner_id?, title, description?, metric_key?, direction?,
//         baseline?, target?, status?, proposed_by? }
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
  if (ownerType === 'whanau' && ownerId !== null) {
    return NextResponse.json(
      { error: 'whanau goals must have owner_id null' },
      { status: 400 },
    )
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const direction = body.direction
  if (
    direction !== undefined &&
    direction !== null &&
    direction !== 'decrease' &&
    direction !== 'increase' &&
    direction !== 'maintain'
  ) {
    return NextResponse.json(
      { error: "direction must be 'decrease', 'increase', or 'maintain'" },
      { status: 400 },
    )
  }

  const status = body.status ?? 'active'
  const allowedStatus = ['draft', 'active', 'paused', 'achieved', 'archived']
  if (typeof status !== 'string' || !allowedStatus.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of ${allowedStatus.join(', ')}` },
      { status: 400 },
    )
  }

  const insert = {
    owner_type: ownerType,
    owner_id: ownerType === 'whanau' ? null : ownerId,
    title,
    description: typeof body.description === 'string' ? body.description : null,
    metric_key: typeof body.metric_key === 'string' ? body.metric_key : null,
    direction: direction ?? null,
    baseline: typeof body.baseline === 'number' ? body.baseline : null,
    target: typeof body.target === 'number' ? body.target : null,
    status,
    proposed_by: body.proposed_by ?? null,
  }

  const { data, error } = await supabase
    .from('goals')
    .insert(insert)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
