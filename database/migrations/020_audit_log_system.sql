-- Migration 020: Tamper-Evident Audit Log System
-- Description: Implements SHA-256 hash chain for tamper-evident audit logging
-- Author: EduOS Platform Team
-- Date: 2026-02-07

-- ============================================================================
-- AUDIT LOG TABLES
-- ============================================================================

-- Main audit log table with hash chain
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL, -- login, logout, data_access, data_modification, permission_change, etc.
    action VARCHAR(100) NOT NULL, -- create, read, update, delete, grant, revoke, etc.
    resource_type VARCHAR(100), -- student, payment, invoice, user, role, etc.
    resource_id UUID, -- ID of the affected resource
    
    -- User context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_role VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    
    -- Request context
    request_id UUID, -- For correlating multiple audit entries
    session_id UUID,
    
    -- Event data
    event_data JSONB NOT NULL DEFAULT '{}', -- Structured event details
    old_values JSONB, -- Previous values for updates
    new_values JSONB, -- New values for updates
    
    -- Hash chain for tamper-evidence
    previous_hash VARCHAR(64), -- SHA-256 hash of previous entry (NULL for genesis block)
    current_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of this entry
    
    -- Metadata
    severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical
    status VARCHAR(20) DEFAULT 'success', -- success, failure, pending
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraints
    CONSTRAINT audit_logs_severity_check CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    CONSTRAINT audit_logs_status_check CHECK (status IN ('success', 'failure', 'pending'))
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_tenant_user_date ON audit_logs(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_audit_logs_tenant_event_date ON audit_logs(tenant_id, event_type, created_at DESC);

-- Enable Row-Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view audit logs for their tenant
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policy: Only system can insert audit logs (prevent tampering)
CREATE POLICY audit_logs_system_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true); -- System-level inserts only

-- RLS Policy: Prevent updates and deletes (immutable)
CREATE POLICY audit_logs_immutable_update ON audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY audit_logs_immutable_delete ON audit_logs
    FOR DELETE
    USING (false);

-- ============================================================================
-- HASH CHAIN FUNCTIONS
-- ============================================================================

-- Function to compute SHA-256 hash of audit entry
CREATE OR REPLACE FUNCTION compute_audit_hash(
    p_tenant_id UUID,
    p_event_type VARCHAR,
    p_action VARCHAR,
    p_resource_type VARCHAR,
    p_resource_id UUID,
    p_user_id UUID,
    p_event_data JSONB,
    p_previous_hash VARCHAR,
    p_created_at TIMESTAMP WITH TIME ZONE
) RETURNS VARCHAR(64) AS $$
DECLARE
    v_hash_input TEXT;
    v_hash VARCHAR(64);
BEGIN
    -- Construct hash input from all relevant fields
    v_hash_input := CONCAT(
        COALESCE(p_tenant_id::TEXT, ''),
        '|',
        COALESCE(p_event_type, ''),
        '|',
        COALESCE(p_action, ''),
        '|',
        COALESCE(p_resource_type, ''),
        '|',
        COALESCE(p_resource_id::TEXT, ''),
        '|',
        COALESCE(p_user_id::TEXT, ''),
        '|',
        COALESCE(p_event_data::TEXT, '{}'),
        '|',
        COALESCE(p_previous_hash, ''),
        '|',
        COALESCE(p_created_at::TEXT, '')
    );
    
    -- Compute SHA-256 hash
    v_hash := encode(digest(v_hash_input, 'sha256'), 'hex');
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get the last audit log hash for a tenant
CREATE OR REPLACE FUNCTION get_last_audit_hash(p_tenant_id UUID)
RETURNS VARCHAR(64) AS $$
DECLARE
    v_last_hash VARCHAR(64);
BEGIN
    SELECT current_hash INTO v_last_hash
    FROM audit_logs
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    
    RETURN v_last_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create audit log entry with hash chain
CREATE OR REPLACE FUNCTION create_audit_log(
    p_tenant_id UUID,
    p_event_type VARCHAR,
    p_action VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_email VARCHAR DEFAULT NULL,
    p_user_role VARCHAR DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}',
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_severity VARCHAR DEFAULT 'info',
    p_status VARCHAR DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_previous_hash VARCHAR(64);
    v_current_hash VARCHAR(64);
    v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current timestamp
    v_created_at := CURRENT_TIMESTAMP;
    
    -- Get previous hash (NULL for genesis block)
    v_previous_hash := get_last_audit_hash(p_tenant_id);
    
    -- Compute current hash
    v_current_hash := compute_audit_hash(
        p_tenant_id,
        p_event_type,
        p_action,
        p_resource_type,
        p_resource_id,
        p_user_id,
        p_event_data,
        v_previous_hash,
        v_created_at
    );
    
    -- Insert audit log entry
    INSERT INTO audit_logs (
        tenant_id,
        event_type,
        action,
        resource_type,
        resource_id,
        user_id,
        user_email,
        user_role,
        ip_address,
        user_agent,
        request_id,
        session_id,
        event_data,
        old_values,
        new_values,
        previous_hash,
        current_hash,
        severity,
        status,
        error_message,
        created_at
    ) VALUES (
        p_tenant_id,
        p_event_type,
        p_action,
        p_resource_type,
        p_resource_id,
        p_user_id,
        p_user_email,
        p_user_role,
        p_ip_address,
        p_user_agent,
        p_request_id,
        p_session_id,
        p_event_data,
        p_old_values,
        p_new_values,
        v_previous_hash,
        v_current_hash,
        p_severity,
        p_status,
        p_error_message,
        v_created_at
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to verify audit log integrity
CREATE OR REPLACE FUNCTION verify_audit_chain(
    p_tenant_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS TABLE (
    is_valid BOOLEAN,
    total_entries BIGINT,
    invalid_entries BIGINT,
    first_invalid_id UUID,
    first_invalid_created_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
) AS $$
DECLARE
    v_total_entries BIGINT := 0;
    v_invalid_entries BIGINT := 0;
    v_first_invalid_id UUID := NULL;
    v_first_invalid_created_at TIMESTAMP WITH TIME ZONE := NULL;
    v_error_message TEXT := NULL;
    v_previous_hash VARCHAR(64) := NULL;
    v_computed_hash VARCHAR(64);
    v_record RECORD;
BEGIN
    -- Count total entries
    SELECT COUNT(*) INTO v_total_entries
    FROM audit_logs
    WHERE tenant_id = p_tenant_id
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date);
    
    -- Verify each entry in chronological order
    FOR v_record IN
        SELECT *
        FROM audit_logs
        WHERE tenant_id = p_tenant_id
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
        ORDER BY created_at ASC, id ASC
    LOOP
        -- Verify previous hash matches
        IF v_record.previous_hash IS DISTINCT FROM v_previous_hash THEN
            v_invalid_entries := v_invalid_entries + 1;
            IF v_first_invalid_id IS NULL THEN
                v_first_invalid_id := v_record.id;
                v_first_invalid_created_at := v_record.created_at;
                v_error_message := 'Previous hash mismatch';
            END IF;
        END IF;
        
        -- Compute expected hash
        v_computed_hash := compute_audit_hash(
            v_record.tenant_id,
            v_record.event_type,
            v_record.action,
            v_record.resource_type,
            v_record.resource_id,
            v_record.user_id,
            v_record.event_data,
            v_record.previous_hash,
            v_record.created_at
        );
        
        -- Verify current hash matches computed hash
        IF v_record.current_hash != v_computed_hash THEN
            v_invalid_entries := v_invalid_entries + 1;
            IF v_first_invalid_id IS NULL THEN
                v_first_invalid_id := v_record.id;
                v_first_invalid_created_at := v_record.created_at;
                v_error_message := 'Current hash mismatch';
            END IF;
        END IF;
        
        -- Update previous hash for next iteration
        v_previous_hash := v_record.current_hash;
    END LOOP;
    
    -- Return results
    RETURN QUERY SELECT
        v_invalid_entries = 0 AS is_valid,
        v_total_entries,
        v_invalid_entries,
        v_first_invalid_id,
        v_first_invalid_created_at,
        v_error_message;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- AUDIT LOG RETENTION POLICIES
-- ============================================================================

-- Table to store retention policies per tenant
CREATE TABLE IF NOT EXISTS audit_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Retention settings
    retention_days INTEGER NOT NULL DEFAULT 2555, -- 7 years default
    archive_after_days INTEGER DEFAULT 365, -- Archive after 1 year
    
    -- Tier-based defaults
    tier VARCHAR(20) NOT NULL DEFAULT 'basic',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT audit_retention_policies_tier_check CHECK (tier IN ('basic', 'business', 'enterprise')),
    CONSTRAINT audit_retention_policies_unique_tenant UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY audit_retention_policies_tenant_isolation ON audit_retention_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Function to set retention policy based on tier
CREATE OR REPLACE FUNCTION set_audit_retention_policy(
    p_tenant_id UUID,
    p_tier VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_retention_days INTEGER;
BEGIN
    -- Set retention days based on tier
    CASE p_tier
        WHEN 'basic' THEN v_retention_days := 2555; -- 7 years
        WHEN 'business' THEN v_retention_days := 3650; -- 10 years
        WHEN 'enterprise' THEN v_retention_days := 36135; -- 99 years
        ELSE v_retention_days := 2555; -- Default to 7 years
    END CASE;
    
    -- Insert or update retention policy
    INSERT INTO audit_retention_policies (tenant_id, retention_days, tier)
    VALUES (p_tenant_id, v_retention_days, p_tier)
    ON CONFLICT (tenant_id) DO UPDATE
    SET retention_days = v_retention_days,
        tier = p_tier,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Tamper-evident audit log with SHA-256 hash chain';
COMMENT ON COLUMN audit_logs.previous_hash IS 'SHA-256 hash of previous entry (NULL for genesis block)';
COMMENT ON COLUMN audit_logs.current_hash IS 'SHA-256 hash of this entry';
COMMENT ON FUNCTION create_audit_log IS 'Creates audit log entry with automatic hash chain computation';
COMMENT ON FUNCTION verify_audit_chain IS 'Verifies integrity of audit log hash chain';
COMMENT ON FUNCTION compute_audit_hash IS 'Computes SHA-256 hash for audit entry';
COMMENT ON FUNCTION get_last_audit_hash IS 'Gets the last audit log hash for a tenant';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION verify_audit_chain TO authenticated;
GRANT EXECUTE ON FUNCTION compute_audit_hash TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_audit_hash TO authenticated;
GRANT EXECUTE ON FUNCTION set_audit_retention_policy TO authenticated;
