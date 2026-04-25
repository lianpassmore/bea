import { NextResponse } from 'next/server'
import { getCurrentMember } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

type TimelineEntry = {
  id: string
  source: 'checkin' | 'listening'
  timestamp: string | null
  reflection: string
  emotional_tone: string | null
}

export async function GET() {
  const member = await getCurrentMember()
  if (!member) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const [checkInsRes, listeningRes] = await Promise.all([
    supabase
      .from('check_ins')
      .select('id, started_at, reflection, emotional_tone')
      .eq('member_id', member.id)
      .not('reflection', 'is', null)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase
      .from('listening_member_summaries')
      .select('id, emotional_tone, reflection, created_at, session:listening_sessions(started_at)')
      .eq('member_id', member.id)
      .not('reflection', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (checkInsRes.error) {
    return NextResponse.json({ error: checkInsRes.error.message }, { status: 500 })
  }
  if (listeningRes.error) {
    return NextResponse.json({ error: listeningRes.error.message }, { status: 500 })
  }

  type ListeningRow = {
    id: string
    emotional_tone: string | null
    reflection: string | null
    created_at: string | null
    session: { started_at: string | null } | { started_at: string | null }[] | null
  }

  const entries: TimelineEntry[] = [
    ...((checkInsRes.data ?? []).map((r) => ({
      id: r.id as string,
      source: 'checkin' as const,
      timestamp: (r.started_at as string | null) ?? null,
      reflection: (r.reflection as string) ?? '',
      emotional_tone: (r.emotional_tone as string | null) ?? null,
    }))),
    ...((listeningRes.data ?? []) as ListeningRow[]).map((r) => {
      const sessionStart = Array.isArray(r.session)
        ? r.session[0]?.started_at ?? null
        : r.session?.started_at ?? null
      return {
        id: r.id,
        source: 'listening' as const,
        timestamp: sessionStart ?? r.created_at,
        reflection: r.reflection ?? '',
        emotional_tone: r.emotional_tone,
      }
    }),
  ]
    .filter((e) => e.reflection.trim().length > 0)
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
    .slice(0, 50)

  return NextResponse.json({
    member: { id: member.id, name: member.name },
    reflections: entries,
  })
}
