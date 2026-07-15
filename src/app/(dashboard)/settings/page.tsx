'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Save, AlertCircle, Plus, Trash2, Users, School, X, Edit2, CheckCircle2, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useRole } from '@/lib/hooks/useRole'

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

const SECTIONS   = ['school', 'hostel', 'extracurricular'] as const
const FREQS      = ['monthly', 'quarterly', 'annual', 'one-time'] as const
const CLASSES    = ['', 'Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12']
const ROLES      = ['super_admin','accountant','hostel_warden','inventory_staff','developer'] as const
const ROLE_LABELS: Record<string, string> = {
  super_admin:     'Super Admin',
  accountant:      'Accountant',
  hostel_warden:   'Hostel Warden',
  inventory_staff: 'Inventory Staff',
  developer:       'Developer',
}

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'accountant' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.full_name || !form.email || !form.password) {
      setError('All fields are required'); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return
    }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create user'); setLoading(false); return }
    setLoading(false)
    onCreated()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Create Staff Account</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="input-label">Full Name *</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Priya Sharma" />
          </div>
          <div className="form-group">
            <label className="input-label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="staff@school.com" />
          </div>
          <div className="form-group">
            <label className="input-label">Password * (min 8 chars)</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Minimum 8 characters"
                style={{ paddingRight: 40 }}
              />
              <button
                onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="input-label">Role *</label>
            <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {form.role === 'developer' && '⚠ Developer accounts cannot access any student or financial data.'}
              {form.role === 'hostel_warden' && 'Can access: hostel fees, combined view, receipts, reports.'}
              {form.role === 'inventory_staff' && 'Can access: inventory only.'}
              {form.role === 'accountant' && 'Can access: students, all fees, inventory, receipts, reports.'}
              {form.role === 'super_admin' && 'Full access to everything including settings.'}
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading
              ? <><div className="spinner" style={{ width: 14, height: 14 }} />Creating…</>
              : <><UserPlus size={14} />Create Account</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fee Structure Modal ──────────────────────────────────────────────────────
function FeeStructureModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Record<string, unknown> | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name:         (existing?.name        as string) ?? '',
    section_type: (existing?.section_type as string) ?? 'school',
    amount:       (existing?.amount      as number)?.toString() ?? '',
    frequency:    (existing?.frequency   as string) ?? 'monthly',
    class_grade:  (existing?.class_grade as string) ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.name || !form.amount) { setError('Name and amount are required'); return }
    setLoading(true); setError('')
    const payload = {
      name:         form.name,
      section_type: form.section_type,
      amount:       parseFloat(form.amount),
      frequency:    form.frequency,
      class_grade:  form.class_grade || null,
    }
    if (existing?.id) {
      const { error: e } = await supabase.from('fee_structures').update(payload).eq('id', existing.id as string)
      if (e) { setError(e.message); setLoading(false); return }
    } else {
      const { error: e } = await supabase.from('fee_structures').insert(payload)
      if (e) { setError(e.message); setLoading(false); return }
    }
    setLoading(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{existing ? 'Edit Fee Head' : 'Add Fee Head'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Fee Head Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tuition Fee, Hostel Rent" />
          </div>
          <div className="form-group">
            <label className="input-label">Section *</label>
            <select className="select" value={form.section_type} onChange={e => set('section_type', e.target.value)}>
              {SECTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Frequency *</label>
            <select className="select" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
              {FREQS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Amount (₹) *</label>
            <input className="input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="input-label">Class (optional — leave blank for all)</label>
            <select className="select" value={form.class_grade} onChange={e => set('class_grade', e.target.value)}>
              <option value="">All classes</option>
              {CLASSES.filter(Boolean).map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Save size={14} />{existing ? 'Save Changes' : 'Add Fee Head'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const supabase = createClient()
  const { role } = useRole()
  const [tab, setTab] = useState<'general' | 'fees' | 'users'>('general')
  const [createUserModal, setCreateUserModal] = useState(false)
  const [settings, setSettings] = useState({
    school_name: 'My School',
    current_academic_year: '2025-26',
    late_fee_per_week: 50,
    allow_hostel_only_students: false,
    receipt_prefix: 'RCP',
  })
  const [feeStructures, setFeeStructures] = useState<Record<string, unknown>[]>([])
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [feeModal, setFeeModal] = useState<Record<string, unknown> | null | 'new'>(null)

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*')
    const m: Record<string, unknown> = {}
    for (const row of data ?? []) {
      const r = row as { key: string; value: unknown }
      m[r.key] = r.value
    }
    if (Object.keys(m).length > 0) {
      setSettings(s => ({
        school_name:               (m.school_name               as string)  ?? s.school_name,
        current_academic_year:     (m.current_academic_year     as string)  ?? s.current_academic_year,
        late_fee_per_week:         (m.late_fee_per_week         as number)  ?? s.late_fee_per_week,
        allow_hostel_only_students:(m.allow_hostel_only_students as boolean) ?? s.allow_hostel_only_students,
        receipt_prefix:            (m.receipt_prefix            as string)  ?? s.receipt_prefix,
      }))
    }
  }, [supabase])

  const loadFees = useCallback(async () => {
    const { data } = await supabase.from('fee_structures').select('*').eq('is_active', true).order('section_type').order('name')
    setFeeStructures(data ?? [])
  }, [supabase])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('full_name')
    setUsers(data ?? [])
  }, [supabase])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => {
    if (tab === 'fees')  loadFees()
    if (tab === 'users') loadUsers()
  }, [tab, loadFees, loadUsers])

  async function saveSettings() {
    setSaving(true); setError(''); setSuccess('')
    const entries = [
      { key: 'school_name',               value: settings.school_name },
      { key: 'current_academic_year',     value: settings.current_academic_year },
      { key: 'late_fee_per_week',         value: settings.late_fee_per_week },
      { key: 'allow_hostel_only_students',value: settings.allow_hostel_only_students },
      { key: 'receipt_prefix',            value: settings.receipt_prefix },
    ]
    for (const entry of entries) {
      await supabase.from('app_settings').upsert({ key: entry.key, value: entry.value })
    }
    setSaving(false); setSuccess('Settings saved successfully.')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function deleteFee(id: string) {
    await supabase.from('fee_structures').update({ is_active: false }).eq('id', id)
    loadFees()
  }

  async function updateUserRole(userId: string, newRole: string) {
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
    loadUsers()
  }

  const isSuperAdmin = role === 'super_admin'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and administration</p>
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'general', label: 'General',         icon: Settings },
          { key: 'fees',    label: 'Fee Structures',  icon: School },
          { key: 'users',   label: 'Users & Roles',   icon: Users },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key as typeof tab)}>
            <t.icon size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t.label}
          </button>
        ))}
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}><AlertCircle size={14} />{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}><CheckCircle2 size={14} />{success}</div>}

      {/* General Settings */}
      {tab === 'general' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginBottom: 20 }}>General Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="input-label">School Name</label>
              <input className="input" value={settings.school_name} onChange={e => setSettings(s => ({ ...s, school_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="input-label">Current Academic Year</label>
                <input className="input" value={settings.current_academic_year} onChange={e => setSettings(s => ({ ...s, current_academic_year: e.target.value }))} placeholder="2025-26" />
              </div>
              <div className="form-group">
                <label className="input-label">Receipt Prefix</label>
                <input className="input" value={settings.receipt_prefix} onChange={e => setSettings(s => ({ ...s, receipt_prefix: e.target.value }))} placeholder="RCP" />
              </div>
            </div>
            <div className="form-group">
              <label className="input-label">Late Fee Per Week (₹)</label>
              <input className="input" type="number" value={settings.late_fee_per_week} onChange={e => setSettings(s => ({ ...s, late_fee_per_week: parseFloat(e.target.value) || 0 }))} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Applied automatically for each week past the due date. Shown as a separate line item on receipts.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={settings.allow_hostel_only_students}
                onChange={e => setSettings(s => ({ ...s, allow_hostel_only_students: e.target.checked }))}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
              />
              Allow hostel-only students (students residing in hostel but not enrolled in this school)
            </label>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Save size={14} />Save Settings</>}
            </button>
          </div>
        </div>
      )}

      {/* Fee Structures */}
      {tab === 'fees' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setFeeModal('new')}>
              <Plus size={13} /> Add Fee Head
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Fee Head</th><th>Section</th><th>Class</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {feeStructures.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><School size={40} /><p>No fee structures yet</p><button className="btn btn-primary btn-sm" onClick={() => setFeeModal('new')}><Plus size={13} /> Add first fee head</button></div></td></tr>
                ) : feeStructures.map((f: Record<string, unknown>) => (
                  <tr key={f.id as string}>
                    <td className="text-primary">{f.name as string}</td>
                    <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{f.section_type as string}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{f.class_grade ? `Class ${f.class_grade}` : 'All'}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(Number(f.amount))}</td>
                    <td style={{ textTransform: 'capitalize', fontSize: 12, color: 'var(--text-secondary)' }}>{f.frequency as string}</td>
                    <td>{f.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setFeeModal(f)} style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteFee(f.id as string)} style={{ padding: '4px 8px' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          {isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setCreateUserModal(true)}>
                <UserPlus size={13} /> Create Staff Account
              </button>
            </div>
          )}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Status</th>{isSuperAdmin && <th>Change Role</th>}</tr>
              </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><Users size={40} /><p>No users yet</p>{isSuperAdmin && <button className="btn btn-primary btn-sm" onClick={() => setCreateUserModal(true)}><UserPlus size={13} /> Create first account</button>}</div></td></tr>
              ) : users.map((u: Record<string, unknown>) => (
                <tr key={u.id as string}>
                  <td className="text-primary">{u.full_name as string}</td>
                  <td>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {(u.role as string)?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{u.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                  {isSuperAdmin && (
                    <td>
                      <select
                        className="select"
                        style={{ width: 180, fontSize: 12, padding: '5px 10px' }}
                        value={u.role as string}
                        onChange={e => updateUserRole(u.id as string, e.target.value)}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Create User Modal */}
      {createUserModal && (
        <CreateUserModal
          onClose={() => setCreateUserModal(false)}
          onCreated={() => { setCreateUserModal(false); loadUsers() }}
        />
      )}

      {/* Fee Structure Modal */}
      {feeModal && (
        <FeeStructureModal
          existing={feeModal === 'new' ? null : feeModal}
          onClose={() => setFeeModal(null)}
          onSaved={() => { setFeeModal(null); loadFees() }}
        />
      )}
    </div>
  )
}
