'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, BookOpen, Calendar, AudioLines } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Tab = {
  href: string
  label: string
  icon: LucideIcon
  match: (pathname: string) => boolean
}

const TALK: Tab = {
  href: '/check-in',
  label: 'Talk',
  icon: MessageCircle,
  match: (p) => p.startsWith('/check-in'),
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
  const pathname = usePathname() ?? '/'

  const tabs: Tab[] = isPrimary
    ? [TALK, LISTEN, NOTES, SCHEDULE]
    : [TALK, NOTES, SCHEDULE]

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-bea-milk/90 backdrop-blur border-t border-bea-charcoal/10 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="max-w-md md:max-w-xl lg:max-w-3xl mx-auto flex items-stretch justify-between px-4 sm:px-6 md:px-8 lg:px-12 py-3">
        {tabs.map((tab) => {
          const active = tab.match(pathname)
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
