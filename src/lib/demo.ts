// Demo profile constants. Pure module, safe to import from client components.
// (Don't import from @/lib/auth, which depends on next/headers via supabase-server.)

export const DEMO_EMAIL = 'demo@gmail.com'
export const DEMO_SESSION_CAP_SECS = 5 * 60

export function isDemoMember(member: { email: string | null } | null): boolean {
  return member?.email?.toLowerCase() === DEMO_EMAIL
}
