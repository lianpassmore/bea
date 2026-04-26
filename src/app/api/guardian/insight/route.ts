import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_INSIGHT_PROMPT } from '@/lib/prompts'

// Insight runs Opus 4.7 then chains tikanga + silence + perspective — needs room.
export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CACHE_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours — reuse perspective memos younger than this
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days — the synthesis window

type ActiveMember = {
  id: string
  name: string
  role: string | null
}

type MemberBlock = {
  name: string
  role: string | null
  memo: string
  recent_tones: string[]
  wellbeing_flags: { amber: number; red: number }
}

type InsightOutput = {
  family_pulse: string
  thriving: string[]
  under_pressure: string[]
  recurring_patterns: string[]
  worth_attention: string
  session_count: number
}

type TikangaConcern = { pou: string; concern: string }
type TikangaEvaluation =
  | { tikanga_pass: boolean; tikanga_concerns: TikangaConcern[]; tikanga_rewrite: string | null }
  | { tikanga_pass: null; error: string; original_preserved: true }

// Fail-open wrapper around Guardian 7. Never throws.
async function runTikanga(draft: string, context: string, baseUrl: string): Promise<TikangaEvaluation> {
  try {
    const res = await fetch(`${baseUrl}/api/guardian/tikanga`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, context }),
    })
    const data = await res.json()
    if (!data.ok) {
      return {
        tikanga_pass: null,
        error: data.error ?? 'Tikanga route returned not-ok',
        original_preserved: true,
      }
    }
    return {
      tikanga_pass: data.tikanga_pass,
      tikanga_concerns: data.tikanga_concerns ?? [],
      tikanga_rewrite: data.tikanga_rewrite ?? null,
    }
  } catch (err) {
    return {
      tikanga_pass: null,
      error: err instanceof Error ? err.message : 'Unknown tikanga error',
      original_preserved: true,
    }
  }
}

function formatSilenceContext(
  activeMemberCount: number,
  perMember: MemberBlock[],
  lastCheckInAgoLabel: string | null,
): string {
  const mostRecentTone =
    perMember.flatMap((m) => m.recent_tones).find(Boolean) ?? null

  const parts: string[] = [
    `Family-level synthesis across ${activeMemberCount} active members.`,
  ]
  if (lastCheckInAgoLabel) parts.push(`Last check-in was ${lastCheckInAgoLabel}.`)
  if (mostRecentTone) parts.push(`Most recent emotional tone: ${mostRecentTone}.`)

  return parts.join(' ')
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

type SilenceEvaluation =
  | {
      silence_decision: 'surface' | 'wait' | 'never'
      silence_reason: string
      wait_until: string | null
    }
  | { silence_decision: null; error: string; original_preserved: true }

async function runSilence(
  draft: string,
  context: string,
  baseUrl: string,
): Promise<SilenceEvaluation> {
  try {
    const res = await fetch(`${baseUrl}/api/guardian/silence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, context }),
    })
    const data = await res.json()
    if (!data.ok) {
      return {
        silence_decision: null,
        error: data.error ?? 'Silence route returned not-ok',
        original_preserved: true,
      }
    }
    return {
      silence_decision: data.silence_decision,
      silence_reason: data.silence_reason ?? '',
      wait_until: data.wait_until ?? null,
    }
  } catch (err) {
    return {
      silence_decision: null,
      error: err instanceof Error ? err.message : 'Unknown silence error',
      original_preserved: true,
    }
  }
}

function formatInsightAsProse(d: InsightOutput): string {
  const bullets = (arr: string[]) => (arr.length > 0 ? arr.map((x) => `- ${x}`).join('\n') : '(none)')
  return `Family pulse:
${d.family_pulse}

Thriving:
${bullets(d.thriving)}

Under pressure:
${bullets(d.under_pressure)}

Recurring patterns:
${bullets(d.recurring_patterns)}

Worth attention:
${d.worth_attention}`
}

function isValidInsightOutput(v: unknown): v is InsightOutput {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.family_pulse === 'string' &&
    Array.isArray(o.thriving) &&
    Array.isArray(o.under_pressure) &&
    Array.isArray(o.recurring_patterns) &&
    typeof o.worth_attention === 'string'
  )
}

function topN<T>(values: Array<T | null | undefined>, n: number): T[] {
  const counts = new Map<T, number>()
  for (const v of values) {
    if (v === null || v === undefined) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v)
}

function formatDate(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function formatMemberBlock(m: MemberBlock): string {
  const header = m.role ? `— ${m.name} (${m.role}) —` : `— ${m.name} —`
  const memoLine =
    m.memo && m.memo.trim().length > 0
      ? `Memo: ${m.memo.trim()}`
      : 'Memo: (not available this run)'
  const tones = m.recent_tones.length > 0 ? m.recent_tones.join(', ') : '(none recorded)'
  const { amber, red } = m.wellbeing_flags
  return `${header}\n${memoLine}\nRecent tones: ${tones}\nWellbeing flags: ${amber} amber, ${red} red`
}

async function getPerMemberBlock(
  member: ActiveMember,
  baseUrl: string,
  cacheDeadline: number
): Promise<MemberBlock> {
  // 1. Cache check — most recent perspective memo for this member
  const { data: cachedRows } = await supabase
    .from('perspective_memos')
    .select('memo, created_at')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const cached = cachedRows?.[0]
  let memo = ''
  if (
    cached &&
    cached.created_at &&
    new Date(cached.created_at).getTime() >= cacheDeadline
  ) {
    memo = cached.memo ?? ''
    console.log(`[guardian/insight] ${member.name}: reusing cached memo`)
  } else {
    // 2. Cache miss — call Guardian 8 and await the fresh memo
    try {
      const res = await fetch(`${baseUrl}/api/guardian/perspective`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      })
      const data = await res.json()
      if (data.ok && data.memo) {
        memo = data.memo
        console.log(`[guardian/insight] ${member.name}: generated fresh memo`)
      } else {
        console.warn(
          `[guardian/insight] ${member.name}: Guardian 8 returned no memo:`,
          data
        )
      }
    } catch (err) {
      console.error(
        `[guardian/insight] ${member.name}: Guardian 8 call failed:`,
        err
      )
    }
  }

  // 3. Supporting signal — last 7 check-ins for tone frequency + wellbeing flags
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('emotional_tone, wellbeing_level')
    .eq('member_id', member.id)
    .order('started_at', { ascending: false })
    .limit(7)

  const tones = (checkIns ?? []).map((c) => c.emotional_tone as string | null)
  const recent_tones = topN(tones, 3)

  const wellbeing_flags = {
    amber: (checkIns ?? []).filter((c) => c.wellbeing_level === 'amber').length,
    red: (checkIns ?? []).filter((c) => c.wellbeing_level === 'red').length,
  }

  return { name: member.name, role: member.role, memo, recent_tones, wellbeing_flags }
}

// POST — run the synthesis and store it
export async function POST() {
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - WINDOW_MS)
  const cacheDeadline = Date.now() - CACHE_TTL_MS
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  try {
    // 1. Active members only (status=active AND voice_enrolled=true) — ordered for determinism
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('id, name, role')
      .eq('status', 'active')
      .eq('voice_enrolled', true)
      .order('created_at', { ascending: true })

    if (membersError) throw membersError
    const members = (membersData ?? []) as ActiveMember[]

    if (members.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No active enrolled members to synthesise' },
        { status: 200 }
      )
    }

    // 2. Per-member work in parallel — cache check → G8 if miss → tones+flags
    const settled = await Promise.allSettled(
      members.map((m) => getPerMemberBlock(m, baseUrl, cacheDeadline))
    )

    const perMember: MemberBlock[] = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      console.error(
        `[guardian/insight] member ${members[i].id} fatal failure:`,
        r.reason
      )
      return {
        name: members[i].name,
        role: members[i].role,
        memo: '',
        recent_tones: [],
        wellbeing_flags: { amber: 0, red: 0 },
      }
    })

    // 3. Total sessions in the 7-day window across all active members
    const activeIds = members.map((m) => m.id)
    const { count: totalSessionsRaw } = await supabase
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .in('member_id', activeIds)
      .gte('started_at', windowStart.toISOString())
      .lte('started_at', windowEnd.toISOString())

    const totalSessions = totalSessionsRaw ?? 0

    // 4. Build the user message
    const memberBlocks = perMember.map(formatMemberBlock).join('\n\n')
    const userContent = `Active whānau members this week:

${memberBlocks}

Window: ${formatDate(windowStart.toISOString())} – ${formatDate(windowEnd.toISOString())}
Total sessions: ${totalSessions}

Read the memos side-by-side. Find the pattern none of them alone can see.`

    // 5. Opus 4.7 with extended thinking — the deepest reasoning Bea does
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 10000,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'high' },
      system: GUARDIAN_INSIGHT_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    // Extract thinking (if any) and take the LAST text block for JSON
    // (matches summarise/absence — flagged for a future hardening pass)
    const thinkingBlock = response.content.find(
      (b): b is Anthropic.ThinkingBlock => b.type === 'thinking'
    )
    const thinkingContent = thinkingBlock?.thinking ?? null

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    const lastText = textBlocks[textBlocks.length - 1]
    if (!lastText) throw new Error('No text block in response')

    const insightData = JSON.parse(lastText.text) as InsightOutput
    insightData.session_count = totalSessions

    // 6. Tikanga check — ONE call per insight run. NEVER re-run on the rewrite.
    const insightProse = formatInsightAsProse(insightData)
    const tikangaContext = `Family-level synthesis across ${members.length} active members`
    const evaluation = await runTikanga(insightProse, tikangaContext, baseUrl)

    // Resolve final insight per fail-open discipline, with rewrite-parse fallback
    let finalInsight: InsightOutput = insightData
    let insightOriginal: InsightOutput | null = null
    const evaluationToStore: Record<string, unknown> = { ...evaluation }

    if (evaluation.tikanga_pass === false && evaluation.tikanga_rewrite) {
      try {
        const parsed: unknown = JSON.parse(evaluation.tikanga_rewrite)
        if (isValidInsightOutput(parsed)) {
          finalInsight = { ...parsed, session_count: totalSessions }
          insightOriginal = insightData
          evaluationToStore.rewrite_applied = true
          console.log('[guardian/insight] tikanga rewrite applied')
        } else {
          evaluationToStore.rewrite_applied = false
          evaluationToStore.rewrite_parse_note = 'rewrite parsed but shape invalid'
          console.warn('[guardian/insight] tikanga rewrite shape invalid — preserving original')
        }
      } catch (err) {
        evaluationToStore.rewrite_applied = false
        evaluationToStore.rewrite_parse_note =
          err instanceof Error ? err.message : 'JSON parse failed'
        console.warn('[guardian/insight] tikanga rewrite not parseable — preserving original')
      }
    } else if (evaluation.tikanga_pass === null) {
      console.warn(
        '[guardian/insight] tikanga check errored — preserving original:',
        (evaluation as { error?: string }).error
      )
    }

    // 6b. Silence check — runs on the FINAL (post-rewrite) insight.
    //     Fail-open: if G6 errors, we surface by default. An observation Bea
    //     wanted to make shouldn't disappear because of a timing-check bug.
    const { data: recentRows } = await supabase
      .from('check_ins')
      .select('started_at')
      .in('member_id', activeIds)
      .order('started_at', { ascending: false })
      .limit(1)
    const lastCheckInIso = recentRows?.[0]?.started_at ?? null
    const lastCheckInAgoLabel = lastCheckInIso ? formatAge(lastCheckInIso) : null

    const silenceProse = formatInsightAsProse(finalInsight)
    const silenceContext = formatSilenceContext(members.length, perMember, lastCheckInAgoLabel)
    const silence = await runSilence(silenceProse, silenceContext, baseUrl)

    const silenceDecision: 'surface' | 'wait' | 'never' =
      silence.silence_decision ?? 'surface'
    const silenceReason =
      silence.silence_decision === null
        ? `silence check errored: ${silence.error}`
        : silence.silence_reason
    const waitUntil =
      silence.silence_decision === 'wait' ? silence.wait_until : null

    if (silence.silence_decision === null) {
      console.warn(
        '[guardian/insight] silence check errored — surfacing by default:',
        silence.error,
      )
    } else if (silence.silence_decision !== 'surface') {
      console.log(
        `[guardian/insight] silence decision = ${silence.silence_decision} — record stored but hidden from dashboard`,
      )
    }

    // 7. Store the report
    const { data: stored, error: insertError } = await supabase
      .from('family_insights')
      .insert({
        family_pulse: finalInsight.family_pulse,
        thriving: finalInsight.thriving,
        under_pressure: finalInsight.under_pressure,
        recurring_patterns: finalInsight.recurring_patterns,
        worth_attention: finalInsight.worth_attention,
        session_count: finalInsight.session_count,
        guardian_thinking: thinkingContent,
        insight_original: insightOriginal,
        tikanga_evaluation: evaluationToStore,
        silence_decision: silenceDecision,
        silence_reason: silenceReason,
        wait_until: waitUntil,
        silence_evaluation: silence,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[guardian/insight] Failed to store:', insertError)
    }

    return NextResponse.json({
      ok: true,
      insight: finalInsight,
      insight_id: stored?.id ?? null,
      thinking: thinkingContent,
    })
  } catch (err) {
    console.error('[guardian/insight] failure:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET — return the most recent report that Guardian 6 decided to surface.
// Legacy rows with silence_decision IS NULL (pre-G6) remain visible — no backfill needed.
export async function GET() {
  const { data, error } = await supabase
    .from('family_insights')
    .select('*')
    .or('silence_decision.eq.surface,silence_decision.is.null')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ insight: null })
  }

  return NextResponse.json({ insight: data })
}
