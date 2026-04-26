'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConversation, ConversationProvider } from '@elevenlabs/react'
import PageBackground from '@/components/page-background'
import VoiceBars from '@/components/voice-bars'
import { DEMO_SESSION_CAP_SECS } from '@/lib/auth'

interface Member {
  id: string
  name: string
  role: string
  status: string
}

interface TranscriptMessage {
  role: 'user' | 'agent'
  message: string
  time_in_call_secs: number
}

type Phase = 'roster' | 'connecting' | 'live' | 'uploading' | 'done' | 'error'

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const mt of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) {
      return mt
    }
  }
  return ''
}

function FamilyCheckInUI({ householdVision, isDemo }: { householdVision: string | null; isDemo: boolean }) {
  const router = useRouter()

  const [members, setMembers] = useState<Member[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('roster')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const transcriptRef = useRef<TranscriptMessage[]>([])
  const startTimeRef = useRef<number>(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordStreamRef = useRef<MediaStream | null>(null)
  const demoCapTimerRef = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/members')
      .then((r) => {
        if (!r.ok) throw new Error('members fetch failed')
        return r.json() as Promise<Member[]>
      })
      .then((data) => {
        const present = data.filter(
          (m) => m.status === 'active' || m.status === 'held',
        )
        setMembers(present)
        setSelected(new Set())
      })
      .catch(() => setMembers([]))
  }, [])

  useEffect(() => {
    return () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const conversation = useConversation({
    onConnect: () => {
      transcriptRef.current = []
      startTimeRef.current = Date.now()
      setPhase('live')
      if (isDemo) {
        if (demoCapTimerRef.current) window.clearTimeout(demoCapTimerRef.current)
        demoCapTimerRef.current = window.setTimeout(() => {
          if (conversation.status === 'connected') conversation.endSession()
        }, DEMO_SESSION_CAP_SECS * 1000)
      }
    },
    onMessage: (msg: { source: 'user' | 'ai'; message: string }) => {
      transcriptRef.current.push({
        role: msg.source === 'ai' ? 'agent' : 'user',
        message: msg.message,
        time_in_call_secs: (Date.now() - startTimeRef.current) / 1000,
      })
    },
    onDisconnect: () => {
      if (demoCapTimerRef.current) {
        window.clearTimeout(demoCapTimerRef.current)
        demoCapTimerRef.current = null
      }
      void finalize()
    },
    onError: (error: unknown) => {
      console.error('ElevenLabs Error:', error)
      setErrorMsg('Bea could not stay connected.')
      setPhase('error')
    },
  })

  async function startSession() {
    setErrorMsg(null)
    setPhase('connecting')

    let recordStream: MediaStream
    try {
      recordStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: { ideal: 16_000 },
        },
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Microphone access failed.')
      setPhase('error')
      return
    }
    recordStreamRef.current = recordStream

    const mimeType = pickMimeType()
    const recorder = mimeType
      ? new MediaRecorder(recordStream, { mimeType })
      : new MediaRecorder(recordStream)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    })
    recorder.start(1000)

    const ctx: Record<string, string> = await fetch('/api/guardian/context')
      .then((r) => {
        if (!r.ok) throw new Error('context fetch failed')
        return r.json()
      })
      .catch((err) => {
        console.error('Guardian context fetch failed — proceeding with fallback:', err)
        return {}
      })

    try {
      conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        dynamicVariables: {
          user_name: 'family',
          user_member_id: '',
          mode: 'family',
          last_checkin_date: ctx.last_checkin_date ?? 'unknown',
          individual_summary: ctx.individual_summary ?? 'No previous check-in on record.',
          family_summary: ctx.family_summary ?? 'No family check-ins on record.',
          emotional_tone: ctx.emotional_tone ?? 'unknown',
          open_threads: ctx.open_threads ?? 'None on record.',
          listening_direction: ctx.listening_direction ?? 'Listen openly to whoever is in the room.',
          listening_priority: ctx.listening_priority ?? 'Listen for what the family most needs to be heard on, without having to ask.',
          household_vision: ctx.household_vision || 'Not yet set.',
          individual_vision: 'Not applicable in family mode.',
        },
      })
    } catch (err) {
      console.error('startSession failed:', err)
      setErrorMsg('Bea could not arrive.')
      setPhase('error')
      stopRecorder()
    }
  }

  function stopRecorder() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {}
    }
    recordStreamRef.current?.getTracks().forEach((t) => t.stop())
  }

  async function finalize() {
    setPhase('uploading')

    const recorder = recorderRef.current
    if (!recorder) {
      setErrorMsg('No recording captured.')
      setPhase('error')
      return
    }

    const stopped: Promise<void> = new Promise((resolve) => {
      if (recorder.state === 'inactive') {
        resolve()
        return
      }
      recorder.addEventListener('stop', () => resolve(), { once: true })
      try {
        recorder.stop()
      } catch {
        resolve()
      }
    })
    await stopped
    recordStreamRef.current?.getTracks().forEach((t) => t.stop())

    if (chunksRef.current.length === 0) {
      setErrorMsg('No audio was captured.')
      setPhase('error')
      return
    }

    const endedAt = new Date().toISOString()
    const startedAt = new Date(startTimeRef.current).toISOString()
    const mimeType = recorder.mimeType || 'audio/webm'
    const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
    const audioBlob = new Blob(chunksRef.current, { type: mimeType })

    const roster = (members ?? [])
      .filter((m) => selected.has(m.id))
      .map((m) => ({
        member_id: m.id,
        name: m.name,
        consented: m.status === 'active',
      }))

    const form = new FormData()
    form.append('audio', audioBlob, `family-${Date.now()}.${extension}`)
    form.append('started_at', startedAt)
    form.append('ended_at', endedAt)
    form.append('roster', JSON.stringify(roster))
    form.append('kind', 'guided')
    form.append('eleven_labs_transcript', JSON.stringify(transcriptRef.current))

    try {
      const res = await fetch('/api/listen/finalize', { method: 'POST', body: form })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`Upload failed (${res.status}): ${detail.slice(0, 200)}`)
      }
      setPhase('done')
      setTimeout(() => router.push('/'), 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.')
      setPhase('error')
    }
  }

  const isConnected = conversation.status === 'connected'

  if (phase === 'roster') {
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        {householdVision && (
          <div className="mb-8 md:mb-12 pb-6 md:pb-8 border-b border-bea-charcoal/20">
            <p className="font-ui text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-bea-amber mb-2 sm:mb-3">
              Whānau vision
            </p>
            <p className="font-body italic text-lg md:text-xl text-bea-charcoal leading-snug">
              &ldquo;{householdVision}&rdquo;
            </p>
          </div>
        )}

        <header className="mb-8 md:mb-12">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            Kia ora, whānau.
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
            A kōrero for everyone in the room. Who&apos;s here?
          </p>
        </header>

        {!members && <p className="font-body text-bea-blue">Loading whānau…</p>}

        {members && members.length === 0 && (
          <p className="font-body text-bea-clay">
            No whānau on record yet. Add members first, then come back.
          </p>
        )}

        {members && members.length > 0 && (
          <button
            onClick={() => {
              setSelected(new Set(members.map((m) => m.id)))
              startSession()
            }}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 mb-8 md:mb-12"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16" />
            Everyone&apos;s here
          </button>
        )}

        {members && members.length > 0 && (
          <p className="font-ui text-xs text-bea-blue/70 italic mb-4">
            Or choose who is here:
          </p>
        )}

        {members && members.length > 0 && (
          <div className="mb-8 md:mb-12">
            <div className="grid grid-cols-3 gap-3">
              {members.map((m) => {
                const on = selected.has(m.id)
                const consented = m.status === 'active'
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    aria-pressed={on}
                    className={`flex flex-col items-center justify-center text-center px-3 py-5 rounded-2xl border transition-all duration-200 ${
                      on
                        ? 'bg-bea-amber border-bea-amber text-bea-charcoal shadow-md ring-2 ring-bea-amber/40 ring-offset-2 ring-offset-bea-milk'
                        : 'bg-bea-milk border-bea-charcoal/25 text-bea-charcoal'
                    }`}
                  >
                    <span className="font-body text-lg md:text-xl leading-tight">
                      {m.name}
                      {!consented && (
                        <span className="text-bea-charcoal/60" aria-hidden>*</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            {members.some((m) => m.status !== 'active') && (
              <p className="font-ui text-[11px] text-bea-blue/70 italic mt-3">
                * no record kept
              </p>
            )}
          </div>
        )}

        {members && members.length > 0 && (
          <button
            onClick={startSession}
            disabled={selected.size === 0}
            className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500 disabled:opacity-30"
          >
            Begin with selection
          </button>
        )}
      </div>
    )
  }

  if (phase === 'connecting' || phase === 'live') {
    return (
      <div className="flex flex-col items-center justify-between flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <PageBackground variant="witness" />

        <div className="text-center w-full space-y-4">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            {isConnected ? 'I am here.' : 'Arriving…'}
          </h1>
          {isConnected && (
            <p className="font-body text-base md:text-lg text-bea-olive italic">
              {conversation.isSpeaking ? 'I am speaking.' : 'I am listening.'}
            </p>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center w-full my-16">
          {isConnected ? (
            <VoiceBars
              getFrequencyData={() =>
                conversation.isSpeaking
                  ? conversation.getOutputByteFrequencyData()
                  : conversation.getInputByteFrequencyData()
              }
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-bea-blue/30 animate-pulse" />
          )}
        </div>

        <button
          onClick={() => {
            if (conversation.status === 'connected') conversation.endSession()
            else router.push('/')
          }}
          className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
        >
          {isConnected ? 'Finish kōrero' : 'Cancel'}
        </button>
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight text-center">
          Taking note of what I heard…
        </h1>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
        <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight text-center">
          Kept safely.
        </h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm md:max-w-md lg:max-w-lg mx-auto w-full animate-fade-in">
      <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight text-center mb-6">
        Something stopped us.
      </h1>
      {errorMsg && (
        <p className="font-body text-bea-clay text-sm text-center mb-8">{errorMsg}</p>
      )}
      <button
        onClick={() => {
          setPhase('roster')
          setErrorMsg(null)
        }}
        className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
      >
        Try again
      </button>
    </div>
  )
}

export default function FamilyCheckIn({ householdVision, isDemo }: { householdVision: string | null; isDemo: boolean }) {
  return (
    <ConversationProvider>
      <FamilyCheckInUI householdVision={householdVision} isDemo={isDemo} />
    </ConversationProvider>
  )
}
