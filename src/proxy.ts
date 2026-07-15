import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/role'

// Routes each role is ALLOWED to access (prefix match)
const ROLE_ALLOWED_PREFIXES: Record<UserRole, string[]> = {
  super_admin:     ['/'],          // everything
  accountant:      ['/dashboard', '/students', '/school', '/hostel', '/combined', '/extracurricular', '/inventory', '/receipts', '/reports', '/api'],
  hostel_warden:   ['/dashboard', '/students', '/hostel', '/combined', '/receipts', '/reports', '/api'],
  inventory_staff: ['/inventory', '/api'],
  developer:       ['/system', '/api/system'],
}

// Default landing page per role when they hit a blocked route
const ROLE_HOME: Record<UserRole, string> = {
  super_admin:     '/dashboard',
  accountant:      '/dashboard',
  hostel_warden:   '/hostel',
  inventory_staff: '/inventory',
  developer:       '/system',
}

function isAllowed(role: UserRole, pathname: string): boolean {
  if (role === 'super_admin') return true
  const prefixes = ROLE_ALLOWED_PREFIXES[role] ?? []
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 1. Not logged in → redirect to login (except for /login itself)
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Logged in + on /login → redirect to role home
  if (user && pathname === '/login') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = (profile?.role as UserRole) ?? 'accountant'
    const url = request.nextUrl.clone()
    url.pathname = ROLE_HOME[role]
    return NextResponse.redirect(url)
  }

  // 3. Logged in + on a protected route → enforce role
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = (profile?.role as UserRole) ?? 'accountant'

    // Skip role check for static/public assets
    if (!isAllowed(role, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role]
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
