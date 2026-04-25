import { NextRequest, NextResponse } from 'next/server'
import { sendToAll, type NotificationPayload } from '@/lib/web-push'

export async function POST(request: NextRequest) {
  let body: NotificationPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.title || !body.body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }
  const result = await sendToAll(body)
  return NextResponse.json(result)
}
