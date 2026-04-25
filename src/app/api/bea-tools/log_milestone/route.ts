import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: mark a milestone the family should celebrate.
// Body: { owner_type, owner_id?, kind, title, payload? }
// Idempotent on (owner_type, owner_id, kind) — re-awarding returns existing.
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
  const kind = typeof body.kind === 'string' ? body.kind.trim() : ''
  if (!kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 })
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  // Idempotency check
  const lookup = supabase
    .from('milestones')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('kind', kind)
  const lookupQ =
    ownerType === 'whanau' ? lookup.is('owner_id', null) : lookup.eq('owner_id', ownerId as string)
  const { data: existing } = await lookupQ.maybeSingle()
  if (existing) {
    return NextResponse.json({
      say: `That milestone is already marked: ${existing.title}.`,
      milestone: existing,
      already_awarded: true,
    })
  }

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      owner_type: ownerType,
      owner_id: ownerType === 'whanau' ? null : ownerId,
      kind,
      title,
      payload: body.payload ?? null,
      achieved_at: new Date().toISOString(),
    })
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
      if (again) {
        return NextResponse.json({
          say: `That milestone is already marked: ${again.title}.`,
          milestone: again,
          already_awarded: true,
        })
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    say: `Marked a milestone: ${title}.`,
    milestone: data,
  })
}
