import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/role'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role as UserRole) ?? 'accountant'
  const fullName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar role={role} />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar fullName={fullName} role={role} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
