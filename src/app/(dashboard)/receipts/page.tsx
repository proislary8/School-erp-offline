'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Receipt, Search, X, Printer } from 'lucide-react'

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

interface ReceiptData {
  receipt_no: number
  student_name: string
  student_id: string
  class_grade: string
  section_type: string
  fee_head: string
  amount_due: number
  amount_paid: number
  late_fee: number
  payment_date: string | null
  payment_mode: string | null
  cheque_no: string | null
  utr_ref: string | null
  staff_name: string
  school_name: string
  receipt_prefix: string
}

function PrintReceipt({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const balance = Math.max(0, data.amount_due - data.amount_paid)
  const generated = new Date().toLocaleString('en-IN')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Screen-only controls */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10 }} className="no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={15} /> Print / Save PDF
        </button>
        <button className="btn btn-secondary" onClick={onClose}><X size={15} /> Close</button>
      </div>

      {/* Receipt card */}
      <div id="print-receipt" style={{
        background: '#fff', color: '#1a1a1a',
        width: 360, padding: '24px 28px',
        fontFamily: 'Arial, sans-serif', fontSize: 13,
        borderRadius: 8,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{data.school_name}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
            Fee Payment Receipt
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 12, color: '#555', marginBottom: 12 }}>
          Receipt No: <strong>{data.receipt_prefix}-{data.receipt_no}</strong>
        </div>

        {/* Student */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
          Student Details
        </div>
        {[
          ['Student Name', data.student_name],
          ['Student ID', data.student_id],
          ['Class', `Class ${data.class_grade}`],
          ['Section', data.section_type],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ddd', fontSize: 12 }}>
            <span style={{ color: '#555' }}>{l}</span>
            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{v}</span>
          </div>
        ))}

        {/* Payment */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 }}>
          Payment Details
        </div>
        {[
          ['Fee Head', data.fee_head],
          ['Payment Date', data.payment_date ? new Date(data.payment_date).toLocaleDateString('en-IN') : '—'],
          ['Payment Mode', data.payment_mode ?? '—'],
          ...(data.cheque_no ? [['Cheque No.', data.cheque_no]] : []),
          ...(data.utr_ref ? [['UTR / Ref', data.utr_ref]] : []),
          ['Amount Due', formatCurrency(data.amount_due)],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ddd', fontSize: 12 }}>
            <span style={{ color: '#555' }}>{l}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}

        {/* Late fee */}
        {data.late_fee > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ddd', fontSize: 12 }}>
            <span style={{ color: '#c53030' }}>Late Fee (penalty)</span>
            <span style={{ fontWeight: 600, color: '#c53030' }}>{formatCurrency(data.late_fee)}</span>
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #1a1a1a', marginTop: 8, fontSize: 14 }}>
          <span style={{ fontWeight: 700 }}>Amount Paid</span>
          <span style={{ fontWeight: 700, color: '#276749' }}>{formatCurrency(data.amount_paid)}</span>
        </div>

        {/* Balance */}
        {balance > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
            <span style={{ color: '#c53030', fontWeight: 600 }}>Balance Due</span>
            <span style={{ color: '#c53030', fontWeight: 600 }}>{formatCurrency(balance)}</span>
          </div>
        )}

        {/* Stamp */}
        <div style={{ marginTop: 28, textAlign: 'right' }}>
          <div style={{ display: 'inline-block', borderTop: '1px solid #555', paddingTop: 4, width: 130, textAlign: 'center', fontSize: 10, color: '#555' }}>
            <div style={{ fontWeight: 600, fontSize: 11 }}>{data.staff_name}</div>
            <div>Authorised Signatory</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, borderTop: '1px solid #ddd', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
          <span>Generated: {generated}</span>
          <span>Computer-generated receipt</span>
        </div>
      </div>
    </div>
  )
}

export default function ReceiptsPage() {
  const supabase = createClient()
  const [receipts, setReceipts]   = useState<Record<string, unknown>[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [section, setSection]     = useState('')
  const [schoolName, setSchoolName]       = useState('My School')
  const [receiptPrefix, setReceiptPrefix] = useState('RCP')
  const [printData, setPrintData] = useState<ReceiptData | null>(null)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['school_name', 'receipt_prefix'])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === 'school_name')    setSchoolName(String(row.value).replace(/^"|"$/g, ''))
          if (row.key === 'receipt_prefix') setReceiptPrefix(String(row.value).replace(/^"|"$/g, ''))
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('payment_transactions')
      .select('*, students(full_name, class_grade, student_id), fee_structures(name)')
      .not('amount_paid', 'is', null)
      .gt('amount_paid', 0)
      .order('receipt_no', { ascending: false })

    if (section)  q = q.eq('section_type', section)
    if (dateFrom) q = q.gte('payment_date', dateFrom)
    if (dateTo)   q = q.lte('payment_date', dateTo)

    const { data } = await q
    let list = data ?? []
    if (search) list = list.filter((r: Record<string, unknown>) => {
      const s = r.students as Record<string, string> | null
      return s?.full_name?.toLowerCase().includes(search.toLowerCase()) || String(r.receipt_no).includes(search)
    })
    setReceipts(list)
    setLoading(false)
  }, [search, section, dateFrom, dateTo, supabase])

  useEffect(() => { load() }, [load])

  function buildReceiptData(r: Record<string, unknown>): ReceiptData {
    const student = r.students        as Record<string, string> | null
    const fs      = r.fee_structures  as Record<string, string> | null
    const staff   = r.user_profiles   as Record<string, string> | null
    return {
      receipt_no:     r.receipt_no    as number,
      student_name:   student?.full_name   ?? '—',
      student_id:     student?.student_id  ?? '—',
      class_grade:    student?.class_grade ?? '—',
      section_type:   (r.section_type as string) ?? '—',
      fee_head:       fs?.name ?? '—',
      amount_due:     Number(r.amount_due),
      amount_paid:    Number(r.amount_paid),
      late_fee:       Number(r.late_fee ?? 0),
      payment_date:   r.payment_date  as string | null,
      payment_mode:   r.payment_mode  as string | null,
      cheque_no:      r.cheque_no     as string | null,
      utr_ref:        r.utr_ref       as string | null,
      staff_name:     staff?.full_name ?? 'Staff',
      school_name:    schoolName,
      receipt_prefix: receiptPrefix,
    }
  }

  return (
    <>
      {/* Print styles — only #print-receipt shows when printing */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #print-receipt, #print-receipt * { visibility: visible !important; }
          #print-receipt {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {printData && <PrintReceipt data={printData} onClose={() => setPrintData(null)} />}

      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Receipts</h1>
            <p className="page-subtitle">{receipts.length} receipt{receipts.length !== 1 ? 's' : ''} found</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={15} color="var(--text-muted)" />
            <input placeholder="Search student or receipt #…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>
          <select className="select" style={{ width: 140 }} value={section} onChange={e => setSection(e.target.value)}>
            <option value="">All Sections</option>
            <option value="school">School</option>
            <option value="hostel">Hostel</option>
            <option value="extracurricular">Extracurricular</option>
          </select>
          <input type="date" className="input" style={{ width: 150 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input" style={{ width: 150 }} value={dateTo}   onChange={e => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo('') }}><X size={13} /> Clear dates</button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Student</th>
                <th>Section</th>
                <th>Fee Head</th>
                <th>Amount Paid</th>
                <th>Late Fee</th>
                <th>Balance</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Received By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11}><div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div></td></tr>
              ) : receipts.length === 0 ? (
                <tr><td colSpan={11}><div className="empty-state"><Receipt size={40} /><p>No receipts found</p><p style={{ fontSize: 12 }}>Record a payment in School Fees or Hostel Fees first</p></div></td></tr>
              ) : receipts.map(r => {
                const student = r.students       as Record<string, string> | null
                const fs      = r.fee_structures as Record<string, string> | null
                const staff   = r.user_profiles  as Record<string, string> | null
                const balance = Math.max(0, Number(r.amount_due) - Number(r.amount_paid))
                return (
                  <tr key={r.id as string}>
                    <td><span style={{ fontWeight: 600 }}>#{r.receipt_no as number}</span></td>
                    <td>
                      <div className="text-primary">{student?.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Class {student?.class_grade}</div>
                    </td>
                    <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{r.section_type as string}</span></td>
                    <td>{fs?.name}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{formatCurrency(Number(r.amount_paid))}</td>
                    <td style={{ color: Number(r.late_fee) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {Number(r.late_fee) > 0 ? formatCurrency(Number(r.late_fee)) : '—'}
                    </td>
                    <td style={{ color: balance > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                      {balance > 0 ? formatCurrency(balance) : '—'}
                    </td>
                    <td>{r.payment_date ? new Date(r.payment_date as string).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{r.payment_mode as string ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{staff?.full_name ?? 'Staff'}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPrintData(buildReceiptData(r))}
                        title="Print Receipt"
                      >
                        <Printer size={13} /> Print
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
