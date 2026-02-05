-- Migration: 009_schema_snapshots_immutability.sql
-- Description: Add immutability constraints to schema_snapshots table
-- Version: 1.1
-- Date: 2026-02-05
-- Task: 2.2.2 - Implement immutable schema snapshots with SHA-256 hashing

-- ============================================================================
-- PART 1: ADD APPEND-ONLY CONSTRAINT TO SCHEMA_SNAPSHOTS
-- ============================================================================

-- Drop existing trigger if it exists (from previous migration)
DROP TRIGGER IF EXISTS prevent_schema_snapshot_update ON schema_snapshots;
DROP TRIGGER IF EXISTS prevent_schema_snapshot_delete ON schema_snapshots;
DROP FUNCTION IF EXISTS prevent_schema_snapshot_modification();

-- Create function to prevent updates and deletes on schema_snapshots
CREATE OR REPLACE FUNCTION prevent_schema_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Schema snapshots are immutable. Updates and deletes are not allowed. Snapshot ID: %', 
        COALESCE(OLD.snapshot_id::text, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent UPDATE operations
CREATE TRIGGER prevent_schema_snapshot_update
    BEFORE UPDATE ON schema_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_schema_snapshot_modification();

-- Create trigger to prevent DELETE operations
CREATE TRIGGER prevent_schema_snapshot_delete
    BEFORE DELETE ON schema_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_schema_snapshot_modification();

-- ============================================================================
-- PART 2: ADD APPEND-ONLY CONSTRAINT TO FIELD_DEFINITIONS
-- ============================================================================

-- Create function to prevent updates and deletes on field_definitions
CREATE OR REPLACE FUNCTION prevent_field_definition_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Field definitions are immutable. Updates and deletes are not allowed. Field ID: %', 
        COALESCE(OLD.field_id::text, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent UPDATE operations on field_definitions
CREATE TRIGGER prevent_field_definition_update
    BEFORE UPDATE ON field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_field_definition_modification();

-- Create trigger to prevent DELETE operations on field_definitions
CREATE TRIGGER prevent_field_definition_delete
    BEFORE DELETE ON field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_field_definition_modification();

-- ============================================================================
-- PART 3: CREATE INTEGRITY CHECK LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_integrity_checks (
    check_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_completed_at TIMESTAMPTZ,
    total_snapshots_checked INTEGER NOT NULL DEFAULT 0,
    failed_snapshots INTEGER NOT NULL DEFAULT 0,
    check_status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (check_status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    failed_snapshot_ids UUID[] DEFAULT ARRAY[]::UUID[],
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for integrity check queries
CREATE INDEX idx_schema_integrity_checks_started_at ON schema_integrity_checks(check_started_at DESC);
CREATE INDEX idx_schema_integrity_checks_status ON schema_integrity_checks(check_status);

-- ============================================================================
-- PART 4: CREATE FUNCTION FOR BATCH INTEGRITY VERIFICATION
-- ============================================================================

-- Function to verify integrity of all schema snapshots
CREATE OR REPLACE FUNCTION verify_all_schema_integrity()
RETURNS TABLE (
    check_id UUID,
    total_checked INTEGER,
    failed_count INTEGER,
    failed_snapshots UUID[],
    check_duration INTERVAL
) AS $$
DECLARE
    v_check_id UUID;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_total INTEGER := 0;
    v_failed INTEGER := 0;
    v_failed_ids UUID[] := ARRAY[]::UUID[];
    v_snapshot RECORD;
    v_computed_hash TEXT;
    v_is_valid BOOLEAN;
BEGIN
    -- Create check record
    INSERT INTO schema_integrity_checks (check_started_at, check_status)
    VALUES (NOW(), 'running')
    RETURNING schema_integrity_checks.check_id INTO v_check_id;
    
    v_start_time := NOW();
    
    -- Iterate through all snapshots
    FOR v_snapshot IN 
        SELECT snapshot_id, schema_hash, schema_definition
        FROM schema_snapshots
        ORDER BY created_at ASC
    LOOP
        v_total := v_total + 1;
        
        -- Compute hash
        v_computed_hash := encode(digest(v_snapshot.schema_definition::text, 'sha256'), 'hex');
        
        -- Check if hash matches
        v_is_valid := (v_snapshot.schema_hash = v_computed_hash);
        
        IF NOT v_is_valid THEN
            v_failed := v_failed + 1;
            v_failed_ids := array_append(v_failed_ids, v_snapshot.snapshot_id);
            
            -- Log the failure
            RAISE WARNING 'Integrity check failed for snapshot %: stored_hash=%, computed_hash=%',
                v_snapshot.snapshot_id, v_snapshot.schema_hash, v_computed_hash;
        END IF;
    END LOOP;
    
    v_end_time := NOW();
    
    -- Update check record
    UPDATE schema_integrity_checks
    SET 
        check_completed_at = v_end_time,
        total_snapshots_checked = v_total,
        failed_snapshots = v_failed,
        failed_snapshot_ids = v_failed_ids,
        check_status = CASE WHEN v_failed > 0 THEN 'failed' ELSE 'completed' END,
        metadata = jsonb_build_object(
            'duration_seconds', EXTRACT(EPOCH FROM (v_end_time - v_start_time)),
            'success_rate', CASE WHEN v_total > 0 THEN ((v_total - v_failed)::float / v_total * 100) ELSE 100 END
        )
    WHERE schema_integrity_checks.check_id = v_check_id;
    
    -- Return results
    RETURN QUERY
    SELECT 
        v_check_id,
        v_total,
        v_failed,
        v_failed_ids,
        v_end_time - v_start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: CREATE FUNCTION FOR SINGLE SNAPSHOT VERIFICATION
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS verify_schema_integrity(UUID);

-- Enhanced verify_schema_integrity function with detailed logging
CREATE OR REPLACE FUNCTION verify_schema_integrity(p_snapshot_id UUID)
RETURNS TABLE (
    is_valid BOOLEAN,
    stored_hash TEXT,
    computed_hash TEXT,
    snapshot_id UUID,
    semantic_version VARCHAR,
    created_at TIMESTAMPTZ,
    verification_timestamp TIMESTAMPTZ
) AS $$
DECLARE
    v_stored_hash TEXT;
    v_computed_hash TEXT;
    v_schema_def JSONB;
    v_version VARCHAR;
    v_created TIMESTAMPTZ;
BEGIN
    -- Fetch snapshot data
    SELECT 
        ss.schema_hash, 
        ss.schema_definition,
        ss.semantic_version,
        ss.created_at
    INTO v_stored_hash, v_schema_def, v_version, v_created
    FROM schema_snapshots ss
    WHERE ss.snapshot_id = p_snapshot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schema snapshot not found: %', p_snapshot_id;
    END IF;
    
    -- Compute hash
    v_computed_hash := encode(digest(v_schema_def::text, 'sha256'), 'hex');
    
    -- Return verification result
    RETURN QUERY
    SELECT 
        v_stored_hash = v_computed_hash AS is_valid,
        v_stored_hash AS stored_hash,
        v_computed_hash AS computed_hash,
        p_snapshot_id AS snapshot_id,
        v_version AS semantic_version,
        v_created AS created_at,
        NOW() AS verification_timestamp;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 6: CREATE VIEW FOR INTEGRITY CHECK HISTORY
-- ============================================================================

CREATE OR REPLACE VIEW schema_integrity_check_history AS
SELECT 
    check_id,
    check_started_at,
    check_completed_at,
    check_completed_at - check_started_at AS duration,
    total_snapshots_checked,
    failed_snapshots,
    CASE 
        WHEN total_snapshots_checked > 0 
        THEN ROUND(((total_snapshots_checked - failed_snapshots)::numeric / total_snapshots_checked * 100), 2)
        ELSE 100.0
    END AS success_rate_percent,
    check_status,
    array_length(failed_snapshot_ids, 1) AS failed_count,
    failed_snapshot_ids,
    error_message,
    metadata
FROM schema_integrity_checks
ORDER BY check_started_at DESC;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON schema_integrity_checks TO eduos_app;
GRANT INSERT ON schema_integrity_checks TO eduos_app;
GRANT UPDATE ON schema_integrity_checks TO eduos_app;
GRANT SELECT ON schema_integrity_check_history TO eduos_app;

-- ============================================================================
-- PART 8: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE schema_snapshots IS 'Immutable schema snapshots with append-only constraint. Updates and deletes are prevented by triggers.';
COMMENT ON TABLE field_definitions IS 'Immutable field definitions linked to schema snapshots. Updates and deletes are prevented by triggers.';
COMMENT ON TABLE schema_integrity_checks IS 'Log of nightly cryptographic integrity checks for schema snapshots.';
COMMENT ON FUNCTION verify_all_schema_integrity() IS 'Verifies SHA-256 integrity of all schema snapshots. Returns check results.';
COMMENT ON FUNCTION verify_schema_integrity(UUID) IS 'Verifies SHA-256 integrity of a single schema snapshot.';
COMMENT ON FUNCTION prevent_schema_snapshot_modification() IS 'Trigger function that prevents updates and deletes on schema_snapshots table.';
COMMENT ON FUNCTION prevent_field_definition_modification() IS 'Trigger function that prevents updates and deletes on field_definitions table.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Update migration tracking
INSERT INTO schema_migrations (version, description)
VALUES ('009b', 'Add immutability constraints and integrity checking to schema snapshots')
ON CONFLICT (version) DO NOTHING;

