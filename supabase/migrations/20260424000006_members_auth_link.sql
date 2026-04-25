-- Link Supabase auth users to members, and add email for first-login auto-linking.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- Case-insensitive uniqueness for email (nullable allowed; only enforced when set).
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_unique
  ON members (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_auth_user_id
  ON members (auth_user_id);
