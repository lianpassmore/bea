import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ElevenLabs tool: a fresh family snapshot Bea can refer to during a
// conversation — who's in the family, what goals are open (per member +
// family-wide), what patterns are active, recent milestones, and a session
// count. Designed to be called once at the start of a session.
export async function GET(_request: NextRequest) {
  const [
    membersRes,
    goalsRes,
    patternsRes,
    milestonesRes,
    sessionsRes,
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, role, status, voice_enrolled')
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    supabase
      .from('goals')
      .select('id, owner_type, owner_id, title, description, metric_key, direction, target, status')
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false }),
    supabase
      .from('patterns')
      .select('id, scope, subject_id, kind, title, description, severity, confidence, status, last_seen_at')
      .in('status', ['new', 'discussed'])
      .order('last_seen_at', { ascending: false })
      .limit(15),
    supabase
      .from('milestones')
      .select('id, owner_type, owner_id, kind, title, achieved_at')
      .order('achieved_at', { ascending: false })
      .limit(10),
    supabase
      .from('listening_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'attributed'),
  ])

  const members = membersRes.data ?? []
  const goals = goalsRes.data ?? []
  const patterns = patternsRes.data ?? []
  const milestones = milestonesRes.data ?? []
  const sessionsCount = sessionsRes.count ?? 0

  const memberNames = members.map((m) => m.name)
  const say =
    members.length === 0
      ? "I don't have any family members on record yet."
      : `Family: ${memberNames.join(', ')}. ${goals.length} open goal${goals.length === 1 ? '' : 's'}, ${patterns.length} active pattern${patterns.length === 1 ? '' : 's'}, ${sessionsCount} session${sessionsCount === 1 ? '' : 's'} together so far.`

  return NextResponse.json({
    say,
    members,
    goals,
    patterns,
    milestones,
    sessions_count: sessionsCount,
  })
}
