-- Per-member reflection from listening sessions. Parallel to check_ins.reflection
-- but for the family-session path: Bea was a silent observer in the room, and
-- this is the short warm note she writes to each participant afterwards.
ALTER TABLE listening_member_summaries
  ADD COLUMN IF NOT EXISTS reflection text;
