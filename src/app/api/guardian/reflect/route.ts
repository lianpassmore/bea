import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { GUARDIAN_REFLECT_PROMPT } from '@/lib/prompts'

// Reflect runs Opus 4.7, then a synchronous tikanga call, then polls for crisis
// up to 30s. Default Hobby (10s) and Pro (~10s) caps are not enough.
export const maxDuration = 90

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TranscriptRow = { role: string; message: string; time_in_call_secs: number }

type TikangaConcern = { pou: string; concern: string }
type TikangaEvaluation =
  | { tikanga_pass: boolean; tikanga_concerns: TikangaConcern[]; tikanga_rewrite: string | null }
  | { tikanga_pass: null; error: string; original_preserved: true }

function formatTranscript(transcript: TranscriptRow[]): string {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Family member' : 'Bea'}: ${m.message}`)
    .join('\n')
}

type CrisisPollResult = {
  crisis_level: 'watchful' | 'concerned' | 'urgent' | null
  crisis_in_session_response: string | null
}

// Poll check_ins for Guardian 10 completion. We key on crisis_reasoning IS NOT NULL
// because that column has no default — null means G10 hasn't written yet, any string
// (including '') means it has. Returns null on timeout; caller proceeds with the
// unmodified reflection.
async function waitForCrisis(
  check_in_id: string,
  timeoutMs = 30_000,
): Promise<CrisisPollResult | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('check_ins')
      .select('crisis_level, crisis_in_session_response, crisis_reasoning')
      .eq('id', check_in_id)
      .single()

    if (data && data.crisis_reasoning !== null) {
      return {
        crisis_level: (data.crisis_level as CrisisPollResult['crisis_level']) ?? null,
        crisis_in_session_response: data.crisis_in_session_response ?? '',
      }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

// Fail-open wrapper around Guardian 7. Never throws — errors become a null-pass
// evaluation so the caller preserves the original draft.
async function runTikanga(draft: string, context: string, baseUrl: string): Promise<TikangaEvaluation> {
  try {
    const res = await fetch(`${baseUrl}/api/guardian/tikanga`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, context }),
    })
    const data = await res.json()
    if (!data.ok) {
      return {
        tikanga_pass: null,
        error: data.error ?? 'Tikanga route returned not-ok',
        original_preserved: true,
      }
    }
    return {
      tikanga_pass: data.tikanga_pass,
      tikanga_concerns: data.tikanga_concerns ?? [],
      tikanga_rewrite: data.tikanga_rewrite ?? null,
    }
  } catch (err) {
    return {
      tikanga_pass: null,
      error: err instanceof Error ? err.message : 'Unknown tikanga error',
      original_preserved: true,
    }
  }
}

export async function POST(request: NextRequest) {
  let body: { check_in_id: string; transcript: TranscriptRow[]; member_id?: string | null }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 })
  }

  const { check_in_id, transcript, member_id } = body

  if (!transcript || transcript.length === 0) {
    return NextResponse.json({ ok: false, error: 'No transcript provided' }, { status: 200 })
  }

  let originalReflection: string

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      system: GUARDIAN_REFLECT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation transcript:\n\n${formatTranscript(transcript)}`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')
    const parsed = JSON.parse(textBlock.text) as { reflection: string }
    originalReflection = parsed.reflection
  } catch (err) {
    console.error('Guardian reflect failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Reflection generation failed' },
      { status: 200 }
    )
  }

  // Tikanga check — synchronous. Single call per reflection. NEVER re-run on the rewrite.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Build context for tikanga: member name/role + current emotional tone if G1 has written it
  let tikangaContext = 'For a family member'
  if (member_id) {
    const { data: member } = await supabase
      .from('members')
      .select('name, role')
      .eq('id', member_id)
      .single()
    if (member) {
      const rolePart = member.role ? ` (${member.role})` : ''
      const { data: checkIn } = await supabase
        .from('check_ins')
        .select('emotional_tone')
        .eq('id', check_in_id)
        .single()
      const tone = checkIn?.emotional_tone
      tikangaContext = tone
        ? `For ${member.name}${rolePart}, after a session with emotional tone: ${tone}`
        : `For ${member.name}${rolePart}`
    }
  }

  const evaluation = await runTikanga(originalReflection, tikangaContext, baseUrl)

  // Resolve final reflection per fail-open discipline
  let finalReflection = originalReflection
  let reflectionOriginal: string | null = null

  if (evaluation.tikanga_pass === false && evaluation.tikanga_rewrite) {
    finalReflection = evaluation.tikanga_rewrite
    reflectionOriginal = originalReflection
    console.log('[guardian/reflect] tikanga rewrite applied')
  } else if (evaluation.tikanga_pass === null) {
    console.warn(
      '[guardian/reflect] tikanga check errored — preserving original:',
      (evaluation as { error?: string }).error
    )
  }

  // Crisis override — wait for G10 on authenticated sessions, then apply.
  // Fail-open: timeout or error → reflection stored unchanged.
  if (member_id && check_in_id) {
    const crisis = await waitForCrisis(check_in_id)
    if (crisis) {
      const response = (crisis.crisis_in_session_response ?? '').trim()
      if (response) {
        if (crisis.crisis_level === 'concerned' || crisis.crisis_level === 'urgent') {
          // Replace — G10 owns the reflection at these levels
          if (reflectionOriginal === null) reflectionOriginal = originalReflection
          finalReflection = response
          console.log(`[guardian/reflect] crisis=${crisis.crisis_level} — reflection replaced by G10`)
        } else if (crisis.crisis_level === 'watchful') {
          // Append — G4's reflection stands, G10 adds a gentle line
          finalReflection = `${finalReflection}\n\n${response}`
          console.log('[guardian/reflect] crisis=watchful — G10 appendix added')
        }
      }
    } else {
      console.warn('[guardian/reflect] G10 wait timed out — reflection stored unchanged')
    }
  }

  if (check_in_id) {
    const { error } = await supabase
      .from('check_ins')
      .update({
        reflection: finalReflection,
        reflection_original: reflectionOriginal,
        tikanga_evaluation: evaluation,
      })
      .eq('id', check_in_id)

    if (error) console.error('Failed to store reflection:', error)
  }

  return NextResponse.json({ ok: true, reflection: finalReflection })
}
