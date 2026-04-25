/**
 * Guardian 7 — Tikanga
 *
 * Validates a draft against the ten pou before it reaches a person.
 * Called synchronously from Guardian 4 (Reflect) on reflections and
 * from Guardian 5 (Insight) on the full family report.
 *
 * CRITICAL — NO RECURSION. This route MUST NOT be called on output
 * produced by itself (i.e. on a tikanga_rewrite). The rewrite is the
 * final form. Consumers (G4, G5) call this exactly once per draft and
 * store the result directly. This route never calls itself.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GUARDIAN_TIKANGA_PROMPT } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TikangaConcern = { pou: string; concern: string }

type TikangaOutput = {
  tikanga_pass: boolean
  tikanga_concerns: TikangaConcern[]
  tikanga_rewrite: string | null
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
      thinking: { type: 'adaptive', display: 'summarized' },
      system: GUARDIAN_TIKANGA_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Context: ${context}

Draft to evaluate:
${draft}`,
        },
      ],
    })

    // Last text block wins for JSON (matches summarise/absence/insight — flagged for hardening)
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    const lastText = textBlocks[textBlocks.length - 1]
    if (!lastText) throw new Error('No text block in response')

    const data = JSON.parse(lastText.text) as TikangaOutput

    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    console.error('[guardian/tikanga] failure:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
