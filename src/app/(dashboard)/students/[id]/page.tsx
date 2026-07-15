import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Users, School, Building2, Activity, ArrowLeft,
  Phone, Calendar, Hash, IndianRupee, ChevronRight
} from 'lucide-react'

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function computeStatus(amountDue: number, amountPaid: number, dueDate: string) {
  const now = new Date()
  const due = new Date(dueDate)
  if (amountPaid >= amountDue) return { label: 'Paid', cls: 'badge-green' }
  if (amountPaid > 0 && now > due) return { label: 'Partial/Overdue', cls: 'badge-red' }
  if (amountPaid > 0) return { label: 'Partial', cls: 'badge-orange' }
  if (now > due) return { label: 'Overdue', cls: 'badge-red' }
  return { label: 'Pending', cls: 'badge-amber' }
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: student }, { data: transactions }] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase
      .from('payment_transactions')
      .select('*, fee_structures(name, section_type)')
      .eq('student_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!student) notFound()

  const txns = transactions ?? []

  // Aggregate per section
  const sections = ['school', 'hostel', 'extracurricular'] as const
  const sectionTotals = Object.fromEntries(
    sections.map(s => {
      const relevant = txns.filter(t => t.section_type === s)
      const due  = relevant.reduce((acc, t) => acc + (t.amount_due  ?? 0), 0)
      const paid = relevant.reduce((acc, t) => acc + (t.amount_paid ?? 0), 0)
      return [s, { due, paid, balance: Math.max(0, due - paid) }]
    })
  ) as Record<typeof sections[number], { due: number; paid: number; balance: number }>

  const totalBalance = sections.reduce((acc, s) => acc + sectionTotals[s].balance, 0)

  return (
    <div>
      {/* Back link */}
      <Link href="/students" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Students
      </Link>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'white', fontFamily: 'Outfit',
            flexShrink: 0,
          }}>
            {student.full_name.charAt(0)}
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>{student.full_name}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--accent)30' }}>
                {student.student_id}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Class {student.class_grade}{student.section ? ` – ${student.section}` : ''}</span>
              {student.is_school_enrolled && <span className="badge badge-accent"><School size={10} /> School</span>}
              {student.is_hostel_enrolled && <span className="badge badge-green"><Building2 size={10} /> Hostel</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/school?student=${id}`} className="btn btn-secondary btn-sm">
            <School size={13} /> School Fee
          </Link>
          <Link href={`/hostel?student=${id}`} className="btn btn-primary btn-sm">
            <IndianRupee size={13} /> Hostel Fee
          </Link>
        </div>
      </div>

      {/* Profile + Balance grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
        {/* Profile card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Profile</h3>
          {[
            { icon: Users,    label: 'Guardian',   value: student.guardian_name    || '—' },
            { icon: Phone,    label: 'Contact',    value: student.guardian_contact || '—' },
            { icon: Calendar, label: 'Admitted',   value: student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-IN') : '—' },
            { icon: Hash,     label: 'Roll No.',   value: student.roll_no || '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={13} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Balance cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Total summary */}
          <div className="card" style={{ background: totalBalance > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)', borderColor: totalBalance > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Total Outstanding Balance</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit', color: totalBalance > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {totalBalance > 0 ? formatCurrency(totalBalance) : '✓ All Clear'}
                </div>
              </div>
              <IndianRupee size={32} color={totalBalance > 0 ? 'var(--red)' : 'var(--green)'} style={{ opacity: 0.3 }} />
            </div>
          </div>

          {/* Per-section breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { key: 'school' as const,        label: 'School',          icon: School,   color: 'var(--accent)' },
              { key: 'hostel' as const,         label: 'Hostel',          icon: Building2,color: 'var(--green)' },
              { key: 'extracurricular' as const,label: 'Extracurricular', icon: Activity, color: 'var(--amber)' },
            ].map(({ key, label, icon: Icon, color }) => {
              const t = sectionTotals[key]
              return (
                <div key={key} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
                    <Icon size={14} color={color} style={{ opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit', color: t.balance > 0 ? 'var(--red)' : 'var(--text-primary)', marginBottom: 6 }}>
                    {t.balance > 0 ? formatCurrency(t.balance) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Paid: <span style={{ color: 'var(--green)' }}>{formatCurrency(t.paid)}</span>
                    {' / '}Due: {formatCurrency(t.due)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15 }}>Payment History</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{txns.length} record{txns.length !== 1 ? 's' : ''}</span>
        </div>

        {txns.length === 0 ? (
          <div className="empty-state">
            <IndianRupee size={40} />
            <p>No payment records yet</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Section</th>
                  <th>Fee Head</th>
                  <th>Amount Due</th>
                  <th>Amount Paid</th>
                  <th>Late Fee</th>
                  <th>Balance</th>
                  <th>Due Date</th>
                  <th>Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {txns.map(tx => {
                  const balance = Math.max(0, (tx.amount_due ?? 0) - (tx.amount_paid ?? 0))
                  const status = computeStatus(tx.amount_due ?? 0, tx.amount_paid ?? 0, tx.due_date)
                  const fs = tx.fee_structures as { name: string; section_type: string } | null
                  return (
                    <tr key={tx.id} className={balance === 0 ? 'row-paid' : new Date(tx.due_date) < new Date() ? 'row-overdue' : 'row-pending'}>
                      <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{tx.receipt_no}</span></td>
                      <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{tx.section_type}</span></td>
                      <td>{fs?.name ?? '—'}</td>
                      <td>{formatCurrency(tx.amount_due ?? 0)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(tx.amount_paid ?? 0)}</td>
                      <td style={{ color: (tx.late_fee ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {(tx.late_fee ?? 0) > 0 ? formatCurrency(tx.late_fee ?? 0) : '—'}
                      </td>
                      <td style={{ color: balance > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </td>
                      <td>{tx.due_date ? new Date(tx.due_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ textTransform: 'capitalize', fontSize: 12, color: 'var(--text-secondary)' }}>{tx.payment_mode ?? '—'}</td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
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
