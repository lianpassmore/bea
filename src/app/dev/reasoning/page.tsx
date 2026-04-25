import { loadSelectedSession, loadSessionList } from './data'
import type { SessionFilter } from './types'
import SessionList from './session-list'
import AgentChain from './agent-chain'
import DecisionSummary from './decision-summary'
import LiveToggle from './live-toggle'

const FILTERS: SessionFilter[] = [
  'all',
  'individual',
  'guided',
  'passive',
  'family-insight',
  'has-crisis',
  'has-tikanga',
]

const isFilter = (v: string | undefined): v is SessionFilter =>
  !!v && (FILTERS as string[]).includes(v)

export default async function DevReasoningPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; filter?: string }>
}) {
  const sp = await searchParams
  const filter: SessionFilter = isFilter(sp.filter) ? sp.filter : 'all'
  const selectedId = sp.id ?? null

  const [sessions, selected] = await Promise.all([
    loadSessionList(filter),
    loadSelectedSession(selectedId),
  ])

  // If no session is selected but we have results, default-select the most
  // recent — matching how a developer would expect to land here.
  const effectiveSelectedId = selectedId ?? sessions[0]?.id ?? null
  const effectiveSelected =
    selected ??
    (effectiveSelectedId ? await loadSelectedSession(effectiveSelectedId) : null)

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-baseline justify-between px-6 py-4 border-b"
        style={{ borderColor: '#1F1D1B' }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm tracking-wide" style={{ color: '#D6A85A' }}>
            BEA · DEVELOPER REASONING AUDIT
          </h1>
          <span className="text-xs opacity-60">
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </span>
        </div>
        <LiveToggle />
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className="w-1/4 border-r overflow-y-auto"
          style={{ borderColor: '#1F1D1B' }}
        >
          <SessionList
            sessions={sessions}
            selectedId={effectiveSelectedId}
            filter={filter}
          />
        </aside>

        <section className="w-1/2 overflow-y-auto px-6 py-6">
          <AgentChain selected={effectiveSelected} />
        </section>

        <aside
          className="w-1/4 border-l overflow-y-auto px-5 py-6"
          style={{ borderColor: '#1F1D1B' }}
        >
          <DecisionSummary selected={effectiveSelected} />
        </aside>
      </div>

      <footer
        className="px-6 py-3 border-t text-xs opacity-60"
        style={{ borderColor: '#1F1D1B' }}
      >
        This page exists because Bea&rsquo;s research argues that ethical AI
        requires visible reasoning. — Lian, Lee, Karaitiana.
      </footer>
    </div>
  )
}
