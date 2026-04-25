-- Capture the Coach's per-run listening_priority + listening_direction so
-- /api/guardian/context can merge them into the dynamic variables sent to
-- ElevenLabs on the next check-in. These were previously squashed into the
-- generic `rationale` text field, which lost structure.
ALTER TABLE coach_reads ADD COLUMN IF NOT EXISTS listening_priority  text;
ALTER TABLE coach_reads ADD COLUMN IF NOT EXISTS listening_direction text;
