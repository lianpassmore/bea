/**
 * Guardian 10 — Crisis
 *
 * The safety layer. Reads every check-in for signals of distress beyond
 * what Bea can hold, responds in-session with age-appropriate warmth
 * and direction toward trusted adults and helplines, and flags crisis
 * states for designated adult contacts.
 *
 * Three levels: watchful, concerned, urgent.
 *
 * Trust hierarchy for minors: parents first (named), other trusted
 * adults as ADDITIONAL options, helplines as real resources,
 * emergency for active risk.
 *
 * CRITICAL:
 * - crisis_in_session_response overrides Guardian 4's reflection for
 *   concerned and urgent levels.
 * - crisis_briefing_for_contact NEVER contains transcript quotes.
 * - Designated contacts are notified via crisis_notifications rows.
 * - Post-hackathon: real-time push notifications to the contact's
 *   device. For now: dashboard card on next login.
 * - No recursion. G10 never calls itself.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_CRISIS_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type MemberRow = {
  id: string
  name: string
  role: 'primary' | 'family'
}

type PriorSession = {
  started_at: string | null
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  wellbeing_level: string | null
  wellbeing_note: string | null
}

type CrisisOutput = {
  crisis_detected: boolean
  crisis_level: 'watchful' | 'concerned' | 'urgent' | null
  crisis_signals: string[]
  crisis_reasoning: string
  crisis_in_session_response: string
  crisis_briefing_for_contact: string
}

// Hackathon: minor roster hardcoded. Post-hackathon: members.date_of_birth or is_minor.
const MINOR_NAMES = new Set(['tai', 'olivia'])

function isMinor(member: MemberRow): boolean {
  return member.role === 'family' && MINOR_NAMES.has(member.name.trim().toLowerCase())
}

function formatTranscript(transcript: TranscriptRow[]): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
    .join('\n')
}

function formatPriorSessions(priors: PriorSession[]): string {
  if (priors.length === 0) return '(no prior sessions recorded)'
  return priors
    .map((p, i) => {
      const date = p.started_at ? new Date(p.started_at).toISOString().slice(0, 10) : 'unknown date'
      const themes = p.individual_themes?.length ? p.individual_themes.join(', ') : '(none recorded)'
      return `Session ${i + 1} (${date}):
Summary: ${p.individual_summary ?? '(none recorded)'}
Themes: ${themes}
Emotional tone: ${p.emotional_tone ?? '(none recorded)'}
Wellbeing: ${p.wellbeing_level ?? '(none recorded)'}${p.wellbeing_note ? ` — ${p.wellbeing_note}` : ''}`
    })
    .join('\n\n')
}

// Written on every error path so Guardian 4's poll stops waiting.
const NO_CRISIS_ROW = {
  crisis_detected: false,
  crisis_level: null,
  crisis_signals: [],
  crisis_reasoning: '',
  crisis_in_session_response: '',
  crisis_briefing_for_contact: '',
}

async function writeNoCrisisRow(check_in_id: string) {
  const { error } = await supabase
    .from('check_ins')
    .update(NO_CRISIS_ROW)
    .eq('id', check_in_id)
  if (error) console.error('[guardian/crisis] Failed to write no-crisis row:', error)
}

export async function POST(request: NextRequest) {
  let body: { check_in_id: string; transcript: TranscriptRow[]; member_id?: string | null }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 })
  }

  const { check_in_id, transcript, member_id } = body

  // Guest sessions have no designated contacts — skip entirely
  if (!member_id) {
    return NextResponse.json({ skipped: true, reason: 'guest' })
  }

  if (!transcript || transcript.length === 0) {
    if (check_in_id) await writeNoCrisisRow(check_in_id)
    return NextResponse.json({ ok: false, error: 'No transcript provided' }, { status: 200 })
  }

  try {
    // 1. Fetch member — need name, role, minor status
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id, name, role')
      .eq('id', member_id)
      .single()

    if (memberError || !memberData) throw new Error('Member not found')
    const member = memberData as MemberRow
    const minor = isMinor(member)

    // 2. Fetch last 10 prior sessions for this member, excluding current
    const { data: priorsData } = await supabase
      .from('check_ins')
      .select('started_at, individual_summary, individual_themes, emotional_tone, wellbeing_level, wellbeing_note')
      .eq('member_id', member_id)
      .neq('id', check_in_id)
      .order('started_at', { ascending: false })
      .limit(10)

    const priors = (priorsData ?? []) as PriorSession[]

    // 3. Crisis contacts:
    //    - Minor → all active primaries
    //    - Adult primary → the OTHER active primary (exclude self)
    //    - Adult family (non-minor) → defensive default: active primaries
    let contactsQuery = supabase
      .from('members')
      .select('id, name, role')
      .eq('role', 'primary')
      .eq('status', 'active')
    if (member.role === 'primary') {
      contactsQuery = contactsQuery.neq('id', member.id)
    }
    const { data: contactsData } = await contactsQuery
    const contacts = (contactsData ?? []) as MemberRow[]

    // 4. Build user message
    const contactNames = contacts.map((c) => c.name).join(', ') || '(none on record)'
    const userContent = `Current conversation:

${formatTranscript(transcript)}

Person: ${member.name}
Role: ${minor ? 'minor (under 18)' : member.role === 'primary' ? 'adult parent' : 'adult family member'}
Designated adult contacts: ${contactNames}

Last ${priors.length} sessions (most recent first):

${formatPriorSessions(priors)}`

    // 5. Opus 4.7 with 4k thinking — deepest, most careful call in the system
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 6000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_CRISIS_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
    const lastText = textBlocks[textBlocks.length - 1]
    if (!lastText) throw new Error('No text block in response')

    const data = JSON.parse(lastText.text) as CrisisOutput

    // 6. Update check-in row with all crisis columns
    const { error: updateError } = await supabase
      .from('check_ins')
      .update({
        crisis_detected: data.crisis_detected,
        crisis_level: data.crisis_level,
        crisis_signals: data.crisis_signals,
        crisis_reasoning: data.crisis_reasoning,
        crisis_in_session_response: data.crisis_in_session_response,
        crisis_briefing_for_contact: data.crisis_briefing_for_contact,
      })
      .eq('id', check_in_id)

    if (updateError) {
      console.error('[guardian/crisis] Failed to store crisis row:', updateError)
    }

    // 7. Insert crisis_notifications for concerned/urgent
    if (
      (data.crisis_level === 'concerned' || data.crisis_level === 'urgent') &&
      data.crisis_briefing_for_contact &&
      contacts.length > 0
    ) {
      const notificationRows = contacts.map((c) => ({
        check_in_id,
        affected_member_id: member.id,
        contact_member_id: c.id,
        crisis_level: data.crisis_level,
        briefing: data.crisis_briefing_for_contact,
      }))
      const { error: notifError } = await supabase
        .from('crisis_notifications')
        .insert(notificationRows)
      if (notifError) {
        console.error('[guardian/crisis] Failed to insert notifications:', notifError)
      } else {
        console.log(
          `[guardian/crisis] crisis=${data.crisis_level} — ${notificationRows.length} notification(s) created`,
        )
      }
    }

    return NextResponse.json({
      ok: true,
      crisis_level: data.crisis_level,
      crisis_in_session_response: data.crisis_in_session_response,
    })
  } catch (err) {
    console.error('[guardian/crisis] failure:', err)
    // Fail-open: write the no-crisis row so G4's poll unblocks, then return 200
    if (check_in_id) await writeNoCrisisRow(check_in_id)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
