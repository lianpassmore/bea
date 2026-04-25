'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'bea.dev.reasoning.live'
const TOGGLE_EVENT = 'bea.dev.reasoning.live-changed'
const POLL_MS = 5000

const subscribe = (cb: () => void) => {
  window.addEventListener(TOGGLE_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(TOGGLE_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

const readLive = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const readLiveServer = () => false

export default function LiveToggle() {
  const router = useRouter()
  const live = useSyncExternalStore(subscribe, readLive, readLiveServer)

  // Polling loop. router.refresh() is not React state, so it's safe in the
  // effect body. The first tick is deferred via setTimeout so the effect
  // body itself remains synchronous-side-effect-free.
  useEffect(() => {
    if (!live) return
    const tick = () => router.refresh()
    const initial = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, POLL_MS)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(id)
    }
  }, [live, router])

  const onClick = () => {
    const next = !live
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, '1')
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(TOGGLE_EVENT))
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1 rounded text-xs transition-colors"
      style={{
        backgroundColor: live ? '#2A2418' : 'transparent',
        color: live ? '#D6A85A' : '#F5F1E8',
        border: '1px solid',
        borderColor: live ? '#D6A85A' : '#1F1D1B',
        opacity: live ? 1 : 0.7,
      }}
      aria-pressed={live}
      title={
        live
          ? `Polling every ${POLL_MS / 1000}s`
          : 'Static — click to enable polling'
      }
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${live ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: live ? '#D6A85A' : '#3A3A3A' }}
      />
      {live ? 'Live reasoning · on' : 'Live reasoning · off'}
    </button>
  )
}
