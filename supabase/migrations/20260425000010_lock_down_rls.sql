-- Lock down RLS to service-role-only.
--
-- Prior migrations attached "Allow all" policies (USING (true) WITH CHECK (true))
-- to most tables. With the Supabase publishable (anon) key shipped in any browser
-- request, those policies allowed anyone to read crisis_notifications,
-- listening_member_summaries, coach_reads, etc. — and to INSERT into members.
--
-- Drop the "Allow all" policies. RLS stays enabled. Service-role calls (the only
-- thing our route handlers use, via supabase-admin.ts) bypass RLS by default,
-- so backend behaviour is unchanged. Anon and authenticated callers via
-- PostgREST will be denied because no policy permits them.
--
-- Tables already without an "Allow all" policy (e.g. check_ins, family_insights)
-- are already deny-by-default — no change needed.

DROP POLICY IF EXISTS "Allow all" ON members;
DROP POLICY IF EXISTS "Allow all" ON schedules;
DROP POLICY IF EXISTS "Allow all" ON crisis_notifications;
DROP POLICY IF EXISTS "Allow all" ON listening_sessions;
DROP POLICY IF EXISTS "Allow all" ON listening_member_summaries;
DROP POLICY IF EXISTS "Allow all" ON coach_reads;
DROP POLICY IF EXISTS "Allow all" ON goals;
DROP POLICY IF EXISTS "Allow all" ON observations;
DROP POLICY IF EXISTS "Allow all" ON session_insights;
DROP POLICY IF EXISTS "Allow all" ON patterns;
DROP POLICY IF EXISTS "Allow all" ON milestones;
DROP POLICY IF EXISTS "Allow all" ON push_subscriptions;
