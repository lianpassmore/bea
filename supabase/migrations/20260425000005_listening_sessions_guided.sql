-- Allow listening_sessions to also hold guided family check-ins where Bea
-- speaks via ElevenLabs while the room audio is recorded in parallel and
-- diarized post-hoc by Azure. The group guardian then attributes speakers
-- and produces family + per-member summaries — same downstream pipeline as
-- passive listening, with Bea's known transcript passed alongside so her
-- voice (echoed from device speakers) can be excluded from attribution.

ALTER TABLE listening_sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'passive'
    CHECK (kind IN ('passive', 'guided'));

-- ElevenLabs realtime transcript for guided sessions:
-- [{ role: 'agent' | 'user', message: string, time_in_call_secs: number }, ...]
-- Null for passive sessions. The 'user' turns here are NOT diarized — they
-- are an undifferentiated mix of all human speakers in the room.
ALTER TABLE listening_sessions
  ADD COLUMN IF NOT EXISTS eleven_labs_transcript jsonb;

CREATE INDEX IF NOT EXISTS idx_listening_sessions_kind_started_at
  ON listening_sessions (kind, started_at DESC);
