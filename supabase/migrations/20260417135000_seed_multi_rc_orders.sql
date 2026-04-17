-- Seed RC-backed orders that combine pricing from multiple approved rate contracts

DO $$
DECLARE
  apollo_id uuid;
  abc_id uuid;
  priya_rep_id uuid;
  ramesh_id uuid;
  sunita_id uuid;
  cardio_id uuid;
  neuro_id uuid;
  diab_id uuid;
  resp_id uuid;
  approver_cardio_id uuid;
  approver_diab_id uuid;
  approver_neuro_id uuid;
  approver_resp_id uuid;
  final_approver1_id uuid;
  final_approver2_id uuid;
  rc1_id uuid;
  rc10_id uuid;
  o13 uuid;
  o14 uuid;
  o15 uuid;
  o16 uuid;
  o17 uuid;
BEGIN
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;
  SELECT id INTO abc_id FROM stockists WHERE name ILIKE '%ABC Pharma%' LIMIT 1;
  SELECT id INTO priya_rep_id FROM field_reps WHERE name = 'Priya Singh' LIMIT 1;
  SELECT id INTO ramesh_id FROM app_users WHERE email = 'ramesh.cfa@swishx.com' LIMIT 1;
  SELECT id INTO sunita_id FROM app_users WHERE email = 'sunita.cfa@swishx.com' LIMIT 1;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO neuro_id FROM divisions WHERE code = 'NEURO' LIMIT 1;
  SELECT id INTO diab_id FROM divisions WHERE code = 'DIAB' LIMIT 1;
  SELECT id INTO resp_id FROM divisions WHERE code = 'RESP' LIMIT 1;

  SELECT id INTO approver_cardio_id FROM app_users WHERE email = 'anand.mehta@swishx.com' LIMIT 1;
  SELECT id INTO approver_diab_id FROM app_users WHERE email = 'priya.nair.div@swishx.com' LIMIT 1;
  SELECT id INTO approver_neuro_id FROM app_users WHERE email = 'suresh.iyer.div@swishx.com' LIMIT 1;
  SELECT id INTO approver_resp_id FROM app_users WHERE email = 'meena.pillai.div@swishx.com' LIMIT 1;
  SELECT id INTO final_approver1_id FROM app_users WHERE email = 'arvind.kapoor@swishx.com' LIMIT 1;
  SELECT id INTO final_approver2_id FROM app_users WHERE email = 'meera.joshi@swishx.com' LIMIT 1;

  SELECT id INTO rc1_id FROM rate_contracts WHERE rc_code = 'RC-2026-001' LIMIT 1;
  SELECT id INTO rc10_id FROM rate_contracts WHERE rc_code = 'RC-2026-010' LIMIT 1;

  -- ORD-2026-50013: multi-RC order awaiting all divisions
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50013') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50013', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'division_processing', 'synced', 'ERP-RC-50013', now() - interval '16 hours',
      0, 'Neeraj Sharma', now() - interval '18 hours',
      'Multi-RC Apollo order combining cardiology-neurology prices from RC-2026-001 and diabetes-respiratory prices from RC-2026-010.',
      rc10_id, 'RC', now() - interval '20 hours', now() - interval '80 minutes'
    )
    RETURNING id INTO o13;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (o13, 'Atorvastatin 20mg', cardio_id, 120, 95, 120, 95, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Atorvastatin 20mg' LIMIT 1), 'RC', true),
      (o13, 'Levodopa 250mg', neuro_id, 20, 320, 20, 320, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Levodopa 250mg' LIMIT 1), 'RC', true),
      (o13, 'Metformin 500mg', diab_id, 400, 26, 400, 26, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Metformin 500mg' LIMIT 1), 'RC', true),
      (o13, 'Salbutamol 100mcg Inhaler', resp_id, 30, 301, 30, 301, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Salbutamol 100mcg Inhaler' LIMIT 1), 'RC', true);

    UPDATE orders
    SET total_value = (
      SELECT COALESCE(SUM(COALESCE(final_quantity, quantity) * COALESCE(final_price, unit_price)), 0)
      FROM order_items
      WHERE order_id = o13
    )
    WHERE id = o13;

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
    VALUES
      (o13, cardio_id, approver_cardio_id, 'pending'),
      (o13, neuro_id, approver_neuro_id, 'pending'),
      (o13, diab_id, approver_diab_id, 'pending'),
      (o13, resp_id, approver_resp_id, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (o13, 'Priya Singh', 'Field Rep', 'Multi-RC Apollo order created using RC-2026-001 and RC-2026-010.', 'created', now() - interval '20 hours'),
      (o13, 'Neeraj Sharma', 'Manager', 'Manager approved the multi-RC Apollo order.', 'approved', now() - interval '18 hours'),
      (o13, 'Ramesh CFA', 'CFA', 'ERP synced for multi-RC order. ERP ID: ERP-RC-50013.', 'erp_synced', now() - interval '16 hours');
  END IF;

  -- ORD-2026-50014: multi-RC order with one division done and others pending
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50014') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50014', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'division_partially_approved', 'synced', 'ERP-RC-50014', now() - interval '40 hours',
      0, 'Neeraj Sharma', now() - interval '42 hours',
      'Multi-RC Apollo order where cardiology has signed off, while neurology, diabetology, and respiratory review remain open.',
      rc1_id, 'RC', now() - interval '44 hours', now() - interval '4 hours'
    )
    RETURNING id INTO o14;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (o14, 'Amlodipine 5mg', cardio_id, 150, 62, 150, 62, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Amlodipine 5mg' LIMIT 1), 'RC', true),
      (o14, 'Clonazepam 0.5mg', neuro_id, 80, 85, 80, 85, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Clonazepam 0.5mg' LIMIT 1), 'RC', true),
      (o14, 'Empagliflozin 10mg', diab_id, 25, 798, 25, 798, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Empagliflozin 10mg' LIMIT 1), 'RC', true),
      (o14, 'Montelukast 10mg', resp_id, 120, 91, 120, 91, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Montelukast 10mg' LIMIT 1), 'RC', true);

    UPDATE orders
    SET total_value = (
      SELECT COALESCE(SUM(COALESCE(final_quantity, quantity) * COALESCE(final_price, unit_price)), 0)
      FROM order_items
      WHERE order_id = o14
    )
    WHERE id = o14;

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (o14, cardio_id, approver_cardio_id, 'approved', now() - interval '28 hours'),
      (o14, neuro_id, approver_neuro_id, 'pending', NULL),
      (o14, diab_id, approver_diab_id, 'pending', NULL),
      (o14, resp_id, approver_resp_id, 'pending', NULL);

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (o14, 'Priya Singh', 'Field Rep', 'Multi-RC Apollo order created using RC-2026-001 and RC-2026-010.', 'created', now() - interval '44 hours'),
      (o14, 'Neeraj Sharma', 'Manager', 'Manager approved the multi-RC Apollo order.', 'approved', now() - interval '42 hours'),
      (o14, 'Ramesh CFA', 'CFA', 'ERP synced for multi-RC order. ERP ID: ERP-RC-50014.', 'erp_synced', now() - interval '40 hours'),
      (o14, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 'Division Approver', 'Cardiology approved its RC-backed line items.', 'division_approved', now() - interval '28 hours');
  END IF;

  -- ORD-2026-50015: multi-RC order waiting on final approvers
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50015') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50015', apollo_id, abc_id, priya_rep_id, sunita_id,
      'final_approval_pending', 'synced', 'ERP-RC-50015', now() - interval '3 days',
      0, 'Neeraj Sharma', now() - interval '4 days',
      'Multi-RC Apollo order cleared by all divisions and now awaiting final approver sign-off.',
      rc10_id, 'RC', now() - interval '5 days', now() - interval '7 hours'
    )
    RETURNING id INTO o15;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (o15, 'Metoprolol 50mg', cardio_id, 200, 48, 200, 48, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Metoprolol 50mg' LIMIT 1), 'RC', true),
      (o15, 'Clonazepam 0.5mg', neuro_id, 100, 85, 100, 85, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Clonazepam 0.5mg' LIMIT 1), 'RC', true),
      (o15, 'Insulin Glargine 100IU/mL', diab_id, 35, 880, 35, 880, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Insulin Glargine 100IU/mL' LIMIT 1), 'RC', true),
      (o15, 'Budesonide 400mcg Inhaler', resp_id, 20, 638, 20, 638, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Budesonide 400mcg Inhaler' LIMIT 1), 'RC', true);

    UPDATE orders
    SET total_value = (
      SELECT COALESCE(SUM(COALESCE(final_quantity, quantity) * COALESCE(final_price, unit_price)), 0)
      FROM order_items
      WHERE order_id = o15
    )
    WHERE id = o15;

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (o15, cardio_id, approver_cardio_id, 'approved', now() - interval '65 hours'),
      (o15, neuro_id, approver_neuro_id, 'approved', now() - interval '63 hours'),
      (o15, diab_id, approver_diab_id, 'approved', now() - interval '61 hours'),
      (o15, resp_id, approver_resp_id, 'approved', now() - interval '59 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (o15, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '12 hours'),
      (o15, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending', NULL);

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (o15, 'Priya Singh', 'Field Rep', 'Multi-RC Apollo order created using RC-2026-001 and RC-2026-010.', 'created', now() - interval '5 days'),
      (o15, 'Neeraj Sharma', 'Manager', 'Manager approved the multi-RC Apollo order.', 'approved', now() - interval '4 days'),
      (o15, 'Sunita CFA', 'CFA', 'ERP synced for multi-RC order. ERP ID: ERP-RC-50015.', 'erp_synced', now() - interval '3 days'),
      (o15, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'First final approval recorded for the multi-RC order.', 'final_approved', now() - interval '12 hours');
  END IF;

  -- ORD-2026-50016: fully approved multi-RC order waiting for final ERP confirmation
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50016') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50016', apollo_id, abc_id, priya_rep_id, sunita_id,
      'final_approved', 'synced', 'ERP-RC-50016', now() - interval '2 days',
      0, 'Neeraj Sharma', now() - interval '3 days',
      'Multi-RC Apollo order fully cleared by final approvers and ready for final ERP confirmation.',
      rc1_id, 'RC', now() - interval '4 days', now() - interval '18 hours'
    )
    RETURNING id INTO o16;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (o16, 'Atorvastatin 20mg', cardio_id, 80, 95, 80, 95, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Atorvastatin 20mg' LIMIT 1), 'RC', true),
      (o16, 'Atorvastatin 40mg', cardio_id, 60, 137, 60, 137, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Atorvastatin 40mg' LIMIT 1), 'RC', true),
      (o16, 'Metformin 500mg', diab_id, 500, 26, 500, 26, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Metformin 500mg' LIMIT 1), 'RC', true),
      (o16, 'Salbutamol 100mcg Inhaler', resp_id, 40, 301, 40, 301, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Salbutamol 100mcg Inhaler' LIMIT 1), 'RC', true);

    UPDATE orders
    SET total_value = (
      SELECT COALESCE(SUM(COALESCE(final_quantity, quantity) * COALESCE(final_price, unit_price)), 0)
      FROM order_items
      WHERE order_id = o16
    )
    WHERE id = o16;

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (o16, cardio_id, approver_cardio_id, 'approved', now() - interval '54 hours'),
      (o16, diab_id, approver_diab_id, 'approved', now() - interval '52 hours'),
      (o16, resp_id, approver_resp_id, 'approved', now() - interval '50 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (o16, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '24 hours'),
      (o16, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'approved', now() - interval '22 hours');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (o16, 'Priya Singh', 'Field Rep', 'Multi-RC Apollo order created using RC-2026-001 and RC-2026-010.', 'created', now() - interval '4 days'),
      (o16, 'Neeraj Sharma', 'Manager', 'Manager approved the multi-RC Apollo order.', 'approved', now() - interval '3 days'),
      (o16, 'Sunita CFA', 'CFA', 'ERP synced for multi-RC order. ERP ID: ERP-RC-50016.', 'erp_synced', now() - interval '2 days'),
      (o16, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'All final approvals recorded for the multi-RC order.', 'final_approved', now() - interval '22 hours');
  END IF;

  -- ORD-2026-50017: completed multi-RC order in history
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50017') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50017', apollo_id, abc_id, priya_rep_id, sunita_id,
      'completed', 'synced', 'ERP-RC-50017', now() - interval '7 days',
      0, 'Neeraj Sharma', now() - interval '8 days',
      'Completed Apollo fulfillment order that combined legacy neurology pricing from RC-2026-001 with diabetes-respiratory pricing from RC-2026-010.',
      rc10_id, 'RC', now() - interval '9 days', now() - interval '6 days'
    )
    RETURNING id INTO o17;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (o17, 'Amlodipine 5mg', cardio_id, 200, 62, 200, 62, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Amlodipine 5mg' LIMIT 1), 'RC', true),
      (o17, 'Levodopa 250mg', neuro_id, 30, 320, 30, 320, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Levodopa 250mg' LIMIT 1), 'RC', true),
      (o17, 'Metformin 500mg', diab_id, 700, 26, 700, 26, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Metformin 500mg' LIMIT 1), 'RC', true),
      (o17, 'Insulin Glargine 100IU/mL', diab_id, 20, 880, 20, 880, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Insulin Glargine 100IU/mL' LIMIT 1), 'RC', true),
      (o17, 'Montelukast 10mg', resp_id, 150, 91, 150, 91, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Montelukast 10mg' LIMIT 1), 'RC', true);

    UPDATE orders
    SET total_value = (
      SELECT COALESCE(SUM(COALESCE(final_quantity, quantity) * COALESCE(final_price, unit_price)), 0)
      FROM order_items
      WHERE order_id = o17
    )
    WHERE id = o17;

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (o17, cardio_id, approver_cardio_id, 'approved', now() - interval '8 days'),
      (o17, neuro_id, approver_neuro_id, 'approved', now() - interval '8 days'),
      (o17, diab_id, approver_diab_id, 'approved', now() - interval '8 days'),
      (o17, resp_id, approver_resp_id, 'approved', now() - interval '8 days');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (o17, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '7 days'),
      (o17, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'approved', now() - interval '7 days');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (o17, 'Priya Singh', 'Field Rep', 'Multi-RC Apollo order created using RC-2026-001 and RC-2026-010.', 'created', now() - interval '9 days'),
      (o17, 'Neeraj Sharma', 'Manager', 'Manager approved the multi-RC Apollo order.', 'approved', now() - interval '8 days'),
      (o17, 'Sunita CFA', 'CFA', 'ERP synced for multi-RC order. ERP ID: ERP-RC-50017.', 'erp_synced', now() - interval '7 days'),
      (o17, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'Multi-RC Apollo order completed.', 'final_approved', now() - interval '7 days');
  END IF;
END $$;
