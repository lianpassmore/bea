'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import VoiceBars from '@/components/voice-bars'

interface Member {
  id: string
  name: string
  role: string
  status: string
  consent_given?: boolean
}

type Phase = 'roster' | 'recording' | 'uploading' | 'done' | 'error'

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

export default function ListenClient() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('roster')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef<number>(0)
  const timerRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBinsRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    fetch('/api/members')
      .then((r) => r.json() as Promise<Member[]>)
      .then((data) => {
        const present = data.filter(
          (m) => m.status === 'active' || m.status === 'held',
        )
        setMembers(present)
        setSelected(new Set(present.map((m) => m.id)))
      })
      .catch(() => setMembers([]))
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      audioCtxRef.current?.close().catch(() => {})
      streamRef.current?.getTracks().forEach((t) => t.stop())
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

  async function startRecording() {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: { ideal: 16_000 },
        },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      })

      recorder.start(1000)
      startedAtRef.current = Date.now()
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 1000)

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const audioCtx = new AudioCtx()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.75
        source.connect(analyser)
        audioCtxRef.current = audioCtx
        analyserRef.current = analyser
        freqBinsRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      }

      setPhase('recording')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Microphone access failed.')
      setPhase('error')
    }
  }

  async function stopAndUpload() {
    const recorder = recorderRef.current
    if (!recorder) return
    setPhase('uploading')

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    analyserRef.current = null
    freqBinsRef.current = null
    await audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null

    const stopped: Promise<void> = new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true })
    })
    recorder.stop()
    await stopped
    streamRef.current?.getTracks().forEach((t) => t.stop())

    const endedAt = new Date().toISOString()
    const startedAt = new Date(startedAtRef.current).toISOString()
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
    form.append('audio', audioBlob, `listen-${Date.now()}.${extension}`)
    form.append('started_at', startedAt)
    form.append('ended_at', endedAt)
    form.append('roster', JSON.stringify(roster))

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

  function formatElapsed(s: number): string {
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  if (phase === 'roster') {
    return (
      <div className="flex flex-col flex-1 pt-12 pb-8 md:pt-20 md:pb-12 max-w-sm mx-auto w-full animate-fade-in">
        <header className="mb-8 md:mb-12">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            Who is in the room?
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive mt-4 md:mt-6 leading-relaxed">
            I will listen quietly, and notice what I can.
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
              startRecording()
            }}
            className="group inline-flex items-center gap-4 font-body text-base md:text-lg text-bea-charcoal transition-opacity hover:opacity-70 mb-8 md:mb-12"
          >
            <span className="h-px w-8 bg-bea-amber transition-all duration-700 group-hover:w-16" />
            All whānau
          </button>
        )}

        {members && members.length > 0 && (
          <p className="font-ui text-xs text-bea-blue/70 italic mb-4">
            Or choose who is here:
          </p>
        )}

        {members && members.length > 0 && (
          <div className="flex flex-col gap-2 mb-8 md:mb-12">
            {members.map((m) => {
              const on = selected.has(m.id)
              const consented = m.status === 'active'
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className={`flex items-center justify-between py-2.5 border-b transition-colors duration-500 ${
                    on ? 'border-bea-amber/60' : 'border-bea-charcoal/10'
                  }`}
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-serif text-lg md:text-2xl text-bea-charcoal">{m.name}</span>
                    {!consented && (
                      <span className="font-ui text-xs text-bea-blue/70 italic mt-1">
                        no record kept
                      </span>
                    )}
                  </div>
                  <span className="font-ui text-xs text-bea-amber">
                    {on ? 'Here' : 'Not here'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-6">
          <button
            onClick={startRecording}
            disabled={!members || members.length === 0}
            className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500 disabled:opacity-30"
          >
            Begin with selection
          </button>
          <button
            onClick={() => {
              setSelected(new Set())
              startRecording()
            }}
            className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'recording') {
    return (
      <div className="flex flex-col items-center justify-between flex-1 py-12 md:py-20 max-w-sm mx-auto w-full animate-fade-in">
        <div className="text-center w-full space-y-4">
          <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
            I am listening.
          </h1>
          <p className="font-body text-base md:text-lg text-bea-olive italic">
            {formatElapsed(elapsed)}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center w-full my-16">
          <VoiceBars
            getFrequencyData={() => {
              const a = analyserRef.current
              const bins = freqBinsRef.current
              if (!a || !bins) return null
              a.getByteFrequencyData(bins)
              return bins
            }}
          />
        </div>

        <button
          onClick={stopAndUpload}
          className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500"
        >
          Finish listening
        </button>
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm mx-auto w-full animate-fade-in">
        <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight text-center">
          Taking note of what I heard…
        </h1>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm mx-auto w-full animate-fade-in">
        <h1 className="font-serif text-2xl md:text-3xl text-bea-charcoal leading-tight text-center">
          Kept safely.
        </h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 md:py-20 max-w-sm mx-auto w-full animate-fade-in">
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
