-- RC Negotiation Loop: adds workflow_stage and negotiation_round to support
-- multi-round division ↔ field-rep negotiation before final approval.

-- 1. workflow_stage column on rate_contracts (existing rows default to 'division_review')
ALTER TABLE rate_contracts
  ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'division_review';

-- 2. negotiation_round on rate_contracts (max 2 rounds per spec)
ALTER TABLE rate_contracts
  ADD COLUMN IF NOT EXISTS negotiation_round integer NOT NULL DEFAULT 1;

-- 3. negotiation_round on approvals so round-1 and round-2 rows are distinct
ALTER TABLE rate_contract_approvals
  ADD COLUMN IF NOT EXISTS negotiation_round integer NOT NULL DEFAULT 1;

-- 4. Backfill workflow_stage from existing status values
--    PENDING rows stay at default 'division_review' (already correct)
UPDATE rate_contracts SET workflow_stage = 'approved'                    WHERE status = 'APPROVED';
UPDATE rate_contracts SET workflow_stage = 'final_rejected'              WHERE status = 'REJECTED';
UPDATE rate_contracts SET workflow_stage = 'hospital_acceptance_pending' WHERE status = 'DRAFT';

-- 5. Add CHECK constraints after backfill to avoid conflicts on existing data
ALTER TABLE rate_contracts
  ADD CONSTRAINT rate_contracts_workflow_stage_check
    CHECK (workflow_stage IN (
      'hospital_acceptance_pending',
      'division_review',
      'sent_back_to_field_rep',
      'resubmitted',
      'final_approval_pending',
      'approved',
      'final_rejected',
      'discarded'
    ));

ALTER TABLE rate_contracts
  ADD CONSTRAINT rate_contracts_negotiation_round_check
    CHECK (negotiation_round BETWEEN 1 AND 2);

-- 6. Indexes for common workflow queries
CREATE INDEX IF NOT EXISTS idx_rc_workflow_stage    ON rate_contracts(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_rc_approvals_round   ON rate_contract_approvals(rc_id, negotiation_round, approval_stage);
