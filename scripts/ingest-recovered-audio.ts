/**
 * One-off: ingests a locally-saved audio file as a passive listening session.
 *
 * Mirrors /api/listen/finalize end-to-end, but runs locally so the upload to
 * Azure isn't bottlenecked by Vercel's 4.5MB function payload limit.
 *
 *   cd bea
 *   npx tsx --env-file=.env.local scripts/ingest-recovered-audio.ts \
 *     "/Users/boss/Documents/Bea Recordings/2026-04-26 conversation with husband (35min).webm" \
 *     Lian Lyall
 *
 * Args:
 *   1. Absolute path to audio file (webm/mp3/wav/m4a all OK with Azure)
 *   2..N. Names of household members who were in the room (matches members.name)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing env: ${name}`)
    process.exit(1)
  }
  return v
}

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
const AZURE_KEY = required('AZURE_SPEECH_KEY')
const AZURE_REGION = (process.env.AZURE_SPEECH_REGION ?? 'australiaeast')
  .replace('https://', '')
  .split('.')[0]
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

const audioPath = process.argv[2]
const rosterNames = process.argv.slice(3)

if (!audioPath || rosterNames.length === 0) {
  console.error(
    'Usage: npx tsx --env-file=.env.local scripts/ingest-recovered-audio.ts <audio-file> <name1> [name2 ...]'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const fileSize = statSync(audioPath).size
  console.log(`Audio: ${audioPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`)

  // 1. Resolve roster names → member IDs
  const { data: members, error: memErr } = await supabase
    .from('members')
    .select('id, name, status')
  if (memErr) throw memErr

  const roster = rosterNames.map((name) => {
    const m = members!.find((x) => x.name === name)
    if (!m) throw new Error(`Member not found: "${name}". Available: ${members!.map((x) => x.name).join(', ')}`)
    return {
      member_id: m.id,
      name: m.name,
      consented: m.status === 'active',
    }
  })
  console.log('Roster:', roster)

  // 2. Insert pending session row
  const startedAtFromMtime = statSync(audioPath).mtime
  const { data: session, error: insErr } = await supabase
    .from('listening_sessions')
    .insert({
      started_at: startedAtFromMtime.toISOString(),
      ended_at: new Date(startedAtFromMtime.getTime() + 1000).toISOString(), // placeholder; updated after STT
      roster,
      kind: 'passive',
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr || !session) throw insErr ?? new Error('Session insert failed')
  console.log(`Session created: ${session.id}`)

  // 3. Call Azure Fast Transcription
  console.log('Calling Azure Fast Transcription (typically 30-90s for 35min audio)...')
  const azureForm = new FormData()
  const audioBuffer = readFileSync(audioPath)
  const ext = extname(audioPath).toLowerCase()
  const mime = ext === '.mp3' ? 'audio/mpeg'
    : ext === '.wav' ? 'audio/wav'
    : ext === '.m4a' ? 'audio/mp4'
    : 'audio/webm'
  const audioBlob = new Blob([audioBuffer], { type: mime })
  azureForm.append('audio', audioBlob, basename(audioPath))
  azureForm.append(
    'definition',
    JSON.stringify({
      locales: ['en-NZ', 'en-AU', 'en-US'],
      diarization: { enabled: true, maxSpeakers: 8 },
    })
  )

  const azureUrl = `https://${AZURE_REGION}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`
  const t0 = Date.now()
  const azureRes = await fetch(azureUrl, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
    body: azureForm,
  })
  console.log(`Azure responded in ${((Date.now() - t0) / 1000).toFixed(1)}s, status=${azureRes.status}`)

  if (!azureRes.ok) {
    const text = await azureRes.text()
    await supabase
      .from('listening_sessions')
      .update({ status: 'failed', error: `Azure ${azureRes.status}: ${text.slice(0, 500)}` })
      .eq('id', session.id)
    throw new Error(`Azure STT failed (${azureRes.status}): ${text.slice(0, 500)}`)
  }

  type AzurePhrase = {
    offsetMilliseconds: number
    durationMilliseconds?: number
    text: string
    speaker?: number
  }
  type AzureResponse = {
    durationMilliseconds?: number
    phrases?: AzurePhrase[]
  }
  const azureData = (await azureRes.json()) as AzureResponse
  const phrases = azureData.phrases ?? []
  const rawTranscript = phrases.map((p) => ({
    speaker: typeof p.speaker === 'number' ? p.speaker : 0,
    offset_ms: p.offsetMilliseconds ?? 0,
    text: p.text ?? '',
  }))

  const speakers = new Set(phrases.map((p) => p.speaker ?? 0))
  const totalChars = phrases.reduce((s, p) => s + (p.text?.length ?? 0), 0)
  const durationSecs = (azureData.durationMilliseconds ?? 0) / 1000
  console.log(
    `Transcribed: ${phrases.length} phrases, ${speakers.size} speakers, ${totalChars} chars, ${durationSecs.toFixed(1)}s of audio`
  )

  // 4. Save transcript + correct duration
  const correctedEndedAt = new Date(startedAtFromMtime.getTime() + durationSecs * 1000)
  const { error: updErr } = await supabase
    .from('listening_sessions')
    .update({
      raw_transcript: rawTranscript,
      duration_secs: durationSecs,
      ended_at: correctedEndedAt.toISOString(),
      status: 'transcribed',
    })
    .eq('id', session.id)
  if (updErr) throw updErr
  console.log('Transcript persisted, status=transcribed.')

  // 5. Trigger group guardian → Opus reasoning + per-member summaries + patterns
  console.log(`Triggering group guardian at ${BASE_URL}/api/guardian/group ...`)
  const guardRes = await fetch(`${BASE_URL}/api/guardian/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: session.id }),
  })
  const guardBody = await guardRes.text()
  console.log(`Guardian: ${guardRes.status} ${guardBody.slice(0, 300)}`)

  console.log(`\nDone. session_id=${session.id}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
