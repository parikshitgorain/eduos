-- Migration: 010_schema_migration_engine.sql
-- Description: Create schema migration engine with dry-run mode and rollback capabilities
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 2.2.4 - Build schema migration engine with dry-run mode

-- ============================================================================
-- PART 1: CREATE SCHEMA_MIGRATION_DRY_RUNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migration_dry_runs (
    dry_run_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    from_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    to_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    report_data JSONB NOT NULL, -- Full dry-run report with impact analysis
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 2: CREATE SCHEMA_MIGRATIONS_LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations_log (
    migration_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    from_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    to_snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    migration_status VARCHAR(20) NOT NULL CHECK (migration_status IN ('in_progress', 'completed', 'failed', 'rolled_back')),
    executed_by UUID NOT NULL REFERENCES users(user_id),
    dry_run_id UUID REFERENCES schema_migration_dry_runs(dry_run_id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 3: CREATE SCHEMA_MIGRATION_SNAPSHOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migration_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES schema_migrations_log(migration_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('before', 'after')),
    snapshot_data JSONB NOT NULL, -- Full data snapshot for rollback
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 4: CREATE STUDENT_RECORDS TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    snapshot_id UUID NOT NULL REFERENCES schema_snapshots(snapshot_id),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

-- ============================================================================
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Dry-run indexes
CREATE INDEX idx_dry_runs_tenant_id ON schema_migration_dry_runs(tenant_id);
CREATE INDEX idx_dry_runs_from_snapshot ON schema_migration_dry_runs(from_snapshot_id);
CREATE INDEX idx_dry_runs_to_snapshot ON schema_migration_dry_runs(to_snapshot_id);
CREATE INDEX idx_dry_runs_executed_at ON schema_migration_dry_runs(tenant_id, executed_at DESC);

-- Migration log indexes
CREATE INDEX idx_migrations_log_tenant_id ON schema_migrations_log(tenant_id);
CREATE INDEX idx_migrations_log_status ON schema_migrations_log(tenant_id, migration_status);
CREATE INDEX idx_migrations_log_started_at ON schema_migrations_log(tenant_id, started_at DESC);
CREATE INDEX idx_migrations_log_from_snapshot ON schema_migrations_log(from_snapshot_id);
CREATE INDEX idx_migrations_log_to_snapshot ON schema_migrations_log(to_snapshot_id);

-- Migration snapshots indexes
CREATE INDEX idx_migration_snapshots_migration_id ON schema_migration_snapshots(migration_id);
CREATE INDEX idx_migration_snapshots_tenant_id ON schema_migration_snapshots(tenant_id);
CREATE INDEX idx_migration_snapshots_type ON schema_migration_snapshots(migration_id, snapshot_type);

-- Student records indexes
CREATE INDEX idx_student_records_tenant_id ON student_records(tenant_id);
CREATE INDEX idx_student_records_student_id ON student_records(student_id);
CREATE INDEX idx_student_records_snapshot_id ON student_records(snapshot_id);
CREATE INDEX idx_student_records_created_at ON student_records(tenant_id, created_at DESC);

-- ============================================================================
-- PART 6: ENABLE ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE schema_migration_dry_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 7: CREATE RLS POLICIES
-- ============================================================================

-- Dry-run RLS policies
CREATE POLICY dry_runs_tenant_isolation ON schema_migration_dry_runs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Migration log RLS policies
CREATE POLICY migrations_log_tenant_isolation ON schema_migrations_log
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Migration snapshots RLS policies
CREATE POLICY migration_snapshots_tenant_isolation ON schema_migration_snapshots
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Student records RLS policies
CREATE POLICY student_records_tenant_isolation ON student_records
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- PART 8: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get migration status
CREATE OR REPLACE FUNCTION get_migration_status(p_migration_id UUID)
RETURNS TABLE (
    migration_id UUID,
    status VARCHAR,
    from_version VARCHAR,
    to_version VARCHAR,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ml.migration_id,
        ml.migration_status,
        fs.semantic_version,
        ts.semantic_version,
        ml.started_at,
        ml.completed_at,
        EXTRACT(EPOCH FROM (COALESCE(ml.completed_at, NOW()) - ml.started_at))
    FROM schema_migrations_log ml
    JOIN schema_snapshots fs ON ml.from_snapshot_id = fs.snapshot_id
    JOIN schema_snapshots ts ON ml.to_snapshot_id = ts.snapshot_id
    WHERE ml.migration_id = p_migration_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get latest migration for a form type
CREATE OR REPLACE FUNCTION get_latest_migration(p_tenant_id UUID, p_form_type VARCHAR)
RETURNS TABLE (
    migration_id UUID,
    from_version VARCHAR,
    to_version VARCHAR,
    status VARCHAR,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ml.migration_id,
        fs.semantic_version,
        ts.semantic_version,
        ml.migration_status,
        ml.started_at
    FROM schema_migrations_log ml
    JOIN schema_snapshots fs ON ml.from_snapshot_id = fs.snapshot_id
    JOIN schema_snapshots ts ON ml.to_snapshot_id = ts.snapshot_id
    WHERE ml.tenant_id = p_tenant_id
      AND fs.form_type = p_form_type
    ORDER BY ml.started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to count records affected by migration
CREATE OR REPLACE FUNCTION count_affected_records(p_tenant_id UUID, p_snapshot_id UUID)
RETURNS INTEGER AS $$
DECLARE
    record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO record_count
    FROM student_records
    WHERE tenant_id = p_tenant_id
      AND snapshot_id = p_snapshot_id;
    
    RETURN record_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 9: CREATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp on student_records
CREATE OR REPLACE FUNCTION update_student_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_record_timestamp
    BEFORE UPDATE ON student_records
    FOR EACH ROW
    EXECUTE FUNCTION update_student_record_timestamp();

-- Trigger to validate migration status transitions
CREATE OR REPLACE FUNCTION validate_migration_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow valid status transitions
    IF OLD.migration_status = 'completed' AND NEW.migration_status != 'completed' THEN
        RAISE EXCEPTION 'Cannot change status of completed migration';
    END IF;
    
    IF OLD.migration_status = 'failed' AND NEW.migration_status NOT IN ('failed', 'rolled_back') THEN
        RAISE EXCEPTION 'Failed migration can only be marked as rolled_back';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_migration_status
    BEFORE UPDATE ON schema_migrations_log
    FOR EACH ROW
    WHEN (OLD.migration_status IS DISTINCT FROM NEW.migration_status)
    EXECUTE FUNCTION validate_migration_status_transition();

-- ============================================================================
-- PART 10: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migration_dry_runs TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migrations_log TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migration_snapshots TO eduos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_records TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('010', 'Create schema migration engine with dry-run mode and rollback capabilities')
ON CONFLICT (version) DO NOTHING;
