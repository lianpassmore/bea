import PageBackground from '@/components/page-background'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10 animate-fade-in">
      <PageBackground variant="arrival" />

      <div className="w-full max-w-md bg-[#EBE5D9]/80 backdrop-blur-md border border-bea-charcoal/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-bea-charcoal/5 relative overflow-hidden">
        <header className="text-center mb-8 space-y-3">
          <h1 className="font-serif italic text-4xl text-bea-charcoal">
            Bee is resting.
          </h1>
        </header>

        <div className="w-12 h-px bg-bea-amber mx-auto mb-8"></div>

        <div className="space-y-6 text-center">
          <p className="font-body text-lg text-bea-charcoal leading-relaxed">
            Thank you for checking out Bee. I have taken Bee offline for now,
            post-Claude Code Hackathon, so I can do some further design and
            testing.
          </p>
          <p className="font-body text-bea-olive leading-relaxed">
            If you want to stay in touch, email me at{' '}
            <a
              href="mailto:liAn@dreamstorm.org"
              className="text-bea-blue hover:text-bea-charcoal transition-colors duration-300 underline-offset-4 hover:underline"
            >
              liAn@dreamstorm.org
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
