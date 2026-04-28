/*
  # Refresh demo order data for the updated approval story

  ## Goal
  Replace the scattered ERP-first seed data with a compact, believable demo set:
  - creator -> division -> CFA / CNF -> final approval
  - RC-backed orders skip division
  - only division acts as the edit / reject control point
  - enough volume per queue to demo comfortably
*/

UPDATE system_config
SET
  config_value = 'false',
  updated_by = 'demo-refresh',
  updated_at = now()
WHERE config_key IN (
  'perm_cfa_order_edit_items',
  'perm_cfa_order_delete_items',
  'perm_final_order_edit_items',
  'perm_final_order_delete_items'
);

UPDATE system_config
SET
  config_value = 'true',
  updated_by = 'demo-refresh',
  updated_at = now()
WHERE config_key IN (
  'perm_division_order_edit_items',
  'perm_division_order_delete_items'
);

DO $$
DECLARE
  cardio_id uuid;
  diab_id uuid;
  neuro_id uuid;
  onco_id uuid;
  resp_id uuid;

  apollo_id uuid;
  aiims_id uuid;
  fortis_id uuid;
  max_id uuid;
  narayana_id uuid;
  kokilaben_id uuid;

  abc_stockist_id uuid;
  apex_stockist_id uuid;
  karnataka_stockist_id uuid;

  priya_rep_id uuid;
  rahul_rep_id uuid;
  suresh_rep_id uuid;
  meena_rep_id uuid;
  kavita_rep_id uuid;
  arun_rep_id uuid;

  ramesh_cfa_id uuid;
  sunita_cfa_id uuid;
  arvind_final_id uuid;
  meera_final_id uuid;
  cardio_approver_id uuid;
  diab_approver_id uuid;
  neuro_approver_id uuid;
  onco_approver_id uuid;
  resp_approver_id uuid;

  rc001_id uuid;
  rc001_atorva_id uuid;
  rc001_metoprolol_id uuid;
  rc001_amlodipine_id uuid;
  rc001_levodopa_id uuid;
  rc001_clonazepam_id uuid;

  order_61001 uuid;
  order_61002 uuid;
  order_61003 uuid;
  order_61004 uuid;
  order_61005 uuid;
  order_61006 uuid;
  order_61007 uuid;
  order_61008 uuid;
  order_61009 uuid;
  order_61010 uuid;
  order_61011 uuid;
BEGIN
  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO';
  SELECT id INTO diab_id   FROM divisions WHERE code = 'DIAB';
  SELECT id INTO neuro_id  FROM divisions WHERE code = 'NEURO';
  SELECT id INTO onco_id   FROM divisions WHERE code = 'ONCO';
  SELECT id INTO resp_id   FROM divisions WHERE code = 'RESP';

  SELECT id INTO apollo_id    FROM hospitals WHERE name = 'Apollo Hospitals';
  SELECT id INTO aiims_id     FROM hospitals WHERE name = 'AIIMS Delhi';
  SELECT id INTO fortis_id    FROM hospitals WHERE name = 'Fortis Healthcare';
  SELECT id INTO max_id       FROM hospitals WHERE name = 'Max Super Speciality';
  SELECT id INTO narayana_id  FROM hospitals WHERE name = 'Narayana Health';
  SELECT id INTO kokilaben_id FROM hospitals WHERE name = 'Kokilaben Dhirubhai Ambani';

  SELECT id INTO abc_stockist_id       FROM stockists WHERE name = 'ABC Pharma Distributors';
  SELECT id INTO apex_stockist_id      FROM stockists WHERE name = 'Apex Medical Supplies';
  SELECT id INTO karnataka_stockist_id FROM stockists WHERE name = 'Karnataka Medicals';

  SELECT id INTO priya_rep_id  FROM field_reps WHERE name = 'Priya Singh';
  SELECT id INTO rahul_rep_id  FROM field_reps WHERE name = 'Rahul Sharma';
  SELECT id INTO suresh_rep_id FROM field_reps WHERE name = 'Suresh Nair';
  SELECT id INTO meena_rep_id  FROM field_reps WHERE name = 'Meena Iyer';
  SELECT id INTO kavita_rep_id FROM field_reps WHERE name = 'Kavita Reddy';
  SELECT id INTO arun_rep_id   FROM field_reps WHERE name = 'Arun Desai';

  SELECT id INTO ramesh_cfa_id  FROM app_users WHERE email = 'ramesh.cfa@swishx.com';
  SELECT id INTO sunita_cfa_id  FROM app_users WHERE email = 'sunita.cfa@swishx.com';
  SELECT id INTO arvind_final_id FROM app_users WHERE email = 'arvind.kapoor@swishx.com';
  SELECT id INTO meera_final_id  FROM app_users WHERE email = 'meera.joshi@swishx.com';

  SELECT id INTO cardio_approver_id FROM app_users WHERE division_id = cardio_id AND role = 'division_approver' ORDER BY created_at LIMIT 1;
  SELECT id INTO diab_approver_id   FROM app_users WHERE division_id = diab_id   AND role = 'division_approver' ORDER BY created_at LIMIT 1;
  SELECT id INTO neuro_approver_id  FROM app_users WHERE division_id = neuro_id  AND role = 'division_approver' ORDER BY created_at LIMIT 1;
  SELECT id INTO onco_approver_id   FROM app_users WHERE division_id = onco_id   AND role = 'division_approver' ORDER BY created_at LIMIT 1;
  SELECT id INTO resp_approver_id   FROM app_users WHERE division_id = resp_id   AND role = 'division_approver' ORDER BY created_at LIMIT 1;

  SELECT id INTO rc001_id FROM rate_contracts WHERE rc_code = 'RC-2026-001';
  SELECT id INTO rc001_atorva_id     FROM rate_contract_items WHERE rc_id = rc001_id AND product_name = 'Atorvastatin 20mg' LIMIT 1;
  SELECT id INTO rc001_metoprolol_id FROM rate_contract_items WHERE rc_id = rc001_id AND product_name = 'Metoprolol 50mg' LIMIT 1;
  SELECT id INTO rc001_amlodipine_id FROM rate_contract_items WHERE rc_id = rc001_id AND product_name = 'Amlodipine 5mg' LIMIT 1;
  SELECT id INTO rc001_levodopa_id   FROM rate_contract_items WHERE rc_id = rc001_id AND product_name = 'Levodopa 250mg' LIMIT 1;
  SELECT id INTO rc001_clonazepam_id FROM rate_contract_items WHERE rc_id = rc001_id AND product_name = 'Clonazepam 0.5mg' LIMIT 1;

  IF cardio_id IS NULL OR diab_id IS NULL OR neuro_id IS NULL OR onco_id IS NULL OR resp_id IS NULL THEN
    RAISE EXCEPTION 'Division seed data is missing; cannot refresh the order demo.';
  END IF;

  IF apollo_id IS NULL OR aiims_id IS NULL OR fortis_id IS NULL OR max_id IS NULL OR narayana_id IS NULL OR kokilaben_id IS NULL THEN
    RAISE EXCEPTION 'Hospital seed data is missing; cannot refresh the order demo.';
  END IF;

  IF abc_stockist_id IS NULL OR apex_stockist_id IS NULL OR karnataka_stockist_id IS NULL THEN
    RAISE EXCEPTION 'Stockist seed data is missing; cannot refresh the order demo.';
  END IF;

  IF priya_rep_id IS NULL OR rahul_rep_id IS NULL OR suresh_rep_id IS NULL OR meena_rep_id IS NULL OR kavita_rep_id IS NULL OR arun_rep_id IS NULL THEN
    RAISE EXCEPTION 'Field rep seed data is missing; cannot refresh the order demo.';
  END IF;

  IF ramesh_cfa_id IS NULL OR sunita_cfa_id IS NULL OR arvind_final_id IS NULL OR meera_final_id IS NULL THEN
    RAISE EXCEPTION 'Workflow users are missing; cannot refresh the order demo.';
  END IF;

  DELETE FROM notifications_log;
  DELETE FROM order_versions;
  DELETE FROM order_timeline;
  DELETE FROM final_approvals;
  DELETE FROM division_approvals;
  DELETE FROM order_rate_contract_links;
  DELETE FROM order_items;
  DELETE FROM orders;

  -- 61001: rep-created, awaiting division review
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61001', apollo_id, priya_rep_id, abc_stockist_id, sunita_cfa_id,
    'division_processing', 'pending_sync', 26700, now() + interval '18 hours', false,
    'Priya Singh (Field Rep)', now() - interval '18 hours',
    'Created by field rep for a fresh Apollo request. One line is new for this hospital, so division review is required.',
    'MANUAL', NULL, now() - interval '18 hours', now() - interval '3 hours'
  ) RETURNING id INTO order_61001;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (order_61001, 'Atorvastatin 20mg', cardio_id, 180, 108, 'pending'),
    (order_61001, 'Levodopa 250mg', neuro_id, 22, 330, 'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES
    (order_61001, cardio_id, cardio_approver_id, 'pending'),
    (order_61001, neuro_id,  neuro_approver_id,  'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61001, 'Priya Singh', 'Field Rep', 'Order created and submitted into division review.', 'created', now() - interval '18 hours');

  -- 61002: manager-created, awaiting division review
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61002', aiims_id, rahul_rep_id, apex_stockist_id, ramesh_cfa_id,
    'division_processing', 'pending_sync', 57250, now() + interval '20 hours', false,
    'Rajesh Kumar (ASM)', now() - interval '16 hours',
    'Created by ASM on behalf of Rahul Sharma. Institutional diabetes order waiting for division review.',
    'MANUAL', NULL, now() - interval '16 hours', now() - interval '4 hours'
  ) RETURNING id INTO order_61002;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (order_61002, 'Metformin 500mg', diab_id, 900, 29, 'pending'),
    (order_61002, 'Insulin Glargine 3ml', diab_id, 35, 890, 'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES
    (order_61002, diab_id, diab_approver_id, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61002, 'Rajesh Kumar', 'ASM', 'Reporting manager created the order for field execution and division review.', 'created', now() - interval '16 hours');

  -- 61003: mixed order, one division rejected
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61003', fortis_id, meena_rep_id, apex_stockist_id, ramesh_cfa_id,
    'division_partially_rejected', 'pending_sync', 46800, now() + interval '10 hours', false,
    'Sunita Malhotra (RSM)', now() - interval '30 hours',
    'Mixed historical and new medicines. Cardiology cleared, but the diabetes line was rejected on commercial mismatch.',
    'MANUAL', NULL, now() - interval '30 hours', now() - interval '8 hours'
  ) RETURNING id INTO order_61003;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status, rejection_reason)
  VALUES
    (order_61003, 'Amlodipine 5mg', cardio_id, 150, 64, 150, 62, 'approved', ''),
    (order_61003, 'Insulin Glargine 3ml', diab_id, 40, 930, NULL, NULL, 'rejected', 'Price above accepted repeat-order band');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61003, cardio_id, cardio_approver_id, 'approved', now() - interval '12 hours'),
    (order_61003, diab_id, diab_approver_id, 'rejected', now() - interval '8 hours');

  UPDATE division_approvals
  SET rejection_reason = 'Price above accepted repeat-order band'
  WHERE order_id = order_61003 AND division_id = diab_id;

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61003, 'Sunita Malhotra', 'RSM', 'Reporting manager created a mixed commercial order.', 'created', now() - interval '30 hours'),
    (order_61003, 'Cardiology Division', 'Division Approver', 'Cardiology cleared its product line.', 'division_approved', now() - interval '12 hours'),
    (order_61003, 'Diabetes Division', 'Division Approver', 'Rejected: price above accepted repeat-order band.', 'division_rejected', now() - interval '8 hours');

  -- 61004: auto-approved from historical match, waiting for CFA
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61004', apollo_id, priya_rep_id, abc_stockist_id, sunita_cfa_id,
    'pending_erp_entry', 'pending_sync', 25200, now() - interval '1 hour', true,
    'Priya Singh (Field Rep)', now() - interval '26 hours',
    'Auto-approved from historical match for Apollo. Same product family, quantity band, and price as earlier fulfilled orders.',
    'MANUAL', NULL, now() - interval '26 hours', now() - interval '2 hours'
  ) RETURNING id INTO order_61004;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (order_61004, 'Atorvastatin 20mg', cardio_id, 200, 95, 'approved'),
    (order_61004, 'Amlodipine 5mg', cardio_id, 100, 62, 'approved');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61004, 'Priya Singh', 'Field Rep', 'Order created from a repeat commercial pattern.', 'created', now() - interval '26 hours'),
    (order_61004, 'Workflow Engine', 'System', 'Order auto-approved from past matching hospital history and routed to CFA / CNF.', 'approved', now() - interval '25 hours');

  -- 61005: division edited and hospital reconfirmed, waiting for CFA
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61005', aiims_id, rahul_rep_id, apex_stockist_id, ramesh_cfa_id,
    'pending_erp_entry', 'pending_sync', 75850, now() + interval '8 hours', false,
    'Rahul Sharma (Field Rep)', now() - interval '22 hours',
    'Division reduced one insulin line and hospital reconfirmed the revised commercial terms before CFA processing.',
    'MANUAL', NULL, now() - interval '22 hours', now() - interval '90 minutes'
  ) RETURNING id INTO order_61005;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status)
  VALUES
    (order_61005, 'Metformin 500mg', diab_id, 1200, 28, 1200, 28, 'approved'),
    (order_61005, 'Insulin Glargine 3ml', diab_id, 60, 870, 50, 845, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61005, diab_id, diab_approver_id, 'approved', now() - interval '2 hours');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61005, 'Rahul Sharma', 'Field Rep', 'Order created for AIIMS institutional supply.', 'created', now() - interval '22 hours'),
    (order_61005, 'Diabetes Division', 'Division Approver', 'Division updated quantity and price on one line before approval.', 'edited', now() - interval '3 hours'),
    (order_61005, 'Diabetes Division', 'Division Approver', 'Division cleared the revised commercial terms.', 'division_approved', now() - interval '2 hours'),
    (order_61005, 'Apollo Hospital POC', 'Hospital', 'Hospital reconfirmed the revised commercial terms.', 'confirmed', now() - interval '90 minutes');

  -- 61006: RC-backed order, division skipped, waiting for CFA
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61006', apollo_id, arun_rep_id, abc_stockist_id, sunita_cfa_id,
    'pending_erp_entry', 'pending_sync', 26720, now() + interval '12 hours', false,
    'Arun Desai (Field Rep)', now() - interval '14 hours',
    'RC-backed reorder under RC-2026-001. Division review skipped because the order is fully locked to the rate contract.',
    'RC', rc001_id, now() - interval '14 hours', now() - interval '2 hours'
  ) RETURNING id INTO order_61006;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status, rc_item_id, pricing_source, locked_price)
  VALUES
    (order_61006, 'Atorvastatin 20mg', cardio_id, 160, 95, 'approved', rc001_atorva_id, 'RC', true),
    (order_61006, 'Metoprolol 50mg', cardio_id, 120, 48, 'approved', rc001_metoprolol_id, 'RC', true),
    (order_61006, 'Levodopa 250mg', neuro_id, 18, 320, 'approved', rc001_levodopa_id, 'RC', true);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61006, 'Arun Desai', 'Field Rep', 'RC-backed order created for Apollo Hospital.', 'created', now() - interval '14 hours'),
    (order_61006, 'Workflow Engine', 'System', 'Division review skipped because all lines are covered by RC-2026-001.', 'approved', now() - interval '13 hours');

  -- 61007: manager-created, processed by CFA, pending final approval
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at, total_value,
    sla_deadline, sla_breached, manager_name, manager_approved_at,
    notes, pricing_mode, rc_id, created_at, updated_at
  ) VALUES (
    'ORD-2026-61007', max_id, rahul_rep_id, apex_stockist_id, ramesh_cfa_id,
    'final_approval_pending', 'synced', 'CFA-61007', now() - interval '2 hours', 64350,
    now() + interval '20 hours', false, 'Rajesh Kumar (ASM)', now() - interval '28 hours',
    'Created by ASM, cleared by division, and processed by CFA / CNF. Awaiting final commercial sign-off.',
    'MANUAL', NULL, now() - interval '28 hours', now() - interval '2 hours'
  ) RETURNING id INTO order_61007;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status)
  VALUES
    (order_61007, 'Atorvastatin 20mg', cardio_id, 250, 102, 250, 100, 'approved'),
    (order_61007, 'Levodopa 250mg', neuro_id, 120, 325, 120, 325, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61007, cardio_id, cardio_approver_id, 'approved', now() - interval '6 hours'),
    (order_61007, neuro_id, neuro_approver_id, 'approved', now() - interval '5 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (order_61007, arvind_final_id, 'Arvind Kapoor', 1, 'pending'),
    (order_61007, meera_final_id,  'Meera Joshi',   2, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61007, 'Rajesh Kumar', 'ASM', 'Reporting manager created the order for Max Super Speciality.', 'created', now() - interval '28 hours'),
    (order_61007, 'Division Review Board', 'Division Approver', 'All divisions approved the order and routed it to CFA / CNF.', 'division_approved', now() - interval '5 hours'),
    (order_61007, 'Ramesh CFA', 'CFA / CNF', 'Processing completed. Reference CFA-61007. Sent to final approval.', 'erp_synced', now() - interval '2 hours');

  -- 61008: RC-backed, already processed, one final approver done
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at, total_value,
    sla_deadline, sla_breached, manager_name, manager_approved_at,
    notes, pricing_mode, rc_id, created_at, updated_at
  ) VALUES (
    'ORD-2026-61008', apollo_id, priya_rep_id, abc_stockist_id, sunita_cfa_id,
    'final_approval_pending', 'synced', 'CFA-61008', now() - interval '6 hours', 15480,
    now() + interval '14 hours', false, 'Priya Singh (Field Rep)', now() - interval '18 hours',
    'RC-backed order processed by CFA / CNF. Meera approved already; Arvind is the remaining final approver.',
    'RC', rc001_id, now() - interval '18 hours', now() - interval '6 hours'
  ) RETURNING id INTO order_61008;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status, rc_item_id, pricing_source, locked_price)
  VALUES
    (order_61008, 'Amlodipine 5mg', cardio_id, 140, 62, 'approved', rc001_amlodipine_id, 'RC', true),
    (order_61008, 'Clonazepam 0.5mg', neuro_id, 80, 85, 'approved', rc001_clonazepam_id, 'RC', true);

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (order_61008, arvind_final_id, 'Arvind Kapoor', 1, 'pending', NULL),
    (order_61008, meera_final_id,  'Meera Joshi',   2, 'approved', now() - interval '90 minutes');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61008, 'Priya Singh', 'Field Rep', 'RC-backed order created under RC-2026-001.', 'created', now() - interval '18 hours'),
    (order_61008, 'Workflow Engine', 'System', 'Division review skipped because all lines are covered by RC-2026-001.', 'approved', now() - interval '17 hours'),
    (order_61008, 'Sunita CFA', 'CFA / CNF', 'Processing completed. Reference CFA-61008. Sent to final approval.', 'erp_synced', now() - interval '6 hours'),
    (order_61008, 'Meera Joshi', 'Final Approver', 'Approval recorded. Awaiting Arvind Kapoor.', 'final_approved', now() - interval '90 minutes');

  -- 61009: fully approved
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at, total_value,
    sla_deadline, sla_breached, manager_name, manager_approved_at,
    notes, pricing_mode, rc_id, created_at, updated_at
  ) VALUES (
    'ORD-2026-61009', kokilaben_id, kavita_rep_id, karnataka_stockist_id, sunita_cfa_id,
    'final_approved', 'synced', 'CFA-61009', now() - interval '20 hours', 98200,
    now() + interval '30 hours', false, 'Anand Krishnan (GM)', now() - interval '3 days',
    'Priority oncology order created by GM and approved end-to-end in the new workflow.',
    'MANUAL', NULL, now() - interval '3 days', now() - interval '8 hours'
  ) RETURNING id INTO order_61009;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status)
  VALUES
    (order_61009, 'Trastuzumab 440mg', onco_id, 1, 59800, 1, 59800, 'approved'),
    (order_61009, 'Paclitaxel 300mg Vial', onco_id, 2, 19200, 2, 19200, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61009, onco_id, onco_approver_id, 'approved', now() - interval '2 days');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (order_61009, arvind_final_id, 'Arvind Kapoor', 1, 'approved', now() - interval '12 hours'),
    (order_61009, meera_final_id,  'Meera Joshi',   2, 'approved', now() - interval '8 hours');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61009, 'Anand Krishnan', 'GM', 'Priority order created for oncology fulfilment.', 'created', now() - interval '3 days'),
    (order_61009, 'Oncology Division', 'Division Approver', 'Division approved the commercial terms.', 'division_approved', now() - interval '2 days'),
    (order_61009, 'Sunita CFA', 'CFA / CNF', 'Processing completed. Reference CFA-61009. Sent to final approval.', 'erp_synced', now() - interval '20 hours'),
    (order_61009, 'Arvind Kapoor', 'Final Approver', 'All final approvers cleared. Order is approved.', 'final_approved', now() - interval '8 hours');

  -- 61010: final rejected
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at, total_value,
    sla_deadline, sla_breached, manager_name, manager_approved_at,
    notes, pricing_mode, rc_id, created_at, updated_at
  ) VALUES (
    'ORD-2026-61010', narayana_id, suresh_rep_id, karnataka_stockist_id, sunita_cfa_id,
    'final_rejected', 'synced', 'CFA-61010', now() - interval '18 hours', 42800,
    now() + interval '24 hours', false, 'Neeraj Sharma (RSM)', now() - interval '2 days',
    'Respiratory order rejected at final approval because the commercial exception was outside approved thresholds.',
    'MANUAL', NULL, now() - interval '2 days', now() - interval '7 hours'
  ) RETURNING id INTO order_61010;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status)
  VALUES
    (order_61010, 'Budesonide 400mcg Inhaler', resp_id, 40, 652, 40, 652, 'approved'),
    (order_61010, 'Montelukast 10mg', resp_id, 180, 92, 180, 92, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61010, resp_id, resp_approver_id, 'approved', now() - interval '26 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at)
  VALUES
    (order_61010, arvind_final_id, 'Arvind Kapoor', 1, 'rejected', 'Commercial exception is outside the approved regional benchmark.', now() - interval '7 hours'),
    (order_61010, meera_final_id,  'Meera Joshi',   2, 'pending',  '', NULL);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61010, 'Neeraj Sharma', 'RSM', 'Reporting manager created a priority respiratory order.', 'created', now() - interval '2 days'),
    (order_61010, 'Respiratory Division', 'Division Approver', 'Division approved and routed the order to CFA / CNF.', 'division_approved', now() - interval '26 hours'),
    (order_61010, 'Sunita CFA', 'CFA / CNF', 'Processing completed. Reference CFA-61010. Sent to final approval.', 'erp_synced', now() - interval '18 hours'),
    (order_61010, 'Arvind Kapoor', 'Final Approver', 'Rejected: commercial exception is outside the approved benchmark.', 'final_rejected', now() - interval '7 hours');

  -- 61011: processing exception queue
  INSERT INTO orders (
    order_id, hospital_id, field_rep_id, stockist_id, cfa_user_id,
    stage, erp_status, erp_order_id, total_value, sla_deadline, sla_breached,
    manager_name, manager_approved_at, notes, pricing_mode, rc_id,
    created_at, updated_at
  ) VALUES (
    'ORD-2026-61011', max_id, rahul_rep_id, apex_stockist_id, ramesh_cfa_id,
    'pending_erp_entry', 'sync_failed', 'CFA-ERR-61011', 30400, now() + interval '4 hours', false,
    'Operations Exception Desk', now() - interval '20 hours',
    'Division cleared order. CFA reference failed validation, so the order is waiting in the exception queue for retry or exception-order conversion.',
    'MANUAL', NULL, now() - interval '20 hours', now() - interval '45 minutes'
  ) RETURNING id INTO order_61011;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, final_quantity, final_price, status)
  VALUES
    (order_61011, 'Atorvastatin 20mg', cardio_id, 200, 100, 200, 100, 'approved'),
    (order_61011, 'Metoprolol 50mg', cardio_id, 200, 52, 200, 52, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (order_61011, cardio_id, cardio_approver_id, 'approved', now() - interval '4 hours');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (order_61011, 'Operations Exception Desk', 'Operations', 'Order entered after division clearance for CFA processing.', 'created', now() - interval '20 hours'),
    (order_61011, 'Cardiology Division', 'Division Approver', 'Division approved the order and sent it to CFA / CNF.', 'division_approved', now() - interval '4 hours'),
    (order_61011, 'Ramesh CFA', 'CFA / CNF', 'Processing exception raised during reference validation.', 'erp_sync_failed', now() - interval '45 minutes');
END $$;
