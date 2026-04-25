-- Individual vision: a member's own kaupapa, parallel to households.vision.
-- Held by Bea, surfaced on the home page, never tracked or graded.

alter table members add column if not exists vision text;
alter table members add column if not exists vision_set_at timestamptz;

-- Seed Lian's vision (idempotent, only updates if email matches).
update members
  set vision = 'to be a kinder and more curious parent that is present for her family',
      vision_set_at = now()
  where lower(email) = 'lianpassmore@gmail.com'
    and vision is null;
