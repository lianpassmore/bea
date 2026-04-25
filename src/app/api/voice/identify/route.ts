import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

function azureRegion(): string {
  const raw = process.env.AZURE_SPEECH_REGION ?? 'australiaeast'
  return raw.startsWith('https://') ? raw.replace('https://', '').split('.')[0] : raw
}

const AZURE_API_VERSION = '2021-09-05'
const AZURE_BASE = () =>
  `https://${azureRegion()}.api.cognitive.microsoft.com/speaker-recognition/identification/text-independent`

const CONFIDENCE_THRESHOLD = 0.7

async function pollOperation(url: string, maxMs = 15_000): Promise<Record<string, unknown>> {
  const key = process.env.AZURE_SPEECH_KEY!
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800))
    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key } })
    const data = await res.json()
    if (data.status === 'Succeeded') return data.result ?? data
    if (data.status === 'Failed') throw new Error('Azure identification failed')
  }
  throw new Error('Azure identification timed out')
}

export async function POST(request: NextRequest) {
  const key = process.env.AZURE_SPEECH_KEY
  if (!key) return NextResponse.json({ match: null })

  const form = await request.formData()
  const audio = form.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'audio is required' }, { status: 400 })

  // ──────────────────────────────────────────────────────────────────────
  // DEMO FAKE — Azure Speaker Recognition is Limited Access and our
  // subscription is pending approval (https://aka.ms/azure-speaker-recognition).
  // When DEMO_FAKE_VOICE=true, we return the most recently enrolled active
  // member as the match, with a plausible confidence score. The client
  // recording still happens so the check-in flow feels real.
  // Unset this flag once approval lands.
  // ──────────────────────────────────────────────────────────────────────
  if (process.env.DEMO_FAKE_VOICE === 'true') {
    const { data: recent } = await supabase
      .from('members')
      .select('id, name')
      .eq('status', 'active')
      .eq('voice_enrolled', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!recent || recent.length === 0) return NextResponse.json({ match: null })

    return NextResponse.json({
      match: {
        memberId: recent[0].id,
        memberName: recent[0].name,
        confidence: 0.95,
      },
      faked: true,
    })
  }

  // Only match against active members who have completed voice enrollment
  const { data: members } = await supabase
    .from('members')
    .select('id, name, azure_profile_id')
    .eq('status', 'active')
    .eq('voice_enrolled', true)
    .not('azure_profile_id', 'is', null)

  if (!members || members.length === 0) return NextResponse.json({ match: null })

  const profileIds = members.map((m) => m.azure_profile_id).join(',')
  const audioBuffer = await audio.arrayBuffer()

  const identifyRes = await fetch(
    `${AZURE_BASE()}/profiles/identifySingleSpeaker?profileIds=${profileIds}&ignoreMinLength=true&api-version=${AZURE_API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    }
  )

  let result: Record<string, unknown>
  try {
    if (identifyRes.status === 202) {
      const opUrl =
        identifyRes.headers.get('Operation-Location') ?? identifyRes.headers.get('operation-location')
      if (!opUrl) return NextResponse.json({ match: null })
      result = await pollOperation(opUrl)
    } else {
      result = await identifyRes.json()
    }
  } catch {
    return NextResponse.json({ match: null })
  }

  const identified = (result?.identifiedProfile ?? (result?.identifiedProfiles as unknown[])?.[0]) as
    | { profileId: string; score: number }
    | undefined

  if (!identified || identified.score < CONFIDENCE_THRESHOLD) {
    return NextResponse.json({ match: null, score: identified?.score ?? 0 })
  }

  const member = members.find((m) => m.azure_profile_id === identified.profileId)
  if (!member) return NextResponse.json({ match: null })

  return NextResponse.json({
    match: {
      memberId: member.id,
      memberName: member.name,
      confidence: identified.score,
    },
  })
}
