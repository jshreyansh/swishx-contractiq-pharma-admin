-- Seed RCs that explicitly populate the division and final approval inboxes

DO $$
DECLARE
  apollo_id uuid;
  aiims_id uuid;
  cardio_id uuid;
  neuro_id uuid;
  rep1_id uuid;
  div_approver_cardio_id uuid;
  div_approver_neuro_id uuid;
  final_approver1_id uuid;
  final_approver2_id uuid;
  rc4_id uuid;
  rc5_id uuid;
BEGIN
  SELECT id INTO apollo_id FROM hospitals WHERE name ILIKE '%Apollo%' LIMIT 1;
  SELECT id INTO aiims_id FROM hospitals WHERE name ILIKE '%AIIMS%' LIMIT 1;

  SELECT id INTO cardio_id FROM divisions WHERE code = 'CARDIO' LIMIT 1;
  SELECT id INTO neuro_id FROM divisions WHERE code = 'NEURO' LIMIT 1;

  SELECT id INTO rep1_id FROM field_reps ORDER BY created_at LIMIT 1;

  SELECT id INTO div_approver_cardio_id
  FROM app_users
  WHERE email = 'anand.mehta@swishx.com'
  LIMIT 1;

  IF div_approver_cardio_id IS NULL THEN
    SELECT id INTO div_approver_cardio_id
    FROM app_users
    WHERE role = 'division_approver' AND division_id = cardio_id
    ORDER BY created_at
    LIMIT 1;
  END IF;

  SELECT id INTO div_approver_neuro_id
  FROM app_users
  WHERE email = 'suresh.iyer.div@swishx.com'
  LIMIT 1;

  IF div_approver_neuro_id IS NULL THEN
    SELECT id INTO div_approver_neuro_id
    FROM app_users
    WHERE role = 'division_approver' AND division_id = neuro_id
    ORDER BY created_at
    LIMIT 1;
  END IF;

  SELECT id INTO final_approver1_id
  FROM app_users
  WHERE email = 'arvind.kapoor@swishx.com'
  LIMIT 1;

  IF final_approver1_id IS NULL THEN
    SELECT id INTO final_approver1_id
    FROM app_users
    WHERE role = 'final_approver'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  SELECT id INTO final_approver2_id
  FROM app_users
  WHERE email = 'meera.joshi@swishx.com'
  LIMIT 1;

  IF final_approver2_id IS NULL THEN
    SELECT id INTO final_approver2_id
    FROM app_users
    WHERE role = 'final_approver'
    ORDER BY created_at
    OFFSET 1
    LIMIT 1;
  END IF;

  -- RC-2026-004: pending in default cardiology division inbox
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-004') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-004', apollo_id, rep1_id, 'PENDING', '2026-04-20', '2026-07-31',
      195000,
      'Cardiology renewal waiting for division commercial sign-off.',
      now() - interval '2 days',
      now() - interval '4 hours'
    )
    RETURNING id INTO rc4_id;

    INSERT INTO rate_contract_items (
      rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty
    )
    VALUES
      (rc4_id, 'Atorvastatin 20mg', cardio_id, 94, 1500, 1800, 0),
      (rc4_id, 'Amlodipine 5mg', cardio_id, 60, 900, 1100, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name, sequence_order, status
    )
    VALUES
      (
        rc4_id, 'division', cardio_id, div_approver_cardio_id,
        COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Cardiology Approver'),
        1, 'pending'
      ),
      (
        rc4_id, 'final', NULL, final_approver1_id,
        COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
        1, 'pending'
      ),
      (
        rc4_id, 'final', NULL, final_approver2_id,
        COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
        2, 'pending'
      );

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (
        rc4_id, 'Ramesh CFA', 'CFA',
        'Rate contract RC-2026-004 submitted to cardiology division for review.',
        'created', now() - interval '2 days'
      );
  END IF;

  -- RC-2026-005: division-complete and waiting in final approver inboxes
  IF NOT EXISTS (SELECT 1 FROM rate_contracts WHERE rc_code = 'RC-2026-005') THEN
    INSERT INTO rate_contracts (
      rc_code, hospital_id, rep_id, status, valid_from, valid_to,
      total_value, notes, created_at, updated_at
    )
    VALUES (
      'RC-2026-005', aiims_id, rep1_id, 'PENDING', '2026-04-18', '2026-08-31',
      168900,
      'Commercial terms cleared by divisions; awaiting final approval.',
      now() - interval '5 days',
      now() - interval '10 hours'
    )
    RETURNING id INTO rc5_id;

    INSERT INTO rate_contract_items (
      rc_id, product_name, division_id, negotiated_price, expected_qty, cap_qty, used_qty
    )
    VALUES
      (rc5_id, 'Atorvastatin 20mg', cardio_id, 93, 800, 1000, 0),
      (rc5_id, 'Levodopa 250mg', neuro_id, 315, 300, 360, 0);

    INSERT INTO rate_contract_approvals (
      rc_id, approval_stage, division_id, approver_user_id, approver_name,
      sequence_order, status, decided_at
    )
    VALUES
      (
        rc5_id, 'division', cardio_id, div_approver_cardio_id,
        COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Cardiology Approver'),
        1, 'approved', now() - interval '2 days'
      ),
      (
        rc5_id, 'division', neuro_id, div_approver_neuro_id,
        COALESCE((SELECT name FROM app_users WHERE id = div_approver_neuro_id), 'Neurology Approver'),
        2, 'approved', now() - interval '36 hours'
      ),
      (
        rc5_id, 'final', NULL, final_approver1_id,
        COALESCE((SELECT name FROM app_users WHERE id = final_approver1_id), 'Final Approver 1'),
        1, 'pending', NULL
      ),
      (
        rc5_id, 'final', NULL, final_approver2_id,
        COALESCE((SELECT name FROM app_users WHERE id = final_approver2_id), 'Final Approver 2'),
        2, 'pending', NULL
      );

    INSERT INTO rate_contract_timeline (rc_id, actor_name, actor_role, action, action_type, created_at)
    VALUES
      (
        rc5_id, 'Ramesh CFA', 'CFA',
        'Rate contract RC-2026-005 submitted for approvals.',
        'created', now() - interval '5 days'
      ),
      (
        rc5_id, COALESCE((SELECT name FROM app_users WHERE id = div_approver_cardio_id), 'Cardiology Approver'),
        'Division Approver',
        'Cardiology division approved commercial terms.',
        'division_approved', now() - interval '2 days'
      ),
      (
        rc5_id, COALESCE((SELECT name FROM app_users WHERE id = div_approver_neuro_id), 'Neurology Approver'),
        'Division Approver',
        'Neurology division approved commercial terms.',
        'division_approved', now() - interval '36 hours'
      );
  END IF;
END $$;
