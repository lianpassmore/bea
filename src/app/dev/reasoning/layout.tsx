import { notFound } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'

// Dev-only audit surface. Only reachable when ENABLE_DEV_REASONING_PAGE=true.
// `fixed inset-0` escapes the root layout's max-w-md container, covering the
// full viewport with a darker workspace.

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export default function DevReasoningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (process.env.ENABLE_DEV_REASONING_PAGE !== 'true') notFound()

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden font-ui text-bea-milk ${mono.variable}`}
      style={{ backgroundColor: '#0F0E0D' }}
    >
      {children}
    </div>
  )
}
