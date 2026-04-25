-- Add missing columns to members table (table existed before this migration was created)
ALTER TABLE members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'family';
ALTER TABLE members ADD COLUMN IF NOT EXISTS azure_profile_id text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS voice_enrolled boolean NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_withdrawn_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraints if they don't already exist (ignore errors if they do)
DO $$
BEGIN
  ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('primary', 'family'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE members ADD CONSTRAINT members_status_check CHECK (status IN ('active', 'withdrawn'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS is on and permissive policy exists
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "Allow all" ON members FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Link check-ins to member (idempotent)
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id);
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS member_name text;
