-- Rollback Migration 012: Offline-First Attendance System
-- Removes attendance tracking tables and related objects

-- Drop triggers
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS sync_conflicts CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Note: Indexes and RLS policies are automatically dropped with tables
