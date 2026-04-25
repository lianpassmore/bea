'use client'

import { useEffect, useRef } from 'react'

const BAR_COUNT = 28

type Props = {
  /**
   * Returns a `Uint8Array` of byte frequency data (0-255). The component
   * samples this every animation frame to drive bar height.
   *
   * Return `null` to keep bars at rest (e.g. before a stream is ready).
   */
  getFrequencyData: () => Uint8Array | null
  active?: boolean
}

export default function VoiceBars({ getFrequencyData, active = true }: Props) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number | null>(null)
  const getDataRef = useRef(getFrequencyData)

  useEffect(() => {
    getDataRef.current = getFrequencyData
  }, [getFrequencyData])

  useEffect(() => {
    if (!active) {
      for (const bar of barsRef.current) {
        if (bar) bar.style.transform = 'scaleY(0.08)'
      }
      return
    }

    const draw = () => {
      const bins = getDataRef.current()
      const bars = barsRef.current
      if (bins && bins.length > 0) {
        const usable = Math.floor(bins.length * 0.6)
        const binsPerBar = Math.max(1, Math.floor(usable / BAR_COUNT))
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0
          for (let j = 0; j < binsPerBar; j++) {
            sum += bins[i * binsPerBar + j] ?? 0
          }
          const avg = sum / binsPerBar / 255
          const boosted = Math.min(1, Math.pow(avg, 0.7) * 1.4)
          const scale = 0.08 + boosted * 0.92
          const bar = bars[i]
          if (bar) bar.style.transform = `scaleY(${scale.toFixed(3)})`
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) {
          const bar = bars[i]
          if (bar) bar.style.transform = 'scaleY(0.08)'
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active])

  return (
    <div
      className="flex items-center justify-center gap-0.75 h-24"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el
          }}
          className="w-0.5 h-full bg-bea-amber/80 rounded-full origin-center transition-transform duration-75 ease-out"
          style={{ transform: 'scaleY(0.08)' }}
        />
      ))}
    </div>
  )
}
