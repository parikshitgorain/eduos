-- ============================================================================
-- Migration 011: Historic Rendering with Snapshot Association
-- Task: 2.2.5 - Implement historic rendering with snapshot association
-- ============================================================================
-- Description:
-- This migration adds support for historic rendering of student records
-- using their original schema snapshots. It includes:
-- - Schema transformations table for admin-initiated conversions
-- - Indexes for performance optimization
-- - RLS policies for tenant isolation
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE SCHEMA_TRANSFORMATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_transformations (
    transformation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    source_record_id UUID NOT NULL,
    source_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    target_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    field_mappings JSONB NOT NULL DEFAULT '{}',
    source_data JSONB NOT NULL,
    transformed_data JSONB NOT NULL,
    transformed_by UUID NOT NULL REFERENCES users(user_id),
    transformation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_transformation_status CHECK (transformation_status IN ('pending', 'completed', 'failed'))
);

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Schema transformations indexes
CREATE INDEX idx_transformations_tenant_id ON schema_transformations(tenant_id);
CREATE INDEX idx_transformations_source_record ON schema_transformations(source_record_id);
CREATE INDEX idx_transformations_source_snapshot ON schema_transformations(source_snapshot_id);
CREATE INDEX idx_transformations_target_snapshot ON schema_transformations(target_snapshot_id);
CREATE INDEX idx_transformations_status ON schema_transformations(tenant_id, transformation_status);
CREATE INDEX idx_transformations_created_at ON schema_transformations(tenant_id, created_at DESC);
CREATE INDEX idx_transformations_transformed_by ON schema_transformations(transformed_by);

-- ============================================================================
-- PART 3: ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE schema_transformations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES
-- ============================================================================

-- Schema transformations RLS policies
CREATE POLICY transformations_tenant_isolation ON schema_transformations
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- PART 5: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get transformation history for a record
CREATE OR REPLACE FUNCTION get_record_transformation_history(p_record_id UUID, p_tenant_id UUID)
RETURNS TABLE (
    transformation_id UUID,
    source_version VARCHAR,
    target_version VARCHAR,
    transformed_at TIMESTAMPTZ,
    transformed_by UUID,
    transformation_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.transformation_id,
        ss1.semantic_version AS source_version,
        ss2.semantic_version AS target_version,
        st.created_at AS transformed_at,
        st.transformed_by,
        st.transformation_status
    FROM schema_transformations st
    JOIN schema_snapshots ss1 ON st.source_snapshot_id = ss1.snapshot_id
    JOIN schema_snapshots ss2 ON st.target_snapshot_id = ss2.snapshot_id
    WHERE st.source_record_id = p_record_id 
      AND st.tenant_id = p_tenant_id
    ORDER BY st.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get records using a specific schema snapshot
CREATE OR REPLACE FUNCTION get_records_by_snapshot(p_snapshot_id UUID, p_tenant_id UUID)
RETURNS TABLE (
    record_id UUID,
    student_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.record_id,
        sr.student_id,
        sr.created_at,
        sr.updated_at
    FROM student_records sr
    WHERE sr.snapshot_id = p_snapshot_id 
      AND sr.tenant_id = p_tenant_id
    ORDER BY sr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count records per schema version
CREATE OR REPLACE FUNCTION count_records_per_schema_version(p_tenant_id UUID, p_form_type VARCHAR)
RETURNS TABLE (
    snapshot_id UUID,
    semantic_version VARCHAR,
    record_count BIGINT,
    oldest_record TIMESTAMPTZ,
    newest_record TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ss.snapshot_id,
        ss.semantic_version,
        COUNT(sr.record_id) AS record_count,
        MIN(sr.created_at) AS oldest_record,
        MAX(sr.created_at) AS newest_record
    FROM schema_snapshots ss
    LEFT JOIN student_records sr ON ss.snapshot_id = sr.snapshot_id
    WHERE ss.tenant_id = p_tenant_id 
      AND ss.form_type = p_form_type
    GROUP BY ss.snapshot_id, ss.semantic_version
    ORDER BY ss.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE schema_transformations IS 'Stores admin-initiated schema transformations for historical records. Transformations create new artifacts without modifying original records.';
COMMENT ON COLUMN schema_transformations.source_record_id IS 'Reference to the original student record being transformed';
COMMENT ON COLUMN schema_transformations.source_snapshot_id IS 'Schema snapshot used by the source record';
COMMENT ON COLUMN schema_transformations.target_snapshot_id IS 'Target schema snapshot for the transformation';
COMMENT ON COLUMN schema_transformations.field_mappings IS 'JSON object mapping source field names to target field names';
COMMENT ON COLUMN schema_transformations.source_data IS 'Original record data before transformation';
COMMENT ON COLUMN schema_transformations.transformed_data IS 'Transformed record data in target schema format';
COMMENT ON COLUMN schema_transformations.transformation_status IS 'Status: pending, completed, or failed';

COMMENT ON FUNCTION get_record_transformation_history IS 'Returns the transformation history for a specific student record';
COMMENT ON FUNCTION get_records_by_snapshot IS 'Returns all student records using a specific schema snapshot';
COMMENT ON FUNCTION count_records_per_schema_version IS 'Returns record counts grouped by schema version for a form type';

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to application role (adjust role name as needed)
-- GRANT SELECT, INSERT ON schema_transformations TO app_role;
-- GRANT EXECUTE ON FUNCTION get_record_transformation_history TO app_role;
-- GRANT EXECUTE ON FUNCTION get_records_by_snapshot TO app_role;
-- GRANT EXECUTE ON FUNCTION count_records_per_schema_version TO app_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
