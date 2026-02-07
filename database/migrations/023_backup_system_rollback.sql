-- Rollback Migration 023: Backup and Disaster Recovery System

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_set_backup_retention ON backups;

-- Drop functions
DROP FUNCTION IF EXISTS get_backup_statistics(VARCHAR);
DROP FUNCTION IF EXISTS mark_expired_backups();
DROP FUNCTION IF EXISTS set_backup_retention();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS dr_drills;
DROP TABLE IF EXISTS backup_components;
DROP TABLE IF EXISTS backups;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 023: Backup System - Rollback Completed';
END $$;
