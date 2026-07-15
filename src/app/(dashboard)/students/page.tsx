'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Student } from '@/lib/types'
import {
  Users, Plus, Search, Filter, Edit2, Eye, Trash2,
  School, Building2, ChevronRight, X, Save, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

const CLASSES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12']

function StudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    full_name: student?.full_name ?? '',
    class_grade: student?.class_grade ?? '',
    section: student?.section ?? '',
    roll_no: student?.roll_no ?? '',
    admission_date: student?.admission_date ?? '',
    guardian_name: student?.guardian_name ?? '',
    guardian_contact: student?.guardian_contact ?? '',
    is_school_enrolled: student?.is_school_enrolled ?? true,
    is_hostel_enrolled: student?.is_hostel_enrolled ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.full_name || !form.class_grade || !form.admission_date) {
      setError('Name, class and admission date are required.')
      return
    }
    setLoading(true); setError('')
    if (student) {
      const { error } = await supabase.from('students').update(form).eq('id', student.id)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      // auto-generate student_id: SCH-YYYY-XXX
      const year = new Date().getFullYear()
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true })
      const num = String((count ?? 0) + 1).padStart(3, '0')
      const student_id = `SCH-${year}-${num}`
      const { error } = await supabase.from('students').insert({ ...form, student_id })
      if (error) { setError(error.message); setLoading(false); return }
    }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">{student ? 'Edit Student' : 'Add New Student'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Full Name *</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Student full name" />
          </div>
          <div className="form-group">
            <label className="input-label">Class / Grade *</label>
            <select className="select" value={form.class_grade} onChange={e => set('class_grade', e.target.value)}>
              <option value="">Select class</option>
              {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Section</label>
            <input className="input" value={form.section} onChange={e => set('section', e.target.value)} placeholder="A / B / C" />
          </div>
          <div className="form-group">
            <label className="input-label">Roll No.</label>
            <input className="input" value={form.roll_no} onChange={e => set('roll_no', e.target.value)} placeholder="01" />
          </div>
          <div className="form-group">
            <label className="input-label">Admission Date *</label>
            <input className="input" type="date" value={form.admission_date} onChange={e => set('admission_date', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Guardian Name</label>
            <input className="input" value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} placeholder="Parent / Guardian name" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Guardian Contact</label>
            <input className="input" value={form.guardian_contact} onChange={e => set('guardian_contact', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="input-label">Enrollment</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {[
                { key: 'is_school_enrolled', label: 'Enrolled in School', icon: School },
                { key: 'is_hostel_enrolled', label: 'Enrolled in Hostel', icon: Building2 },
              ].map(({ key, label, icon: Icon }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={e => set(key, e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                  />
                  <Icon size={14} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : <><Save size={14} /> Save Student</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'school' | 'hostel'>('all')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Student | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('students').select('*').order('full_name')
    if (filterClass) q = q.eq('class_grade', filterClass)
    if (filterType === 'school') q = q.eq('is_school_enrolled', true)
    if (filterType === 'hostel') q = q.eq('is_hostel_enrolled', true)
    const { data } = await q
    setStudents((data ?? []).filter(s =>
      !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.student_id.includes(search)
    ))
    setLoading(false)
  }, [filterClass, filterType, search, supabase])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{students.length} student{students.length !== 1 ? 's' : ''} found</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add') }}>
          <Plus size={15} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Search name or student ID…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
        </div>
        <select className="select" style={{ width: 140 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select className="select" style={{ width: 140 }} value={filterType} onChange={e => setFilterType(e.target.value as 'all' | 'school' | 'hostel')}>
          <option value="all">All Types</option>
          <option value="school">School Only</option>
          <option value="hostel">Hostel</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Class</th>
              <th>Guardian</th>
              <th>Contact</th>
              <th>Enrollment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="spinner" style={{ width: 28, height: 28 }} />
                </div>
              </td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <Users size={40} />
                  <p>No students found</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}><Plus size={13} /> Add first student</button>
                </div>
              </td></tr>
            ) : students.map(s => (
              <tr key={s.id}>
                <td><span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{s.student_id}</span></td>
                <td className="text-primary">{s.full_name}</td>
                <td>Class {s.class_grade}{s.section ? ` – ${s.section}` : ''}</td>
                <td>{s.guardian_name || '—'}</td>
                <td>{s.guardian_contact || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {s.is_school_enrolled && <span className="badge badge-accent"><School size={10} /> School</span>}
                    {s.is_hostel_enrolled && <span className="badge badge-green"><Building2 size={10} /> Hostel</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link href={`/students/${s.id}`} className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}>
                      <Eye size={13} />
                    </Link>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }}
                      onClick={() => { setSelected(s); setModal('edit') }}>
                      <Edit2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <StudentModal
          student={modal === 'edit' ? selected : null}
          onClose={() => { setModal(null); setSelected(null) }}
          onSaved={() => { setModal(null); setSelected(null); load() }}
        />
      )}
    </div>
  )
}
