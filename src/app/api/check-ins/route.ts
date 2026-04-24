import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type CheckInRow = {
  id: string
  started_at: string | null
  transcript: TranscriptRow[]
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  family_pulse: string | null
  suggested_focus: string | null
  wellbeing_level: string | null
  wellbeing_signals: string[] | null
  wellbeing_note: string | null
  reflection: string | null
}

export async function GET() {
  const [individualResult, familyResult] = await Promise.all([
    supabase
      .from('check_ins')
      .select('id, started_at, transcript, individual_summary, individual_themes, emotional_tone, family_pulse, suggested_focus, wellbeing_level, wellbeing_signals, wellbeing_note, reflection')
      .order('started_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('check_ins')
      .select('started_at, individual_summary, family_pulse')
      .order('started_at', { ascending: false })
      .limit(5),
  ])

  const individual = individualResult.data as CheckInRow | null
  const family = (familyResult.data ?? []) as Pick<CheckInRow, 'started_at' | 'individual_summary' | 'family_pulse'>[]

  // Prefer AI-generated summary; fall back to nothing
  const individual_summary = individual?.individual_summary ?? null
  const individual_themes = individual?.individual_themes ?? []
  const emotional_tone = individual?.emotional_tone ?? null
  const suggested_focus = individual?.suggested_focus ?? null
  const wellbeing_level = individual?.wellbeing_level ?? null
  const wellbeing_signals = individual?.wellbeing_signals ?? []
  const wellbeing_note = individual?.wellbeing_note ?? null
  const reflection = individual?.reflection ?? null

  const last_checkin_date = individual?.started_at
    ? new Date(individual.started_at).toLocaleDateString('en-NZ', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null

  const last_checkin_at = individual?.started_at ?? null

  // Family summary: aggregate the most recent family_pulse entries
  const family_summary =
    family.length > 0
      ? family
          .map((row) => row.family_pulse)
          .filter(Boolean)
          .join(' | ') || null
      : null

  return NextResponse.json({
    last_checkin_date,
    last_checkin_at,
    individual_summary,
    individual_themes,
    emotional_tone,
    suggested_focus,
    family_summary,
    wellbeing_level,
    wellbeing_signals,
    wellbeing_note,
    reflection,
  })
}

export async function POST(request: NextRequest) {
  let body: {
    transcript: TranscriptRow[]
    agent_id?: string
    started_at?: string
    call_duration_secs?: number
    member_id?: string
    member_name?: string
    is_guest?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { transcript, agent_id, started_at, call_duration_secs, member_id, member_name, is_guest } = body

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ error: 'Transcript is empty' }, { status: 400 })
  }

  // Guests have no records saved — honour the consent model
  if (is_guest) {
    return NextResponse.json({ saved: false, reason: 'guest' })
  }

  // Save transcript and get back the row ID so Guardian 1 can update it
  const { data: inserted, error } = await supabase
    .from('check_ins')
    .insert({
      agent_id: agent_id ?? null,
      transcript,
      call_duration_secs: call_duration_secs ?? null,
      started_at: started_at ?? null,
      member_id: member_id ?? null,
      member_name: member_name ?? null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
  }

  // Fire all per-session guardians — none block the response.
  // Each writes its results back to the check_ins row independently.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const guardianPayload = JSON.stringify({ check_in_id: inserted.id, transcript, member_id: member_id ?? null })
  const guardianHeaders = { 'Content-Type': 'application/json' }

  const guardians = [
    '/api/guardian/summarise',  // Guardian 1: emotional summary + themes
    '/api/guardian/wellbeing',  // Guardian 3: wellbeing level + signals
    '/api/guardian/reflect',    // Guardian 4: Bea's reflection letter
    '/api/guardian/absence',    // Guardian 9: what wasn't said
    '/api/guardian/crisis',     // Guardian 10: safety layer — writes in-session response, notifies contacts
  ]

  for (const path of guardians) {
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: guardianHeaders,
      body: guardianPayload,
    }).catch((err) => console.error(`${path} trigger failed:`, err))
  }

  return NextResponse.json({ saved: true, check_in_id: inserted.id })
}
