import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? 'auth_failed')}`,
    )
  }

  const user = data.user

  const { data: linked } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (linked) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // First login — try to auto-link by email. Atomic: only claims rows whose
  // auth_user_id is still null, so simultaneous logins can't race.
  if (user.email) {
    const { data: unlinked } = await supabase
      .from('members')
      .select('id')
      .is('auth_user_id', null)
      .ilike('email', user.email)
      .maybeSingle()

    if (unlinked) {
      const { data: updated, error: linkError } = await supabase
        .from('members')
        .update({ auth_user_id: user.id })
        .eq('id', unlinked.id)
        .is('auth_user_id', null)
        .select('id')
        .maybeSingle()

      if (!linkError && updated) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      if (linkError) {
        console.error('[auth/callback] Auto-link update failed:', linkError)
      }
    }
  }

  return NextResponse.redirect(`${origin}/welcome`)
}
