/**
 * Guardian 8 — Perspective
 *
 * Produces a per-member internal memo drawn from the last 7 sessions.
 * Written in Bea's voice, describing what one person is carrying in
 * their own shape — not comparing, not diagnosing, not advising.
 *
 * CRITICAL: These memos are internal. They are never shown to the
 * member they describe, nor to anyone else in the family. They exist
 * only to feed Guardian 5 (Insight) with perspective-shifted input
 * so it can see the gap between how different people experience
 * the same household.
 *
 * Do not render memo content in any user-facing UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_PERSPECTIVE_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type Session = {
  started_at: string | null
  transcript: TranscriptRow[] | null
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
}

function formatTranscriptExcerpt(transcript: TranscriptRow[], maxTurns = 12): string {
  if (!transcript || transcript.length === 0) return '(no transcript)'
  const lines = transcript
    .slice(0, maxTurns)
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
  const truncated = transcript.length > maxTurns
    ? `\n... (${transcript.length - maxTurns} more exchanges)`
    : ''
  return lines.join('\n') + truncated
}

function formatSession(s: Session, i: number): string {
  const date = s.started_at ? new Date(s.started_at).toISOString().slice(0, 10) : 'unknown date'
  const tone = s.emotional_tone ?? '(not noted)'
  const themes = s.individual_themes?.length ? s.individual_themes.join(', ') : '(none)'

  // Prefer the guardian-written summary; fall back to a transcript excerpt
  const body = s.individual_summary
    ? `Summary: ${s.individual_summary}`
    : `Transcript excerpt:\n${formatTranscriptExcerpt(s.transcript ?? [])}`

  return `Session ${i + 1} (${date}):
Emotional tone: ${tone}
Themes: ${themes}
${body}`
}

export async function POST(request: NextRequest) {
  let body: { member_id: string; period_start?: string; period_end?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 })
  }

  const { member_id, period_start, period_end } = body
  if (!member_id) {
    return NextResponse.json({ ok: false, error: 'member_id is required' }, { status: 200 })
  }

  try {
    // Fetch member to get their name — the prompt requires it to produce
    // "From [name]'s perspective this week…"
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name')
      .eq('id', member_id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 200 })
    }

    // Fetch sessions — last 7 by default, filtered to range if caller provided one
    let sessionsQuery = supabase
      .from('check_ins')
      .select('started_at, transcript, individual_summary, individual_themes, emotional_tone')
      .eq('member_id', member_id)
      .order('started_at', { ascending: false })
      .limit(7)

    if (period_start) sessionsQuery = sessionsQuery.gte('started_at', period_start)
    if (period_end) sessionsQuery = sessionsQuery.lte('started_at', period_end)

    const { data: sessionsData, error: sessionsError } = await sessionsQuery
    if (sessionsError) throw sessionsError

    const sessions = (sessionsData ?? []) as Session[]
    if (sessions.length < 2) {
      return NextResponse.json({ skipped: true, reason: 'insufficient_history' })
    }

    // Compute the effective period for storage:
    //   - if caller passed explicit dates, use those
    //   - otherwise, use the actual session range we pulled
    const sessionDates = sessions
      .map((s) => s.started_at)
      .filter((d): d is string => !!d)
      .sort()

    const effectiveStart = period_start ?? sessionDates[0] ?? null
    const effectiveEnd = period_end ?? sessionDates[sessionDates.length - 1] ?? null

    // Reverse to chronological order (oldest first) so the memo reads as progression
    const chronological = [...sessions].reverse()
    const userContent = `Member name: ${member.name}

Here are ${chronological.length} recent sessions from ${member.name}, in chronological order (oldest first):

${chronological.map((s, i) => formatSession(s, i)).join('\n\n')}`

    // Opus 4.7 with extended thinking — perspective work benefits from the model
    // holding all 7 sessions in view before writing the 4–6 sentence memo.
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 5000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_PERSPECTIVE_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    })

    const memo = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text.trim())
      .join('\n\n')
      .trim()

    if (!memo) {
      throw new Error('No text block in response')
    }

    const { data: insertData, error: insertError } = await supabase
      .from('perspective_memos')
      .insert({
        member_id,
        memo,
        period_start: effectiveStart,
        period_end: effectiveEnd,
      })
      .select('id')
      .single()

    if (insertError || !insertData) {
      console.error('[guardian/perspective] Failed to store memo:', insertError)
      return NextResponse.json({ ok: false, error: 'Failed to persist memo' }, { status: 200 })
    }

    return NextResponse.json({
      ok: true,
      memo_id: insertData.id,
      memo,
    })
  } catch (err) {
    console.error('[guardian/perspective] failure:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
