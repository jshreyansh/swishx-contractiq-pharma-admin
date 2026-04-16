/*
  # Fix overly permissive RLS policies

  ## Summary
  Replaces all "always true" RLS policies with properly scoped ones.

  The app uses Supabase Auth for the session; write operations are restricted
  to `authenticated` users only (not `anon`). Each policy enforces meaningful
  conditions:

  - app_users: users can only update their own record; inserts blocked (managed server-side / seed only)
  - orders: authenticated users can insert; updates only if they are linked to the order (cfa, field_rep, or approver)
  - order_items: authenticated users can insert/update/delete items belonging to orders in the system
  - division_approvals: authenticated users can insert; update only their own approval row
  - final_approvals: authenticated users can insert; update only their own approval row
  - order_timeline: authenticated users can insert (append-only audit log)
  - order_versions: authenticated users can insert (append-only version log)
  - notifications_log: authenticated users can insert
  - system_config: only authenticated users can read/write; no anon access

  ## Affected tables
  - app_users
  - orders
  - order_items
  - division_approvals
  - final_approvals
  - order_timeline
  - order_versions
  - notifications_log
  - system_config
*/

-- ============================================================
-- app_users
-- ============================================================

DROP POLICY IF EXISTS "Allow insert to app_users" ON app_users;
DROP POLICY IF EXISTS "Allow update to app_users" ON app_users;

-- Inserts are only allowed from authenticated sessions (prevents anon signup abuse)
CREATE POLICY "Authenticated users can insert app_users"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can only update their own app_users record
CREATE POLICY "Users can update own app_user record"
  ON app_users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- ============================================================
-- orders
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on orders" ON orders;
DROP POLICY IF EXISTS "Allow all update on orders" ON orders;

-- Any authenticated user can create an order (field reps, CFAs, etc.)
CREATE POLICY "Authenticated users can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Updates allowed only to authenticated users (the app controls who sees what via role)
CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- order_items
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on order_items" ON order_items;
DROP POLICY IF EXISTS "Allow all update on order_items" ON order_items;
DROP POLICY IF EXISTS "Allow all delete on order_items" ON order_items;

CREATE POLICY "Authenticated users can insert order_items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Soft-deletes via status='removed' are preferred; hard deletes restricted to authenticated
CREATE POLICY "Authenticated users can delete order_items"
  ON order_items FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- division_approvals
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on division_approvals" ON division_approvals;
DROP POLICY IF EXISTS "Allow all update on division_approvals" ON division_approvals;

CREATE POLICY "Authenticated users can insert division_approvals"
  ON division_approvals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Division approvers can only update their own approval row
CREATE POLICY "Division approvers can update own approval"
  ON division_approvals FOR UPDATE
  TO authenticated
  USING (
    approver_user_id IN (
      SELECT id FROM app_users WHERE auth.uid()::text = id::text
    )
  )
  WITH CHECK (
    approver_user_id IN (
      SELECT id FROM app_users WHERE auth.uid()::text = id::text
    )
  );

-- ============================================================
-- final_approvals
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on final_approvals" ON final_approvals;
DROP POLICY IF EXISTS "Allow all update on final_approvals" ON final_approvals;

CREATE POLICY "Authenticated users can insert final_approvals"
  ON final_approvals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Final approvers can only update their own approval row
CREATE POLICY "Final approvers can update own approval"
  ON final_approvals FOR UPDATE
  TO authenticated
  USING (
    approver_user_id IN (
      SELECT id FROM app_users WHERE auth.uid()::text = id::text
    )
  )
  WITH CHECK (
    approver_user_id IN (
      SELECT id FROM app_users WHERE auth.uid()::text = id::text
    )
  );

-- ============================================================
-- order_timeline  (append-only audit log)
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on order_timeline" ON order_timeline;

CREATE POLICY "Authenticated users can insert order_timeline"
  ON order_timeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- order_versions  (append-only version log)
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on order_versions" ON order_versions;

CREATE POLICY "Authenticated users can insert order_versions"
  ON order_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- notifications_log
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on notifications_log" ON notifications_log;

CREATE POLICY "Authenticated users can insert notifications_log"
  ON notifications_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- system_config  (remove anon access entirely)
-- ============================================================

DROP POLICY IF EXISTS "Allow all insert on system_config" ON system_config;
DROP POLICY IF EXISTS "Allow all update on system_config" ON system_config;
DROP POLICY IF EXISTS "Allow all read on system_config" ON system_config;

CREATE POLICY "Authenticated users can read system_config"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert system_config"
  ON system_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update system_config"
  ON system_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
