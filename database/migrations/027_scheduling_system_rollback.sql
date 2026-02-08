-- ============================================================================
-- Rollback Migration: 027_scheduling_system_rollback.sql
-- Description: Rollback scheduling system tables and functions
-- Version: 1.0
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_schedule_conflicts_updated_at ON schedule_conflicts;
DROP TRIGGER IF EXISTS update_schedule_overrides_updated_at ON schedule_overrides;
DROP TRIGGER IF EXISTS update_schedule_slots_updated_at ON schedule_slots;
DROP TRIGGER IF EXISTS update_batches_updated_at ON batches;
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;

-- Drop function
DROP FUNCTION IF EXISTS detect_schedule_conflicts(UUID, UUID, UUID, UUID, INTEGER, TIME, TIME, DATE, DATE, UUID);

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS schedule_conflicts CASCADE;
DROP TABLE IF EXISTS schedule_overrides CASCADE;
DROP TABLE IF EXISTS schedule_slots CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
