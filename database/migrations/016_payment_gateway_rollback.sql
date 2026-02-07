-- ============================================================================
-- Migration 016 Rollback: Payment Gateway Integration
-- ============================================================================
-- Description: Rolls back payment gateway tables and functions
-- Author: EduOS Team
-- Date: 2026-02-07
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;

-- Drop functions
DROP FUNCTION IF EXISTS update_payments_updated_at();
DROP FUNCTION IF EXISTS cleanup_old_webhook_logs();

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS webhook_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- Verification
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    RAISE EXCEPTION 'Rollback failed: payments table still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs') THEN
    RAISE EXCEPTION 'Rollback failed: webhook_logs table still exists';
  END IF;

  RAISE NOTICE 'Migration 016 rollback completed successfully';
  RAISE NOTICE '✓ payments table dropped';
  RAISE NOTICE '✓ webhook_logs table dropped';
  RAISE NOTICE '✓ All related functions and triggers dropped';
END $$;
