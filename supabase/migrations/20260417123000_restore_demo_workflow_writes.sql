-- Restore anon workflow writes for the demo role-switching UI.
-- The current frontend does not establish Supabase Auth sessions, so
-- workflow actions must remain writable for anon in this environment.

DROP POLICY IF EXISTS "Demo users can insert orders" ON orders;
CREATE POLICY "Demo users can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can update orders" ON orders;
CREATE POLICY "Demo users can update orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can insert order_items" ON order_items;
CREATE POLICY "Demo users can insert order_items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can update order_items" ON order_items;
CREATE POLICY "Demo users can update order_items"
  ON order_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can delete order_items" ON order_items;
CREATE POLICY "Demo users can delete order_items"
  ON order_items FOR DELETE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Demo users can insert division_approvals" ON division_approvals;
CREATE POLICY "Demo users can insert division_approvals"
  ON division_approvals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can update division_approvals" ON division_approvals;
CREATE POLICY "Demo users can update division_approvals"
  ON division_approvals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can insert final_approvals" ON final_approvals;
CREATE POLICY "Demo users can insert final_approvals"
  ON final_approvals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can update final_approvals" ON final_approvals;
CREATE POLICY "Demo users can update final_approvals"
  ON final_approvals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can insert order_timeline" ON order_timeline;
CREATE POLICY "Demo users can insert order_timeline"
  ON order_timeline FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can insert order_versions" ON order_versions;
CREATE POLICY "Demo users can insert order_versions"
  ON order_versions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Demo users can insert notifications_log" ON notifications_log;
CREATE POLICY "Demo users can insert notifications_log"
  ON notifications_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
