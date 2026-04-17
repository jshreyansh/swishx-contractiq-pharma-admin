-- Seed demo Rate Contract data for all UI states

DO $$
DECLARE
  apollo_id    uuid;
  aiims_id     uuid;
  fortis_id    uuid;
  cardio_id    uuid;
  diab_id      uuid;
  neuro_id     uuid;
  onco_id      uuid;
  rep1_id      uuid;
  abc_id       uuid;
  cfa_user_id  uuid;
  div_approver_cardio_id uuid;
  div_approver_diab_id   uuid;
  final_approver1_id     uuid;
  final_approver2_id     uuid;
  rc1_id  uuid;
  rc2_id  uuid;
  rc3_id  uuid;
  rc_order_1_id uuid;
  rc_order_2_id uuid;
BEGIN

  -- Resolve reference IDs
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;
  SELECT id INTO aiims_id  FROM hospitals WHERE name ILIKE '%AIIMS%'  LIMIT 1;
  SELECT id INTO fortis_id FROM hospitals WHERE name ILIKE '%Fortis%' LIMIT 1;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO diab_id   FROM divisions WHERE code = 'DIAB'   LIMIT 1;
  SELECT id INTO neuro_id  FROM divisions WHERE code = 'NEURO'  LIMIT 1;
  SELECT id INTO onco_id   FROM divisions WHERE code = 'ONCO'   LIMIT 1;

  SELECT id INTO rep1_id FROM field_reps LIMIT 1;
  SELECT id INTO abc_id FROM stockists WHERE name ILIKE '%ABC Pharma%' LIMIT 1;
  SELECT id INTO cfa_user_id FROM app_users WHERE role = 'cfa' ORDER BY created_at LIMIT 1;

  SELECT id INTO div_approver_cardio_id
    FROM app_users WHERE role = 'division_approver' AND division_id = cardio_id LIMIT 1;
  SELECT id INTO div_approver_diab_id
    FROM app_users WHERE role = 'division_approver' AND division_id = diab_id LIMIT 1;
  SELECT id INTO final_approver1_id
    FROM app_users WHERE role = 'final_approver' ORDER BY created_at LIMIT 1;
  SELECT id INTO final_approver2_id
    FROM app_users WHERE role = 'final_approver' ORDER BY created_at OFFSET 1 LIMIT 1;

  -- ─── RC-2026-001: APPROVED, Apollo Hospital, active Apr–Jun 2026 ───────────
  INSERT INTO rate_contracts (rc_code, hospital_id, rep_id, status, valid_from, valid_to, total_value, notes, created_at, updated_at)
  VALUES ('RC-2026-001', apollo_id, rep1_id, 'APPROVED', '2026-04-01', '2026-06-30', 485000, 'Quarterly contract for cardio + neuro lines.', now() - interval '30 days', now() - interval '10 days')
  RETURNING id INTO rc1_id;

  INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
  VALUES
    (rc1_id, 'Atorvastatin 20mg', cardio_id, 95,  1000, 1200, 640),
    (rc1_id, 'Metoprolol 50mg',   cardio_id, 48,  800,  1000, 312),
    (rc1_id, 'Amlodipine 5mg',    cardio_id, 62,  600,  800,  190),
    (rc1_id, 'Levodopa 250mg',    neuro_id,  320, 500,  600,  220),
    (rc1_id, 'Clonazepam 0.5mg',  neuro_id,  85,  400,  500,  180);

  INSERT INTO rate_contract_approvals (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (rc1_id, 'division', cardio_id, div_approver_cardio_id,
      COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Cardio Approver'),
      1, 'approved', now() - interval '18 days'),
    (rc1_id, 'division', neuro_id, NULL, 'Neuro Approver', 1, 'approved', now() - interval '17 days'),
    (rc1_id, 'final', NULL, final_approver1_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
      1, 'approved', now() - interval '12 days'),
    (rc1_id, 'final', NULL, final_approver2_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
      2, 'approved', now() - interval '10 days');

  INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (rc1_id, 'Vikram Desai', 'Admin', 'Rate contract RC-2026-001 created for Apollo Hospital.', 'created', now() - interval '30 days'),
    (rc1_id, COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Cardio Approver'), 'Division Approver', 'Cardio division approved RC items.', 'division_approved', now() - interval '18 days'),
    (rc1_id, 'Neuro Approver', 'Division Approver', 'Neurology division approved RC items.', 'division_approved', now() - interval '17 days'),
    (rc1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'Final approval cleared (Approver 1).', 'final_approved', now() - interval '12 days'),
    (rc1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'Final approval cleared (Approver 2). RC is now APPROVED.', 'final_approved', now() - interval '10 days');

  -- ─── RC-2026-002: PENDING, AIIMS, awaiting division approval ──────────────
  INSERT INTO rate_contracts (rc_code, hospital_id, rep_id, status, valid_from, valid_to, total_value, notes, created_at, updated_at)
  VALUES ('RC-2026-002', aiims_id, rep1_id, 'PENDING', '2026-05-01', '2026-07-31', 310000, 'Diabetology product line rate contract.', now() - interval '8 days', now() - interval '2 days')
  RETURNING id INTO rc2_id;

  INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
  VALUES
    (rc2_id, 'Metformin 500mg',      diab_id, 28,  2000, 2500, 0),
    (rc2_id, 'Insulin Glargine 3ml', diab_id, 890, 300,  400,  0),
    (rc2_id, 'Glimepiride 2mg',      diab_id, 45,  1500, 2000, 0);

  INSERT INTO rate_contract_approvals (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (rc2_id, 'division', diab_id, div_approver_diab_id,
      COALESCE((SELECT name FROM app_users WHERE id = div_approver_diab_id), 'Diabetology Approver'),
      1, 'pending'),
    (rc2_id, 'final', NULL, final_approver1_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
      1, 'pending'),
    (rc2_id, 'final', NULL, final_approver2_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
      2, 'pending');

  INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (rc2_id, 'Ramesh CFA', 'CFA', 'Rate contract RC-2026-002 submitted for approval.', 'created', now() - interval '8 days');

  -- ─── RC-2026-003: REJECTED, Fortis ────────────────────────────────────────
  INSERT INTO rate_contracts (rc_code, hospital_id, rep_id, status, valid_from, valid_to, total_value, notes, created_at, updated_at)
  VALUES ('RC-2026-003', fortis_id, rep1_id, 'REJECTED', '2026-04-01', '2026-06-30', 220000, 'Oncology line contract — rejected due to pricing mismatch.', now() - interval '20 days', now() - interval '15 days')
  RETURNING id INTO rc3_id;

  INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
  VALUES
    (rc3_id, 'Imatinib 400mg',    onco_id, 4200, 100, 120, 0),
    (rc3_id, 'Capecitabine 500mg', onco_id, 580,  200, 250, 0);

  INSERT INTO rate_contract_approvals (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at)
  VALUES
    (rc3_id, 'division', onco_id, NULL, 'Oncology Approver', 1, 'rejected',
      'Imatinib price is 15% above market rate. Requires renegotiation.', now() - interval '15 days');

  INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (rc3_id, 'Vikram Desai', 'Admin', 'Rate contract RC-2026-003 submitted.', 'created', now() - interval '20 days'),
    (rc3_id, 'Oncology Approver', 'Division Approver', 'Rejected: Imatinib price above market rate.', 'division_rejected', now() - interval '15 days');

  -- ─── Orders created from APPROVED RC-2026-001 only ────────────────────────
  -- RC orders are order-level only: pricing_mode is RC and all line items inherit RC pricing.

  INSERT INTO orders (
    order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at,
    total_value, manager_name, manager_approved_at, notes,
    rc_id, pricing_mode, created_at, updated_at
  )
  VALUES (
    'ORD-2026-50001', apollo_id, abc_id, rep1_id, cfa_user_id,
    'completed', 'synced', 'ERP-RC-50001', now() - interval '9 days',
    34200, 'Neeraj Sharma', now() - interval '10 days',
    'Created against approved rate contract RC-2026-001 for Apollo Hospital.',
    rc1_id, 'RC', now() - interval '11 days', now() - interval '8 days'
  )
  RETURNING id INTO rc_order_1_id;

  INSERT INTO order_items (
    order_id, product_name, division_id, quantity, unit_price,
    final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
  )
  VALUES
    (
      rc_order_1_id, 'Atorvastatin 20mg', cardio_id, 200, 95,
      200, 95, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Atorvastatin 20mg' LIMIT 1),
      'RC', true
    ),
    (
      rc_order_1_id, 'Metoprolol 50mg', cardio_id, 150, 48,
      150, 48, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Metoprolol 50mg' LIMIT 1),
      'RC', true
    ),
    (
      rc_order_1_id, 'Levodopa 250mg', neuro_id, 25, 320,
      25, 320, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Levodopa 250mg' LIMIT 1),
      'RC', true
    );

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (rc_order_1_id, cardio_id, div_approver_cardio_id, 'approved', now() - interval '9 days'),
    (rc_order_1_id, neuro_id, NULL, 'approved', now() - interval '9 days');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (
      rc_order_1_id, final_approver1_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
      1, 'approved', now() - interval '8 days'
    ),
    (
      rc_order_1_id, final_approver2_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
      2, 'approved', now() - interval '8 days'
    );

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (rc_order_1_id, 'Priya Singh', 'Field Rep', 'RC-backed order created from RC-2026-001.', 'created', now() - interval '11 days'),
    (rc_order_1_id, 'Neeraj Sharma', 'Manager', 'Manager approved Apollo RC order.', 'approved', now() - interval '10 days'),
    (rc_order_1_id, 'Ramesh CFA', 'CFA', 'ERP synced for RC order. ERP ID: ERP-RC-50001.', 'erp_synced', now() - interval '9 days'),
    (rc_order_1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'RC-backed Apollo order completed.', 'final_approved', now() - interval '8 days');

  INSERT INTO orders (
    order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, erp_order_id, erp_synced_at,
    total_value, manager_name, manager_approved_at, notes,
    rc_id, pricing_mode, created_at, updated_at
  )
  VALUES (
    'ORD-2026-50002', apollo_id, abc_id, rep1_id, cfa_user_id,
    'final_approval_pending', 'synced', 'ERP-RC-50002', now() - interval '2 days',
    16050, 'Neeraj Sharma', now() - interval '3 days',
    'Active RC-backed order awaiting final approval under RC-2026-001.',
    rc1_id, 'RC', now() - interval '4 days', now() - interval '12 hours'
  )
  RETURNING id INTO rc_order_2_id;

  INSERT INTO order_items (
    order_id, product_name, division_id, quantity, unit_price,
    final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
  )
  VALUES
    (
      rc_order_2_id, 'Amlodipine 5mg', cardio_id, 100, 62,
      100, 62, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Amlodipine 5mg' LIMIT 1),
      'RC', true
    ),
    (
      rc_order_2_id, 'Clonazepam 0.5mg', neuro_id, 60, 85,
      60, 85, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Clonazepam 0.5mg' LIMIT 1),
      'RC', true
    ),
    (
      rc_order_2_id, 'Atorvastatin 20mg', cardio_id, 50, 95,
      50, 95, 'approved',
      (SELECT id FROM rate_contract_items WHERE rc_id = rc1_id AND product_name = 'Atorvastatin 20mg' LIMIT 1),
      'RC', true
    );

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (rc_order_2_id, cardio_id, div_approver_cardio_id, 'approved', now() - interval '2 days'),
    (rc_order_2_id, neuro_id, NULL, 'approved', now() - interval '2 days');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (
      rc_order_2_id, final_approver1_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
      1, 'approved', now() - interval '1 day'
    ),
    (
      rc_order_2_id, final_approver2_id,
      COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
      2, 'pending', null
    );

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
  VALUES
    (rc_order_2_id, 'Priya Singh', 'Field Rep', 'RC-backed order created from RC-2026-001.', 'created', now() - interval '4 days'),
    (rc_order_2_id, 'Neeraj Sharma', 'Manager', 'Manager approved Apollo RC order.', 'approved', now() - interval '3 days'),
    (rc_order_2_id, 'Ramesh CFA', 'CFA', 'ERP synced for RC order. ERP ID: ERP-RC-50002.', 'erp_synced', now() - interval '2 days'),
    (rc_order_2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'First final approval recorded for RC-backed order.', 'final_approved', now() - interval '1 day');

END $$;
