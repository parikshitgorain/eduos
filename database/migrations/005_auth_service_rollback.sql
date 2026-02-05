-- ============================================================================
-- Migration 005 Rollback: Authentication Service
-- ============================================================================
-- Description: Rollback authentication service tables
-- Author: EduOS Team
-- Date: 2026-02-05
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Log rollback completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 005 Rollback: Authentication Service - COMPLETED';
  RAISE NOTICE 'Dropped tables: sessions, refresh_tokens, audit_logs, roles, users';
END $$;
