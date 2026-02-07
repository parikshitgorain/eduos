-- ============================================================================
-- Migration 017 Rollback: Invoice Generation System
-- ============================================================================
-- Description: Rolls back invoice generation tables and functions
-- Author: EduOS Team
-- Date: 2026-02-07
-- ============================================================================

-- Drop functions
DROP FUNCTION IF EXISTS detect_invoice_gaps(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS generate_invoice_number(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_invoices_updated_at();

-- Drop triggers
DROP TRIGGER IF EXISTS invoices_updated_at_trigger ON invoices;
DROP TRIGGER IF EXISTS invoice_sequences_updated_at_trigger ON invoice_sequences;

-- Drop tables (cascade to remove dependent objects)
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_sequences CASCADE;

-- Verification
DO $
BEGIN
  -- Verify tables are dropped
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    RAISE EXCEPTION 'Rollback failed: invoices table still exists';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_sequences') THEN
    RAISE EXCEPTION 'Rollback failed: invoice_sequences table still exists';
  END IF;

  RAISE NOTICE 'Migration 017 rollback completed successfully';
  RAISE NOTICE '✓ invoices table dropped';
  RAISE NOTICE '✓ invoice_sequences table dropped';
  RAISE NOTICE '✓ Functions and triggers dropped';
END $;
