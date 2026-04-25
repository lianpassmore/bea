-- Web Push subscriptions: one per browser/device, optionally linked to a member
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid references members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

create index if not exists push_subscriptions_member_idx on push_subscriptions(member_id);

alter table push_subscriptions enable row level security;
create policy "Allow all" on push_subscriptions for all using (true);
