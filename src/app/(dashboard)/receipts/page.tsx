'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Receipt, Search, X, Printer, Download } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ReceiptData } from '@/components/receipts/ReceiptPDF'

// @react-pdf/renderer must be loaded client-side only
const PDFDownloadButton = dynamic(
  () => import('@/components/receipts/PDFDownloadButton'),
  { ssr: false, loading: () => <button className="btn btn-secondary btn-sm" disabled>PDF…</button> }
)

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function ReceiptsPage() {
  const supabase = createClient()
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [section, setSection]   = useState('')
  const [schoolName, setSchoolName]     = useState('My School')
  const [receiptPrefix, setReceiptPrefix] = useState('RCP')

  // Load school name + prefix from settings once
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
      .select('*, students(full_name, class_grade, student_id), fee_structures(name), user_profiles:created_by(full_name)')
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
    const student  = r.students  as Record<string, string> | null
    const fs       = r.fee_structures as Record<string, string> | null
    const staff    = r.user_profiles  as Record<string, string> | null
    return {
      receipt_no:     r.receipt_no as number,
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

  function handlePrint(r: Record<string, unknown>) {
    const d = buildReceiptData(r)
    const balance = Math.max(0, d.amount_due - d.amount_paid)
    const win = window.open('', '_blank', 'width=400,height=650')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html>
      <head><title>Receipt #${d.receipt_no}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 380px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .school-name { font-size: 18px; font-weight: bold; }
        .receipt-title { font-size: 13px; color: #666; margin-top: 4px; }
        .receipt-no { font-size: 12px; color: #666; text-align: right; margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #eee; }
        .row:last-child { border: none; }
        .label { color: #555; } .value { font-weight: 500; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: bold; border-top: 2px solid #333; margin-top: 8px; }
        .late-fee { color: #e53e3e; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div class="school-name">${d.school_name}</div>
        <div class="receipt-title">Fee Payment Receipt</div>
      </div>
      <div class="receipt-no">Receipt No: <strong>${d.receipt_prefix}-${d.receipt_no}</strong></div>
      <div class="row"><span class="label">Student Name</span><span class="value">${d.student_name}</span></div>
      <div class="row"><span class="label">Student ID</span><span class="value">${d.student_id}</span></div>
      <div class="row"><span class="label">Class</span><span class="value">Class ${d.class_grade}</span></div>
      <div class="row"><span class="label">Section</span><span class="value" style="text-transform:capitalize">${d.section_type}</span></div>
      <div class="row"><span class="label">Fee Head</span><span class="value">${d.fee_head}</span></div>
      <div class="row"><span class="label">Payment Date</span><span class="value">${d.payment_date ? new Date(d.payment_date).toLocaleDateString('en-IN') : '—'}</span></div>
      <div class="row"><span class="label">Payment Mode</span><span class="value" style="text-transform:capitalize">${d.payment_mode ?? '—'}</span></div>
      ${d.cheque_no ? `<div class="row"><span class="label">Cheque No.</span><span class="value">${d.cheque_no}</span></div>` : ''}
      ${d.utr_ref   ? `<div class="row"><span class="label">UTR / Ref</span><span class="value">${d.utr_ref}</span></div>` : ''}
      <div class="row"><span class="label">Amount Due</span><span class="value">₹${d.amount_due.toLocaleString('en-IN')}</span></div>
      ${d.late_fee > 0 ? `<div class="row"><span class="label late-fee">Late Fee</span><span class="value late-fee">₹${d.late_fee.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="total-row"><span>Amount Paid</span><span>₹${d.amount_paid.toLocaleString('en-IN')}</span></div>
      ${balance > 0 ? `<div class="row"><span class="label" style="color:#e53e3e">Balance Due</span><span class="value" style="color:#e53e3e">₹${balance.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="footer">Received by: <strong>${d.staff_name}</strong><br/>Generated: ${new Date().toLocaleString('en-IN')}</div>
      <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
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
              <tr><td colSpan={11}><div className="empty-state"><Receipt size={40} /><p>No receipts found</p></div></td></tr>
            ) : receipts.map(r => {
              const student = r.students  as Record<string, string> | null
              const fs      = r.fee_structures as Record<string, string> | null
              const staff   = r.user_profiles  as Record<string, string> | null
              const balance = Math.max(0, Number(r.amount_due) - Number(r.amount_paid))
              return (
                <tr key={r.id as string}>
                  <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{r.receipt_no as number}</span></td>
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
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(r)} title="Print">
                        <Printer size={13} />
                      </button>
                      <PDFDownloadButton data={buildReceiptData(r)} />
                    </div>
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
