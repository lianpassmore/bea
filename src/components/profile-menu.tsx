'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Camera, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import {
  updatePrefs,
  getPrefs,
  type NotificationPrefs,
} from '@/app/actions/notification-prefs'
import { subscribeUser, unsubscribeUser } from '@/app/actions/push'
import { withdrawConsent } from '@/app/actions/consent'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

export type CrisisNotification = {
  id: string
  briefing: string
  crisis_level: 'concerned' | 'urgent'
  created_at: string
  affected_member_name: string
}

type Props = {
  memberId: string | null
  memberName: string | null
  avatarUrl: string | null
  notifications: CrisisNotification[]
  consentGiven: boolean
  consentGivenAt: string | null
}

function initialsFor(name: string | null) {
  if (!name) return '·'
  const words = name.trim().split(/\s+/).slice(0, 2)
  return words.map((w) => w[0]?.toUpperCase()).join('') || name[0]?.toUpperCase() || '·'
}

export default function ProfileMenu({ memberName, avatarUrl, notifications: initialNotifs, consentGiven, consentGivenAt }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<string | null>(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [notifs, setNotifs] = useState(initialNotifs)
  const [signingOut, setSigningOut] = useState(false)
  const [withdrawStage, setWithdrawStage] = useState<'idle' | 'confirm' | 'submitting'>('idle')
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [isIOSStandaloneNeeded, setIsIOSStandaloneNeeded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (!supported) {
      Promise.resolve().then(() => setIsIOSStandaloneNeeded(ios && !standalone))
      return
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setPushSupported(true)
        setIsIOSStandaloneNeeded(ios && !standalone)
        if (!sub) return
        setEndpoint(sub.endpoint)
        return getPrefs(sub.endpoint).then((p) => setPrefs(p))
      })
      .catch(() => undefined)
  }, [])

  const enablePush = async () => {
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      await subscribeUser({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      })
      setEndpoint(sub.endpoint)
      const p = await getPrefs(sub.endpoint)
      setPrefs(p)
    } catch (err) {
      console.error('enablePush failed:', err)
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    if (!endpoint) return
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await unsubscribeUser(endpoint)
      setEndpoint(null)
      setPrefs(null)
    } catch (err) {
      console.error('disablePush failed:', err)
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const dismissNotif = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/crisis-notifications/${id}/seen`, { method: 'POST' }).catch(console.error)
  }

  const onPickPhoto = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      if (!res.ok) throw new Error('upload failed')
      const data = await res.json()
      setPhoto(data.avatar_url)
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    setUploading(true)
    try {
      await fetch('/api/profile/avatar', { method: 'DELETE' })
      setPhoto(null)
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!prefs || !endpoint) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await updatePrefs(endpoint, next)
  }

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  const confirmWithdraw = async () => {
    setWithdrawStage('submitting')
    const res = await withdrawConsent()
    if (!res.success) {
      setWithdrawStage('idle')
      return
    }
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  const consentDate = consentGivenAt
    ? new Date(consentGivenAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const hasUnread = notifs.length > 0
  const initials = initialsFor(memberName)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasUnread ? `Profile, ${notifs.length} new` : 'Profile'}
        className="relative inline-flex items-center justify-center w-12 h-12 rounded-full overflow-hidden bg-bea-amber/15 text-bea-charcoal ring-1 ring-bea-olive hover:opacity-80 transition-opacity duration-300"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={memberName ?? 'Profile'} className="w-full h-full object-cover" />
        ) : (
          <span className="font-ui text-sm tracking-wide">{initials}</span>
        )}
        {hasUnread && (
          <span
            aria-hidden
            className="absolute top-0 right-0 inline-block w-2.5 h-2.5 rounded-full bg-bea-clay ring-2 ring-bea-milk"
          />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bea-charcoal/30 backdrop-blur-sm animate-fade-in"
          />
          <aside
            role="dialog"
            aria-label="Profile"
            className="absolute top-0 right-0 h-full w-full max-w-sm bg-bea-milk shadow-2xl flex flex-col"
          >
            <div className="flex-1 overflow-y-auto flex flex-col gap-10 px-6 py-8">
              <div className="flex justify-end -mb-4">
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-bea-blue hover:text-bea-charcoal transition-colors"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              <section className="flex items-center gap-5">
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-bea-amber/15 flex items-center justify-center shrink-0 ring-1 ring-bea-olive">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={memberName ?? 'Profile'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-serif text-2xl text-bea-charcoal">{initials}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <h2 className="font-body text-3xl text-bea-charcoal leading-tight truncate">
                    {memberName ?? 'Your space'}
                  </h2>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onPickPhoto(f)
                      e.target.value = ''
                    }}
                  />
                  <div className="flex items-center gap-3">
                    {!photo || uploading ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-1.5 font-ui text-xs text-bea-blue hover:text-bea-amber transition-colors duration-300 disabled:opacity-40"
                      >
                        <Camera size={12} strokeWidth={1.5} />
                        {uploading ? 'Uploading...' : 'Add photo'}
                      </button>
                    ) : photoMenuOpen ? (
                      <>
                        <button
                          onClick={() => {
                            fileInputRef.current?.click()
                            setPhotoMenuOpen(false)
                          }}
                          className="font-ui text-xs text-bea-blue hover:text-bea-amber transition-colors duration-300"
                        >
                          Upload new
                        </button>
                        <button
                          onClick={() => {
                            removePhoto()
                            setPhotoMenuOpen(false)
                          }}
                          className="font-ui text-xs text-bea-blue hover:text-bea-clay transition-colors duration-300"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setPhotoMenuOpen(false)}
                          className="font-ui text-xs text-bea-blue/60 hover:text-bea-charcoal transition-colors duration-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setPhotoMenuOpen(true)}
                        className="inline-flex items-center gap-1.5 font-ui text-xs text-bea-blue hover:text-bea-amber transition-colors duration-300"
                      >
                        <Camera size={12} strokeWidth={1.5} />
                        Change
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <Section title="Messages from Bea">
                {notifs.length === 0 ? (
                  <p className="font-body text-bea-blue leading-relaxed">
                    Nothing waiting for you right now.
                  </p>
                ) : (
                  <ul className="space-y-5">
                    {notifs.map((n) => (
                      <li
                        key={n.id}
                        className={`border-l-2 pl-4 ${
                          n.crisis_level === 'urgent' ? 'border-bea-clay' : 'border-bea-clay/40'
                        }`}
                      >
                        <p className="font-serif text-base text-bea-charcoal mb-1">
                          About {n.affected_member_name}
                        </p>
                        <p className="font-body text-bea-charcoal leading-relaxed mb-3">
                          {n.briefing}
                        </p>
                        <button
                          onClick={() => dismissNotif(n.id)}
                          className="font-ui text-xs uppercase tracking-wide text-bea-blue hover:text-bea-charcoal transition-colors"
                        >
                          I&apos;ve seen this
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Notifications">
                <div className="space-y-5">
                  <Toggle
                    label={prefs ? 'Notifications are on' : 'Notifications are off'}
                    on={Boolean(prefs)}
                    onChange={prefs ? disablePush : enablePush}
                    disabled={pushBusy || !pushSupported}
                  />

                  {!pushSupported && isIOSStandaloneNeeded && (
                    <p className="font-ui text-xs text-bea-blue/80 leading-relaxed">
                      To turn these on on iPhone, tap the share icon in Safari and choose &ldquo;Add to Home Screen&rdquo;, then open Bea from your home screen.
                    </p>
                  )}

                  {prefs && (
                    <div className="space-y-4 pl-1">
                      <Toggle
                        label="Five minutes before Bea begins"
                        on={prefs.advance}
                        onChange={() => togglePref('advance')}
                      />
                      <Toggle
                        label="When Bea turns on"
                        on={prefs.start}
                        onChange={() => togglePref('start')}
                      />
                      <Toggle
                        label="When Bea turns off"
                        on={prefs.end}
                        onChange={() => togglePref('end')}
                      />
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Privacy">
                {withdrawStage === 'idle' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-bea-charcoal">
                        Consent
                      </span>
                      <span className="font-ui text-sm text-bea-olive">
                        {consentGiven ? 'Accepted' : 'Not given'}
                      </span>
                    </div>
                    {consentGiven && consentDate && (
                      <p className="font-ui text-xs text-bea-blue/80">
                        Given on {consentDate}.
                      </p>
                    )}
                    <p className="font-body text-sm text-bea-olive leading-relaxed">
                      You can withdraw your consent at any time. When you do, Bea will stop listening for you. You are also welcome to tell us directly.
                    </p>
                    {consentGiven && (
                      <button
                        onClick={() => setWithdrawStage('confirm')}
                        className="font-ui text-sm text-bea-clay hover:text-bea-charcoal transition-colors duration-300"
                      >
                        Withdraw my consent from Bea
                      </button>
                    )}
                  </div>
                )}

                {withdrawStage === 'confirm' && (
                  <div className="space-y-5">
                    <p className="font-serif text-lg text-bea-charcoal leading-snug">
                      Are you sure?
                    </p>
                    <p className="font-body text-sm text-bea-olive leading-relaxed">
                      Bea will stop listening, and you will be signed out. You can come back any time.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={confirmWithdraw}
                        className="w-full bg-bea-clay text-bea-milk hover:bg-[#7a3a2a] rounded-full py-3 font-body transition-all duration-300"
                      >
                        Yes, withdraw my consent
                      </button>
                      <button
                        onClick={() => setWithdrawStage('idle')}
                        className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {withdrawStage === 'submitting' && (
                  <p className="font-body text-sm text-bea-olive">
                    Withdrawing your consent...
                  </p>
                )}
              </Section>

              <Section title="If you need someone now">
                <p className="font-body text-sm text-bea-olive leading-relaxed mb-4">
                  Bea is not a crisis service. If you are in distress, please reach out:
                </p>
                <ul className="space-y-3">
                  <Hotline
                    name="Need to talk?"
                    detail="Free call or text 1737 — anytime"
                    href="tel:1737"
                  />
                  <Hotline
                    name="Lifeline Aotearoa"
                    detail="0800 543 354 — 24/7"
                    href="tel:0800543354"
                  />
                  <Hotline
                    name="Youthline"
                    detail="0800 376 633 — for young people"
                    href="tel:0800376633"
                  />
                  <Hotline
                    name="Emergency"
                    detail="111 — if you or someone is in immediate danger"
                    href="tel:111"
                  />
                </ul>
              </Section>

            </div>
            <div className="border-t border-bea-charcoal/10 px-6 py-4 bg-bea-milk">
              <button
                onClick={signOut}
                disabled={signingOut}
                className="font-ui text-sm text-bea-blue hover:text-bea-charcoal transition-colors duration-500 disabled:opacity-50"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-bea-charcoal/10 pt-6">
      <h3 className="font-ui text-xs uppercase tracking-wider text-bea-blue mb-4">{title}</h3>
      {children}
    </section>
  )
}

function Toggle({
  label,
  on,
  onChange,
  disabled = false,
}: {
  label: string
  on: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="flex items-center justify-between w-full text-left group disabled:opacity-50"
    >
      <span className="font-body text-bea-charcoal leading-relaxed pr-4">{label}</span>
      <span
        className={`relative inline-block w-10 h-5 rounded-full transition-colors duration-300 shrink-0 ${
          on ? 'bg-bea-amber' : 'bg-bea-charcoal/15'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-bea-milk shadow transition-transform duration-300 ${
            on ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function Hotline({ name, detail, href }: { name: string; detail: string; href: string }) {
  return (
    <li>
      <a
        href={href}
        className="flex items-center justify-between gap-4 group"
      >
        <span className="flex flex-col">
          <span className="font-body text-bea-charcoal">{name}</span>
          <span className="font-ui text-sm text-bea-olive">{detail}</span>
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className="text-bea-blue group-hover:text-bea-charcoal transition-colors flex-shrink-0"
        />
      </a>
    </li>
  )
}
