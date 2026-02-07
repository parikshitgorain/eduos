-- Rollback Migration 020: Tamper-Evident Audit Log System
-- Description: Removes audit log system and hash chain functionality
-- Author: EduOS Platform Team
-- Date: 2026-02-07

-- Drop functions
DROP FUNCTION IF EXISTS set_audit_retention_policy(UUID, VARCHAR);
DROP FUNCTION IF EXISTS verify_audit_chain(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS create_audit_log(UUID, VARCHAR, VARCHAR, VARCHAR, UUID, UUID, VARCHAR, VARCHAR, INET, TEXT, UUID, UUID, JSONB, JSONB, JSONB, VARCHAR, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS get_last_audit_hash(UUID);
DROP FUNCTION IF EXISTS compute_audit_hash(UUID, VARCHAR, VARCHAR, VARCHAR, UUID, UUID, JSONB, VARCHAR, TIMESTAMP WITH TIME ZONE);

-- Drop tables
DROP TABLE IF EXISTS audit_retention_policies CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
