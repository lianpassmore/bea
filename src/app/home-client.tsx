'use client'

import Link from 'next/link'
import PageBackground from '@/components/page-background'
import AddToHomeScreenPrompt from '@/components/add-to-home-screen-prompt'
import ProfileMenu, { type CrisisNotification } from '@/components/profile-menu'

export default function HomeClient({
  memberId,
  memberName,
  avatarUrl,
  notifications,
  consentGiven,
  consentGivenAt,
  dailyLine,
  currentGoal,
  whanauGoal,
  nextListening,
  nextKorero,
  minutesUsed,
}: {
  memberId: string | null
  memberName: string | null
  avatarUrl: string | null
  notifications: CrisisNotification[]
  consentGiven: boolean
  consentGivenAt: string | null
  dailyLine: string
  currentGoal: { id: string; title: string } | null
  whanauGoal: { id: string; title: string } | null
  nextListening: string | null
  nextKorero: string | null
  minutesUsed: number | null
}) {
  const today = new Date().toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Pacific/Auckland',
  })

  return (
    <div className="flex-1 flex flex-col relative z-10 animate-fade-in w-full">
      <PageBackground variant="everyday" />

      <header className="pt-2 pb-7 sm:pb-9 grid grid-cols-[1fr_auto] items-start gap-x-4 shrink-0">
        <div className="flex flex-col">
          <p className="font-body text-lg md:text-xl text-bea-charcoal/70">
            Bea
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-bea-charcoal tracking-tight leading-[1.1] mt-4">
            Kia ora, {memberName}.
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span aria-hidden className="h-px w-6 bg-bea-amber" />
            <p className="font-ui text-sm text-bea-olive">
              {today}
            </p>
          </div>
        </div>
        <div className="-mt-1.5">
          <ProfileMenu
            compact
            memberId={memberId}
            memberName={memberName}
            avatarUrl={avatarUrl}
            notifications={notifications}
            consentGiven={consentGiven}
            consentGivenAt={consentGivenAt}
          />
        </div>
      </header>

      {(currentGoal || whanauGoal) && (
        <div className="flex-1 flex flex-col justify-center py-10 sm:py-14 md:py-20 gap-14 sm:gap-16 md:gap-20">
          {currentGoal && (
            <div className="relative pl-5 sm:pl-6">
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-px bg-bea-blue/50" />
              <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-blue mb-3 sm:mb-4">
                Your focus
              </p>
              <h2 className="font-body italic text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-bea-charcoal leading-[1.15] tracking-tight">
                {currentGoal.title}
              </h2>
            </div>
          )}
          {whanauGoal && (
            <div className="relative pl-5 sm:pl-6">
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-px bg-bea-amber/55" />
              <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber mb-3 sm:mb-4">
                Whānau focus
              </p>
              <h2 className="font-body italic text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-bea-charcoal leading-[1.15] tracking-tight">
                {whanauGoal.title}
              </h2>
            </div>
          )}
        </div>
      )}

      {(nextListening || nextKorero || minutesUsed !== null) && (
        <div className="shrink-0 flex flex-col gap-2 mt-2 mb-2 sm:mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/schedule"
            className="group rounded-2xl bg-bea-charcoal/3 ring-1 ring-bea-charcoal/10 px-5 py-4 sm:px-6 sm:py-5 flex flex-col gap-2 transition-colors hover:bg-bea-charcoal/4 hover:ring-bea-blue/30"
          >
            <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-bea-blue">
              Next listening
            </p>
            <p className="font-body text-lg sm:text-xl text-bea-charcoal tracking-tight">
              {nextListening ?? 'Not scheduled yet'}
            </p>
          </Link>
          <Link
            href="/schedule"
            className="group rounded-2xl bg-bea-charcoal/3 ring-1 ring-bea-charcoal/10 px-5 py-4 sm:px-6 sm:py-5 flex flex-col gap-2 transition-colors hover:bg-bea-charcoal/4 hover:ring-bea-amber/40"
          >
            <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-bea-amber">
              Next whānau kōrero
            </p>
            <p className="font-body text-lg sm:text-xl text-bea-charcoal tracking-tight">
              {nextKorero ?? 'Not scheduled yet'}
            </p>
          </Link>
          </div>
          {minutesUsed !== null && (
            <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-bea-olive/70 text-right pr-1">
              {minutesUsed} min · this month
            </p>
          )}
        </div>
      )}

      {dailyLine && (
        <div className="mt-auto shrink-0 pt-7 sm:pt-9 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px w-6 bg-bea-amber" />
            <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber">
              Bea&rsquo;s thoughts
            </p>
          </div>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-bea-charcoal/85 leading-relaxed">
            {dailyLine}
          </p>
        </div>
      )}

      <AddToHomeScreenPrompt />
    </div>
  )
}
