'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { User, Users, BookOpen, Calendar, AudioLines } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Tab = {
  href: string
  label: string
  icon: LucideIcon
  match: (pathname: string, mode: string | null) => boolean
}

const INDIVIDUAL: Tab = {
  href: '/check-in?mode=individual',
  label: 'Individual',
  icon: User,
  match: (p, mode) => p.startsWith('/check-in') && mode !== 'family',
}

const FAMILY: Tab = {
  href: '/check-in?mode=family',
  label: 'Family',
  icon: Users,
  match: (p, mode) => p.startsWith('/check-in') && mode === 'family',
}

const NOTES: Tab = {
  href: '/reflections',
  label: 'Insights',
  icon: BookOpen,
  match: (p) => p.startsWith('/reflections'),
}

const SCHEDULE: Tab = {
  href: '/schedule',
  label: 'Schedule',
  icon: Calendar,
  match: (p) => p.startsWith('/schedule'),
}

const LISTEN: Tab = {
  href: '/listen',
  label: 'Listen',
  icon: AudioLines,
  match: (p) => p.startsWith('/listen'),
}

export default function FooterBar({
  isPrimary = false,
}: {
  isPrimary?: boolean
}) {
  return (
    <Suspense fallback={null}>
      <FooterBarInner isPrimary={isPrimary} />
    </Suspense>
  )
}

function FooterBarInner({ isPrimary }: { isPrimary: boolean }) {
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')

  const tabs: Tab[] = isPrimary
    ? [INDIVIDUAL, FAMILY, NOTES, SCHEDULE, LISTEN]
    : [INDIVIDUAL, NOTES, SCHEDULE]

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-bea-milk/90 backdrop-blur border-t border-bea-charcoal/10"
    >
      <ul className="max-w-md mx-auto flex items-stretch justify-between px-4 py-3">
        {tabs.map((tab) => {
          const active = tab.match(pathname, mode)
          const Icon = tab.icon
          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex flex-col items-center gap-1 py-1 transition-colors duration-500 ${
                  active
                    ? 'text-bea-charcoal'
                    : 'text-bea-blue hover:text-bea-charcoal'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 1.75 : 1.4}
                  className="transition-transform duration-500 group-hover:-translate-y-0.5"
                />
                <span className="font-ui text-[11px] tracking-wide leading-none">
                  {tab.label}
                </span>
                <span
                  aria-hidden
                  className={`block h-px w-6 transition-all duration-500 ${
                    active ? 'bg-bea-amber' : 'bg-transparent'
                  }`}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
