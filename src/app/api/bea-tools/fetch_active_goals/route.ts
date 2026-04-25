import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: what goals am I tracking right now for this person, or for
// the whānau? Voice-shaped — returns a concise natural-language `say` field
// alongside structured data Bea can branch on.
//
// Query: ?member_id=<uuid>   → that member's active + draft goals
//        ?scope=whanau       → whānau active + draft goals
//        no params           → everything currently active or draft
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const memberId = params.get('member_id')
  const scope = params.get('scope')

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
      ? "There aren't any goals active for this person yet."
      : scope === 'whanau'
        ? "The whānau doesn't have any active goals yet."
        : "There aren't any goals active right now."
  } else {
    const titles = goals.map((g) => g.title).slice(0, 5)
    say =
      goals.length === 1
        ? `One active goal: ${titles[0]}.`
        : `${goals.length} active goals: ${titles.join('; ')}.`
  }

  return NextResponse.json({ say, goals })
}
