-- ============================================================================
-- Migration 007 Rollback: Multi-Factor Authentication (MFA) Support
-- ============================================================================
-- Description: Rollback MFA support migration
-- Author: EduOS Team
-- Date: 2026-02-05
-- ============================================================================

-- Drop function
DROP FUNCTION IF EXISTS is_mfa_required(UUID, UUID);

-- Drop triggers
DROP TRIGGER IF EXISTS update_mfa_settings_updated_at ON mfa_settings;
DROP TRIGGER IF EXISTS update_tenant_mfa_policy_updated_at ON tenant_mfa_policy;

-- Drop tables
DROP TABLE IF EXISTS mfa_recovery_attempts CASCADE;
DROP TABLE IF EXISTS mfa_settings CASCADE;
DROP TABLE IF EXISTS tenant_mfa_policy CASCADE;

-- Remove MFA columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enforced_at;

-- Log rollback completion
DO $
BEGIN
  RAISE NOTICE 'Migration 007 Rollback: MFA Support - COMPLETED';
  RAISE NOTICE 'Dropped tables: mfa_settings, mfa_recovery_attempts, tenant_mfa_policy';
  RAISE NOTICE 'Removed MFA columns from users table';
END $;
