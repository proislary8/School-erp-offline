'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExtracurricularActivity, Student } from '@/lib/types'
import { Plus, Search, X, Activity, Save, AlertCircle, Trash2, IndianRupee, CheckCircle2 } from 'lucide-react'

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ─── Collect Fee Modal ───────────────────────────────────────────────────────
function CollectFeeModal({
  activity,
  students,
  onClose,
  onSaved,
}: {
  activity: ExtracurricularActivity
  students: Student[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    student_id: '',
    amount_due: String(activity.fee_amount),
    amount_paid: '',
    due_date: new Date().toISOString().split('T')[0],
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    academic_year: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.student_id || !form.amount_due || !form.due_date) {
      setError('Student and due date are required.')
      return
    }
    setLoading(true); setError('')

    // Compute late fee
    const amountPaid = parseFloat(form.amount_paid || '0')
    const amountDue = parseFloat(form.amount_due)
    const dueDate = new Date(form.due_date)
    const now = new Date()
    let lateFee = 0
    if (amountPaid < amountDue && now > dueDate) {
      const weeksOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      lateFee = weeksOverdue * 50
    }

    const { error: e } = await supabase.from('payment_transactions').insert({
      student_id: form.student_id,
      section_type: 'extracurricular',
      fee_structure_id: activity.fee_structure_id ?? null,
      academic_year: form.academic_year,
      amount_due: amountDue,
      amount_paid: amountPaid,
      late_fee: lateFee,
      due_date: form.due_date,
      payment_date: amountPaid ? form.payment_date : null,
      payment_mode: amountPaid ? form.payment_mode : null,
      notes: `${activity.name}${form.notes ? ' — ' + form.notes : ''}`,
    })
    if (e) { setError(e.message); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Collect Fee — {activity.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Activity Fee:</span>
          <span style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(activity.fee_amount)} / {activity.frequency}</span>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Student *</label>
            <select className="select" value={form.student_id} onChange={e => set('student_id', e.target.value)}>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Class {s.class_grade})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Amount Due (₹)</label>
            <input className="input" type="number" value={form.amount_due} onChange={e => set('amount_due', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Amount Paid (₹)</label>
            <input className="input" type="number" value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="input-label">Due Date *</label>
            <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Payment Date</label>
            <input className="input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Payment Mode</label>
            <select className="select" value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
              {['cash','cheque','upi','bank'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Academic Year</label>
            <input className="input" value={form.academic_year} onChange={e => set('academic_year', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Notes (optional)</label>
            <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any remarks" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Save size={14} />Record Payment</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExtracurricularPage() {
  const supabase = createClient()
  const [activities, setActivities] = useState<ExtracurricularActivity[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [enrollments, setEnrollments] = useState<Record<string, Student[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ name: '', category: 'sports', fee_amount: '', frequency: 'monthly' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [collectFeeModal, setCollectFeeModal] = useState<ExtracurricularActivity | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [actRes, stdRes, enrollRes] = await Promise.all([
      supabase.from('extracurricular_activities').select('*').eq('is_active', true).order('name'),
      supabase.from('students').select('*').order('full_name'),
      supabase.from('student_activities').select('*, students(*), extracurricular_activities(*)'),
    ])
    setActivities(actRes.data ?? [])
    setStudents(stdRes.data ?? [])
    const em: Record<string, Student[]> = {}
    for (const e of enrollRes.data ?? []) {
      const aid = e.activity_id
      if (!em[aid]) em[aid] = []
      em[aid].push(e.students as unknown as Student)
    }
    setEnrollments(em)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAddActivity() {
    if (!newActivity.name || !newActivity.fee_amount) { setError('Name and fee amount are required'); return }
    setSaving(true); setError('')
    const { error: e } = await supabase.from('extracurricular_activities').insert({
      name: newActivity.name,
      category: newActivity.category,
      fee_amount: parseFloat(newActivity.fee_amount),
      frequency: newActivity.frequency,
    })
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false)
    setShowAddActivity(false)
    setNewActivity({ name: '', category: 'sports', fee_amount: '', frequency: 'monthly' })
    load()
  }

  async function handleEnroll(activityId: string, studentId: string) {
    await supabase.from('student_activities').insert({
      activity_id: activityId,
      student_id: studentId,
      enrolled_date: new Date().toISOString().split('T')[0],
    })
    load()
  }

  async function handleUnenroll(activityId: string, studentId: string) {
    await supabase.from('student_activities')
      .delete()
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Extracurricular</h1>
          <p className="page-subtitle">Activities, clubs, and event-based fee collection</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddActivity(true)}>
          <Plus size={15} /> Add Activity
        </button>
      </div>

      {/* Add Activity Modal */}
      {showAddActivity && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddActivity(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Activity / Event</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddActivity(false)} style={{ padding: 6 }}><X size={18} /></button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="input-label">Activity Name *</label>
                <input className="input" value={newActivity.name} onChange={e => setNewActivity(a => ({ ...a, name: e.target.value }))} placeholder="e.g. Football, Music Class, Science Trip" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="input-label">Category</label>
                  <select className="select" value={newActivity.category} onChange={e => setNewActivity(a => ({ ...a, category: e.target.value }))}>
                    {['sports','arts','trips','clubs','competitions','other'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">Frequency</label>
                  <select className="select" value={newActivity.frequency} onChange={e => setNewActivity(a => ({ ...a, frequency: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="one-time">One-time</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="input-label">Fee Amount (₹) *</label>
                <input className="input" type="number" value={newActivity.fee_amount} onChange={e => setNewActivity(a => ({ ...a, fee_amount: e.target.value }))} placeholder="500" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddActivity(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddActivity} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Save size={14} />Add Activity</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Fee Modal */}
      {collectFeeModal && (
        <CollectFeeModal
          activity={collectFeeModal}
          students={enrollments[collectFeeModal.id] ?? []}
          onClose={() => setCollectFeeModal(null)}
          onSaved={() => { setCollectFeeModal(null); load() }}
        />
      )}

      {/* Activities Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : activities.length === 0 ? (
        <div className="empty-state card">
          <Activity size={40} />
          <p>No activities yet</p>
          <p style={{ fontSize: 12 }}>Add your first activity to start tracking fees</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddActivity(true)}><Plus size={13} /> Add Activity</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {activities.map(act => {
            const enrolled = enrollments[act.id] ?? []
            const notEnrolled = students.filter(s => !enrolled.find(e => e.id === s.id))
            return (
              <div key={act.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: 15, marginBottom: 4 }}>{act.name}</h3>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{act.category}</span>
                        <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{act.frequency}</span>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 20, color: 'var(--green)' }}>
                      {formatCurrency(act.fee_amount)}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '12px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Enrolled Students ({enrolled.length})
                  </div>
                  {enrolled.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>No students enrolled yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {enrolled.map(s => (
                        <span key={s.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                          padding: '3px 6px 3px 10px', borderRadius: 999, color: 'var(--text-secondary)',
                        }}>
                          {s.full_name}
                          <button
                            onClick={() => handleUnenroll(act.id, s.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                            title="Unenroll"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {notEnrolled.length > 0 && (
                      <select
                        className="select"
                        style={{ fontSize: 12, padding: '6px 10px', flex: 1 }}
                        defaultValue=""
                        onChange={e => { if (e.target.value) { handleEnroll(act.id, e.target.value); e.target.value = '' } }}
                      >
                        <option value="">+ Enroll a student…</option>
                        {notEnrolled.map(s => <option key={s.id} value={s.id}>{s.full_name} (Class {s.class_grade})</option>)}
                      </select>
                    )}
                    {enrolled.length > 0 && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setCollectFeeModal(act)}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <IndianRupee size={13} /> Collect Fee
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
