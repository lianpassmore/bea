'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type BackgroundVariant = 'arrival' | 'everyday' | 'forward' | 'rest' | 'witness'

function variantBody(variant: BackgroundVariant) {
  switch (variant) {
    case 'arrival':
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.15] mix-blend-multiply"
            style={{ backgroundImage: `url('/DTS_RAW_ELEMENT_Daniel_Farò_Photos_ID12896.webp')` }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-bea-milk via-bea-milk/40 to-transparent" />
        </>
      )
    case 'everyday':
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.12] mix-blend-multiply"
            style={{ backgroundImage: `url('/DTS_Home_Barista_Allie_Lehman_Photos_ID1436.webp')` }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-bea-milk via-bea-milk/60 to-transparent" />
        </>
      )
    case 'forward':
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.20] mix-blend-multiply grayscale-30"
            style={{ backgroundImage: `url('/DTS_In_Focus_Daniel_Farò_Photos_ID4991.webp')` }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-bea-milk via-bea-milk/50 to-bea-milk/10" />
        </>
      )
    case 'rest':
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.15] mix-blend-multiply"
            style={{ backgroundImage: `url('/DTS_Writers_Room_Kristine_Isabedra_Photos_ID999.webp')` }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#F5F1E8_100%)]" />
        </>
      )
    case 'witness':
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.18] mix-blend-multiply grayscale-20"
            style={{ backgroundImage: `url('/DTS_LIFE_IN_LILAC_Mar_Boerr_Photos_ID7459.webp')` }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-bea-milk/30 via-bea-milk/70 to-bea-milk" />
        </>
      )
  }
}

export default function PageBackground({ variant }: { variant: BackgroundVariant }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      {variantBody(variant)}
    </div>,
    document.body,
  )
}
