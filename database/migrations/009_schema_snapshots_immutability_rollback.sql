-- Rollback Migration: 009_schema_snapshots_immutability_rollback.sql
-- Description: Rollback immutability constraints from schema_snapshots table
-- Version: 1.1
-- Date: 2026-02-05
-- Task: 2.2.2 - Rollback immutable schema snapshots

-- ============================================================================
-- PART 1: DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS prevent_schema_snapshot_update ON schema_snapshots;
DROP TRIGGER IF EXISTS prevent_schema_snapshot_delete ON schema_snapshots;
DROP TRIGGER IF EXISTS prevent_field_definition_update ON field_definitions;
DROP TRIGGER IF EXISTS prevent_field_definition_delete ON field_definitions;

-- ============================================================================
-- PART 2: DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS prevent_schema_snapshot_modification();
DROP FUNCTION IF EXISTS prevent_field_definition_modification();
DROP FUNCTION IF EXISTS verify_all_schema_integrity();

-- Restore original verify_schema_integrity function
DROP FUNCTION IF EXISTS verify_schema_integrity(UUID);

CREATE OR REPLACE FUNCTION verify_schema_integrity(p_snapshot_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    stored_hash TEXT;
    computed_hash TEXT;
    schema_def JSONB;
BEGIN
    SELECT schema_hash, schema_definition INTO stored_hash, schema_def
    FROM schema_snapshots
    WHERE snapshot_id = p_snapshot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schema snapshot not found: %', p_snapshot_id;
    END IF;
    
    computed_hash := compute_schema_hash(schema_def);
    
    RETURN stored_hash = computed_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 3: DROP VIEW
-- ============================================================================

DROP VIEW IF EXISTS schema_integrity_check_history;

-- ============================================================================
-- PART 4: DROP TABLE
-- ============================================================================

DROP TABLE IF EXISTS schema_integrity_checks;

-- ============================================================================
-- PART 5: REMOVE MIGRATION RECORD
-- ============================================================================

DELETE FROM schema_migrations WHERE version = '009b';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

