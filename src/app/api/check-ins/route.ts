import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  let body: {
    transcript: { role: string; message: string; time_in_call_secs: number }[]
    agent_id?: string
    started_at?: string
    call_duration_secs?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { transcript, agent_id, started_at, call_duration_secs } = body

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ error: 'Transcript is empty' }, { status: 400 })
  }

  const { error } = await supabase.from('check_ins').insert({
    agent_id: agent_id ?? null,
    transcript,
    call_duration_secs: call_duration_secs ?? null,
    started_at: started_at ?? null,
  })

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
  }

  return NextResponse.json({ saved: true })
}
