-- Repair the broken RC-2026-007 negotiation trail on the Fortis DIAB/ONCO demo RC.
--
-- What went wrong:
-- 1. A later backfill created only synthetic "proposed" rows from current item values.
-- 2. The actual division edit + round-2 resubmission rows were never recorded.
--
-- This repair targets only the Fortis DIAB/ONCO RC-2026-007 variant that exists in the
-- current shared dataset and only runs when that RC still has no non-"proposed" history.

DO $$
DECLARE
  target_rc_id uuid;
  rc_created_at timestamptz;
  resubmitted_at timestamptz;
  metformin_item_id uuid;
  metformin_updated_at timestamptz;
  insulin_item_id uuid;
  insulin_updated_at timestamptz;
  empag_item_id uuid;
  paclitaxel_item_id uuid;
  bevacizumab_item_id uuid;
BEGIN
  SELECT id, created_at
  INTO target_rc_id, rc_created_at
  FROM rate_contracts
  WHERE rc_code = 'RC-2026-007'
    AND notes = 'Fortis diabetology and oncology package under pricing review.'
  LIMIT 1;

  IF target_rc_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND action_type IN ('division_edit', 'resubmitted', 'final_edit')
  ) THEN
    RETURN;
  END IF;

  SELECT id, updated_at
  INTO metformin_item_id, metformin_updated_at
  FROM rate_contract_items
  WHERE rc_id = target_rc_id
    AND product_name = 'Metformin 500mg'
  LIMIT 1;

  SELECT id, updated_at
  INTO insulin_item_id, insulin_updated_at
  FROM rate_contract_items
  WHERE rc_id = target_rc_id
    AND product_name = 'Insulin Glargine 100IU/mL'
  LIMIT 1;

  SELECT id
  INTO empag_item_id
  FROM rate_contract_items
  WHERE rc_id = target_rc_id
    AND product_name = 'Empagliflozin 10mg'
  LIMIT 1;

  SELECT id
  INTO paclitaxel_item_id
  FROM rate_contract_items
  WHERE rc_id = target_rc_id
    AND product_name = 'Paclitaxel 300mg Vial'
  LIMIT 1;

  SELECT id
  INTO bevacizumab_item_id
  FROM rate_contract_items
  WHERE rc_id = target_rc_id
    AND product_name = 'Bevacizumab 400mg'
  LIMIT 1;

  SELECT created_at
  INTO resubmitted_at
  FROM rate_contract_timeline
  WHERE rc_id = target_rc_id
    AND action_type = 'resubmitted'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Restore the original round-1 submitted quantities from the Fortis seed.
  UPDATE rate_contract_item_history
  SET price_after = 27,
      qty_after = 2500
  WHERE rc_id = target_rc_id
    AND rc_item_id = metformin_item_id
    AND action_type = 'proposed'
    AND negotiation_round = 1;

  UPDATE rate_contract_item_history
  SET price_after = 875,
      qty_after = 420
  WHERE rc_id = target_rc_id
    AND rc_item_id = insulin_item_id
    AND action_type = 'proposed'
    AND negotiation_round = 1;

  UPDATE rate_contract_item_history
  SET price_after = 810,
      qty_after = 240
  WHERE rc_id = target_rc_id
    AND rc_item_id = empag_item_id
    AND action_type = 'proposed'
    AND negotiation_round = 1;

  UPDATE rate_contract_item_history
  SET price_after = 17500,
      qty_after = 18
  WHERE rc_id = target_rc_id
    AND rc_item_id = paclitaxel_item_id
    AND action_type = 'proposed'
    AND negotiation_round = 1;

  UPDATE rate_contract_item_history
  SET price_after = 26500,
      qty_after = 10
  WHERE rc_id = target_rc_id
    AND rc_item_id = bevacizumab_item_id
    AND action_type = 'proposed'
    AND negotiation_round = 1;

  -- Division review edits happened only on the DIAB items; the ONCO division sent the RC back
  -- without changing per-item values. These timestamps line up with the item updated_at values.
  IF metformin_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = metformin_item_id
      AND action_type = 'division_edit'
      AND negotiation_round = 1
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, notes, created_at
    ) VALUES (
      metformin_item_id, target_rc_id, 1, 'Dr. Anand Mehta', 'Division Approver', 'division_edit',
      27, 27, 2500, 200,
      'Division reduced expected quantity during review before Round 2 resubmission.',
      COALESCE(metformin_updated_at, rc_created_at)
    );
  END IF;

  IF insulin_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = insulin_item_id
      AND action_type = 'division_edit'
      AND negotiation_round = 1
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, notes, created_at
    ) VALUES (
      insulin_item_id, target_rc_id, 1, 'Dr. Anand Mehta', 'Division Approver', 'division_edit',
      875, 875, 420, 40,
      'Division reduced expected quantity during review before Round 2 resubmission.',
      COALESCE(insulin_updated_at, rc_created_at)
    );
  END IF;

  -- Round-2 resubmission should exist for every item after the send-back.
  IF empag_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = empag_item_id
      AND action_type = 'resubmitted'
      AND negotiation_round = 2
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, created_at
    ) VALUES (
      empag_item_id, target_rc_id, 2, 'Field Rep', 'Field Rep', 'resubmitted',
      810, 810, 240, 240,
      COALESCE(resubmitted_at, rc_created_at)
    );
  END IF;

  IF metformin_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = metformin_item_id
      AND action_type = 'resubmitted'
      AND negotiation_round = 2
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, created_at
    ) VALUES (
      metformin_item_id, target_rc_id, 2, 'Field Rep', 'Field Rep', 'resubmitted',
      27, 27, 200, 200,
      COALESCE(resubmitted_at, rc_created_at)
    );
  END IF;

  IF insulin_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = insulin_item_id
      AND action_type = 'resubmitted'
      AND negotiation_round = 2
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, created_at
    ) VALUES (
      insulin_item_id, target_rc_id, 2, 'Field Rep', 'Field Rep', 'resubmitted',
      875, 875, 40, 40,
      COALESCE(resubmitted_at, rc_created_at)
    );
  END IF;

  IF paclitaxel_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = paclitaxel_item_id
      AND action_type = 'resubmitted'
      AND negotiation_round = 2
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, created_at
    ) VALUES (
      paclitaxel_item_id, target_rc_id, 2, 'Field Rep', 'Field Rep', 'resubmitted',
      17500, 17500, 18, 18,
      COALESCE(resubmitted_at, rc_created_at)
    );
  END IF;

  IF bevacizumab_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM rate_contract_item_history
    WHERE rc_id = target_rc_id
      AND rc_item_id = bevacizumab_item_id
      AND action_type = 'resubmitted'
      AND negotiation_round = 2
  ) THEN
    INSERT INTO rate_contract_item_history (
      rc_item_id, rc_id, negotiation_round, actor_name, actor_role, action_type,
      price_before, price_after, qty_before, qty_after, created_at
    ) VALUES (
      bevacizumab_item_id, target_rc_id, 2, 'Field Rep', 'Field Rep', 'resubmitted',
      26500, 26500, 10, 10,
      COALESCE(resubmitted_at, rc_created_at)
    );
  END IF;
END $$;
