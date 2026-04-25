import type { AgentTrace, SelectedSession } from './types'

const anchorFor = (agent: string) =>
  'agent-' +
  agent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function formatStartedAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MONO_STACK =
  'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <p className="text-xs opacity-60 italic">
        No structured output recorded.
      </p>
    )
  }
  return (
    <pre
      className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word p-3 rounded"
      style={{
        backgroundColor: '#16140F',
        color: '#E8DFC9',
        fontFamily: MONO_STACK,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function ThinkingTrace({ thinking }: { thinking: string | null }) {
  if (!thinking) {
    return (
      <p className="text-xs opacity-60 italic">
        No thinking trace captured for this agent run.
      </p>
    )
  }
  return (
    <div
      className="text-xs leading-relaxed whitespace-pre-wrap p-4 rounded"
      style={{
        backgroundColor: '#14130F',
        color: '#E8DFC9',
        fontFamily: MONO_STACK,
      }}
    >
      {thinking}
    </div>
  )
}

function ConsideredAndRejected({ value }: { value: unknown }) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return (
      <p className="text-xs opacity-60 italic">
        No alternatives considered — direct decision.
      </p>
    )
  }
  return <JsonBlock value={value} />
}

function PendingDot() {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full animate-pulse"
      style={{ backgroundColor: '#D6A85A' }}
      aria-hidden
    />
  )
}

function AgentCard({ agent }: { agent: AgentTrace }) {
  const id = anchorFor(agent.agent)
  const isCoach = agent.agent === 'Coach'
  const considered =
    isCoach &&
    agent.output &&
    typeof agent.output === 'object' &&
    'considered_and_rejected' in (agent.output as Record<string, unknown>)
      ? (agent.output as Record<string, unknown>).considered_and_rejected
      : undefined

  return (
    <article
      id={id}
      className="rounded-lg border mb-5 scroll-mt-24"
      style={{
        borderColor: agent.pending ? '#3A2F18' : '#1F1D1B',
        backgroundColor: '#15130F',
      }}
    >
      <header
        className="px-5 py-3 flex items-center justify-between border-b"
        style={{ borderColor: '#1F1D1B' }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3
            className="text-sm tracking-wide"
            style={{ color: '#D6A85A' }}
          >
            {agent.agent}
          </h3>
          {agent.model && (
            <span
              className="text-[11px] opacity-60"
              style={{ fontFamily: MONO_STACK }}
            >
              {agent.model}
            </span>
          )}
          {agent.thinkingEnabled && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#2A2418', color: '#D6A85A' }}
            >
              extended thinking
            </span>
          )}
          {agent.tokens && (agent.tokens.input || agent.tokens.output) ? (
            <span
              className="text-[10px] opacity-60"
              style={{ fontFamily: MONO_STACK }}
            >
              {agent.tokens.input ?? '?'} → {agent.tokens.output ?? '?'} tok
            </span>
          ) : null}
          {agent.pending && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1.5"
              style={{ backgroundColor: '#2A2418', color: '#D6A85A' }}
            >
              <PendingDot />
              thinking…
            </span>
          )}
        </div>
      </header>

      {agent.overrideNote && (
        <div
          className="px-5 py-2 text-xs border-b"
          style={{
            borderColor: '#1F1D1B',
            backgroundColor: '#2A1F18',
            color: '#D6A85A',
          }}
        >
          ⤷ {agent.overrideNote}
        </div>
      )}

      {agent.pending ? (
        <div className="px-5 py-6 text-xs opacity-70 italic">
          Agent has been triggered but has not returned yet. Live mode will
          replace this once it lands in the database.
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          <details>
            <summary className="cursor-pointer text-xs uppercase tracking-wider opacity-70 hover:opacity-100">
              input summary
            </summary>
            <p className="text-xs opacity-80 mt-2 italic">
              {agent.inputSummary ?? '—'}
            </p>
          </details>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider opacity-70 mb-2">
              output
            </h4>
            <JsonBlock value={agent.output} />
          </section>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider opacity-70 mb-2">
              extended thinking trace
            </h4>
            <ThinkingTrace thinking={agent.thinking} />
          </section>

          {isCoach && (
            <section>
              <h4 className="text-[11px] uppercase tracking-wider opacity-70 mb-2">
                considered &amp; rejected
              </h4>
              <ConsideredAndRejected value={considered} />
            </section>
          )}
        </div>
      )}
    </article>
  )
}

function TikangaSideBySide({
  original,
  rewritten,
  evaluation,
}: {
  original: string
  rewritten: string
  evaluation: unknown
}) {
  return (
    <article
      className="rounded-lg border mb-5 p-5"
      style={{ borderColor: '#1F1D1B', backgroundColor: '#15130F' }}
    >
      <h3 className="text-sm mb-3" style={{ color: '#D6A85A' }}>
        Tikanga rewrite
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-[11px] uppercase tracking-wider opacity-70 mb-1">
            original
          </h4>
          <p
            className="text-sm whitespace-pre-wrap p-3 rounded"
            style={{ backgroundColor: '#1A1814' }}
          >
            {original}
          </p>
        </div>
        <div>
          <h4 className="text-[11px] uppercase tracking-wider opacity-70 mb-1">
            rewritten
          </h4>
          <p
            className="text-sm whitespace-pre-wrap p-3 rounded"
            style={{ backgroundColor: '#1F1B14', color: '#F0E5C8' }}
          >
            {rewritten}
          </p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider opacity-70 hover:opacity-100">
          evaluation
        </summary>
        <div className="mt-2">
          <JsonBlock value={evaluation} />
        </div>
      </details>
    </article>
  )
}

export default function AgentChain({
  selected,
}: {
  selected: SelectedSession | null
}) {
  if (!selected) {
    return (
      <div className="text-sm opacity-60 mt-12 text-center">
        Select a session from the left to see the agent chain.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 pb-3 border-b" style={{ borderColor: '#1F1D1B' }}>
        <div className="text-[11px] uppercase tracking-wider opacity-60">
          {selected.kind === 'individual'
            ? '1:1 check-in'
            : selected.kind === 'guided'
              ? 'group session'
              : selected.kind === 'passive'
                ? 'passive listen'
                : 'family read'}{' '}
          · {formatStartedAt(selected.startedAt)}
        </div>
        <h2 className="text-base mt-1">
          {selected.memberNames.length > 0
            ? selected.memberNames.join(', ')
            : selected.kind === 'family-insight'
              ? 'whānau-wide'
              : '—'}
        </h2>
      </div>

      {selected.tikangaSideBySide && (
        <TikangaSideBySide
          original={selected.tikangaSideBySide.original}
          rewritten={selected.tikangaSideBySide.rewritten}
          evaluation={selected.tikangaSideBySide.evaluation}
        />
      )}

      {selected.agents.map((a, i) => (
        <AgentCard key={`${a.agent}-${i}`} agent={a} />
      ))}
    </div>
  )
}
