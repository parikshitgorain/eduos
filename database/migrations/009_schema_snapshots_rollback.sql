-- Rollback Migration: 009_schema_snapshots_rollback.sql
-- Description: Rollback schema definition and storage system
-- Version: 1.0
-- Date: 2026-02-05

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_compute_schema_hash ON schema_snapshots;
DROP FUNCTION IF EXISTS auto_compute_schema_hash();

-- ============================================================================
-- DROP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS get_schema_fields(UUID);
DROP FUNCTION IF EXISTS get_schema_version_history(UUID, VARCHAR);
DROP FUNCTION IF EXISTS verify_schema_integrity(UUID);
DROP FUNCTION IF EXISTS get_latest_schema(UUID, VARCHAR);
DROP FUNCTION IF EXISTS compute_schema_hash(JSONB);

-- ============================================================================
-- DROP TABLES (in reverse order of dependencies)
-- ============================================================================

DROP TABLE IF EXISTS schema_imports CASCADE;
DROP TABLE IF EXISTS schema_exports CASCADE;
DROP TABLE IF EXISTS validation_rules CASCADE;
DROP TABLE IF EXISTS field_definitions CASCADE;
DROP TABLE IF EXISTS schema_snapshots CASCADE;

-- ============================================================================
-- REMOVE MIGRATION RECORD
-- ============================================================================

DELETE FROM schema_migrations WHERE version = '009';
