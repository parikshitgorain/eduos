-- Rollback Migration 015: AI Approval Queue System
-- Description: Removes AI approval queue tables and related objects
-- Author: EduOS Platform Team
-- Date: 2026-02-07

-- ============================================================================
-- DROP POLICIES
-- ============================================================================

DROP POLICY IF EXISTS ai_approval_audit_tenant_isolation ON ai_approval_audit_log;
DROP POLICY IF EXISTS ai_recommendations_tenant_isolation ON ai_recommendations;

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_ai_recommendations_updated_at ON ai_recommendations;
DROP FUNCTION IF EXISTS update_ai_recommendations_updated_at();

-- ============================================================================
-- DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS get_pending_recommendations_count(UUID, VARCHAR);
DROP FUNCTION IF EXISTS expire_old_recommendations();

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

-- Audit log indexes
DROP INDEX IF EXISTS idx_ai_approval_audit_performed_by;
DROP INDEX IF EXISTS idx_ai_approval_audit_performed_at;
DROP INDEX IF EXISTS idx_ai_approval_audit_recommendation;
DROP INDEX IF EXISTS idx_ai_approval_audit_tenant;

-- Recommendations indexes
DROP INDEX IF EXISTS idx_ai_recommendations_related_entity;
DROP INDEX IF EXISTS idx_ai_recommendations_tenant_status_type;
DROP INDEX IF EXISTS idx_ai_recommendations_tenant_type;
DROP INDEX IF EXISTS idx_ai_recommendations_tenant_status;
DROP INDEX IF EXISTS idx_ai_recommendations_confidence;
DROP INDEX IF EXISTS idx_ai_recommendations_created_at;
DROP INDEX IF EXISTS idx_ai_recommendations_type;
DROP INDEX IF EXISTS idx_ai_recommendations_status;
DROP INDEX IF EXISTS idx_ai_recommendations_tenant;

-- ============================================================================
-- DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS ai_approval_audit_log CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;

-- ============================================================================
-- REMOVE MIGRATION RECORD
-- ============================================================================

DELETE FROM schema_migrations WHERE version = 15;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
