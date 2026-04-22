/*
  # Seed more pending workflow data for Division, Final Approval, and CFA/CNF testing

  Adds a fresh batch of realistic demo data that stays actionable in the main inboxes:
  - CFA / CNF queue: more `pending_erp_entry` and `manager_approved` orders
  - Division workspace: more cardiology-led orders awaiting division review
  - Final approver queue: more orders awaiting Arvind Kapoor's decision
  - RC workflow: more RCs in division review and final approval

  The inserts are idempotent and only run when the target order / RC code is absent.
*/

DO $$
DECLARE
  -- Core users
  ramesh_id uuid := '79b67db3-32ca-4891-bafe-e1a304b03876';
  sunita_id uuid := 'c0b58925-c9da-4e5d-9d35-eb3f01bd06c3';
  arvind_id uuid := '12affc3c-8625-425b-9774-b4f18e6e220d';
  meera_id  uuid := 'd40b8969-9f73-434a-bb62-3fd86146e16c';

  -- Reference entities
  apollo_id     uuid := '57964b26-f50b-42b1-a7cb-a085a7705cb1';
  aiims_id      uuid := '8ee6b46a-b760-4fd3-ba3d-b32fcd85762c';
  fortis_id     uuid := '595bcb2b-243c-47ac-8650-44962d171562';
  manipal_id    uuid := '9bdad112-db06-4ae2-8a6a-89dd01086e8c';
  kokilaben_id  uuid := 'f124808d-dad4-4060-88d7-3abb93710bd4';
  max_id        uuid := '11f37aac-7dda-4970-9afd-c6cf95419012';
  narayana_id   uuid := 'f1712dc4-3077-429b-9eb5-099f7be04b71';

  abc_id        uuid := '610751d5-7ab5-4a76-84ed-d0728ec65cc9';
  apex_id       uuid := '5295fbf9-e54b-4e95-b451-94159662f720';
  karnat_id     uuid := 'a778c3de-a755-4ef5-a729-53b4949452da';
  national_id   uuid := '4e76a40a-46b8-4bdb-adf9-5c5c8ba8f8d3';
  premier_id    uuid := 'f8aa546b-4627-4671-83fb-271d32b2c5ff';

  priya_rep_id  uuid := '5f265ebb-9834-48fc-aa52-2c07e189020b';
  rahul_rep_id  uuid := '4a20bb3f-e44f-4fe1-8820-a58d2bdc778c';
  suresh_rep_id uuid := 'd91afbfc-b776-4fda-a9af-927dbc320b1a';
  meena_rep_id  uuid := 'f39737b5-7417-4a5e-a901-ae0a3d0653e0';
  kavita_rep_id uuid := 'f276d8f8-f203-45c7-a9c6-549350ad2a4c';
  arun_rep_id   uuid := 'b03b609e-3271-47f4-8733-2c7d1922f9bb';

  cardio_id uuid := '0cc63e35-4b67-4f37-bc88-ebaa9d499773';
  diab_id   uuid := '14d0886b-cde3-4f0d-880e-992dbc304757';
  neuro_id  uuid := '09209343-a409-4a48-b52c-2df1098921e7';
  onco_id   uuid := 'c23f5090-590b-45c2-be1f-550f030fcbf6';
  resp_id   uuid := 'fde74d51-d274-48b2-9e78-58d5ed9449ea';

  approver_cardio_id uuid;
  approver_diab_id   uuid;
  approver_neuro_id  uuid;
  approver_onco_id   uuid;
  approver_resp_id   uuid;

  entity_id uuid;
  rc_entity_id uuid;
BEGIN
  SELECT id INTO approver_cardio_id
  FROM app_users
  WHERE email = 'anand.mehta@swishx.com'
  LIMIT 1;

  IF approver_cardio_id IS NULL THEN
    SELECT id INTO approver_cardio_id
    FROM app_users
    WHERE role = 'division_approver' AND division_id = cardio_id AND status = 'active'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  SELECT id INTO approver_diab_id
  FROM app_users
  WHERE role = 'division_approver' AND division_id = diab_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO approver_neuro_id
  FROM app_users
  WHERE role = 'division_approver' AND division_id = neuro_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO approver_onco_id
  FROM app_users
  WHERE role = 'division_approver' AND division_id = onco_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO approver_resp_id
  FROM app_users
  WHERE role = 'division_approver' AND division_id = resp_id AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF approver_cardio_id IS NULL OR approver_diab_id IS NULL OR approver_neuro_id IS NULL
     OR approver_onco_id IS NULL OR approver_resp_id IS NULL THEN
    RAISE EXCEPTION 'Required division approvers are missing; aborting pending workflow seed.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- CFA / CNF queue top-up
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91001') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91001', aiims_id, apex_id, rahul_rep_id, ramesh_id,
      'pending_erp_entry', 'pending_sync', 'Rajesh Kumar', now() - interval '5 hours',
      214800, 'AIIMS cardiac ICU replenishment waiting for ERP punching.',
      now() - interval '7 hours', now() - interval '5 hours'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 420, 145.00, 'pending'),
      (entity_id, 'Clopidogrel 75mg', cardio_id, 260, 210.00, 'pending'),
      (entity_id, 'Metoprolol 100mg XL', cardio_id, 190, 185.00, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Rahul Sharma', 'Field Rep', 'AIIMS cardiac ICU order created.', 'created', now() - interval '7 hours'),
      (entity_id, 'Rajesh Kumar', 'Manager', 'Manager cleared order for CFA ERP entry.', 'approved', now() - interval '5 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91002') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, manager_name, manager_approved_at, total_value, notes,
      sla_deadline, sla_breached, created_at, updated_at
    )
    VALUES (
      'ORD-2026-91002', fortis_id, national_id, meena_rep_id, ramesh_id,
      'manager_approved', 'pending_sync', 'Sunita Malhotra', now() - interval '90 minutes',
      173500, 'Fortis diabetes patient-support order queued for CFA pickup.',
      now() + interval '3 hours', false,
      now() - interval '3 hours', now() - interval '90 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
    VALUES
      (entity_id, 'Insulin Glargine 100IU/mL', diab_id, 72, 1200.00, 'pending'),
      (entity_id, 'Empagliflozin 10mg', diab_id, 85, 875.00, 'pending'),
      (entity_id, 'Metformin 500mg', diab_id, 450, 55.00, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Meena Iyer', 'Field Rep', 'Fortis diabetology bulk refill order created.', 'created', now() - interval '3 hours'),
      (entity_id, 'Sunita Malhotra', 'Manager', 'Order approved and waiting in CFA queue.', 'approved', now() - interval '90 minutes');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91003') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91003', manipal_id, karnat_id, suresh_rep_id, sunita_id,
      'pending_erp_entry', 'pending_sync', 'Vikram Bhat', now() - interval '4 hours',
      268200, 'Manipal neuro ward refill waiting for ERP entry.',
      now() - interval '6 hours', now() - interval '4 hours'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
    VALUES
      (entity_id, 'Levetiracetam 500mg', neuro_id, 210, 320.00, 'pending'),
      (entity_id, 'Donepezil 10mg', neuro_id, 140, 450.00, 'pending'),
      (entity_id, 'Carbidopa-Levodopa 25/250mg', neuro_id, 180, 280.00, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Suresh Nair', 'Field Rep', 'Manipal neuro order created.', 'created', now() - interval '6 hours'),
      (entity_id, 'Vikram Bhat', 'Manager', 'Manager approved for ERP processing.', 'approved', now() - interval '4 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91004') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, manager_name, manager_approved_at, total_value, notes,
      sla_deadline, sla_breached, created_at, updated_at
    )
    VALUES (
      'ORD-2026-91004', apollo_id, abc_id, priya_rep_id, sunita_id,
      'manager_approved', 'pending_sync', 'Neeraj Sharma', now() - interval '40 minutes',
      186900, 'Apollo cardio-diab mixed order newly released to CFA queue.',
      now() + interval '5 hours', false,
      now() - interval '2 hours', now() - interval '40 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 280, 145.00, 'pending'),
      (entity_id, 'Metoprolol 100mg XL', cardio_id, 160, 185.00, 'pending'),
      (entity_id, 'Insulin Glargine 100IU/mL', diab_id, 52, 1200.00, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Priya Singh', 'Field Rep', 'Apollo blended cardio-diabetes order created.', 'created', now() - interval '2 hours'),
      (entity_id, 'Neeraj Sharma', 'Manager', 'Approved and sent to Sunita CFA.', 'approved', now() - interval '40 minutes');
  END IF;

  -- ---------------------------------------------------------------------------
  -- Division workspace order top-up for the default cardiology approver
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91101') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91101', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'division_processing', 'synced', 'ERP-91101', now() - interval '9 hours',
      'Neeraj Sharma', now() - interval '11 hours', 129600,
      'Apollo cardiology starter pack waiting on division approval.',
      now() - interval '12 hours', now() - interval '70 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 240, 145.00, 240, 145.00, 'pending'),
      (entity_id, 'Amlodipine 10mg', cardio_id, 180, 110.00, 180, 110.00, 'pending'),
      (entity_id, 'Clopidogrel 75mg', cardio_id, 120, 210.00, 120, 210.00, 'pending');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
    VALUES (entity_id, cardio_id, approver_cardio_id, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Priya Singh', 'Field Rep', 'Apollo cardiology order created.', 'created', now() - interval '12 hours'),
      (entity_id, 'Neeraj Sharma', 'Manager', 'Manager approved Apollo cardiology order.', 'approved', now() - interval '11 hours'),
      (entity_id, 'Ramesh CFA', 'CFA', 'ERP synced. Routed to cardiology division review.', 'erp_synced', now() - interval '9 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91102') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91102', aiims_id, apex_id, rahul_rep_id, sunita_id,
      'division_partially_approved', 'synced', 'ERP-91102', now() - interval '14 hours',
      'Rajesh Kumar', now() - interval '16 hours', 241300,
      'AIIMS mixed cardio-diabetes order with diabetes cleared and cardiology still pending.',
      now() - interval '18 hours', now() - interval '55 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 300, 145.00, 300, 145.00, 'pending'),
      (entity_id, 'Metoprolol 100mg XL', cardio_id, 180, 185.00, 180, 185.00, 'pending'),
      (entity_id, 'Insulin Glargine 100IU/mL', diab_id, 70, 1200.00, 70, 1200.00, 'approved'),
      (entity_id, 'Metformin 500mg', diab_id, 420, 55.00, 420, 55.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'pending', NULL),
      (entity_id, diab_id, approver_diab_id, 'approved', now() - interval '10 hours');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Rahul Sharma', 'Field Rep', 'AIIMS cardio-diabetes order created.', 'created', now() - interval '18 hours'),
      (entity_id, 'Rajesh Kumar', 'Manager', 'Manager approved AIIMS mixed order.', 'approved', now() - interval '16 hours'),
      (entity_id, 'Sunita CFA', 'CFA', 'ERP synced and shared with division reviewers.', 'erp_synced', now() - interval '14 hours'),
      (entity_id, 'Diabetes Approver', 'Division Approver', 'Diabetes lines approved; cardiology still pending.', 'division_approved', now() - interval '10 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91103') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91103', fortis_id, national_id, meena_rep_id, ramesh_id,
      'division_processing', 'synced', 'ERP-91103', now() - interval '8 hours',
      'Sunita Malhotra', now() - interval '10 hours', 206400,
      'Fortis pulmonary-cardiac bridge order waiting on division reviewers.',
      now() - interval '11 hours', now() - interval '45 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 220, 145.00, 220, 145.00, 'pending'),
      (entity_id, 'Clopidogrel 75mg', cardio_id, 140, 210.00, 140, 210.00, 'pending'),
      (entity_id, 'Salbutamol 100mcg Inhaler', resp_id, 110, 320.00, 110, 320.00, 'pending'),
      (entity_id, 'Budesonide 400mcg Inhaler', resp_id, 90, 680.00, 90, 680.00, 'pending');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'pending'),
      (entity_id, resp_id, approver_resp_id, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Meena Iyer', 'Field Rep', 'Fortis pulmonary-cardiac refill order created.', 'created', now() - interval '11 hours'),
      (entity_id, 'Sunita Malhotra', 'Manager', 'Manager approved Fortis mixed order.', 'approved', now() - interval '10 hours'),
      (entity_id, 'Ramesh CFA', 'CFA', 'ERP synced and moved to division queue.', 'erp_synced', now() - interval '8 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91104') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      sla_deadline, sla_breached, created_at, updated_at
    )
    VALUES (
      'ORD-2026-91104', narayana_id, karnat_id, suresh_rep_id, sunita_id,
      'division_processing', 'synced', 'ERP-91104', now() - interval '6 hours',
      'Vikram Bhat', now() - interval '7 hours', 188400,
      'Narayana cardio-neuro refill nearing SLA for division action.',
      now() + interval '2 hours', false,
      now() - interval '8 hours', now() - interval '35 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 260, 145.00, 260, 145.00, 'pending'),
      (entity_id, 'Metoprolol 100mg XL', cardio_id, 150, 185.00, 150, 185.00, 'pending'),
      (entity_id, 'Levetiracetam 500mg', neuro_id, 120, 320.00, 120, 320.00, 'pending');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'pending'),
      (entity_id, neuro_id, approver_neuro_id, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Suresh Nair', 'Field Rep', 'Narayana cardio-neuro order created.', 'created', now() - interval '8 hours'),
      (entity_id, 'Vikram Bhat', 'Manager', 'Manager approved Narayana blended order.', 'approved', now() - interval '7 hours'),
      (entity_id, 'Sunita CFA', 'CFA', 'ERP completed; waiting on divisions.', 'erp_synced', now() - interval '6 hours');
  END IF;

  -- ---------------------------------------------------------------------------
  -- Final approver order top-up for Arvind Kapoor
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91201') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91201', apollo_id, abc_id, priya_rep_id, ramesh_id,
      'final_approval_pending', 'synced', 'ERP-91201', now() - interval '28 hours',
      'Neeraj Sharma', now() - interval '31 hours', 164200,
      'Apollo cardio-respiratory order cleared by divisions and waiting on final approval.',
      now() - interval '33 hours', now() - interval '3 hours'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 260, 145.00, 260, 145.00, 'approved'),
      (entity_id, 'Clopidogrel 75mg', cardio_id, 150, 210.00, 150, 210.00, 'approved'),
      (entity_id, 'Salbutamol 100mcg Inhaler', resp_id, 80, 320.00, 80, 320.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'approved', now() - interval '22 hours'),
      (entity_id, resp_id, approver_resp_id, 'approved', now() - interval '21 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (entity_id, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL),
      (entity_id, meera_id,  'Meera Joshi',   2, 'approved', now() - interval '5 hours');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Priya Singh', 'Field Rep', 'Apollo cardio-respiratory order created.', 'created', now() - interval '33 hours'),
      (entity_id, 'Neeraj Sharma', 'Manager', 'Manager approved Apollo blended order.', 'approved', now() - interval '31 hours'),
      (entity_id, 'Ramesh CFA', 'CFA', 'ERP synced and sent for division review.', 'erp_synced', now() - interval '28 hours'),
      (entity_id, 'Division Review Board', 'Division Approver', 'All division approvals completed.', 'division_approved', now() - interval '21 hours'),
      (entity_id, 'Meera Joshi', 'Final Approver', 'Second final approver already cleared; Arvind decision will complete this order.', 'final_approved', now() - interval '5 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91202') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91202', aiims_id, apex_id, rahul_rep_id, sunita_id,
      'final_approval_pending', 'synced', 'ERP-91202', now() - interval '19 hours',
      'Rajesh Kumar', now() - interval '22 hours', 219900,
      'AIIMS cardio-neuro order sitting with final approvers.',
      now() - interval '24 hours', now() - interval '2 hours'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 300, 145.00, 300, 145.00, 'approved'),
      (entity_id, 'Metoprolol 100mg XL', cardio_id, 200, 185.00, 200, 185.00, 'approved'),
      (entity_id, 'Levetiracetam 500mg', neuro_id, 130, 320.00, 130, 320.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'approved', now() - interval '16 hours'),
      (entity_id, neuro_id, approver_neuro_id, 'approved', now() - interval '15 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
    VALUES
      (entity_id, arvind_id, 'Arvind Kapoor', 1, 'pending'),
      (entity_id, meera_id,  'Meera Joshi',   2, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Rahul Sharma', 'Field Rep', 'AIIMS cardio-neuro order created.', 'created', now() - interval '24 hours'),
      (entity_id, 'Rajesh Kumar', 'Manager', 'Manager approved AIIMS mixed order.', 'approved', now() - interval '22 hours'),
      (entity_id, 'Sunita CFA', 'CFA', 'ERP synced and routed onward.', 'erp_synced', now() - interval '19 hours'),
      (entity_id, 'Division Review Board', 'Division Approver', 'All division approvals completed.', 'division_approved', now() - interval '15 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91203') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91203', fortis_id, national_id, meena_rep_id, ramesh_id,
      'final_approval_pending', 'synced', 'ERP-91203', now() - interval '17 hours',
      'Sunita Malhotra', now() - interval '20 hours', 141400,
      'Fortis diabetology commercial order waiting for final sign-off.',
      now() - interval '21 hours', now() - interval '90 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Insulin Glargine 100IU/mL', diab_id, 62, 1200.00, 62, 1200.00, 'approved'),
      (entity_id, 'Empagliflozin 10mg', diab_id, 55, 875.00, 55, 875.00, 'approved'),
      (entity_id, 'Metformin 500mg', diab_id, 360, 55.00, 360, 55.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, diab_id, approver_diab_id, 'approved', now() - interval '14 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
    VALUES
      (entity_id, arvind_id, 'Arvind Kapoor', 1, 'pending'),
      (entity_id, meera_id,  'Meera Joshi',   2, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Meena Iyer', 'Field Rep', 'Fortis diabetology order created.', 'created', now() - interval '21 hours'),
      (entity_id, 'Sunita Malhotra', 'Manager', 'Manager approved Fortis diabetology order.', 'approved', now() - interval '20 hours'),
      (entity_id, 'Ramesh CFA', 'CFA', 'ERP synced and queued for final approval.', 'erp_synced', now() - interval '17 hours'),
      (entity_id, 'Diabetes Approver', 'Division Approver', 'Division review complete.', 'division_approved', now() - interval '14 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91204') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91204', kokilaben_id, premier_id, kavita_rep_id, sunita_id,
      'final_approval_pending', 'synced', 'ERP-91204', now() - interval '30 hours',
      'Anand Krishnan', now() - interval '34 hours', 398000,
      'Kokilaben oncology-respiratory order where Arvind can close the loop.',
      now() - interval '36 hours', now() - interval '4 hours'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Trastuzumab 440mg', onco_id, 3, 62000.00, 3, 62000.00, 'approved'),
      (entity_id, 'Paclitaxel 300mg Vial', onco_id, 5, 18500.00, 5, 18500.00, 'approved'),
      (entity_id, 'Budesonide 400mcg Inhaler', resp_id, 90, 680.00, 90, 680.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, onco_id, approver_onco_id, 'approved', now() - interval '25 hours'),
      (entity_id, resp_id, approver_resp_id, 'approved', now() - interval '24 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
    VALUES
      (entity_id, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL),
      (entity_id, meera_id,  'Meera Joshi',   2, 'approved', now() - interval '8 hours');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Kavita Reddy', 'Field Rep', 'Kokilaben oncology-respiratory order created.', 'created', now() - interval '36 hours'),
      (entity_id, 'Anand Krishnan', 'Manager', 'Manager approved high-value Kokilaben order.', 'approved', now() - interval '34 hours'),
      (entity_id, 'Sunita CFA', 'CFA', 'ERP synced and sent to approvers.', 'erp_synced', now() - interval '30 hours'),
      (entity_id, 'Division Review Board', 'Division Approver', 'All division approvals completed.', 'division_approved', now() - interval '24 hours'),
      (entity_id, 'Meera Joshi', 'Final Approver', 'Second final approver already cleared.', 'final_approved', now() - interval '8 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = 'ORD-2026-91205') THEN
    INSERT INTO orders (
      order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
      stage, erp_status, erp_order_id, erp_synced_at,
      manager_name, manager_approved_at, total_value, notes,
      created_at, updated_at
    )
    VALUES (
      'ORD-2026-91205', narayana_id, karnat_id, arun_rep_id, ramesh_id,
      'final_approval_pending', 'synced', 'ERP-91205', now() - interval '12 hours',
      'Rajesh Kumar', now() - interval '15 hours', 153100,
      'Narayana cardiology order waiting in Arvind final queue.',
      now() - interval '16 hours', now() - interval '70 minutes'
    )
    RETURNING id INTO entity_id;

    INSERT INTO order_items (
      order_id, product_name, division_id, quantity, unit_price,
      final_quantity, final_price, status
    )
    VALUES
      (entity_id, 'Atorvastatin 40mg', cardio_id, 280, 145.00, 280, 145.00, 'approved'),
      (entity_id, 'Amlodipine 10mg', cardio_id, 210, 110.00, 210, 110.00, 'approved'),
      (entity_id, 'Clopidogrel 75mg', cardio_id, 140, 210.00, 140, 210.00, 'approved');

    INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
    VALUES
      (entity_id, cardio_id, approver_cardio_id, 'approved', now() - interval '9 hours');

    INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
    VALUES
      (entity_id, arvind_id, 'Arvind Kapoor', 1, 'pending'),
      (entity_id, meera_id,  'Meera Joshi',   2, 'pending');

    INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (entity_id, 'Arun Desai', 'Field Rep', 'Narayana cardiology restock order created.', 'created', now() - interval '16 hours'),
      (entity_id, 'Rajesh Kumar', 'Manager', 'Manager approved Narayana cardiology order.', 'approved', now() - interval '15 hours'),
      (entity_id, 'Ramesh CFA', 'CFA', 'ERP synced and advanced to final approvers.', 'erp_synced', now() - interval '12 hours'),
      (entity_id, 'Cardiology Approver', 'Division Approver', 'Cardiology review complete.', 'division_approved', now() - interval '9 hours');
  END IF;

  -- ---------------------------------------------------------------------------
  -- Division workspace RC top-up for the default cardiology approver
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-021') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-021', apollo_id, priya_rep_id, 'PENDING', 'division_review', 1,
      current_date + 5, current_date + 140, 246000,
      'Apollo cardiology renewal waiting on Anand''s commercial approval.',
      now() - interval '2 days', now() - interval '3 hours'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Atorvastatin 40mg', cardio_id, 136.00, 1200, 1500, 0),
      (rc_entity_id, 'Amlodipine 10mg', cardio_id, 104.00, 900, 1100, 0),
      (rc_entity_id, 'Clopidogrel 75mg', cardio_id, 198.00, 700, 900, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', cardio_id, approver_cardio_id, 'Dr. Anand Mehta', 1, 'pending', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'pending', 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Priya Singh', 'Field Rep', 'RC-2026-021 submitted for cardiology review.', 'created', now() - interval '2 days');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-022') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-022', aiims_id, rahul_rep_id, 'PENDING', 'division_review', 1,
      current_date + 3, current_date + 160, 318500,
      'AIIMS cardio-neuro agreement where cardiology is still awaiting action.',
      now() - interval '3 days', now() - interval '2 hours'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Atorvastatin 40mg', cardio_id, 134.00, 1300, 1550, 0),
      (rc_entity_id, 'Metoprolol 100mg XL', cardio_id, 176.00, 820, 980, 0),
      (rc_entity_id, 'Levetiracetam 500mg', neuro_id, 305.00, 540, 650, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', cardio_id, approver_cardio_id, 'Dr. Anand Mehta', 1, 'pending', NULL, 1),
      (rc_entity_id, 'division', neuro_id, approver_neuro_id, 'Dr. Suresh Iyer', 2, 'approved', now() - interval '18 hours', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL, 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'pending', NULL, 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Rahul Sharma', 'Field Rep', 'RC-2026-022 submitted for mixed division review.', 'created', now() - interval '3 days'),
      (rc_entity_id, 'Dr. Suresh Iyer', 'Division Approver', 'Neurology division approved its commercial lines.', 'division_approved', now() - interval '18 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-023') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-023', narayana_id, arun_rep_id, 'PENDING', 'division_review', 1,
      current_date + 7, current_date + 180, 287400,
      'Narayana cardio-respiratory annual commercial pack awaiting division sign-off.',
      now() - interval '36 hours', now() - interval '70 minutes'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Atorvastatin 40mg', cardio_id, 135.00, 980, 1200, 0),
      (rc_entity_id, 'Clopidogrel 75mg', cardio_id, 196.00, 640, 760, 0),
      (rc_entity_id, 'Budesonide 400mcg Inhaler', resp_id, 652.00, 240, 300, 0),
      (rc_entity_id, 'Montelukast 10mg', resp_id, 89.00, 720, 900, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', cardio_id, approver_cardio_id, 'Dr. Anand Mehta', 1, 'pending', 1),
      (rc_entity_id, 'division', resp_id, approver_resp_id, 'Dr. Meena Pillai', 2, 'pending', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'pending', 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Arun Desai', 'Field Rep', 'RC-2026-023 submitted for cardiology and respiratory review.', 'created', now() - interval '36 hours');
  END IF;

  -- ---------------------------------------------------------------------------
  -- Final approval RC top-up for Arvind Kapoor
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-024') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-024', fortis_id, meena_rep_id, 'PENDING', 'final_approval_pending', 1,
      current_date + 1, current_date + 180, 302800,
      'Fortis cardio-diabetes RC cleared by divisions and ready for Arvind approval.',
      now() - interval '5 days', now() - interval '4 hours'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Atorvastatin 40mg', cardio_id, 132.00, 1100, 1300, 0),
      (rc_entity_id, 'Metoprolol 100mg XL', cardio_id, 175.00, 720, 860, 0),
      (rc_entity_id, 'Insulin Glargine 100IU/mL', diab_id, 910.00, 330, 420, 0),
      (rc_entity_id, 'Empagliflozin 10mg', diab_id, 786.00, 260, 320, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', cardio_id, approver_cardio_id, 'Dr. Anand Mehta', 1, 'approved', now() - interval '3 days', 1),
      (rc_entity_id, 'division', diab_id, approver_diab_id, 'Dr. Priya Nair', 2, 'approved', now() - interval '66 hours', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL, 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'approved', now() - interval '7 hours', 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Meena Iyer', 'Field Rep', 'RC-2026-024 submitted for approval.', 'created', now() - interval '5 days'),
      (rc_entity_id, 'Division Review Board', 'Division Approver', 'All divisions approved commercial terms.', 'division_approved', now() - interval '66 hours'),
      (rc_entity_id, 'Meera Joshi', 'Final Approver', 'Second final approver already cleared pending Arvind sign-off.', 'final_approved', now() - interval '7 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-025') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-025', manipal_id, suresh_rep_id, 'PENDING', 'final_approval_pending', 1,
      current_date + 2, current_date + 200, 276900,
      'Manipal neuro-respiratory RC awaiting both final approvers.',
      now() - interval '4 days', now() - interval '2 hours'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Levetiracetam 500mg', neuro_id, 301.00, 600, 750, 0),
      (rc_entity_id, 'Donepezil 10mg', neuro_id, 420.00, 280, 340, 0),
      (rc_entity_id, 'Budesonide 400mcg Inhaler', resp_id, 640.00, 190, 240, 0),
      (rc_entity_id, 'Montelukast 10mg', resp_id, 88.00, 680, 820, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', neuro_id, approver_neuro_id, 'Dr. Suresh Iyer', 1, 'approved', now() - interval '3 days', 1),
      (rc_entity_id, 'division', resp_id, approver_resp_id, 'Dr. Meena Pillai', 2, 'approved', now() - interval '60 hours', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL, 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'pending', NULL, 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Suresh Nair', 'Field Rep', 'RC-2026-025 submitted for final approval readiness.', 'created', now() - interval '4 days'),
      (rc_entity_id, 'Division Review Board', 'Division Approver', 'Division review completed successfully.', 'division_approved', now() - interval '60 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-026') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-026', kokilaben_id, kavita_rep_id, 'PENDING', 'final_approval_pending', 1,
      current_date + 1, current_date + 150, 489500,
      'Kokilaben oncology-cardiology RC pending final commercial approval.',
      now() - interval '6 days', now() - interval '90 minutes'
    )
    RETURNING id INTO rc_entity_id;

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES
      (rc_entity_id, 'Trastuzumab 440mg', onco_id, 59800.00, 24, 30, 0),
      (rc_entity_id, 'Paclitaxel 300mg Vial', onco_id, 17850.00, 72, 90, 0),
      (rc_entity_id, 'Atorvastatin 40mg', cardio_id, 133.00, 640, 760, 0),
      (rc_entity_id, 'Clopidogrel 75mg', cardio_id, 194.00, 420, 520, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round
    )
    VALUES
      (rc_entity_id, 'division', onco_id, approver_onco_id, 'Dr. Kavita Sharma', 1, 'approved', now() - interval '4 days', 1),
      (rc_entity_id, 'division', cardio_id, approver_cardio_id, 'Dr. Anand Mehta', 2, 'approved', now() - interval '82 hours', 1),
      (rc_entity_id, 'final', NULL, arvind_id, 'Arvind Kapoor', 1, 'pending', NULL, 1),
      (rc_entity_id, 'final', NULL, meera_id,  'Meera Joshi',   2, 'pending', NULL, 1);

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc_entity_id, 'Kavita Reddy', 'Field Rep', 'RC-2026-026 submitted after division alignment.', 'created', now() - interval '6 days'),
      (rc_entity_id, 'Division Review Board', 'Division Approver', 'All division approvals completed.', 'division_approved', now() - interval '82 hours');
  END IF;
END $$;
