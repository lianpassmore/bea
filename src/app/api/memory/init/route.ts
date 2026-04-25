import { NextResponse } from 'next/server'
import { createMemoryStore } from '@/lib/memory'

// GET /api/memory/init
// Call this once to create the Anthropic memory store.
// Copy the returned store_id into ANTHROPIC_MEMORY_STORE_ID in .env.local and Vercel env vars.
export async function GET() {
  if (process.env.ANTHROPIC_MEMORY_STORE_ID) {
    return NextResponse.json({
      already_configured: true,
      store_id: process.env.ANTHROPIC_MEMORY_STORE_ID,
    })
  }

  try {
    const storeId = await createMemoryStore()
    return NextResponse.json({
      store_id: storeId,
      next_step: `Add ANTHROPIC_MEMORY_STORE_ID=${storeId} to .env.local and Vercel env vars, then redeploy.`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
