import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/role'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Only super_admin can create users
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super_admin can create users' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, full_name, role } = body as {
    email: string
    password: string
    full_name: string
    role: UserRole
  }

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'email, password, full_name, and role are required' }, { status: 400 })
  }

  // Use service role key to create user via Supabase Admin API
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // 1. Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,      // skip email verification for internal accounts
      user_metadata: { full_name },
    }),
  })

  const authData = await authRes.json()
  if (!authRes.ok) {
    return NextResponse.json({ error: authData.message ?? 'Failed to create auth user' }, { status: authRes.status })
  }

  const newUserId = authData.id as string

  // 2. Upsert user_profile with correct role and full name
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({ id: newUserId, full_name, role, is_active: true })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: newUserId })
}
