'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InventoryItem } from '@/lib/types'
import { Package, Plus, AlertTriangle, Search, X, Save, AlertCircle, TrendingDown, TrendingUp, Edit2, Trash2 } from 'lucide-react'

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

const CATEGORIES = ['uniforms','books','stationery','sports','hostel','other']

// ─── Sale Modal ──────────────────────────────────────────────────────────────
function SaleModal({ item, onClose, onSaved }: { item: InventoryItem, onClose: () => void, onSaved: () => void }) {
  const supabase = createClient()
  const [qty, setQty] = useState('1')
  const [studentId, setStudentId] = useState('')
  const [students, setStudents] = useState<{ id: string; full_name: string; class_grade: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('students').select('id, full_name, class_grade').order('full_name').then(({ data }) => setStudents(data ?? []))
  }, [])

  async function handleSale() {
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) { setError('Enter a valid quantity'); return }
    if (quantity > item.quantity_available) { setError(`Only ${item.quantity_available} units in stock`); return }
    setLoading(true); setError('')
    const { error: e } = await supabase.rpc('record_inventory_sale', {
      p_item_id: item.id,
      p_quantity: quantity,
      p_student_id: studentId || null,
    })
    if (e) { setError(e.message); setLoading(false); return }
    setLoading(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Record Sale — {item.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Unit Price:</span>
            <span className="text-primary" style={{ fontWeight: 600 }}>{formatCurrency(item.unit_price)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>In Stock:</span>
            <span style={{ color: item.quantity_available <= item.reorder_threshold ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
              {item.quantity_available} units
            </span>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="input-label">Quantity to Sell *</label>
            <input className="input" type="number" min="1" max={item.quantity_available} value={qty} onChange={e => setQty(e.target.value)} />
            {qty && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>Total: {formatCurrency(parseFloat(qty || '0') * item.unit_price)}</div>}
          </div>
          <div className="form-group">
            <label className="input-label">Link to Student (optional)</label>
            <select className="select" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">No student link</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Class {s.class_grade})</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSale} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Processing…</> : <><TrendingDown size={14} />Record Sale</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Restock Modal ───────────────────────────────────────────────────────────
function RestockModal({ item, onClose, onSaved }: { item: InventoryItem, onClose: () => void, onSaved: () => void }) {
  const supabase = createClient()
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRestock() {
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) { setError('Enter a valid quantity'); return }
    setLoading(true); setError('')
    const { error: e } = await supabase.rpc('record_inventory_restock', {
      p_item_id: item.id,
      p_quantity: quantity,
      p_notes: notes || null,
    })
    if (e) { setError(e.message); setLoading(false); return }
    setLoading(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">Restock — {item.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Current Stock:</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.quantity_available} units</span>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="input-label">Quantity to Add *</label>
            <input className="input" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
            {qty && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>New stock: {item.quantity_available + (parseInt(qty) || 0)} units</div>}
          </div>
          <div className="form-group">
            <label className="input-label">Notes (optional)</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supplier, batch no., etc." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRestock} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Processing…</> : <><TrendingUp size={14} />Add Stock</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function ItemFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    category: existing?.category ?? 'uniforms',
    unit_price: existing?.unit_price?.toString() ?? '',
    quantity_available: existing?.quantity_available?.toString() ?? '',
    reorder_threshold: existing?.reorder_threshold?.toString() ?? '5',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.name || !form.unit_price) { setError('Name and price are required'); return }
    if (!existing && !form.quantity_available) { setError('Opening stock is required for new items'); return }
    setLoading(true); setError('')
    const payload = {
      name: form.name,
      category: form.category,
      unit_price: parseFloat(form.unit_price),
      reorder_threshold: parseInt(form.reorder_threshold || '5'),
    }
    if (existing) {
      const { error: e } = await supabase.from('inventory_items').update(payload).eq('id', existing.id)
      if (e) { setError(e.message); setLoading(false); return }
    } else {
      const { error: e } = await supabase.from('inventory_items').insert({
        ...payload,
        quantity_available: parseInt(form.quantity_available),
        quantity_sold: 0,
      })
      if (e) { setError(e.message); setLoading(false); return }
    }
    setLoading(false); onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{existing ? 'Edit Item' : 'Add Stock Item'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={14} />{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="input-label">Item Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. School Uniform – Size M" />
          </div>
          <div className="form-group">
            <label className="input-label">Category</label>
            <select className="select" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="input-label">Unit Price (₹) *</label>
            <input className="input" type="number" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0" />
          </div>
          {!existing && (
            <div className="form-group">
              <label className="input-label">Opening Stock *</label>
              <input className="input" type="number" value={form.quantity_available} onChange={e => set('quantity_available', e.target.value)} placeholder="0" />
            </div>
          )}
          <div className="form-group">
            <label className="input-label">Reorder Threshold</label>
            <input className="input" type="number" value={form.reorder_threshold} onChange={e => set('reorder_threshold', e.target.value)} placeholder="5" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><Save size={14} />{existing ? 'Save Changes' : 'Add Item'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  const [saleItem, setSaleItem] = useState<InventoryItem | null>(null)
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null)
  const [editItem, setEditItem] = useState<InventoryItem | null | 'new'>('new')
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState<InventoryItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('inventory_items').select('*').eq('is_active', true).order('name')
    if (filterCat) q = q.eq('category', filterCat)
    const { data } = await q
    let list = (data ?? []) as InventoryItem[]
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    if (showLowStock) list = list.filter(i => i.quantity_available <= i.reorder_threshold)
    setItems(list)
    setLoading(false)
  }, [search, filterCat, showLowStock, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  async function handleDeactivate(item: InventoryItem) {
    await supabase.from('inventory_items').update({ is_active: false }).eq('id', item.id)
    setConfirmDeactivate(null)
    load()
  }

  const lowStockCount = items.filter(i => i.quantity_available <= i.reorder_threshold).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{items.length} items · {lowStockCount} low stock</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Item</button>
      </div>

      {lowStockCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span><strong>{lowStockCount} item{lowStockCount !== 1 ? 's' : ''}</strong> below reorder threshold — restocking recommended.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
        </div>
        <select className="select" style={{ width: 140 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <button
          className={`btn ${showLowStock ? 'btn-danger' : 'btn-secondary'} btn-sm`}
          onClick={() => setShowLowStock(!showLowStock)}
        >
          <AlertTriangle size={13} /> {showLowStock ? 'Showing Low Stock' : 'Show Low Stock Only'}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>In Stock</th>
              <th>Sold</th>
              <th>Reorder At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}><div className="empty-state"><Package size={40} /><p>No items found</p><button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={13} /> Add first item</button></div></td></tr>
            ) : items.map(item => {
              const isLow = item.quantity_available <= item.reorder_threshold
              const isOut = item.quantity_available === 0
              return (
                <tr key={item.id}>
                  <td className="text-primary">{item.name}</td>
                  <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{item.category}</span></td>
                  <td className="text-primary">{formatCurrency(item.unit_price)}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: isOut ? 'var(--red)' : isLow ? 'var(--amber)' : 'var(--green)', fontSize: 15 }}>
                      {item.quantity_available}
                    </span>
                  </td>
                  <td>{item.quantity_sold}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.reorder_threshold}</td>
                  <td>
                    {isOut ? <span className="badge badge-red">Out of Stock</span>
                      : isLow ? <span className="badge badge-orange"><AlertTriangle size={10} /> Low Stock</span>
                      : <span className="badge badge-green">In Stock</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setSaleItem(item)} disabled={item.quantity_available === 0} title="Record Sale">
                        <TrendingDown size={13} /> Sell
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRestockItem(item)} title="Restock">
                        <TrendingUp size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(item)} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeactivate(item)} title="Remove" style={{ padding: '5px 8px' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm deactivate */}
      {confirmDeactivate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDeactivate(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Remove Item?</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeactivate(null)} style={{ padding: 6 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              This will hide <strong>{confirmDeactivate.name}</strong> from the inventory. Existing transaction history is preserved.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeactivate(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDeactivate(confirmDeactivate)}>Remove Item</button>
            </div>
          </div>
        </div>
      )}

      {saleItem && <SaleModal item={saleItem} onClose={() => setSaleItem(null)} onSaved={() => { setSaleItem(null); load() }} />}
      {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onSaved={() => { setRestockItem(null); load() }} />}
      {showAdd && <ItemFormModal existing={null} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {editItem && editItem !== 'new' && typeof editItem === 'object' && (
        <ItemFormModal existing={editItem} onClose={() => setEditItem('new')} onSaved={() => { setEditItem('new'); load() }} />
      )}
    </div>
  )
}
