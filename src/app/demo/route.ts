import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Judges visit /demo to land signed in as the demo identity ("Demi") without
// going through Google. Credentials are well-known (demo@gmail.com / 123456)
// because the account holds only seeded demo data — no real user activity.
// Sign-in happens server-side so cookies are set on the redirect.

const DEMO_EMAIL = 'demo@gmail.com'
const DEMO_PASSWORD = '123456'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        `Demo not initialised (${error.message}). Run: npx tsx --env-file=.env.local scripts/setup-demo.ts`,
      )}`,
    )
  }

  return NextResponse.redirect(`${origin}/`)
}
