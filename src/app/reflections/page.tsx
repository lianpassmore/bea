import { redirect } from 'next/navigation'
import { getCurrentMember } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import TimelineClient, { type TimelineEvent } from './timeline-client'

type CheckInRow = {
  id: string
  started_at: string | null
  reflection: string | null
  emotional_tone: string | null
  individual_summary: string | null
  individual_themes: string[] | null
  suggested_focus: string | null
}

type SessionRow = {
  id: string
  started_at: string | null
  kind: 'passive' | 'guided' | null
  family_summary: string | null
  family_themes: string[] | null
  family_tone: string | null
  family_pulse: string | null
}

type MemberSummaryRow = {
  session_id: string
  reflection: string | null
  emotional_tone: string | null
  individual_summary: string | null
  individual_themes: string[] | null
  suggested_focus: string | null
}

export default async function ReflectionsPage() {
  const member = await getCurrentMember()
  if (!member) redirect('/login')

  const [checkInsRes, sessionsRes, memberSummariesRes, householdRes] = await Promise.all([
    supabase
      .from('check_ins')
      .select('id, started_at, reflection, emotional_tone, individual_summary, individual_themes, suggested_focus')
      .eq('member_id', member.id)
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('listening_sessions')
      .select('id, started_at, kind, family_summary, family_themes, family_tone, family_pulse')
      .eq('status', 'attributed')
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('listening_member_summaries')
      .select('session_id, reflection, emotional_tone, individual_summary, individual_themes, suggested_focus')
      .eq('member_id', member.id),
    supabase
      .from('households')
      .select('vision, vision_set_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const householdVision = (householdRes.data?.vision as string | null) ?? ''
  const householdVisionSetAt = (householdRes.data?.vision_set_at as string | null) ?? null

  const summariesBySession = new Map<string, MemberSummaryRow>()
  for (const row of (memberSummariesRes.data ?? []) as MemberSummaryRow[]) {
    summariesBySession.set(row.session_id, row)
  }

  const checkInEvents: TimelineEvent[] = ((checkInsRes.data ?? []) as CheckInRow[])
    .filter((r) => r.started_at)
    .map((r) => ({
      id: `checkin:${r.id}`,
      kind: 'individual',
      timestamp: r.started_at!,
      reflection: r.reflection,
      emotional_tone: r.emotional_tone,
      individual_summary: r.individual_summary,
      individual_themes: r.individual_themes ?? [],
      suggested_focus: r.suggested_focus,
      family_summary: null,
      family_themes: [],
      family_tone: null,
      family_pulse: null,
    }))

  const sessionEvents: TimelineEvent[] = ((sessionsRes.data ?? []) as SessionRow[])
    .filter((s) => s.started_at)
    .map((s) => {
      const mine = summariesBySession.get(s.id)
      return {
        id: `session:${s.id}`,
        kind: s.kind === 'guided' ? 'family' : 'listening',
        timestamp: s.started_at!,
        reflection: mine?.reflection ?? null,
        emotional_tone: mine?.emotional_tone ?? null,
        individual_summary: mine?.individual_summary ?? null,
        individual_themes: mine?.individual_themes ?? [],
        suggested_focus: mine?.suggested_focus ?? null,
        family_summary: s.family_summary,
        family_themes: s.family_themes ?? [],
        family_tone: s.family_tone,
        family_pulse: s.family_pulse,
      }
    })

  const events = [...checkInEvents, ...sessionEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <TimelineClient
      memberName={member.name}
      events={events}
      householdVision={householdVision}
      householdVisionSetAt={householdVisionSetAt}
    />
  )
}
