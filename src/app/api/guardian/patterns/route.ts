import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { PATTERN_DETECTION_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type AttributedTurn = {
  speaker: number
  offset_ms: number
  text: string
  attributed_member_id: string | null
  attributed_name: string
  is_bea?: boolean
}

type RosterEntry = { member_id: string; name: string; consented?: boolean }

type GoalRow = {
  id: string
  owner_type: 'member' | 'whanau'
  owner_id: string | null
  title: string
  metric_key: string | null
  direction: 'decrease' | 'increase' | 'maintain' | null
  status: string
}

type PatternRow = {
  id: string
  scope: 'member' | 'whanau'
  subject_id: string | null
  kind: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'positive'
  confidence: number
  supporting_session_ids: string[]
  status: string
  last_seen_at: string
}

type ObservedMetric = { key: string; value: number; note?: string }

type PerMemberInsight = {
  tone?: string
  notable_moments?: string[]
  observed_metrics?: ObservedMetric[]
}

type WhanauInsight = PerMemberInsight & { dynamics?: string[] }

type PatternUpdate =
  | {
      action: 'reinforce'
      pattern_id: string
      confidence_delta?: number
      severity?: 'low' | 'medium' | 'high' | 'positive'
      note?: string
    }
  | {
      action: 'create'
      scope: 'member' | 'whanau'
      subject_id: string | null
      kind: string
      title: string
      description: string
      severity?: 'low' | 'medium' | 'high' | 'positive'
      confidence?: number
    }

type AgentOutput = {
  per_member: Record<string, PerMemberInsight>
  whanau: WhanauInsight
  pattern_updates: PatternUpdate[]
  summary: string
}

function formatTranscript(turns: AttributedTurn[]): string {
  return turns
    .map((t) => {
      const mm = Math.floor(t.offset_ms / 60000)
      const ss = Math.floor((t.offset_ms % 60000) / 1000)
      const stamp = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      const who = t.is_bea
        ? 'Bea'
        : t.attributed_name + (t.attributed_member_id ? ` (${t.attributed_member_id})` : '')
      return `[${stamp}] ${who}: ${t.text}`
    })
    .join('\n')
}

const SESSION_MILESTONES: Array<{ count: number; kind: string; title: string }> = [
  { count: 1, kind: 'sessions_count_1', title: 'First whānau session' },
  { count: 5, kind: 'sessions_count_5', title: '5 sessions together' },
  { count: 10, kind: 'sessions_count_10', title: '10 sessions together' },
  { count: 25, kind: 'sessions_count_25', title: '25 sessions together' },
  { count: 50, kind: 'sessions_count_50', title: '50 sessions together' },
]

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

  // ── load session ────────────────────────────────────────────────────────
  const { data: session, error: sessionErr } = await supabase
    .from('listening_sessions')
    .select('id, started_at, duration_secs, kind, roster, attributed_transcript, raw_transcript, status')
    .eq('id', session_id)
    .single()
  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const transcript = (session.attributed_transcript ?? session.raw_transcript ?? []) as AttributedTurn[]
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ error: 'No transcript on session' }, { status: 400 })
  }

  // Skip Bea's turns — she's not a family member.
  const familyTurns = transcript.filter((t) => !t.is_bea)
  const roster = (session.roster ?? []) as RosterEntry[]
  const consentedMemberIds = new Set(
    roster.filter((r) => r.consented !== false).map((r) => r.member_id),
  )

  // ── load active goals ──────────────────────────────────────────────────
  const { data: goalsRaw } = await supabase
    .from('goals')
    .select('id, owner_type, owner_id, title, metric_key, direction, status')
    .in('status', ['active'])
  const goals = (goalsRaw ?? []) as GoalRow[]

  // Goals only matter to the agent if they have a metric_key.
  const goalsWithMetrics = goals.filter((g) => !!g.metric_key)
  const memberGoalsByMember = new Map<string, GoalRow[]>()
  const whanauGoals: GoalRow[] = []
  for (const g of goalsWithMetrics) {
    if (g.owner_type === 'whanau') {
      whanauGoals.push(g)
    } else if (g.owner_id) {
      const arr = memberGoalsByMember.get(g.owner_id) ?? []
      arr.push(g)
      memberGoalsByMember.set(g.owner_id, arr)
    }
  }

  // ── load recent patterns (last 30 days, status new|discussed) ──────────
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: patternsRaw } = await supabase
    .from('patterns')
    .select(
      'id, scope, subject_id, kind, title, description, severity, confidence, supporting_session_ids, status, last_seen_at',
    )
    .in('status', ['new', 'discussed'])
    .gte('last_seen_at', sinceIso)
    .order('last_seen_at', { ascending: false })
    .limit(40)
  const recentPatterns = (patternsRaw ?? []) as PatternRow[]
  const patternById = new Map(recentPatterns.map((p) => [p.id, p]))

  // ── load members for naming ────────────────────────────────────────────
  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, name, role, status')
  const members = (membersRaw ?? []) as Array<{
    id: string
    name: string
    role: string
    status: string
  }>
  const memberNameById = new Map(members.map((m) => [m.id, m.name]))

  // ── build user message for Claude ──────────────────────────────────────
  const goalLines: string[] = []
  for (const g of goalsWithMetrics) {
    const owner =
      g.owner_type === 'whanau'
        ? 'whānau'
        : `${memberNameById.get(g.owner_id ?? '') ?? 'unknown'} (${g.owner_id})`
    goalLines.push(
      `- [${g.owner_type}] ${owner} → "${g.title}" | metric_key: ${g.metric_key} | direction: ${g.direction ?? 'n/a'}`,
    )
  }
  const goalsBlock = goalLines.length > 0 ? goalLines.join('\n') : '(no active goals with metrics)'

  const patternLines = recentPatterns.map((p) => {
    const subj =
      p.scope === 'whanau'
        ? 'whānau'
        : `${memberNameById.get(p.subject_id ?? '') ?? 'unknown'} (${p.subject_id})`
    return `- pattern_id: ${p.id} | scope: ${p.scope} | subject: ${subj} | kind: ${p.kind} | severity: ${p.severity} | confidence: ${p.confidence} | status: ${p.status}\n  title: ${p.title}\n  description: ${p.description}`
  })
  const patternsBlock =
    patternLines.length > 0 ? patternLines.join('\n') : '(no recent open patterns)'

  const rosterBlock =
    roster.length > 0
      ? roster.map((r) => `- ${r.name} (member_id: ${r.member_id})`).join('\n')
      : '(no roster recorded)'

  const sessionMeta = [
    `session_id: ${session.id}`,
    `started_at: ${session.started_at ?? 'unknown'}`,
    `duration_secs: ${session.duration_secs ?? 'unknown'}`,
    `kind: ${session.kind ?? 'passive'}`,
  ].join('\n')

  const userMessage = [
    `SESSION METADATA:`,
    sessionMeta,
    ``,
    `ROSTER:`,
    rosterBlock,
    ``,
    `ACTIVE GOALS (only emit observed_metrics whose key matches one of these for the right owner):`,
    goalsBlock,
    ``,
    `RECENT OPEN PATTERNS (use pattern_id when reinforcing; do not duplicate by creating new ones with similar themes):`,
    patternsBlock,
    ``,
    `ATTRIBUTED TRANSCRIPT (Bea's own turns are tagged "Bea" — ignore them; family turns include the speaker's member_id in parentheses):`,
    formatTranscript(familyTurns),
  ].join('\n')

  // ── call Claude ────────────────────────────────────────────────────────
  let output: AgentOutput
  let thinkingContent: string | null = null
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: PATTERN_DETECTION_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    let parsed: AgentOutput | null = null
    for (const block of response.content) {
      if (block.type === 'thinking') thinkingContent = block.thinking
      else if (block.type === 'text') parsed = JSON.parse(block.text) as AgentOutput
    }
    if (!parsed) throw new Error('No text block in response')
    output = parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[guardian/patterns] Claude call failed:', msg)
    return NextResponse.json(
      { error: 'Pattern agent failed', detail: msg },
      { status: 500 },
    )
  }

  // ── persist session_insights ──────────────────────────────────────────
  const { error: insightErr } = await supabase
    .from('session_insights')
    .upsert(
      {
        session_id: session.id,
        per_member: output.per_member ?? {},
        whanau: output.whanau ?? {},
        agent_thinking: thinkingContent,
      },
      { onConflict: 'session_id' },
    )
  if (insightErr) {
    console.error('[guardian/patterns] session_insights upsert failed:', insightErr)
  }

  // ── persist observations against active goals ─────────────────────────
  const observationRows: Array<{
    goal_id: string
    session_id: string
    value: number
    note: string | null
    observed_at: string
  }> = []

  const observedAt = session.started_at ?? new Date().toISOString()

  // Per-member metrics: only count if the member is on the consented roster
  // (or in the household at all — be permissive) and the metric_key matches
  // one of their active goals.
  for (const [memberId, insight] of Object.entries(output.per_member ?? {})) {
    if (!consentedMemberIds.has(memberId) && !memberNameById.has(memberId)) continue
    const memberGoals = memberGoalsByMember.get(memberId) ?? []
    for (const m of insight.observed_metrics ?? []) {
      const goal = memberGoals.find((g) => g.metric_key === m.key)
      if (!goal) continue
      observationRows.push({
        goal_id: goal.id,
        session_id: session.id,
        value: m.value,
        note: m.note ?? null,
        observed_at: observedAt,
      })
    }
  }

  // Whānau metrics
  for (const m of output.whanau?.observed_metrics ?? []) {
    const goal = whanauGoals.find((g) => g.metric_key === m.key)
    if (!goal) continue
    observationRows.push({
      goal_id: goal.id,
      session_id: session.id,
      value: m.value,
      note: m.note ?? null,
      observed_at: observedAt,
    })
  }

  if (observationRows.length > 0) {
    const { error: obsErr } = await supabase.from('observations').insert(observationRows)
    if (obsErr) console.error('[guardian/patterns] observations insert failed:', obsErr)
  }

  // ── apply pattern_updates ─────────────────────────────────────────────
  let patternsCreated = 0
  let patternsReinforced = 0
  for (const upd of output.pattern_updates ?? []) {
    if (upd.action === 'reinforce') {
      const existing = patternById.get(upd.pattern_id)
      if (!existing) continue
      const newConf = Math.max(
        0,
        Math.min(1, existing.confidence + (upd.confidence_delta ?? 0.1)),
      )
      const supporting = Array.from(
        new Set([...(existing.supporting_session_ids ?? []), session.id]),
      )
      const update: Record<string, unknown> = {
        confidence: newConf,
        last_seen_at: new Date().toISOString(),
        supporting_session_ids: supporting,
      }
      if (upd.severity) update.severity = upd.severity
      const { error } = await supabase.from('patterns').update(update).eq('id', existing.id)
      if (!error) patternsReinforced++
    } else if (upd.action === 'create') {
      // Validate scope/subject_id consistency.
      if (upd.scope === 'whanau' && upd.subject_id !== null) continue
      if (upd.scope === 'member' && (!upd.subject_id || !memberNameById.has(upd.subject_id))) {
        continue
      }
      const conf = Math.max(0, Math.min(0.4, upd.confidence ?? 0.3))
      const { error } = await supabase.from('patterns').insert({
        scope: upd.scope,
        subject_id: upd.scope === 'whanau' ? null : upd.subject_id,
        kind: upd.kind,
        title: upd.title,
        description: upd.description,
        severity: upd.severity ?? 'low',
        confidence: conf,
        supporting_session_ids: [session.id],
      })
      if (!error) patternsCreated++
    }
  }

  // ── milestones: count attributed sessions and award thresholds ────────
  // Counts whānau-level only; per-member milestones could be layered later.
  const { count } = await supabase
    .from('listening_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'attributed')

  if (typeof count === 'number') {
    for (const m of SESSION_MILESTONES) {
      if (count >= m.count) {
        await supabase
          .from('milestones')
          .insert({
            owner_type: 'whanau',
            owner_id: null,
            kind: m.kind,
            title: m.title,
            payload: { sessions_count: count, achieved_after_session_id: session.id },
          })
          .then(() => undefined, () => undefined) // unique-violation = already awarded
      }
    }
  }

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    observations_logged: observationRows.length,
    patterns_created: patternsCreated,
    patterns_reinforced: patternsReinforced,
    summary: output.summary,
  })
}
