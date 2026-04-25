import { getCurrentMember } from '@/lib/auth'
import { getDailyLine } from '@/lib/daily-lines'
import HomeClient from './home-client'

export default async function Home() {
  const member = await getCurrentMember()

  return (
    <HomeClient
      memberName={member?.name ?? null}
      dailyLine={getDailyLine()}
    />
  )
}
