-- ============================================================================
-- Migration 018 Rollback: Refund Workflow with Approval Chain
-- ============================================================================
-- Description: Rolls back refund workflow tables and functions
-- Author: EduOS Team
-- Date: 2026-02-07
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS refund_requests_updated_at_trigger ON refund_requests;
DROP TRIGGER IF EXISTS credit_notes_updated_at_trigger ON credit_notes;
DROP TRIGGER IF EXISTS validate_refund_amount_trigger ON refund_requests;

-- Drop functions
DROP FUNCTION IF EXISTS update_refund_requests_updated_at();
DROP FUNCTION IF EXISTS update_credit_notes_updated_at();
DROP FUNCTION IF EXISTS validate_refund_amount();
DROP FUNCTION IF EXISTS generate_credit_note_number(UUID);

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS credit_notes CASCADE;
DROP TABLE IF EXISTS refund_approval_history CASCADE;
DROP TABLE IF EXISTS refund_requests CASCADE;

-- Verification
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_requests') THEN
    RAISE EXCEPTION 'Rollback failed: refund_requests table still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_approval_history') THEN
    RAISE EXCEPTION 'Rollback failed: refund_approval_history table still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_notes') THEN
    RAISE EXCEPTION 'Rollback failed: credit_notes table still exists';
  END IF;

  RAISE NOTICE 'Migration 018 rollback completed successfully';
  RAISE NOTICE '✓ refund_requests table dropped';
  RAISE NOTICE '✓ refund_approval_history table dropped';
  RAISE NOTICE '✓ credit_notes table dropped';
  RAISE NOTICE '✓ All functions and triggers dropped';
END $;
