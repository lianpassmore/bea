-- Profile photo on members
alter table members add column if not exists avatar_url text;

-- Per-subscription notification preferences (category gating)
alter table push_subscriptions
  add column if not exists prefs jsonb not null default
  '{"advance": true, "start": true, "end": true}'::jsonb;

-- Avatars storage bucket (public read so the <img> tag can render without signing)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Open policies: anyone authenticated can upload, anyone can read.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'avatars_read') then
    create policy avatars_read on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'avatars_write') then
    create policy avatars_write on storage.objects for insert
      with check (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'avatars_update') then
    create policy avatars_update on storage.objects for update
      using (bucket_id = 'avatars');
  end if;
end $$;
