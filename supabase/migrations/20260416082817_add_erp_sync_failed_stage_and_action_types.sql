/*
  # Add ERP sync failure handling stages and action types

  ## Summary
  Extends the orders and order_timeline tables to support the ERP sync failure
  recovery workflow introduced for CFA users.

  ## Changes

  ### orders table
  - Drops and recreates the `stage` CHECK constraint to include:
    - `erp_sync_done` (final ERP sync confirmed by final approver)
    - `erp_sync_failed` (ERP sync attempt failed, awaiting CFA recovery action)
  - The `erp_status` column already includes `sync_failed` and `resync_required`
    so no change needed there.

  ### order_timeline table
  - Drops and recreates the `action_type` CHECK constraint to include:
    - `erp_sync_done` (final approver confirmed ERP sync)
    - `erp_sync_failed` (ERP sync marked as failed)
    - `erp_retry` (CFA retried sync)

  ## Security
  - No RLS policy changes required; existing policies cover new stages.
*/

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_stage_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_stage_check CHECK (stage IN (
    'created',
    'hospital_confirmed',
    'pending_manager_approval',
    'manager_approved',
    'pending_erp_entry',
    'erp_entered',
    'erp_sync_failed',
    'division_processing',
    'division_partially_approved',
    'division_partially_rejected',
    'final_approval_pending',
    'final_approved',
    'final_rejected',
    'erp_sync_done',
    'sent_to_supply_chain',
    'sent_to_stockist',
    'fulfillment_pending',
    'completed'
  ));

ALTER TABLE order_timeline
  DROP CONSTRAINT IF EXISTS order_timeline_action_type_check;

ALTER TABLE order_timeline
  ADD CONSTRAINT order_timeline_action_type_check CHECK (action_type IN (
    'created',
    'confirmed',
    'approved',
    'rejected',
    'erp_synced',
    'erp_manual',
    'erp_sync_failed',
    'erp_retry',
    'erp_sync_done',
    'division_approved',
    'division_rejected',
    'final_approved',
    'final_rejected',
    'edited',
    'email_sent',
    'released',
    'note_added',
    'stage_changed'
  ));
