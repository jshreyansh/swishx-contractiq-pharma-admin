-- Fix: rate_contract_item_history RLS was restricted to authenticated role only.
-- The app does not use Supabase Auth JWT sessions — all requests run as anon.
-- Match the policy pattern used by all other RC tables.

DROP POLICY IF EXISTS "authenticated read" ON rate_contract_item_history;

CREATE POLICY "Allow all on rate_contract_item_history" ON rate_contract_item_history
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
