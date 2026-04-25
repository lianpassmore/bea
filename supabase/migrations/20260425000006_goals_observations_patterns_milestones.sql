-- Coaching loop: individual + whānau goals, per-session observations against
-- those goals, cross-session patterns Bea can surface, and milestones the
-- family can celebrate. The pattern detection agent (api/guardian/patterns)
-- writes session_insights + observations + patterns after every session.

-- ---------------------------------------------------------------------------
-- goals: things a member or the whānau wants to work on
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'member' goals belong to a single person (owner_id required).
  -- 'whanau' goals belong to the household as a unit (owner_id null).
  owner_type   text NOT NULL CHECK (owner_type IN ('member', 'whanau')),
  owner_id     uuid REFERENCES members(id) ON DELETE CASCADE,

  title        text NOT NULL,
  description  text,

  -- A short stable key the pattern agent can match against when extracting
  -- per-session observations (e.g. 'swear_count_per_session',
  -- 'interruption_count', 'kindness_moments_count'). Free-form so Bea can
  -- propose new ones, but keep them snake_case.
  metric_key   text,
  -- 'decrease' | 'increase' | 'maintain' — reading direction for progress.
  direction    text CHECK (direction IN ('decrease', 'increase', 'maintain')),
  baseline     numeric,
  target       numeric,

  -- 'draft' = proposed by Bea, awaiting human confirmation.
  -- 'active' = being tracked. 'paused' = on ice but not abandoned.
  -- 'achieved' = met the target. 'archived' = retired.
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('draft', 'active', 'paused', 'achieved', 'archived')),

  -- Free-form provenance so we know where the goal came from.
  -- e.g. {"source": "bea_proposal", "session_id": "...", "rationale": "..."}
  proposed_by  jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Whanau goals must have null owner_id; member goals must have one.
  CHECK (
    (owner_type = 'whanau' AND owner_id IS NULL) OR
    (owner_type = 'member' AND owner_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_goals_owner
  ON goals (owner_type, owner_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_status
  ON goals (status);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON goals FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- observations: per-session metric values against a goal.
-- The pattern agent writes one row per (active goal, session) when it can
-- extract a value from the transcript. Manual logging via Bea voice tools
-- also lands here (with session_id null when ad-hoc).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES listening_sessions(id) ON DELETE SET NULL,
  value       numeric NOT NULL,
  note        text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observations_goal_observed_at
  ON observations (goal_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_session
  ON observations (session_id);

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON observations FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- session_insights: one row per listening_session, holding the structured
-- output from the pattern detection agent. Distinct from listening_sessions'
-- family_summary etc — that's the group guardian's narrative output. This is
-- the coaching agent's quantitative + relational read.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL UNIQUE REFERENCES listening_sessions(id) ON DELETE CASCADE,

  -- Per-member snapshot:
  --   { member_id: { tone, notable_moments[], observed_metrics[ {key,value,note} ] } }
  per_member   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Whānau-level snapshot in the same shape (no member_id key):
  --   { tone, notable_moments[], observed_metrics[ {key,value,note} ], dynamics[] }
  whanau       jsonb NOT NULL DEFAULT '{}'::jsonb,

  agent_thinking text,

  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_insights_session
  ON session_insights (session_id);

ALTER TABLE session_insights ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON session_insights FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- patterns: cross-session corroborated observations Bea can surface.
-- Single sessions don't create high-confidence patterns. The agent either
-- creates a new low-confidence candidate, reinforces an existing one
-- (bumping last_seen_at + supporting_session_ids), or leaves things alone.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patterns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  scope        text NOT NULL CHECK (scope IN ('member', 'whanau')),
  subject_id   uuid REFERENCES members(id) ON DELETE CASCADE,

  -- Loose taxonomy: 'metric_trend', 'recurring_conflict', 'interruption',
  -- 'positive_shift', 'communication_style', 'emotional_pattern', 'other'
  kind         text NOT NULL,
  title        text NOT NULL,
  description  text NOT NULL,

  severity     text NOT NULL DEFAULT 'low'
                 CHECK (severity IN ('low', 'medium', 'high', 'positive')),

  -- 0..1 — how corroborated across sessions. New patterns start ~0.3.
  confidence   numeric NOT NULL DEFAULT 0.3
                 CHECK (confidence >= 0 AND confidence <= 1),

  supporting_session_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],

  status       text NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'discussed', 'dismissed', 'resolved')),

  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  discussed_at  timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (scope = 'whanau' AND subject_id IS NULL) OR
    (scope = 'member' AND subject_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_patterns_scope_subject
  ON patterns (scope, subject_id, status);
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen
  ON patterns (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_status
  ON patterns (status);

ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON patterns FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- milestones: things worth celebrating.
-- e.g. first session, 1-week streak, 10 sessions, goal achieved, first apology,
-- first whānau session, voice enrolled, etc. Award once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_type   text NOT NULL CHECK (owner_type IN ('member', 'whanau')),
  owner_id     uuid REFERENCES members(id) ON DELETE CASCADE,

  -- snake_case key, e.g. 'first_session', 'one_week_streak', 'sessions_count_10',
  -- 'goal_achieved'.
  kind         text NOT NULL,
  title        text NOT NULL,
  payload      jsonb,

  achieved_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (owner_type = 'whanau' AND owner_id IS NULL) OR
    (owner_type = 'member' AND owner_id IS NOT NULL)
  ),
  -- One award per (owner, kind). For "every N sessions" use distinct kinds
  -- like sessions_count_10, sessions_count_25.
  UNIQUE (owner_type, owner_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_milestones_owner_achieved
  ON milestones (owner_type, owner_id, achieved_at DESC);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON milestones FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- updated_at triggers for goals + patterns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS goals_set_updated_at ON goals;
CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS patterns_set_updated_at ON patterns;
CREATE TRIGGER patterns_set_updated_at
  BEFORE UPDATE ON patterns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
