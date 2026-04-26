import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_WELLBEING_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type WellbeingOutput = {
  wellbeing_level: 'green' | 'amber' | 'red'
  signals: string[]
  note: string
  escalate: boolean
}

function formatTranscript(transcript: TranscriptRow[]): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
    .join('\n')
}

export async function POST(request: NextRequest) {
  let body: { check_in_id: string; transcript: TranscriptRow[] }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { check_in_id, transcript } = body

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
  }

  let wellbeingData: WellbeingOutput

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'high' },
      system: GUARDIAN_WELLBEING_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation transcript:\n\n${formatTranscript(transcript)}`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')
    wellbeingData = JSON.parse(textBlock.text) as WellbeingOutput
  } catch (err) {
    console.error('Guardian wellbeing failed:', err)
    return NextResponse.json({ error: 'Wellbeing check failed' }, { status: 500 })
  }

  if (check_in_id) {
    const { error } = await supabase
      .from('check_ins')
      .update({
        wellbeing_level: wellbeingData.wellbeing_level,
        wellbeing_signals: wellbeingData.signals,
        wellbeing_note: wellbeingData.note,
        wellbeing_escalate: wellbeingData.escalate,
      })
      .eq('id', check_in_id)

    if (error) console.error('Failed to store wellbeing data:', error)
  }

  return NextResponse.json({ ok: true, wellbeing: wellbeingData })
}
