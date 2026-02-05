-- Migration: 002_tenant_provisioning.sql
-- Description: Add tenant quotas and audit logs tables for tenant provisioning
-- Version: 1.0
-- Date: 2026-02-05
-- Task: 1.1.3 - Create tenant provisioning API

-- ============================================================================
-- PART 1: CREATE TENANT QUOTAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_quotas (
    quota_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Resource limits
    max_students INTEGER NOT NULL DEFAULT 500,
    max_storage_gb INTEGER NOT NULL DEFAULT 10,
    max_api_calls_per_day INTEGER NOT NULL DEFAULT 10000,
    max_concurrent_users INTEGER NOT NULL DEFAULT 50,
    
    -- Operational settings
    backup_retention_days INTEGER NOT NULL DEFAULT 30,
    support_level VARCHAR(20) NOT NULL DEFAULT 'email',
    
    -- Current usage tracking
    current_students INTEGER NOT NULL DEFAULT 0,
    current_storage_gb DECIMAL(10, 2) NOT NULL DEFAULT 0,
    current_api_calls_today INTEGER NOT NULL DEFAULT 0,
    api_calls_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tenant quota lookups
CREATE INDEX idx_tenant_quotas_tenant_id ON tenant_quotas(tenant_id);

-- Trigger to update updated_at
CREATE TRIGGER update_tenant_quotas_updated_at
    BEFORE UPDATE ON tenant_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 2: CREATE AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Event information
    event_type VARCHAR(50) NOT NULL, -- e.g., 'tenant', 'student', 'payment'
    event_action VARCHAR(50) NOT NULL, -- e.g., 'created', 'updated', 'deleted'
    
    -- Resource information
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    
    -- Actor information
    actor_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'system', 'api'
    actor_id UUID,
    
    -- Additional context
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);

-- ============================================================================
-- PART 3: CREATE FUNCTION TO CHECK QUOTA LIMITS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_student_quota()
RETURNS TRIGGER AS $$
DECLARE
    quota_record RECORD;
BEGIN
    -- Get quota for the tenant
    SELECT max_students, current_students
    INTO quota_record
    FROM tenant_quotas
    WHERE tenant_id = NEW.tenant_id;
    
    -- Check if quota exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No quota configuration found for tenant %', NEW.tenant_id;
    END IF;
    
    -- Check if limit is unlimited (-1)
    IF quota_record.max_students = -1 THEN
        RETURN NEW;
    END IF;
    
    -- Check if adding this student would exceed quota
    IF quota_record.current_students >= quota_record.max_students THEN
        RAISE EXCEPTION 'Student quota exceeded for tenant %. Current: %, Max: %',
            NEW.tenant_id, quota_record.current_students, quota_record.max_students;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check quota before inserting student
CREATE TRIGGER check_student_quota_before_insert
    BEFORE INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION check_student_quota();

-- ============================================================================
-- PART 4: CREATE FUNCTION TO UPDATE STUDENT COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_student_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment student count
        UPDATE tenant_quotas
        SET current_students = current_students + 1
        WHERE tenant_id = NEW.tenant_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement student count
        UPDATE tenant_quotas
        SET current_students = GREATEST(0, current_students - 1)
        WHERE tenant_id = OLD.tenant_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain student count
CREATE TRIGGER update_student_count_after_insert
    AFTER INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_student_count();

CREATE TRIGGER update_student_count_after_delete
    AFTER DELETE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_student_count();

-- ============================================================================
-- PART 5: CREATE FUNCTION TO RESET API CALL COUNTER
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_api_call_counter()
RETURNS void AS $$
BEGIN
    UPDATE tenant_quotas
    SET current_api_calls_today = 0,
        api_calls_reset_at = NOW()
    WHERE api_calls_reset_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_quotas TO eduos_app;
GRANT SELECT, INSERT ON audit_logs TO eduos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

INSERT INTO schema_migrations (version, description)
VALUES ('002', 'Add tenant quotas and audit logs for tenant provisioning')
ON CONFLICT (version) DO NOTHING;
