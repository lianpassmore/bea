import Link from 'next/link'
import ProfileMenu, { type CrisisNotification } from '@/components/profile-menu'

export default function HeaderBar({
  memberId,
  memberName,
  avatarUrl,
  notifications,
  consentGiven,
  consentGivenAt,
}: {
  memberId: string | null
  memberName: string | null
  avatarUrl: string | null
  notifications: CrisisNotification[]
  consentGiven: boolean
  consentGivenAt: string | null
}) {
  return (
    <header className="w-full flex justify-between items-center mb-8 md:mb-12 mt-4">
      <Link
        href="/"
        aria-label="Home"
        className="font-body font-medium text-2xl md:text-3xl text-bea-charcoal hover:text-bea-clay transition-colors duration-500"
      >
        Bea
      </Link>

      <ProfileMenu
        memberId={memberId}
        memberName={memberName}
        avatarUrl={avatarUrl}
        notifications={notifications}
        consentGiven={consentGiven}
        consentGivenAt={consentGivenAt}
      />
    </header>
  )
}
