/*
  # Workflow & Role Configuration

  ## What this does
  1. Re-adds anon read/write policies on system_config so the app can access it
     (app uses Supabase anon key with no Supabase Auth session)
  2. Seeds SLA timing configs per approval role
  3. Seeds role permission configs for Orders and Rate Contracts
*/

-- Re-enable anon access (app has no Supabase Auth, uses anon key)
DROP POLICY IF EXISTS "Authenticated users can read system_config"   ON system_config;
DROP POLICY IF EXISTS "Authenticated users can insert system_config" ON system_config;
DROP POLICY IF EXISTS "Authenticated users can update system_config" ON system_config;

CREATE POLICY "Allow anon read system_config"
  ON system_config FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert system_config"
  ON system_config FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update system_config"
  ON system_config FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── SLA Timings ───────────────────────────────────────────────────────────────
-- Values are in hours. These are the windows each role has to act before SLA breach.

INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('sla_cfa_hours',             '24',  'number', 'CFA / CNF SLA',              'Hours the CFA has to enter and submit an order after it is created',           'Admin'),
  ('sla_division_hours',        '48',  'number', 'Division Approver SLA',      'Hours each division approver has to review and act on an order or RC item',    'Admin'),
  ('sla_final_approver_hours',  '24',  'number', 'Final Approver SLA',         'Hours the final approver has to approve or reject after division sign-off',    'Admin')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;

-- ── Role Permissions — Orders ─────────────────────────────────────────────────
-- Controls whether a role can edit or delete order line items during their stage

INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('perm_cfa_order_edit_items',       'true',  'boolean', 'CFA: Edit order items',              'CFA can adjust quantity or price on order line items',              'Admin'),
  ('perm_cfa_order_delete_items',     'false', 'boolean', 'CFA: Delete order items',            'CFA can remove line items from an order',                          'Admin'),
  ('perm_division_order_edit_items',  'true',  'boolean', 'Division: Edit order items',         'Division approver can adjust quantity or price during review',      'Admin'),
  ('perm_division_order_delete_items','true',  'boolean', 'Division: Delete order items',       'Division approver can remove line items during review',             'Admin'),
  ('perm_final_order_edit_items',     'false', 'boolean', 'Final Approver: Edit order items',   'Final approver can adjust line items before approving',             'Admin'),
  ('perm_final_order_delete_items',   'false', 'boolean', 'Final Approver: Delete order items', 'Final approver can remove line items before approving',             'Admin')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;

-- ── Role Permissions — Rate Contracts ─────────────────────────────────────────
-- Controls whether a role can edit or delete RC line items during negotiation

INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('perm_cfa_rc_edit_items',          'false', 'boolean', 'CFA: Edit RC items',                 'CFA can modify negotiated price or quantity on RC line items',      'Admin'),
  ('perm_cfa_rc_delete_items',        'false', 'boolean', 'CFA: Delete RC items',               'CFA can remove line items from a rate contract',                   'Admin'),
  ('perm_division_rc_edit_items',     'true',  'boolean', 'Division: Edit RC items',            'Division approver can edit price or quantity during RC review',     'Admin'),
  ('perm_division_rc_delete_items',   'true',  'boolean', 'Division: Delete RC items',          'Division approver can remove line items during RC review',          'Admin'),
  ('perm_final_rc_edit_items',        'true',  'boolean', 'Final Approver: Edit RC items',      'Final approver can edit line items before final RC approval',       'Admin'),
  ('perm_final_rc_delete_items',      'false', 'boolean', 'Final Approver: Delete RC items',    'Final approver can remove line items before final RC approval',     'Admin')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;
