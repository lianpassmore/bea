import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { writeMemory } from '@/lib/memory'
import { GUARDIAN_SUMMARY_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type SummaryOutput = {
  individual_summary: string
  individual_themes: string[]
  emotional_tone: string
  family_pulse: string
  suggested_focus: string
}

function formatTranscript(transcript: TranscriptRow[]): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
    .join('\n')
}

export async function POST(request: NextRequest) {
  let body: { check_in_id: string; transcript: TranscriptRow[]; member_id?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { check_in_id, transcript, member_id } = body

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
  }

  const transcriptText = formatTranscript(transcript)

  // Opus 4.7 with extended thinking — the guardian reasons deeply before summarising
  let summaryData: SummaryOutput
  let thinkingContent: string | null = null

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_SUMMARY_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation transcript:\n\n${transcriptText}`,
        },
      ],
    })

    // Extended thinking returns multiple content blocks — find each type
    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinkingContent = block.thinking
      } else if (block.type === 'text') {
        summaryData = JSON.parse(block.text) as SummaryOutput
      }
    }

    if (!summaryData!) {
      throw new Error('No text block in response')
    }
  } catch (err) {
    console.error('Guardian summary generation failed:', err)
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 })
  }

  // Persist the summary back into the check_ins row
  if (check_in_id) {
    const { error: updateError } = await supabase
      .from('check_ins')
      .update({
        individual_summary: summaryData.individual_summary,
        individual_themes: summaryData.individual_themes,
        emotional_tone: summaryData.emotional_tone,
        family_pulse: summaryData.family_pulse,
        suggested_focus: summaryData.suggested_focus,
        guardian_thinking: thinkingContent,
      })
      .eq('id', check_in_id)

    if (updateError) {
      console.error('Failed to store summary:', updateError)
      // Don't fail the request — still return the summary even if storage fails
    }
  }

  // Write the latest session summary to the member's memory store entry,
  // then kick off a background context refresh so the next check-in is instant.
  // Wrapped in `after()` so the memory write + downstream context refresh
  // survive the parent invocation being killed.
  if (member_id) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    after(async () => {
      try {
        await writeMemory(
          `/members/${member_id}/last_session.json`,
          JSON.stringify({ ...summaryData, saved_at: new Date().toISOString() }),
        )
        await fetch(`${baseUrl}/api/guardian/context?memberId=${member_id}&refresh=true`)
      } catch (err) {
        console.error('[memory] context refresh failed:', err)
      }
    })
  }

  // ── Auto-trigger Coach for each active goal owned by this member ──────
  // The Coach reads the fresh summary + recent observations + patterns and
  // decides what (if anything) Bea should raise next time. Wrapped in
  // `after()` so the trigger fetches survive Vercel killing this invocation.
  if (member_id && check_in_id) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const { data: activeGoalsRaw } = await supabase
      .from('goals')
      .select('id')
      .eq('owner_type', 'member')
      .eq('owner_id', member_id)
      .eq('status', 'active')
    const activeGoals = (activeGoalsRaw ?? []) as Array<{ id: string }>
    if (activeGoals.length > 0) {
      after(async () => {
        await Promise.allSettled(
          activeGoals.map((g) =>
            fetch(`${baseUrl}/api/guardian/coach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_id, goal_id: g.id, check_in_id }),
            }).catch((err) => {
              console.error('[guardian/summarise] coach trigger failed:', err)
            }),
          ),
        )
      })
    }
  }

  return NextResponse.json({
    ok: true,
    summary: summaryData,
    thinking: thinkingContent,
  })
}
