-- Members: household people who have given consent and enrolled their voice
create table if not exists members (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  role                  text not null default 'family' check (role in ('primary', 'family')),
  azure_profile_id      text,
  voice_enrolled        boolean not null default false,
  consent_given         boolean not null default false,
  consent_given_at      timestamptz,
  consent_withdrawn_at  timestamptz,
  status                text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at            timestamptz default now()
);

alter table members enable row level security;
create policy "Allow all" on members for all using (true);

-- Link check-ins to the member who had the conversation
alter table check_ins add column if not exists member_id   uuid references members(id);
alter table check_ins add column if not exists member_name text;
