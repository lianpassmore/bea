import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ExpandableThinking } from './expand'

// ─── types ────────────────────────────────────────────────────────────────

type GoalRow = {
  id: string
  owner_id: string | null
  title: string
  description: string | null
  metric_key: string | null
  direction: 'decrease' | 'increase' | 'maintain' | null
  status: string
  created_at: string
}

type CheckInRow = {
  id: string
  started_at: string | null
  call_duration_secs: number | null
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  suggested_focus: string | null
  reflection: string | null
  wellbeing_level: string | null
  wellbeing_signals: string[] | null
  wellbeing_note: string | null
}

type ListeningSessionRow = {
  id: string
  started_at: string | null
  duration_secs: number | null
  kind: 'passive' | 'guided' | null
  family_summary: string | null
  family_themes: string[] | null
  family_tone: string | null
  family_pulse: string | null
}

type ListeningMemberSummaryRow = {
  session_id: string
  individual_summary: string | null
  individual_themes: string[] | null
  emotional_tone: string | null
  suggested_focus: string | null
  reflection: string | null
}

type CoachReadRow = {
  session_id: string | null
  check_in_id: string | null
  decision: 'raise' | 'wait' | 'note' | null
  response: string | null
  rationale: string | null
  agent_thinking: string | null
  considered_and_rejected: Array<{ draft?: string; why_not?: string }> | null
}

type PatternRow = {
  id: string
  kind: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'positive'
  confidence: number
  status: string
  supporting_session_ids: string[] | null
  last_seen_at: string
}

type ObservationRow = {
  value: number
  note: string | null
  observed_at: string
}

type SessionEvent = {
  key: string
  kind: 'passive' | 'check-in'
  startedAt: string
  durationSecs: number | null
  heard: {
    summary: string | null
    themes: string[] | null
    tone: string | null
    reflection: string | null
    suggestedFocus: string | null
    wellbeingLevel: string | null
    wellbeingSignals: string[] | null
    familyTone: string | null
    familyPulse: string | null
  }
  coach: CoachReadRow | null
}

// ─── data ─────────────────────────────────────────────────────────────────

async function loadAudit(goalId: string) {
  const { data: goalRaw } = await supabase
    .from('goals')
    .select('id, owner_id, title, description, metric_key, direction, status, created_at')
    .eq('id', goalId)
    .maybeSingle()
  const goal = goalRaw as GoalRow | null
  if (!goal || !goal.owner_id) return null

  const { data: memberRaw } = await supabase
    .from('members')
    .select('id, name')
    .eq('id', goal.owner_id)
    .maybeSingle()
  const member = memberRaw as { id: string; name: string } | null
  if (!member) return null

  const since = goal.created_at

  const [checkInsRes, sessionsRes, memberSummariesRes, coachRes, patternsRes, observationsRes] =
    await Promise.all([
      supabase
        .from('check_ins')
        .select(
          'id, started_at, call_duration_secs, individual_summary, individual_themes, emotional_tone, suggested_focus, reflection, wellbeing_level, wellbeing_signals, wellbeing_note',
        )
        .eq('member_id', member.id)
        .gte('started_at', since)
        .order('started_at', { ascending: true }),
      supabase
        .from('listening_sessions')
        .select(
          'id, started_at, duration_secs, kind, family_summary, family_themes, family_tone, family_pulse, roster',
        )
        .gte('started_at', since)
        .order('started_at', { ascending: true }),
      supabase
        .from('listening_member_summaries')
        .select(
          'session_id, individual_summary, individual_themes, emotional_tone, suggested_focus, reflection',
        )
        .eq('member_id', member.id),
      supabase
        .from('coach_reads')
        .select(
          'session_id, check_in_id, decision, response, rationale, agent_thinking, considered_and_rejected',
        )
        .eq('member_id', member.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('patterns')
        .select(
          'id, kind, title, description, severity, confidence, status, supporting_session_ids, last_seen_at',
        )
        .gte('last_seen_at', since)
        .order('last_seen_at', { ascending: true }),
      supabase
        .from('observations')
        .select('value, note, observed_at')
        .eq('goal_id', goalId)
        .order('observed_at', { ascending: true }),
    ])

  const checkIns = (checkInsRes.data ?? []) as CheckInRow[]
  const allSessions = (sessionsRes.data ?? []) as Array<
    ListeningSessionRow & { roster: Array<{ member_id: string }> | null }
  >
  const memberSummaries = (memberSummariesRes.data ?? []) as ListeningMemberSummaryRow[]
  const coachReads = (coachRes.data ?? []) as CoachReadRow[]
  const patterns = (patternsRes.data ?? []) as PatternRow[]
  const observations = (observationsRes.data ?? []) as ObservationRow[]

  // Only include passive sessions that involve this member.
  const memberSessions = allSessions.filter((s) =>
    (s.roster ?? []).some((r) => r.member_id === member.id),
  )

  const summaryByKey = new Map(
    memberSummaries.map((s) => [s.session_id, s] as const),
  )
  const coachByKey = new Map<string, CoachReadRow>()
  coachReads.forEach((c) => {
    const k = c.session_id ?? c.check_in_id
    if (k) coachByKey.set(k, c)
  })

  const events: SessionEvent[] = []

  for (const s of memberSessions) {
    if (!s.started_at) continue
    const ms = summaryByKey.get(s.id)
    events.push({
      key: s.id,
      kind: 'passive',
      startedAt: s.started_at,
      durationSecs: s.duration_secs,
      heard: {
        summary: ms?.individual_summary ?? null,
        themes: ms?.individual_themes ?? null,
        tone: ms?.emotional_tone ?? null,
        reflection: ms?.reflection ?? null,
        suggestedFocus: ms?.suggested_focus ?? null,
        wellbeingLevel: null,
        wellbeingSignals: null,
        familyTone: s.family_tone,
        familyPulse: s.family_pulse,
      },
      coach: coachByKey.get(s.id) ?? null,
    })
  }

  for (const c of checkIns) {
    if (!c.started_at) continue
    events.push({
      key: c.id,
      kind: 'check-in',
      startedAt: c.started_at,
      durationSecs: c.call_duration_secs,
      heard: {
        summary: c.individual_summary,
        themes: c.individual_themes,
        tone: c.emotional_tone,
        reflection: c.reflection,
        suggestedFocus: c.suggested_focus,
        wellbeingLevel: c.wellbeing_level,
        wellbeingSignals: c.wellbeing_signals,
        familyTone: null,
        familyPulse: null,
      },
      coach: coachByKey.get(c.id) ?? null,
    })
  }

  // Only include events the Coach actually reasoned about — keeps the audit
  // focused on the goal's arc rather than every recent app interaction.
  const reasoned = events.filter((e) => e.coach !== null)
  reasoned.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  return { goal, member, events: reasoned, patterns, observations }
}

// ─── page ─────────────────────────────────────────────────────────────────

export default async function AuditPage({
  params,
}: {
  params: Promise<{ goalId: string }>
}) {
  const { goalId } = await params
  const data = await loadAudit(goalId)
  if (!data) notFound()
  const { goal, member, events, patterns, observations } = data

  const considered = events.reduce(
    (n, e) => n + (e.coach?.considered_and_rejected?.length ?? 0),
    0,
  )
  const raised = events.filter((e) => e.coach?.decision === 'raise').length

  return (
    <div className="min-h-screen pb-24">
      <Header
        goal={goal}
        memberName={member.name}
        sessionCount={events.length}
        consideredCount={considered}
        raisedCount={raised}
        patternCount={patterns.length}
        observationCount={observations.length}
      />

      <main className="px-8 lg:px-16 xl:px-24">
        <div className="space-y-10 lg:space-y-12 mt-10 lg:mt-14">
          {events.map((ev, i) => (
            <SessionCard key={ev.key} event={ev} index={i} total={events.length} />
          ))}
        </div>

        <Footer patterns={patterns} observations={observations} goal={goal} />
      </main>
    </div>
  )
}

// ─── header ───────────────────────────────────────────────────────────────

function Header({
  goal,
  memberName,
  sessionCount,
  consideredCount,
  raisedCount,
  patternCount,
  observationCount,
}: {
  goal: GoalRow
  memberName: string
  sessionCount: number
  consideredCount: number
  raisedCount: number
  patternCount: number
  observationCount: number
}) {
  return (
    <header className="border-b border-bea-charcoal/10 bg-bea-milk/80 backdrop-blur sticky top-0 z-10">
      <div className="px-8 lg:px-16 xl:px-24 py-8 lg:py-14">
        <p className="font-ui text-xs uppercase tracking-[0.2em] text-bea-amber mb-4 lg:mb-6">
          Audit · {memberName}'s focus · Set {formatLongDate(goal.created_at)}
        </p>
        <h1 className="font-serif text-3xl md:text-5xl lg:text-7xl xl:text-8xl text-bea-charcoal leading-[1.05] tracking-tight">
          “{goal.title.replace(/^I want to /, '')}”
        </h1>
        <dl className="mt-8 lg:mt-10 grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-4 border-t border-bea-charcoal/10 pt-5 lg:pt-6">
          <Stat label="Sessions" value={sessionCount} />
          <Stat label="Drafts considered" value={consideredCount} />
          <Stat label="Raised to her" value={raisedCount} />
          <Stat label="Patterns / observations" value={`${patternCount} / ${observationCount}`} />
        </dl>
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dd className="font-serif text-2xl text-bea-charcoal">{value}</dd>
      <dt className="font-ui text-[11px] uppercase tracking-[0.12em] text-bea-charcoal/60">{label}</dt>
    </div>
  )
}

// ─── session card ─────────────────────────────────────────────────────────

function SessionCard({
  event,
  index,
  total,
}: {
  event: SessionEvent
  index: number
  total: number
}) {
  const date = new Date(event.startedAt)
  const weekday = date.toLocaleDateString('en-NZ', { weekday: 'long', timeZone: 'Pacific/Auckland' })
  const dayMonth = date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Pacific/Auckland',
  })
  const timeStr = date.toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Pacific/Auckland',
  })
  const kindLabel = event.kind === 'passive' ? 'Passive listening' : '1:1 check-in'
  const minutes = event.durationSecs ? Math.round(event.durationSecs / 60) : null
  const isLast = index === total - 1
  const decision = event.coach?.decision

  return (
    <article className="bg-white/40 border border-bea-charcoal/10 rounded-lg overflow-hidden">
      <div className="px-6 md:px-8 py-4 md:py-5 border-b border-bea-charcoal/10 flex items-baseline justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3 md:gap-5 flex-wrap">
          <span className="font-ui text-xs uppercase tracking-wider text-bea-amber">
            Session {index + 1} / {total}
          </span>
          <span className="font-serif text-lg md:text-xl text-bea-charcoal">
            {weekday}, {dayMonth}
          </span>
          <span className="font-body text-sm text-bea-charcoal/60">{timeStr}</span>
        </div>
        <div className="flex items-baseline gap-3 font-ui text-xs uppercase tracking-wider text-bea-charcoal/60">
          <span>{kindLabel}</span>
          {minutes !== null && <span>· {minutes} min</span>}
          {decision && <DecisionPill decision={decision} />}
        </div>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-bea-charcoal/10">
        <Heard event={event} isLast={isLast} />
        <Considered coach={event.coach} />
      </div>
    </article>
  )
}

function DecisionPill({ decision }: { decision: 'raise' | 'wait' | 'note' }) {
  const styles =
    decision === 'raise'
      ? 'bg-bea-amber/20 text-bea-amber border-bea-amber/40'
      : decision === 'wait'
      ? 'bg-bea-blue/15 text-bea-blue border-bea-blue/40'
      : 'bg-bea-olive/15 text-bea-olive border-bea-olive/40'
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] tracking-[0.15em] ${styles}`}
    >
      {decision.toUpperCase()}
    </span>
  )
}

function Heard({ event, isLast }: { event: SessionEvent; isLast: boolean }) {
  const { heard } = event
  return (
    <section className="p-6 md:p-8 space-y-5">
      <h3 className="font-ui text-xs uppercase tracking-[0.18em] text-bea-charcoal/60">
        What Bea heard
      </h3>

      {heard.tone && (
        <p className="font-body text-sm text-bea-charcoal/70">
          <span className="font-ui uppercase text-[10px] tracking-wider mr-2 text-bea-charcoal/50">
            tone
          </span>
          {heard.tone}
        </p>
      )}

      {heard.summary && (
        <p className="font-body text-base md:text-lg leading-relaxed text-bea-charcoal">
          {heard.summary}
        </p>
      )}

      {heard.themes && heard.themes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {heard.themes.map((t) => (
            <span
              key={t}
              className="font-ui text-xs px-2 py-1 rounded-md bg-bea-charcoal/5 text-bea-charcoal/70"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {heard.reflection && (
        <blockquote className="border-l-2 border-bea-amber/60 pl-4 font-body italic text-bea-charcoal/85 leading-relaxed">
          {heard.reflection}
        </blockquote>
      )}

      {(heard.familyTone || heard.familyPulse) && (
        <div className="text-sm text-bea-charcoal/70 space-y-1 pt-2 border-t border-bea-charcoal/5">
          {heard.familyTone && (
            <p>
              <span className="font-ui uppercase text-[10px] tracking-wider mr-2 text-bea-charcoal/50">
                family tone
              </span>
              {heard.familyTone}
            </p>
          )}
          {heard.familyPulse && (
            <p className="font-body italic">{heard.familyPulse}</p>
          )}
        </div>
      )}

      {heard.wellbeingLevel && (
        <p className="text-sm">
          <span className="font-ui uppercase text-[10px] tracking-wider mr-2 text-bea-charcoal/50">
            wellbeing
          </span>
          <span
            className={
              heard.wellbeingLevel === 'green'
                ? 'text-bea-olive'
                : heard.wellbeingLevel === 'amber'
                ? 'text-bea-amber'
                : 'text-bea-clay'
            }
          >
            {heard.wellbeingLevel}
          </span>
          {heard.wellbeingSignals && heard.wellbeingSignals.length > 0 && (
            <span className="text-bea-charcoal/60"> · {heard.wellbeingSignals.join(', ')}</span>
          )}
        </p>
      )}

      {isLast && heard.reflection && (
        <p className="font-ui text-xs uppercase tracking-wider text-bea-amber pt-2">
          ↑ this is where Bea surfaced live in the session
        </p>
      )}
    </section>
  )
}

function Considered({ coach }: { coach: CoachReadRow | null }) {
  if (!coach) {
    return (
      <section className="p-6 md:p-8 text-bea-charcoal/40 font-body italic">
        No coach reasoning recorded for this session.
      </section>
    )
  }

  const drafts = coach.considered_and_rejected ?? []

  return (
    <section className="p-6 md:p-8 space-y-5">
      <h3 className="font-ui text-xs uppercase tracking-[0.18em] text-bea-charcoal/60">
        What Bea considered saying — and didn't
      </h3>

      {drafts.length === 0 && (
        <p className="font-body italic text-bea-charcoal/60">
          Nothing on the table this session.
        </p>
      )}

      <ol className="space-y-4">
        {drafts.map((d, i) => (
          <li key={i} className="space-y-1.5">
            <p className="font-serif text-base md:text-lg text-bea-charcoal leading-relaxed">
              <span className="text-bea-amber/70 mr-2 font-ui text-xs">draft</span>
              <span>“{d.draft}”</span>
            </p>
            {d.why_not && (
              <p className="font-body text-sm text-bea-charcoal/70 leading-relaxed pl-1">
                <span className="font-ui uppercase text-[10px] tracking-wider mr-2 text-bea-charcoal/50">
                  why not
                </span>
                {d.why_not}
              </p>
            )}
          </li>
        ))}
      </ol>

      {coach.decision === 'raise' && coach.response && (
        <div className="border-t border-bea-charcoal/10 pt-4">
          <p className="font-ui text-xs uppercase tracking-wider text-bea-amber mb-2">
            Decided to bring up next time
          </p>
          <p className="font-serif text-lg text-bea-charcoal">“{coach.response}”</p>
        </div>
      )}

      {coach.rationale && (
        <p className="font-body text-sm text-bea-charcoal/70 leading-relaxed border-t border-bea-charcoal/10 pt-4">
          <span className="font-ui uppercase text-[10px] tracking-wider mr-2 text-bea-charcoal/50">
            rationale
          </span>
          {coach.rationale}
        </p>
      )}

      {coach.agent_thinking && <ExpandableThinking trace={coach.agent_thinking} />}
    </section>
  )
}

// ─── footer (patterns + observations) ─────────────────────────────────────

function Footer({
  patterns,
  observations,
  goal,
}: {
  patterns: PatternRow[]
  observations: ObservationRow[]
  goal: GoalRow
}) {
  return (
    <footer className="mt-16 pt-10 border-t border-bea-charcoal/10 grid md:grid-cols-2 gap-10">
      <div>
        <h2 className="font-serif text-xl md:text-2xl text-bea-charcoal mb-4">
          Patterns the agents noticed
        </h2>
        {patterns.length === 0 ? (
          <p className="font-body italic text-bea-charcoal/60">No patterns yet.</p>
        ) : (
          <ul className="space-y-3">
            {patterns.map((p) => (
              <li key={p.id} className="font-body">
                <p className="text-bea-charcoal flex items-baseline gap-3">
                  <SeverityDot severity={p.severity} />
                  <span className="font-serif">{p.title}</span>
                  <span className="font-ui text-xs text-bea-charcoal/50">
                    conf {p.confidence.toFixed(2)} ·{' '}
                    {(p.supporting_session_ids ?? []).length} session(s)
                  </span>
                </p>
                {p.description && (
                  <p className="text-sm text-bea-charcoal/70 mt-1 ml-5">{p.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-serif text-xl md:text-2xl text-bea-charcoal mb-4">
          Observations on this focus
          {goal.metric_key && (
            <span className="font-ui text-sm text-bea-charcoal/50 ml-2">
              ({goal.metric_key})
            </span>
          )}
        </h2>
        {observations.length === 0 ? (
          <p className="font-body italic text-bea-charcoal/60">
            No structured observations yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {observations.map((o, i) => (
              <li key={i} className="font-body flex items-baseline gap-4">
                <span className="font-serif text-2xl text-bea-amber">{o.value}</span>
                <span className="text-sm text-bea-charcoal/70">
                  {formatShortDate(o.observed_at)} · {o.note ?? '(no note)'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  )
}

function SeverityDot({ severity }: { severity: PatternRow['severity'] }) {
  const color =
    severity === 'high'
      ? 'bg-bea-clay'
      : severity === 'medium'
      ? 'bg-bea-amber'
      : severity === 'positive'
      ? 'bg-bea-olive'
      : 'bg-bea-charcoal/40'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />
}

// ─── utils ────────────────────────────────────────────────────────────────

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Pacific/Auckland',
  })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Pacific/Auckland',
  })
}
