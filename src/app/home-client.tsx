import Link from 'next/link'
import PageBackground from '@/components/page-background'

export default function HomeClient({
  memberName,
  dailyLine,
  currentGoal,
}: {
  memberName: string | null
  dailyLine: string
  currentGoal: { id: string; title: string } | null
}) {
  return (
    <div className="flex flex-col flex-1 py-8 md:py-12 animate-fade-in">
      <PageBackground variant="everyday" />

      <header className="max-w-sm">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal">
          Hello{memberName ? `, ${memberName}.` : '.'}
        </h1>
      </header>

      <div className="mt-16 md:mt-24 max-w-md">
        <p className="font-body text-xl md:text-2xl text-bea-charcoal leading-relaxed">
          {dailyLine}
        </p>
      </div>

      {currentGoal && (
        <Link
          href={`/audit/${currentGoal.id}`}
          className="block mt-20 md:mt-32 max-w-md group"
        >
          <p className="font-body text-sm md:text-base text-bea-blue/80 italic">
            Your current goal
          </p>
          <p className="mt-3 md:mt-4 font-body italic text-xl md:text-2xl text-bea-charcoal leading-relaxed group-hover:text-bea-amber transition-colors duration-500">
            &ldquo;{currentGoal.title.replace(/^I want to /, '')}&rdquo;
          </p>
        </Link>
      )}
    </div>
  )
}
