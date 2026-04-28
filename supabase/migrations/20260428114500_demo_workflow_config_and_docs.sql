/*
  # Demo workflow config and notes/documents polish

  ## Goal
  Add explicit approve/reject permissions for the demo workflow config,
  seed the reportee-manager auto-approval toggle, and enrich a few orders / RCs
  with attachment-oriented notes so the new notes-documents UI has believable data.
*/

INSERT INTO system_config (config_key, config_value, config_type, label, description, updated_by)
VALUES
  ('perm_division_order_approve',       'true',  'boolean', 'Division: Approve orders',           'Division approver can approve orders during review',                  'demo-polish'),
  ('perm_division_order_reject',        'true',  'boolean', 'Division: Reject orders',            'Division approver can reject orders during review',                   'demo-polish'),
  ('perm_division_order_edit_items',    'true',  'boolean', 'Division: Edit order items',         'Division approver can edit quantities or pricing on orders',          'demo-polish'),
  ('perm_division_order_delete_items',  'true',  'boolean', 'Division: Delete order items',       'Division approver can remove order items during review',              'demo-polish'),
  ('perm_final_order_approve',          'true',  'boolean', 'Final: Accept orders',               'Final approver can accept orders at the last checkpoint',             'demo-polish'),
  ('perm_final_order_reject',           'true',  'boolean', 'Final: Reject orders',               'Final approver can reject orders at the last checkpoint',             'demo-polish'),
  ('perm_final_order_edit_items',       'false', 'boolean', 'Final: Edit order items',            'Final approver cannot edit order items in the demo flow',             'demo-polish'),
  ('perm_final_order_delete_items',     'false', 'boolean', 'Final: Delete order items',          'Final approver cannot delete order items in the demo flow',           'demo-polish'),
  ('perm_division_rc_approve',          'true',  'boolean', 'Division: Approve RC items',         'Division approver can approve rate contracts during review',          'demo-polish'),
  ('perm_division_rc_reject',           'true',  'boolean', 'Division: Reject RC items',          'Division approver can reject rate contracts during review',           'demo-polish'),
  ('perm_division_rc_edit_items',       'true',  'boolean', 'Division: Edit RC items',            'Division approver can edit negotiated price or quantity on RCs',      'demo-polish'),
  ('perm_division_rc_delete_items',     'true',  'boolean', 'Division: Delete RC items',          'Division approver can remove RC line items during review',            'demo-polish'),
  ('perm_final_rc_approve',             'true',  'boolean', 'Final: Accept RC items',             'Final approver can accept rate contracts at the last checkpoint',     'demo-polish'),
  ('perm_final_rc_reject',              'true',  'boolean', 'Final: Reject RC items',             'Final approver can reject rate contracts at the last checkpoint',     'demo-polish'),
  ('perm_final_rc_edit_items',          'false', 'boolean', 'Final: Edit RC items',               'Final approver cannot edit RC line items in the demo flow',           'demo-polish'),
  ('perm_final_rc_delete_items',        'false', 'boolean', 'Final: Delete RC items',             'Final approver cannot delete RC line items in the demo flow',         'demo-polish'),
  ('workflow_reportee_manager_auto_approval', 'true', 'boolean', 'Reportee Manager Auto Approval', 'Orders created by reporting managers auto-clear the manager layer in the demo workflow.', 'demo-polish')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      config_type = EXCLUDED.config_type,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

UPDATE orders
SET notes = 'Created by field rep for a fresh Apollo request. One line is new for this hospital, so division review is required. Attached: hospital fresh requirement note.'
WHERE order_id = 'ORD-2026-61001';

UPDATE orders
SET notes = 'Division reduced one insulin line and hospital reconfirmed the revised commercial terms before CFA processing. Attached: AIIMS PO scan and hospital reconfirmation mail.'
WHERE order_id = 'ORD-2026-61005';

UPDATE orders
SET notes = 'RC-backed reorder under RC-2026-001. Division review skipped because the order is fully locked to the rate contract. Attached: RC release note.'
WHERE order_id = 'ORD-2026-61006';

UPDATE orders
SET notes = 'Created by ASM, cleared by division, and processed by CFA / CNF. Awaiting final commercial sign-off. Attached: ASM commercial note and signed PO copy.'
WHERE order_id = 'ORD-2026-61007';

UPDATE orders
SET notes = 'Respiratory order rejected at final approval because the commercial exception was outside approved thresholds. Attached: regional exception request.'
WHERE order_id = 'ORD-2026-61010';

UPDATE orders
SET notes = 'Division cleared order. CFA reference failed validation, so the order is waiting in the exception queue for retry or exception-order conversion. Attached: CFA validation screenshot.'
WHERE order_id = 'ORD-2026-61011';

UPDATE rate_contracts
SET notes = 'Approved umbrella RC for Apollo. Signed commercial annexure and negotiated pricing confirmation are attached in the demo.'
WHERE rc_code = 'RC-2026-001';

UPDATE rate_contracts
SET notes = 'Round 2 negotiation with revised cap quantities shared by the hospital procurement team. Supporting revision sheet attached.'
WHERE rc_code = 'RC-2026-021';

UPDATE rate_contracts
SET notes = 'Hospital intent letter received and attached for commercial validation in the demo.'
WHERE rc_code = 'RC-2026-022';

UPDATE rate_contracts
SET notes = 'Benchmarking note attached for final negotiation review.'
WHERE rc_code = 'RC-2026-024';
