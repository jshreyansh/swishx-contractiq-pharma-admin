-- Expand demo RC approval queues and RC-backed order data

DO $$
DECLARE
  apollo_id uuid;
  aiims_id uuid;
  fortis_id uuid;
  manipal_id uuid;
  kokilaben_id uuid;
  max_id uuid;
  narayana_id uuid;

  abc_id uuid;
  apex_id uuid;
  karnataka_id uuid;
  national_id uuid;
  premier_id uuid;

  priya_rep_id uuid;
  rahul_rep_id uuid;
  suresh_rep_id uuid;
  meena_rep_id uuid;
  kavita_rep_id uuid;
  arun_rep_id uuid;

  ramesh_id uuid;
  sunita_id uuid;

  cardio_id uuid;
  diab_id uuid;
  neuro_id uuid;
  onco_id uuid;
  resp_id uuid;

  approver_cardio_id uuid;
  approver_diab_id uuid;
  approver_neuro_id uuid;
  approver_onco_id uuid;
  approver_resp_id uuid;
  final_approver1_id uuid;
  final_approver2_id uuid;

  rc6_id uuid;
  rc7_id uuid;
  rc8_id uuid;
  rc9_id uuid;
  rc10_id uuid;

  rc_order_10_id uuid;
  rc_order_11_id uuid;
  rc_order_12_id uuid;
BEGIN
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;
  SELECT id INTO aiims_id FROM hospitals WHERE name ILIKE '%AIIMS%' LIMIT 1;
  SELECT id INTO fortis_id FROM hospitals WHERE name ILIKE '%Fortis%' LIMIT 1;
  SELECT id INTO manipal_id FROM hospitals WHERE name ILIKE '%Manipal%' LIMIT 1;
  SELECT id INTO kokilaben_id FROM hospitals WHERE name ILIKE '%Kokilaben%' LIMIT 1;
  SELECT id INTO max_id FROM hospitals WHERE name ILIKE '%Max Super%' LIMIT 1;
  SELECT id INTO narayana_id FROM hospitals WHERE name ILIKE '%Narayana%' LIMIT 1;

  SELECT id INTO abc_id FROM stockists WHERE name ILIKE '%ABC Pharma%' LIMIT 1;
  SELECT id INTO apex_id FROM stockists WHERE name ILIKE '%Apex Medical%' LIMIT 1;
  SELECT id INTO karnataka_id FROM stockists WHERE name ILIKE '%Karnataka Medical%' LIMIT 1;
  SELECT id INTO national_id FROM stockists WHERE name ILIKE '%National Drug%' LIMIT 1;
  SELECT id INTO premier_id FROM stockists WHERE name ILIKE '%Premier Pharma%' LIMIT 1;

  SELECT id INTO priya_rep_id FROM field_reps WHERE name = 'Priya Singh' LIMIT 1;
  SELECT id INTO rahul_rep_id FROM field_reps WHERE name = 'Rahul Sharma' LIMIT 1;
  SELECT id INTO suresh_rep_id FROM field_reps WHERE name = 'Suresh Nair' LIMIT 1;
  SELECT id INTO meena_rep_id FROM field_reps WHERE name = 'Meena Iyer' LIMIT 1;
  SELECT id INTO kavita_rep_id FROM field_reps WHERE name = 'Kavita Reddy' LIMIT 1;
  SELECT id INTO arun_rep_id FROM field_reps WHERE name = 'Arun Desai' LIMIT 1;

  SELECT id INTO ramesh_id FROM app_users WHERE email = 'ramesh.cfa@swishx.com' LIMIT 1;
  SELECT id INTO sunita_id FROM app_users WHERE email = 'sunita.cfa@swishx.com' LIMIT 1;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO diab_id FROM divisions WHERE code = 'DIAB' LIMIT 1;
  SELECT id INTO neuro_id FROM divisions WHERE code = 'NEURO' LIMIT 1;
  SELECT id INTO onco_id FROM divisions WHERE code = 'ONCO' LIMIT 1;
  SELECT id INTO resp_id FROM divisions WHERE code = 'RESP' LIMIT 1;

  SELECT id INTO approver_cardio_id FROM app_users WHERE email = 'anand.mehta@swishx.com' LIMIT 1;
  SELECT id INTO approver_diab_id FROM app_users WHERE email = 'priya.nair.div@swishx.com' LIMIT 1;
  SELECT id INTO approver_neuro_id FROM app_users WHERE email = 'suresh.iyer.div@swishx.com' LIMIT 1;
  SELECT id INTO approver_onco_id FROM app_users WHERE email = 'kavita.sharma.div@swishx.com' LIMIT 1;
  SELECT id INTO approver_resp_id FROM app_users WHERE email = 'meena.pillai.div@swishx.com' LIMIT 1;
  SELECT id INTO final_approver1_id FROM app_users WHERE email = 'arvind.kapoor@swishx.com' LIMIT 1;
  SELECT id INTO final_approver2_id FROM app_users WHERE email = 'meera.joshi@swishx.com' LIMIT 1;

  -- RC-2026-006: multi-division contract pending at division stage
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-006') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-006', max_id, rahul_rep_id, 'PENDING', '2026-04-21', '2026-08-15',
      733550,
      'Max multi-speciality renewal for cardio and respiratory lines. Awaiting both divisions.',
      now() - interval '4 days',
      now() - interval '90 minutes'
    )
    RETURNING id INTO rc6_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc6_id, 'Amlodipine 10mg', cardio_id, 112, 1300, 1600, 0),
      (rc6_id, 'Atorvastatin 40mg', cardio_id, 138, 900, 1200, 0),
      (rc6_id, 'Clopidogrel 75mg', cardio_id, 205, 750, 900, 0),
      (rc6_id, 'Salbutamol 100mcg Inhaler', resp_id, 305, 320, 400, 0),
      (rc6_id, 'Budesonide 400mcg Inhaler', resp_id, 655, 240, 300, 0),
      (rc6_id, 'Montelukast 10mg', resp_id, 92, 600, 750, 0);

    INSERT INTO rate_contract_approvals (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status)
    VALUES
      (rc6_id, 'division', cardio_id, approver_cardio_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 1, 'pending'),
      (rc6_id, 'division', resp_id, approver_resp_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 2, 'pending'),
      (rc6_id, 'final', NULL, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'pending'),
      (rc6_id, 'final', NULL, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending');

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc6_id, 'Sunita CFA', 'CFA', 'Rate contract RC-2026-006 submitted for Cardiology and Respiratory review.', 'created', now() - interval '4 days');
  END IF;

  -- RC-2026-007: more pending division data with diabetology and oncology items
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-007') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-007', fortis_id, meena_rep_id, 'PENDING', '2026-04-22', '2026-08-31',
      1209400,
      'Fortis diabetology and oncology package under pricing review.',
      now() - interval '3 days',
      now() - interval '75 minutes'
    )
    RETURNING id INTO rc7_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc7_id, 'Metformin 500mg', diab_id, 27, 2500, 3000, 0),
      (rc7_id, 'Insulin Glargine 100IU/mL', diab_id, 875, 420, 500, 0),
      (rc7_id, 'Empagliflozin 10mg', diab_id, 810, 240, 320, 0),
      (rc7_id, 'Paclitaxel 300mg Vial', onco_id, 17500, 18, 24, 0),
      (rc7_id, 'Bevacizumab 400mg', onco_id, 26500, 10, 14, 0);

    INSERT INTO rate_contract_approvals (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status)
    VALUES
      (rc7_id, 'division', diab_id, approver_diab_id, COALESCE((SELECT name FROM app_users WHERE id = approver_diab_id), 'Diabetology Approver'), 1, 'pending'),
      (rc7_id, 'division', onco_id, approver_onco_id, COALESCE((SELECT name FROM app_users WHERE id = approver_onco_id), 'Oncology Approver'), 2, 'pending'),
      (rc7_id, 'final', NULL, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'pending'),
      (rc7_id, 'final', NULL, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending');

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc7_id, 'Ramesh CFA', 'CFA', 'Rate contract RC-2026-007 submitted for DIAB and ONCO commercial approval.', 'created', now() - interval '3 days');
  END IF;

  -- RC-2026-008: final approval queue with all divisions already cleared
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-008') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-008', manipal_id, suresh_rep_id, 'PENDING', '2026-04-18', '2026-09-15',
      579560,
      'Manipal cross-speciality proposal. Divisions cleared, awaiting final approvers.',
      now() - interval '6 days',
      now() - interval '55 minutes'
    )
    RETURNING id INTO rc8_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc8_id, 'Atorvastatin 40mg', cardio_id, 136, 650, 800, 0),
      (rc8_id, 'Metoprolol 100mg XL', cardio_id, 178, 520, 700, 0),
      (rc8_id, 'Levetiracetam 500mg', neuro_id, 310, 380, 450, 0),
      (rc8_id, 'Donepezil 10mg', neuro_id, 430, 160, 220, 0),
      (rc8_id, 'Salbutamol 100mcg Inhaler', resp_id, 300, 280, 360, 0),
      (rc8_id, 'Budesonide 400mcg Inhaler', resp_id, 640, 200, 260, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at
    )
    VALUES
      (rc8_id, 'division', cardio_id, approver_cardio_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 1, 'approved', now() - interval '3 days'),
      (rc8_id, 'division', neuro_id, approver_neuro_id, COALESCE((SELECT name FROM app_users WHERE id = approver_neuro_id), 'Neurology Approver'), 2, 'approved', now() - interval '54 hours'),
      (rc8_id, 'division', resp_id, approver_resp_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 3, 'approved', now() - interval '40 hours'),
      (rc8_id, 'final', NULL, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'pending', NULL),
      (rc8_id, 'final', NULL, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending', NULL);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc8_id, 'Ramesh CFA', 'CFA', 'Rate contract RC-2026-008 created for Manipal Hospital.', 'created', now() - interval '6 days'),
      (rc8_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 'Division Approver', 'Cardiology division approved commercial terms.', 'division_approved', now() - interval '3 days'),
      (rc8_id, COALESCE((SELECT name FROM app_users WHERE id = approver_neuro_id), 'Neurology Approver'), 'Division Approver', 'Neurology division approved commercial terms.', 'division_approved', now() - interval '54 hours'),
      (rc8_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 'Division Approver', 'Respiratory division approved commercial terms.', 'division_approved', now() - interval '40 hours');
  END IF;

  -- RC-2026-009: final queue with one final approver already done
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-009') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-009', narayana_id, arun_rep_id, 'PENDING', '2026-04-19', '2026-09-30',
      952800,
      'Narayana commercial pack is through division review; one final approver has already signed off.',
      now() - interval '7 days',
      now() - interval '35 minutes'
    )
    RETURNING id INTO rc9_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc9_id, 'Amlodipine 10mg', cardio_id, 108, 1100, 1400, 0),
      (rc9_id, 'Clopidogrel 75mg', cardio_id, 198, 900, 1200, 0),
      (rc9_id, 'Metformin 500mg', diab_id, 26, 3200, 3800, 0),
      (rc9_id, 'Empagliflozin 10mg', diab_id, 790, 300, 380, 0),
      (rc9_id, 'Salbutamol 100mcg Inhaler', resp_id, 298, 350, 420, 0),
      (rc9_id, 'Montelukast 10mg', resp_id, 90, 750, 900, 0),
      (rc9_id, 'Budesonide 400mcg Inhaler', resp_id, 630, 260, 320, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at
    )
    VALUES
      (rc9_id, 'division', cardio_id, approver_cardio_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 1, 'approved', now() - interval '4 days'),
      (rc9_id, 'division', diab_id, approver_diab_id, COALESCE((SELECT name FROM app_users WHERE id = approver_diab_id), 'Diabetology Approver'), 2, 'approved', now() - interval '70 hours'),
      (rc9_id, 'division', resp_id, approver_resp_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 3, 'approved', now() - interval '52 hours'),
      (rc9_id, 'final', NULL, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '12 hours'),
      (rc9_id, 'final', NULL, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending', NULL);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc9_id, 'Sunita CFA', 'CFA', 'Rate contract RC-2026-009 submitted for approvals.', 'created', now() - interval '7 days'),
      (rc9_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 'Division Approver', 'Cardiology division approved commercial terms.', 'division_approved', now() - interval '4 days'),
      (rc9_id, COALESCE((SELECT name FROM app_users WHERE id = approver_diab_id), 'Diabetology Approver'), 'Division Approver', 'Diabetology division approved commercial terms.', 'division_approved', now() - interval '70 hours'),
      (rc9_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 'Division Approver', 'Respiratory division approved commercial terms.', 'division_approved', now() - interval '52 hours'),
      (rc9_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'First final approval recorded. Awaiting second sign-off.', 'final_approved', now() - interval '12 hours');
  END IF;

  -- RC-2026-010: approved contract with richer medicine mix for linked RC orders
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-010') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-010', apollo_id, priya_rep_id, 'APPROVED', '2026-04-01', '2026-09-30',
      1435720,
      'Approved Apollo umbrella contract spanning cardio, diabetes, and respiratory lines.',
      now() - interval '18 days',
      now() - interval '6 days'
    )
    RETURNING id INTO rc10_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc10_id, 'Amlodipine 10mg', cardio_id, 109, 1500, 1800, 320),
      (rc10_id, 'Atorvastatin 40mg', cardio_id, 137, 1100, 1400, 210),
      (rc10_id, 'Metformin 500mg', diab_id, 26, 3200, 3800, 1100),
      (rc10_id, 'Insulin Glargine 100IU/mL', diab_id, 880, 450, 550, 105),
      (rc10_id, 'Empagliflozin 10mg', diab_id, 798, 320, 420, 40),
      (rc10_id, 'Salbutamol 100mcg Inhaler', resp_id, 301, 420, 520, 130),
      (rc10_id, 'Budesonide 400mcg Inhaler', resp_id, 638, 280, 340, 35),
      (rc10_id, 'Montelukast 10mg', resp_id, 91, 900, 1100, 320);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at
    )
    VALUES
      (rc10_id, 'division', cardio_id, approver_cardio_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 1, 'approved', now() - interval '15 days'),
      (rc10_id, 'division', diab_id, approver_diab_id, COALESCE((SELECT name FROM app_users WHERE id = approver_diab_id), 'Diabetology Approver'), 2, 'approved', now() - interval '14 days'),
      (rc10_id, 'division', resp_id, approver_resp_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 3, 'approved', now() - interval '13 days'),
      (rc10_id, 'final', NULL, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '12 days'),
      (rc10_id, 'final', NULL, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'approved', now() - interval '11 days');

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc10_id, 'Vikram Desai', 'Admin', 'Rate contract RC-2026-010 created for Apollo Hospitals.', 'created', now() - interval '18 days'),
      (rc10_id, COALESCE((SELECT name FROM app_users WHERE id = approver_cardio_id), 'Cardiology Approver'), 'Division Approver', 'Cardiology division approved commercial terms.', 'division_approved', now() - interval '15 days'),
      (rc10_id, COALESCE((SELECT name FROM app_users WHERE id = approver_diab_id), 'Diabetology Approver'), 'Division Approver', 'Diabetology division approved commercial terms.', 'division_approved', now() - interval '14 days'),
      (rc10_id, COALESCE((SELECT name FROM app_users WHERE id = approver_resp_id), 'Respiratory Approver'), 'Division Approver', 'Respiratory division approved commercial terms.', 'division_approved', now() - interval '13 days'),
      (rc10_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'First final approval recorded for RC-2026-010.', 'final_approved', now() - interval '12 days'),
      (rc10_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'Second final approval recorded. RC-2026-010 is now APPROVED.', 'final_approved', now() - interval '11 days');
  END IF;

  SELECT id INTO rc10_id FROM rate_contracts WHERE rc_code = 'RC-2026-010' LIMIT 1;

  -- More RC-backed orders with a wider medicine mix
  IF rc10_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50010') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50010', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'division_processing', 'synced', 'ERP-RC-50010', now() - interval '7 hours',
      54550, 'Neeraj Sharma', now() - interval '9 hours',
      'RC-backed order under RC-2026-010 with cardio, diabetes, and respiratory items awaiting division review.',
      rc10_id, 'RC', now() - interval '10 hours', now() - interval '40 minutes'
    )
    RETURNING id INTO rc_order_10_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (rc_order_10_id, 'Amlodipine 10mg', cardio_id, 140, 109, 140, 109, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Amlodipine 10mg' LIMIT 1), 'RC', true),
      (rc_order_10_id, 'Atorvastatin 40mg', cardio_id, 120, 137, 120, 137, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Atorvastatin 40mg' LIMIT 1), 'RC', true),
      (rc_order_10_id, 'Metformin 500mg', diab_id, 300, 26, 300, 26, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Metformin 500mg' LIMIT 1), 'RC', true),
      (rc_order_10_id, 'Salbutamol 100mcg Inhaler', resp_id, 50, 301, 50, 301, 'pending', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Salbutamol 100mcg Inhaler' LIMIT 1), 'RC', true);

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
    VALUES
      (rc_order_10_id, cardio_id, approver_cardio_id, 'pending'),
      (rc_order_10_id, diab_id, approver_diab_id, 'pending'),
      (rc_order_10_id, resp_id, approver_resp_id, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_order_10_id, 'Priya Singh', 'Field Rep', 'RC-backed order created from RC-2026-010.', 'created', now() - interval '10 hours'),
      (rc_order_10_id, 'Neeraj Sharma', 'Manager', 'Manager approved RC-backed Apollo order.', 'approved', now() - interval '9 hours'),
      (rc_order_10_id, 'Ramesh CFA', 'CFA', 'ERP synced for RC order. ERP ID: ERP-RC-50010.', 'erp_synced', now() - interval '7 hours');
  END IF;

  IF rc10_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50011') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50011', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'final_approval_pending', 'synced', 'ERP-RC-50011', now() - interval '30 hours',
      135760, 'Neeraj Sharma', now() - interval '34 hours',
      'RC-backed order under RC-2026-010 with all divisions cleared and awaiting final approval.',
      rc10_id, 'RC', now() - interval '36 hours', now() - interval '5 hours'
    )
    RETURNING id INTO rc_order_11_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (rc_order_11_id, 'Insulin Glargine 100IU/mL', diab_id, 60, 880, 60, 880, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Insulin Glargine 100IU/mL' LIMIT 1), 'RC', true),
      (rc_order_11_id, 'Empagliflozin 10mg', diab_id, 40, 798, 40, 798, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Empagliflozin 10mg' LIMIT 1), 'RC', true),
      (rc_order_11_id, 'Budesonide 400mcg Inhaler', resp_id, 35, 638, 35, 638, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Budesonide 400mcg Inhaler' LIMIT 1), 'RC', true),
      (rc_order_11_id, 'Montelukast 10mg', resp_id, 180, 91, 180, 91, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Montelukast 10mg' LIMIT 1), 'RC', true),
      (rc_order_11_id, 'Atorvastatin 40mg', cardio_id, 90, 137, 90, 137, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Atorvastatin 40mg' LIMIT 1), 'RC', true);

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (rc_order_11_id, cardio_id, approver_cardio_id, 'approved', now() - interval '28 hours'),
      (rc_order_11_id, diab_id, approver_diab_id, 'approved', now() - interval '27 hours'),
      (rc_order_11_id, resp_id, approver_resp_id, 'approved', now() - interval '26 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (rc_order_11_id, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '10 hours'),
      (rc_order_11_id, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'pending', NULL);

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_order_11_id, 'Priya Singh', 'Field Rep', 'RC-backed order created from RC-2026-010.', 'created', now() - interval '36 hours'),
      (rc_order_11_id, 'Neeraj Sharma', 'Manager', 'Manager approved RC-backed Apollo order.', 'approved', now() - interval '34 hours'),
      (rc_order_11_id, 'Ramesh CFA', 'CFA', 'ERP synced for RC order. ERP ID: ERP-RC-50011.', 'erp_synced', now() - interval '30 hours'),
      (rc_order_11_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 'Final Approver', 'First final approval recorded for RC-backed Apollo order.', 'final_approved', now() - interval '10 hours');
  END IF;

  IF rc10_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-50012') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      total_value, manager_name, manager_approved_at, notes,
      rc_id, pricing_mode, created_at, updated_at
    )
    VALUES (
      'ORD-2026-50012', apollo_id, abc_id, priya_rep_id, sunita_id,
      'completed', 'synced', 'ERP-RC-50012', now() - interval '5 days',
      116840, 'Neeraj Sharma', now() - interval '6 days',
      'Completed RC-backed fulfillment order under RC-2026-010.',
      rc10_id, 'RC', now() - interval '7 days', now() - interval '3 days'
    )
    RETURNING id INTO rc_order_12_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status, rc_item_id, pricing_source, locked_price
    )
    VALUES
      (rc_order_12_id, 'Amlodipine 10mg', cardio_id, 180, 109, 180, 109, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Amlodipine 10mg' LIMIT 1), 'RC', true),
      (rc_order_12_id, 'Metformin 500mg', diab_id, 800, 26, 800, 26, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Metformin 500mg' LIMIT 1), 'RC', true),
      (rc_order_12_id, 'Insulin Glargine 100IU/mL', diab_id, 45, 880, 45, 880, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Insulin Glargine 100IU/mL' LIMIT 1), 'RC', true),
      (rc_order_12_id, 'Montelukast 10mg', resp_id, 140, 91, 140, 91, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Montelukast 10mg' LIMIT 1), 'RC', true),
      (rc_order_12_id, 'Salbutamol 100mcg Inhaler', resp_id, 80, 301, 80, 301, 'approved', (SELECT id FROM rate_contract_items WHERE rc_id = rc10_id AND product_name = 'Salbutamol 100mcg Inhaler' LIMIT 1), 'RC', true);

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (rc_order_12_id, cardio_id, approver_cardio_id, 'approved', now() - interval '6 days'),
      (rc_order_12_id, diab_id, approver_diab_id, 'approved', now() - interval '6 days'),
      (rc_order_12_id, resp_id, approver_resp_id, 'approved', now() - interval '6 days');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (rc_order_12_id, final_approver1_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'), 1, 'approved', now() - interval '5 days'),
      (rc_order_12_id, final_approver2_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 2, 'approved', now() - interval '5 days');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_order_12_id, 'Priya Singh', 'Field Rep', 'RC-backed order created from RC-2026-010.', 'created', now() - interval '7 days'),
      (rc_order_12_id, 'Neeraj Sharma', 'Manager', 'Manager approved RC-backed Apollo order.', 'approved', now() - interval '6 days'),
      (rc_order_12_id, 'Sunita CFA', 'CFA', 'ERP synced for RC order. ERP ID: ERP-RC-50012.', 'erp_synced', now() - interval '5 days'),
      (rc_order_12_id, COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'), 'Final Approver', 'RC-backed Apollo order completed.', 'final_approved', now() - interval '5 days');
  END IF;
END $$;
