-- Rate Contracts: new tables, column additions, indexes

-- rate_contracts master table
CREATE TABLE IF NOT EXISTS rate_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_code text UNIQUE NOT NULL,
  hospital_id uuid REFERENCES hospitals(id) NOT NULL,
  rep_id uuid REFERENCES field_reps(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  total_value numeric(12,2) DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on rate_contracts" ON rate_contracts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- rate_contract_items: one row per product in the contract
CREATE TABLE IF NOT EXISTS rate_contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id uuid REFERENCES rate_contracts(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  division_id uuid REFERENCES divisions(id),
  negotiated_price numeric(10,2) NOT NULL CHECK (negotiated_price >= 0),
  expected_qty integer NOT NULL DEFAULT 1 CHECK (expected_qty >= 1),
  cap_qty integer,
  used_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_contract_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on rate_contract_items" ON rate_contract_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- rate_contract_approvals: division + final approval rows per RC
CREATE TABLE IF NOT EXISTS rate_contract_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id uuid REFERENCES rate_contracts(id) ON DELETE CASCADE NOT NULL,
  approval_stage text NOT NULL CHECK (approval_stage IN ('division', 'final')),
  division_id uuid REFERENCES divisions(id),
  approver_user_id uuid REFERENCES app_users(id),
  approver_name text NOT NULL DEFAULT '',
  sequence_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_contract_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on rate_contract_approvals" ON rate_contract_approvals
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- rate_contract_timeline: audit trail per RC
CREATE TABLE IF NOT EXISTS rate_contract_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id uuid REFERENCES rate_contracts(id) ON DELETE CASCADE NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  action_type text NOT NULL DEFAULT 'created',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_contract_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on rate_contract_timeline" ON rate_contract_timeline
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Extend orders: link to RC + pricing mode
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rc_id uuid REFERENCES rate_contracts(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'MANUAL' CHECK (pricing_mode IN ('RC', 'MANUAL'));

-- Extend order_items: RC linkage + lock flag
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS rc_item_id uuid REFERENCES rate_contract_items(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pricing_source text DEFAULT 'MANUAL' CHECK (pricing_source IN ('RC', 'MANUAL'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS locked_price boolean DEFAULT false;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_rc_hospital ON rate_contracts(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_rc_items_rc ON rate_contract_items(rc_id);
CREATE INDEX IF NOT EXISTS idx_rc_items_product ON rate_contract_items(product_id);
CREATE INDEX IF NOT EXISTS idx_rc_approvals_rc ON rate_contract_approvals(rc_id, approval_stage);
CREATE INDEX IF NOT EXISTS idx_order_items_rc_item ON order_items(rc_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_rc ON orders(rc_id);
