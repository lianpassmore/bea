import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-proxy'

export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on everything except Next internals, the favicon, and API routes
    // (which handle their own auth).
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
