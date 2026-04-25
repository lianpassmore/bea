'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { User, Users, AudioLines, ChevronDown, type LucideIcon } from 'lucide-react'

export type TimelineEventKind = 'individual' | 'family' | 'listening'

export type TimelineEvent = {
  id: string
  kind: TimelineEventKind
  timestamp: string
  reflection: string | null
  emotional_tone: string | null
  individual_summary: string | null
  individual_themes: string[]
  suggested_focus: string | null
  family_summary: string | null
  family_themes: string[]
  family_tone: string | null
}

const INITIAL_DAYS = 7
const STEP_DAYS = 30

const KIND_META: Record<TimelineEventKind, { label: string; icon: LucideIcon }> = {
  individual: { label: 'Individual check-in', icon: User },
  family: { label: 'Family check-in', icon: Users },
  listening: { label: 'Bea was listening', icon: AudioLines },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function previewText(e: TimelineEvent): string | null {
  const candidates = [e.reflection, e.individual_summary, e.family_summary]
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c.trim()
  }
  return null
}

function withinWindow(iso: string, nowMs: number, days: number): boolean {
  return new Date(iso).getTime() >= nowMs - days * 24 * 60 * 60 * 1000
}

export default function TimelineClient({
  memberName,
  events,
}: {
  memberName: string
  events: TimelineEvent[]
}) {
  const [nowMs] = useState(() => Date.now())

  const notes = useMemo(
    () =>
      events.filter(
        (e) => e.reflection !== null && e.reflection.trim().length > 0
      ),
    [events]
  )

  return (
    <div className="flex flex-col flex-1 pt-12 pb-12 md:pt-20 md:pb-20 max-w-xl mx-auto w-full animate-fade-in">
      <header className="mb-10 md:mb-16">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
          What we&apos;ve shared, {memberName}.
        </h1>
        <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
          A few words after each time we&apos;ve spoken.
        </p>
      </header>

      <NotesSection notes={notes} nowMs={nowMs} />

      <TimelineSection events={events} nowMs={nowMs} />

      <div className="mt-12 md:mt-20 border-t border-bea-charcoal/10 pt-6 md:pt-8">
        <Link
          href="/"
          className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
        >
          Back
        </Link>
      </div>
    </div>
  )
}

function NotesSection({ notes, nowMs }: { notes: TimelineEvent[]; nowMs: number }) {
  const [windowDays, setWindowDays] = useState(INITIAL_DAYS)

  const visible = useMemo(
    () => notes.filter((e) => withinWindow(e.timestamp, nowMs, windowDays)),
    [notes, nowMs, windowDays]
  )
  const hasMore = visible.length < notes.length

  return (
    <section className="mb-14 md:mb-20">
      <h2 className="font-serif text-xl md:text-2xl text-bea-charcoal mb-6 md:mb-8">
        Insights from Bea
      </h2>

      {notes.length === 0 ? (
        <div className="border-t border-bea-charcoal/10 pt-6 md:pt-8">
          <p className="font-body text-bea-blue text-base md:text-lg leading-relaxed">
            We haven&apos;t spoken yet. When we do, I&apos;ll leave a few words here.
          </p>
          <Link
            href="/check-in"
            className="group inline-flex items-center gap-4 mt-8 md:mt-10 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16" />
            Begin
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="border-t border-bea-charcoal/10 pt-6 md:pt-8">
          <p className="font-body text-bea-blue text-base md:text-lg leading-relaxed">
            Nothing in the last {windowDays} days.
          </p>
          {hasMore && (
            <ShowEarlierButton onClick={() => setWindowDays((d) => d + STEP_DAYS)} />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-10 md:gap-14">
            {visible.map((e) => (
              <article
                key={e.id}
                className="border-t border-bea-charcoal/10 pt-5 md:pt-6"
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <p className="font-ui text-xs text-bea-blue uppercase tracking-wide">
                    {formatDate(e.timestamp)}
                  </p>
                  <p className="font-ui text-xs text-bea-olive/70 italic">
                    After we spoke
                  </p>
                </div>
                <p className="font-body text-bea-charcoal text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                  {e.reflection}
                </p>
                {e.emotional_tone && (
                  <p className="font-serif text-sm text-bea-olive italic mt-4">
                    {e.emotional_tone}
                  </p>
                )}
              </article>
            ))}
          </div>
          {hasMore && (
            <div className="mt-10 md:mt-14">
              <ShowEarlierButton onClick={() => setWindowDays((d) => d + STEP_DAYS)} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function TimelineSection({ events, nowMs }: { events: TimelineEvent[]; nowMs: number }) {
  const [open, setOpen] = useState(false)
  const [windowDays, setWindowDays] = useState(INITIAL_DAYS)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const visible = useMemo(
    () => events.filter((e) => withinWindow(e.timestamp, nowMs, windowDays)),
    [events, nowMs, windowDays]
  )
  const hasMore = visible.length < events.length

  return (
    <section className="border-t border-bea-charcoal/10 pt-6 md:pt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between w-full group"
      >
        <h2 className="font-serif text-xl md:text-2xl text-bea-charcoal">
          Timeline
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-ui text-xs uppercase tracking-wide text-bea-blue">
            {events.length} {events.length === 1 ? 'entry' : 'entries'}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={1.5}
            className={`text-bea-olive transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </div>
      </button>

      <p className="font-body text-sm md:text-base text-bea-olive mt-3 leading-relaxed">
        A record of every time we&apos;ve spoken, and every time I&apos;ve listened.
      </p>

      {open && (
        <div className="mt-8 md:mt-10">
          {events.length === 0 ? (
            <p className="font-body text-bea-blue text-base md:text-lg leading-relaxed">
              Nothing yet.
            </p>
          ) : visible.length === 0 ? (
            <div>
              <p className="font-body text-bea-blue text-base md:text-lg leading-relaxed">
                Nothing in the last {windowDays} days.
              </p>
              {hasMore && (
                <ShowEarlierButton
                  onClick={() => setWindowDays((d) => d + STEP_DAYS)}
                />
              )}
            </div>
          ) : (
            <>
              <ol className="relative pl-8 md:pl-10">
                <span
                  aria-hidden
                  className="absolute left-1.25 md:left-1.75 top-2 bottom-2 w-px bg-bea-charcoal/15"
                />
                {visible.map((e) => (
                  <TimelineRow
                    key={e.id}
                    event={e}
                    expanded={expandedId === e.id}
                    onToggle={() =>
                      setExpandedId((cur) => (cur === e.id ? null : e.id))
                    }
                  />
                ))}
              </ol>
              {hasMore && (
                <div className="mt-10 md:mt-14">
                  <ShowEarlierButton
                    onClick={() => setWindowDays((d) => d + STEP_DAYS)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function ShowEarlierButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-4 font-ui text-sm uppercase tracking-wide text-bea-charcoal hover:opacity-70 transition-opacity"
    >
      <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16" />
      Show earlier
    </button>
  )
}

function TimelineRow({
  event,
  expanded,
  onToggle,
}: {
  event: TimelineEvent
  expanded: boolean
  onToggle: () => void
}) {
  const meta = KIND_META[event.kind]
  const Icon = meta.icon
  const preview = previewText(event)

  return (
    <li className="relative pb-10 md:pb-12 last:pb-0">
      <span
        aria-hidden
        className="absolute -left-8 md:-left-10 top-1 flex items-center justify-center w-2.75 h-2.75 rounded-full bg-bea-milk border border-bea-amber"
      />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="block text-left w-full group"
      >
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <Icon
            size={14}
            strokeWidth={1.5}
            className="text-bea-olive shrink-0"
            aria-hidden
          />
          <p className="font-ui text-xs uppercase tracking-wide text-bea-olive">
            {meta.label}
          </p>
          <span aria-hidden className="text-bea-charcoal/20">·</span>
          <p className="font-ui text-xs text-bea-blue">
            {formatDate(event.timestamp)}
          </p>
        </div>

        {preview ? (
          <p
            className={`font-body text-bea-charcoal text-base md:text-lg leading-relaxed whitespace-pre-wrap ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {preview}
          </p>
        ) : (
          <p className="font-body text-bea-blue/80 italic text-sm md:text-base">
            {event.kind === 'individual'
              ? 'A quiet conversation. I have not yet written about this one.'
              : 'I sat with your family.'}
          </p>
        )}
      </button>

      {expanded && (
        <div className="mt-4 md:mt-5 space-y-4 md:space-y-5">
          {event.reflection && event.reflection !== preview && (
            <p className="font-body text-bea-charcoal text-base md:text-lg leading-relaxed whitespace-pre-wrap">
              {event.reflection}
            </p>
          )}

          {event.emotional_tone && (
            <p className="font-serif text-sm md:text-base text-bea-olive italic">
              {event.emotional_tone}
            </p>
          )}

          {event.individual_themes.length > 0 && (
            <ThemeList label="What was present" themes={event.individual_themes} />
          )}

          {event.suggested_focus && (
            <DetailNote label="A small thread" body={event.suggested_focus} />
          )}

          {event.kind !== 'individual' && event.family_summary && (
            <DetailNote label="The family, together" body={event.family_summary} />
          )}

          {event.kind !== 'individual' && event.family_themes.length > 0 && (
            <ThemeList label="In the room" themes={event.family_themes} />
          )}

          {event.kind !== 'individual' && event.family_tone && (
            <p className="font-serif text-sm md:text-base text-bea-olive italic">
              {event.family_tone}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function ThemeList({ label, themes }: { label: string; themes: string[] }) {
  return (
    <div>
      <p className="font-ui text-xs uppercase tracking-wide text-bea-blue mb-2">
        {label}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {themes.map((t, i) => (
          <li
            key={`${t}-${i}`}
            className="font-body text-sm md:text-base text-bea-charcoal"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DetailNote({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="font-ui text-xs uppercase tracking-wide text-bea-blue mb-2">
        {label}
      </p>
      <p className="font-body text-bea-charcoal text-sm md:text-base leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    </div>
  )
}
