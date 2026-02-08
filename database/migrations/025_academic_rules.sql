-- Migration 025: Academic Rules System
-- Creates tables for academic policy rule configuration and management

-- ============================================================================
-- ACADEMIC RULES TABLE
-- ============================================================================
-- Stores academic policy rules (attendance thresholds, grade eligibility, etc.)

CREATE TABLE IF NOT EXISTS academic_rules (
    rule_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'attendance_threshold', 'grade_eligibility', 'grace_marks'
    conditions JSONB NOT NULL, -- Array of condition objects
    actions JSONB NOT NULL, -- Array of action objects
    priority INTEGER DEFAULT 100, -- Higher priority rules evaluated first
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP, -- NULL means no end date
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'deleted'
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_academic_rules_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_rule_type CHECK (rule_type IN ('attendance_threshold', 'grade_eligibility', 'grace_marks')),
    CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'deleted')),
    CONSTRAINT chk_effective_dates CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- Indexes for performance
CREATE INDEX idx_academic_rules_tenant ON academic_rules(tenant_id);
CREATE INDEX idx_academic_rules_type ON academic_rules(rule_type);
CREATE INDEX idx_academic_rules_status ON academic_rules(status);
CREATE INDEX idx_academic_rules_effective ON academic_rules(effective_from, effective_until);
CREATE INDEX idx_academic_rules_priority ON academic_rules(priority DESC);

-- GIN index for JSONB conditions and actions
CREATE INDEX idx_academic_rules_conditions ON academic_rules USING GIN (conditions);
CREATE INDEX idx_academic_rules_actions ON academic_rules USING GIN (actions);

-- Row-Level Security (RLS)
ALTER TABLE academic_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access rules for their tenant
CREATE POLICY academic_rules_tenant_isolation ON academic_rules
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- RULE EVALUATIONS TABLE
-- ============================================================================
-- Logs all rule evaluations for audit and analytics

CREATE TABLE IF NOT EXISTS rule_evaluations (
    evaluation_id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    student_id UUID, -- Optional: specific student affected
    context JSONB NOT NULL, -- Evaluation context (attendance_percentage, grade, etc.)
    condition_met BOOLEAN NOT NULL,
    action_executed BOOLEAN NOT NULL DEFAULT FALSE,
    action_result JSONB, -- Result of action execution
    evaluated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_rule_evaluations_rule FOREIGN KEY (rule_id) 
        REFERENCES academic_rules(rule_id) ON DELETE CASCADE,
    CONSTRAINT fk_rule_evaluations_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_rule_evaluations_rule ON rule_evaluations(rule_id);
CREATE INDEX idx_rule_evaluations_tenant ON rule_evaluations(tenant_id);
CREATE INDEX idx_rule_evaluations_student ON rule_evaluations(student_id);
CREATE INDEX idx_rule_evaluations_date ON rule_evaluations(evaluated_at DESC);

-- RLS
ALTER TABLE rule_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rule_evaluations_tenant_isolation ON rule_evaluations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- RULE OVERRIDES TABLE
-- ============================================================================
-- Tracks manual overrides of rule decisions with approval workflow

CREATE TABLE IF NOT EXISTS rule_overrides (
    override_id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL,
    reason TEXT NOT NULL,
    supporting_documents JSONB, -- Array of document URLs/metadata
    requested_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approval_chain JSONB NOT NULL, -- Array of roles: ['teacher', 'admin', 'dean']
    current_approval_level INTEGER NOT NULL DEFAULT 0,
    approvals JSONB NOT NULL DEFAULT '[]', -- Array of approval records
    approved_by UUID,
    approval_reason TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_rule_overrides_rule FOREIGN KEY (rule_id) 
        REFERENCES academic_rules(rule_id) ON DELETE CASCADE,
    CONSTRAINT fk_rule_overrides_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_override_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Indexes
CREATE INDEX idx_rule_overrides_rule ON rule_overrides(rule_id);
CREATE INDEX idx_rule_overrides_tenant ON rule_overrides(tenant_id);
CREATE INDEX idx_rule_overrides_student ON rule_overrides(student_id);
CREATE INDEX idx_rule_overrides_status ON rule_overrides(status);

-- RLS
ALTER TABLE rule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY rule_overrides_tenant_isolation ON rule_overrides
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- RULE OVERRIDE AUDIT TABLE
-- ============================================================================
-- Tracks all actions taken on override requests for audit trail

CREATE TABLE IF NOT EXISTS rule_override_audit (
    audit_id UUID PRIMARY KEY,
    override_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'approved_level', 'rejected', 'cancelled'
    actor_id UUID NOT NULL,
    details JSONB, -- Additional context about the action
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_override_audit_override FOREIGN KEY (override_id) 
        REFERENCES rule_overrides(override_id) ON DELETE CASCADE,
    CONSTRAINT fk_override_audit_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_override_audit_override ON rule_override_audit(override_id);
CREATE INDEX idx_override_audit_tenant ON rule_override_audit(tenant_id);
CREATE INDEX idx_override_audit_date ON rule_override_audit(created_at DESC);

-- RLS
ALTER TABLE rule_override_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY override_audit_tenant_isolation ON rule_override_audit
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- RETROACTIVE POLICY REQUESTS TABLE
-- ============================================================================
-- Tracks requests to apply policy changes retroactively

CREATE TABLE IF NOT EXISTS retroactive_policy_requests (
    request_id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    old_config JSONB NOT NULL,
    new_config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected'
    requested_by UUID NOT NULL,
    approved_by UUID,
    affected_count INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_retroactive_requests_rule FOREIGN KEY (rule_id) 
        REFERENCES academic_rules(rule_id) ON DELETE CASCADE,
    CONSTRAINT fk_retroactive_requests_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT chk_retroactive_status CHECK (status IN ('pending_approval', 'approved', 'rejected'))
);

-- Indexes
CREATE INDEX idx_retroactive_requests_rule ON retroactive_policy_requests(rule_id);
CREATE INDEX idx_retroactive_requests_tenant ON retroactive_policy_requests(tenant_id);
CREATE INDEX idx_retroactive_requests_status ON retroactive_policy_requests(status);

-- RLS
ALTER TABLE retroactive_policy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY retroactive_requests_tenant_isolation ON retroactive_policy_requests
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- RETROACTIVE APPLICATION SNAPSHOTS TABLE
-- ============================================================================
-- Stores snapshots of data before retroactive application for rollback

CREATE TABLE IF NOT EXISTS retroactive_application_snapshots (
    snapshot_id UUID PRIMARY KEY,
    request_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL,
    snapshot_data JSONB NOT NULL, -- Contains affected records and their original states
    rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    rolled_back_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_retroactive_snapshots_request FOREIGN KEY (request_id) 
        REFERENCES retroactive_policy_requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_retroactive_snapshots_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_retroactive_snapshots_rule FOREIGN KEY (rule_id) 
        REFERENCES academic_rules(rule_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_retroactive_snapshots_request ON retroactive_application_snapshots(request_id);
CREATE INDEX idx_retroactive_snapshots_tenant ON retroactive_application_snapshots(tenant_id);
CREATE INDEX idx_retroactive_snapshots_rule ON retroactive_application_snapshots(rule_id);
CREATE INDEX idx_retroactive_snapshots_rolled_back ON retroactive_application_snapshots(rolled_back);

-- RLS
ALTER TABLE retroactive_application_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY retroactive_snapshots_tenant_isolation ON retroactive_application_snapshots
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_academic_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for academic_rules
CREATE TRIGGER trigger_update_academic_rules_updated_at
    BEFORE UPDATE ON academic_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_academic_rules_updated_at();

-- Trigger for rule_overrides
CREATE TRIGGER trigger_update_rule_overrides_updated_at
    BEFORE UPDATE ON rule_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_academic_rules_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE academic_rules IS 'Stores academic policy rules for automated enforcement';
COMMENT ON TABLE rule_evaluations IS 'Audit log of all rule evaluations';
COMMENT ON TABLE rule_overrides IS 'Manual overrides of rule decisions with configurable approval workflow';
COMMENT ON TABLE rule_override_audit IS 'Audit trail of all actions taken on override requests';
COMMENT ON TABLE retroactive_policy_requests IS 'Requests to apply policy changes retroactively';
COMMENT ON TABLE retroactive_application_snapshots IS 'Snapshots of data before retroactive application for rollback capability';

COMMENT ON COLUMN academic_rules.conditions IS 'Array of condition objects: [{field, operator, value}]';
COMMENT ON COLUMN academic_rules.actions IS 'Array of action objects: [{type, parameters}]';
COMMENT ON COLUMN academic_rules.priority IS 'Higher priority rules evaluated first (default: 100)';
COMMENT ON COLUMN academic_rules.effective_from IS 'Rule becomes active from this date';
COMMENT ON COLUMN academic_rules.effective_until IS 'Rule expires after this date (NULL = no expiry)';

COMMENT ON COLUMN rule_overrides.approval_chain IS 'Array of roles defining approval sequence: ["teacher", "admin", "dean"]';
COMMENT ON COLUMN rule_overrides.current_approval_level IS 'Current position in approval chain (0-indexed)';
COMMENT ON COLUMN rule_overrides.approvals IS 'Array of approval records with timestamps and reasons';
COMMENT ON COLUMN rule_overrides.supporting_documents IS 'Array of document metadata supporting the override request';

COMMENT ON COLUMN retroactive_application_snapshots.snapshot_data IS 'Contains affected records and their original states for rollback';
COMMENT ON COLUMN retroactive_application_snapshots.rolled_back IS 'Indicates if this snapshot has been used for rollback';
