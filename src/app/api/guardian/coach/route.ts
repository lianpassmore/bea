/**
 * Guardian — Coach
 *
 * Per (member, active goal), reasons about what — if anything — Bea should
 * bring to the next conversation. Runs between sessions with extended
 * thinking. Does NOT speak to the user; shapes what Bea listens for.
 *
 * Output is persisted to coach_reads with the full thinking trace and the
 * alternative drafts that were considered and rejected. This is the audit
 * surface — the Human Proxy Theory in working code.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { COACH_AGENT_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type GoalRow = {
  id: string
  owner_type: 'member' | 'whanau'
  owner_id: string | null
  title: string
  description: string | null
  metric_key: string | null
  direction: 'decrease' | 'increase' | 'maintain' | null
  baseline: number | null
  target: number | null
  status: string
  proposed_by: unknown
  created_at: string
}

type ObservationRow = {
  value: number
  note: string | null
  observed_at: string
  session_id: string | null
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
  status: string
  supporting_session_ids: string[]
  last_seen_at: string
}

type CheckInRow = {
  id: string
  started_at: string | null
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  reflection: string | null
}

type ListeningSummaryRow = {
  created_at: string | null
  individual_summary: string | null
  emotional_tone: string | null
  session: { id: string; started_at: string | null; reflection: string | null } | { id: string; started_at: string | null; reflection: string | null }[] | null
}

type PriorCoachRead = {
  created_at: string
  decision: string | null
  response: string | null
  rationale: string | null
}

type CoachAgentOutput = {
  agent_thinking?: string
  coach_read: {
    progress: 'moving' | 'stalled' | 'unclear' | 'too_early'
    user_felt_experience: string
    change_talk_present: boolean
    sustain_talk_dominant: boolean
  }
  next_session_guidance: {
    should_bea_raise_anything: boolean
    listening_priority: string
    listening_direction: string
    offer_to_raise: null | {
      kind: 'noticed_pattern' | 'noticed_correlation' | 'affirmation' | 'check_in_on_goal'
      draft_language: string
      reasoning: string
    }
    refocus_question: null | {
      draft_language: string
      evidence: string
      confidence: number
      reasoning: string
    }
  }
  considered_and_rejected?: Array<{ draft: string; why_not: string }>
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown date'
  return new Date(iso).toISOString().slice(0, 10)
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

function pickListeningSession(
  s: ListeningSummaryRow['session'],
): { id: string; started_at: string | null; reflection: string | null } | null {
  if (!s) return null
  if (Array.isArray(s)) return s[0] ?? null
  return s
}

export async function POST(request: NextRequest) {
  let body: {
    member_id: string
    goal_id: string
    session_id?: string
    check_in_id?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { member_id, goal_id, session_id, check_in_id } = body
  if (!member_id || !goal_id) {
    return NextResponse.json(
      { ok: false, error: 'member_id and goal_id are required' },
      { status: 400 },
    )
  }
  if (!session_id && !check_in_id) {
    return NextResponse.json(
      { ok: false, error: 'session_id or check_in_id must be provided so the coach_read can be tied to a source session' },
      { status: 400 },
    )
  }

  // ── load member ────────────────────────────────────────────────────────
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id, name')
    .eq('id', member_id)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 })
  }

  // ── load goal ──────────────────────────────────────────────────────────
  const { data: goalData, error: goalErr } = await supabase
    .from('goals')
    .select('id, owner_type, owner_id, title, description, metric_key, direction, baseline, target, status, proposed_by, created_at')
    .eq('id', goal_id)
    .single()

  if (goalErr || !goalData) {
    return NextResponse.json({ ok: false, error: 'Goal not found' }, { status: 404 })
  }
  const goal = goalData as GoalRow

  // The goal must belong to this member, or be a whānau-wide goal.
  if (goal.owner_type === 'member' && goal.owner_id !== member_id) {
    return NextResponse.json(
      { ok: false, error: 'Goal does not belong to this member' },
      { status: 400 },
    )
  }

  // ── observations against this goal (last 30 days) ─────────────────────
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: obsRaw } = await supabase
    .from('observations')
    .select('value, note, observed_at, session_id')
    .eq('goal_id', goal_id)
    .gte('observed_at', since30)
    .order('observed_at', { ascending: true })
  const observations = (obsRaw ?? []) as ObservationRow[]

  // ── patterns touching this member (last 30 days, open) ────────────────
  const { data: patternsRaw } = await supabase
    .from('patterns')
    .select('id, scope, subject_id, kind, title, description, severity, confidence, status, supporting_session_ids, last_seen_at')
    .in('status', ['new', 'discussed'])
    .gte('last_seen_at', since30)
    .or(`and(scope.eq.member,subject_id.eq.${member_id}),scope.eq.whanau`)
    .order('last_seen_at', { ascending: false })
    .limit(20)
  const patterns = (patternsRaw ?? []) as PatternRow[]

  // ── recent 1:1 check-ins for this member (last 14 days) ───────────────
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: checkInsRaw } = await supabase
    .from('check_ins')
    .select('id, started_at, individual_summary, individual_themes, emotional_tone, reflection')
    .eq('member_id', member_id)
    .gte('started_at', since14)
    .order('started_at', { ascending: false })
    .limit(10)
  const checkIns = (checkInsRaw ?? []) as CheckInRow[]

  // ── recent group session per-member summaries (last 14 days) ──────────
  const { data: groupRaw } = await supabase
    .from('listening_member_summaries')
    .select('created_at, individual_summary, emotional_tone, session:listening_sessions(id, started_at, reflection)')
    .eq('member_id', member_id)
    .gte('created_at', since14)
    .order('created_at', { ascending: false })
    .limit(10)
  const groupSummaries = (groupRaw ?? []) as ListeningSummaryRow[]

  // ── prior coach_reads for this member, this goal (last 14 days) ───────
  const { data: priorRaw } = await supabase
    .from('coach_reads')
    .select('created_at, decision, response, rationale')
    .eq('member_id', member_id)
    .gte('created_at', since14)
    .order('created_at', { ascending: false })
    .limit(5)
  const priorCoachReads = (priorRaw ?? []) as PriorCoachRead[]

  // ── build user message ────────────────────────────────────────────────
  const goalBlock = [
    `Title: "${goal.title}"`,
    goal.description ? `Description: ${goal.description}` : null,
    `Owner: ${goal.owner_type === 'whanau' ? 'whānau' : member.name + ' (' + member_id + ')'}`,
    `metric_key: ${goal.metric_key ?? 'none'}`,
    `direction: ${goal.direction ?? 'n/a'}`,
    `baseline: ${goal.baseline ?? 'n/a'}`,
    `target: ${goal.target ?? 'n/a'}`,
    `status: ${goal.status}`,
    `proposed at: ${fmtDate(goal.created_at)}`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  const observationsBlock =
    observations.length > 0
      ? observations
          .map(
            (o) =>
              `- ${fmtDate(o.observed_at)} | value=${o.value}${o.note ? ` | note: ${o.note}` : ''}${
                o.session_id ? ` | session_id=${o.session_id}` : ''
              }`,
          )
          .join('\n')
      : '(no observations against this goal in the last 30 days)'

  const patternsBlock =
    patterns.length > 0
      ? patterns
          .map(
            (p) =>
              `- pattern_id=${p.id} | scope=${p.scope} | kind=${p.kind} | severity=${p.severity} | confidence=${p.confidence} | status=${p.status}\n  title: ${p.title}\n  description: ${p.description}\n  last_seen: ${fmtDate(p.last_seen_at)}`,
          )
          .join('\n')
      : '(no recent open patterns touching this member)'

  const checkInsBlock =
    checkIns.length > 0
      ? checkIns
          .map((c, i) =>
            [
              `[1:1 CHECK-IN ${i + 1}] ${fmtDate(c.started_at)} (check_in_id=${c.id})`,
              `  Themes: ${c.individual_themes?.join(', ') ?? '(none)'}`,
              `  Tone: ${c.emotional_tone ?? '(unknown)'}`,
              c.individual_summary ? `  Summary: ${c.individual_summary}` : null,
              c.reflection ? `  Bea's reflection (already said): ${c.reflection}` : null,
            ]
              .filter((l): l is string => l !== null)
              .join('\n'),
          )
          .join('\n\n')
      : '(no 1:1 check-ins in the last 14 days)'

  const groupBlock =
    groupSummaries.length > 0
      ? groupSummaries
          .map((g, i) => {
            const sess = pickListeningSession(g.session)
            return [
              `[GROUP SESSION ${i + 1}] ${fmtDate(sess?.started_at ?? g.created_at)} (session_id=${sess?.id ?? 'unknown'})`,
              `  Tone: ${g.emotional_tone ?? '(unknown)'}`,
              g.individual_summary ? `  Per-member summary: ${g.individual_summary}` : null,
              sess?.reflection ? `  Bea's reflection (already said): ${sess.reflection}` : null,
            ]
              .filter((l): l is string => l !== null)
              .join('\n')
          })
          .join('\n\n')
      : '(no group sessions involving this member in the last 14 days)'

  const priorBlock =
    priorCoachReads.length > 0
      ? priorCoachReads
          .map(
            (p) =>
              `- ${fmtDate(p.created_at)} | decision=${p.decision ?? 'n/a'}${
                p.response ? ` | said: "${p.response}"` : ''
              }${p.rationale ? ` | because: ${p.rationale}` : ''}`,
          )
          .join('\n')
      : '(no prior coach reads in the last 14 days)'

  const userMessage = [
    `MEMBER: ${member.name} (${member_id})`,
    ``,
    `ACTIVE GOAL:`,
    goalBlock,
    ``,
    `OBSERVATIONS AGAINST THIS GOAL (chronological, last 30 days):`,
    observationsBlock,
    ``,
    `RECENT OPEN PATTERNS TOUCHING THIS MEMBER (last 30 days):`,
    patternsBlock,
    ``,
    `RECENT 1:1 CHECK-INS (last 14 days, newest first):`,
    checkInsBlock,
    ``,
    `RECENT GROUP SESSIONS WHERE THIS MEMBER WAS PRESENT (last 14 days, newest first):`,
    groupBlock,
    ``,
    `PRIOR COACH DECISIONS for this member (last 14 days, newest first) — DO NOT REPEAT a draft Bea has already used:`,
    priorBlock,
    ``,
    `Now reason carefully — using extended thinking — about what, if anything, Bea should bring to ${member.name}'s next conversation about this goal. Output the JSON object exactly as specified in your system prompt.`,
  ].join('\n')

  // ── call Claude ────────────────────────────────────────────────────────
  let output: CoachAgentOutput
  let thinkingContent: string | null = null
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: COACH_AGENT_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    let parsed: CoachAgentOutput | null = null
    for (const block of response.content) {
      if (block.type === 'thinking') thinkingContent = block.thinking
      else if (block.type === 'text') parsed = JSON.parse(stripJsonFence(block.text)) as CoachAgentOutput
    }
    if (!parsed) throw new Error('No text block in Coach response')
    output = parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[guardian/coach] Claude call failed:', msg)
    return NextResponse.json({ ok: false, error: 'Coach agent failed', detail: msg }, { status: 500 })
  }

  // ── derive coach_reads row from agent output ─────────────────────────
  const guidance = output.next_session_guidance
  const offer = guidance?.offer_to_raise ?? null
  const refocus = guidance?.refocus_question ?? null

  let decision: 'raise' | 'wait' | 'note' = 'wait'
  let response: string | null = null
  let rationale: string | null = null

  if (guidance?.should_bea_raise_anything && (offer || refocus)) {
    decision = 'raise'
    if (offer) {
      response = offer.draft_language
      rationale = offer.reasoning
    } else if (refocus) {
      response = refocus.draft_language
      rationale = refocus.reasoning
    }
  } else if (guidance?.listening_priority || guidance?.listening_direction) {
    // Coach has a listening direction even when not raising — record as 'note'.
    decision = 'note'
    rationale = [guidance?.listening_priority, guidance?.listening_direction]
      .filter((s): s is string => !!s)
      .join(' / ')
  }

  // Prefer the agent's own narrative thinking trace; fall back to the model's
  // summarized thinking block if the agent didn't return one.
  const agentThinking = output.agent_thinking?.trim() || thinkingContent || null

  // ── persist ───────────────────────────────────────────────────────────
  const { data: insertData, error: insertErr } = await supabase
    .from('coach_reads')
    .insert({
      session_id: session_id ?? null,
      check_in_id: check_in_id ?? null,
      member_id,
      decision,
      response,
      rationale,
      agent_thinking: agentThinking,
      considered_and_rejected: output.considered_and_rejected ?? [],
    })
    .select('id')
    .single()

  if (insertErr || !insertData) {
    console.error('[guardian/coach] coach_reads insert failed:', insertErr)
    return NextResponse.json(
      { ok: false, error: 'Failed to persist coach_read', detail: insertErr?.message ?? null },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    coach_read_id: insertData.id,
    decision,
    coach_read: output.coach_read,
    next_session_guidance: output.next_session_guidance,
    considered_and_rejected: output.considered_and_rejected ?? [],
  })
}
