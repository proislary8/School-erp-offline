import { Bell } from 'lucide-react'
import type { UserRole } from '@/lib/role'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:     'Super Admin',
  accountant:      'Accountant',
  hostel_warden:   'Hostel Warden',
  inventory_staff: 'Inventory Staff',
  developer:       'Developer',
}

export default function Topbar({
  fullName,
  role,
}: {
  fullName: string
  role: UserRole
}) {
  const initials = fullName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="topbar">
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '7px' }}>
          <Bell size={16} />
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '6px 14px 6px 6px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '999px',
        }}>
          <div className="avatar" style={{ width: 28, height: 28, fontSize: '11px' }}>{initials}</div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>
              {fullName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.2 }}>
              {ROLE_LABELS[role]}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
