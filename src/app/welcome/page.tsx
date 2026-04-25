import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/sign-out-button'
import PageBackground from '@/components/page-background'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: linked } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (linked) {
    redirect('/')
  }

  return (
    <div className="flex flex-col flex-1 justify-center pb-12 md:pb-20 animate-fade-in">
      <PageBackground variant="witness" />

      <div className="space-y-6 md:space-y-8 max-w-sm md:max-w-md">
        <h1 className="font-serif text-2xl md:text-4xl text-bea-charcoal leading-tight">
          Waiting on an introduction.
        </h1>

        <div className="space-y-4 md:space-y-6">
          <p className="font-body text-base md:text-lg text-bea-charcoal leading-relaxed">
            I can see you&rsquo;ve arrived, but I don&rsquo;t know which family you belong to yet.
          </p>
          <p className="font-body text-base md:text-lg text-bea-blue leading-relaxed">
            When the person who invited you makes the connection on their end, we can begin. There&rsquo;s no rush.
          </p>
        </div>

        <div className="pt-8 md:pt-12">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
