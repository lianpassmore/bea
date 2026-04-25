// Root layout opts out of its mobile chrome on /audit/* (see app/layout.tsx),
// so this layout just provides the background colour and minimum height.

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bea-milk text-bea-charcoal min-h-screen">
      {children}
    </div>
  )
}
