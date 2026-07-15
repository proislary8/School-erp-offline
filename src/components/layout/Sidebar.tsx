'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, School, Building2, Layers,
  Activity, Package, Receipt, BarChart3, Settings,
  GraduationCap, LogOut, ChevronRight, Terminal
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/role'

type NavItem = { href: string; icon: React.ElementType; label: string }
type NavGroup = { label: string; items: NavItem[] }

const ALL_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/students',        icon: Users,           label: 'Students' },
    ]
  },
  {
    label: 'Fee Management',
    items: [
      { href: '/school',          icon: School,    label: 'School Fees' },
      { href: '/hostel',          icon: Building2, label: 'Hostel Fees' },
      { href: '/combined',        icon: Layers,    label: 'Combined View' },
      { href: '/extracurricular', icon: Activity,  label: 'Extracurricular' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { href: '/inventory',       icon: Package,   label: 'Inventory' },
      { href: '/receipts',        icon: Receipt,   label: 'Receipts' },
      { href: '/reports',         icon: BarChart3, label: 'Reports' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings',        icon: Settings,  label: 'Settings' },
      { href: '/system',          icon: Terminal,  label: 'System' },
    ]
  },
]

// Which hrefs are visible per role
const VISIBLE: Record<UserRole, string[]> = {
  super_admin:     ['/dashboard','/students','/school','/hostel','/combined','/extracurricular','/inventory','/receipts','/reports','/settings','/system'],
  accountant:      ['/dashboard','/students','/school','/hostel','/combined','/extracurricular','/inventory','/receipts','/reports'],
  hostel_warden:   ['/dashboard','/students','/hostel','/combined','/receipts','/reports'],
  inventory_staff: ['/inventory'],
  developer:       ['/system'],
}

// Role display labels + colours
const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  super_admin:     { label: 'Super Admin',  color: 'var(--accent)' },
  accountant:      { label: 'Accountant',   color: 'var(--green)' },
  hostel_warden:   { label: 'Hostel Warden',color: 'var(--amber)' },
  inventory_staff: { label: 'Inventory',    color: 'var(--orange)' },
  developer:       { label: 'Developer',    color: 'var(--text-muted)' },
}

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const allowed = VISIBLE[role] ?? []

  const visibleGroups: NavGroup[] = ALL_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => allowed.includes(i.href)) }))
    .filter(g => g.items.length > 0)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const meta = ROLE_META[role]

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <GraduationCap size={20} color="white" />
        </div>
        <div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', lineHeight: 1.2 }}>
            School ERP
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 1 }}>Accounting Module</div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: meta.color, background: meta.color + '18',
          border: `1px solid ${meta.color}30`,
          padding: '3px 10px', borderRadius: 999,
        }}>
          {meta.label}
        </span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <div className="sidebar-section-label">{group.label}</div>
            {group.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                  <item.icon size={16} className="nav-icon" />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isActive && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
