'use client'

import { useEffect, useState } from 'react'

type Schedule = {
  id: string
  label: string
  days: string[]
  time: string
  mode: 'listen' | 'checkin' | 'group'
  active: boolean
}

const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const MODE_PHRASE: Record<Schedule['mode'], string> = {
  listen: 'will be listening quietly',
  checkin: 'will hold an individual check-in',
  group: 'will hold a whānau kōrero',
}

function nextHouseholdSession(schedules: Schedule[]) {
  const household = schedules.filter((s) => s.active && (s.mode === 'listen' || s.mode === 'group'))
  if (!household.length) return null

  const now = new Date()
  const todayIdx = now.getDay()
  const currentMins = now.getHours() * 60 + now.getMinutes()

  let best: { schedule: Schedule; minsUntil: number; when: Date } | null = null

  for (const s of household) {
    const [h, m] = s.time.split(':').map(Number)
    const sessionMins = h * 60 + m
    for (let offset = 0; offset < 7; offset++) {
      const dayIdx = (todayIdx + offset) % 7
      if (!s.days.includes(DAYS_OF_WEEK[dayIdx])) continue
      const minsUntil = offset * 1440 + sessionMins - currentMins
      if (minsUntil <= 0 && offset === 0) continue
      const when = new Date(now)
      when.setDate(when.getDate() + offset)
      when.setHours(h, m, 0, 0)
      if (!best || minsUntil < best.minsUntil) best = { schedule: s, minsUntil, when }
      break
    }
  }
  return best
}

function relativeLabel(when: Date, minsUntil: number): string {
  if (minsUntil < 60) return `in ${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`
  const today = new Date()
  const isToday = when.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = when.toDateString() === tomorrow.toDateString()
  const time = when.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return `today at ${time}`
  if (isTomorrow) return `tomorrow at ${time}`
  const day = when.toLocaleDateString('en-NZ', { weekday: 'long' })
  return `${day} at ${time}`
}

export default function UpcomingHouseholdRhythm() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/schedules')
        .then((r) => r.json())
        .then((d) => setSchedules(d.schedules ?? []))
        .catch(() => setSchedules([]))
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (schedules === null) return null
  const next = nextHouseholdSession(schedules)
  if (!next) return null

  return (
    <p className="font-body text-bea-olive text-base md:text-lg leading-relaxed max-w-sm">
      I {MODE_PHRASE[next.schedule.mode]} {relativeLabel(next.when, next.minsUntil)}.
    </p>
  )
}
