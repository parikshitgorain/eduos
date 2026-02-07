-- Rollback Migration 019: Bank Reconciliation System
-- Description: Removes bank reconciliation tables and functions
-- Version: 1.0
-- Date: 2026-02-07

-- Drop helper functions
DROP FUNCTION IF EXISTS update_reconciliation_session_stats(UUID);
DROP FUNCTION IF EXISTS update_reconciliation_updated_at();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS reconciliation_discrepancies CASCADE;
DROP TABLE IF EXISTS reconciliation_matches CASCADE;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS bank_reconciliation_sessions CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
