import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// List patterns.
//   ?scope=member&subject_id=<uuid>   → that member's patterns
//   ?scope=whanau                     → whānau patterns
//   ?status=new|discussed|dismissed|resolved
//   ?since=ISO                        → only patterns last_seen_at >= since
//   ?limit=N                          → default 50, max 200
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = params.get('scope')
  const subjectId = params.get('subject_id')
  const status = params.get('status')
  const since = params.get('since')
  const limitRaw = params.get('limit')
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200) : 50

  let query = supabase
    .from('patterns')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (scope === 'member') {
    if (!subjectId) {
      return NextResponse.json(
        { error: 'subject_id is required when scope=member' },
        { status: 400 },
      )
    }
    query = query.eq('scope', 'member').eq('subject_id', subjectId)
  } else if (scope === 'whanau') {
    query = query.eq('scope', 'whanau').is('subject_id', null)
  } else if (scope) {
    return NextResponse.json(
      { error: "scope must be 'member' or 'whanau'" },
      { status: 400 },
    )
  }

  if (status) query = query.eq('status', status)
  if (since) query = query.gte('last_seen_at', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
