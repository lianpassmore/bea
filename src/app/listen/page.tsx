import { getCurrentMember, isDemoMember } from '@/lib/auth'
import ListenClient from './listen-client'

export default async function ListenPage() {
  const member = await getCurrentMember()
  return <ListenClient isDemo={isDemoMember(member)} />
}
