-- Listening-mode sessions: Bea sits silently in the room, Azure STT with
-- diarization produces an anonymous-speaker transcript, and one Claude call
-- attributes speakers to household members and emits family + per-member
-- summaries. The 1:1 check-in path (check_ins table) is unchanged.

CREATE TABLE IF NOT EXISTS listening_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at           timestamptz,
  ended_at             timestamptz,
  duration_secs        numeric,

  -- Expected people in the room at session start:
  -- [{ member_id: uuid, name: string }, ...]
  roster               jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Azure diarized output reshaped to:
  -- [{ speaker: 1, offset_ms: 1200, text: "..." }, ...]
  raw_transcript       jsonb,

  -- After the group guardian runs. Same shape as raw_transcript plus
  -- attributed_member_id (uuid|null) and attributed_name (string; 'guest' if
  -- no match).
  attributed_transcript jsonb,

  -- { "1": { member_id, name, confidence, reasoning }, ... }
  speaker_map          jsonb,

  -- Family-level outputs from the group guardian
  family_summary       text,
  family_themes        text[],
  family_tone          text,
  family_pulse         text,

  attribution_reasoning text,
  guardian_thinking    text,

  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'transcribed', 'attributed', 'failed')),
  error                text,

  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listening_sessions_started_at
  ON listening_sessions (started_at DESC);

ALTER TABLE listening_sessions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON listening_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Per-member summary rows produced from a single group session.
-- One row per attributed, non-guest member so a member's timeline can
-- surface their contributions to family sessions alongside their 1:1s.
CREATE TABLE IF NOT EXISTS listening_member_summaries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE,
  member_id          uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name        text NOT NULL,

  individual_summary text,
  individual_themes  text[],
  emotional_tone     text,
  suggested_focus    text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_listening_member_summaries_member_id
  ON listening_member_summaries (member_id, created_at DESC);

ALTER TABLE listening_member_summaries ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON listening_member_summaries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
