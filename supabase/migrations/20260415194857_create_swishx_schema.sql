/*
  # SwishX Pharma Order Control Panel - Complete Schema

  ## Overview
  Creates the full database schema for the SwishX MVP demo including all tables
  for orders, users, products, approvals, timelines, and configuration.

  ## Tables Created
  1. `divisions` - Pharma product divisions (Cardio, Oncology, etc.)
  2. `hospitals` - Hospital entities placing orders
  3. `stockists` - Distribution stockist companies
  4. `field_reps` - Field sales representatives
  5. `app_users` - Internal web app users with roles
  6. `orders` - Master order table with stage/status tracking
  7. `order_items` - Individual products within an order
  8. `division_approvals` - Per-division approval decisions
  9. `final_approvals` - Final approver decisions
  10. `order_timeline` - Chronological audit trail per order
  11. `order_versions` - Snapshots at key stages
  12. `notifications_log` - Mocked email/notification records
  13. `system_config` - Workflow configuration settings

  ## Security
  - RLS enabled on all tables
  - Demo mode: authenticated users can read/write all (no real auth)
  - Policies designed for demo role-switching pattern
*/

-- Divisions
CREATE TABLE IF NOT EXISTS divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  approver_name text NOT NULL,
  approver_email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to divisions"
  ON divisions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to hospitals"
  ON hospitals FOR SELECT
  TO anon, authenticated
  USING (true);

-- Stockists
CREATE TABLE IF NOT EXISTS stockists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  warehouse_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stockists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to stockists"
  ON stockists FOR SELECT
  TO anon, authenticated
  USING (true);

-- Field Reps
CREATE TABLE IF NOT EXISTS field_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  region text NOT NULL,
  manager_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE field_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to field_reps"
  ON field_reps FOR SELECT
  TO anon, authenticated
  USING (true);

-- App Users (internal web app users)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'cfa', 'division_approver', 'final_approver', 'viewer')),
  division_id uuid REFERENCES divisions(id),
  region text DEFAULT '',
  warehouse_code text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to app_users"
  ON app_users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert to app_users"
  ON app_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update to app_users"
  ON app_users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Orders master table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  hospital_id uuid REFERENCES hospitals(id) NOT NULL,
  field_rep_id uuid REFERENCES field_reps(id) NOT NULL,
  stockist_id uuid REFERENCES stockists(id) NOT NULL,
  cfa_user_id uuid REFERENCES app_users(id),
  stage text NOT NULL DEFAULT 'created' CHECK (stage IN (
    'created', 'hospital_confirmed', 'pending_manager_approval', 'manager_approved',
    'pending_erp_entry', 'erp_entered', 'division_processing',
    'division_partially_approved', 'division_partially_rejected',
    'final_approval_pending', 'final_approved', 'final_rejected',
    'sent_to_supply_chain', 'sent_to_stockist', 'fulfillment_pending', 'completed'
  )),
  erp_status text NOT NULL DEFAULT 'pending_sync' CHECK (erp_status IN ('pending_sync', 'synced', 'manual_added', 'sync_failed', 'resync_required')),
  erp_order_id text DEFAULT '',
  erp_synced_at timestamptz,
  total_value numeric(12,2) DEFAULT 0,
  sla_deadline timestamptz,
  sla_breached boolean DEFAULT false,
  manager_name text NOT NULL DEFAULT '',
  manager_approved_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  division_id uuid REFERENCES divisions(id) NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 1),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  final_quantity integer,
  final_price numeric(10,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  rejection_reason text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on order_items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on order_items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on order_items"
  ON order_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all delete on order_items"
  ON order_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- Division Approvals
CREATE TABLE IF NOT EXISTS division_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  division_id uuid REFERENCES divisions(id) NOT NULL,
  approver_user_id uuid REFERENCES app_users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id, division_id)
);

ALTER TABLE division_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on division_approvals"
  ON division_approvals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on division_approvals"
  ON division_approvals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on division_approvals"
  ON division_approvals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Final Approvals
CREATE TABLE IF NOT EXISTS final_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  approver_user_id uuid REFERENCES app_users(id) NOT NULL,
  approver_name text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE final_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on final_approvals"
  ON final_approvals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on final_approvals"
  ON final_approvals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on final_approvals"
  ON final_approvals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Order Timeline (Audit Trail)
CREATE TABLE IF NOT EXISTS order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'created', 'confirmed', 'approved', 'rejected', 'erp_synced', 'erp_manual',
    'division_approved', 'division_rejected', 'final_approved', 'final_rejected',
    'edited', 'email_sent', 'released', 'note_added', 'stage_changed'
  )),
  old_value text DEFAULT '',
  new_value text DEFAULT '',
  field_changed text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on order_timeline"
  ON order_timeline FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on order_timeline"
  ON order_timeline FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Order Versions (snapshots)
CREATE TABLE IF NOT EXISTS order_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  version_label text NOT NULL CHECK (version_label IN ('initial', 'post_division', 'final_approved')),
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on order_versions"
  ON order_versions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on order_versions"
  ON order_versions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Notifications Log
CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('cfa_email', 'supply_chain_email', 'sla_alert', 'rejection_notice')),
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on notifications_log"
  ON notifications_log FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on notifications_log"
  ON notifications_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- System Config
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  config_type text NOT NULL DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
  label text NOT NULL,
  description text DEFAULT '',
  updated_by text DEFAULT 'system',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on system_config"
  ON system_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on system_config"
  ON system_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on system_config"
  ON system_config FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
