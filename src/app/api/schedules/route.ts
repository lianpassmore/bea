import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('time', { ascending: true })

  if (error) {
    console.error('Failed to fetch schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }

  return NextResponse.json({ schedules: data ?? [] })
}

export async function POST(request: NextRequest) {
  let body: {
    label: string
    days: string[]
    time: string
    mode: 'listen' | 'checkin' | 'group'
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { label, days, time, mode } = body

  if (!label || !days?.length || !time || !mode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('schedules')
    .insert({ label, days, time, mode, active: true })
    .select()
    .single()

  if (error) {
    console.error('Failed to create schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }

  return NextResponse.json({ schedule: data }, { status: 201 })
}
