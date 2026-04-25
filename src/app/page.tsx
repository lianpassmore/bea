import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMember } from '@/lib/auth'
import { getDailyLine } from '@/lib/daily-lines'
import PageBackground from '@/components/page-background'
import HomeClient from './home-client'

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
    const { data: goalRow } = await supabase
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

  return (
    <HomeClient
      memberName={member?.name ?? null}
      dailyLine={getDailyLine()}
      currentGoal={currentGoal}
    />
  )
}
