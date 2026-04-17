-- Two approved RCs with rich per-item negotiation history for trail demonstration.
-- RC-2026-008: AIIMS, 8 items, ALL items go through 2 rounds → APPROVED
-- RC-2026-009: Apollo, 6 items, Cardio (3 items) approved in R1, Onco (3 items) go through 2 rounds → APPROVED

DO $$
DECLARE
  -- Hospital IDs
  aiims_id  uuid;
  apollo_id uuid;

  -- Division IDs
  cardio_id uuid;
  neuro_id  uuid;
  diab_id   uuid;
  onco_id   uuid;

  -- Field rep
  rep1_id   uuid;

  -- Approver user IDs
  div_approver_cardio_id uuid;
  div_approver_neuro_id  uuid;
  div_approver_diab_id   uuid;
  div_approver_onco_id   uuid;
  final_approver1_id     uuid;
  final_approver2_id     uuid;

  -- Approver name vars
  cardio_name text;
  neuro_name  text;
  diab_name   text;
  onco_name   text;
  final1_name text;
  final2_name text;

  -- RC IDs
  rc8_id uuid;
  rc9_id uuid;

  -- RC-2026-008 item IDs (8 items)
  rc8_item_atorva40  uuid;
  rc8_item_rosuva20  uuid;
  rc8_item_biso5     uuid;
  rc8_item_levod500  uuid;
  rc8_item_clona1    uuid;
  rc8_item_done10    uuid;
  rc8_item_metf1000  uuid;
  rc8_item_sita100   uuid;

  -- RC-2026-009 item IDs (6 items)
  rc9_item_amlod10   uuid;
  rc9_item_metop100  uuid;
  rc9_item_rami5     uuid;
  rc9_item_imat400   uuid;
  rc9_item_cape500   uuid;
  rc9_item_beva100   uuid;

BEGIN

  -- ── Resolve reference IDs ─────────────────────────────────────────────────
  SELECT id INTO aiims_id  FROM hospitals WHERE name ILIKE '%AIIMS%'  LIMIT 1;
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO neuro_id  FROM divisions WHERE code = 'NEURO'  LIMIT 1;
  SELECT id INTO diab_id   FROM divisions WHERE code = 'DIAB'   LIMIT 1;
  SELECT id INTO onco_id   FROM divisions WHERE code = 'ONCO'   LIMIT 1;

  SELECT id INTO rep1_id FROM field_reps ORDER BY created_at LIMIT 1;

  SELECT id INTO div_approver_cardio_id FROM app_users WHERE email = 'anand.mehta@swishx.com' LIMIT 1;
  IF div_approver_cardio_id IS NULL THEN
    SELECT id INTO div_approver_cardio_id FROM app_users
    WHERE role = 'division_approver' AND division_id = cardio_id ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO div_approver_neuro_id FROM app_users WHERE email = 'suresh.iyer.div@swishx.com' LIMIT 1;
  IF div_approver_neuro_id IS NULL THEN
    SELECT id INTO div_approver_neuro_id FROM app_users
    WHERE role = 'division_approver' AND division_id = neuro_id ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO div_approver_diab_id FROM app_users
  WHERE role = 'division_approver' AND division_id = diab_id ORDER BY created_at LIMIT 1;

  SELECT id INTO div_approver_onco_id FROM app_users
  WHERE role = 'division_approver' AND division_id = onco_id ORDER BY created_at LIMIT 1;

  SELECT id INTO final_approver1_id FROM app_users WHERE email = 'arvind.kapoor@swishx.com' LIMIT 1;
  IF final_approver1_id IS NULL THEN
    SELECT id INTO final_approver1_id FROM app_users WHERE role = 'final_approver' ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO final_approver2_id FROM app_users WHERE email = 'meera.joshi@swishx.com' LIMIT 1;
  IF final_approver2_id IS NULL THEN
    SELECT id INTO final_approver2_id FROM app_users WHERE role = 'final_approver' ORDER BY created_at OFFSET 1 LIMIT 1;
  END IF;

  cardio_name := COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Anand Mehta');
  neuro_name  := COALESCE((SELECT name FROM app_users WHERE id = div_approver_neuro_id),  'Suresh Iyer');
  diab_name   := COALESCE((SELECT name FROM app_users WHERE id = div_approver_diab_id),   'Rajan Gupta');
  onco_name   := COALESCE((SELECT name FROM app_users WHERE id = div_approver_onco_id),   'Kavita Nair');
  final1_name := COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id),     'Arvind Kapoor');
  final2_name := COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id),     'Meera Joshi');


  -- ═══════════════════════════════════════════════════════════════════════════
  -- RC-2026-008: AIIMS — Cardio + Neuro + Diab — 8 items — ALL through 2 rounds
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-008') THEN

    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    ) VALUES (
      'RC-2026-008', aiims_id, rep1_id, 'APPROVED', 'approved', 2,
      '2026-04-01', '2026-09-30', 876000,
      'AIIMS multi-division contract. Full 2-round negotiation on all 8 product lines before approval.',
      now() - interval '45 days', now() - interval '10 days'
    ) RETURNING id INTO rc8_id;

    -- ── Items (current price = final approved price after round 2) ──────────
    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Atorvastatin 40mg',   cardio_id, 118, 800,  1000, 290);
    SELECT id INTO rc8_item_atorva40 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Atorvastatin 40mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Rosuvastatin 20mg',   cardio_id, 175, 500,  600,  140);
    SELECT id INTO rc8_item_rosuva20 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Rosuvastatin 20mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Bisoprolol 5mg',      cardio_id, 45,  1200, 1500, 480);
    SELECT id INTO rc8_item_biso5 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Bisoprolol 5mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Levodopa 500mg',      neuro_id,  510, 300,  380,  85);
    SELECT id INTO rc8_item_levod500 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Levodopa 500mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Clonazepam 1mg',      neuro_id,  108, 600,  750,  210);
    SELECT id INTO rc8_item_clona1 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Clonazepam 1mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Donepezil 10mg',      neuro_id,  305, 200,  250,  60);
    SELECT id INTO rc8_item_done10 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Donepezil 10mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Metformin 1000mg',    diab_id,   43,  3000, 3500, 950);
    SELECT id INTO rc8_item_metf1000 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Metformin 1000mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc8_id, 'Sitagliptin 100mg',   diab_id,   158, 1000, 1200, 340);
    SELECT id INTO rc8_item_sita100 FROM rate_contract_items WHERE rc_id = rc8_id AND product_name = 'Sitagliptin 100mg';

    -- ── Approvals ────────────────────────────────────────────────────────────
    -- Round 1: all 3 divisions rejected
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at, negotiation_round)
    VALUES
      (rc8_id, 'division', cardio_id, div_approver_cardio_id, cardio_name, 1,
       'rejected', 'Atorvastatin, Rosuvastatin and Bisoprolol pricing below contractual floor. All three require upward revision.',
       now() - interval '38 days', 1),
      (rc8_id, 'division', neuro_id,  div_approver_neuro_id,  neuro_name,  2,
       'rejected', 'Levodopa and Donepezil prices are significantly below formulary benchmarks. Revisions required.',
       now() - interval '37 days', 1),
      (rc8_id, 'division', diab_id,   div_approver_diab_id,   diab_name,   3,
       'rejected', 'Metformin and Sitagliptin unit costs do not meet procurement floor pricing for AIIMS volumes.',
       now() - interval '36 days', 1);

    -- Round 2: all 3 divisions approved
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round)
    VALUES
      (rc8_id, 'division', cardio_id, div_approver_cardio_id, cardio_name, 1, 'approved', now() - interval '20 days', 2),
      (rc8_id, 'division', neuro_id,  div_approver_neuro_id,  neuro_name,  2, 'approved', now() - interval '19 days', 2),
      (rc8_id, 'division', diab_id,   div_approver_diab_id,   diab_name,   3, 'approved', now() - interval '18 days', 2);

    -- Final approvals: both approved
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round)
    VALUES
      (rc8_id, 'final', NULL, final_approver1_id, final1_name, 1, 'approved', now() - interval '12 days', 2),
      (rc8_id, 'final', NULL, final_approver2_id, final2_name, 2, 'approved', now() - interval '10 days', 2);

    -- ── Timeline ─────────────────────────────────────────────────────────────
    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc8_id, 'Priya Singh', 'Field Rep', 'RC-2026-008 submitted for AIIMS Hospital (Cardio + Neuro + Diab, 8 products).', 'created', now() - interval '45 days'),
      (rc8_id, cardio_name, 'Division Approver', 'Cardio rejected Round 1 — Atorvastatin, Rosuvastatin, Bisoprolol prices below floor.', 'division_rejected', now() - interval '38 days'),
      (rc8_id, neuro_name,  'Division Approver', 'Neuro rejected Round 1 — Levodopa and Donepezil below formulary benchmarks.', 'division_rejected', now() - interval '37 days'),
      (rc8_id, diab_name,   'Division Approver', 'Diabetology rejected Round 1 — Metformin and Sitagliptin below procurement floor.', 'division_rejected', now() - interval '36 days'),
      (rc8_id, 'Admin', 'Admin', 'All divisions rejected Round 1. RC sent back to field rep for revision (Round 2 begins).', 'sent_back', now() - interval '36 days'),
      (rc8_id, 'Priya Singh', 'Field Rep', 'Field rep resubmitted Round 2 with revised pricing across all 8 products.', 'resubmitted', now() - interval '30 days'),
      (rc8_id, cardio_name, 'Division Approver', 'Cardio approved Round 2 — revised Cardio pricing accepted.', 'division_approved', now() - interval '20 days'),
      (rc8_id, neuro_name,  'Division Approver', 'Neuro approved Round 2 — revised Levodopa and Donepezil pricing accepted.', 'division_approved', now() - interval '19 days'),
      (rc8_id, diab_name,   'Division Approver', 'Diabetology approved Round 2 — revised pricing meets procurement floor.', 'division_approved', now() - interval '18 days'),
      (rc8_id, final1_name, 'Final Approver', 'Final approval 1 cleared for RC-2026-008.', 'final_approved', now() - interval '12 days'),
      (rc8_id, final2_name, 'Final Approver', 'Final approval 2 cleared. RC-2026-008 is now APPROVED and active.', 'final_approved', now() - interval '10 days');

    -- ── Negotiation trail: all 8 items through 2 rounds ──────────────────────

    -- Atorvastatin 40mg: R1 ₹105 → R1 div ₹125 → R2 ₹112 → R2 div ₹118
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_atorva40, rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 105, NULL, 800, now() - interval '45 days'),
      (rc8_item_atorva40, rc8_id, 1, cardio_name,   'Division Approver', 'division_edit', 105, 125,  800, 800,  now() - interval '38 days'),
      (rc8_item_atorva40, rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    125, 112,  800, 800,  now() - interval '30 days'),
      (rc8_item_atorva40, rc8_id, 2, cardio_name,   'Division Approver', 'final_edit',    112, 118,  800, 800,  now() - interval '20 days');

    -- Rosuvastatin 20mg: R1 ₹165 → R1 div ₹195 → R2 ₹175 (approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_rosuva20, rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 165, NULL, 500, now() - interval '45 days'),
      (rc8_item_rosuva20, rc8_id, 1, cardio_name,   'Division Approver', 'division_edit', 165, 195,  500, 500,  now() - interval '38 days'),
      (rc8_item_rosuva20, rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    195, 175,  500, 500,  now() - interval '30 days');

    -- Bisoprolol 5mg: R1 ₹38 → R1 div ₹50 → R2 ₹44 → R2 div ₹45
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_biso5,    rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 38,  NULL, 1200, now() - interval '45 days'),
      (rc8_item_biso5,    rc8_id, 1, cardio_name,   'Division Approver', 'division_edit', 38,  50,   1200, 1200, now() - interval '38 days'),
      (rc8_item_biso5,    rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    50,  44,   1200, 1200, now() - interval '30 days'),
      (rc8_item_biso5,    rc8_id, 2, cardio_name,   'Division Approver', 'final_edit',    44,  45,   1200, 1200, now() - interval '20 days');

    -- Levodopa 500mg: R1 ₹480 → R1 div ₹560 → R2 ₹510 (approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_levod500, rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 480, NULL, 300, now() - interval '45 days'),
      (rc8_item_levod500, rc8_id, 1, neuro_name,    'Division Approver', 'division_edit', 480, 560,  300, 300,  now() - interval '37 days'),
      (rc8_item_levod500, rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    560, 510,  300, 300,  now() - interval '30 days');

    -- Clonazepam 1mg: R1 ₹95 → R1 div ₹125 → R2 ₹108 (met midway, approved)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_clona1,   rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 95,  NULL, 600, now() - interval '45 days'),
      (rc8_item_clona1,   rc8_id, 1, neuro_name,    'Division Approver', 'division_edit', 95,  125,  600, 600,  now() - interval '37 days'),
      (rc8_item_clona1,   rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    125, 108,  600, 600,  now() - interval '30 days');

    -- Donepezil 10mg: R1 ₹280 → R1 div ₹350 → R2 ₹310 → R2 div ₹305 (adjusted down slightly)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_done10,   rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 280, NULL, 200, now() - interval '45 days'),
      (rc8_item_done10,   rc8_id, 1, neuro_name,    'Division Approver', 'division_edit', 280, 350,  200, 200,  now() - interval '37 days'),
      (rc8_item_done10,   rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    350, 310,  200, 200,  now() - interval '30 days'),
      (rc8_item_done10,   rc8_id, 2, neuro_name,    'Division Approver', 'final_edit',    310, 305,  200, 200,  now() - interval '19 days');

    -- Metformin 1000mg: R1 ₹35 → R1 div ₹50 → R2 ₹42 → R2 div ₹43
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_metf1000, rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 35,  NULL, 3000, now() - interval '45 days'),
      (rc8_item_metf1000, rc8_id, 1, diab_name,     'Division Approver', 'division_edit', 35,  50,   3000, 3000, now() - interval '36 days'),
      (rc8_item_metf1000, rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    50,  42,   3000, 3000, now() - interval '30 days'),
      (rc8_item_metf1000, rc8_id, 2, diab_name,     'Division Approver', 'final_edit',    42,  43,   3000, 3000, now() - interval '18 days');

    -- Sitagliptin 100mg: R1 ₹145 → R1 div ₹180 → R2 ₹158 (approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc8_item_sita100,  rc8_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 145, NULL, 1000, now() - interval '45 days'),
      (rc8_item_sita100,  rc8_id, 1, diab_name,     'Division Approver', 'division_edit', 145, 180,  1000, 1000, now() - interval '36 days'),
      (rc8_item_sita100,  rc8_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    180, 158,  1000, 1000, now() - interval '30 days');

  END IF; -- RC-2026-008


  -- ═══════════════════════════════════════════════════════════════════════════
  -- RC-2026-009: Apollo — Cardio (3 items, approved in R1) + Onco (3 items, through 2 rounds)
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-009') THEN

    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    ) VALUES (
      'RC-2026-009', apollo_id, rep1_id, 'APPROVED', 'approved', 2,
      '2026-04-15', '2026-10-31', 1240000,
      'Apollo mixed-division contract. Cardio line approved in Round 1; Oncology required 2 rounds of renegotiation.',
      now() - interval '35 days', now() - interval '5 days'
    ) RETURNING id INTO rc9_id;

    -- ── Items ────────────────────────────────────────────────────────────────
    -- Cardio items: approved in R1 at proposed prices
    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Amlodipine 10mg',    cardio_id, 68,   1000, 1200, 320);
    SELECT id INTO rc9_item_amlod10  FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Amlodipine 10mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Metoprolol 100mg',   cardio_id, 55,   700,  900,  190);
    SELECT id INTO rc9_item_metop100 FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Metoprolol 100mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Ramipril 5mg',       cardio_id, 72,   500,  650,  115);
    SELECT id INTO rc9_item_rami5    FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Ramipril 5mg';

    -- Onco items: went through 2 rounds (current price = final approved)
    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Imatinib 400mg',     onco_id,   4300, 80,   100,  22);
    SELECT id INTO rc9_item_imat400  FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Imatinib 400mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Capecitabine 500mg', onco_id,   575,  150,  200,  38);
    SELECT id INTO rc9_item_cape500  FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Capecitabine 500mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc9_id, 'Bevacizumab 100mg',  onco_id,   9600, 40,   50,   8);
    SELECT id INTO rc9_item_beva100  FROM rate_contract_items WHERE rc_id = rc9_id AND product_name = 'Bevacizumab 100mg';

    -- ── Approvals ────────────────────────────────────────────────────────────
    -- Round 1: Cardio approved, Onco rejected
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at, negotiation_round)
    VALUES
      (rc9_id, 'division', cardio_id, div_approver_cardio_id, cardio_name, 1,
       'approved', NULL, now() - interval '28 days', 1),
      (rc9_id, 'division', onco_id, div_approver_onco_id, onco_name, 2,
       'rejected', 'Imatinib and Bevacizumab pricing are well below acquisition cost. Oncology cannot approve at these rates.',
       now() - interval '27 days', 1);

    -- Round 2: Cardio re-approved (same terms), Onco approved revised pricing
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round)
    VALUES
      (rc9_id, 'division', cardio_id, div_approver_cardio_id, cardio_name, 1,
       'approved', now() - interval '12 days', 2),
      (rc9_id, 'division', onco_id, div_approver_onco_id, onco_name, 2,
       'approved', now() - interval '10 days', 2);

    -- Final approvals: both approved
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round)
    VALUES
      (rc9_id, 'final', NULL, final_approver1_id, final1_name, 1, 'approved', now() - interval '7 days',  2),
      (rc9_id, 'final', NULL, final_approver2_id, final2_name, 2, 'approved', now() - interval '5 days',  2);

    -- ── Timeline ─────────────────────────────────────────────────────────────
    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc9_id, 'Priya Singh', 'Field Rep', 'RC-2026-009 submitted for Apollo Hospital (Cardio + Oncology, 6 products).', 'created', now() - interval '35 days'),
      (rc9_id, cardio_name, 'Division Approver', 'Cardiology approved Round 1 — Amlodipine, Metoprolol and Ramipril pricing acceptable.', 'division_approved', now() - interval '28 days'),
      (rc9_id, onco_name, 'Division Approver', 'Oncology rejected Round 1 — Imatinib and Bevacizumab below acquisition cost. Revisions needed.', 'division_rejected', now() - interval '27 days'),
      (rc9_id, 'Admin', 'Admin', 'Oncology rejection triggered send-back. Field rep notified for Round 2 revision on Onco items.', 'sent_back', now() - interval '27 days'),
      (rc9_id, 'Priya Singh', 'Field Rep', 'Field rep resubmitted Round 2. Revised Imatinib to ₹4,100, Capecitabine to ₹575, Bevacizumab to ₹9,400. Cardio prices unchanged.', 'resubmitted', now() - interval '20 days'),
      (rc9_id, cardio_name, 'Division Approver', 'Cardiology re-approved Round 2 — Cardio pricing unchanged and accepted.', 'division_approved', now() - interval '12 days'),
      (rc9_id, onco_name, 'Division Approver', 'Oncology approved Round 2 after minor adjustments. Final oncology prices: Imatinib ₹4,300, Capecitabine ₹575, Bevacizumab ₹9,600.', 'division_approved', now() - interval '10 days'),
      (rc9_id, final1_name, 'Final Approver', 'Final approval 1 cleared for RC-2026-009.', 'final_approved', now() - interval '7 days'),
      (rc9_id, final2_name, 'Final Approver', 'Final approval 2 cleared. RC-2026-009 is now APPROVED and active.', 'final_approved', now() - interval '5 days');

    -- ── Negotiation trail ────────────────────────────────────────────────────

    -- ─── Cardio items: only R1 "proposed" (approved in round 1, no division edits)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc9_item_amlod10,  rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed', NULL, 68,  NULL, 1000, now() - interval '35 days'),
      (rc9_item_metop100, rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed', NULL, 55,  NULL, 700,  now() - interval '35 days'),
      (rc9_item_rami5,    rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed', NULL, 72,  NULL, 500,  now() - interval '35 days');

    -- ─── Onco items: full 2-round trail

    -- Imatinib 400mg: R1 ₹3,800 → R1 div ₹4,600 → R2 ₹4,100 → R2 div ₹4,300
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc9_item_imat400, rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL,  3800, NULL, 80, now() - interval '35 days'),
      (rc9_item_imat400, rc9_id, 1, onco_name,     'Division Approver', 'division_edit', 3800, 4600,   80, 80, now() - interval '27 days'),
      (rc9_item_imat400, rc9_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    4600, 4100,   80, 80, now() - interval '20 days'),
      (rc9_item_imat400, rc9_id, 2, onco_name,     'Division Approver', 'final_edit',    4100, 4300,   80, 80, now() - interval '10 days');

    -- Capecitabine 500mg: R1 ₹520 → R1 div ₹650 → R2 ₹575 (approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc9_item_cape500, rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL, 520, NULL, 150, now() - interval '35 days'),
      (rc9_item_cape500, rc9_id, 1, onco_name,     'Division Approver', 'division_edit', 520, 650,  150, 150, now() - interval '27 days'),
      (rc9_item_cape500, rc9_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    650, 575,  150, 150, now() - interval '20 days');

    -- Bevacizumab 100mg: R1 ₹8,500 → R1 div ₹10,800 → R2 ₹9,400 → R2 div ₹9,600
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc9_item_beva100, rc9_id, 1, 'Priya Singh', 'Field Rep', 'proposed',       NULL,  8500, NULL, 40, now() - interval '35 days'),
      (rc9_item_beva100, rc9_id, 1, onco_name,     'Division Approver', 'division_edit', 8500, 10800,  40, 40, now() - interval '27 days'),
      (rc9_item_beva100, rc9_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',    10800, 9400,  40, 40, now() - interval '20 days'),
      (rc9_item_beva100, rc9_id, 2, onco_name,     'Division Approver', 'final_edit',    9400,  9600,  40, 40, now() - interval '10 days');

  END IF; -- RC-2026-009

END $$;
