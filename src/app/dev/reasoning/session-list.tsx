import Link from 'next/link'
import type { SessionFilter, SessionListItem } from './types'

const FILTERS: { value: SessionFilter; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'individual', label: '1:1' },
  { value: 'guided', label: 'group' },
  { value: 'passive', label: 'passive' },
  { value: 'family-insight', label: 'family read' },
  { value: 'has-crisis', label: 'crisis' },
  { value: 'has-tikanga', label: 'tikanga' },
]

const KIND_LABEL: Record<SessionListItem['kind'], string> = {
  individual: '1:1',
  guided: 'group',
  passive: 'passive',
  'family-insight': 'family read',
}

const KIND_DOT: Record<SessionListItem['kind'], string> = {
  individual: '#7A836A',
  guided: '#D6A85A',
  passive: '#6B7280',
  'family-insight': '#C47A6D',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SessionList({
  sessions,
  selectedId,
  filter,
}: {
  sessions: SessionListItem[]
  selectedId: string | null
  filter: SessionFilter
}) {
  return (
    <div>
      <div
        className="sticky top-0 z-10 px-3 py-3 flex flex-wrap gap-1 border-b"
        style={{ borderColor: '#1F1D1B', backgroundColor: '#0F0E0D' }}
      >
        {FILTERS.map((f) => {
          const active = f.value === filter
          const href =
            f.value === 'all'
              ? selectedId
                ? `/dev/reasoning?id=${encodeURIComponent(selectedId)}`
                : `/dev/reasoning`
              : selectedId
                ? `/dev/reasoning?filter=${f.value}&id=${encodeURIComponent(selectedId)}`
                : `/dev/reasoning?filter=${f.value}`
          return (
            <Link
              key={f.value}
              href={href}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: active ? '#D6A85A' : 'transparent',
                color: active ? '#0F0E0D' : '#F5F1E8',
                border: '1px solid',
                borderColor: active ? '#D6A85A' : '#1F1D1B',
              }}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {sessions.length === 0 ? (
        <p className="px-4 py-6 text-xs opacity-60">No sessions match.</p>
      ) : (
        <ul>
          {sessions.map((s) => {
            const active = s.id === selectedId
            const filterParam = filter === 'all' ? '' : `&filter=${filter}`
            const href = `/dev/reasoning?id=${encodeURIComponent(s.id)}${filterParam}`
            return (
              <li key={s.id}>
                <Link
                  href={href}
                  scroll={false}
                  className="block px-4 py-3 border-b transition-colors"
                  style={{
                    borderColor: '#1F1D1B',
                    backgroundColor: active ? '#1A1816' : 'transparent',
                    borderLeft: active
                      ? '2px solid #D6A85A'
                      : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        s.isFresh ? 'animate-pulse' : ''
                      }`}
                      style={{ backgroundColor: KIND_DOT[s.kind] }}
                    />
                    <span className="text-[11px] uppercase tracking-wider opacity-70">
                      {KIND_LABEL[s.kind]}
                    </span>
                    {s.isFresh && (
                      <span
                        className="text-[10px] uppercase tracking-wider"
                        style={{ color: '#D6A85A' }}
                      >
                        live
                      </span>
                    )}
                    <span className="text-[11px] opacity-50 ml-auto">
                      {formatTime(s.startedAt)}
                    </span>
                  </div>
                  <div className="text-sm">
                    {s.memberNames.length > 0
                      ? s.memberNames.join(', ')
                      : s.kind === 'family-insight'
                        ? 'whānau-wide'
                        : '—'}
                  </div>
                  {s.oneLine && (
                    <div className="text-xs opacity-60 mt-1 line-clamp-2">
                      {s.oneLine}
                    </div>
                  )}
                  {(s.hasCrisis || s.hasTikangaRewrite) && (
                    <div className="flex gap-1 mt-2">
                      {s.hasCrisis && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: '#3A1F1B',
                            color: '#C47A6D',
                          }}
                        >
                          crisis
                        </span>
                      )}
                      {s.hasTikangaRewrite && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: '#2A2418',
                            color: '#D6A85A',
                          }}
                        >
                          tikanga rewrite
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
