-- ============================================================================
-- Migration 006 Rollback: Hierarchical Role-Based Access Control (RBAC)
-- ============================================================================
-- Description: Rollback hierarchical RBAC implementation
-- Author: EduOS Team
-- Date: 2026-02-05
-- ============================================================================

-- Drop functions
DROP FUNCTION IF EXISTS create_default_roles(UUID);
DROP FUNCTION IF EXISTS get_user_field_permissions(UUID, UUID, VARCHAR);
DROP FUNCTION IF EXISTS user_has_permission(UUID, UUID, VARCHAR);
DROP FUNCTION IF EXISTS get_user_permissions(UUID, UUID);

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS field_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

DO $
BEGIN
  RAISE NOTICE 'Migration 006 Rollback: Hierarchical RBAC - COMPLETED';
  RAISE NOTICE 'Dropped tables: field_permissions, user_roles, role_permissions, permissions';
  RAISE NOTICE 'Dropped functions: create_default_roles, get_user_field_permissions, user_has_permission, get_user_permissions';
END $;
