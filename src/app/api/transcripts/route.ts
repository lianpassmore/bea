import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

interface TranscriptMessage {
  role: 'user' | 'agent'
  message: string
  time_in_call_secs: number
}

interface ElevenLabsWebhookPayload {
  type: string
  event_timestamp: number
  data: {
    agent_id: string
    conversation_id: string
    status: string
    transcript: TranscriptMessage[]
    metadata?: {
      start_time_unix_secs?: number
      call_duration_secs?: number
    }
    analysis?: {
      transcript_summary?: string
      call_successful?: string
    }
  }
}

export async function POST(request: NextRequest) {
  let body: ElevenLabsWebhookPayload

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ElevenLabs sends various event types; only persist post-call transcripts
  if (body.type !== 'post_call_transcription') {
    return NextResponse.json({ received: true })
  }

  const { conversation_id, agent_id, transcript, metadata, analysis } = body.data

  const { error } = await supabase.from('transcripts').insert({
    conversation_id,
    agent_id,
    transcript,
    summary: analysis?.transcript_summary ?? null,
    call_successful: analysis?.call_successful ?? null,
    call_duration_secs: metadata?.call_duration_secs ?? null,
    started_at: metadata?.start_time_unix_secs
      ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
      : null,
  })

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
