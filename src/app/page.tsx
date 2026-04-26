import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentMember } from '@/lib/auth'
import { getDailyLine } from '@/lib/daily-lines'
import PageBackground from '@/components/page-background'
import HomeClient from './home-client'

const DAY_TO_DOW: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

function nextFiring(days: string[] | null, time: string | null): { date: Date; label: string } | null {
  if (!days?.length || !time) return null
  const [hh, mm] = time.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null

  const targetDows = new Set(
    days
      .map((d) => DAY_TO_DOW[d.toLowerCase()])
      .filter((d): d is number => d !== undefined),
  )
  if (!targetDows.size) return null

  const nzNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }))

  for (let i = 0; i < 8; i++) {
    const c = new Date(nzNow)
    c.setDate(c.getDate() + i)
    c.setHours(hh, mm, 0, 0)
    if (c <= nzNow) continue
    if (!targetDows.has(c.getDay())) continue
    const weekday = c.toLocaleDateString('en-NZ', { weekday: 'short' })
    const timeStr = c
      .toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase()
      .replace(/\s+/g, '')
    return { date: c, label: `${weekday} · ${timeStr}` }
  }
  return null
}

async function minutesUsedThisMonth(): Promise<number> {
  const now = new Date()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString()

  const [checkins, sessions] = await Promise.all([
    supabaseAdmin
      .from('check_ins')
      .select('call_duration_secs')
      .gte('started_at', monthStart),
    supabaseAdmin
      .from('listening_sessions')
      .select('duration_secs')
      .gte('started_at', monthStart),
  ])

  const checkinSecs = (checkins.data ?? []).reduce(
    (s: number, r: { call_duration_secs: number | null }) =>
      s + (r.call_duration_secs ?? 0),
    0,
  )
  const sessionSecs = (sessions.data ?? []).reduce(
    (s: number, r: { duration_secs: number | null }) =>
      s + (Number(r.duration_secs) || 0),
    0,
  )
  return Math.round((checkinSecs + sessionSecs) / 60)
}

async function nextScheduleFor(mode: 'listen' | 'group'): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('schedules')
    .select('days, time')
    .eq('mode', mode)
    .eq('active', true)
  const rows = (data ?? []) as { days: string[]; time: string }[]
  let earliest: { date: Date; label: string } | null = null
  for (const r of rows) {
    const n = nextFiring(r.days, r.time)
    if (!n) continue
    if (!earliest || n.date < earliest.date) earliest = n
  }
  return earliest?.label ?? null
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-center animate-fade-in">
        <PageBackground variant="arrival" />

        <h1 className="font-body font-medium text-6xl md:text-7xl text-bea-charcoal tracking-tight">
          Bea
        </h1>

        <Link
          href="/login"
          className="group mt-12 md:mt-16 inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
        >
          <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
          Enter
        </Link>
      </div>
    )
  }

  const member = await getCurrentMember()

  let currentGoal: { id: string; title: string } | null = null
  if (member) {
    const { data: goalRow } = await supabaseAdmin
      .from('goals')
      .select('id, title')
      .eq('owner_type', 'member')
      .eq('owner_id', member.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (goalRow) currentGoal = goalRow as { id: string; title: string }
  }

  const { data: whanauRow } = await supabaseAdmin
    .from('goals')
    .select('id, title')
    .eq('owner_type', 'whanau')
    .is('owner_id', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const whanauGoal = whanauRow ? (whanauRow as { id: string; title: string }) : null

  const isPrimary = member?.role === 'primary'
  const [nextListening, nextKorero, minutesUsed] = await Promise.all([
    nextScheduleFor('listen'),
    nextScheduleFor('group'),
    isPrimary ? minutesUsedThisMonth() : Promise.resolve(null),
  ])

  type NotifRow = {
    id: string
    briefing: string
    crisis_level: 'concerned' | 'urgent'
    created_at: string
    affected: { name: string } | { name: string }[] | null
  }
  let notifications: {
    id: string
    briefing: string
    crisis_level: 'concerned' | 'urgent'
    created_at: string
    affected_member_name: string
  }[] = []
  if (member) {
    const { data } = await supabase
      .from('crisis_notifications')
      .select(
        `id, briefing, crisis_level, created_at,
         affected:members!affected_member_id(name)`,
      )
      .eq('contact_member_id', member.id)
      .is('seen_at', null)
      .order('created_at', { ascending: false })
    notifications = ((data ?? []) as unknown as NotifRow[]).map((n) => {
      const affectedName = Array.isArray(n.affected)
        ? n.affected[0]?.name
        : n.affected?.name
      return {
        id: n.id,
        briefing: n.briefing,
        crisis_level: n.crisis_level,
        created_at: n.created_at,
        affected_member_name: affectedName ?? 'A family member',
      }
    })
  }

  return (
    <HomeClient
      memberId={member?.id ?? null}
      memberName={member?.name ?? null}
      avatarUrl={member?.avatar_url ?? null}
      notifications={notifications}
      consentGiven={member?.consent_given ?? false}
      consentGivenAt={member?.consent_given_at ?? null}
      dailyLine={getDailyLine()}
      currentGoal={currentGoal}
      whanauGoal={whanauGoal}
      nextListening={nextListening}
      nextKorero={nextKorero}
      minutesUsed={minutesUsed}
    />
  )
}
