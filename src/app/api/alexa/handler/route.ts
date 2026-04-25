import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { BEA_SYSTEM_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// --- Types ---

type TranscriptEntry = { role: 'user' | 'agent'; message: string; time_in_call_secs: number }

type SessionAttributes = { transcript: TranscriptEntry[]; startedAt: number }

type AlexaSkillRequest = {
  version: string
  session?: { sessionId: string; attributes?: Partial<SessionAttributes> }
  request: {
    type: 'LaunchRequest' | 'IntentRequest' | 'SessionEndedRequest'
    intent?: { name: string; slots?: Record<string, { value?: string }> }
  }
  context: { System: { apiAccessToken: string; apiEndpoint: string } }
}

// --- Response builder ---

function alexaResponse(
  ssml: string,
  sessionAttributes: Partial<SessionAttributes> = {},
  keepOpen = true,
) {
  return {
    version: '1.0',
    sessionAttributes,
    response: {
      outputSpeech: { type: 'SSML', ssml: `<speak>${ssml}</speak>` },
      shouldEndSession: !keepOpen,
      ...(keepOpen && {
        reprompt: {
          outputSpeech: {
            type: 'SSML',
            ssml: '<speak><break time="2s"/>Is there anything else on your mind?</speak>',
          },
        },
      }),
    },
  }
}

// --- Reminder helpers ---

const DAY_MAP: Record<string, string> = {
  mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU',
}
const DAY_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

function nextOccurrence(days: string[], time: string): string {
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  let earliest: Date | null = null

  for (const day of days) {
    const candidate = new Date(now)
    let diff = (DAY_NUM[day] - now.getDay() + 7) % 7
    if (diff === 0 && (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m))) {
      diff = 7
    }
    candidate.setDate(now.getDate() + diff)
    candidate.setHours(h, m, 0, 0)
    if (!earliest || candidate < earliest) earliest = candidate
  }

  const d = earliest!
  return (
    [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') +
    'T' +
    [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0'), '00'].join(':')
  )
}

async function plantReminders(
  apiEndpoint: string,
  apiAccessToken: string,
  schedules: Array<{ label: string; days: string[]; time: string }>,
): Promise<number> {
  let planted = 0
  for (const s of schedules) {
    const body = {
      requestTime: new Date().toISOString(),
      trigger: {
        type: 'SCHEDULED_ABSOLUTE',
        scheduledTime: nextOccurrence(s.days, s.time),
        timeZoneId: 'Pacific/Auckland',
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${s.days.map((d) => DAY_MAP[d]).join(',')}`,
      },
      alertInfo: {
        spokenInfo: {
          content: [
            {
              locale: 'en-NZ',
              text: `Time for your ${s.label} with Bea.`,
              ssml: `<speak>Time for your ${s.label} with Bea. Say <emphasis>Alexa, open Bea</emphasis> to begin.</speak>`,
            },
          ],
        },
      },
      pushNotification: { status: 'ENABLED' },
    }

    const res = await fetch(`${apiEndpoint}/v1/alerts/reminders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) planted++
    else console.error('Alexa reminder creation failed:', s.label, await res.text())
  }
  return planted
}

// --- Guardian pipeline ---

function fireGuardians(checkInId: string, transcript: TranscriptEntry[], baseUrl: string) {
  const payload = JSON.stringify({ check_in_id: checkInId, transcript })
  const headers = { 'Content-Type': 'application/json' }
  for (const path of ['/api/guardian/summarise', '/api/guardian/wellbeing', '/api/guardian/reflect']) {
    fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: payload }).catch((err) =>
      console.error(`${path} failed:`, err),
    )
  }
}

async function saveAndProcess(transcript: TranscriptEntry[], startedAt: number, baseUrl: string) {
  if (transcript.length === 0) return

  const { data: inserted, error } = await supabase
    .from('check_ins')
    .insert({
      agent_id: 'alexa-listen',
      transcript,
      started_at: new Date(startedAt).toISOString(),
      call_duration_secs: (Date.now() - startedAt) / 1000,
      member_name: 'Household',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Failed to save Alexa transcript:', error)
    return
  }

  fireGuardians(inserted.id, transcript, baseUrl)
}

// --- Intent handlers ---

async function onLaunch(
  apiEndpoint: string,
  apiAccessToken: string,
  startedAt: number,
): Promise<ReturnType<typeof alexaResponse>> {
  // Fetch active listen schedules and plant Alexa reminders in parallel with prompt generation
  const [schedulesResult, promptResp] = await Promise.all([
    supabase.from('schedules').select('label, days, time').eq('mode', 'listen').eq('active', true),
    anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 80,
      system: BEA_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            'Open a gentle listening session. One soft, open sentence only. No mention of AI or technology.',
        },
      ],
    }),
  ])

  const schedules = schedulesResult.data ?? []
  let reminderNote = ''

  if (schedules.length > 0) {
    const planted = await plantReminders(apiEndpoint, apiAccessToken, schedules)
    if (planted > 0) {
      reminderNote = `I've set ${planted === 1 ? 'a reminder' : `${planted} reminders`} for your listening sessions. <break time="0.5s"/>`
    }
  }

  const openingPrompt =
    promptResp.content[0].type === 'text'
      ? promptResp.content[0].text
      : "I'm here. What's on your mind?"

  return alexaResponse(`${reminderNote}${openingPrompt}`, { transcript: [], startedAt }, true)
}

async function onCapture(
  message: string,
  attrs: Partial<SessionAttributes>,
): Promise<ReturnType<typeof alexaResponse>> {
  const transcript = attrs.transcript ?? []
  const startedAt = attrs.startedAt ?? Date.now()
  const elapsed = (Date.now() - startedAt) / 1000

  // Pass full conversation history so Opus 4.7 has context
  const history: Anthropic.MessageParam[] = [
    ...transcript.map((t) => ({
      role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: t.message,
    })),
    { role: 'user', content: message },
  ]

  const resp = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 80,
    system: BEA_SYSTEM_PROMPT,
    messages: history,
  })

  const beaReply = resp.content[0].type === 'text' ? resp.content[0].text : 'I hear you.'

  const updatedTranscript: TranscriptEntry[] = [
    ...transcript,
    { role: 'user', message, time_in_call_secs: elapsed },
    { role: 'agent', message: beaReply, time_in_call_secs: (Date.now() - startedAt) / 1000 },
  ]

  return alexaResponse(`${beaReply} <break time="1s"/>`, { transcript: updatedTranscript, startedAt }, true)
}

async function onStop(
  attrs: Partial<SessionAttributes>,
  baseUrl: string,
): Promise<ReturnType<typeof alexaResponse>> {
  const transcript = attrs.transcript ?? []
  const startedAt = attrs.startedAt ?? Date.now()

  saveAndProcess(transcript, startedAt, baseUrl).catch(console.error)

  return alexaResponse(
    "Bea will hold what you've shared. <break time=\"0.5s\"/>Take care.",
    {},
    false,
  )
}

// --- Route ---

export async function POST(req: NextRequest) {
  let body: AlexaSkillRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { request, session, context } = body
  const { apiAccessToken, apiEndpoint } = context.System
  const attrs = (session?.attributes ?? {}) as Partial<SessionAttributes>
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (request.type === 'LaunchRequest') {
    return NextResponse.json(await onLaunch(apiEndpoint, apiAccessToken, Date.now()))
  }

  if (request.type === 'IntentRequest') {
    const name = request.intent!.name

    if (name === 'CaptureIntent') {
      const message = request.intent!.slots?.message?.value ?? ''
      if (!message)
        return NextResponse.json(alexaResponse("I'm listening. Take your time.", attrs, true))
      return NextResponse.json(await onCapture(message, attrs))
    }

    if (name === 'AMAZON.StopIntent' || name === 'AMAZON.CancelIntent') {
      return NextResponse.json(await onStop(attrs, baseUrl))
    }

    if (name === 'AMAZON.FallbackIntent') {
      return NextResponse.json(
        alexaResponse("I'm still here whenever you're ready.", attrs, true),
      )
    }
  }

  // SessionEndedRequest — user exited without saying stop, save what was captured
  if (request.type === 'SessionEndedRequest') {
    if ((attrs.transcript?.length ?? 0) > 0) {
      saveAndProcess(attrs.transcript!, attrs.startedAt ?? Date.now(), baseUrl).catch(console.error)
    }
    return NextResponse.json({ version: '1.0', response: {} })
  }

  return NextResponse.json(alexaResponse("I'm here.", attrs, true))
}
