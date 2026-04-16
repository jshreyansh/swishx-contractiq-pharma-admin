/*
  # Seed additional data for CFA and Final Approver processing

  ## Summary
  Adds more realistic demo data so both CFA users (Ramesh and Sunita) and
  both Final Approvers (Arvind Kapoor and Meera Joshi) have meaningful
  queues to process.

  ## Changes

  ### products
  - Adds 4 Cardiology products (CARDIO division)
  - Adds 3 Respiratory products (RESP division)

  ### orders
  - 6 new orders in pending_erp_entry / manager_approved stages (CFA queue)
  - 8 new orders in final_approval_pending stage (Final Approver queue)
  - Distributed between Ramesh CFA and Sunita CFA
  - final_approvals rows created for Arvind Kapoor and Meera Joshi on each
    final_approval_pending order — one approver already approved, one pending

  ### order_items, division_approvals, order_timeline
  - Supporting rows for every new order
*/

-- ============================================================
-- 1. FILL MISSING PRODUCTS
-- ============================================================

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Atorvastatin 40mg', 'SKU-ATOR-40', id, 145.00, 'Strip' FROM divisions WHERE code = 'CARDIO' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Amlodipine 10mg', 'SKU-AMLO-10', id, 110.00, 'Strip' FROM divisions WHERE code = 'CARDIO' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Metoprolol 100mg XL', 'SKU-METO-100', id, 185.00, 'Strip' FROM divisions WHERE code = 'CARDIO' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Clopidogrel 75mg', 'SKU-CLOP-75', id, 210.00, 'Strip' FROM divisions WHERE code = 'CARDIO' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Salbutamol 100mcg Inhaler', 'SKU-SALB-100', id, 320.00, 'Inhaler' FROM divisions WHERE code = 'RESP' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Budesonide 400mcg Inhaler', 'SKU-BUDE-400', id, 680.00, 'Inhaler' FROM divisions WHERE code = 'RESP' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (name, sku, division_id, unit_price, unit)
SELECT 'Montelukast 10mg', 'SKU-MONT-10', id, 95.00, 'Strip' FROM divisions WHERE code = 'RESP' LIMIT 1
ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- 2. CFA QUEUE ORDERS  (pending_erp_entry / manager_approved)
-- ============================================================

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

  div_cardio uuid := '0cc63e35-4b67-4f37-bc88-ebaa9d499773';
  div_diab   uuid := '14d0886b-cde3-4f0d-880e-992dbc304757';
  div_neuro  uuid := '09209343-a409-4a48-b52c-2df1098921e7';
  div_onco   uuid := 'c23f5090-590b-45c2-be1f-550f030fcbf6';
  div_resp   uuid := 'fde74d51-d274-48b2-9e78-58d5ed9449ea';

  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid;
BEGIN

  -- CFA Order 1 – Ramesh, pending_erp_entry
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    created_at, updated_at)
  VALUES ('ORD-2026-20001', aiims_id, national_id, rahul_rep, ramesh_id,
    'pending_erp_entry', 'pending_sync', 'Rajesh Kumar', now() - interval '3 hours',
    256500, 'Oncology + Neurology combo order from AIIMS ICU',
    now() - interval '5 hours', now() - interval '3 hours')
  RETURNING id INTO o1;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o1, 'Paclitaxel 300mg Vial',       div_onco,  6,  18500.00, 'pending'),
    (o1, 'Bevacizumab 400mg',           div_onco,  3,  28000.00, 'pending'),
    (o1, 'Levetiracetam 500mg',         div_neuro, 50, 320.00,   'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o1, 'Rahul Sharma', 'Field Rep', 'Order created and submitted', 'created'),
    (o1, 'Rajesh Kumar', 'Manager', 'Order approved. Sent to CFA for ERP entry.', 'approved');

  -- CFA Order 2 – Ramesh, pending_erp_entry, SLA near breach
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    sla_deadline, sla_breached, created_at, updated_at)
  VALUES ('ORD-2026-20002', fortis_id, apex_id, meena_rep, ramesh_id,
    'pending_erp_entry', 'pending_sync', 'Sunita Malhotra', now() - interval '6 hours',
    142000, 'Diabetes management supplies – urgent patient programme',
    now() + interval '1 hour', false,
    now() - interval '8 hours', now() - interval '6 hours')
  RETURNING id INTO o2;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o2, 'Insulin Glargine 100IU/mL', div_diab, 80,  1200.00, 'pending'),
    (o2, 'Metformin 500mg',           div_diab, 200, 55.00,   'pending'),
    (o2, 'Empagliflozin 10mg',        div_diab, 60,  875.00,  'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o2, 'Meena Patel', 'Field Rep', 'Order created for Fortis Diabetes Centre', 'created'),
    (o2, 'Sunita Malhotra', 'Manager', 'Approved – urgent patient programme order.', 'approved');

  -- CFA Order 3 – Ramesh, manager_approved (not yet picked up)
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    created_at, updated_at)
  VALUES ('ORD-2026-20003', kokilaben_id, premier_id, kavita_rep, ramesh_id,
    'manager_approved', 'pending_sync', 'Vijay Patil', now() - interval '1 hour',
    198500, 'Respiratory + Cardio bulk order',
    now() - interval '2 hours', now() - interval '1 hour')
  RETURNING id INTO o3;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o3, 'Salbutamol 100mcg Inhaler',   div_resp,   100, 320.00, 'pending'),
    (o3, 'Budesonide 400mcg Inhaler',   div_resp,   80,  680.00, 'pending'),
    (o3, 'Atorvastatin 40mg',           div_cardio, 200, 145.00, 'pending'),
    (o3, 'Clopidogrel 75mg',            div_cardio, 150, 210.00, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o3, 'Kavita Bose', 'Field Rep', 'Order submitted for Kokilaben', 'created'),
    (o3, 'Vijay Patil', 'Manager', 'Approved – Kokilaben quarterly stock.', 'approved');

  -- CFA Order 4 – Sunita, pending_erp_entry
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    created_at, updated_at)
  VALUES ('ORD-2026-20004', manipal_id, karnat_id, suresh_rep, sunita_id,
    'pending_erp_entry', 'pending_sync', 'Harish Gowda', now() - interval '4 hours',
    312000, 'Manipal Neuroscience Centre – Epilepsy protocol restock',
    now() - interval '6 hours', now() - interval '4 hours')
  RETURNING id INTO o4;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o4, 'Levetiracetam 500mg',         div_neuro, 150, 320.00, 'pending'),
    (o4, 'Donepezil 10mg',              div_neuro, 80,  450.00, 'pending'),
    (o4, 'Carbidopa-Levodopa 25/250mg', div_neuro, 120, 280.00, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o4, 'Suresh Reddy', 'Field Rep', 'Order raised for Manipal Neuroscience', 'created'),
    (o4, 'Harish Gowda', 'Manager', 'Approved. CFA to enter in ERP.', 'approved');

  -- CFA Order 5 – Sunita, pending_erp_entry, SLA breached
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    sla_deadline, sla_breached, created_at, updated_at)
  VALUES ('ORD-2026-20005', max_id, national_id, priya_rep, sunita_id,
    'pending_erp_entry', 'pending_sync', 'Neeraj Sharma', now() - interval '28 hours',
    87500, 'Max Oncology floor – Paclitaxel emergency top-up',
    now() - interval '2 hours', true,
    now() - interval '30 hours', now() - interval '28 hours')
  RETURNING id INTO o5;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o5, 'Paclitaxel 300mg Vial',  div_onco, 4, 18500.00, 'pending'),
    (o5, 'Trastuzumab 440mg',      div_onco, 1, 62000.00, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o5, 'Priya Singh', 'Field Rep', 'URGENT: Emergency oncology restock requested', 'created'),
    (o5, 'Neeraj Sharma', 'Manager', 'Approved – URGENT, SLA 24h.', 'approved');

  -- CFA Order 6 – Sunita, manager_approved
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes,
    created_at, updated_at)
  VALUES ('ORD-2026-20006', apollo_id, abc_id, rahul_rep, sunita_id,
    'manager_approved', 'pending_sync', 'Rajesh Kumar', now() - interval '30 minutes',
    176400, 'Apollo Cardiology dept – quarterly CARDIO+DIAB order',
    now() - interval '2 hours', now() - interval '30 minutes')
  RETURNING id INTO o6;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (o6, 'Atorvastatin 40mg',        div_cardio, 300, 145.00, 'pending'),
    (o6, 'Metoprolol 100mg XL',      div_cardio, 200, 185.00, 'pending'),
    (o6, 'Insulin Glargine 100IU/mL',div_diab,   60,  1200.00,'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (o6, 'Rahul Sharma', 'Field Rep', 'Apollo Cardiology quarterly order', 'created'),
    (o6, 'Rajesh Kumar', 'Manager', 'Approved – routine quarterly stock.', 'approved');

END $$;

-- ============================================================
-- 3. FINAL APPROVAL PENDING ORDERS
-- ============================================================

DO $$
DECLARE
  ramesh_id  uuid := '79b67db3-32ca-4891-bafe-e1a304b03876';
  sunita_id  uuid := 'c0b58925-c9da-4e5d-9d35-eb3f01bd06c3';
  arvind_id  uuid := '12affc3c-8625-425b-9774-b4f18e6e220d';
  meera_id   uuid := 'd40b8969-9f73-434a-bb62-3fd86146e16c';

  apollo_id  uuid := '57964b26-f50b-42b1-a7cb-a085a7705cb1';
  aiims_id   uuid := '8ee6b46a-b760-4fd3-ba3d-b32fcd85762c';
  fortis_id  uuid := '595bcb2b-243c-47ac-8650-44962d171562';
  manipal_id uuid := '9bdad112-db06-4ae2-8a6a-89dd01086e8c';
  kokilaben_id uuid := 'f124808d-dad4-4060-88d7-3abb93710bd4';
  max_id     uuid := '11f37aac-7dda-4970-9afd-c6cf95419012';
  narayana_id uuid := 'f1712dc4-3077-429b-9eb5-099f7be04b71';

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

  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid; f6 uuid; f7 uuid; f8 uuid;
BEGIN

  -- FA Order 1 – High value Oncology, Arvind approved, Meera pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30001', aiims_id, national_id, rahul_rep, ramesh_id,
    'final_approval_pending', 'synced', 'Rajesh Kumar', now() - interval '2 days',
    372500, 'AIIMS Oncology – High-value chemo restocking', 'ERP-221001', now() - interval '1 day',
    now() - interval '3 days', now() - interval '5 hours')
  RETURNING id INTO f1;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f1, 'Trastuzumab 440mg',  div_onco, 4,  62000.00, 'approved'),
    (f1, 'Bevacizumab 400mg',  div_onco, 3,  28000.00, 'approved'),
    (f1, 'Paclitaxel 300mg Vial', div_onco, 4, 18500.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES (f1, div_onco, '55323705-e0cf-461d-9212-90ae5d12471f', 'approved', now() - interval '1 day');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (f1, arvind_id, 'Arvind Kapoor', 1, 'approved', now() - interval '4 hours'),
    (f1, meera_id,  'Meera Joshi',   2, 'pending',  null);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f1, 'Dr. Priya Nair', 'Division Approver', 'Oncology division approved all items', 'division_approved'),
    (f1, 'Ramesh CFA', 'CFA', 'ERP entry completed. ERP ID: ERP-221001', 'erp_synced'),
    (f1, 'Arvind Kapoor', 'Final Approver', 'Reviewed and approved. High value justified by AIIMS protocol.', 'final_approved');

  -- FA Order 2 – Mixed divisions, both pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30002', fortis_id, apex_id, meena_rep, sunita_id,
    'final_approval_pending', 'synced', 'Sunita Malhotra', now() - interval '1 day',
    267500, 'Fortis multi-division quarterly order', 'ERP-221002', now() - interval '18 hours',
    now() - interval '2 days', now() - interval '3 hours')
  RETURNING id INTO f2;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f2, 'Levetiracetam 500mg',    div_neuro, 100, 320.00, 'approved'),
    (f2, 'Donepezil 10mg',         div_neuro, 60,  450.00, 'approved'),
    (f2, 'Insulin Glargine 100IU/mL', div_diab, 80, 1200.00, 'approved'),
    (f2, 'Empagliflozin 10mg',     div_diab,  50,  875.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (f2, div_neuro, '803f697e-eeae-44f1-bb28-7718f766cf57', 'approved', now() - interval '20 hours'),
    (f2, div_diab,  '71a044fa-d32e-442c-8550-721f00fa0139', 'approved', now() - interval '19 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (f2, arvind_id, 'Arvind Kapoor', 1, 'pending'),
    (f2, meera_id,  'Meera Joshi',   2, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f2, 'Dr. Anand Mehta', 'Division Approver', 'Neurology items approved', 'division_approved'),
    (f2, 'Dr. Kiran Rao', 'Division Approver', 'Diabetes items approved', 'division_approved'),
    (f2, 'Sunita CFA', 'CFA', 'ERP entry completed. ERP ID: ERP-221002', 'erp_synced');

  -- FA Order 3 – Respiratory, Meera approved, Arvind pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30003', kokilaben_id, premier_id, kavita_rep, ramesh_id,
    'final_approval_pending', 'synced', 'Vijay Patil', now() - interval '36 hours',
    134400, 'Kokilaben Pulmonology – RESP quarterly', 'ERP-221003', now() - interval '30 hours',
    now() - interval '4 days', now() - interval '2 hours')
  RETURNING id INTO f3;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f3, 'Salbutamol 100mcg Inhaler',  div_resp, 150, 320.00, 'approved'),
    (f3, 'Budesonide 400mcg Inhaler',  div_resp, 100, 680.00, 'approved'),
    (f3, 'Montelukast 10mg',           div_resp, 200, 95.00,  'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES (f3, div_resp, '55b6cc2d-e0c5-4abb-b253-1614c089457c', 'approved', now() - interval '28 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (f3, meera_id,  'Meera Joshi',   1, 'approved', now() - interval '6 hours'),
    (f3, arvind_id, 'Arvind Kapoor', 2, 'pending',  null);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f3, 'Dr. Suman Verma', 'Division Approver', 'RESP division approved', 'division_approved'),
    (f3, 'Ramesh CFA', 'CFA', 'ERP entry done. ERP ID: ERP-221003', 'erp_synced'),
    (f3, 'Meera Joshi', 'Final Approver', 'Approved – standard RESP stock within budget', 'final_approved');

  -- FA Order 4 – Cardiology, both pending, high priority
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at,
    sla_deadline, sla_breached, created_at, updated_at)
  VALUES ('ORD-2026-30004', manipal_id, karnat_id, suresh_rep, sunita_id,
    'final_approval_pending', 'synced', 'Harish Gowda', now() - interval '48 hours',
    189500, 'Manipal Cardiac ICU – Urgent CARDIO restock', 'ERP-221004', now() - interval '40 hours',
    now() - interval '2 hours', true,
    now() - interval '5 days', now() - interval '1 hour')
  RETURNING id INTO f4;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f4, 'Atorvastatin 40mg',     div_cardio, 400, 145.00, 'approved'),
    (f4, 'Metoprolol 100mg XL',   div_cardio, 300, 185.00, 'approved'),
    (f4, 'Clopidogrel 75mg',      div_cardio, 200, 210.00, 'approved'),
    (f4, 'Amlodipine 10mg',       div_cardio, 150, 110.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES (f4, div_cardio, '803f697e-eeae-44f1-bb28-7718f766cf57', 'approved', now() - interval '38 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (f4, arvind_id, 'Arvind Kapoor', 1, 'pending'),
    (f4, meera_id,  'Meera Joshi',   2, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f4, 'Dr. Anand Mehta', 'Division Approver', 'CARDIO approved – cardiac ICU priority', 'division_approved'),
    (f4, 'Sunita CFA', 'CFA', 'ERP punched. ERP ID: ERP-221004', 'erp_synced');

  -- FA Order 5 – Diabetes-heavy, Arvind approved, Meera pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30005', narayana_id, abc_id, priya_rep, ramesh_id,
    'final_approval_pending', 'synced', 'Rajesh Kumar', now() - interval '20 hours',
    198750, 'Narayana Diabetes Centre – monthly restock', 'ERP-221005', now() - interval '16 hours',
    now() - interval '3 days', now() - interval '4 hours')
  RETURNING id INTO f5;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f5, 'Insulin Glargine 100IU/mL', div_diab, 100, 1200.00, 'approved'),
    (f5, 'Metformin 500mg',           div_diab, 500, 55.00,   'approved'),
    (f5, 'Empagliflozin 10mg',        div_diab, 75,  875.00,  'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES (f5, div_diab, '71a044fa-d32e-442c-8550-721f00fa0139', 'approved', now() - interval '18 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (f5, arvind_id, 'Arvind Kapoor', 1, 'approved', now() - interval '8 hours'),
    (f5, meera_id,  'Meera Joshi',   2, 'pending',  null);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f5, 'Dr. Kiran Rao', 'Division Approver', 'DIAB items approved', 'division_approved'),
    (f5, 'Ramesh CFA', 'CFA', 'ERP entered. ERP ID: ERP-221005', 'erp_synced'),
    (f5, 'Arvind Kapoor', 'Final Approver', 'Approved. Standard diabetes monthly order.', 'final_approved');

  -- FA Order 6 – Multi-division, both pending, large order
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30006', max_id, national_id, arun_rep, sunita_id,
    'final_approval_pending', 'synced', 'Neeraj Sharma', now() - interval '16 hours',
    435000, 'Max Hospital annual bulk order – all divisions', 'ERP-221006', now() - interval '12 hours',
    now() - interval '4 days', now() - interval '2 hours')
  RETURNING id INTO f6;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f6, 'Trastuzumab 440mg',       div_onco,  4,  62000.00, 'approved'),
    (f6, 'Levetiracetam 500mg',     div_neuro, 80,  320.00,  'approved'),
    (f6, 'Atorvastatin 40mg',       div_cardio,250, 145.00,  'approved'),
    (f6, 'Insulin Glargine 100IU/mL',div_diab, 50,  1200.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (f6, div_onco,   '55323705-e0cf-461d-9212-90ae5d12471f', 'approved', now() - interval '14 hours'),
    (f6, div_neuro,  '803f697e-eeae-44f1-bb28-7718f766cf57', 'approved', now() - interval '13 hours'),
    (f6, div_cardio, '71a044fa-d32e-442c-8550-721f00fa0139', 'approved', now() - interval '13 hours'),
    (f6, div_diab,   '55b6cc2d-e0c5-4abb-b253-1614c089457c', 'approved', now() - interval '12 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (f6, arvind_id, 'Arvind Kapoor', 1, 'pending'),
    (f6, meera_id,  'Meera Joshi',   2, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f6, 'Dr. Priya Nair', 'Division Approver', 'ONCO approved', 'division_approved'),
    (f6, 'Dr. Anand Mehta', 'Division Approver', 'NEURO approved', 'division_approved'),
    (f6, 'Dr. Kiran Rao', 'Division Approver', 'CARDIO approved', 'division_approved'),
    (f6, 'Dr. Suman Verma', 'Division Approver', 'DIAB approved', 'division_approved'),
    (f6, 'Sunita CFA', 'CFA', 'ERP punched. ERP ID: ERP-221006', 'erp_synced');

  -- FA Order 7 – RESP only, Meera approved, Arvind pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30007', apollo_id, abc_id, kavita_rep, ramesh_id,
    'final_approval_pending', 'synced', 'Vijay Patil', now() - interval '12 hours',
    112500, 'Apollo Chest Clinic – RESP restocking', 'ERP-221007', now() - interval '10 hours',
    now() - interval '2 days', now() - interval '1 hour')
  RETURNING id INTO f7;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f7, 'Salbutamol 100mcg Inhaler', div_resp, 200, 320.00, 'approved'),
    (f7, 'Montelukast 10mg',          div_resp, 300, 95.00,  'approved'),
    (f7, 'Budesonide 400mcg Inhaler', div_resp, 50,  680.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES (f7, div_resp, '55b6cc2d-e0c5-4abb-b253-1614c089457c', 'approved', now() - interval '9 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status, decided_at)
  VALUES
    (f7, meera_id,  'Meera Joshi',   1, 'approved', now() - interval '3 hours'),
    (f7, arvind_id, 'Arvind Kapoor', 2, 'pending',  null);

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f7, 'Dr. Suman Verma', 'Division Approver', 'RESP approved', 'division_approved'),
    (f7, 'Ramesh CFA', 'CFA', 'ERP done. ERP ID: ERP-221007', 'erp_synced'),
    (f7, 'Meera Joshi', 'Final Approver', 'Approved – routine RESP clinic order.', 'final_approved');

  -- FA Order 8 – Neurology + Cardio, both approvers pending
  INSERT INTO orders (order_id, hospital_id, stockist_id, field_rep_id, cfa_user_id,
    stage, erp_status, manager_name, manager_approved_at, total_value, notes, erp_order_id, erp_synced_at, created_at, updated_at)
  VALUES ('ORD-2026-30008', aiims_id, national_id, suresh_rep, sunita_id,
    'final_approval_pending', 'synced', 'Harish Gowda', now() - interval '8 hours',
    322000, 'AIIMS Neurology + Cardiology combined quarterly', 'ERP-221008', now() - interval '6 hours',
    now() - interval '3 days', now() - interval '30 minutes')
  RETURNING id INTO f8;

  INSERT INTO order_items (order_id, product_name, division_id, quantity, unit_price, status)
  VALUES
    (f8, 'Levetiracetam 500mg',   div_neuro, 150, 320.00, 'approved'),
    (f8, 'Donepezil 10mg',        div_neuro, 80,  450.00, 'approved'),
    (f8, 'Clopidogrel 75mg',      div_cardio,200, 210.00, 'approved'),
    (f8, 'Atorvastatin 40mg',     div_cardio,300, 145.00, 'approved');

  INSERT INTO division_approvals (order_id, division_id, approver_user_id, status, decided_at)
  VALUES
    (f8, div_neuro,  '803f697e-eeae-44f1-bb28-7718f766cf57', 'approved', now() - interval '5 hours'),
    (f8, div_cardio, '71a044fa-d32e-442c-8550-721f00fa0139', 'approved', now() - interval '5 hours');

  INSERT INTO final_approvals (order_id, approver_user_id, approver_name, sequence_order, status)
  VALUES
    (f8, arvind_id, 'Arvind Kapoor', 1, 'pending'),
    (f8, meera_id,  'Meera Joshi',   2, 'pending');

  INSERT INTO order_timeline (order_id, actor_name, actor_role, action, action_type)
  VALUES
    (f8, 'Dr. Anand Mehta', 'Division Approver', 'NEURO division approved', 'division_approved'),
    (f8, 'Dr. Kiran Rao', 'Division Approver', 'CARDIO division approved', 'division_approved'),
    (f8, 'Sunita CFA', 'CFA', 'ERP entry done. ERP ID: ERP-221008', 'erp_synced');

END $$;
