import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// List milestones.
//   ?owner_type=member&owner_id=<uuid>
//   ?owner_type=whanau
//   no params → all milestones
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ownerType = params.get('owner_type')
  const ownerId = params.get('owner_id')

  let query = supabase
    .from('milestones')
    .select('*')
    .order('achieved_at', { ascending: false })

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

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Award a milestone. Idempotent on (owner_type, owner_id, kind) — re-posting
// the same kind for the same owner returns the existing row.
// Body: { owner_type, owner_id?, kind, title, payload?, achieved_at? }
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
      { error: 'owner_id is required for member milestones' },
      { status: 400 },
    )
  }
  if (ownerType === 'whanau' && ownerId !== null) {
    return NextResponse.json(
      { error: 'whanau milestones must have owner_id null' },
      { status: 400 },
    )
  }

  const kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  if (!kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 })
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const insert = {
    owner_type: ownerType,
    owner_id: ownerType === 'whanau' ? null : ownerId,
    kind,
    title,
    payload: body.payload ?? null,
    achieved_at:
      typeof body.achieved_at === 'string' ? body.achieved_at : new Date().toISOString(),
  }

  // Idempotent on (owner_type, owner_id, kind). Check first; if a unique
  // violation races us we re-fetch and return the winning row.
  const lookup = supabase
    .from('milestones')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('kind', kind)
  const lookupQ =
    ownerType === 'whanau' ? lookup.is('owner_id', null) : lookup.eq('owner_id', ownerId as string)
  const { data: existing } = await lookupQ.maybeSingle()
  if (existing) return NextResponse.json(existing, { status: 200 })

  const { data, error } = await supabase
    .from('milestones')
    .insert(insert)
    .select('*')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const retry = supabase
        .from('milestones')
        .select('*')
        .eq('owner_type', ownerType)
        .eq('kind', kind)
      const retryQ =
        ownerType === 'whanau'
          ? retry.is('owner_id', null)
          : retry.eq('owner_id', ownerId as string)
      const { data: again } = await retryQ.single()
      if (again) return NextResponse.json(again, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
