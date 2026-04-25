'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageBackground from '@/components/page-background'
import PushNotificationManager from '@/components/push-notification-manager'
import UpcomingHouseholdRhythm from '@/components/upcoming-household-rhythm'

export type CrisisNotificationSummary = {
  id: string
  briefing: string
  crisis_level: 'concerned' | 'urgent'
  created_at: string
  affected_member_name: string
}

type HouseholdContext = {
  family_summary: string | null
  emotional_tone: string | null
  last_checkin_date: string | null
  wellbeing_level: string | null
}

function greeting() {
  return 'Kia ora'
}

// We remove the traffic-light colors completely. 
// Emotions are not server statuses. Bea observes them quietly.
const WELLBEING_LABEL: Record<string, string> = {
  green: 'settled',
  amber: 'tender',
  red:   'heavy',
}

export default function HomeClient({
  memberName,
  memberRole,
  crisisNotifications,
}: {
  memberName: string | null
  memberRole: string | null
  crisisNotifications: CrisisNotificationSummary[]
}) {
  const [context, setContext] = useState<HouseholdContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifs, setNotifs] = useState(crisisNotifications)

  useEffect(() => {
    fetch('/api/check-ins')
      .then((r) => r.json())
      .then(setContext)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const dismissNotif = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/crisis-notifications/${id}/seen`, { method: 'POST' }).catch(console.error)
  }

  const wellbeing = context?.wellbeing_level ?? null
  const isPrimary = memberRole === 'primary'

  return (
    // Generous spacing. No boxes.
    <div className="flex flex-col flex-1 justify-between py-8 md:py-12 animate-fade-in">
      <PageBackground variant="everyday" />

      {/* Top: The Observation */}
      <div className="space-y-8 md:space-y-12">
        {notifs.length > 0 && (
          <div className="space-y-4">
            {notifs.map((n) => (
              <CrisisCard key={n.id} notif={n} onDismiss={() => dismissNotif(n.id)} />
            ))}
          </div>
        )}

        <header>
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal mb-6 md:mb-8">
            {greeting()}{memberName ? `, ${memberName}.` : '.'}
          </h1>

          {loading ? (
            // Replaced the heavy grey "skeleton" blocks with a quiet text pulse
            <p className="font-ui text-sm text-bea-blue opacity-50 animate-pulse">
              Recollecting...
            </p>
          ) : context?.family_summary ? (
            <p className="font-body text-bea-charcoal text-base md:text-lg leading-relaxed max-w-sm">
              {context.family_summary}
            </p>
          ) : (
            <p className="font-body text-bea-blue text-base md:text-lg leading-relaxed max-w-sm">
              I am here when you are ready to begin.
            </p>
          )}

          <div className="mt-4">
            <UpcomingHouseholdRhythm />
          </div>
        </header>

        {/* The "Pulse" - Replaced the boxed dashboard card with elegant typography */}
        {!loading && memberName && (
          <div className="border-t border-bea-charcoal/10 pt-6 md:pt-8 max-w-sm">
            {wellbeing || context?.emotional_tone ? (
              <p className="font-serif text-lg md:text-xl text-bea-olive italic mb-3">
                The house has felt {WELLBEING_LABEL[wellbeing || ''] ?? context?.emotional_tone ?? 'quiet'} lately.
              </p>
            ) : null}
            
            <p className="font-ui text-sm text-bea-blue">
              {context?.last_checkin_date
                ? `Last check-in: ${context.last_checkin_date}`
                : 'We have not checked in yet.'}
            </p>
          </div>
        )}

        {/* Empty state without boxes */}
        {!loading && !memberName && (
           <div className="border-t border-bea-charcoal/10 pt-6 md:pt-8 max-w-sm">
            <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed mb-4">
              No one has been introduced to me yet.
            </p>
            <Link
              href="/setup"
              className="font-ui text-sm text-bea-charcoal border-b border-bea-amber pb-1 hover:text-bea-amber transition-colors duration-500"
            >
              Begin introductions
            </Link>
          </div>
        )}
      </div>

      {!isPrimary && (
        <div className="mt-12 md:mt-16 flex flex-col gap-8 w-full max-w-sm">
          <Link
            href="/check-in"
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            Talk with me
          </Link>
        </div>
      )}

      <div className="mt-12 md:mt-16 max-w-sm">
        <PushNotificationManager />
      </div>

    </div>
  )
}

function CrisisCard({
  notif,
  onDismiss,
}: {
  notif: CrisisNotificationSummary
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [detailBriefing, setDetailBriefing] = useState<string | null>(null)
  const [detailCreatedAt, setDetailCreatedAt] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const cardBorder = notif.crisis_level === 'urgent' ? 'border-bea-clay/60' : 'border-bea-clay/30'

  const showDetail = async () => {
    if (expanded) return
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/crisis-notifications/${notif.id}`)
      const data = await res.json()
      setDetailBriefing(data.briefing ?? notif.briefing)
      setDetailCreatedAt(data.created_at ?? notif.created_at)
      setExpanded(true)
    } catch (err) {
      console.error('Failed to load notification detail:', err)
      setDetailBriefing(notif.briefing)
      setDetailCreatedAt(notif.created_at)
      setExpanded(true)
    } finally {
      setLoadingDetail(false)
    }
  }

  const heardAt = detailCreatedAt
    ? new Date(detailCreatedAt).toLocaleString('en-NZ', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null

  return (
    <div className={`bg-bea-milk border ${cardBorder} rounded-2xl px-5 py-4 md:px-6 md:py-5`}>
      <h2 className="font-serif text-xl md:text-2xl text-bea-charcoal mb-3">
        Bea would like to talk to you about {notif.affected_member_name}.
      </h2>
      {notif.crisis_level === 'urgent' && (
        <p className="font-body text-sm text-bea-clay mb-3">
          Please make this soon.
        </p>
      )}
      <p className={`font-body text-bea-charcoal leading-relaxed ${expanded ? 'text-base md:text-lg mb-4' : 'text-sm md:text-base mb-5'}`}>
        {expanded && detailBriefing ? detailBriefing : notif.briefing}
      </p>
      {expanded && heardAt && (
        <p className="font-ui text-xs text-bea-blue mb-5">
          Heard {heardAt}
        </p>
      )}
      <div className="flex gap-6">
        <button
          onClick={onDismiss}
          className="font-ui text-sm uppercase tracking-wide text-bea-blue hover:text-bea-charcoal transition-colors"
        >
          I&apos;ve seen this
        </button>
        {!expanded && (
          <button
            onClick={showDetail}
            disabled={loadingDetail}
            className="font-ui text-sm uppercase tracking-wide text-bea-charcoal hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            {loadingDetail ? 'Opening…' : 'Tell me more'}
          </button>
        )}
      </div>
    </div>
  )
}