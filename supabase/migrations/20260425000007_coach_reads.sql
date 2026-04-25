-- coach_reads: one row per Coach agent run. The Coach reads what just happened
-- in a session and decides whether/how Bea should bring something up next time.
-- The two distinguishing audit fields are:
--   * agent_thinking — full extended-thinking trace for the run
--   * considered_and_rejected — alternative drafts the agent chose not to use
--     [{ draft, why_not }, ...]
-- Either session_id or check_in_id will be set depending on the source session.

CREATE TABLE IF NOT EXISTS coach_reads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id   uuid REFERENCES listening_sessions(id) ON DELETE CASCADE,
  check_in_id  uuid REFERENCES check_ins(id) ON DELETE CASCADE,

  -- Whose context the coach is reasoning about (null = whānau-wide).
  member_id    uuid REFERENCES members(id) ON DELETE SET NULL,

  -- 'raise' = bring up next session, 'wait' = hold, 'note' = record only.
  decision     text CHECK (decision IS NULL OR decision IN ('raise', 'wait', 'note')),
  -- The line Bea would say if decision='raise' (else null).
  response     text,
  rationale    text,

  agent_thinking text,
  considered_and_rejected jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),

  CHECK (session_id IS NOT NULL OR check_in_id IS NOT NULL)
);

-- Idempotent additions in case the table existed without these audit columns.
ALTER TABLE coach_reads ADD COLUMN IF NOT EXISTS agent_thinking text;
ALTER TABLE coach_reads ADD COLUMN IF NOT EXISTS considered_and_rejected jsonb;

CREATE INDEX IF NOT EXISTS idx_coach_reads_session
  ON coach_reads (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_reads_check_in
  ON coach_reads (check_in_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_reads_member
  ON coach_reads (member_id, created_at DESC);

ALTER TABLE coach_reads ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON coach_reads FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
