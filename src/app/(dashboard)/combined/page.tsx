'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Student } from '@/lib/types'
import { Search, X, Layers, ChevronDown, ChevronUp } from 'lucide-react'

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function CombinedPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [txMap, setTxMap] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [stdRes, txRes] = await Promise.all([
      supabase.from('students').select('*').order('full_name'),
      supabase.from('payment_transactions').select('student_id, section_type, amount_due, amount_paid'),
    ])
    const stds = (stdRes.data ?? []) as Student[]

    // Build aggregated map: studentId -> { schoolDue, schoolPaid, hostelDue, hostelPaid, extraDue, extraPaid }
    const map: Record<string, Record<string, number>> = {}
    for (const tx of txRes.data ?? []) {
      if (!map[tx.student_id]) map[tx.student_id] = { schoolDue: 0, schoolPaid: 0, hostelDue: 0, hostelPaid: 0, extraDue: 0, extraPaid: 0 }
      const prefix = tx.section_type === 'school' ? 'school' : tx.section_type === 'hostel' ? 'hostel' : 'extra'
      map[tx.student_id][prefix + 'Due'] += tx.amount_due ?? 0
      map[tx.student_id][prefix + 'Paid'] += tx.amount_paid ?? 0
    }
    const filtered = search ? stds.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.student_id.includes(search)) : stds
    setStudents(filtered)
    setTxMap(map)
    setLoading(false)
  }, [search, supabase])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Combined View</h1>
          <p className="page-subtitle">Consolidated fee statement — School + Hostel + Extracurricular</p>
        </div>
      </div>

      <div className="search-bar" style={{ maxWidth: 400, marginBottom: 20 }}>
        <Search size={15} color="var(--text-muted)" />
        <input placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>School Due</th>
              <th>School Paid</th>
              <th>Hostel Due</th>
              <th>Hostel Paid</th>
              <th>Extra Due</th>
              <th>Extra Paid</th>
              <th>Total Due</th>
              <th>Total Paid</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11}><div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={11}><div className="empty-state"><Layers size={40} /><p>No students found</p></div></td></tr>
            ) : students.map(s => {
              const m = txMap[s.id] ?? {}
              const totalDue = (m.schoolDue ?? 0) + (m.hostelDue ?? 0) + (m.extraDue ?? 0)
              const totalPaid = (m.schoolPaid ?? 0) + (m.hostelPaid ?? 0) + (m.extraPaid ?? 0)
              const balance = totalDue - totalPaid
              return (
                <tr key={s.id} style={{ cursor: 'default' }}>
                  <td>
                    <div className="text-primary">{s.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.student_id}</div>
                  </td>
                  <td>Class {s.class_grade}</td>
                  <td>{formatCurrency(m.schoolDue ?? 0)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatCurrency(m.schoolPaid ?? 0)}</td>
                  <td>{formatCurrency(m.hostelDue ?? 0)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatCurrency(m.hostelPaid ?? 0)}</td>
                  <td>{formatCurrency(m.extraDue ?? 0)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatCurrency(m.extraPaid ?? 0)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(totalDue)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(totalPaid)}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {balance > 0 ? formatCurrency(balance) : '✓ Clear'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
