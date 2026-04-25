-- crisis is one of the four Opus 4.7 reasoning tasks; capture its full
-- extended-thinking trace alongside the structured crisis output so the
-- decision is auditable.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS crisis_agent_thinking text;
