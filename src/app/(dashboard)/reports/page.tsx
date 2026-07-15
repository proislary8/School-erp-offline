'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Download, Users, IndianRupee, AlertTriangle, Clock, BookOpen } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

type TabKey = 'collection' | 'pending' | 'defaulters' | 'latefee' | 'ledger'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

export default function ReportsPage() {
  const supabase = createClient()
  const [tab, setTab]   = useState<TabKey>('collection')
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [year, setYear]        = useState('2025-26')
  const [overdueDays, setOverdueDays] = useState(30)

  // Ledger state
  const [students, setStudents]         = useState<{ id: string; full_name: string; class_grade: string; student_id: string }[]>([])
  const [ledgerStudentId, setLedgerStudentId] = useState('')
  const [ledgerData, setLedgerData]     = useState<Record<string, unknown>[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Load student list once for ledger tab
  useEffect(() => {
    supabase.from('students').select('id, full_name, class_grade, student_id').order('full_name')
      .then(({ data }) => setStudents(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadReport = useCallback(async () => {
    setLoading(true)
    if (tab === 'collection') {
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('payment_date, amount_paid, section_type')
        .eq('academic_year', year)
        .gt('amount_paid', 0)

      // Grouped by mode for stat cards
      const byMode: Record<string, number> = {}
      // Grouped by month+section for chart
      const byMonth: Record<string, { school: number; hostel: number; extracurricular: number }> = {}
      for (const t of txns ?? []) {
        // month
        if (t.payment_date) {
          const d = new Date(t.payment_date)
          const idx = ((d.getMonth() - 3 + 12) % 12) // Apr=0..Mar=11
          const key = MONTHS[idx]
          if (!byMonth[key]) byMonth[key] = { school: 0, hostel: 0, extracurricular: 0 }
          const section = (t.section_type as string) ?? 'school'
          if (section in byMonth[key]) {
            byMonth[key][section as keyof typeof byMonth[string]] += t.amount_paid ?? 0
          }
        }
      }
      // Build ordered chart data
      const orderedChart = MONTHS.map(m => ({
        month: m,
        school:          byMonth[m]?.school          ?? 0,
        hostel:          byMonth[m]?.hostel          ?? 0,
        extracurricular: byMonth[m]?.extracurricular ?? 0,
      })).filter(m => m.school + m.hostel + m.extracurricular > 0)
      setChartData(orderedChart)

      // Stat cards by mode
      for (const t of txns ?? []) {
        const mode = (t as Record<string, unknown>).payment_mode as string ?? 'unspecified'
        byMode[mode] = (byMode[mode] ?? 0) + ((t as Record<string, unknown>).amount_paid as number ?? 0)
      }
      setData(Object.entries(byMode).map(([mode, total]) => ({ mode, total })))

    } else if (tab === 'pending') {
      const now = new Date().toISOString().split('T')[0]
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('*, students(full_name, class_grade, student_id), fee_structures(name)')
        .eq('academic_year', year)
        .gte('due_date', now)
      setData((txns ?? []).filter((t: Record<string, unknown>) => Number(t.amount_paid) < Number(t.amount_due)))

    } else if (tab === 'defaulters') {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - overdueDays)
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('*, students(full_name, class_grade, student_id, guardian_contact), fee_structures(name)')
        .eq('academic_year', year)
        .lt('due_date', cutoffDate.toISOString().split('T')[0])
      setData((txns ?? []).filter((t: Record<string, unknown>) => Number(t.amount_paid) < Number(t.amount_due)))

    } else if (tab === 'latefee') {
      const { data: txns } = await supabase
        .from('payment_transactions')
        .select('*, students(full_name, class_grade, student_id), fee_structures(name)')
        .eq('academic_year', year)
        .gt('late_fee', 0)
      setData(txns ?? [])
    }
    setLoading(false)
  }, [tab, year, overdueDays, supabase])

  useEffect(() => { if (tab !== 'ledger') loadReport() }, [loadReport, tab])

  async function loadLedger() {
    if (!ledgerStudentId) return
    setLedgerLoading(true)
    const { data: txns } = await supabase
      .from('payment_transactions')
      .select('*, fee_structures(name, section_type)')
      .eq('student_id', ledgerStudentId)
      .eq('academic_year', year)
      .order('payment_date', { ascending: true })
    setLedgerData(txns ?? [])
    setLedgerLoading(false)
  }

  useEffect(() => { if (tab === 'ledger' && ledgerStudentId) loadLedger() }, [tab, ledgerStudentId, year])

  function handleExportCSV(rows: Record<string, unknown>[]) {
    if (!rows.length) return
    const headers = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object')
    const csvRows = rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    const csv  = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `report_${tab}_${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { key: 'collection', label: 'Collection Summary', icon: IndianRupee },
    { key: 'pending',    label: 'Pending Dues',       icon: Clock },
    { key: 'defaulters', label: 'Defaulters List',    icon: AlertTriangle },
    { key: 'latefee',   label: 'Late Fee Report',     icon: Users },
    { key: 'ledger',    label: 'Student Ledger',      icon: BookOpen },
  ] as const

  const selectedStudent = students.find(s => s.id === ledgerStudentId)
  const ledgerTotals = ledgerData.reduce<{ due: number; paid: number; late: number }>(
    (acc, t) => ({
      due:  acc.due  + Number(t.amount_due),
      paid: acc.paid + Number(t.amount_paid),
      late: acc.late + Number(t.late_fee ?? 0),
    }), { due: 0, paid: 0, late: 0 }
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Financial reports and analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="select" style={{ width: 120 }} value={year} onChange={e => setYear(e.target.value)}>
            {['2023-24','2024-25','2025-26','2026-27'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab !== 'ledger' && (
            <button className="btn btn-secondary" onClick={() => handleExportCSV(data)} disabled={!data.length}>
              <Download size={14} /> Export CSV
            </button>
          )}
          {tab === 'ledger' && ledgerData.length > 0 && (
            <button className="btn btn-secondary" onClick={() => handleExportCSV(ledgerData)}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key as TabKey)}>
            <t.icon size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Defaulters filter */}
      {tab === 'defaulters' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Show defaulters overdue by more than</span>
          <input type="number" className="input" style={{ width: 80 }} value={overdueDays} onChange={e => setOverdueDays(parseInt(e.target.value) || 30)} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>days</span>
        </div>
      )}

      {/* Ledger student picker */}
      {tab === 'ledger' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ flex: 1, maxWidth: 400 }}
            value={ledgerStudentId}
            onChange={e => setLedgerStudentId(e.target.value)}
          >
            <option value="">Select a student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} (Class {s.class_grade} · {s.student_id})</option>
            ))}
          </select>
          {ledgerStudentId && (
            <button className="btn btn-primary btn-sm" onClick={loadLedger}>Refresh</button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && tab !== 'ledger' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      )}

      {/* Collection Summary */}
      {!loading && tab === 'collection' && (
        <div>
          {/* Stat cards by mode */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            {(data as Array<{ mode: string; total: number }>).map(d => (
              <div key={d.mode} className="stat-card">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{d.mode}</div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit', color: 'var(--green)' }}>{formatCurrency(d.total)}</div>
              </div>
            ))}
            <div className="stat-card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Total Collected</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit', color: 'var(--accent)' }}>
                {formatCurrency((data as Array<{ total: number }>).reduce((s, d) => s + d.total, 0))}
              </div>
            </div>
          </div>

          {/* Monthly bar chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 20 }}>Monthly Collection Trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barSize={16} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4e5a7a' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#4e5a7a' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                  <Bar dataKey="school"          name="School"          fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="hostel"          name="Hostel"          fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="extracurricular" name="Extracurricular" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tabular reports */}
      {!loading && (tab === 'pending' || tab === 'defaulters' || tab === 'latefee') && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th><th>Student</th><th>Class</th><th>Fee Head</th><th>Section</th>
                <th>Amount Due</th><th>Amount Paid</th>
                {tab === 'latefee' && <th>Late Fee</th>}
                <th>Balance</th><th>Due Date</th>
                {tab === 'defaulters' && <th>Contact</th>}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><BarChart3 size={40} /><p>No records found for this report</p></div></td></tr>
              ) : data.map((r, i) => {
                const student = r.students as Record<string, string> | null
                const fs      = r.fee_structures as Record<string, string> | null
                const balance = Math.max(0, Number(r.amount_due) - Number(r.amount_paid))
                return (
                  <tr key={i} className={balance > 0 ? 'row-overdue' : ''}>
                    <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{r.receipt_no as number}</span></td>
                    <td className="text-primary">{student?.full_name}</td>
                    <td>Class {student?.class_grade}</td>
                    <td>{fs?.name}</td>
                    <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{r.section_type as string}</span></td>
                    <td>{formatCurrency(Number(r.amount_due))}</td>
                    <td style={{ color: 'var(--green)' }}>{formatCurrency(Number(r.amount_paid))}</td>
                    {tab === 'latefee' && <td style={{ color: 'var(--red)', fontWeight: 600 }}>{formatCurrency(Number(r.late_fee))}</td>}
                    <td style={{ color: 'var(--red)', fontWeight: 700 }}>{formatCurrency(balance)}</td>
                    <td>{new Date(r.due_date as string).toLocaleDateString('en-IN')}</td>
                    {tab === 'defaulters' && <td style={{ fontSize: 12 }}>{student?.guardian_contact ?? '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Ledger */}
      {tab === 'ledger' && (
        <div>
          {!ledgerStudentId ? (
            <div className="empty-state card">
              <BookOpen size={40} />
              <p>Select a student to view their full ledger</p>
              <p style={{ fontSize: 12 }}>Shows all transactions across School, Hostel, and Extracurricular for the selected academic year</p>
            </div>
          ) : ledgerLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
          ) : (
            <div>
              {/* Ledger header */}
              {selectedStudent && (
                <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedStudent.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Class {selectedStudent.class_grade} · <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{selectedStudent.student_id}</span> · AY {year}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    {[
                      { label: 'Total Due',  value: ledgerTotals.due,  color: 'var(--text-primary)' },
                      { label: 'Total Paid', value: ledgerTotals.paid, color: 'var(--green)' },
                      { label: 'Balance',    value: Math.max(0, ledgerTotals.due - ledgerTotals.paid), color: ledgerTotals.due > ledgerTotals.paid ? 'var(--red)' : 'var(--green)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Outfit', color }}>{formatCurrency(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Receipt #</th><th>Date</th><th>Section</th><th>Fee Head</th>
                      <th>Amount Due</th><th>Amount Paid</th><th>Late Fee</th><th>Balance</th><th>Mode</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.length === 0 ? (
                      <tr><td colSpan={10}><div className="empty-state"><BookOpen size={40} /><p>No records for {year}</p></div></td></tr>
                    ) : ledgerData.map((t, i) => {
                      const fs = t.fee_structures as Record<string, string> | null
                      const balance = Math.max(0, Number(t.amount_due) - Number(t.amount_paid))
                      const isPaid = balance === 0
                      const isOverdue = !isPaid && new Date(t.due_date as string) < new Date()
                      return (
                        <tr key={i} className={isPaid ? 'row-paid' : isOverdue ? 'row-overdue' : 'row-pending'}>
                          <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{t.receipt_no as number}</span></td>
                          <td>{t.payment_date ? new Date(t.payment_date as string).toLocaleDateString('en-IN') : new Date(t.due_date as string).toLocaleDateString('en-IN')}</td>
                          <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{t.section_type as string}</span></td>
                          <td>{fs?.name ?? '—'}</td>
                          <td>{formatCurrency(Number(t.amount_due))}</td>
                          <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(Number(t.amount_paid))}</td>
                          <td style={{ color: Number(t.late_fee) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                            {Number(t.late_fee) > 0 ? formatCurrency(Number(t.late_fee)) : '—'}
                          </td>
                          <td style={{ color: balance > 0 ? 'var(--amber)' : 'var(--text-muted)', fontWeight: balance > 0 ? 700 : 400 }}>
                            {balance > 0 ? formatCurrency(balance) : '—'}
                          </td>
                          <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{t.payment_mode as string ?? '—'}</td>
                          <td>
                            <span className={`badge ${isPaid ? 'badge-green' : isOverdue ? 'badge-red' : 'badge-amber'}`}>
                              {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
