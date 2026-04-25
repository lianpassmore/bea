import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import type {
  AgentTrace,
  Decision,
  SelectedSession,
  SessionFilter,
  SessionListItem,
} from './types'

type CheckInRow = {
  id: string
  started_at: string | null
  member_id: string | null
  individual_summary: string | null
  emotional_tone: string | null
  reflection: string | null
  reflection_original: string | null
  tikanga_evaluation: unknown
  wellbeing_level: string | null
  wellbeing_signals: unknown
  wellbeing_note: string | null
  wellbeing_escalate: boolean | null
  individual_themes: unknown
  suggested_focus: string | null
  family_summary: string | null
  family_pulse: string | null
  absence_observed: string | null
  absence_confidence: string | null
  crisis_detected: boolean | null
  crisis_level: string | null
  crisis_signals: unknown
  crisis_reasoning: string | null
  crisis_in_session_response: string | null
  crisis_briefing_for_contact: string | null
  crisis_agent_thinking: string | null
  guardian_thinking: string | null
  transcript: unknown
}

type ListeningSessionRow = {
  id: string
  started_at: string | null
  kind: 'passive' | 'guided' | null
  status: string | null
  roster: unknown
  raw_transcript: unknown
  attributed_transcript: unknown
  speaker_map: unknown
  family_summary: string | null
  family_themes: string[] | null
  family_tone: string | null
  family_pulse: string | null
  attribution_reasoning: string | null
  guardian_thinking: string | null
}

type MemberRow = { id: string; name: string }

type ListeningMemberSummaryRow = {
  id: string
  session_id: string
  member_id: string
  member_name: string
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  suggested_focus: string | null
  reflection: string | null
}

type SessionInsightRow = {
  id: string
  session_id: string
  per_member: unknown
  whanau: unknown
  agent_thinking: string | null
  created_at: string
}

type CrisisNotificationRow = {
  id: string
  check_in_id: string
  affected_member_id: string | null
  contact_member_id: string | null
  crisis_level: string
  briefing: string
  seen_at: string | null
  created_at: string
}

type CoachReadRow = {
  id: string
  session_id: string | null
  check_in_id: string | null
  member_id: string | null
  decision: string | null
  response: string | null
  rationale: string | null
  agent_thinking: string | null
  considered_and_rejected: unknown
  created_at: string
}

type FamilyInsightRow = {
  id: string
  created_at: string
  family_pulse: string | null
  thriving: unknown
  under_pressure: unknown
  recurring_patterns: unknown
  worth_attention: string | null
  session_count: number | null
  guardian_thinking: string | null
  silence_decision: string | null
  silence_reason: string | null
  silence_evaluation: unknown
  wait_until: string | null
  tikanga_evaluation: unknown
  insight_original: unknown
}

const oneLine = (s: string | null | undefined, max = 90) => {
  if (!s) return null
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

// Sessions that started within this window are considered "in progress" — if
// an expected output column is still null we render a "thinking..." indicator
// on the relevant agent card.
const FRESH_WINDOW_MS = 5 * 60 * 1000

const isFreshNow = (iso: string | null | undefined) => {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < FRESH_WINDOW_MS
}

const isEmpty = (v: unknown) => {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

// 1:1 transcripts are stored as jsonb — typically the ElevenLabs shape
// `[{ role, message, ... }]`. Render to a plain-text string for previews.
const transcriptToText = (t: unknown): string | null => {
  if (!t) return null
  if (typeof t === 'string') return t
  if (Array.isArray(t)) {
    const lines = t
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const r = row as Record<string, unknown>
        const speaker =
          (r.role as string | undefined) ??
          (r.speaker as string | undefined) ??
          (r.member_name as string | undefined) ??
          ''
        const message =
          (r.message as string | undefined) ??
          (r.text as string | undefined) ??
          (r.content as string | undefined) ??
          ''
        if (!message) return null
        return speaker ? `${speaker}: ${message}` : message
      })
      .filter((s): s is string => !!s)
    return lines.length > 0 ? lines.join('\n') : null
  }
  try {
    return JSON.stringify(t)
  } catch {
    return null
  }
}

export async function loadSessionList(
  filter: SessionFilter,
): Promise<SessionListItem[]> {
  const [checkInsRes, sessionsRes, insightsRes, membersRes] = await Promise.all([
    supabase
      .from('check_ins')
      .select(
        'id, started_at, member_id, individual_summary, reflection, reflection_original, tikanga_evaluation, crisis_detected, crisis_level',
      )
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('listening_sessions')
      .select(
        'id, started_at, kind, family_summary, roster',
      )
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('family_insights')
      .select(
        'id, created_at, family_pulse, worth_attention, tikanga_evaluation, insight_original',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('members').select('id, name'),
  ])

  const memberById = new Map<string, string>()
  for (const m of (membersRes.data ?? []) as MemberRow[]) memberById.set(m.id, m.name)

  const checkInItems: SessionListItem[] = (
    (checkInsRes.data ?? []) as Array<
      Pick<
        CheckInRow,
        | 'id'
        | 'started_at'
        | 'member_id'
        | 'individual_summary'
        | 'reflection'
        | 'reflection_original'
        | 'tikanga_evaluation'
        | 'crisis_detected'
        | 'crisis_level'
      >
    >
  ).map((r) => {
    const memberName = r.member_id ? memberById.get(r.member_id) ?? null : null
    const tikangaRewrite = !!(
      r.reflection_original &&
      r.reflection &&
      r.reflection_original !== r.reflection
    )
    return {
      id: `checkin:${r.id}`,
      kind: 'individual',
      startedAt: r.started_at!,
      memberNames: memberName ? [memberName] : [],
      oneLine: oneLine(r.individual_summary ?? r.reflection),
      hasCrisis: !!(r.crisis_detected || r.crisis_level),
      hasTikangaRewrite: tikangaRewrite,
      isFresh: isFreshNow(r.started_at),
    }
  })

  const sessionRows = (sessionsRes.data ?? []) as Array<
    Pick<ListeningSessionRow, 'id' | 'started_at' | 'kind' | 'family_summary' | 'roster'>
  >

  const sessionItems: SessionListItem[] = sessionRows.map((s) => {
    const roster = Array.isArray(s.roster) ? (s.roster as Array<{ name?: string }>) : []
    const names = roster.map((r) => r?.name).filter((n): n is string => !!n)
    return {
      id: `session:${s.id}`,
      kind: s.kind === 'guided' ? 'guided' : 'passive',
      startedAt: s.started_at!,
      memberNames: names,
      oneLine: oneLine(s.family_summary),
      hasCrisis: false,
      hasTikangaRewrite: false,
      isFresh: isFreshNow(s.started_at),
    }
  })

  type InsightListRow = Pick<
    FamilyInsightRow,
    | 'id'
    | 'created_at'
    | 'family_pulse'
    | 'worth_attention'
    | 'tikanga_evaluation'
    | 'insight_original'
  >
  const insightItems: SessionListItem[] = (
    (insightsRes.data ?? []) as InsightListRow[]
  ).map((row) => {
    const tikangaRewrite =
      !!row.insight_original &&
      !!row.tikanga_evaluation &&
      JSON.stringify(row.insight_original) !== '{}' &&
      JSON.stringify(row.tikanga_evaluation) !== '{}'
    return {
      id: `insight:${row.id}`,
      kind: 'family-insight',
      startedAt: row.created_at,
      memberNames: [],
      oneLine: oneLine(row.family_pulse ?? row.worth_attention),
      hasCrisis: false,
      hasTikangaRewrite: tikangaRewrite,
      isFresh: isFreshNow(row.created_at),
    }
  })

  const merged = [...checkInItems, ...sessionItems, ...insightItems].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

  switch (filter) {
    case 'individual':
      return merged.filter((m) => m.kind === 'individual')
    case 'guided':
      return merged.filter((m) => m.kind === 'guided')
    case 'passive':
      return merged.filter((m) => m.kind === 'passive')
    case 'family-insight':
      return merged.filter((m) => m.kind === 'family-insight')
    case 'has-crisis':
      return merged.filter((m) => m.hasCrisis)
    case 'has-tikanga':
      return merged.filter((m) => m.hasTikangaRewrite)
    default:
      return merged
  }
}

const traceFromText = (
  thinking: string | null | undefined,
): AgentTrace['thinking'] => (thinking && thinking.trim() ? thinking : null)

export async function loadSelectedSession(
  rawId: string | null,
): Promise<SelectedSession | null> {
  if (!rawId) return null
  const [prefix, id] = rawId.split(':')
  if (!prefix || !id) return null
  if (prefix === 'checkin') return loadCheckInSession(id)
  if (prefix === 'session') return loadListeningSession(id)
  if (prefix === 'insight') return loadFamilyInsight(id)
  return null
}

async function loadCheckInSession(id: string): Promise<SelectedSession | null> {
  const { data: ci, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[dev/reasoning] check_ins fetch:', error)
    return null
  }
  if (!ci) return null

  const checkIn = ci as CheckInRow

  const memberPromise = checkIn.member_id
    ? supabase
        .from('members')
        .select('id, name')
        .eq('id', checkIn.member_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [memberRes, crisisRes, coachRes] = await Promise.all([
    memberPromise,
    supabase
      .from('crisis_notifications')
      .select('*')
      .eq('check_in_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('coach_reads')
      .select('*')
      .eq('check_in_id', id)
      .order('created_at', { ascending: true }),
  ])

  const memberRow = memberRes.data as MemberRow | null
  const crisisRows = (crisisRes.data ?? []) as CrisisNotificationRow[]
  const coachRows = (coachRes.data ?? []) as CoachReadRow[]

  const tikangaRewrite =
    !!checkIn.reflection_original &&
    !!checkIn.reflection &&
    checkIn.reflection_original !== checkIn.reflection

  const fresh = isFreshNow(checkIn.started_at)

  const agents: AgentTrace[] = []

  // G1 Summarise
  const summariseOutput = {
    individual_summary: checkIn.individual_summary,
    themes: checkIn.individual_themes,
    emotional_tone: checkIn.emotional_tone,
    family_pulse: checkIn.family_pulse,
    suggested_focus: checkIn.suggested_focus,
    family_summary: checkIn.family_summary,
  }
  agents.push({
    agent: 'Summarise (G1)',
    model: 'claude-opus-4-7',
    thinkingEnabled: !!checkIn.guardian_thinking,
    inputSummary: oneLine(transcriptToText(checkIn.transcript)),
    output: summariseOutput,
    thinking: traceFromText(checkIn.guardian_thinking),
    pending: fresh && isEmpty(checkIn.individual_summary),
  })

  // G3 Wellbeing
  agents.push({
    agent: 'Wellbeing (G3)',
    model: 'claude-opus-4-7',
    thinkingEnabled: false,
    inputSummary: oneLine(transcriptToText(checkIn.transcript)),
    output: {
      wellbeing_level: checkIn.wellbeing_level,
      wellbeing_signals: checkIn.wellbeing_signals,
      wellbeing_note: checkIn.wellbeing_note,
      escalate: checkIn.wellbeing_escalate,
    },
    thinking: null,
    overrideNote:
      checkIn.crisis_level && checkIn.crisis_level !== 'watchful'
        ? 'Escalated to Crisis (G10).'
        : null,
    pending: fresh && isEmpty(checkIn.wellbeing_level),
  })

  // G4 Reflect (+ G7 Tikanga embedded)
  agents.push({
    agent: 'Reflect (G4)',
    model: 'claude-opus-4-7',
    thinkingEnabled: false,
    inputSummary: oneLine(transcriptToText(checkIn.transcript)),
    output: {
      reflection: checkIn.reflection,
      reflection_original: checkIn.reflection_original,
    },
    thinking: null,
    overrideNote: tikangaRewrite
      ? 'Reflection rewritten by Tikanga (G7).'
      : checkIn.crisis_level === 'concerned' || checkIn.crisis_level === 'urgent'
        ? 'Reflection replaced by Crisis (G10).'
        : null,
    pending: fresh && isEmpty(checkIn.reflection),
  })

  // G7 Tikanga
  agents.push({
    agent: 'Tikanga (G7)',
    model: 'claude-opus-4-7',
    thinkingEnabled: false,
    inputSummary: oneLine(checkIn.reflection_original ?? checkIn.reflection),
    output: checkIn.tikanga_evaluation ?? null,
    thinking: null,
    pending: fresh && isEmpty(checkIn.tikanga_evaluation),
  })

  // G9 Absence — internal-only output. Surface here for the audit.
  if (
    checkIn.absence_observed ||
    checkIn.absence_confidence ||
    fresh
  ) {
    agents.push({
      agent: 'Absence (G9)',
      model: 'claude-opus-4-7',
      thinkingEnabled: false,
      inputSummary: oneLine(transcriptToText(checkIn.transcript)),
      output: {
        absence_observed: checkIn.absence_observed,
        absence_confidence: checkIn.absence_confidence,
      },
      thinking: null,
      pending: fresh && isEmpty(checkIn.absence_observed),
    })
  }

  // G10 Crisis (only if it ran)
  if (checkIn.crisis_detected || checkIn.crisis_level || checkIn.crisis_reasoning) {
    agents.push({
      agent: 'Crisis (G10)',
      model: 'claude-opus-4-7',
      thinkingEnabled: !!checkIn.crisis_agent_thinking,
      inputSummary: oneLine(transcriptToText(checkIn.transcript)),
      output: {
        crisis_level: checkIn.crisis_level,
        crisis_signals: checkIn.crisis_signals,
        crisis_reasoning: checkIn.crisis_reasoning,
        crisis_in_session_response: checkIn.crisis_in_session_response,
        crisis_briefing_for_contact: checkIn.crisis_briefing_for_contact,
        notifications_created: crisisRows.length,
      },
      thinking: traceFromText(checkIn.crisis_agent_thinking),
    })
  }

  // Coach (new agent)
  for (const cr of coachRows) {
    agents.push({
      agent: 'Coach',
      model: 'claude-opus-4-7',
      thinkingEnabled: !!cr.agent_thinking,
      inputSummary: cr.rationale ? oneLine(cr.rationale) : null,
      output: {
        decision: cr.decision,
        response: cr.response,
        rationale: cr.rationale,
        considered_and_rejected: cr.considered_and_rejected ?? null,
      },
      thinking: traceFromText(cr.agent_thinking),
    })
  }
  if (coachRows.length === 0 && fresh) {
    agents.push({
      agent: 'Coach',
      model: 'claude-opus-4-7',
      thinkingEnabled: false,
      inputSummary: null,
      output: null,
      thinking: null,
      pending: true,
    })
  }

  const decisions: Decision[] = []
  decisions.push({
    label: 'Reflection',
    detail: tikangaRewrite
      ? 'Written, then rewritten by Tikanga (G7).'
      : checkIn.crisis_level === 'concerned' || checkIn.crisis_level === 'urgent'
        ? 'Replaced by Crisis (G10).'
        : checkIn.reflection
          ? 'Written, surfaced.'
          : 'Not written.',
    anchor: 'agent-reflect-g4',
  })
  decisions.push({
    label: 'Wellbeing',
    detail: checkIn.wellbeing_level ?? 'unknown',
    anchor: 'agent-wellbeing-g3',
  })
  decisions.push({
    label: 'Crisis',
    detail: checkIn.crisis_level
      ? `${checkIn.crisis_level} — ${crisisRows.length} contact${crisisRows.length === 1 ? '' : 's'} notified`
      : 'not flagged',
    anchor: 'agent-crisis-g10',
  })
  if (coachRows.length > 0) {
    const cr = coachRows[coachRows.length - 1]
    decisions.push({
      label: 'Coach',
      detail: cr.decision
        ? `${cr.decision}${cr.response ? ` — "${oneLine(cr.response, 60)}"` : ''}`
        : 'recorded a note',
      anchor: 'agent-coach',
    })
  }

  return {
    id: `checkin:${id}`,
    kind: 'individual',
    startedAt: checkIn.started_at ?? new Date().toISOString(),
    memberNames: memberRow ? [memberRow.name] : [],
    agents,
    decisions,
    tikangaSideBySide: tikangaRewrite
      ? {
          original: checkIn.reflection_original!,
          rewritten: checkIn.reflection!,
          evaluation: checkIn.tikanga_evaluation,
        }
      : null,
  }
}

async function loadListeningSession(id: string): Promise<SelectedSession | null> {
  const { data: s, error } = await supabase
    .from('listening_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[dev/reasoning] listening_sessions fetch:', error)
    return null
  }
  if (!s) return null

  const session = s as ListeningSessionRow

  const [summariesRes, insightsRes, coachRes] = await Promise.all([
    supabase
      .from('listening_member_summaries')
      .select('*')
      .eq('session_id', id),
    supabase
      .from('session_insights')
      .select('*')
      .eq('session_id', id)
      .maybeSingle(),
    supabase
      .from('coach_reads')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ])

  const memberSummaries = (summariesRes.data ?? []) as ListeningMemberSummaryRow[]
  const insight = (insightsRes.data ?? null) as SessionInsightRow | null
  const coachRows = (coachRes.data ?? []) as CoachReadRow[]

  const roster = Array.isArray(session.roster)
    ? (session.roster as Array<{ name?: string }>)
    : []
  const memberNames = roster
    .map((r) => r?.name)
    .filter((n): n is string => !!n)

  const agents: AgentTrace[] = []

  const fresh = isFreshNow(session.started_at)

  // G11 Group
  const transcriptForSummary = Array.isArray(session.raw_transcript)
    ? (session.raw_transcript as Array<{ text?: string }>)
        .map((t) => t?.text)
        .filter(Boolean)
        .join(' ')
    : null

  agents.push({
    agent: 'Group (G11)',
    model: 'claude-opus-4-7',
    thinkingEnabled: !!session.guardian_thinking,
    inputSummary: oneLine(transcriptForSummary),
    output: {
      speaker_map: session.speaker_map,
      family_summary: session.family_summary,
      family_themes: session.family_themes,
      family_tone: session.family_tone,
      family_pulse: session.family_pulse,
      attribution_reasoning: session.attribution_reasoning,
      per_member_count: memberSummaries.length,
    },
    thinking: traceFromText(session.guardian_thinking),
    pending:
      fresh &&
      session.status !== 'attributed' &&
      isEmpty(session.family_summary),
  })

  // Per-member summaries (collapsed under one card so the timeline doesn't bloat)
  if (memberSummaries.length > 0) {
    agents.push({
      agent: 'Per-member summaries',
      model: 'claude-opus-4-7',
      thinkingEnabled: false,
      inputSummary: `${memberSummaries.length} member${memberSummaries.length === 1 ? '' : 's'}`,
      output: memberSummaries.map((m) => ({
        member: m.member_name,
        individual_summary: m.individual_summary,
        themes: m.individual_themes,
        emotional_tone: m.emotional_tone,
        suggested_focus: m.suggested_focus,
        reflection: m.reflection,
      })),
      thinking: null,
    })
  }

  // Pattern detection
  if (insight) {
    agents.push({
      agent: 'Patterns',
      model: 'claude-opus-4-7',
      thinkingEnabled: !!insight.agent_thinking,
      inputSummary: oneLine(session.family_summary),
      output: {
        per_member: insight.per_member,
        whanau: insight.whanau,
      },
      thinking: traceFromText(insight.agent_thinking),
    })
  } else if (fresh && session.status === 'attributed') {
    agents.push({
      agent: 'Patterns',
      model: 'claude-opus-4-7',
      thinkingEnabled: false,
      inputSummary: null,
      output: null,
      thinking: null,
      pending: true,
    })
  }

  // Coach
  for (const cr of coachRows) {
    agents.push({
      agent: 'Coach',
      model: 'claude-opus-4-7',
      thinkingEnabled: !!cr.agent_thinking,
      inputSummary: cr.rationale ? oneLine(cr.rationale) : null,
      output: {
        decision: cr.decision,
        response: cr.response,
        rationale: cr.rationale,
        considered_and_rejected: cr.considered_and_rejected ?? null,
      },
      thinking: traceFromText(cr.agent_thinking),
    })
  }
  if (coachRows.length === 0 && fresh) {
    agents.push({
      agent: 'Coach',
      model: 'claude-opus-4-7',
      thinkingEnabled: false,
      inputSummary: null,
      output: null,
      thinking: null,
      pending: true,
    })
  }

  const decisions: Decision[] = []
  decisions.push({
    label: 'Attribution',
    detail: session.speaker_map
      ? `${Object.keys(session.speaker_map as Record<string, unknown>).length} speakers mapped`
      : 'not yet attributed',
    anchor: 'agent-group-g11',
  })
  decisions.push({
    label: 'Patterns',
    detail: insight ? 'session insight written' : 'not yet run',
    anchor: 'agent-patterns',
  })
  if (coachRows.length > 0) {
    const cr = coachRows[coachRows.length - 1]
    decisions.push({
      label: 'Coach',
      detail: cr.decision
        ? `${cr.decision}${cr.response ? ` — "${oneLine(cr.response, 60)}"` : ''}`
        : 'recorded a note',
      anchor: 'agent-coach',
    })
  }

  return {
    id: `session:${id}`,
    kind: session.kind === 'guided' ? 'guided' : 'passive',
    startedAt: session.started_at ?? new Date().toISOString(),
    memberNames,
    agents,
    decisions,
    tikangaSideBySide: null,
  }
}

async function loadFamilyInsight(id: string): Promise<SelectedSession | null> {
  const { data, error } = await supabase
    .from('family_insights')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[dev/reasoning] family_insights fetch:', error)
    return null
  }
  if (!data) return null

  const insight = data as FamilyInsightRow

  // Tikanga rewrite detection: if the insight_original differs from the live
  // family_pulse / structured fields, G7 changed the output.
  const tikangaRewrote =
    !!insight.insight_original &&
    !!insight.tikanga_evaluation &&
    JSON.stringify(insight.insight_original) !== '{}' &&
    JSON.stringify(insight.tikanga_evaluation) !== '{}'

  const finalInsight = {
    family_pulse: insight.family_pulse,
    thriving: insight.thriving,
    under_pressure: insight.under_pressure,
    recurring_patterns: insight.recurring_patterns,
    worth_attention: insight.worth_attention,
    session_count: insight.session_count,
  }

  const agents: AgentTrace[] = []

  // G5 Insight
  agents.push({
    agent: 'Insight (G5)',
    model: 'claude-opus-4-7',
    thinkingEnabled: !!insight.guardian_thinking,
    inputSummary: `Read across ${insight.session_count ?? '?'} sessions`,
    output: tikangaRewrote ? insight.insight_original : finalInsight,
    thinking: traceFromText(insight.guardian_thinking),
  })

  // G7 Tikanga (on insight)
  agents.push({
    agent: 'Tikanga (G7)',
    model: 'claude-opus-4-7',
    thinkingEnabled: false,
    inputSummary: 'Validating G5 insight',
    output: insight.tikanga_evaluation ?? null,
    thinking: null,
  })

  // G6 Silence
  agents.push({
    agent: 'Silence (G6)',
    model: 'claude-opus-4-7',
    thinkingEnabled: false,
    inputSummary: 'Should the family see this?',
    output: {
      decision: insight.silence_decision,
      reason: insight.silence_reason,
      wait_until: insight.wait_until,
      evaluation: insight.silence_evaluation,
    },
    thinking: null,
    overrideNote:
      insight.silence_decision && insight.silence_decision !== 'surface'
        ? `Decision: ${insight.silence_decision} — hidden from dashboard.`
        : null,
  })

  const decisions: Decision[] = [
    {
      label: 'Insight',
      detail: tikangaRewrote
        ? 'Written, then rewritten by Tikanga (G7).'
        : 'Written.',
      anchor: 'agent-insight-g5',
    },
    {
      label: 'Silence',
      detail: insight.silence_decision ?? 'unknown',
      anchor: 'agent-silence-g6',
    },
  ]

  return {
    id: `insight:${id}`,
    kind: 'family-insight',
    startedAt: insight.created_at,
    memberNames: [],
    agents,
    decisions,
    tikangaSideBySide: tikangaRewrote
      ? {
          original: JSON.stringify(insight.insight_original, null, 2),
          rewritten: JSON.stringify(finalInsight, null, 2),
          evaluation: insight.tikanga_evaluation,
        }
      : null,
  }
}
