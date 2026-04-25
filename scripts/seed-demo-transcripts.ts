/**
 * Seeds 5 demo transcripts against the production Supabase + dev server.
 *
 *   cd bea
 *   npm run dev                                    # in another terminal
 *   npx tsx --env-file=.env.local scripts/seed-demo-transcripts.ts
 *
 * Idempotent: skips any session whose started_at already has a row.
 * Sequential: waits between sessions so each one's pattern agent has prior
 * sessions' observations to read.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPTS_DIR = join(__dirname, 'demo-transcripts')

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MEMBERS = {
  Lian: 'c43792b7-4d3b-45ed-a797-900088163cc7',
  Lyall: '0df0e255-8304-4139-b1ca-f9f9163bea4a',
  Olivia: '241e2ab5-4cb1-4e92-9aef-6922cd5cdd29',
  Tai: 'd1bf6a56-9e34-44b4-809d-07204add6f3f',
  Rome: 'f28fd813-a235-4f39-97a9-96f19d2d5c06',
  River: 'fea642d3-53b5-42f8-bd28-ac13e3c19f35',
  Max: '4c77ab3c-a6bb-4ea1-aa38-941cd5c034af',
} as const

type RosterEntry = { member_id: string; name: string; consented: boolean }
type PassiveTurn = { speaker: number; offset_ms: number; text: string }
type CheckInTurn = { role: 'agent' | 'user'; message: string; time_in_call_secs: number }

type SessionSpec =
  | {
      kind: 'passive'
      file: string
      startedAt: string
      durationSecs: number
      roster: RosterEntry[]
    }
  | {
      kind: 'check-in'
      file: string
      startedAt: string
      durationSecs: number
      memberId: string
      memberName: string
    }

const SESSIONS: SessionSpec[] = [
  {
    kind: 'passive',
    file: 'demo-transcript-1-monday-morning.md',
    startedAt: '2026-04-27T06:40:00+12:00',
    durationSecs: 14 * 60,
    roster: [
      { member_id: MEMBERS.Lian, name: 'Lian', consented: true },
      { member_id: MEMBERS.Lyall, name: 'Lyall', consented: true },
      { member_id: MEMBERS.Rome, name: 'Rome', consented: false },
    ],
  },
  {
    kind: 'check-in',
    file: 'demo-transcript-2-tuesday-evening.md',
    startedAt: '2026-04-28T21:15:00+12:00',
    durationSecs: 7 * 60,
    memberId: MEMBERS.Lian,
    memberName: 'Lian',
  },
  {
    kind: 'passive',
    file: 'demo-transcript-3-wednesday-evening.md',
    startedAt: '2026-04-29T19:30:00+12:00',
    durationSecs: 11 * 60,
    roster: [
      { member_id: MEMBERS.Lian, name: 'Lian', consented: true },
      { member_id: MEMBERS.Lyall, name: 'Lyall', consented: true },
      { member_id: MEMBERS.Tai, name: 'Tai', consented: true },
      { member_id: MEMBERS.Olivia, name: 'Olivia', consented: true },
    ],
  },
  {
    kind: 'check-in',
    file: 'demo-transcript-4-friday-afternoon.md',
    startedAt: '2026-05-01T15:45:00+12:00',
    durationSecs: 6 * 60,
    memberId: MEMBERS.Lian,
    memberName: 'Lian',
  },
  {
    kind: 'check-in',
    file: 'demo-transcript-5-sunday-evening.md',
    startedAt: '2026-05-03T20:10:00+12:00',
    durationSecs: 8 * 60,
    memberId: MEMBERS.Lian,
    memberName: 'Lian',
  },
]

// Wait between sessions so each one's pattern/coach agents finish before the
// next session inserts. Conservative — pattern agent + coach can take 30-60s
// of Claude time per session.
const INTER_SESSION_PAUSE_MS = 60_000
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — parsing only, no inserts.' : 'Seeding 5 demo transcripts.')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  App:      ${BASE_URL}`)
  console.log()

  if (DRY_RUN) {
    for (const spec of SESSIONS) {
      const md = readFileSync(join(TRANSCRIPTS_DIR, spec.file), 'utf8')
      if (spec.kind === 'passive') {
        const turns = parsePassive(md, spec.durationSecs)
        const speakers = new Set(turns.map((t) => t.speaker))
        console.log(`── ${spec.file}`)
        console.log(`   passive, ${turns.length} turns, speakers: ${[...speakers].sort().join(', ')}`)
        console.log(`   first: SPEAKER_${turns[0]?.speaker} @ ${turns[0]?.offset_ms}ms — "${turns[0]?.text}"`)
        console.log(`   last:  SPEAKER_${turns.at(-1)?.speaker} @ ${turns.at(-1)?.offset_ms}ms — "${turns.at(-1)?.text}"`)
      } else {
        const turns = parseCheckIn(md, spec.durationSecs)
        const bea = turns.filter((t) => t.role === 'agent').length
        const lian = turns.filter((t) => t.role === 'user').length
        console.log(`── ${spec.file}`)
        console.log(`   check-in, ${turns.length} turns (BEA: ${bea}, LIAN: ${lian})`)
        console.log(`   first: ${turns[0]?.role} @ ${turns[0]?.time_in_call_secs}s — "${turns[0]?.message}"`)
        console.log(`   last:  ${turns.at(-1)?.role} @ ${turns.at(-1)?.time_in_call_secs}s — "${turns.at(-1)?.message}"`)
      }
      console.log()
    }
    return
  }

  await preflightDevServer()
  await ensureGoal()

  for (let i = 0; i < SESSIONS.length; i++) {
    const spec = SESSIONS[i]
    console.log(`── [${i + 1}/${SESSIONS.length}] ${spec.file}`)
    console.log(`   ${spec.kind}, ${spec.startedAt}`)

    const existing = await findExisting(spec)
    if (existing) {
      console.log(`   already seeded (id=${existing}), skipping.`)
      continue
    }

    const id =
      spec.kind === 'passive'
        ? await seedPassive(spec)
        : await seedCheckIn(spec)

    console.log(`   ok. id=${id}`)

    if (i < SESSIONS.length - 1) {
      console.log(`   waiting ${INTER_SESSION_PAUSE_MS / 1000}s for agents to finish…`)
      await sleep(INTER_SESSION_PAUSE_MS)
    }
  }

  console.log()
  console.log('Done. Open the audit page; coach output for session 5 may take')
  console.log('another minute or two of Claude time after this script returns.')
}

// The "calmer evenings" goal is referenced across the transcripts as set
// "last week". Seed it dated Mon Apr 6 (a week before the arc starts) so the
// Coach agent has something to anchor reasoning to. Idempotent on title.
async function ensureGoal() {
  const title = 'I want to be calmer in the evenings'
  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .eq('owner_id', MEMBERS.Lian)
    .eq('title', title)
    .maybeSingle()
  if (existing) {
    console.log(`goal already exists (id=${existing.id})`)
    return
  }
  const { data, error } = await supabase
    .from('goals')
    .insert({
      owner_type: 'member',
      owner_id: MEMBERS.Lian,
      title,
      description:
        'Lian wants to feel calmer with the kids in the evenings. Set in a 1:1 with Bea the week before the demo arc.',
      metric_key: 'evening_calm',
      direction: 'increase',
      status: 'active',
      proposed_by: { source: 'demo_seed' },
      created_at: '2026-04-20T20:00:00+12:00',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`goal insert failed: ${error?.message}`)
  console.log(`goal seeded (id=${data.id})`)
}

async function preflightDevServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/check-ins`, { method: 'GET' })
    if (!res.ok && res.status !== 200) {
      // 200 expected for GET, but a degraded response still proves the server is up
    }
  } catch {
    throw new Error(
      `Dev server not reachable at ${BASE_URL}. Start it with \`npm run dev\` first.`,
    )
  }
}

async function findExisting(spec: SessionSpec): Promise<string | null> {
  if (spec.kind === 'passive') {
    const { data } = await supabase
      .from('listening_sessions')
      .select('id')
      .eq('started_at', spec.startedAt)
      .maybeSingle()
    return data?.id ?? null
  }
  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('started_at', spec.startedAt)
    .maybeSingle()
  return data?.id ?? null
}

async function seedPassive(spec: Extract<SessionSpec, { kind: 'passive' }>): Promise<string> {
  const md = readFileSync(join(TRANSCRIPTS_DIR, spec.file), 'utf8')
  const turns = parsePassive(md, spec.durationSecs)
  if (turns.length === 0) throw new Error(`No SPEAKER lines parsed from ${spec.file}`)

  const endedAt = new Date(
    new Date(spec.startedAt).getTime() + spec.durationSecs * 1000,
  ).toISOString()

  const { data, error } = await supabase
    .from('listening_sessions')
    .insert({
      started_at: spec.startedAt,
      ended_at: endedAt,
      duration_secs: spec.durationSecs,
      roster: spec.roster,
      raw_transcript: turns,
      kind: 'passive',
      status: 'transcribed',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`insert failed: ${error?.message}`)

  // Trigger group guardian — awaited because patterns agent fires from inside
  // it after summaries are written.
  const res = await fetch(`${BASE_URL}/api/guardian/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: data.id }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/guardian/group failed (${res.status}): ${body.slice(0, 300)}`)
  }

  return data.id
}

async function seedCheckIn(spec: Extract<SessionSpec, { kind: 'check-in' }>): Promise<string> {
  const md = readFileSync(join(TRANSCRIPTS_DIR, spec.file), 'utf8')
  const turns = parseCheckIn(md, spec.durationSecs)
  if (turns.length === 0) throw new Error(`No BEA/LIAN lines parsed from ${spec.file}`)

  const res = await fetch(`${BASE_URL}/api/check-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: turns,
      started_at: spec.startedAt,
      call_duration_secs: spec.durationSecs,
      member_id: spec.memberId,
      member_name: spec.memberName,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`/api/check-ins failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = (await res.json()) as { saved: boolean; check_in_id?: string }
  if (!json.saved || !json.check_in_id) {
    throw new Error(`/api/check-ins did not save: ${JSON.stringify(json)}`)
  }
  return json.check_in_id
}

// ───── parsers ─────────────────────────────────────────────────────────────
//
// The markdown fixtures use:
//   passive:   `SPEAKER_NN *(stage direction)*: text…`
//   check-in:  `**BEA:** text…` / `**LIAN:** text…`
//
// Ambient lines (`*[…]*`) and notes are skipped. Inline italics like
// `*(small laugh)*` inside speech are stripped. Offsets/timestamps are
// distributed evenly across the stated duration.

const SPEAKER_RE = /^SPEAKER_(\d+)(?:\s*\*\([^)]*\)\*)?\s*:\s*(.*)$/
const CHECKIN_RE = /^\*\*(BEA|LIAN):\*\*\s*(.*)$/

function parsePassive(md: string, durationSecs: number): PassiveTurn[] {
  const body = sliceTranscriptSection(md)
  const turns: PassiveTurn[] = []
  for (const line of body.split('\n')) {
    const m = SPEAKER_RE.exec(line.trim())
    if (!m) continue
    const text = cleanSpeechText(m[2])
    if (!text) continue
    turns.push({ speaker: Number(m[1]), offset_ms: 0, text })
  }
  distributeOffsets(turns, durationSecs)
  return turns
}

function parseCheckIn(md: string, durationSecs: number): CheckInTurn[] {
  const body = sliceTranscriptSection(md)
  const turns: CheckInTurn[] = []
  for (const line of body.split('\n')) {
    const m = CHECKIN_RE.exec(line.trim())
    if (!m) continue
    const message = cleanSpeechText(m[2])
    if (!message) continue
    turns.push({
      role: m[1] === 'BEA' ? 'agent' : 'user',
      message,
      time_in_call_secs: 0,
    })
  }
  distributeTimestamps(turns, durationSecs)
  return turns
}

function sliceTranscriptSection(md: string): string {
  // Take everything from the first transcript heading up to the notes heading.
  const startIdx = md.search(/^##\s+(Raw transcript|Transcript)\b/m)
  if (startIdx === -1) return md
  const rest = md.slice(startIdx)
  const endRel = rest.search(/^##\s+Notes\b/m)
  return endRel === -1 ? rest : rest.slice(0, endRel)
}

function cleanSpeechText(raw: string): string {
  return raw
    // Strip inline italic stage directions like *(small laugh)* and *[ambient]*
    .replace(/\*\([^)]*\)\*/g, '')
    .replace(/\*\[[^\]]*\]\*/g, '')
    // Strip remaining single-asterisk emphasis around words (e.g. *we just*)
    .replace(/\*([^*]+)\*/g, '$1')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

function distributeOffsets(turns: PassiveTurn[], durationSecs: number) {
  if (turns.length === 0) return
  const totalMs = durationSecs * 1000
  const step = totalMs / turns.length
  turns.forEach((t, i) => {
    t.offset_ms = Math.round(i * step)
  })
}

function distributeTimestamps(turns: CheckInTurn[], durationSecs: number) {
  if (turns.length === 0) return
  const step = durationSecs / turns.length
  turns.forEach((t, i) => {
    t.time_in_call_secs = Math.round(i * step * 10) / 10
  })
}

// ───── utils ──────────────────────────────────────────────────────────────

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}. Use --env-file=.env.local.`)
  return v
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error()
  console.error('FAILED:', err.message ?? err)
  process.exit(1)
})
