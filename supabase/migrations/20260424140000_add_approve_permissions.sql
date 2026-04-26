/*
  # Add approve/reject permission configs per role
  # CFA is excluded from RC permissions (CFA has no RC workflow role)
*/

-- Orders: approve permission
INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('perm_cfa_order_approve',      'false', 'boolean', 'CFA: Approve orders',              'CFA can approve or reject orders',                         'Admin'),
  ('perm_division_order_approve', 'true',  'boolean', 'Division: Approve orders',         'Division approver can approve or reject order line items',  'Admin'),
  ('perm_final_order_approve',    'true',  'boolean', 'Final Approver: Approve orders',   'Final approver can approve or reject orders',               'Admin')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;

-- Rate Contracts: approve permission (no CFA row)
INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('perm_division_rc_approve',    'true',  'boolean', 'Division: Approve RC items',       'Division approver can approve or reject RC line items',     'Admin'),
  ('perm_final_rc_approve',       'true',  'boolean', 'Final Approver: Approve RC items', 'Final approver can approve or reject rate contracts',       'Admin')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;
