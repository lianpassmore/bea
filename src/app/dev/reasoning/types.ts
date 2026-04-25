// Shared types for the developer reasoning audit page.

export type SessionKind = 'individual' | 'guided' | 'passive' | 'family-insight'

export type SessionListItem = {
  id: string
  kind: SessionKind
  startedAt: string
  memberNames: string[]
  oneLine: string | null
  hasCrisis: boolean
  hasTikangaRewrite: boolean
  // Started within the freshness window — agents may still be running.
  isFresh: boolean
}

export type SessionFilter =
  | 'all'
  | 'individual'
  | 'guided'
  | 'passive'
  | 'family-insight'
  | 'has-crisis'
  | 'has-tikanga'

// One agent run inside a session.
export type AgentTrace = {
  agent: string
  model: string | null
  thinkingEnabled: boolean
  tokens?: { input?: number; output?: number } | null
  inputSummary: string | null
  output: unknown
  thinking: string | null
  // Optional UI hint when this agent's output was overridden downstream.
  overrideNote?: string | null
  // True when the session is fresh and this agent's output column is still
  // empty — i.e. the agent has been triggered but has not returned. Drives
  // the live-mode "thinking..." indicator.
  pending?: boolean
}

export type Decision = {
  label: string
  detail: string
  anchor: string
}

export type SelectedSession = {
  id: string
  kind: SessionKind
  startedAt: string
  memberNames: string[]
  agents: AgentTrace[]
  decisions: Decision[]
  // For tikanga side-by-side view, when present.
  tikangaSideBySide?: {
    original: string
    rewritten: string
    evaluation: unknown
  } | null
}
