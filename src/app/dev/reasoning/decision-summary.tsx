import type { SelectedSession } from './types'

export default function DecisionSummary({
  selected,
}: {
  selected: SelectedSession | null
}) {
  if (!selected) {
    return (
      <div className="text-xs opacity-60">
        Decisions will appear here.
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-wider opacity-70 mb-4">
        decisions
      </h2>
      <ul className="space-y-3">
        {selected.decisions.map((d, i) => (
          <li key={i}>
            <a
              href={`#${d.anchor}`}
              className="block py-2 px-3 rounded transition-colors hover:opacity-100"
              style={{ backgroundColor: '#15130F', opacity: 0.85 }}
            >
              <div
                className="text-[11px] uppercase tracking-wider"
                style={{ color: '#D6A85A' }}
              >
                {d.label}
              </div>
              <div className="text-sm mt-0.5">{d.detail}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
