'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function SignOutButton() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500 disabled:opacity-50"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}