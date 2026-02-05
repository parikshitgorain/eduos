-- ============================================================================
-- Migration 011 Rollback: Historic Rendering with Snapshot Association
-- Task: 2.2.5 - Implement historic rendering with snapshot association
-- ============================================================================
-- Description:
-- This rollback script removes all objects created by migration 011
-- ============================================================================

-- ============================================================================
-- PART 1: DROP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS count_records_per_schema_version(UUID, VARCHAR);
DROP FUNCTION IF EXISTS get_records_by_snapshot(UUID, UUID);
DROP FUNCTION IF EXISTS get_record_transformation_history(UUID, UUID);

-- ============================================================================
-- PART 2: DROP INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_transformations_transformed_by;
DROP INDEX IF EXISTS idx_transformations_created_at;
DROP INDEX IF EXISTS idx_transformations_status;
DROP INDEX IF EXISTS idx_transformations_target_snapshot;
DROP INDEX IF EXISTS idx_transformations_source_snapshot;
DROP INDEX IF EXISTS idx_transformations_source_record;
DROP INDEX IF EXISTS idx_transformations_tenant_id;

-- ============================================================================
-- PART 3: DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS schema_transformations;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
