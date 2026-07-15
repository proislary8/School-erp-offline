import { createClient } from '@/lib/supabase/server'
import {
  Users, IndianRupee, AlertTriangle, CheckCircle2,
  TrendingUp, Clock, Package, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [students, transactions, inventory] = await Promise.all([
    supabase.from('students').select('id, is_school_enrolled, is_hostel_enrolled'),
    supabase.from('payment_transactions').select('amount_due, amount_paid, due_date, payment_date, section_type'),
    supabase.from('inventory_items').select('quantity_available, reorder_threshold'),
  ])

  const totalStudents = students.data?.length ?? 0
  const hostelStudents = students.data?.filter(s => s.is_hostel_enrolled).length ?? 0

  const now = new Date()
  const txns = transactions.data ?? []
  const totalCollected = txns.reduce((s, t) => s + (t.amount_paid ?? 0), 0)
  const totalPending = txns.filter(t => t.amount_paid < t.amount_due && new Date(t.due_date) >= now).reduce((s, t) => s + (t.amount_due - t.amount_paid), 0)
  const overdueCount = txns.filter(t => t.amount_paid < t.amount_due && new Date(t.due_date) < now).length
  const lowStockCount = (inventory.data ?? []).filter(i => i.quantity_available <= i.reorder_threshold).length

  return { totalStudents, hostelStudents, totalCollected, totalPending, overdueCount, lowStockCount }
}

async function getRecentTransactions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('payment_transactions')
    .select('*, students(full_name, class_grade, student_id), fee_structures(name)')
    .order('created_at', { ascending: false })
    .limit(8)
  return data ?? []
}

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType, label: string, value: string, sub?: string, color: string
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          background: color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const stats = await getDashboardStats(supabase)
  const recent = await getRecentTransactions(supabase)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back — here's what's happening today</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/students" className="btn btn-secondary btn-sm">
            <Users size={14} /> Manage Students
          </Link>
          <Link href="/school" className="btn btn-primary btn-sm">
            <IndianRupee size={14} /> Record Payment
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon={Users}        label="Total Students"  value={String(stats.totalStudents)}  sub={`${stats.hostelStudents} in hostel`} color="var(--accent)" />
        <StatCard icon={CheckCircle2} label="Total Collected"  value={formatCurrency(stats.totalCollected)} sub="All time"           color="var(--green)" />
        <StatCard icon={Clock}        label="Pending Dues"     value={formatCurrency(stats.totalPending)}   sub="Within due date"   color="var(--amber)" />
        <StatCard icon={AlertTriangle}label="Overdue Records"  value={String(stats.overdueCount)}  sub="Past due date"    color="var(--red)" />
        <StatCard icon={Package}      label="Low Stock Items"  value={String(stats.lowStockCount)} sub="Need restocking"  color="var(--orange)" />
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { href: '/school', label: 'School Fees', desc: 'Manage fee collection' },
          { href: '/hostel', label: 'Hostel Fees', desc: 'Hostel billing' },
          { href: '/combined', label: 'Combined View', desc: 'Full student statement' },
          { href: '/inventory', label: 'Inventory', desc: 'Stock management' },
          { href: '/reports', label: 'Reports', desc: 'Generate reports' },
          { href: '/receipts', label: 'Receipts', desc: 'Print / reprint' },
        ].map(q => (
          <Link key={q.href} href={q.href} className="quick-link-card"
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{q.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{q.desc}</div>
            </div>
            <ArrowRight size={14} color="var(--text-muted)" />
          </Link>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px' }}>Recent Transactions</h3>
          <Link href="/receipts" className="btn btn-ghost btn-sm">View all <ArrowRight size={13} /></Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <IndianRupee size={40} />
            <p>No transactions yet</p>
            <p style={{ fontSize: '12px' }}>Record your first payment to get started</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Student</th>
                  <th>Fee Head</th>
                  <th>Section</th>
                  <th>Amount Paid</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx: Record<string, unknown>) => {
                  const now = new Date()
                  const due = new Date(tx.due_date as string)
                  const paid = tx.amount_paid as number
                  const total = tx.amount_due as number
                  let status = 'Pending', badgeClass = 'badge-amber'
                  if (paid >= total) { status = 'Paid'; badgeClass = 'badge-green' }
                  else if (now > due && paid === 0) { status = 'Overdue'; badgeClass = 'badge-red' }
                  else if (paid > 0 && paid < total) { status = 'Partial'; badgeClass = 'badge-orange' }

                  const student = tx.students as Record<string, string> | null
                  const feeStr = tx.fee_structures as Record<string, string> | null

                  return (
                    <tr key={tx.id as string}>
                      <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{tx.receipt_no as number}</span></td>
                      <td>
                        <div className="text-primary">{student?.full_name ?? '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Class {student?.class_grade} · {student?.student_id}</div>
                      </td>
                      <td>{feeStr?.name ?? '—'}</td>
                      <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{(tx.section_type as string)?.replace('_', ' ')}</span></td>
                      <td className="text-primary">{formatCurrency(paid)}</td>
                      <td>{tx.payment_date ? new Date(tx.payment_date as string).toLocaleDateString('en-IN') : '—'}</td>
                      <td><span className={`badge ${badgeClass}`}>{status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
