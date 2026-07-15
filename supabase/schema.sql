-- ============================================================
-- SCHOOL ERP — ACCOUNTING MODULE
-- Run this entire SQL in Supabase > SQL Editor > New Query
-- ============================================================

-- 1. STUDENTS (master record)
CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  class_grade       TEXT NOT NULL,
  section           TEXT,
  roll_no           TEXT,
  admission_date    DATE NOT NULL,
  guardian_name     TEXT,
  guardian_contact  TEXT,
  is_school_enrolled BOOLEAN DEFAULT TRUE,
  is_hostel_enrolled BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN DEFAULT TRUE,
  photo_url         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PROFILES (extends Supabase auth.users)
-- Roles: super_admin, accountant, hostel_warden, inventory_staff, developer
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'accountant'
                CHECK (role IN ('super_admin','accountant','hostel_warden','inventory_staff','developer')),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'accountant')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. FEE STRUCTURES
CREATE TABLE IF NOT EXISTS fee_structures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  section_type  TEXT NOT NULL CHECK (section_type IN ('school','hostel','extracurricular')),
  class_grade   TEXT,
  amount        NUMERIC(10,2) NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (frequency IN ('monthly','quarterly','annual','one-time')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no        BIGSERIAL UNIQUE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  section_type      TEXT NOT NULL CHECK (section_type IN ('school','hostel','extracurricular')),
  fee_structure_id  UUID REFERENCES fee_structures(id),
  academic_year     TEXT NOT NULL DEFAULT '2025-26',
  amount_due        NUMERIC(10,2) NOT NULL,
  amount_paid       NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_fee          NUMERIC(10,2) DEFAULT 0,
  due_date          DATE NOT NULL,
  payment_date      DATE,
  payment_mode      TEXT CHECK (payment_mode IN ('cash','cheque','upi','bank')),
  cheque_no         TEXT,
  utr_ref           TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXTRACURRICULAR ACTIVITIES
CREATE TABLE IF NOT EXISTS extracurricular_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT DEFAULT 'other',
  fee_amount       NUMERIC(10,2) NOT NULL,
  fee_structure_id UUID REFERENCES fee_structures(id),
  frequency        TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (frequency IN ('monthly','quarterly','annual','one-time')),
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add fee_structure_id if table already exists
ALTER TABLE extracurricular_activities
  ADD COLUMN IF NOT EXISTS fee_structure_id UUID REFERENCES fee_structures(id);

-- 6. STUDENT ACTIVITIES (enrollments)
CREATE TABLE IF NOT EXISTS student_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id   UUID NOT NULL REFERENCES extracurricular_activities(id) ON DELETE CASCADE,
  enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(student_id, activity_id)
);

-- 7. INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS inventory_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  category            TEXT DEFAULT 'other',
  unit_price          NUMERIC(10,2) NOT NULL,
  quantity_available  INTEGER NOT NULL DEFAULT 0,
  quantity_sold       INTEGER NOT NULL DEFAULT 0,
  reorder_threshold   INTEGER NOT NULL DEFAULT 5,
  is_active           BOOLEAN DEFAULT TRUE,
  last_updated        TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_active if table already exists
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
-- Add is_active to students if missing
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 8. INVENTORY TRANSACTIONS (audit trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           UUID NOT NULL REFERENCES inventory_items(id),
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('sale','restock','correction')),
  quantity_change   INTEGER NOT NULL,
  student_id        UUID REFERENCES students(id),
  payment_txn_id    UUID REFERENCES payment_transactions(id),
  notes             TEXT,
  performed_by      UUID REFERENCES auth.users(id),
  performed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 9. APP SETTINGS (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert defaults
INSERT INTO app_settings (key, value) VALUES
  ('school_name',               '"My School"'),
  ('current_academic_year',     '"2025-26"'),
  ('late_fee_per_week',         '50'),
  ('allow_hostel_only_students','false'),
  ('receipt_prefix',            '"RCP"')
ON CONFLICT (key) DO NOTHING;

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. RPCs
-- ============================================================

-- Atomic inventory sale (prevents race conditions)
CREATE OR REPLACE FUNCTION record_inventory_sale(
  p_item_id   UUID,
  p_quantity  INTEGER,
  p_student_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT quantity_available INTO v_available FROM inventory_items WHERE id = p_item_id FOR UPDATE;
  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % available, % requested', v_available, p_quantity;
  END IF;
  UPDATE inventory_items
    SET quantity_available = quantity_available - p_quantity,
        quantity_sold      = quantity_sold + p_quantity,
        last_updated       = NOW()
  WHERE id = p_item_id;
  INSERT INTO inventory_transactions (item_id, transaction_type, quantity_change, student_id, performed_by)
    VALUES (p_item_id, 'sale', -p_quantity, p_student_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic inventory restock
CREATE OR REPLACE FUNCTION record_inventory_restock(
  p_item_id  UUID,
  p_quantity INTEGER,
  p_notes    TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE inventory_items
    SET quantity_available = quantity_available + p_quantity,
        last_updated       = NOW()
  WHERE id = p_item_id;
  INSERT INTO inventory_transactions (item_id, transaction_type, quantity_change, notes, performed_by)
    VALUES (p_item_id, 'restock', p_quantity, p_notes, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: get the role of the current authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_updated_at    ON students;
DROP TRIGGER IF EXISTS payment_updated_at     ON payment_transactions;
CREATE TRIGGER students_updated_at     BEFORE UPDATE ON students             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payment_updated_at      BEFORE UPDATE ON payment_transactions  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE students                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracurricular_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;

-- Drop existing catch-all policies before recreating
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── STUDENTS ─────────────────────────────────────────────────
-- developer: NO access
-- inventory_staff: NO access
-- hostel_warden: read only
-- accountant, super_admin: full CRUD
CREATE POLICY "students_select" ON students FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant','hostel_warden'));
CREATE POLICY "students_insert" ON students FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "students_update" ON students FOR UPDATE
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "students_delete" ON students FOR DELETE
  USING (auth.role() = 'authenticated' AND get_my_role() = 'super_admin');

-- ── PAYMENT TRANSACTIONS ─────────────────────────────────────
-- developer, inventory_staff: NO access
-- hostel_warden: read + write hostel section only
-- accountant: read + write all sections
-- super_admin: full access
CREATE POLICY "payment_select_admin_acct" ON payment_transactions FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "payment_select_warden" ON payment_transactions FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() = 'hostel_warden' AND section_type = 'hostel');
CREATE POLICY "payment_insert_admin_acct" ON payment_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "payment_insert_warden" ON payment_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND get_my_role() = 'hostel_warden' AND section_type = 'hostel');
CREATE POLICY "payment_update_admin_acct" ON payment_transactions FOR UPDATE
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "payment_update_warden" ON payment_transactions FOR UPDATE
  USING (auth.role() = 'authenticated' AND get_my_role() = 'hostel_warden' AND section_type = 'hostel');

-- ── FEE STRUCTURES ───────────────────────────────────────────
CREATE POLICY "fee_struct_select" ON fee_structures FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant','hostel_warden'));
CREATE POLICY "fee_struct_write" ON fee_structures FOR ALL
  USING (auth.role() = 'authenticated' AND get_my_role() = 'super_admin');

-- ── INVENTORY ────────────────────────────────────────────────
-- developer: NO access
-- hostel_warden, accountant: read only
-- inventory_staff: read + write
-- super_admin: full access
CREATE POLICY "inv_items_select" ON inventory_items FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant','hostel_warden','inventory_staff'));
CREATE POLICY "inv_items_write" ON inventory_items FOR ALL
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','inventory_staff'));

CREATE POLICY "inv_txn_select" ON inventory_transactions FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant','inventory_staff'));
CREATE POLICY "inv_txn_insert" ON inventory_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','inventory_staff'));

-- ── EXTRACURRICULAR ──────────────────────────────────────────
CREATE POLICY "extra_act_select" ON extracurricular_activities FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "extra_act_write" ON extracurricular_activities FOR ALL
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "student_act_select" ON student_activities FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "student_act_write" ON student_activities FOR ALL
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));

-- ── USER PROFILES ────────────────────────────────────────────
-- Everyone can read their own profile; super_admin reads all; developer reads own only
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() = 'super_admin');
CREATE POLICY "profiles_update_admin" ON user_profiles FOR UPDATE
  USING (auth.role() = 'authenticated' AND get_my_role() = 'super_admin');

-- ── APP SETTINGS ─────────────────────────────────────────────
-- All authenticated users can read settings (needed for receipts, late fee calc)
-- Only super_admin and developer can write (developer for version/deploy settings)
CREATE POLICY "settings_select" ON app_settings FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "settings_write" ON app_settings FOR ALL
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','developer'));

-- ── AUDIT LOGS ───────────────────────────────────────────────
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (auth.role() = 'authenticated' AND get_my_role() IN ('super_admin','accountant'));
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 14. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
