import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: what goals am I tracking right now for this person, or for
// the family as a whole? Voice-shaped — returns a concise natural-language
// `say` field alongside structured data Bea can branch on.
//
// Query: ?member_id=<uuid>   → that member's active + draft goals
//        ?scope=whanau       → family-wide active + draft goals
//        no params           → everything currently active or draft
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const memberId = params.get('member_id')
  const scope = params.get('scope')

  if (memberId && !UUID_RE.test(memberId)) {
    return NextResponse.json(
      { error: 'member_id must be a valid uuid' },
      { status: 400 },
    )
  }

  let query = supabase
    .from('goals')
    .select('id, owner_type, owner_id, title, description, metric_key, direction, target, status')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })

  if (memberId) {
    query = query.eq('owner_type', 'member').eq('owner_id', memberId)
  } else if (scope === 'whanau') {
    query = query.eq('owner_type', 'whanau').is('owner_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const goals = data ?? []
  let say: string
  if (goals.length === 0) {
    say = memberId
      ? "No current focus for this person yet."
      : scope === 'whanau'
        ? "The family hasn't set a current focus yet."
        : "Nothing in focus right now."
  } else {
    const titles = goals.map((g) => g.title).slice(0, 5)
    say =
      goals.length === 1
        ? `Their current focus: ${titles[0]}.`
        : `${goals.length} areas of focus right now: ${titles.join('; ')}.`
  }

  return NextResponse.json({ say, goals })
}
