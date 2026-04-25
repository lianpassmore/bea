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

      <header className="space-y-6 md:space-y-8 max-w-sm">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal">
          Kia ora{memberName ? `, ${memberName}.` : '.'}
        </h1>
        <p className="font-body text-base md:text-lg text-bea-blue leading-relaxed">
          A quiet space for your whānau.
        </p>
      </header>

      <div className="mt-16 md:mt-24 max-w-md">
        <p className="font-body text-xl md:text-2xl text-bea-charcoal leading-relaxed">
          {dailyLine}
        </p>
      </div>
    </div>
  )
}
