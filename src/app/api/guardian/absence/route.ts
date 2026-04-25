/**
 * Guardian 9 — Absence
 *
 * Reads the current transcript alongside prior sessions and identifies
 * what has gone quiet — themes, names, subjects that usually appear
 * but are missing today.
 *
 * CRITICAL: absence_observed is never surfaced to the family or the member.
 * It feeds only into Guardians 5 (Insight), 6 (Silence), and 2 (Context).
 * Do not render this field in any UI, now or later.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_ABSENCE_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type PriorSession = {
  started_at: string | null
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
}

type AbsenceOutput = {
  absence_observed: string
  absence_confidence: 'low' | 'medium' | 'high'
}

function formatTranscript(transcript: TranscriptRow[]): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
    .join('\n')
}

function formatPriorSessions(priors: PriorSession[]): string {
  if (priors.length === 0) return '(no prior sessions recorded for this person)'
  return priors
    .map((p, i) => {
      const date = p.started_at ? new Date(p.started_at).toISOString().slice(0, 10) : 'unknown date'
      const themes = p.individual_themes?.length ? p.individual_themes.join(', ') : '(none recorded)'
      return `Session ${i + 1} (${date}):
Summary: ${p.individual_summary ?? '(none recorded)'}
Themes: ${themes}
Emotional tone: ${p.emotional_tone ?? '(none recorded)'}`
    })
    .join('\n\n')
}

export async function POST(request: NextRequest) {
  let body: { check_in_id: string; transcript: TranscriptRow[]; member_id?: string | null }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 })
  }

  const { check_in_id, transcript, member_id } = body

  // Guest sessions have no prior history — absence detection requires it
  if (!member_id) {
    return NextResponse.json({ skipped: true, reason: 'guest' })
  }

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ ok: false, error: 'No transcript provided' }, { status: 200 })
  }

  try {
    // Fetch last 5 prior sessions for this member, excluding the current check-in
    const { data: priorsData, error: priorsError } = await supabase
      .from('check_ins')
      .select('started_at, individual_summary, individual_themes, emotional_tone')
      .eq('member_id', member_id)
      .neq('id', check_in_id)
      .order('started_at', { ascending: false })
      .limit(5)

    if (priorsError) throw priorsError

    const priors = (priorsData ?? []) as PriorSession[]

    const userContent = `Here is the current conversation:

${formatTranscript(transcript)}

Here are the last ${priors.length} prior sessions from this person (most recent first):

${formatPriorSessions(priors)}`

    // Opus 4.7 with extended thinking — absence reasoning is the hardest task in the system
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_ABSENCE_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    })

    let absenceData: AbsenceOutput | undefined
    for (const block of response.content) {
      if (block.type === 'text') {
        absenceData = JSON.parse(block.text) as AbsenceOutput
      }
    }

    if (!absenceData) {
      throw new Error('No text block in response')
    }

    const { error: updateError } = await supabase
      .from('check_ins')
      .update({
        absence_observed: absenceData.absence_observed,
        absence_confidence: absenceData.absence_confidence,
      })
      .eq('id', check_in_id)

    if (updateError) {
      console.error('Failed to store absence:', updateError)
      // Don't fail — guardians never block check-in completion
    }

    return NextResponse.json({
      ok: true,
      absence_observed: absenceData.absence_observed,
      absence_confidence: absenceData.absence_confidence,
    })
  } catch (err) {
    console.error('Guardian absence failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
