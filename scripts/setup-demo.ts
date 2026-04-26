/**
 * Provisions a self-contained "Demi" demo profile that hackathon judges can
 * sign in to via /demo without going through Google. Lian's real account is
 * left untouched.
 *
 *   cd bea
 *   npx tsx --env-file=.env.local scripts/setup-demo.ts
 *
 * Re-runnable: deletes any existing Demi data and re-clones from Lian's
 * current state. Use --reset to delete the demo profile entirely.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')

const SOURCE_MEMBER_ID = 'c43792b7-4d3b-45ed-a797-900088163cc7' // Lian
const DEMO_NAME = 'Lian (Demo)'
const DEMO_EMAIL = 'demo@gmail.com'
const DEMO_PASSWORD = '123456'

const RESET = process.argv.includes('--reset')

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const authUserId = await ensureAuthUser()

  if (RESET) {
    await deleteDemoMember(authUserId)
    console.log(`Reset: removed Demi profile and auth user.`)
    return
  }

  const demoMember = await ensureDemoMember(authUserId)
  await wipeDemoData(demoMember.id)
  await cloneFromLian(demoMember.id)

  console.log(`\nDemo profile ready.`)
  console.log(`  name:         ${DEMO_NAME}`)
  console.log(`  member_id:    ${demoMember.id}`)
  console.log(`  auth_user_id: ${authUserId}`)
  console.log(`  email:        ${DEMO_EMAIL}`)
  console.log(`  password:     ${DEMO_PASSWORD}`)
  console.log(`\n  Visit /demo to sign in automatically.`)
}

async function ensureAuthUser(): Promise<string> {
  // Look up existing user by email via admin listUsers (paginated).
  let page = 1
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)
    if (found) {
      // Make sure password is the documented one (in case it drifted).
      const { error: upErr } = await sb.auth.admin.updateUserById(found.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      })
      if (upErr) throw upErr
      return found.id
    }
    if (data.users.length < 200) break
    page += 1
  }

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (createErr) throw createErr
  if (!created.user) throw new Error('No user returned from createUser')
  return created.user.id
}

type DemoMember = { id: string }

async function ensureDemoMember(authUserId: string): Promise<DemoMember> {
  const { data: source, error: srcErr } = await sb
    .from('members')
    .select('avatar_url, vision, vision_set_at, voice_enrolled, consent_given, consent_given_at')
    .eq('id', SOURCE_MEMBER_ID)
    .single()
  if (srcErr) throw srcErr

  const fields = {
    name: DEMO_NAME,
    role: 'primary' as const,
    email: DEMO_EMAIL,
    auth_user_id: authUserId,
    status: 'active' as const,
    avatar_url: source.avatar_url,
    vision: source.vision,
    vision_set_at: source.vision_set_at,
    voice_enrolled: source.voice_enrolled,
    consent_given: source.consent_given,
    consent_given_at: source.consent_given_at,
  }

  const { data: existing } = await sb
    .from('members')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (existing) {
    const { error: updateErr } = await sb
      .from('members')
      .update(fields)
      .eq('id', existing.id)
    if (updateErr) throw updateErr
    return existing as DemoMember
  }

  const { data: created, error: insertErr } = await sb
    .from('members')
    .insert(fields)
    .select('id')
    .single()
  if (insertErr) throw insertErr
  return created as DemoMember
}

async function deleteDemoMember(authUserId: string) {
  const { data: existing } = await sb
    .from('members')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (existing?.id) {
    await wipeDemoData(existing.id)
    await sb.from('members').delete().eq('id', existing.id)
  }
  await sb.auth.admin.deleteUser(authUserId).catch(() => {})
}

async function wipeDemoData(demoMemberId: string) {
  // Order matters: observations are FK'd to goals (cascade) so removing the
  // goals removes their observations. listening_member_summaries and check_ins
  // reference member_id directly.
  await sb.from('check_ins').delete().eq('member_id', demoMemberId)
  await sb
    .from('listening_member_summaries')
    .delete()
    .eq('member_id', demoMemberId)
  await sb.from('milestones').delete().eq('owner_id', demoMemberId)
  await sb.from('patterns').delete().eq('subject_id', demoMemberId)
  await sb.from('goals').delete().eq('owner_id', demoMemberId)
  await removeFromWhanauRosters(demoMemberId)
}

async function removeFromWhanauRosters(demoMemberId: string) {
  type RosterEntry = { name: string; member_id: string; consented?: boolean }
  const { data: sessions } = await sb
    .from('listening_sessions')
    .select('id, roster')
  if (!sessions?.length) return
  for (const s of sessions as { id: string; roster: RosterEntry[] | null }[]) {
    const roster = Array.isArray(s.roster) ? s.roster : []
    if (!roster.some((r) => r.member_id === demoMemberId)) continue
    const next = roster.filter((r) => r.member_id !== demoMemberId)
    await sb.from('listening_sessions').update({ roster: next }).eq('id', s.id)
  }
}

async function cloneFromLian(demoMemberId: string) {
  await cloneCheckIns(demoMemberId)
  await cloneListeningMemberSummaries(demoMemberId)
  await cloneMilestones(demoMemberId)
  await clonePatterns(demoMemberId)
  await cloneGoalsAndObservations(demoMemberId)
  await addToWhanauRosters(demoMemberId)
}

async function addToWhanauRosters(demoMemberId: string) {
  // Append Lian (Demo) to each listening_session roster wherever Lian herself
  // appears, so judges see her listed alongside the rest of the whānau in past
  // sessions. Idempotent: skips rosters that already include her.
  const { data: sessions, error } = await sb
    .from('listening_sessions')
    .select('id, roster')
  if (error) throw error
  if (!sessions?.length) return

  type RosterEntry = { name: string; member_id: string; consented?: boolean }
  let updated = 0
  for (const s of sessions as { id: string; roster: RosterEntry[] | null }[]) {
    const roster = Array.isArray(s.roster) ? s.roster : []
    if (roster.some((r) => r.member_id === demoMemberId)) continue
    if (!roster.some((r) => r.member_id === SOURCE_MEMBER_ID)) continue

    const sourceEntry = roster.find((r) => r.member_id === SOURCE_MEMBER_ID)
    const next = [
      ...roster,
      {
        name: DEMO_NAME,
        member_id: demoMemberId,
        consented: sourceEntry?.consented ?? true,
      },
    ]
    const { error: updErr } = await sb
      .from('listening_sessions')
      .update({ roster: next })
      .eq('id', s.id)
    if (updErr) throw updErr
    updated += 1
  }
  console.log(`  added Lian (Demo) to ${updated} listening_sessions rosters`)
}

async function cloneCheckIns(demoMemberId: string) {
  const { data, error } = await sb
    .from('check_ins')
    .select('*')
    .eq('member_id', SOURCE_MEMBER_ID)
  if (error) throw error
  if (!data?.length) return

  const rows = data.map((r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r
    return {
      ...rest,
      member_id: demoMemberId,
      member_name: DEMO_NAME,
    }
  })
  const { error: insertErr } = await sb.from('check_ins').insert(rows)
  if (insertErr) throw insertErr
  console.log(`  cloned ${rows.length} check_ins`)
}

async function cloneListeningMemberSummaries(demoMemberId: string) {
  const { data, error } = await sb
    .from('listening_member_summaries')
    .select('*')
    .eq('member_id', SOURCE_MEMBER_ID)
  if (error) throw error
  if (!data?.length) return

  const rows = data.map((r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r
    return {
      ...rest,
      member_id: demoMemberId,
      member_name: DEMO_NAME,
    }
  })
  const { error: insertErr } = await sb
    .from('listening_member_summaries')
    .insert(rows)
  if (insertErr) throw insertErr
  console.log(`  cloned ${rows.length} listening_member_summaries`)
}

async function cloneMilestones(demoMemberId: string) {
  const { data, error } = await sb
    .from('milestones')
    .select('*')
    .eq('owner_type', 'member')
    .eq('owner_id', SOURCE_MEMBER_ID)
  if (error) throw error
  if (!data?.length) return

  const rows = data.map((r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r
    return { ...rest, owner_id: demoMemberId }
  })
  const { error: insertErr } = await sb.from('milestones').insert(rows)
  if (insertErr) throw insertErr
  console.log(`  cloned ${rows.length} milestones`)
}

async function clonePatterns(demoMemberId: string) {
  const { data, error } = await sb
    .from('patterns')
    .select('*')
    .eq('scope', 'member')
    .eq('subject_id', SOURCE_MEMBER_ID)
  if (error) throw error
  if (!data?.length) return

  const rows = data.map((r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r
    return { ...rest, subject_id: demoMemberId }
  })
  const { error: insertErr } = await sb.from('patterns').insert(rows)
  if (insertErr) throw insertErr
  console.log(`  cloned ${rows.length} patterns`)
}

async function cloneGoalsAndObservations(demoMemberId: string) {
  const { data: goals, error: goalErr } = await sb
    .from('goals')
    .select('*')
    .eq('owner_type', 'member')
    .eq('owner_id', SOURCE_MEMBER_ID)
  if (goalErr) throw goalErr
  if (!goals?.length) return

  // Insert one at a time so we can map old goal ids -> new goal ids.
  const idMap = new Map<string, string>()
  for (const g of goals as Record<string, unknown>[]) {
    const { id, ...rest } = g
    const { data: inserted, error } = await sb
      .from('goals')
      .insert({ ...rest, owner_id: demoMemberId })
      .select('id')
      .single()
    if (error) throw error
    idMap.set(id as string, inserted.id as string)
  }
  console.log(`  cloned ${idMap.size} goals`)

  const oldGoalIds = Array.from(idMap.keys())
  const { data: obs, error: obsErr } = await sb
    .from('observations')
    .select('*')
    .in('goal_id', oldGoalIds)
  if (obsErr) throw obsErr
  if (!obs?.length) return

  const obsRows = obs.map((o: Record<string, unknown>) => {
    const { id: _id, goal_id, ...rest } = o
    return { ...rest, goal_id: idMap.get(goal_id as string)! }
  })
  const { error: insertErr } = await sb.from('observations').insert(obsRows)
  if (insertErr) throw insertErr
  console.log(`  cloned ${obsRows.length} observations`)
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing env var: ${name}`)
    process.exit(1)
  }
  return v
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
