import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: { active?: boolean; label?: string; days?: string[]; time?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('schedules')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update schedule:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }

  return NextResponse.json({ schedule: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await supabase.from('schedules').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete schedule:', error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
