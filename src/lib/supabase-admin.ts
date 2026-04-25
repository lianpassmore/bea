import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-only: bypasses RLS. Never import from a client component.
// The service-role env var has no NEXT_PUBLIC_ prefix so Next.js will not
// expose it in client bundles, but treat this module as server-only regardless.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
