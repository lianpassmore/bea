import { getCurrentMember } from '@/lib/auth'
import ScheduleClient from './schedule-client'

export default async function SchedulePage() {
  const member = await getCurrentMember()
  return <ScheduleClient isPrimary={member?.role === 'primary'} />
}
