'use client'

import { useEffect, useRef, useState } from 'react'
import { useConversation, ConversationProvider } from '@elevenlabs/react'
import PageBackground from '@/components/page-background'
import VoiceBars from '@/components/voice-bars'

type Schedule = {
  id: string
  label: string
  days: string[]
  time: string
  mode: 'listen' | 'checkin' | 'group'
  active: boolean
}

const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getNextSession(schedules: Schedule[]): { schedule: Schedule; label: string } | null {
  const now = new Date()
  const todayIdx = now.getDay()
  const currentMins = now.getHours() * 60 + now.getMinutes()

  const active = schedules.filter((s) => s.active)
  if (!active.length) return null

  let best: { schedule: Schedule; minsUntil: number } | null = null

  for (const s of active) {
    const [h, m] = s.time.split(':').map(Number)
    const sessionMins = h * 60 + m

    for (let offset = 0; offset < 7; offset++) {
      const dayIdx = (todayIdx + offset) % 7
      const dayKey = DAYS_OF_WEEK[dayIdx]
      if (!s.days.includes(dayKey)) continue

      const minsUntil = offset * 1440 + sessionMins - currentMins
      if (minsUntil <= 0 && offset === 0) continue 

      if (!best || minsUntil < best.minsUntil) {
        best = { schedule: s, minsUntil }
      }
      break
    }
  }

  if (!best) return null

  const mins = best.minsUntil
  let label: string
  if (mins < 1) {
    label = 'starting now'
  } else if (mins < 60) {
    label = `in ${mins} minute${mins !== 1 ? 's' : ''}`
  } else if (mins < 1440) {
    const hrs = Math.floor(mins / 60)
    label = `in ${hrs} hour${hrs !== 1 ? 's' : ''}`
  } else {
    const days = Math.floor(mins / 1440)
    label = `in ${days} day${days !== 1 ? 's' : ''}`
  }

  return { schedule: best.schedule, label }
}

function isDue(schedule: Schedule): boolean {
  const now = new Date()
  const todayKey = DAYS_OF_WEEK[now.getDay()]
  if (!schedule.days.includes(todayKey)) return false
  const [h, m] = schedule.time.split(':').map(Number)
  return now.getHours() === h && now.getMinutes() === m
}

// True 5 minutes (±30s window) before a scheduled start.
function isStartingSoon(schedule: Schedule): boolean {
  const now = new Date()
  const start = new Date(now)
  const [h, m] = schedule.time.split(':').map(Number)
  start.setHours(h, m, 0, 0)
  const minsUntil = (start.getTime() - now.getTime()) / 60_000
  if (minsUntil < 4.5 || minsUntil > 5.5) return false
  return schedule.days.includes(DAYS_OF_WEEK[start.getDay()])
}

async function notify(payload: { title: string; body: string; tag?: string; url?: string; category?: 'advance' | 'start' | 'end' }) {
  try {
    await fetch('/api/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('notify failed:', err)
  }
}

const MODE_LABEL = {
  listen: 'Listen quietly',
  checkin: 'Individual kōrero',
  group: 'Whānau kōrero',
}

type ActiveSession = { label: string; mode: 'listen' | 'checkin' | 'group' }

const LISTEN_DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hr', ms: 60 * 60 * 1000 },
]

function HouseholdScreen({ householdVision }: { householdVision: string }) {
  const [time, setTime] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [sessionState, setSessionState] = useState<'idle' | 'listening' | 'connecting' | 'live' | 'ending'>('idle')
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const transcriptRef = useRef<{ role: string; message: string; time_in_call_secs: number }[]>([])
  const startTimeRef = useRef(0)
  const listenIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const warnedRef = useRef<Set<string>>(new Set())

  const stopListening = async () => {
    if (listenIntervalRef.current) {
      clearTimeout(listenIntervalRef.current)
      listenIntervalRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    recorderRef.current = null

    await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptRef.current.length
          ? transcriptRef.current
          : [{ role: 'user', message: '[Passive listening session]', time_in_call_secs: 0 }],
        started_at: new Date(startTimeRef.current).toISOString(),
        call_duration_secs: (Date.now() - startTimeRef.current) / 1000,
      }),
    }).catch(console.error)

    notify({
      title: 'Bea has stopped listening',
      body: 'The room is private again.',
      tag: 'bea-listen',
      category: 'end',
    })

    setEndsAt(null)
    setSessionState('idle')
    setActiveSession(null)
  }

  const startListening = async (label: string, durationMs: number) => {
    setActiveSession({ label, mode: 'listen' })
    setSessionState('listening')
    startTimeRef.current = Date.now()
    transcriptRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.start()

      setEndsAt(Date.now() + durationMs)
      listenIntervalRef.current = setTimeout(stopListening, durationMs)

      notify({
        title: 'Bea is listening quietly',
        body: label,
        tag: 'bea-listen',
        category: 'start',
      })
    } catch {
      setSessionState('idle')
      setActiveSession(null)
      setEndsAt(null)
    }
  }

  const conversation = useConversation({
    onConnect: () => {
      setSessionState('live')
      notify({
        title: 'Bea has begun a whānau kōrero',
        body: 'She is in the room now.',
        tag: 'bea-household',
        category: 'start',
      })
    },
    onMessage: (msg: { source: 'user' | 'ai'; message: string }) => {
      transcriptRef.current.push({
        role: msg.source === 'ai' ? 'agent' : 'user',
        message: msg.message,
        time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      })
    },
    onDisconnect: async () => {
      setSessionState('ending')
      if (transcriptRef.current.length > 0) {
        await fetch('/api/check-ins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptRef.current,
            agent_id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
            started_at: new Date(startTimeRef.current).toISOString(),
            call_duration_secs: (Date.now() - startTimeRef.current) / 1000,
          }),
        }).catch(console.error)
      }
      notify({
        title: 'Whānau kōrero has ended',
        body: 'Bea is taking note of what she heard.',
        tag: 'bea-household',
        category: 'end',
      })
      setTimeout(() => {
        setSessionState('idle')
        setActiveSession(null)
        transcriptRef.current = []
      }, 3000)
    },
    onError: () => setSessionState('idle'),
  })

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const load = () =>
      fetch('/api/schedules')
        .then((r) => r.json())
        .then((d) => setSchedules(d.schedules ?? []))
        .catch(console.error)
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (sessionState !== 'idle') return

    const check = async () => {
      // 5-minute advance warnings for upcoming household sessions.
      for (const s of schedules) {
        if (!s.active) continue
        if (s.mode !== 'listen' && s.mode !== 'group') continue
        if (!isStartingSoon(s)) continue
        const today = new Date().toISOString().slice(0, 10)
        const key = `${s.id}-${today}-${s.time}`
        if (warnedRef.current.has(key)) continue
        warnedRef.current.add(key)
        const phrase = s.mode === 'listen'
          ? 'Bea will start listening quietly in 5 minutes'
          : 'Bea will start a whānau kōrero in 5 minutes'
        notify({ title: phrase, body: s.label, tag: `bea-soon-${s.id}`, category: 'advance' })
      }

      const due = schedules.find(isDue)
      if (!due) return

      if (due.mode === 'listen') {
        await startListening(due.label, 15 * 60 * 1000)
      } else {
        setActiveSession({ label: due.label, mode: due.mode })
        setSessionState('connecting')
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })
          const ctx = await fetch('/api/guardian/context').then((r) => r.json()).catch(() => ({}))
          startTimeRef.current = Date.now()
          transcriptRef.current = []

          await conversation.startSession({
            agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
            dynamicVariables: {
              user_name: 'the family',
              user_member_id: '',
              last_checkin_date: ctx.last_checkin_date ?? 'unknown',
              individual_summary: ctx.individual_summary ?? 'No previous sessions.',
              family_summary: ctx.family_summary ?? 'No family sessions on record.',
              emotional_tone: ctx.emotional_tone ?? 'unknown',
              open_threads: ctx.open_threads ?? 'None.',
              listening_direction: ctx.listening_direction ?? 'Listen openly.',
            },
          })
        } catch {
          setSessionState('idle')
          setActiveSession(null)
        }
      }
    }

    const id = setInterval(check, 60_000)
    check() 
    return () => {
      clearInterval(id)
      if (listenIntervalRef.current) clearTimeout(listenIntervalRef.current)
    }
  }, [schedules, sessionState, conversation])

  const next = getNextSession(schedules)

  return (
    // Centered layout makes sense here because it acts like an ambient clock/display
    <div className="relative flex flex-col items-center min-h-[85vh] text-center w-full px-4 animate-fade-in">
      <PageBackground variant="rest" />

      {householdVision && (
        <div className="w-full max-w-xl mx-auto pt-6 md:pt-10 px-6">
          <p className="font-ui text-xs uppercase tracking-wide text-bea-blue mb-2">
            This whānau is growing toward
          </p>
          <p className="font-body text-base md:text-lg text-bea-charcoal italic leading-relaxed">
            {householdVision}
          </p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full">

      {/* ── IDLE STATE ────────────────────────────────────── */}
      {sessionState === 'idle' && (
        <div className="flex flex-col items-center w-full max-w-md animate-fade-in">
          
          <div className="space-y-3 md:space-y-4 mb-12 md:mb-20">
            <p className="font-body text-5xl md:text-8xl text-bea-charcoal tracking-tight">
              {time}
            </p>
            <p className="font-body text-base md:text-xl text-bea-olive">
              {new Date().toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
              Kia ora, whānau. I&apos;m ready for your check-in when you are.
            </p>
          </div>

          <div className="space-y-10 md:space-y-16 w-full">
            {/* Elegant text replacement for the Schedule Card */}
            <div>
              {next ? (
                <p className="font-body text-base md:text-lg text-bea-charcoal leading-relaxed">
                  I&apos;ll be present for <span className="italic">{next.schedule.label}</span> {next.label}.
                </p>
              ) : (
                <p className="font-body text-base md:text-lg text-bea-olive">
                  I don&apos;t have any rhythms scheduled today.
                </p>
              )}
            </div>

            {/* Elegant replacement for the Manual Start Grid */}
            <div className="pt-6 md:pt-8 border-t border-bea-charcoal/10">
              <p className="font-ui text-sm text-bea-blue mb-4 md:mb-6">Or, I can listen quietly now for:</p>
              <div className="flex items-center justify-center gap-6">
                {LISTEN_DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => startListening('Listening quietly', d.ms)}
                    className="font-body text-base md:text-lg text-bea-charcoal hover:text-bea-amber transition-colors duration-500"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="font-ui text-xs text-bea-blue/50 pt-6 md:pt-8">
              Leave this screen open in the room.
            </p>
          </div>
        </div>
      )}

      {/* ── PASSIVE LISTENING STATE ────────────────────────── */}
      {sessionState === 'listening' && activeSession && (
        <div className="flex flex-col items-center animate-fade-in space-y-12">
          {/* A quiet, slow-breathing amber circle instead of a bouncing microphone */}
          <div className="w-4 h-4 rounded-full bg-bea-amber/60 animate-[pulse_4s_ease-in-out_infinite] shadow-[0_0_15px_rgba(214,168,90,0.3)]"></div>
          
          <div className="space-y-4">
            <p className="font-body text-2xl md:text-3xl text-bea-charcoal">{activeSession.label}.</p>
            <p className="font-body text-base md:text-lg text-bea-olive">Whakarongo. I am listening to the room.</p>
            {endsAt && (
              <p className="font-ui text-sm text-bea-blue pt-2">
                We will finish at {new Date(endsAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>

          <button
            onClick={stopListening}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 pt-8"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            Finish early
          </button>
        </div>
      )}

      {/* ── CONNECTING STATE ───────────────────────────────── */}
      {sessionState === 'connecting' && (
        <div className="flex flex-col items-center animate-fade-in space-y-8">
          <p className="font-body text-2xl md:text-3xl text-bea-blue animate-pulse">Arriving...</p>
        </div>
      )}

      {/* ── LIVE CONVERSATION STATE ────────────────────────── */}
      {sessionState === 'live' && activeSession && (
        <div className="flex flex-col items-center animate-fade-in space-y-12">
          <VoiceBars
            getFrequencyData={() =>
              conversation.isSpeaking
                ? conversation.getOutputByteFrequencyData()
                : conversation.getInputByteFrequencyData()
            }
          />

          <div className="space-y-4">
            <p className="font-body text-2xl md:text-3xl text-bea-charcoal">{activeSession.label}.</p>
            <p className="font-body text-base md:text-lg text-bea-olive italic transition-opacity duration-500">
              {conversation.isSpeaking ? 'I am speaking.' : 'I am listening.'}
            </p>
          </div>

          <button
            onClick={() => conversation.endSession()}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 pt-8"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16"></span>
            Finish kōrero
          </button>
        </div>
      )}

      {/* ── ENDING STATE ───────────────────────────────────── */}
      {sessionState === 'ending' && (
        <div className="flex flex-col items-center animate-fade-in space-y-4">
          <p className="font-body text-2xl md:text-3xl text-bea-charcoal">We are finished.</p>
          <p className="font-body text-base md:text-lg text-bea-olive">Taking note of what I heard...</p>
        </div>
      )}

      </div>
    </div>
  )
}

export default function HouseholdClient({ householdVision }: { householdVision: string }) {
  return (
    <ConversationProvider>
      <HouseholdScreen householdVision={householdVision} />
    </ConversationProvider>
  )
}