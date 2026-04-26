'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageBackground from '@/components/page-background'

type Schedule = {
  id: string
  label: string
  days: string[]
  time: string
  mode: 'listen' | 'checkin' | 'group'
  active: boolean
}

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

const MODE_META = {
  listen: {
    label: 'Listen quietly',
    description: "I'll listen in the background without speaking.",
  },
  checkin: {
    label: 'Individual check-in',
    description: 'A dedicated moment with one person.',
  },
  group: {
    label: 'Whānau kōrero',
    description: 'A moment to speak with everyone present.',
  },
}

const EMPTY_FORM = {
  label: '',
  days: [] as string[],
  time: '18:00',
  mode: 'listen' as Schedule['mode'],
}

export default function ScheduleClient({ isPrimary }: { isPrimary: boolean }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/schedules')
      .then((r) => r.json())
      .then((d) => setSchedules(d.schedules ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }))
  }

  const handleAdd = async () => {
    if (!form.label || !form.days.length || !form.time) return
    setSaving(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.schedule) {
        setSchedules((s) => [...s, data.schedule])
        setForm(EMPTY_FORM)
        setShowForm(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (schedule: Schedule) => {
    const updated = { ...schedule, active: !schedule.active }
    setSchedules((s) => s.map((x) => (x.id === schedule.id ? updated : x)))
    await fetch(`/api/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: updated.active }),
    }).catch(console.error)
  }

  const handleDelete = async (id: string) => {
    setSchedules((s) => s.filter((x) => x.id !== id))
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' }).catch(console.error)
  }

  // ─────────────────────────────────────────────────────────────────
  // VIEW 1: THE FORM (Add new schedule)
  // ─────────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div key="form-view" className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 animate-fade-in max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full">
        <PageBackground variant="forward" />

        <header className="mb-8 md:mb-12">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            When shall we make time?
          </h1>
        </header>

        <div className="space-y-8 md:space-y-12">
          {/* Label Input */}
          <div>
            <input
              type="text"
              placeholder="e.g. Sunday dinner..."
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="w-full bg-transparent border-b border-bea-charcoal/20 pb-3 md:pb-4 font-body text-xl md:text-2xl text-bea-charcoal placeholder:text-bea-blue/40 focus:outline-none focus:border-bea-amber transition-colors rounded-none"
            />
          </div>

          {/* Time Input */}
          <div>
            <p className="font-body text-base md:text-lg text-bea-charcoal mb-3 md:mb-4">At what time?</p>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="bg-transparent border-b border-bea-charcoal/20 pb-2 font-body text-xl md:text-2xl text-bea-charcoal focus:outline-none focus:border-bea-amber w-32 rounded-none"
            />
          </div>

          {/* Days Selection (Replaced pills with quiet text links) */}
          <div>
            <p className="font-body text-base md:text-lg text-bea-charcoal mb-3 md:mb-4">On which days?</p>
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {ALL_DAYS.map((day) => {
                const isActive = form.days.includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`font-ui text-sm transition-colors duration-500 ${
                      isActive ? 'text-bea-charcoal border-b border-bea-charcoal pb-0.5' : 'text-bea-blue hover:text-bea-olive'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mode Selection (Replaced boxes with a list) */}
          <div className="pt-4 border-t border-bea-charcoal/10">
            <p className="font-body text-base md:text-lg text-bea-charcoal mb-4 md:mb-6">How should I be present?</p>
            <div className="space-y-4 md:space-y-6">
              {(Object.keys(MODE_META) as Schedule['mode'][]).map((mode) => {
                const meta = MODE_META[mode]
                const isActive = form.mode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setForm((f) => ({ ...f, mode }))}
                    className={`block w-full text-left transition-opacity duration-500 ${
                      isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Quiet indicator dot instead of full background color */}
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-bea-amber' : 'bg-transparent'}`}></span>
                      <div>
                        <p className="font-body text-base md:text-lg text-bea-charcoal">{meta.label}</p>
                        <p className="font-ui text-xs md:text-sm text-bea-olive mt-1">{meta.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-6 pt-10 md:pt-16">
          <button
            onClick={handleAdd}
            disabled={saving || !form.label || !form.days.length}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 disabled:opacity-30"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            {saving ? 'Taking note...' : 'Confirm'}
          </button>

          <button
            onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
            className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500 self-start"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // VIEW 2: THE LIST (Existing schedules)
  // ─────────────────────────────────────────────────────────────────
  return (
    <div key="list-view" className="flex flex-col flex-1 pt-8 pb-8 md:pt-12 md:pb-12 animate-fade-in w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto">
      <PageBackground variant="forward" />

      {/* Header */}
      <div className="flex flex-col gap-4 md:gap-6 mb-10 md:mb-16">
        <Link href="/" className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500">
          ← Return
        </Link>
        <div className="flex flex-col gap-3 md:gap-4">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            Rhythms
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed">
            The times you&rsquo;ve set for me to be present.
          </p>
        </div>
      </div>

      {/* Schedule list */}
      {loading ? (
        <p className="font-ui text-sm text-bea-blue animate-pulse">Recollecting...</p>
      ) : schedules.length === 0 ? (
        <div className="border-t border-bea-charcoal/10 pt-6 md:pt-8">
          <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed mb-6 md:mb-8">
            I don&apos;t have any times set to be present yet.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            Establish a rhythm
          </button>
        </div>
      ) : (
        <div className="space-y-8 md:space-y-12">
          {schedules.map((schedule) => {
            const meta = MODE_META[schedule.mode]
            return (
              <div
                key={schedule.id}
                className={`flex flex-col gap-3 md:gap-4 transition-opacity duration-1000 ${
                  schedule.active ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div>
                  <h3 className="font-serif text-lg md:text-2xl text-bea-charcoal mb-2">
                    {schedule.label}
                  </h3>
                  <p className="font-body text-sm md:text-base text-bea-olive">
                    {schedule.time} on {schedule.days.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')}.
                  </p>
                  <p className="font-ui text-xs md:text-sm text-bea-blue mt-1">
                    {meta.label}
                  </p>
                </div>

                {/* Replaced Toggles and Trash Icons with intentional text buttons */}
                <div className="flex gap-6 pt-2">
                  <button
                    onClick={() => toggleActive(schedule)}
                    className="font-ui text-xs tracking-wide text-bea-charcoal hover:text-bea-amber transition-colors duration-500 uppercase"
                  >
                    {schedule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="font-ui text-xs tracking-wide uppercase text-bea-clay/70 hover:text-bea-clay transition-colors duration-500"
                  >
                    Remove
                  </button>
                </div>
                <div className="w-full h-px bg-bea-charcoal/5 mt-4"></div>
              </div>
            )
          })}

          <div className="pt-6 md:pt-8">
            <button
              onClick={() => setShowForm(true)}
              className="font-ui text-sm text-bea-blue hover:text-bea-charcoal border-b border-bea-blue/30 pb-1 transition-colors duration-500"
            >
              Add another
            </button>
          </div>
        </div>
      )}

      {/* Household mode link — primary members only */}
      {isPrimary && schedules.length > 0 && (
        <div className="mt-12 md:mt-20 pt-6 md:pt-8 border-t border-bea-charcoal/10">
          <p className="font-body text-base md:text-lg text-bea-olive leading-relaxed mb-4">
            If you&apos;re leaving a device in the room for me to listen, you can open the whānau view.
          </p>
          <Link
            href="/household"
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            Open view
          </Link>
        </div>
      )}
    </div>
  )
}