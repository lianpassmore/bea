import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/welcome', '/demo']
const PUBLIC_PREFIXES = ['/auth/', '/audit/']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function updateSession(request: NextRequest) {
  // Forward the pathname as a request header so server components in the root
  // layout can branch on the route (e.g. skip header/footer chrome on /audit).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() validates the JWT and refreshes the access token if needed.
  // Skipping it means sessions silently expire after the access-token TTL.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && !isPublic(pathname)) {
    const { data: linked } = await supabase
      .from('members')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!linked) {
      const url = request.nextUrl.clone()
      url.pathname = '/welcome'
      return NextResponse.redirect(url)
    }
  }

  return response
}
