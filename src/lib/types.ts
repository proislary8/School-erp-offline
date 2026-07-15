// ─── User & Auth ─────────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'accountant' | 'hostel_warden' | 'inventory_staff' | 'developer'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

// ─── Student ──────────────────────────────────────────────────────────────────
export interface Student {
  id: string
  student_id: string       // SCH-2025-001
  full_name: string
  class_grade: string
  section: string
  roll_no: string
  admission_date: string
  guardian_name: string
  guardian_contact: string
  is_school_enrolled: boolean
  is_hostel_enrolled: boolean
  photo_url?: string
  created_at: string
  updated_at: string
}

// ─── Fee Structure ────────────────────────────────────────────────────────────
export type SectionType = 'school' | 'hostel' | 'extracurricular'
export type FeeFrequency = 'monthly' | 'quarterly' | 'annual' | 'one-time'

export interface FeeStructure {
  id: string
  name: string
  section_type: SectionType
  class_grade?: string
  amount: number
  frequency: FeeFrequency
  is_active: boolean
  created_at: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentMode = 'cash' | 'cheque' | 'upi' | 'bank'
export type PaymentStatus = 'fully_paid' | 'pending' | 'overdue' | 'partially_paid'

export interface PaymentTransaction {
  id: string
  receipt_no: number
  student_id: string
  section_type: SectionType
  fee_structure_id: string
  academic_year: string
  amount_due: number
  amount_paid: number
  late_fee: number
  due_date: string
  payment_date?: string
  payment_mode?: PaymentMode
  cheque_no?: string
  utr_ref?: string
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  student?: Student
  fee_structure?: FeeStructure
  created_by_profile?: UserProfile
}

// ─── Status logic ─────────────────────────────────────────────────────────────
export function computePaymentStatus(tx: PaymentTransaction): PaymentStatus {
  const now = new Date()
  const due = new Date(tx.due_date)
  const paid = tx.amount_paid
  const due_amount = tx.amount_due

  if (paid >= due_amount) return 'fully_paid'
  if (paid > 0 && paid < due_amount) {
    return now > due ? 'overdue' : 'partially_paid'
  }
  return now > due ? 'overdue' : 'pending'
}

export function computeLateFee(
  tx: PaymentTransaction,
  lateFeePerWeek: number
): number {
  if (tx.amount_paid >= tx.amount_due) return 0
  const now = new Date()
  const due = new Date(tx.due_date)
  if (now <= due) return 0
  const diffMs = now.getTime() - due.getTime()
  const weeksOverdue = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000))
  return weeksOverdue * lateFeePerWeek
}

// ─── Extracurricular ──────────────────────────────────────────────────────────
export interface ExtracurricularActivity {
  id: string
  name: string
  category: string
  fee_amount: number
  fee_structure_id?: string | null
  frequency: FeeFrequency
  is_active: boolean
  created_at: string
}

export interface StudentActivity {
  id: string
  student_id: string
  activity_id: string
  enrolled_date: string
  student?: Student
  activity?: ExtracurricularActivity
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export type InventoryCategory = 'uniforms' | 'books' | 'stationery' | 'sports' | 'hostel' | 'other'
export type InventoryTxType = 'sale' | 'restock' | 'correction'

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  unit_price: number
  quantity_available: number
  quantity_sold: number
  reorder_threshold: number
  is_active: boolean
  last_updated: string
}

export interface InventoryTransaction {
  id: string
  item_id: string
  transaction_type: InventoryTxType
  quantity_change: number
  student_id?: string
  payment_txn_id?: string
  notes?: string
  performed_by: string
  performed_at: string
  item?: InventoryItem
  student?: Student
  performed_by_profile?: UserProfile
}

// ─── App Settings ─────────────────────────────────────────────────────────────
export interface AppSettings {
  school_name: string
  school_logo?: string
  current_academic_year: string
  late_fee_per_week: number
  allow_hostel_only_students: boolean
  receipt_prefix: string
}
