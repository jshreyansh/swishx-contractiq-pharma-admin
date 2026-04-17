/*
  # Seed Division Workspace Orders
  Creates orders in division_processing stage for division approvers to review and approve.
  These orders will appear in the "Need Action" tab of Division Workspace.
*/

DO $$
DECLARE
  ramesh_id  uuid := '79b67db3-32ca-4891-bafe-e1a304b03876';
  sunita_id  uuid := 'c0b58925-c9da-4e5d-9d35-eb3f01bd06c3';

  apollo_id  uuid := '57964b26-f50b-42b1-a7cb-a085a7705cb1';
  aiims_id   uuid := '8ee6b46a-b760-4fd3-ba3d-b32fcd85762c';
  fortis_id  uuid := '595bcb2b-243c-47ac-8650-44962d171562';
  manipal_id uuid := '9bdad112-db06-4ae2-8a6a-89dd01086e8c';
  kokilaben_id uuid := 'f124808d-dad4-4060-88d7-3abb93710bd4';
  max_id     uuid := '11f37aac-7dda-4970-9afd-c6cf95419012';

  abc_id     uuid := '610751d5-7ab5-4a76-84ed-d0728ec65cc9';
  apex_id    uuid := '5295fbf9-e54b-4e95-b451-94159662f720';
  karnat_id  uuid := 'a778c3de-a755-4ef5-a729-53b4949452da';
  national_id uuid := '4e76a40a-46b8-4bdb-adf9-5c5c8ba8f8d3';
  premier_id uuid := 'f8aa546b-4627-4671-83fb-271d32b2c5ff';

  priya_rep  uuid := '5f265ebb-9834-48fc-aa52-2c07e189020b';
  rahul_rep  uuid := '4a20bb3f-e44f-4fe1-8820-a58d2bdc778c';
  suresh_rep uuid := 'd91afbfc-b776-4fda-a9af-927dbc320b1a';
  meena_rep  uuid := 'f39737b5-7417-4a5e-a901-ae0a3d0653e0';
  kavita_rep uuid := 'f276d8f8-f203-45c7-a9c6-549350ad2a4c';
  arun_rep   uuid := 'b03b609e-3271-47f4-8733-2c7d1922f9bb';

  div_cardio uuid := '0cc63e35-4b67-4f37-bc88-ebaa9d499773';
  div_diab   uuid := '14d0886b-cde3-4f0d-880e-992dbc304757';
  div_neuro  uuid := '09209343-a409-4a48-b52c-2df1098921e7';
  div_onco   uuid := 'c23f5090-590b-45c2-be1f-550f030fcbf6';
  div_resp   uuid := 'fde74d51-d274-48b2-9e78-58d5ed9449ea';

  -- Division approver user IDs
  approver_cardio uuid := '71a044fa-d32e-442c-8550-721f00fa0139';
  approver_diab  uuid := '71a044fa-d32e-442c-8550-721f00fa0139';
  approver_neuro uuid := '803f697e-eeae-44f1-bb28-7718f766cf57';
  approver_onco uuid := '55323705-e0cf-461d-9212-90ae5d12471f';
  approver_resp uuid := '55b6cc2d-e0c5-4abb-b253-1614c089457c';

  d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid;
BEGIN

  -- Division Order 1 – Cardiology, pending approval (for Dr. Anand Mehta)
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-40001', aiims_id, apex_id, rahul_rep, ramesh_id,
    'division_processing', 'synced', 'Rajesh Kumar', now() - interval '10 hours',
    156800, 'AIIMS Cardiology – Acute cardiac care stock replenishment', 'ERP-224001', now() - interval '8 hours',
    now() - interval '12 hours', now() - interval '1 hour')
  RETURNING id INTO d1;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (d1, 'Atorvastatin 40mg',      div_cardio, 500, 145.00, 'pending'),
    (d1, 'Metoprolol 100mg XL',    div_cardio, 300, 185.00, 'pending'),
    (d1, 'Clopidogrel 75mg',     div_cardio, 250, 210.00, 'pending'),
    (d1, 'Amlodipine 10mg',     div_cardio, 200, 110.00, 'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES (d1, div_cardio, approver_cardio, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (d1, 'Rahul Sharma', 'Field Rep', 'Order created for AIIMS Cardiac', 'created'),
    (d1, 'Rajesh Kumar', 'Manager', 'Manager approved', 'approved'),
    (d1, 'Ramesh CFA', 'CFA', 'ERP entry done. ERP ID: ERP-224001', 'erp_synced'),
    (d1, 'CFA System', 'System', 'Moved to Division Workspace for CARDIO review', 'stage_changed');

  -- Division Order 2 – Diabetes, pending approval (for Dr. Priya Nair)
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-40002', fortis_id, national_id, meena_rep, sunita_id,
    'division_processing', 'synced', 'Sunita Malhotra', now() - interval '8 hours',
    224500, 'Fortis Diabetes Centre – Monthly diabetes protocol supplies', 'ERP-224002', now() - interval '6 hours',
    now() - interval '10 hours', now() - interval '45 minutes')
  RETURNING id INTO d2;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (d2, 'Insulin Glargine 100IU/mL', div_diab, 120, 1200.00, 'pending'),
    (d2, 'Metformin 500mg',           div_diab, 800, 55.00,   'pending'),
    (d2, 'Empagliflozin 10mg',      div_diab, 150, 875.00,  'pending'),
    (d2, 'Glimeperide 2mg',          div_diab, 100, 145.00,  'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES (d2, div_diab, approver_diab, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (d2, 'Meena Patel', 'Field Rep', 'Order raised for Fortis Diabetes Centre', 'created'),
    (d2, 'Sunita Malhotra', 'Manager', 'Manager approved', 'approved'),
    (d2, 'Sunita CFA', 'CFA', 'ERP punch complete. ERP ID: ERP-224002', 'erp_synced'),
    (d2, 'CFA System', 'System', 'Sent to Division Workspace for DIAB review', 'stage_changed');

  -- Division Order 3 – Neurology + Cardiology (multi-division), both pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-40003', manipal_id, karnat_id, suresh_rep, ramesh_id,
    'division_processing', 'synced', 'Harish Gowda', now() - interval '14 hours',
    287600, 'Manipal Neuro-Cardio combo order for new ward', 'ERP-224003', now() - interval '12 hours',
    now() - interval '18 hours', now() - interval '30 minutes')
  RETURNING id INTO d3;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (d3, 'Levetiracetam 500mg',     div_neuro, 200, 320.00,  'pending'),
    (d3, 'Donepezil 10mg',          div_neuro, 100, 450.00,  'pending'),
    (d3, 'Atorvastatin 40mg',       div_cardio, 400, 145.00,  'pending'),
    (d3, 'Metoprolol 100mg XL',     div_cardio, 250, 185.00,  'pending'),
    (d3, 'Clopidogrel 75mg',      div_cardio, 180, 210.00,  'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES
    (d3, div_neuro, approver_neuro, 'pending'),
    (d3, div_cardio, approver_cardio, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (d3, 'Suresh Reddy', 'Field Rep', 'Combo order for Manipal Neuro-Cardio ward', 'created'),
    (d3, 'Harish Gowda', 'Manager', 'Manager approved', 'approved'),
    (d3, 'Ramesh CFA', 'CFA', 'ERP done. ERP ID: ERP-224003', 'erp_synced'),
    (d3, 'CFA System', 'System', 'Sent to Division Workspace', 'stage_changed');

  -- Division Order 4 – Oncology (high value, urgent)
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at,
    sla_deadline, sla_breached, created_at, updated_at)
  VALUES ('ORD-2026-40004', kokilaben_id, premier_id, kavita_rep, sunita_id,
    'division_processing', 'synced', 'Vijay Patil', now() - interval '6 hours',
    412000, 'Kokilaben Oncology – Emergency chemo protocol', 'ERP-224004', now() - interval '4 hours',
    now() + interval '2 hours', false,
    now() - interval '8 hours', now() - interval '20 minutes')
  RETURNING id INTO d4;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (d4, 'Trastuzumab 440mg',    div_onco, 5, 62000.00, 'pending'),
    (d4, 'Bevacizumab 400mg',   div_onco, 4, 28000.00, 'pending'),
    (d4, 'Paclitaxel 300mg Vial', div_onco, 6, 18500.00, 'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES (d4, div_onco, approver_onco, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (d4, 'Kavita Bose', 'Field Rep', 'URGENT: Oncology emergency order', 'created'),
    (d4, 'Vijay Patil', 'Manager', 'Approved – URGENT', 'approved'),
    (d4, 'Sunita CFA', 'CFA', 'ERP entered. ERP ID: ERP-224004', 'erp_synced'),
    (d4, 'CFA System', 'System', 'Sent for ONCO division review', 'stage_changed');

  -- Division Order 5 – Respiratory
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-40005', apollo_id, abc_id, arun_rep, ramesh_id,
    'division_processing', 'synced', 'Rajesh Kumar', now() - interval '5 hours',
    98500, 'Apollo Chest Clinic – Respiratory quarterly stock', 'ERP-224005', now() - interval '3 hours',
    now() - interval '7 hours', now() - interval '15 minutes')
  RETURNING id INTO d5;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (d5, 'Salbutamol 100mcg Inhaler',  div_resp, 150, 320.00, 'pending'),
    (d5, 'Budesonide 400mcg Inhaler',  div_resp, 100, 680.00, 'pending'),
    (d5, 'Montelukast 10mg',           div_resp, 200, 95.00,  'pending');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status)
  VALUES (d5, div_resp, approver_resp, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (d5, 'Arun Desai', 'Field Rep', 'Apollo Chest quarterly restock', 'created'),
    (d5, 'Rajesh Kumar', 'Manager', 'Manager approved', 'approved'),
    (d5, 'Ramesh CFA', 'CFA', 'ERP complete. ERP ID: ERP-224005', 'erp_synced'),
    (d5, 'CFA System', 'System', 'Sent to Division Workspace for RESP review', 'stage_changed');

END $$;