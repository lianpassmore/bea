'use client'

import PageBackground from '@/components/page-background'
import AddToHomeScreenPrompt from '@/components/add-to-home-screen-prompt'

export default function HomeClient({
  memberName,
  dailyLine,
  currentGoal,
  whanauGoal,
}: {
  memberName: string | null
  dailyLine: string
  currentGoal: { id: string; title: string } | null
  whanauGoal: { id: string; title: string } | null
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

      {/* 1. TOP ZONE: The Greeting & Date */}
      <header className="pb-5 sm:pb-6 border-b border-bea-charcoal/20 flex flex-col gap-2 shrink-0">
        <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-olive">
          {today}
        </p>
        <h1 className="font-serif text-xl sm:text-2xl md:text-3xl text-bea-charcoal">
          Kia ora, {memberName}.
        </h1>
      </header>

      {/* 2. MIDDLE ZONE: Current focus, both individual and whānau */}
      {(currentGoal || whanauGoal) && (
        <div className="flex-1 flex flex-col justify-center py-8 sm:py-12 md:py-16 gap-10 sm:gap-12 md:gap-16">
          {currentGoal && (
            <div>
              <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-blue mb-3 sm:mb-4">
                Your focus
              </p>
              <h2 className="font-serif italic text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-bea-charcoal leading-[1.15] tracking-tight">
                &ldquo;{currentGoal.title.replace(/^I want to /, '')}&rdquo;
              </h2>
            </div>
          )}
          {whanauGoal && (
            <div>
              <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber mb-3 sm:mb-4">
                Whānau focus
              </p>
              <h2 className="font-serif italic text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-bea-charcoal leading-[1.15] tracking-tight">
                &ldquo;{whanauGoal.title.replace(/^I want to /, '')}&rdquo;
              </h2>
            </div>
          )}
        </div>
      )}

      {/* 3. BOTTOM ZONE: The Daily Observation */}
      {dailyLine && (
        <div className="pt-5 sm:pt-6 border-t border-bea-charcoal/20 mt-auto shrink-0">
          <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber mb-3 sm:mb-4">
            Bea&rsquo;s thoughts
          </p>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-bea-charcoal leading-relaxed">
            {dailyLine}
          </p>
        </div>
      )}

      <AddToHomeScreenPrompt />
    </div>
  )
}
