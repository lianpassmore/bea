import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentMember } from '@/lib/auth'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: NextRequest) {
  const member = await getCurrentMember()
  if (!member) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${member.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) {
    console.error('avatar upload failed:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
  const url = pub.publicUrl

  const { error: updateError } = await supabaseAdmin
    .from('members')
    .update({ avatar_url: url })
    .eq('id', member.id)
  if (updateError) {
    console.error('avatar member update failed:', updateError)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ avatar_url: url })
}

export async function DELETE() {
  const member = await getCurrentMember()
  if (!member) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { error } = await supabaseAdmin
    .from('members')
    .update({ avatar_url: null })
    .eq('id', member.id)
  if (error) {
    return NextResponse.json({ error: 'Remove failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
