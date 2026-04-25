import { createClient } from '@supabase/supabase-js'

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const id = 'aafb457e-bea6-47f4-b8f8-6571daa8fb60'

  const { data: sess } = await s
    .from('listening_sessions')
    .select('id, status, duration_secs, family_summary, family_themes, family_tone, family_pulse, speaker_map, attribution_reasoning')
    .eq('id', id)
    .single()
  console.log('=== SESSION ===')
  console.log('status:', sess?.status)
  console.log('duration_secs:', sess?.duration_secs)
  console.log('speaker_map:', JSON.stringify(sess?.speaker_map, null, 2))
  console.log('family_tone:', sess?.family_tone)
  console.log('family_pulse:', sess?.family_pulse)
  console.log('family_themes:', sess?.family_themes)
  console.log('family_summary:', sess?.family_summary)

  const { data: summaries } = await s
    .from('listening_member_summaries')
    .select('member_name, individual_summary, individual_themes, emotional_tone, suggested_focus, reflection')
    .eq('session_id', id)
  console.log('\n=== PER-MEMBER SUMMARIES ===')
  for (const sm of summaries ?? []) {
    console.log(`\n--- ${sm.member_name} ---`)
    console.log('tone:', sm.emotional_tone)
    console.log('themes:', sm.individual_themes)
    console.log('focus:', sm.suggested_focus)
    console.log('reflection:', sm.reflection)
    console.log('summary:', sm.individual_summary)
  }

  const { data: insights } = await s
    .from('session_insights')
    .select('*')
    .eq('session_id', id)
  console.log('\n=== PATTERNS AGENT (session_insights) ===')
  console.log(insights?.length ?? 0, 'rows')

  const { data: patterns } = await s.from('patterns').select('id, name, status, last_session_id').eq('last_session_id', id)
  console.log('\n=== PATTERNS UPDATED THIS SESSION ===')
  for (const p of patterns ?? []) console.log('-', p.name, p.status)
}
main().catch(e => { console.error(e); process.exit(1) })
