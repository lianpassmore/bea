import { redirect } from 'next/navigation'
import { getCurrentMember } from '@/lib/auth'
import HouseholdClient from './household-client'

export default async function HouseholdPage() {
  const member = await getCurrentMember()
  if (!member || member.role !== 'primary') {
    redirect('/')
  }
  return <HouseholdClient />
}
