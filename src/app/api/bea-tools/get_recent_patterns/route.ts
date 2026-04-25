import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: what patterns has the analyst noticed lately that Bea
// might want to gently surface? Excludes dismissed + resolved by default.
//
// Query: ?member_id=<uuid>   → that member's patterns
//        ?scope=whanau       → whānau patterns
//        ?days=N             → window (default 30, max 90)
//        ?min_confidence=0.X → default 0.3
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const memberId = params.get('member_id')
  const scope = params.get('scope')
  const daysRaw = params.get('days')
  const days = daysRaw ? Math.min(Math.max(parseInt(daysRaw, 10) || 30, 1), 90) : 30
  const minConfRaw = params.get('min_confidence')
  const minConf = minConfRaw ? Math.max(0, Math.min(1, parseFloat(minConfRaw) || 0)) : 0.3

  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('patterns')
    .select('id, scope, subject_id, kind, title, description, severity, confidence, status, last_seen_at')
    .in('status', ['new', 'discussed'])
    .gte('last_seen_at', sinceIso)
    .gte('confidence', minConf)
    .order('last_seen_at', { ascending: false })
    .limit(20)

  if (memberId) {
    query = query.eq('scope', 'member').eq('subject_id', memberId)
  } else if (scope === 'whanau') {
    query = query.eq('scope', 'whanau').is('subject_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const patterns = data ?? []
  let say: string
  if (patterns.length === 0) {
    say = "Nothing new I'd want to surface right now."
  } else {
    const top = patterns[0]
    say =
      patterns.length === 1
        ? `One thing I've been noticing: ${top.title}.`
        : `A few things I've been noticing — most recent: ${top.title}.`
  }

  return NextResponse.json({ say, patterns })
}
