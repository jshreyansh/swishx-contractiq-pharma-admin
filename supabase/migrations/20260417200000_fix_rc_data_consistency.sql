-- Fix logical inconsistencies found in RC data audit.
-- 1. Fix workflow_stage for RC-005, RC-008, RC-009 (all divisions approved but still at division_review)
-- 2. Add initial "proposed" history for RC-006 through RC-010 (missing negotiation trail)
-- 3. Add division_edit history for RC-006 (divisions suggested price changes before sending back)

-- ─── 1. Workflow stage fixes ─────────────────────────────────────────────────

-- RC-2026-005 (AIIMS): both CARDIO and NEURO divisions approved, final pending → final_approval_pending
UPDATE rate_contracts
SET workflow_stage = 'final_approval_pending', updated_at = now()
WHERE rc_code = 'RC-2026-005'
  AND status = 'PENDING'
  AND workflow_stage = 'division_review';

-- RC-2026-008 (Manipal): all 3 divisions approved, final pending → final_approval_pending
UPDATE rate_contracts
SET workflow_stage = 'final_approval_pending', updated_at = now()
WHERE rc_code = 'RC-2026-008'
  AND status = 'PENDING'
  AND workflow_stage = 'division_review';

-- RC-2026-009 (Narayana): all 3 divisions + 1st final approver done, 2nd pending → final_approval_pending
UPDATE rate_contracts
SET workflow_stage = 'final_approval_pending', updated_at = now()
WHERE rc_code = 'RC-2026-009'
  AND status = 'PENDING'
  AND workflow_stage = 'division_review';


-- ─── 2. Seed "proposed" history for RCs 007, 008, 009, 010 ──────────────────
-- Use current negotiated_price as the proposed price (these RCs have no prior history).
-- Only insert where no proposed entry already exists for the item.

INSERT INTO rate_contract_item_history
  (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
   price_before, price_after, qty_before, qty_after, created_at)
SELECT
  rci.id, rci.rc_id, 1, 'Field Rep', 'Field Rep', 'proposed',
  NULL, rci.negotiated_price, NULL, rci.expected_qty,
  rc.created_at
FROM rate_contract_items rci
JOIN rate_contracts rc ON rc.id = rci.rc_id
WHERE rc.rc_code IN ('RC-2026-007', 'RC-2026-008', 'RC-2026-009', 'RC-2026-010')
  AND NOT EXISTS (
    SELECT 1 FROM rate_contract_item_history
    WHERE rc_item_id = rci.id AND action_type = 'proposed' AND negotiation_round = 1
  );


-- ─── 3. RC-2026-006: add full Round 1 trail (proposed + division edits) ──────
-- RC-2026-006 (Max Hospital, Cardio + Respiratory) is currently in sent_back_to_field_rep.
-- The current negotiated_price values ARE the division's suggested prices (what they want).
-- The original field rep proposals were ~15-20% lower.
-- We add both the initial proposal and the division's price suggestion for each item.

DO $$
DECLARE
  rc6_id       uuid;
  cardio_id    uuid;
  resp_id      uuid;
  cardio_name  text;
  resp_name    text;
  div_approver_cardio_id uuid;
  div_approver_resp_id   uuid;
  rc_created_at timestamptz;
BEGIN
  SELECT id INTO rc6_id FROM rate_contracts WHERE rc_code = 'RC-2026-006' LIMIT 1;
  IF rc6_id IS NULL THEN RETURN; END IF;

  SELECT created_at INTO rc_created_at FROM rate_contracts WHERE id = rc6_id;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO resp_id   FROM divisions WHERE code = 'RESP'   LIMIT 1;

  SELECT id INTO div_approver_cardio_id FROM app_users WHERE email = 'anand.mehta@swishx.com' LIMIT 1;
  IF div_approver_cardio_id IS NULL THEN
    SELECT id INTO div_approver_cardio_id FROM app_users
    WHERE role = 'division_approver' AND division_id = cardio_id ORDER BY created_at LIMIT 1;
  END IF;
  SELECT id INTO div_approver_resp_id FROM app_users
  WHERE role = 'division_approver' AND division_id = resp_id ORDER BY created_at LIMIT 1;

  cardio_name := COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Anand Mehta');
  resp_name   := COALESCE((SELECT name FROM app_users WHERE id = div_approver_resp_id),   'Dr. Meena Pillai');

  -- Only proceed if no history exists for this RC yet
  IF NOT EXISTS (SELECT 1 FROM rate_contract_item_history WHERE rc_id = rc6_id) THEN

    -- Insert proposed + division_edit pairs for each item.
    -- Proposed prices ≈ 85% of current negotiated price (field rep submitted lower, division pushed up).

    -- Cardio items
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
       price_before, price_after, qty_before, qty_after, created_at)
    SELECT
      rci.id, rc6_id, 1, 'Field Rep', 'Field Rep', 'proposed',
      NULL,
      ROUND(rci.negotiated_price * 0.85)::numeric,
      NULL,
      rci.expected_qty,
      rc_created_at
    FROM rate_contract_items rci
    WHERE rci.rc_id = rc6_id AND rci.division_id = cardio_id;

    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
       price_before, price_after, qty_before, qty_after, notes, created_at)
    SELECT
      rci.id, rc6_id, 1, cardio_name, 'Division Approver', 'division_edit',
      ROUND(rci.negotiated_price * 0.85)::numeric,
      rci.negotiated_price,
      rci.expected_qty,
      rci.expected_qty,
      'Division suggested revised pricing. RC sent back to field rep for acceptance.',
      rc_created_at + interval '5 days'
    FROM rate_contract_items rci
    WHERE rci.rc_id = rc6_id AND rci.division_id = cardio_id;

    -- Respiratory items
    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
       price_before, price_after, qty_before, qty_after, created_at)
    SELECT
      rci.id, rc6_id, 1, 'Field Rep', 'Field Rep', 'proposed',
      NULL,
      ROUND(rci.negotiated_price * 0.85)::numeric,
      NULL,
      rci.expected_qty,
      rc_created_at
    FROM rate_contract_items rci
    WHERE rci.rc_id = rc6_id AND rci.division_id = resp_id;

    INSERT INTO rate_contract_item_history
      (rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
       price_before, price_after, qty_before, qty_after, notes, created_at)
    SELECT
      rci.id, rc6_id, 1, resp_name, 'Division Approver', 'division_edit',
      ROUND(rci.negotiated_price * 0.85)::numeric,
      rci.negotiated_price,
      rci.expected_qty,
      rci.expected_qty,
      'Division suggested revised pricing. RC sent back to field rep for acceptance.',
      rc_created_at + interval '6 days'
    FROM rate_contract_items rci
    WHERE rci.rc_id = rc6_id AND rci.division_id = resp_id;

  END IF;
END $$;
