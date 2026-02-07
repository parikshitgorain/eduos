-- Migration 015: AI Approval Queue System
-- Description: Creates tables for managing AI recommendations awaiting human approval
-- Author: EduOS Platform Team
-- Date: 2026-02-07

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: ai_recommendations
-- Description: Stores AI recommendations awaiting human approval (HITL workflow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
    -- Primary identification
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    
    -- Recommendation details
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
        'duplicate_detection',
        'risk_prediction',
        'schedule_optimization',
        'attendance_anomaly',
        'payment_anomaly'
    )),
    recommendation_text TEXT NOT NULL,
    confidence_score DECIMAL(3, 2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    -- Explainability metadata
    reason_codes TEXT[] NOT NULL DEFAULT '{}',
    shap_values JSONB,
    feature_importance JSONB,
    model_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
    
    -- Approval workflow
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'approved',
        'rejected',
        'more_info_requested',
        'expired'
    )),
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    
    -- Related entities (optional, depends on recommendation type)
    related_entity_type VARCHAR(50),  -- e.g., 'student', 'enrollment', 'payment'
    related_entity_id UUID,
    
    -- Approval details
    approved_by UUID,  -- user_id of approver
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_token VARCHAR(100),  -- Token for executing approved action
    approval_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,  -- Recommendations can expire
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Audit
    created_by UUID NOT NULL,  -- user_id who triggered the AI recommendation
    
    -- Indexes
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Performance indexes
CREATE INDEX idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(recommendation_type);
CREATE INDEX idx_ai_recommendations_created_at ON ai_recommendations(created_at DESC);
CREATE INDEX idx_ai_recommendations_confidence ON ai_recommendations(confidence_score DESC);

-- Composite indexes for common queries
CREATE INDEX idx_ai_recommendations_tenant_status ON ai_recommendations(tenant_id, status);
CREATE INDEX idx_ai_recommendations_tenant_type ON ai_recommendations(tenant_id, recommendation_type);
CREATE INDEX idx_ai_recommendations_tenant_status_type ON ai_recommendations(tenant_id, status, recommendation_type);

-- Related entity lookup
CREATE INDEX idx_ai_recommendations_related_entity ON ai_recommendations(related_entity_type, related_entity_id) WHERE related_entity_id IS NOT NULL;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see recommendations for their tenant
CREATE POLICY ai_recommendations_tenant_isolation ON ai_recommendations
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_recommendations_updated_at
    BEFORE UPDATE ON ai_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_recommendations_updated_at();

-- ============================================================================
-- TABLE: ai_approval_audit_log
-- Description: Audit trail for all approval decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_approval_audit_log (
    -- Primary identification
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    recommendation_id UUID NOT NULL,
    
    -- Audit details
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'created',
        'approved',
        'rejected',
        'more_info_requested',
        'expired',
        'executed'
    )),
    performed_by UUID NOT NULL,  -- user_id
    reason TEXT,
    
    -- Snapshot of recommendation state at time of action
    recommendation_snapshot JSONB NOT NULL,
    
    -- Timestamps
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT fk_tenant_audit FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendation FOREIGN KEY (recommendation_id) REFERENCES ai_recommendations(recommendation_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR AUDIT LOG
-- ============================================================================

CREATE INDEX idx_ai_approval_audit_tenant ON ai_approval_audit_log(tenant_id);
CREATE INDEX idx_ai_approval_audit_recommendation ON ai_approval_audit_log(recommendation_id);
CREATE INDEX idx_ai_approval_audit_performed_at ON ai_approval_audit_log(performed_at DESC);
CREATE INDEX idx_ai_approval_audit_performed_by ON ai_approval_audit_log(performed_by);

-- ============================================================================
-- ROW-LEVEL SECURITY FOR AUDIT LOG
-- ============================================================================

ALTER TABLE ai_approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_approval_audit_tenant_isolation ON ai_approval_audit_log
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get pending recommendations count by type
CREATE OR REPLACE FUNCTION get_pending_recommendations_count(
    p_tenant_id UUID,
    p_recommendation_type VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_recommendation_type IS NULL THEN
        SELECT COUNT(*)
        INTO v_count
        FROM ai_recommendations
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
    ELSE
        SELECT COUNT(*)
        INTO v_count
        FROM ai_recommendations
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
          AND recommendation_type = p_recommendation_type
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
    END IF;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Expire old pending recommendations
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE ai_recommendations
        SET status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at < CURRENT_TIMESTAMP
        RETURNING recommendation_id, tenant_id
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;
    
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_recommendations IS 'Stores AI recommendations awaiting human approval (HITL workflow)';
COMMENT ON COLUMN ai_recommendations.recommendation_type IS 'Type of AI recommendation';
COMMENT ON COLUMN ai_recommendations.confidence_score IS 'AI confidence score (0.0 - 1.0)';
COMMENT ON COLUMN ai_recommendations.reason_codes IS 'Array of reason codes explaining the recommendation';
COMMENT ON COLUMN ai_recommendations.shap_values IS 'SHAP feature importance values for explainability';
COMMENT ON COLUMN ai_recommendations.approval_token IS 'Token required to execute the approved action';
COMMENT ON COLUMN ai_recommendations.expires_at IS 'Timestamp when recommendation expires if not acted upon';

COMMENT ON TABLE ai_approval_audit_log IS 'Audit trail for all AI approval decisions';
COMMENT ON COLUMN ai_approval_audit_log.recommendation_snapshot IS 'Complete snapshot of recommendation state at time of action';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to application role
GRANT SELECT, INSERT, UPDATE ON ai_recommendations TO eduos_app;
GRANT SELECT, INSERT ON ai_approval_audit_log TO eduos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eduos_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (15, 'AI Approval Queue System', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
