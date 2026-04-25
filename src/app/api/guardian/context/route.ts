import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { readMemory, writeMemory } from '@/lib/memory'
import { GUARDIAN_CONTEXT_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type CheckInSummary = {
  started_at: string | null
  individual_summary: string | null
  emotional_tone: string | null
  family_pulse: string | null
  suggested_focus: string | null
}

type ListeningSummary = {
  created_at: string | null
  individual_summary: string | null
  emotional_tone: string | null
  suggested_focus: string | null
  session: { started_at: string | null; family_pulse: string | null } | { started_at: string | null; family_pulse: string | null }[] | null
}

type HistoryEntry = {
  kind: '1:1 CHECK-IN' | 'FAMILY SESSION'
  timestamp: string | null
  individual_summary: string | null
  emotional_tone: string | null
  family_pulse: string | null
  suggested_focus: string | null
}

function sessionStart(s: ListeningSummary['session']): string | null {
  if (!s) return null
  if (Array.isArray(s)) return s[0]?.started_at ?? null
  return s.started_at
}

function sessionPulse(s: ListeningSummary['session']): string | null {
  if (!s) return null
  if (Array.isArray(s)) return s[0]?.family_pulse ?? null
  return s.family_pulse
}

type ContextOutput = {
  last_checkin_date: string | null
  individual_summary: string
  family_summary: string
  emotional_tone: string
  open_threads: string
  listening_priority: string
  listening_direction: string
  household_vision: string
  individual_vision: string
}

const FALLBACK: ContextOutput = {
  last_checkin_date: null,
  individual_summary: 'No previous check-ins on record. This is a fresh start.',
  family_summary: 'No family sessions on record yet.',
  emotional_tone: 'unknown',
  open_threads: 'None yet — this is the first session.',
  listening_priority: 'Listen for what this person most needs to be heard on, without having to ask.',
  listening_direction: 'Listen with fresh eyes. There is no prior context to shape this.',
  household_vision: '',
  individual_vision: '',
}

async function readHouseholdVision(): Promise<string> {
  const { data } = await supabase
    .from('households')
    .select('vision')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.vision as string | null) ?? ''
}

async function readIndividualVision(memberId: string | null): Promise<string> {
  if (!memberId) return ''
  const { data } = await supabase
    .from('members')
    .select('vision')
    .eq('id', memberId)
    .maybeSingle()
  return (data?.vision as string | null) ?? ''
}

// Merge the most recent Coach decision (last 14 days) over the synthesized
// listening_priority / listening_direction. Coach output decides what Bea pays
// attention to in the next session — context's own synthesis is a fallback.
async function applyCoachOverride(
  brief: ContextOutput,
  memberId: string,
): Promise<ContextOutput> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('coach_reads')
    .select('listening_priority, listening_direction, created_at')
    .eq('member_id', memberId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return brief
  return {
    ...brief,
    listening_priority: data.listening_priority || brief.listening_priority,
    listening_direction: data.listening_direction || brief.listening_direction,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  const forceRefresh = searchParams.get('refresh') === 'true'

  // Memory store fast-path: return pre-computed context brief immediately.
  // This runs after every session via Guardian 1's background trigger, so it
  // is almost always warm by the time the next check-in starts.
  if (memberId && !forceRefresh) {
    const cached = await readMemory(`/members/${memberId}/context.json`)
    if (cached) {
      try {
        const brief = JSON.parse(cached) as ContextOutput
        const merged = await applyCoachOverride(brief, memberId)
        const household_vision = await readHouseholdVision()
        const individual_vision = await readIndividualVision(memberId)
        return NextResponse.json({ ...merged, household_vision, individual_vision })
      } catch {
        // Corrupted entry — fall through to live synthesis
      }
    }
  }

  // Live synthesis via Opus 4.7 (first session, or forced refresh after a session ends)
  const checkInsQuery = memberId
    ? supabase.from('check_ins').select('started_at, individual_summary, emotional_tone, family_pulse, suggested_focus').eq('member_id', memberId)
    : supabase.from('check_ins').select('started_at, individual_summary, emotional_tone, family_pulse, suggested_focus')

  const listeningQuery = memberId
    ? supabase
        .from('listening_member_summaries')
        .select('created_at, individual_summary, emotional_tone, suggested_focus, session:listening_sessions(started_at, family_pulse)')
        .eq('member_id', memberId)
    : supabase
        .from('listening_member_summaries')
        .select('created_at, individual_summary, emotional_tone, suggested_focus, session:listening_sessions(started_at, family_pulse)')

  const [checkInsRes, listeningRes, { data: latest }] = await Promise.all([
    checkInsQuery.not('individual_summary', 'is', null).order('started_at', { ascending: false }).limit(5),
    listeningQuery.not('individual_summary', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('check_ins').select('started_at').order('started_at', { ascending: false }).limit(1).single(),
  ])

  const last_checkin_date = latest?.started_at
    ? new Date(latest.started_at).toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  const checkInRows = (checkInsRes.data ?? []) as CheckInSummary[]
  const listeningRows = (listeningRes.data ?? []) as ListeningSummary[]

  const mergedHistory: HistoryEntry[] = [
    ...checkInRows.map<HistoryEntry>((s) => ({
      kind: '1:1 CHECK-IN',
      timestamp: s.started_at,
      individual_summary: s.individual_summary,
      emotional_tone: s.emotional_tone,
      family_pulse: s.family_pulse,
      suggested_focus: s.suggested_focus,
    })),
    ...listeningRows.map<HistoryEntry>((s) => ({
      kind: 'FAMILY SESSION',
      timestamp: sessionStart(s.session) ?? s.created_at,
      individual_summary: s.individual_summary,
      emotional_tone: s.emotional_tone,
      family_pulse: sessionPulse(s.session),
      suggested_focus: s.suggested_focus,
    })),
  ]
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
    .slice(0, 8)

  if (checkInsRes.error || mergedHistory.length === 0) {
    const household_vision = await readHouseholdVision()
    const individual_vision = await readIndividualVision(memberId)
    return NextResponse.json({ ...FALLBACK, last_checkin_date, household_vision, individual_vision })
  }

  const sessionHistory = mergedHistory
    .map((s, i) => {
      const date = s.timestamp
        ? new Date(s.timestamp).toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Unknown date'
      return [
        `[${s.kind}] Session ${i + 1} (${date}):`,
        `  Summary: ${s.individual_summary ?? 'No summary'}`,
        `  Emotional tone: ${s.emotional_tone ?? 'Unknown'}`,
        `  Family pulse: ${s.family_pulse ?? 'No family context'}`,
        `  Suggested focus: ${s.suggested_focus ?? 'None'}`,
      ].join('\n')
    })
    .join('\n\n')

  let contextData: Omit<ContextOutput, 'last_checkin_date' | 'household_vision' | 'individual_vision'>

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 5000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_CONTEXT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the recent session history for this family member — a mix of one-on-one conversations and family sessions where Bea listened quietly:\n\n${sessionHistory}\n\nPlease synthesise a pre-session context brief.`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')
    contextData = JSON.parse(textBlock.text) as Omit<ContextOutput, 'last_checkin_date' | 'household_vision' | 'individual_vision'>
  } catch (err) {
    console.error('Guardian context synthesis failed:', err)
    const s = mergedHistory[0]
    const household_vision = await readHouseholdVision()
    const individual_vision = await readIndividualVision(memberId)
    const fallbackBrief: ContextOutput = {
      last_checkin_date,
      individual_summary: s?.individual_summary ?? FALLBACK.individual_summary,
      family_summary: s?.family_pulse ?? FALLBACK.family_summary,
      emotional_tone: s?.emotional_tone ?? FALLBACK.emotional_tone,
      open_threads: s?.suggested_focus ?? FALLBACK.open_threads,
      listening_priority: FALLBACK.listening_priority,
      listening_direction: FALLBACK.listening_direction,
      household_vision,
      individual_vision,
    }
    const merged = memberId ? await applyCoachOverride(fallbackBrief, memberId) : fallbackBrief
    return NextResponse.json(merged)
  }

  const result: ContextOutput = { last_checkin_date, ...contextData, household_vision: '', individual_vision: '' }

  // Cache in memory store so the next check-in skips Opus entirely
  if (memberId) {
    void writeMemory(`/members/${memberId}/context.json`, JSON.stringify(result))
  }

  // Merge the latest Coach output on top of the fresh synthesis
  const merged = memberId ? await applyCoachOverride(result, memberId) : result
  const household_vision = await readHouseholdVision()
  const individual_vision = await readIndividualVision(memberId)
  return NextResponse.json({ ...merged, household_vision, individual_vision })
}
