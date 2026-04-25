'use client'

import { useState } from 'react'

export function ExpandableThinking({ trace }: { trace: string }) {
  const [open, setOpen] = useState(false)
  if (!trace) return null
  return (
    <div className="mt-4 border-t border-bea-charcoal/10 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-ui text-xs uppercase tracking-wider text-bea-charcoal/60 hover:text-bea-charcoal transition-colors"
      >
        {open ? '− hide' : '+ show'} full thinking trace
      </button>
      {open && (
        <pre className="mt-3 whitespace-pre-wrap font-body text-sm leading-relaxed text-bea-charcoal/80 bg-bea-milk/50 border border-bea-charcoal/10 rounded-md p-4">
          {trace}
        </pre>
      )}
    </div>
  )
}
