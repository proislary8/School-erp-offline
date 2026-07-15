import { createClient } from '@/lib/supabase/server'

export type UserRole = 'super_admin' | 'accountant' | 'hostel_warden' | 'inventory_staff' | 'developer'

/**
 * Returns the role of the currently authenticated user.
 * Use in Server Components and API routes.
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as UserRole) ?? null
}

/**
 * Returns the full user profile of the currently authenticated user.
 */
export async function getUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  return data
}

/**
 * Route-level access check. Returns true if the role is allowed.
 * Used in Server Components to gate page access.
 */
export function canAccess(role: UserRole | null, allowedRoles: UserRole[]): boolean {
  if (!role) return false
  return allowedRoles.includes(role)
}

/**
 * Navigation items visible per role (used in Sidebar).
 */
export const ROLE_NAV_WHITELIST: Record<UserRole, string[]> = {
  super_admin:      ['/', '/dashboard', '/students', '/school', '/hostel', '/combined', '/extracurricular', '/inventory', '/receipts', '/reports', '/settings', '/system'],
  accountant:       ['/dashboard', '/students', '/school', '/hostel', '/combined', '/extracurricular', '/inventory', '/receipts', '/reports'],
  hostel_warden:    ['/dashboard', '/students', '/hostel', '/combined', '/receipts', '/reports'],
  inventory_staff:  ['/inventory'],
  developer:        ['/system'],
}
