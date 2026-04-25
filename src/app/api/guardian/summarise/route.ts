import { NextRequest, NextResponse } from 'next/server'
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
  if (member_id) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    void writeMemory(
      `/members/${member_id}/last_session.json`,
      JSON.stringify({ ...summaryData, saved_at: new Date().toISOString() })
    ).then(() => {
      // Refresh the pre-computed context brief so Guardian 2 can serve it instantly next time
      fetch(`${baseUrl}/api/guardian/context?memberId=${member_id}&refresh=true`)
        .catch((err) => console.error('[memory] context refresh failed:', err))
    })
  }

  return NextResponse.json({
    ok: true,
    summary: summaryData,
    thinking: thinkingContent,
  })
}
