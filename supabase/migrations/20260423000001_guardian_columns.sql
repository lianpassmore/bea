-- Add family_summary column to check_ins (guardian columns already exist from previous migration)
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS family_summary text;

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  days text[] NOT NULL DEFAULT '{}',
  time text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('listen', 'checkin', 'group')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Allow anon to read/write (household device needs access)
CREATE POLICY "Allow all" ON schedules FOR ALL USING (true) WITH CHECK (true);
