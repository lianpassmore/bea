-- Guardian 10 (Crisis) — per check-in
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_detected boolean DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_level text
  CHECK (crisis_level IS NULL OR crisis_level IN ('watchful', 'concerned', 'urgent'));
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_signals jsonb;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_reasoning text;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_in_session_response text;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_briefing_for_contact text;

-- Crisis notifications — one row per (crisis event × adult contact to notify)
CREATE TABLE IF NOT EXISTS crisis_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id uuid REFERENCES check_ins(id) ON DELETE CASCADE,
  affected_member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  contact_member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  crisis_level text NOT NULL CHECK (crisis_level IN ('concerned', 'urgent')),
  briefing text NOT NULL,
  seen_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crisis_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON crisis_notifications FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crisis_notifications_contact_unseen
  ON crisis_notifications (contact_member_id, seen_at, created_at DESC);

COMMENT ON TABLE crisis_notifications IS
  'Guardian 10 notifications. One row per (crisis event × adult contact). seen_at NULL means the contact has not yet acknowledged. Cascades on check-in or member deletion to honour Wall of No deletion requirements.';
