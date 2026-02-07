-- Migration 014: Pre-Merge Cryptographic Snapshots
-- Purpose: Enable reversible merge operations with cryptographic integrity
-- Related Task: 3.3.1 Implement pre-merge cryptographic snapshots

-- ============================================================================
-- 1. MERGE SNAPSHOTS TABLE (Append-Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS merge_snapshots (
    merge_snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Snapshot Data
    primary_record JSONB NOT NULL,
    secondary_records JSONB NOT NULL, -- Array of records
    
    -- Cryptographic Integrity
    snapshot_hash VARCHAR(64) NOT NULL, -- SHA-256 hex string
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL, -- User who initiated the merge
    
    -- Audit
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT merge_snapshots_tenant_id_check CHECK (tenant_id IS NOT NULL)
);

-- Index for tenant-based queries
CREATE INDEX idx_merge_snapshots_tenant_id ON merge_snapshots(tenant_id);
CREATE INDEX idx_merge_snapshots_created_at ON merge_snapshots(created_at DESC);

-- Append-only constraint: Prevent updates and deletes
CREATE OR REPLACE FUNCTION prevent_merge_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Updates to merge_snapshots are not allowed. This is an append-only table.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Deletes from merge_snapshots are not allowed. This is an append-only table.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_merge_snapshot_update
    BEFORE UPDATE ON merge_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_merge_snapshot_modification();

CREATE TRIGGER trg_prevent_merge_snapshot_delete
    BEFORE DELETE ON merge_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_merge_snapshot_modification();

-- ============================================================================
-- 2. MERGE AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS merge_audit_log (
    merge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Snapshot Reference
    merge_snapshot_id UUID NOT NULL REFERENCES merge_snapshots(merge_snapshot_id),
    
    -- Merge Details
    primary_student_id UUID NOT NULL REFERENCES students(student_id),
    secondary_student_ids UUID[] NOT NULL, -- Array of merged student IDs
    
    -- Merge Metadata
    merge_reason TEXT NOT NULL,
    merged_by UUID NOT NULL, -- User who performed the merge
    merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Reversibility
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
    reversed_at TIMESTAMPTZ,
    reversed_by UUID,
    reverse_reason TEXT,
    
    -- Impact Assessment
    affected_enrollments INTEGER DEFAULT 0,
    affected_attendance INTEGER DEFAULT 0,
    affected_payments INTEGER DEFAULT 0,
    
    -- Audit
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT merge_audit_log_tenant_id_check CHECK (tenant_id IS NOT NULL)
);

-- Indexes for efficient queries
CREATE INDEX idx_merge_audit_log_tenant_id ON merge_audit_log(tenant_id);
CREATE INDEX idx_merge_audit_log_primary_student_id ON merge_audit_log(primary_student_id);
CREATE INDEX idx_merge_audit_log_merged_at ON merge_audit_log(merged_at DESC);
CREATE INDEX idx_merge_audit_log_status ON merge_audit_log(status);

-- ============================================================================
-- 3. UPDATE STUDENTS TABLE FOR MERGE TRACKING
-- ============================================================================

-- Add merge-related columns to students table if they don't exist
DO $$
BEGIN
    -- Add merged_into column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_into'
    ) THEN
        ALTER TABLE students ADD COLUMN merged_into UUID REFERENCES students(student_id);
    END IF;
    
    -- Add merged_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_at'
    ) THEN
        ALTER TABLE students ADD COLUMN merged_at TIMESTAMPTZ;
    END IF;
    
    -- Add merged_from column (array of UUIDs)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'merged_from'
    ) THEN
        ALTER TABLE students ADD COLUMN merged_from UUID[];
    END IF;
    
    -- Update status constraint to include 'merged'
    ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
    ALTER TABLE students ADD CONSTRAINT students_status_check 
        CHECK (status IN ('active', 'inactive', 'graduated', 'transferred', 'merged'));
END $$;

-- Index for merge tracking
CREATE INDEX IF NOT EXISTS idx_students_merged_into ON students(merged_into) WHERE merged_into IS NOT NULL;

-- ============================================================================
-- 4. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on merge_snapshots
ALTER TABLE merge_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access snapshots from their tenant
CREATE POLICY merge_snapshots_tenant_isolation ON merge_snapshots
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Enable RLS on merge_audit_log
ALTER TABLE merge_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access audit logs from their tenant
CREATE POLICY merge_audit_log_tenant_isolation ON merge_audit_log
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to compute SHA-256 hash of snapshot data
CREATE OR REPLACE FUNCTION compute_snapshot_hash(
    p_primary_record JSONB,
    p_secondary_records JSONB
) RETURNS VARCHAR(64) AS $$
DECLARE
    v_concatenated TEXT;
BEGIN
    -- Concatenate primary and secondary records as text
    v_concatenated := p_primary_record::TEXT || p_secondary_records::TEXT;
    
    -- Compute SHA-256 hash using pgcrypto extension
    RETURN encode(digest(v_concatenated, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create a merge snapshot
CREATE OR REPLACE FUNCTION create_merge_snapshot(
    p_tenant_id UUID,
    p_primary_student_id UUID,
    p_secondary_student_ids UUID[],
    p_created_by UUID
) RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_primary_record JSONB;
    v_secondary_records JSONB;
    v_snapshot_hash VARCHAR(64);
BEGIN
    -- Fetch primary record
    SELECT row_to_json(s.*)::JSONB INTO v_primary_record
    FROM students s
    WHERE s.student_id = p_primary_student_id
      AND s.tenant_id = p_tenant_id;
    
    IF v_primary_record IS NULL THEN
        RAISE EXCEPTION 'Primary student record not found: %', p_primary_student_id;
    END IF;
    
    -- Fetch secondary records
    SELECT jsonb_agg(row_to_json(s.*)::JSONB) INTO v_secondary_records
    FROM students s
    WHERE s.student_id = ANY(p_secondary_student_ids)
      AND s.tenant_id = p_tenant_id;
    
    IF v_secondary_records IS NULL OR jsonb_array_length(v_secondary_records) = 0 THEN
        RAISE EXCEPTION 'No secondary student records found';
    END IF;
    
    -- Compute hash
    v_snapshot_hash := compute_snapshot_hash(v_primary_record, v_secondary_records);
    
    -- Insert snapshot
    INSERT INTO merge_snapshots (
        tenant_id,
        primary_record,
        secondary_records,
        snapshot_hash,
        created_by
    ) VALUES (
        p_tenant_id,
        v_primary_record,
        v_secondary_records,
        v_snapshot_hash,
        p_created_by
    ) RETURNING merge_snapshot_id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to verify snapshot integrity
CREATE OR REPLACE FUNCTION verify_snapshot_integrity(
    p_merge_snapshot_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_snapshot RECORD;
    v_computed_hash VARCHAR(64);
BEGIN
    -- Fetch snapshot
    SELECT primary_record, secondary_records, snapshot_hash
    INTO v_snapshot
    FROM merge_snapshots
    WHERE merge_snapshot_id = p_merge_snapshot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Snapshot not found: %', p_merge_snapshot_id;
    END IF;
    
    -- Recompute hash
    v_computed_hash := compute_snapshot_hash(
        v_snapshot.primary_record,
        v_snapshot.secondary_records
    );
    
    -- Compare hashes
    RETURN v_computed_hash = v_snapshot.snapshot_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE merge_snapshots IS 'Append-only table storing cryptographic snapshots of student records before merge operations. Enables reversibility within SLA windows.';
COMMENT ON COLUMN merge_snapshots.snapshot_hash IS 'SHA-256 hash of concatenated primary and secondary records for integrity verification';
COMMENT ON TABLE merge_audit_log IS 'Audit trail for all merge operations with bidirectional references and reversibility tracking';
COMMENT ON FUNCTION create_merge_snapshot IS 'Creates a cryptographic snapshot of student records before merge. Returns snapshot_id.';
COMMENT ON FUNCTION verify_snapshot_integrity IS 'Verifies the cryptographic integrity of a snapshot by recomputing its SHA-256 hash';

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions (adjust role names as needed)
-- GRANT SELECT, INSERT ON merge_snapshots TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON merge_audit_log TO app_user;
-- GRANT EXECUTE ON FUNCTION create_merge_snapshot TO app_user;
-- GRANT EXECUTE ON FUNCTION verify_snapshot_integrity TO app_user;
