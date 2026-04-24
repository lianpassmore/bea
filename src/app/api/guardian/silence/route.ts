/**
 * Guardian 6 — Silence
 *
 * The quiet check before Bea speaks. Reads a proposed insight and
 * decides, honestly, whether this is the right moment for it.
 *
 * Presence is a warm hand on a shoulder when it is wanted.
 * Surveillance is someone watching too closely, too soon.
 * Guardian 6 chooses between them.
 *
 * Three decisions:
 * - surface: this is earned. The moment is right.
 * - wait: not now, but perhaps soon. wait_until set.
 * - never: noticing it was enough.
 *
 * Runs AFTER Guardian 7 (Tikanga) validates content. Both must pass
 * before an insight is visible on the dashboard.
 *
 * CRITICAL: This route must not call itself. No recursion.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GUARDIAN_SILENCE_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type SilenceOutput = {
  silence_decision: 'surface' | 'wait' | 'never'
  silence_reason: string
  wait_until: string | null
}

export async function POST(request: NextRequest) {
  let body: { draft: string; context: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 200 })
  }

  const { draft, context } = body
  if (!draft || typeof draft !== 'string') {
    return NextResponse.json({ ok: false, error: 'draft is required' }, { status: 200 })
  }
  if (!context || typeof context !== 'string') {
    return NextResponse.json({ ok: false, error: 'context is required' }, { status: 200 })
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      thinking: { type: 'enabled', budget_tokens: 2000 },
      system: GUARDIAN_SILENCE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Context: ${context}

Draft to evaluate:
${draft}`,
        },
      ],
    })

    // Last text block wins for JSON (matches tikanga — flagged for hardening)
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    const lastText = textBlocks[textBlocks.length - 1]
    if (!lastText) throw new Error('No text block in response')

    const data = JSON.parse(lastText.text) as SilenceOutput

    return NextResponse.json({
      ok: true,
      silence_decision: data.silence_decision,
      silence_reason: data.silence_reason,
      wait_until: data.wait_until ?? null,
      silence_evaluation: data,
    })
  } catch (err) {
    console.error('[guardian/silence] failure:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
