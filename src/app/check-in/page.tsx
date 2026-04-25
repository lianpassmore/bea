import { getCurrentMember } from '@/lib/auth'
import CheckInClient from './check-in-client'

export default async function CheckInPage() {
  const member = await getCurrentMember()
  return (
    <CheckInClient
      authedMember={
        member
          ? { id: member.id, name: member.name, role: member.role }
          : null
      }
    />
  )
}
