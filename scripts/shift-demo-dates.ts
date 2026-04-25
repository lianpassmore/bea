/**
 * One-off: shift seeded demo dates back 14 days so they sit before
 * 2026-04-25 (today, NZ time). Targets only the specific seeded rows by
 * their old started_at / created_at values.
 *
 *   cd bea
 *   npx tsx --env-file=.env.local scripts/shift-demo-dates.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const LIAN_ID = 'c43792b7-4d3b-45ed-a797-900088163cc7'
const SHIFT_DAYS = 14

const LISTENING_SESSIONS: Array<{ oldStart: string; durationSecs: number }> = [
  { oldStart: '2026-04-27T06:40:00+12:00', durationSecs: 14 * 60 },
  { oldStart: '2026-04-29T19:30:00+12:00', durationSecs: 11 * 60 },
]

const CHECK_INS: string[] = [
  '2026-04-28T21:15:00+12:00',
  '2026-05-01T15:45:00+12:00',
  '2026-05-03T20:10:00+12:00',
]

const GOAL = {
  ownerId: LIAN_ID,
  title: 'I want to be calmer in the evenings',
  oldCreatedAt: '2026-04-20T20:00:00+12:00',
}

function shift(iso: string): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() - SHIFT_DAYS)
  return d.toISOString()
}

async function main() {
  console.log(`Shifting demo dates back ${SHIFT_DAYS} days on ${SUPABASE_URL}\n`)

  for (const { oldStart, durationSecs } of LISTENING_SESSIONS) {
    const newStart = shift(oldStart)
    const newEnd = new Date(new Date(newStart).getTime() + durationSecs * 1000).toISOString()
    const { data, error } = await supabase
      .from('listening_sessions')
      .update({ started_at: newStart, ended_at: newEnd })
      .eq('started_at', oldStart)
      .select('id')
    if (error) throw new Error(`listening_sessions ${oldStart}: ${error.message}`)
    console.log(`listening_sessions: ${oldStart} → ${newStart} (${data?.length ?? 0} row${data?.length === 1 ? '' : 's'})`)
  }

  for (const oldStart of CHECK_INS) {
    const newStart = shift(oldStart)
    const { data, error } = await supabase
      .from('check_ins')
      .update({ started_at: newStart })
      .eq('started_at', oldStart)
      .select('id')
    if (error) throw new Error(`check_ins ${oldStart}: ${error.message}`)
    console.log(`check_ins:          ${oldStart} → ${newStart} (${data?.length ?? 0} row${data?.length === 1 ? '' : 's'})`)
  }

  const newGoalCreated = shift(GOAL.oldCreatedAt)
  const { data: goalRows, error: goalErr } = await supabase
    .from('goals')
    .update({ created_at: newGoalCreated })
    .eq('owner_id', GOAL.ownerId)
    .eq('title', GOAL.title)
    .select('id')
  if (goalErr) throw new Error(`goal: ${goalErr.message}`)
  console.log(`goal:               ${GOAL.oldCreatedAt} → ${newGoalCreated} (${goalRows?.length ?? 0} row${goalRows?.length === 1 ? '' : 's'})`)

  console.log('\nDone.')
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}. Use --env-file=.env.local.`)
  return v
}

main().catch((err) => {
  console.error('FAILED:', err.message ?? err)
  process.exit(1)
})
