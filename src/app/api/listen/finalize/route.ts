import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// Azure Fast Transcription — the Speech service, same key/region already
// configured for the (dropped) speaker recognition path. Different endpoint,
// no Limited Access gate. Diarization is native.
function azureRegion(): string {
  const raw = process.env.AZURE_SPEECH_REGION ?? 'australiaeast'
  return raw.startsWith('https://') ? raw.replace('https://', '').split('.')[0] : raw
}

const AZURE_FAST_TRANSCRIPTION_URL = () =>
  `https://${azureRegion()}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`

type AzurePhrase = {
  offsetMilliseconds: number
  durationMilliseconds?: number
  text: string
  speaker?: number
  locale?: string
}

type AzureResponse = {
  durationMilliseconds?: number
  combinedPhrases?: Array<{ text: string }>
  phrases?: AzurePhrase[]
}

type RosterEntry = { member_id: string; name: string; consented: boolean }

type TranscriptTurn = {
  speaker: number
  offset_ms: number
  text: string
}

export async function POST(request: NextRequest) {
  const key = process.env.AZURE_SPEECH_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Azure not configured (AZURE_SPEECH_KEY missing)' },
      { status: 500 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'audio file is required' }, { status: 400 })
  }

  const startedAt = (form.get('started_at') as string | null) ?? null
  const endedAt = (form.get('ended_at') as string | null) ?? new Date().toISOString()

  const kindRaw = (form.get('kind') as string | null) ?? 'passive'
  const kind: 'passive' | 'guided' = kindRaw === 'guided' ? 'guided' : 'passive'

  let elevenLabsTranscript:
    | Array<{ role: 'agent' | 'user'; message: string; time_in_call_secs: number }>
    | null = null
  const elRaw = form.get('eleven_labs_transcript')
  if (typeof elRaw === 'string' && elRaw.length > 0) {
    try {
      const parsed = JSON.parse(elRaw)
      if (Array.isArray(parsed)) {
        elevenLabsTranscript = parsed.filter(
          (t) =>
            t &&
            (t.role === 'agent' || t.role === 'user') &&
            typeof t.message === 'string' &&
            typeof t.time_in_call_secs === 'number',
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'eleven_labs_transcript must be valid JSON' },
        { status: 400 },
      )
    }
  }

  let roster: RosterEntry[] = []
  const rosterRaw = form.get('roster')
  if (typeof rosterRaw === 'string' && rosterRaw.length > 0) {
    try {
      const parsed = JSON.parse(rosterRaw)
      if (Array.isArray(parsed)) {
        roster = parsed
          .filter(
            (r) =>
              r && typeof r.member_id === 'string' && typeof r.name === 'string'
          )
          .map(
            (r): RosterEntry => ({
              member_id: r.member_id,
              name: r.name,
              // Default to consented=true for back-compat with older clients
              // that don't send the flag. New clients always send it.
              consented: typeof r.consented === 'boolean' ? r.consented : true,
            }),
          )
      }
    } catch {
      return NextResponse.json({ error: 'roster must be valid JSON' }, { status: 400 })
    }
  }

  // Create the session row upfront so we can persist partial state on failure.
  const durationSecs =
    startedAt && endedAt
      ? Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
      : null

  const { data: session, error: insertErr } = await supabase
    .from('listening_sessions')
    .insert({
      started_at: startedAt,
      ended_at: endedAt,
      duration_secs: durationSecs,
      roster,
      kind,
      eleven_labs_transcript: elevenLabsTranscript,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !session) {
    console.error('[listen/finalize] session insert failed:', insertErr)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Build the Azure Fast Transcription request. Forward the audio as-is.
  // Definition controls locale and diarization. maxSpeakers is an upper bound;
  // Azure picks the actual number automatically within it.
  const azureForm = new FormData()
  azureForm.append('audio', audio, audio.name || 'session.webm')
  azureForm.append(
    'definition',
    JSON.stringify({
      locales: ['en-NZ', 'en-AU', 'en-US'],
      diarization: { enabled: true, maxSpeakers: 8 },
    })
  )

  let azureData: AzureResponse
  try {
    const res = await fetch(AZURE_FAST_TRANSCRIPTION_URL(), {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key },
      body: azureForm,
    })
    if (!res.ok) {
      const errText = await res.text()
      await supabase
        .from('listening_sessions')
        .update({ status: 'failed', error: `Azure ${res.status}: ${errText.slice(0, 500)}` })
        .eq('id', session.id)
      return NextResponse.json(
        { error: 'Azure transcription failed', detail: errText },
        { status: 502 }
      )
    }
    azureData = (await res.json()) as AzureResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('listening_sessions')
      .update({ status: 'failed', error: msg })
      .eq('id', session.id)
    return NextResponse.json({ error: 'Azure request error', detail: msg }, { status: 502 })
  }

  const phrases = azureData.phrases ?? []
  const rawTranscript: TranscriptTurn[] = phrases.map((p) => ({
    speaker: typeof p.speaker === 'number' ? p.speaker : 0,
    offset_ms: p.offsetMilliseconds ?? 0,
    text: p.text ?? '',
  }))

  const { error: updateErr } = await supabase
    .from('listening_sessions')
    .update({
      raw_transcript: rawTranscript,
      status: 'transcribed',
    })
    .eq('id', session.id)

  if (updateErr) {
    console.error('[listen/finalize] transcript update failed:', updateErr)
    return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
  }

  // Fire the group guardian — attribution + summarisation in one Claude call.
  // Fire-and-forget so the client gets the session id immediately.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/guardian/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: session.id }),
  }).catch((err) => console.error('[listen/finalize] group guardian trigger failed:', err))

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    turns: rawTranscript.length,
  })
}
