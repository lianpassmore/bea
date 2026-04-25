import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_GROUP_PROMPT } from '@/lib/prompts'

// Opus 4.7 with high effort + adaptive thinking + 16k tokens — long-running.
export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TranscriptTurn = { speaker: number; offset_ms: number; text: string }
type RosterEntry = { member_id: string; name: string; consented?: boolean }

type SpeakerMapEntry = {
  member_id: string | null
  name: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  is_bea?: boolean
}

type ElevenLabsTurn = {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
}

type PerMemberSummary = {
  member_id: string
  individual_summary: string
  individual_themes: string[]
  emotional_tone: string
  suggested_focus: string
  reflection: string
}

type GroupOutput = {
  speaker_map: Record<string, SpeakerMapEntry>
  attribution_reasoning: string
  family_summary: string
  family_themes: string[]
  family_tone: string
  family_pulse: string
  per_member_summaries: PerMemberSummary[]
}

function formatTranscript(turns: TranscriptTurn[]): string {
  return turns
    .map((t) => {
      const mm = Math.floor(t.offset_ms / 60000)
      const ss = Math.floor((t.offset_ms % 60000) / 1000)
      const stamp = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      return `[${stamp}] Speaker ${t.speaker}: ${t.text}`
    })
    .join('\n')
}

export async function POST(request: NextRequest) {
  let body: { session_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { session_id } = body
  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const { data: session, error: sessionErr } = await supabase
    .from('listening_sessions')
    .select('id, roster, raw_transcript, started_at, kind, eleven_labs_transcript')
    .eq('id', session_id)
    .single()

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const transcript = (session.raw_transcript ?? []) as TranscriptTurn[]
  if (transcript.length === 0) {
    return NextResponse.json({ error: 'No transcript on session' }, { status: 400 })
  }
  const roster = (session.roster ?? []) as RosterEntry[]

  // Pull the full household for context — someone unexpected may have spoken.
  // Include both 'active' (consented) and 'held' (in the household but not yet
  // consented, e.g. minors) so Claude can attribute their voices correctly.
  // Per-member summaries will only be created for consented members.
  const { data: householdRaw } = await supabase
    .from('members')
    .select('id, name, role, status')
    .in('status', ['active', 'held'])

  const household = (householdRaw ?? []) as Array<{
    id: string
    name: string
    role: string
    status: string
  }>

  const consentedHouseholdIds = new Set(
    household.filter((m) => m.status === 'active').map((m) => m.id),
  )

  const rosterText =
    roster.length > 0
      ? roster
          .map((r) => {
            const consented = r.consented !== false
            const tag = consented ? '' : ' [no consent — attribute but do not summarise]'
            return `- ${r.name} (member_id: ${r.member_id})${tag}`
          })
          .join('\n')
      : '(no roster provided — infer from the full household)'

  const householdText = household
    .map((m) => {
      const tag = m.status === 'active' ? '' : ' [no consent — attribute but do not summarise]'
      return `- ${m.name} (member_id: ${m.id}, role: ${m.role})${tag}`
    })
    .join('\n')

  const kind: 'passive' | 'guided' = session.kind === 'guided' ? 'guided' : 'passive'
  const elevenLabsTranscript = (session.eleven_labs_transcript ?? null) as
    | ElevenLabsTurn[]
    | null

  const beaTurnsText =
    kind === 'guided' && elevenLabsTranscript && elevenLabsTranscript.length > 0
      ? elevenLabsTranscript
          .filter((t) => t.role === 'agent')
          .map((t) => {
            const totalSec = Math.floor(t.time_in_call_secs)
            const mm = Math.floor(totalSec / 60)
            const ss = totalSec % 60
            const stamp = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
            return `[${stamp}] Bea: ${t.message}`
          })
          .join('\n')
      : null

  const sessionKindBlock =
    kind === 'guided'
      ? [
          `SESSION TYPE: guided family check-in.`,
          `Bea was actively present and spoke aloud during this session via ElevenLabs.`,
          `Her synthesised voice may have been picked up by the microphone (echo from device speakers).`,
          `If one Azure speaker number's turns closely match Bea's known turns below, mark that speaker with "is_bea": true, set member_id to null and name to "Bea", and DO NOT create a per_member_summaries entry for that speaker. Treat the rest of the diarization as the household.`,
          ``,
          `BEA'S KNOWN TURNS (from ElevenLabs, not diarized — use to identify her in the diarized transcript):`,
          beaTurnsText ?? '(none)',
        ].join('\n')
      : `SESSION TYPE: passive listening. Bea was silently in the room and did not speak.`

  const userMessage = [
    sessionKindBlock,
    ``,
    `SESSION ROSTER (expected in the room):`,
    rosterText,
    ``,
    `FULL HOUSEHOLD (for cross-reference):`,
    householdText,
    ``,
    `DIARIZED TRANSCRIPT:`,
    formatTranscript(transcript),
  ].join('\n')

  let output: GroupOutput
  let thinkingContent: string | null = null

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'high' },
      system: GUARDIAN_GROUP_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    let parsed: GroupOutput | null = null
    for (const block of response.content) {
      if (block.type === 'thinking') thinkingContent = block.thinking
      else if (block.type === 'text') parsed = JSON.parse(block.text) as GroupOutput
    }
    if (!parsed) throw new Error('No text block in response')
    output = parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[guardian/group] Claude call failed:', msg)
    await supabase
      .from('listening_sessions')
      .update({ status: 'failed', error: msg })
      .eq('id', session.id)
    return NextResponse.json({ error: 'Group guardian failed', detail: msg }, { status: 500 })
  }

  // Build the attributed transcript using the speaker_map.
  const attributedTranscript = transcript.map((turn) => {
    const mapped = output.speaker_map[String(turn.speaker)]
    return {
      ...turn,
      attributed_member_id: mapped?.member_id ?? null,
      attributed_name: mapped?.name ?? 'guest',
      is_bea: mapped?.is_bea === true,
    }
  })

  const { error: updateErr } = await supabase
    .from('listening_sessions')
    .update({
      attributed_transcript: attributedTranscript,
      speaker_map: output.speaker_map,
      attribution_reasoning: output.attribution_reasoning,
      family_summary: output.family_summary,
      family_themes: output.family_themes,
      family_tone: output.family_tone,
      family_pulse: output.family_pulse,
      guardian_thinking: thinkingContent,
      status: 'attributed',
      error: null,
    })
    .eq('id', session.id)

  if (updateErr) {
    console.error('[guardian/group] session update failed:', updateErr)
    return NextResponse.json({ error: 'Failed to save session results' }, { status: 500 })
  }

  // Upsert per-member summaries. Skip any where member_id is missing, not in
  // the household (guards against hallucinated uuids), or belongs to a held
  // (non-consented) member. Held members are attributed in the speaker_map
  // for transcript accuracy, but no individual record is created for them.
  const perMemberRows = output.per_member_summaries
    .filter((s) => s.member_id && consentedHouseholdIds.has(s.member_id))
    .map((s) => {
      const memberName =
        roster.find((r) => r.member_id === s.member_id)?.name ??
        household.find((m) => m.id === s.member_id)?.name ??
        'Unknown'
      return {
        session_id: session.id,
        member_id: s.member_id,
        member_name: memberName,
        individual_summary: s.individual_summary,
        individual_themes: s.individual_themes,
        emotional_tone: s.emotional_tone,
        suggested_focus: s.suggested_focus,
        reflection: s.reflection,
      }
    })

  if (perMemberRows.length > 0) {
    const { error: summariesErr } = await supabase
      .from('listening_member_summaries')
      .upsert(perMemberRows, { onConflict: 'session_id,member_id' })
    if (summariesErr) {
      console.error('[guardian/group] per-member summaries upsert failed:', summariesErr)
    }
  }

  // Fire the pattern detection agent — runs after every session, reads the
  // attributed transcript + active goals + recent patterns, writes
  // session_insights, observations, pattern updates, and milestones.
  // Wrapped in `after()` so the trigger fetch survives Vercel killing the
  // parent invocation.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  after(async () => {
    try {
      await fetch(`${baseUrl}/api/guardian/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
    } catch (err) {
      console.error('[guardian/group] pattern agent trigger failed:', err)
    }
  })

  // Refresh each affected member's pre-session context cache so the next
  // check-in reflects what just happened. Without this the cache from before
  // the session is served on the next /check-in, and Bea has no idea the
  // listening session occurred.
  const memberIdsToRefresh = perMemberRows.map((r) => r.member_id)
  for (const mid of memberIdsToRefresh) {
    after(async () => {
      try {
        await fetch(`${baseUrl}/api/guardian/context?memberId=${mid}&refresh=true`, {
          method: 'GET',
        })
      } catch (err) {
        console.error('[guardian/group] context refresh failed for', mid, err)
      }
    })
  }

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    speaker_map: output.speaker_map,
    family_summary: output.family_summary,
    per_member_count: perMemberRows.length,
  })
}
