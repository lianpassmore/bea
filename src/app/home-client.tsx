import PageBackground from '@/components/page-background'

export default function HomeClient({
  memberName,
  dailyLine,
}: {
  memberName: string | null
  dailyLine: string
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
    </div>
  )
}
