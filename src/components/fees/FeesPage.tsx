'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PaymentTransaction, Student, FeeStructure, computePaymentStatus, computeLateFee } from '@/lib/types'
import { Plus, Search, X, Save, AlertCircle, IndianRupee, Filter } from 'lucide-react'

const PAYMENT_MODES = ['cash', 'cheque', 'upi', 'bank']
const CLASSES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12']

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    fully_paid:    ['Paid',    'badge-green'],
    pending:       ['Pending', 'badge-amber'],
    overdue:       ['Overdue', 'badge-red'],
    partially_paid:['Partial', 'badge-orange'],
  }
  const [label, cls] = map[status] ?? ['Unknown', 'badge-accent']
  return <span className={`badge ${cls}`}>{label}</span>
}

function PaymentModal({
  students,
  feeStructures,
  existing,
  onClose,
  onSaved,
  section,
  lateFeePerWeek,
}: {
  students: Student[]
  feeStructures: FeeStructure[]
  existing: PaymentTransaction | null
  onClose: () => void
  onSaved: () => void
  section: 'school' | 'hostel'
  lateFeePerWeek: number
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    student_id: existing?.student_id ?? '',
    fee_structure_id: existing?.fee_structure_id ?? '',
    academic_year: existing?.academic_year ?? new Date().getFullYear() + '-' + (new Date().getFullYear() + 1).toString().slice(2),
    amount_due: existing?.amount_due?.toString() ?? '',
    amount_paid: existing?.amount_paid?.toString() ?? '',
    due_date: existing?.due_date ?? '',
    payment_date: existing?.payment_date ?? new Date().toISOString().split('T')[0],
    payment_mode: existing?.payment_mode ?? 'cash',
    cheque_no: existing?.cheque_no ?? '',
    utr_ref: existing?.utr_ref ?? '',
    notes: existing?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  // Auto-fill amount_due from selected fee structure
  useEffect(() => {
    const fs = feeStructures.find(f => f.id === form.fee_structure_id)
    if (fs && !existing) set('amount_due', String(fs.amount))
  }, [form.fee_structure_id])

  async function handleSave() {
    if (!form.student_id || !form.fee_structure_id || !form.amount_due || !form.due_date) {
      setError('Student, fee head, amount due, and due date are required.')
      return
    }
    setLoading(true); setError('')

    // Compute late fee for overdue transactions
    const amountPaid = parseFloat(form.amount_paid || '0')
    const amountDue  = parseFloat(form.amount_due)
    const dueDate    = new Date(form.due_date)
    const now        = new Date()
    let lateFee = 0
    if (amountPaid < amountDue && now > dueDate) {
      const weeksOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      lateFee = weeksOverdue * lateFeePerWeek
    }

    const payload = {
      student_id: form.student_id,
      fee_structure_id: form.fee_structure_id,
      academic_year: form.academic_year,
      amount_due: amountDue,
      amount_paid: amountPaid,
      late_fee: lateFee,
      due_date: form.due_date,
      payment_date: amountPaid ? form.payment_date : null,
      payment_mode: amountPaid ? form.payment_mode : null,
      cheque_no: form.cheque_no || null,
      utr_ref: form.utr_ref || null,
      notes: form.notes || null,
      section_type: section,
    }
    if (existing) {
      const { error: e } = await supabase.from('payment_transactions').update(payload).eq('id', existing.id)
      if (e) { setError(e.message); setLoading(false); return }
    } else {
      const { error: e } = await supabase.from('payment_transactions').insert(payload)
      if (e) { setError(e.message); setLoading(false); return }
    }
    setLoading(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h2 className="modal-title">{existing ? 'Edit Payment' : 'Record Payment'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Student *</label>
            <select className="select" value={form.student_id} onChange={e => set('student_id', e.target.value)}>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Class {s.class_grade} · {s.student_id})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Fee Head *</label>
            <select className="select" value={form.fee_structure_id} onChange={e => set('fee_structure_id', e.target.value)}>
              <option value="">Select fee head</option>
              {feeStructures.map(f => <option key={f.id} value={f.id}>{f.name} — {formatCurrency(f.amount)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Academic Year</label>
            <input className="input" value={form.academic_year} onChange={e => set('academic_year', e.target.value)} placeholder="2025-26" />
          </div>
          <div className="form-group">
            <label className="input-label">Due Date *</label>
            <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Amount Due (₹) *</label>
            <input className="input" type="number" value={form.amount_due} onChange={e => set('amount_due', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="input-label">Amount Paid (₹)</label>
            <input className="input" type="number" value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="input-label">Payment Date</label>
            <input className="input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Payment Mode</label>
            <select className="select" value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          {form.payment_mode === 'cheque' && (
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="input-label">Cheque Number</label>
              <input className="input" value={form.cheque_no} onChange={e => set('cheque_no', e.target.value)} placeholder="Cheque no." />
            </div>
          )}
          {(form.payment_mode === 'upi' || form.payment_mode === 'bank') && (
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="input-label">UTR / Reference Number</label>
              <input className="input" value={form.utr_ref} onChange={e => set('utr_ref', e.target.value)} placeholder="Transaction reference" />
            </div>
          )}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Notes</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional remarks" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : <><Save size={14} /> Save Payment</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeesPage({ section }: { section: 'school' | 'hostel' }) {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<PaymentTransaction | null>(null)
  const [lateFeePerWeek, setLateFeePerWeek] = useState(50)

  // Load late fee rate from app_settings
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'late_fee_per_week')
      .single()
      .then(({ data }) => {
        if (data?.value !== undefined && data.value !== null) {
          setLateFeePerWeek(Number(data.value))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, stdRes, fsRes] = await Promise.all([
      supabase.from('payment_transactions')
        .select('*, students(*), fee_structures(*)')
        .eq('section_type', section)
        .order('created_at', { ascending: false }),
      supabase.from('students').select('*')
        .eq(section === 'school' ? 'is_school_enrolled' : 'is_hostel_enrolled', true)
        .order('full_name'),
      supabase.from('fee_structures').select('*').eq('section_type', section).eq('is_active', true),
    ])
    setStudents(stdRes.data ?? [])
    setFeeStructures(fsRes.data ?? [])
    let txns = (txRes.data ?? []) as PaymentTransaction[]
    if (search) txns = txns.filter(t => (t.student as unknown as Student)?.full_name?.toLowerCase().includes(search.toLowerCase()))
    if (filterClass) txns = txns.filter(t => (t.student as unknown as Student)?.class_grade === filterClass)
    if (filterStatus) txns = txns.filter(t => computePaymentStatus(t) === filterStatus)
    setTransactions(txns)
    setLoading(false)
  }, [section, search, filterClass, filterStatus, supabase])

  useEffect(() => { load() }, [load])

  const title = section === 'school' ? 'School Fees' : 'Hostel Fees'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{transactions.length} record{transactions.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true) }}>
          <Plus size={15} /> Record Payment
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Search student name…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
        </div>
        <select className="select" style={{ width: 130 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select className="select" style={{ width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="fully_paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Student</th>
              <th>Fee Head</th>
              <th>Due</th>
              <th>Paid</th>
              <th>Late Fee</th>
              <th>Balance</th>
              <th>Due Date</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
              </td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={11}>
                <div className="empty-state">
                  <IndianRupee size={40} />
                  <p>No payment records found</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={13} /> Record first payment</button>
                </div>
              </td></tr>
            ) : transactions.map(tx => {
              const status = computePaymentStatus(tx)
              const lateFee = computeLateFee(tx, lateFeePerWeek)
              const balance = Math.max(0, tx.amount_due - tx.amount_paid)
              const student = tx.student as unknown as Student
              const fs = tx.fee_structure as unknown as FeeStructure
              const rowClass = { fully_paid: 'row-paid', pending: 'row-pending', overdue: 'row-overdue', partially_paid: 'row-partial' }[status] ?? ''
              return (
                <tr key={tx.id} className={rowClass}>
                  <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{tx.receipt_no}</span></td>
                  <td>
                    <div className="text-primary">{student?.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Class {student?.class_grade}</div>
                  </td>
                  <td>{fs?.name}</td>
                  <td className="text-primary">{formatCurrency(tx.amount_due)}</td>
                  <td style={{ color: 'var(--green)' }}>{formatCurrency(tx.amount_paid)}</td>
                  <td style={{ color: lateFee > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{lateFee > 0 ? formatCurrency(lateFee) : '—'}</td>
                  <td style={{ color: balance > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{balance > 0 ? formatCurrency(balance) : '—'}</td>
                  <td>{new Date(tx.due_date).toLocaleDateString('en-IN')}</td>
                  <td><span style={{ textTransform: 'capitalize', fontSize: 12, color: 'var(--text-secondary)' }}>{tx.payment_mode ?? '—'}</span></td>
                  <td><StatusBadge status={status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}
                      onClick={() => { setEditing(tx); setModal(true) }}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <PaymentModal
          section={section}
          students={students}
          feeStructures={feeStructures}
          existing={editing}
          lateFeePerWeek={lateFeePerWeek}
          onClose={() => { setModal(false); setEditing(null) }}
          onSaved={() => { setModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}
