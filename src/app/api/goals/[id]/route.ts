import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Patch a goal — title, description, metric_key, direction, baseline, target,
// status. owner_type and owner_id are immutable here (delete + recreate if you
// really need to change them).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string') update.title = body.title.trim()
  if (typeof body.description === 'string' || body.description === null)
    update.description = body.description
  if (typeof body.metric_key === 'string' || body.metric_key === null)
    update.metric_key = body.metric_key
  if (
    body.direction === 'decrease' ||
    body.direction === 'increase' ||
    body.direction === 'maintain' ||
    body.direction === null
  )
    update.direction = body.direction
  if (typeof body.baseline === 'number' || body.baseline === null)
    update.baseline = body.baseline
  if (typeof body.target === 'number' || body.target === null)
    update.target = body.target

  if (typeof body.status === 'string') {
    const allowed = ['draft', 'active', 'paused', 'achieved', 'archived']
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of ${allowed.join(', ')}` },
        { status: 400 },
      )
    }
    update.status = body.status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('goals')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
