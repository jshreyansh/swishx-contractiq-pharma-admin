-- rate_contract_item_history: per-item price/qty audit trail across negotiation rounds

CREATE TABLE IF NOT EXISTS rate_contract_item_history (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_item_id        uuid         NOT NULL REFERENCES rate_contract_items(id) ON DELETE CASCADE,
  rc_id             uuid         NOT NULL REFERENCES rate_contracts(id) ON DELETE CASCADE,
  negotiation_round integer      NOT NULL DEFAULT 1 CHECK (negotiation_round BETWEEN 1 AND 2),
  actor_name        text         NOT NULL,
  actor_role        text         NOT NULL,
  action_type       text         NOT NULL CHECK (action_type IN ('proposed', 'division_edit', 'resubmitted', 'final_edit')),
  price_before      numeric(12,2),
  price_after       numeric(12,2) NOT NULL,
  qty_before        integer,
  qty_after         integer      NOT NULL,
  notes             text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rcih_rc_id      ON rate_contract_item_history(rc_id);
CREATE INDEX IF NOT EXISTS idx_rcih_rc_item_id ON rate_contract_item_history(rc_item_id);

-- Enable RLS (open read for authenticated, no direct write from frontend — all writes via server)
ALTER TABLE rate_contract_item_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON rate_contract_item_history
  FOR SELECT TO authenticated USING (true);


-- ─── Seed ────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- RC IDs for existing RCs
  rc1_id  uuid; rc2_id  uuid; rc3_id  uuid;
  rc4_id  uuid; rc5_id  uuid;
  -- New demo RC IDs
  rc6_id  uuid; rc7_id  uuid;

  -- Division IDs
  cardio_id uuid; diab_id uuid; neuro_id uuid;

  -- Hospital IDs
  fortis_id uuid; apollo_id uuid;

  -- User IDs
  rep1_id               uuid;
  div_approver_cardio_id uuid;
  div_approver_neuro_id  uuid;
  div_approver_diab_id   uuid;
  final_approver1_id     uuid;
  final_approver2_id     uuid;

  -- Per-item IDs for RC-2026-006
  rc6_item_atorva  uuid;
  rc6_item_rosuva  uuid;
  rc6_item_metform uuid;

  -- Per-item IDs for RC-2026-007
  rc7_item_amlod  uuid;
  rc7_item_metop  uuid;
  rc7_item_levod  uuid;
  rc7_item_clona  uuid;

  -- Approver name helpers
  cardio_approver_name text;
  neuro_approver_name  text;
  diab_approver_name   text;
  final1_name          text;
  final2_name          text;
BEGIN

  -- ── Resolve IDs ────────────────────────────────────────────────────────────
  SELECT id INTO rc1_id FROM rate_contracts WHERE rc_code = 'RC-2026-001';
  SELECT id INTO rc2_id FROM rate_contracts WHERE rc_code = 'RC-2026-002';
  SELECT id INTO rc3_id FROM rate_contracts WHERE rc_code = 'RC-2026-003';
  SELECT id INTO rc4_id FROM rate_contracts WHERE rc_code = 'RC-2026-004';
  SELECT id INTO rc5_id FROM rate_contracts WHERE rc_code = 'RC-2026-005';

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO diab_id   FROM divisions WHERE code = 'DIAB'   LIMIT 1;
  SELECT id INTO neuro_id  FROM divisions WHERE code = 'NEURO'  LIMIT 1;

  SELECT id INTO fortis_id FROM hospitals WHERE name ILIKE '%Fortis%' LIMIT 1;
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;

  SELECT id INTO rep1_id FROM field_reps ORDER BY created_at LIMIT 1;

  SELECT id INTO div_approver_cardio_id FROM app_users WHERE email = 'anand.mehta@swishx.com' LIMIT 1;
  IF div_approver_cardio_id IS NULL THEN
    SELECT id INTO div_approver_cardio_id
    FROM app_users WHERE role = 'division_approver' AND division_id = cardio_id
    ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO div_approver_neuro_id FROM app_users WHERE email = 'suresh.iyer.div@swishx.com' LIMIT 1;
  IF div_approver_neuro_id IS NULL THEN
    SELECT id INTO div_approver_neuro_id
    FROM app_users WHERE role = 'division_approver' AND division_id = neuro_id
    ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO div_approver_diab_id
  FROM app_users WHERE role = 'division_approver' AND division_id = diab_id
  ORDER BY created_at LIMIT 1;

  SELECT id INTO final_approver1_id FROM app_users WHERE email = 'arvind.kapoor@swishx.com' LIMIT 1;
  IF final_approver1_id IS NULL THEN
    SELECT id INTO final_approver1_id FROM app_users WHERE role = 'final_approver' ORDER BY created_at LIMIT 1;
  END IF;

  SELECT id INTO final_approver2_id FROM app_users WHERE email = 'meera.joshi@swishx.com' LIMIT 1;
  IF final_approver2_id IS NULL THEN
    SELECT id INTO final_approver2_id FROM app_users WHERE role = 'final_approver' ORDER BY created_at OFFSET 1 LIMIT 1;
  END IF;

  cardio_approver_name := COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Anand Mehta');
  neuro_approver_name  := COALESCE((SELECT name FROM app_users WHERE id = div_approver_neuro_id),  'Suresh Iyer');
  diab_approver_name   := COALESCE((SELECT name FROM app_users WHERE id = div_approver_diab_id),   'Rajan Gupta');
  final1_name          := COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id),     'Arvind Kapoor');
  final2_name          := COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id),     'Meera Joshi');

  -- ── Initial "proposed" history for RC-2026-001 through RC-2026-005 ─────────
  -- Represents the field rep's original submission snapshot.
  -- Price/qty preserved from current negotiated values (single-round RCs; no edit trail exists).

  INSERT INTO rate_contract_item_history
    (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
  SELECT
    rci.id, rci.rc_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
    NULL, rci.negotiated_price, NULL, rci.expected_qty,
    rc.created_at
  FROM rate_contract_items rci
  JOIN rate_contracts rc ON rc.id = rci.rc_id
  WHERE rc.rc_code IN ('RC-2026-001','RC-2026-002','RC-2026-003','RC-2026-004','RC-2026-005');


  -- ── RC-2026-006: Fortis — Cardio + Diab — Round 2 division review ──────────
  -- Round 1: division pushed back on pricing, sent back to field rep.
  -- Round 2: field rep resubmitted with revised prices; divisions currently reviewing.

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-006') THEN

    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    ) VALUES (
      'RC-2026-006', fortis_id, rep1_id, 'PENDING', 'division_review', 2,
      '2026-05-01', '2026-07-31', 340000,
      'Cardio + Diabetology renewal — currently in Round 2 after division pushed back on initial pricing.',
      now() - interval '12 days', now() - interval '1 day'
    ) RETURNING id INTO rc6_id;

    -- Items: current negotiated_price = round-2 resubmit values
    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc6_id, 'Atorvastatin 20mg', cardio_id, 96,  1200, 1500, 0);
    SELECT id INTO rc6_item_atorva FROM rate_contract_items
    WHERE rc_id = rc6_id AND product_name = 'Atorvastatin 20mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc6_id, 'Rosuvastatin 10mg', cardio_id, 158, 500,  600,  0);
    SELECT id INTO rc6_item_rosuva FROM rate_contract_items
    WHERE rc_id = rc6_id AND product_name = 'Rosuvastatin 10mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc6_id, 'Metformin 500mg', diab_id, 28, 2500, 3000, 0);
    SELECT id INTO rc6_item_metform FROM rate_contract_items
    WHERE rc_id = rc6_id AND product_name = 'Metformin 500mg';

    -- Round 1 approvals (both rejected — triggered sent_back_to_field_rep)
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at, negotiation_round)
    VALUES
      (rc6_id, 'division', cardio_id, div_approver_cardio_id, cardio_approver_name, 1,
       'rejected', 'Atorvastatin and Rosuvastatin prices are below cost recovery threshold. Please revise upward.',
       now() - interval '7 days', 1),
      (rc6_id, 'division', diab_id,   div_approver_diab_id,   diab_approver_name,   1,
       'rejected', 'Metformin unit price does not align with current tender benchmarks.',
       now() - interval '6 days', 1);

    -- Round 2 approvals (pending — currently in division inboxes)
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, negotiation_round)
    VALUES
      (rc6_id, 'division', cardio_id, div_approver_cardio_id, cardio_approver_name, 1, 'pending', 2),
      (rc6_id, 'division', diab_id,   div_approver_diab_id,   diab_approver_name,   1, 'pending', 2),
      (rc6_id, 'final', NULL, final_approver1_id, final1_name, 1, 'pending', 1),
      (rc6_id, 'final', NULL, final_approver2_id, final2_name, 2, 'pending', 1);

    -- Timeline
    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc6_id, 'Priya Singh', 'Field Rep', 'Rate contract RC-2026-006 submitted for Fortis Hospital.', 'created', now() - interval '12 days'),
      (rc6_id, cardio_approver_name, 'Division Approver', 'Cardio rejected Round 1 pricing — prices below cost recovery. Suggested revisions sent.', 'division_rejected', now() - interval '7 days'),
      (rc6_id, diab_approver_name,   'Division Approver', 'Diabetology rejected Round 1 pricing — does not meet tender benchmarks.', 'division_rejected', now() - interval '6 days'),
      (rc6_id, 'Admin', 'Admin', 'RC sent back to field rep after Round 1 division rejections. Round 2 pending field rep revision.', 'sent_back', now() - interval '6 days'),
      (rc6_id, 'Priya Singh', 'Field Rep', 'Field rep resubmitted with revised pricing (Round 2). Atorvastatin revised to ₹96, Rosuvastatin to ₹158, Metformin to ₹28.', 'resubmitted', now() - interval '1 day');

    -- ── Negotiation history for RC-2026-006 items ────────────────────────────

    -- Atorvastatin 20mg: R1 proposed ₹88 → R1 div edited to ₹105 → R2 resubmit ₹96
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc6_item_atorva, rc6_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 88, NULL, 1200, now() - interval '12 days'),
      (rc6_item_atorva, rc6_id, 1, cardio_approver_name, 'Division Approver', 'division_edit',
       88, 105, 1200, 1200, now() - interval '7 days'),
      (rc6_item_atorva, rc6_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       105, 96, 1200, 1200, now() - interval '1 day');

    -- Rosuvastatin 10mg: R1 proposed ₹145 → R1 div edited to ₹175 → R2 resubmit ₹158
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc6_item_rosuva, rc6_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 145, NULL, 500, now() - interval '12 days'),
      (rc6_item_rosuva, rc6_id, 1, cardio_approver_name, 'Division Approver', 'division_edit',
       145, 175, 500, 500, now() - interval '7 days'),
      (rc6_item_rosuva, rc6_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       175, 158, 500, 500, now() - interval '1 day');

    -- Metformin 500mg: R1 proposed ₹24 → R1 div edited to ₹34 → R2 resubmit ₹28
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc6_item_metform, rc6_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 24, NULL, 2500, now() - interval '12 days'),
      (rc6_item_metform, rc6_id, 1, diab_approver_name, 'Division Approver', 'division_edit',
       24, 34, 2500, 2500, now() - interval '6 days'),
      (rc6_item_metform, rc6_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       34, 28, 2500, 2500, now() - interval '1 day');

  END IF; -- RC-2026-006


  -- ── RC-2026-007: Apollo — Cardio + Neuro — Round 2 final approval pending ──
  -- Both rounds completed. Divisions approved in Round 2. Now awaiting final approval.

  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-007') THEN

    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, workflow_stage, negotiation_round,
      valid_from, valid_to, total_value, notes, created_at, updated_at
    ) VALUES (
      'RC-2026-007', apollo_id, rep1_id, 'PENDING', 'final_approval_pending', 2,
      '2026-05-15', '2026-08-31', 295000,
      'Apollo Cardio + Neuro line renewal. Full 2-round renegotiation completed; divisions approved. Awaiting final sign-off.',
      now() - interval '20 days', now() - interval '2 days'
    ) RETURNING id INTO rc7_id;

    -- Items: current negotiated_price = final division-approved values from round 2
    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc7_id, 'Amlodipine 5mg', cardio_id, 63, 900, 1100, 0);
    SELECT id INTO rc7_item_amlod FROM rate_contract_items
    WHERE rc_id = rc7_id AND product_name = 'Amlodipine 5mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc7_id, 'Metoprolol 50mg', cardio_id, 47, 700, 900, 0);
    SELECT id INTO rc7_item_metop FROM rate_contract_items
    WHERE rc_id = rc7_id AND product_name = 'Metoprolol 50mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc7_id, 'Levodopa 250mg', neuro_id, 315, 400, 500, 0);
    SELECT id INTO rc7_item_levod FROM rate_contract_items
    WHERE rc_id = rc7_id AND product_name = 'Levodopa 250mg';

    INSERT INTO rate_contract_items (rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty)
    VALUES (rc7_id, 'Clonazepam 0.5mg', neuro_id, 83, 350, 450, 0);
    SELECT id INTO rc7_item_clona FROM rate_contract_items
    WHERE rc_id = rc7_id AND product_name = 'Clonazepam 0.5mg';

    -- Round 1 approvals (both rejected)
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, rejection_reason, decided_at, negotiation_round)
    VALUES
      (rc7_id, 'division', cardio_id, div_approver_cardio_id, cardio_approver_name, 1,
       'rejected', 'Amlodipine and Metoprolol pricing not aligned with formulary targets. Division cannot approve at proposed rates.',
       now() - interval '14 days', 1),
      (rc7_id, 'division', neuro_id, div_approver_neuro_id, neuro_approver_name, 2,
       'rejected', 'Levodopa pricing is below the last approved formulary rate (₹310). Revision required.',
       now() - interval '13 days', 1);

    -- Round 2 approvals (both approved)
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, decided_at, negotiation_round)
    VALUES
      (rc7_id, 'division', cardio_id, div_approver_cardio_id, cardio_approver_name, 1,
       'approved', now() - interval '3 days', 2),
      (rc7_id, 'division', neuro_id, div_approver_neuro_id, neuro_approver_name, 2,
       'approved', now() - interval '2 days', 2);

    -- Final approvals (pending)
    INSERT INTO rate_contract_approvals
      (rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status, negotiation_round)
    VALUES
      (rc7_id, 'final', NULL, final_approver1_id, final1_name, 1, 'pending', 2),
      (rc7_id, 'final', NULL, final_approver2_id, final2_name, 2, 'pending', 2);

    -- Timeline
    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (rc7_id, 'Priya Singh', 'Field Rep', 'Rate contract RC-2026-007 submitted for Apollo Hospital (Cardio + Neuro).', 'created', now() - interval '20 days'),
      (rc7_id, cardio_approver_name, 'Division Approver', 'Cardio rejected Round 1 — pricing not aligned with formulary. Sent price guidance.', 'division_rejected', now() - interval '14 days'),
      (rc7_id, neuro_approver_name,  'Division Approver', 'Neuro rejected Round 1 — Levodopa below last approved rate.', 'division_rejected', now() - interval '13 days'),
      (rc7_id, 'Admin', 'Admin', 'RC sent back to field rep after Round 1 division rejections. Final negotiation round (Round 2) initiated.', 'sent_back', now() - interval '13 days'),
      (rc7_id, 'Priya Singh', 'Field Rep', 'Field rep resubmitted (Round 2) with revised pricing. Amlodipine ₹60, Metoprolol ₹47, Levodopa ₹315, Clonazepam ₹83.', 'resubmitted', now() - interval '7 days'),
      (rc7_id, cardio_approver_name, 'Division Approver', 'Cardio approved Round 2. Amlodipine adjusted to ₹63 before approval.', 'division_approved', now() - interval '3 days'),
      (rc7_id, neuro_approver_name,  'Division Approver', 'Neuro approved Round 2 terms. RC-2026-007 moved to final approval queue.', 'division_approved', now() - interval '2 days');

    -- ── Negotiation history for RC-2026-007 items ────────────────────────────

    -- Amlodipine 5mg: R1 ₹55 → R1 div ₹68 → R2 ₹60 → R2 div final_edit ₹63
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc7_item_amlod, rc7_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 55, NULL, 900, now() - interval '20 days'),
      (rc7_item_amlod, rc7_id, 1, cardio_approver_name, 'Division Approver', 'division_edit',
       55, 68, 900, 900, now() - interval '14 days'),
      (rc7_item_amlod, rc7_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       68, 60, 900, 900, now() - interval '7 days'),
      (rc7_item_amlod, rc7_id, 2, cardio_approver_name, 'Division Approver', 'final_edit',
       60, 63, 900, 900, now() - interval '3 days');

    -- Metoprolol 50mg: R1 ₹42 → R1 div ₹52 → R2 ₹47 (division approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc7_item_metop, rc7_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 42, NULL, 700, now() - interval '20 days'),
      (rc7_item_metop, rc7_id, 1, cardio_approver_name, 'Division Approver', 'division_edit',
       42, 52, 700, 700, now() - interval '14 days'),
      (rc7_item_metop, rc7_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       52, 47, 700, 700, now() - interval '7 days');

    -- Levodopa 250mg: R1 ₹295 (division rejected without editing) → R2 ₹315 (field rep self-revised up)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc7_item_levod, rc7_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 295, NULL, 400, now() - interval '20 days'),
      (rc7_item_levod, rc7_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       295, 315, 400, 400, now() - interval '7 days');

    -- Clonazepam 0.5mg: R1 ₹78 → R1 div ₹90 → R2 ₹83 (division approved without further edit)
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type, price_before, price_after, qty_before, qty_after, created_at)
    VALUES
      (rc7_item_clona, rc7_id, 1, 'Priya Singh', 'Field Rep', 'proposed',
       NULL, 78, NULL, 350, now() - interval '20 days'),
      (rc7_item_clona, rc7_id, 1, neuro_approver_name, 'Division Approver', 'division_edit',
       78, 90, 350, 350, now() - interval '13 days'),
      (rc7_item_clona, rc7_id, 2, 'Priya Singh', 'Field Rep', 'resubmitted',
       90, 83, 350, 350, now() - interval '7 days');

  END IF; -- RC-2026-007

END $$;
