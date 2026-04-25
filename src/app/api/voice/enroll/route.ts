import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

function azureRegion(): string {
  const raw = process.env.AZURE_SPEECH_REGION ?? 'australiaeast'
  return raw.startsWith('https://') ? raw.replace('https://', '').split('.')[0] : raw
}

const AZURE_API_VERSION = '2021-09-05'
const AZURE_BASE = () =>
  `https://${azureRegion()}.api.cognitive.microsoft.com/speaker-recognition/identification/text-independent`

async function pollOperation(url: string, maxMs = 60_000): Promise<Record<string, unknown>> {
  const key = process.env.AZURE_SPEECH_KEY!
  const deadline = Date.now() + maxMs
  let lastData: Record<string, unknown> = {}
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key } })
    lastData = await res.json()
    if (lastData.status === 'Succeeded') return (lastData.result as Record<string, unknown>) ?? lastData
    if (lastData.status === 'Failed') {
      throw new Error(
        `Azure operation failed: ${JSON.stringify(lastData.message ?? lastData)}`
      )
    }
  }
  throw new Error(
    `Azure operation timed out after ${maxMs}ms. Last status: ${JSON.stringify(lastData)}`
  )
}

export async function POST(request: NextRequest) {
  const started = Date.now()
  const t = () => `${((Date.now() - started) / 1000).toFixed(1)}s`
  console.log(`[voice/enroll] === POST received at ${new Date().toISOString()} ===`)

  try {
    const key = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION ?? 'australiaeast'
    console.log(`[voice/enroll] ${t()} env check — key present: ${!!key}, region: ${region}`)
    if (!key) return NextResponse.json({ error: 'Azure not configured (AZURE_SPEECH_KEY missing)' }, { status: 500 })

    console.log(`[voice/enroll] ${t()} parsing formData...`)
    const form = await request.formData()
    const audio = form.get('audio') as File | null
    const memberId = form.get('memberId') as string | null
    console.log(`[voice/enroll] ${t()} formData parsed — audio: ${audio?.size ?? 'null'} bytes, memberId: ${memberId}`)

    if (!audio || !memberId) {
      return NextResponse.json({ error: 'audio and memberId are required' }, { status: 400 })
    }

    // ──────────────────────────────────────────────────────────────────────
    // DEMO FAKE — Azure Speaker Recognition is Limited Access and our
    // subscription is pending approval (https://aka.ms/azure-speaker-recognition).
    // When DEMO_FAKE_VOICE=true, we skip Azure entirely: the 30s recording still
    // runs so the setup flow feels real, but we mark the member as enrolled
    // with a fake profile ID and move on. Unset this flag once approval lands.
    // ──────────────────────────────────────────────────────────────────────
    if (process.env.DEMO_FAKE_VOICE === 'true') {
      const fakeProfileId = `fake-${memberId}`
      console.log(`[voice/enroll] ${t()} DEMO_FAKE_VOICE enabled — skipping Azure, using ${fakeProfileId}`)
      const { error: fakeUpdateError } = await supabase
        .from('members')
        .update({ azure_profile_id: fakeProfileId, voice_enrolled: true })
        .eq('id', memberId)
      if (fakeUpdateError) {
        console.error(`[voice/enroll] ${t()} fake-mode Supabase update failed:`, fakeUpdateError)
        return NextResponse.json({ error: 'Failed to persist profile', detail: fakeUpdateError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, profileId: fakeProfileId, faked: true })
    }

    console.log(`[voice/enroll] ${t()} fetching existing profile from Supabase...`)
    const { data: member, error: selectError } = await supabase
      .from('members')
      .select('azure_profile_id')
      .eq('id', memberId)
      .single()

    if (selectError) {
      console.error(`[voice/enroll] ${t()} Supabase SELECT failed:`, selectError)
      return NextResponse.json({ error: 'Member lookup failed', detail: selectError.message }, { status: 500 })
    }

    let profileId: string = member?.azure_profile_id ?? ''
    console.log(`[voice/enroll] ${t()} existing profileId: ${profileId || '(none)'}`)

    if (!profileId) {
      const createUrl = `${AZURE_BASE()}/profiles?api-version=${AZURE_API_VERSION}`
      console.log(`[voice/enroll] ${t()} creating new Azure profile at ${createUrl}...`)
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: 'en-us' }),
      })
      console.log(`[voice/enroll] ${t()} profile creation status: ${createRes.status}`)
      const createData = await createRes.json()
      profileId = createData.profileId
      if (!profileId) {
        console.error(`[voice/enroll] ${t()} profile creation failed:`, createData)
        return NextResponse.json({ error: 'Failed to create Azure profile', detail: createData }, { status: 500 })
      }
      console.log(`[voice/enroll] ${t()} created profile: ${profileId}`)
    }

    const audioBuffer = await audio.arrayBuffer()
    console.log(`[voice/enroll] ${t()} uploading ${audioBuffer.byteLength} bytes for profile ${profileId}...`)

    const enrollRes = await fetch(`${AZURE_BASE()}/profiles/${profileId}/enrollments?api-version=${AZURE_API_VERSION}`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    })
    console.log(`[voice/enroll] ${t()} enrollment POST returned status: ${enrollRes.status}`)

    if (enrollRes.status === 202) {
      const opUrl =
        enrollRes.headers.get('Operation-Location') ?? enrollRes.headers.get('operation-location')
      if (opUrl) {
        console.log(`[voice/enroll] ${t()} polling ${opUrl}`)
        const result = await pollOperation(opUrl)
        console.log(`[voice/enroll] ${t()} poll result:`, JSON.stringify(result))
      } else {
        console.warn(`[voice/enroll] ${t()} 202 with no Operation-Location header`)
      }
    } else if (!enrollRes.ok) {
      const detail = await enrollRes.json().catch(() => ({}))
      console.error(`[voice/enroll] ${t()} Azure rejected enrollment:`, enrollRes.status, detail)
      return NextResponse.json(
        { error: 'Enrollment failed', status: enrollRes.status, detail },
        { status: 500 }
      )
    }

    console.log(`[voice/enroll] ${t()} persisting profile to Supabase...`)
    const { error: updateError } = await supabase
      .from('members')
      .update({ azure_profile_id: profileId, voice_enrolled: true })
      .eq('id', memberId)

    if (updateError) {
      console.error(`[voice/enroll] ${t()} Supabase update failed:`, updateError)
      return NextResponse.json({ error: 'Failed to persist profile', detail: updateError.message }, { status: 500 })
    }

    console.log(`[voice/enroll] ${t()} SUCCESS`)
    return NextResponse.json({ success: true, profileId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[voice/enroll] ${t()} FAILURE:`, message)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
