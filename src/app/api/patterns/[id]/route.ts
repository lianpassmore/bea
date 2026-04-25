import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { data, error } = await supabase
    .from('patterns')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Update a pattern. Mostly used to mark status (discussed / dismissed /
// resolved) after Bea raises it with the family. Severity tweaks allowed too.
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

  if (typeof body.status === 'string') {
    const allowed = ['new', 'discussed', 'dismissed', 'resolved']
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of ${allowed.join(', ')}` },
        { status: 400 },
      )
    }
    update.status = body.status
    if (body.status === 'discussed') update.discussed_at = new Date().toISOString()
  }

  if (typeof body.severity === 'string') {
    const allowed = ['low', 'medium', 'high', 'positive']
    if (!allowed.includes(body.severity)) {
      return NextResponse.json(
        { error: `severity must be one of ${allowed.join(', ')}` },
        { status: 400 },
      )
    }
    update.severity = body.severity
  }

  if (typeof body.title === 'string') update.title = body.title
  if (typeof body.description === 'string') update.description = body.description

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('patterns')
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
  const { error } = await supabase.from('patterns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
